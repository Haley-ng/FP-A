import { createClient } from "@/lib/supabase/server";
import { query } from "@/lib/db/client";

/**
 * The signed-in user's app identity — name and role from `members` (never
 * from what the client claims), plus the profile picture Google gave the
 * Supabase session. Called by AppShell on every page load, so a member
 * removed from the allow-list after signing in is caught here too, not just
 * at the OAuth callback.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return Response.json({ error: "not signed in" }, { status: 401 });
  }

  const rows = await query<{ id: string; name: string; role: string }>(
    "select id, name, role from members where lower(email) = lower($1)",
    [user.email]
  );
  if (rows.length === 0) {
    return Response.json({ error: "not a member" }, { status: 403 });
  }

  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const avatarUrl = (metadata?.avatar_url as string | undefined) ?? (metadata?.picture as string | undefined) ?? null;

  return Response.json({
    member: { id: rows[0].id, email: user.email, name: rows[0].name, role: rows[0].role, avatarUrl },
  });
}
