# CLAUDE.md — fpa-web-app

Project-level guidance for the **FP&A Web App**, within the App Development workspace. Root and workspace `CLAUDE.md` rules (safety, role, working pattern) still apply — this file only adds what's specific to this project.

## What this project is

A financial planning & analysis web app for a 5-person FP&A team (1 FP&A Manager, 2 Senior Financial Analysts, 2 Financial Analysts), plus the CFO/CEO/Board, who now sign in too (view-only) — see "Access & login" below; there is no more public, unauthenticated access. **11 pages** — Executive Overview, P&L, Balance Sheet, Cash Flow, Budget vs Actual, Variance Analysis, Scenario Modelling, Forecast, Territory Performance, Reports, and Data Library — plus an embedded AI Commentary panel invoked from three of them (Budget vs Actual, Variance Analysis, Scenario Modelling). Full rationale and scope decisions are in `docs/2-spec/design.md`; per-page flows and ASCII diagrams in `docs/1-discovery/fp&awepapp_userflow.md`; route/query-param structure in `docs/3-plan/sitemap.md`.

## Current stage

**Live on Supabase, matching the prototype-derived spec, since 2026-09-20.** The original Phase 0–3 build (pre-2026-09-08, old 11-line P&L, reading local Excel files directly) has been superseded twice over: first by a full front-end rebuild matching `docs/3-plan/prototype/` exactly (12-line P&L, 5-lever Scenario, no-materiality Balance Sheet, etc. — all 11 pages, initially on mock data in `app/src/lib/fpa/sampleData.ts`), then by wiring that same front-end to a real Postgres database on Supabase. The Phase 0–3 parsing/calc code (`app/src/lib/calcEngine/`, `parsers/`, `dataSources/`) still exists but isn't called by any page — its account-filter predicates and TTD/FTP logic were reused (translated to SQL) rather than the code itself being called directly:

- Schema initialised from `docs/3-plan/erd.md` — see `app/supabase/migrations/20260919000000_init_schema.sql` (16 tables, 6 enums, 20 FKs, RLS on with no policies yet).
- Real Finance Dataset loaded into it (GL, Budget, Chart of Accounts, Currency, Territory, Trial Balance, Cash Flow mapping, SoCE mapping, Calendar — 9 of the 10 source files; `calculations_bi` deliberately has no table, per erd.md).
- All 11 `/api/fpa/*` routes rewired from `sampleData.ts` to real SQL in `app/src/lib/db/*`, translating the 70 DAX measures in `Calculations BI.xlsx` — see `docs/3-plan/dax-to-sql.md` for the full mapping and the account-filter/TTD-FTP semantics reused from the already-validated `app/src/lib/calcEngine/*.ts`.
- Balance Sheet ties to exactly $0 and Cash Flow reconciles to exactly $0, re-verified against the real data (not just the old mock).

`app/src/lib/fpa/sampleData.ts` and `calculations.ts` are no longer read by any page — kept only as the mock the front-end was originally built against.

All 10 write actions in `docs/3-plan/sequence.md` are implemented (Scenario CRUD, Report generate/regenerate, Forecast Version save — new `forecast_versions` table — and Data Library refresh); see `docs/3-plan/write-actions-plan.md` and `MEMORY.md`'s 2026-09-20 entries. Data Library upload and Variance Analysis save/export are genuinely blocked (no Google Drive folder; no destination ever specified for the latter), not unfinished — both return `501` honestly rather than faking success.

**Real Google sign-in, since 2026-09-22** — see "Access & login" below. A real Anthropic API key (AI Commentary degrades gracefully without one) and a real Google Drive-backed refresh pipeline (the app currently reads Supabase directly, not a scheduled Drive sync) are still open.

## Workflow

`docs/1-discovery` → `2-spec` → `3-plan` → `4-release`, mirrored by `app/` for the actual build. Don't skip ahead — no code in `app/` until `docs/3-plan/` exists and has been agreed.

## Source of truth

`docs/2-spec/design.md` is the current source of truth for scope — and as of 2026-09-08, `design.md` itself is written to match `docs/3-plan/prototype/`. When in doubt about a specific number, field, or interaction, check the prototype's actual computation logic (`FP&A Prototype.dc.html` plus `fpa-data.js`/`fpa-bs.js`), not just its wireframe board — the two have disagreed before, and the working prototype won. Don't add features beyond `design.md` without running them back through the `brainstorm` skill (`.claude/skills/brainstorm/`) — that's how every scope decision so far was made, and the spec's "Considered and Deferred" table tracks what was intentionally cut and why. Only **anomaly detection** remains deferred from the original "Tier 3" wishlist — rolling forecasts and board-pack export are in scope as the Forecast and Reports pages.

## Notes specific to this app

- **Divergence from design.md, worth flagging explicitly:** design.md §4 says source data is "not stored by this app... never copied into the app's own storage," read live from Google Drive on each refresh. In practice the source Finance Dataset has been loaded directly into Supabase Postgres tables (`gl`, `budget`, `chart_of_accounts`, `currency_rate`, `territory`, `trial_balance`, `cash_flow_mapping`, `soce_mapping`, `calendar`) as the data layer the app actually queries — there is no live Google Drive read path yet, and no scheduled-refresh/"Refresh Now" mechanism against Drive. If a real Drive-backed refresh pipeline is built later, decide explicitly whether it replaces these tables' contents on each sync or whether design.md's "never stored" framing gets revised instead — don't let the two silently drift further apart.
- All financial figures (P&L, Balance Sheet, Cash Flow, KPIs, variances, USD conversions) are calculated live from those tables — never stored as separate numbers. What *is* meant to persist: Scenarios (name, territory, fiscal year, lever values), Generated Reports (frozen snapshots), and Dataset Sync Status (latest refresh/validation state per dataset, no history) — tables exist (`erd.md`) but nothing writes to them yet (see "Current stage").
- AI Commentary (Anthropic API) is on-demand only, regenerated fresh each click, on Budget vs Actual, Variance Analysis, or Scenario Modelling — never saved or kept as history.

## Access & login

**This supersedes design.md §2's original "public view-link, no login" decision** — the user explicitly asked for that to change (an unauthenticated app was reported as the problem to fix), so treat this section, not design.md, as current for access control.

- Every page and API route requires a signed-in Supabase session — enforced in `app/src/proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`; same mechanism). No session → pages redirect to `/login`, API routes return `401` JSON.
- Login is Google-only via Supabase Auth (`app/src/app/login/page.tsx`, one "Sign in with Google" button) — there is deliberately no registration page. `app/src/app/auth/callback/route.ts` exchanges the OAuth code for a session, then checks the new `members` table (not in `erd.md`, which predates login) by email; not on the allow-list → signed out immediately, redirected to `/login?error=no_access`. Adding a person to the app is a direct `INSERT INTO members (email, name, role)` — no admin UI exists or was requested.
- **Role comes from `members.role`, not a client toggle** — the old Edit/View sidebar switch is gone. Any role except the literal string `'board'` can write (mirrors design.md's old Executive/Board view-only tier); `board` is view-only. This convention lives in `app/src/lib/auth/member.ts`'s `isEditRole()`.
- Every write route's `requireEditLink()` (`app/src/lib/db/writeGuards.ts`) checks the real signed-in session + role server-side now — it used to trust a client-asserted `linkMode` field, explicitly documented at the time as "not real access control." That gap is closed.
- Top-right of the top bar shows the signed-in member's Google profile picture, their `members.name`, `members.role`, and a working Sign out button (`app/src/components/fpa/AppShell.tsx`).
