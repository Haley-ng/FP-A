-- members — the allow-list for Google sign-in. Not in the original erd.md
-- (that schema predates login entirely — design.md's original decision was a
-- public view-link with no login at all). Rows are added by an administrator
-- in advance (e.g. via the Supabase Studio table editor or a direct INSERT);
-- this app never writes to this table itself, only reads it.
--
-- `role` is free text, not an enum, so an administrator can introduce a new
-- role without a migration. The app's own convention (src/lib/auth/member.ts):
-- any role except the literal string 'board' can write (Scenarios, Reports,
-- Data Library refresh, Forecast versions); 'board' is view-only, mirroring
-- design.md's original Executive/Board tier now that they sign in for real
-- instead of using an anonymous public link.

begin;

create table members (
  id         text primary key default gen_random_uuid()::text,
  email      text not null unique,
  name       text not null,
  role       text not null,
  created_at timestamptz not null default now()
);

alter table members enable row level security;

commit;
