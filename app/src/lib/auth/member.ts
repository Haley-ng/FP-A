import { createClient } from "@/lib/supabase/server";
import { query } from "@/lib/db/client";

export interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * The signed-in user's row from `members`, or null if either nobody is
 * signed in or their Google email isn't in the allow-list. This is the one
 * place "is this person allowed in, and what's their real name/role" is
 * decided — every write route and the top-right profile display go through
 * this, not through anything the client asserts about itself.
 */
export async function getCurrentMember(): Promise<Member | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const rows = await query<{ id: string; email: string; name: string; role: string }>(
    "select id, email, name, role from members where lower(email) = lower($1)",
    [user.email]
  );
  return rows[0] ?? null;
}

/** 'board' (design.md's Executive/Board tier) is the one view-only role; every other role can write. */
export function isEditRole(role: string): boolean {
  return role.trim().toLowerCase() !== "board";
}
