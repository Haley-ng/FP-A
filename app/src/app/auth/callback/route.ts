import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { query } from "@/lib/db/client";

/**
 * Google redirects here after the user approves sign-in. Exchanges the code
 * for a real Supabase session, then immediately checks the `members`
 * allow-list — a valid Google login is not, by itself, access to this app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // Logged server-side only — never put the raw error in the redirect URL a browser can see.
      console.error("exchangeCodeForSession failed:", error.status, error.code, error.message);
    }

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        const rows = await query<{ id: string }>("select id from members where lower(email) = lower($1)", [user.email]);
        if (rows.length > 0) {
          return NextResponse.redirect(`${origin}/`);
        }
      }

      // Signed in with Google, but not on the allow-list — sign out immediately, don't
      // let them see the app even for one request.
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=no_access`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
