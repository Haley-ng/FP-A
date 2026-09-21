# write-actions-plan.md — Implementation Plan for the Write Actions in `sequence.md`

`docs/3-plan/plan.md` already exists and holds the original architecture/phases
document — this plan is saved under a different name so it doesn't overwrite
that file. It covers the 5 write actions in `sequence.md` that map to tables
that already exist and are fully specified (`scenarios`, `reports`,
`report_sections`). Actions 6–10 are not included — see "Not in this plan" at
the bottom for exactly why each is blocked and what has to happen first.

**A limitation that applies to every step below, stated once here so it isn't
repeated 5 times:** `linkMode` ("edit" vs "view") is currently a client-side
URL query param only (`?link=edit|view`), not a real credential — per
`sitemap.md`'s own Known Gaps, there is no second real URL yet. Every step's
"edit-link confirmed" check below means *the request body must say
`linkMode: "edit"`, and the server rejects it otherwise* — this stops the
normal UI from writing while on a view-link, but it is not real access
control, since nothing stops a request from claiming `linkMode: "edit"`
directly. Treat this as already documented, not silently overlooked.

## Step 1 — Save a new Scenario

**Action:** Wire the "Save scenario" button on `/scenario-modelling` (edit-link
only) to insert one new row into `scenarios`.

**Conditions to check, in this order, each returning a distinct error:**
1. Request body has `linkMode: "edit"` — otherwise `403 { error: "view-link cannot create a scenario" }`.
2. `name` is a non-empty string, trimmed length between 1 and 200 characters — otherwise `400 { error: "name is required (1-200 characters)" }`.
3. `territoryKey` is either the string `"all"` or an integer — if an integer, `SELECT territory_key FROM territory WHERE territory_key = $1` must return one row — otherwise `400 { error: "territoryKey does not exist" }`.
4. `fiscalYear` is an integer and `SELECT year FROM fiscal_years WHERE year = $1` must return one row — otherwise `400 { error: "fiscalYear does not exist" }`.
5. Each lever is a finite number within its defined range (from `SCENARIO_LEVERS` in `app/src/lib/fpa/sampleData.ts`): `salesGrowth` -20..20, `priceChange` -10..10, `cosRate` -8..8, `opexChange` -15..15, `headcount` -20..20 (integer) — otherwise `400 { error: "<leverName> is out of range" }` naming the specific lever.

**Files created:**
- `app/src/lib/db/writeGuards.ts` — exports `requireEditLink(body: { linkMode?: string }): void`, throwing a typed `WriteGuardError(403, message)` if `body.linkMode !== "edit"`. Every later step imports this instead of re-writing the check.
- `app/src/lib/db/scenarios.ts` — exports `insertScenario(input)`, which runs the territory/fiscal-year/lever validation above and, if all pass, does `INSERT INTO scenarios (id, name, territory_key, fiscal_year, sales_growth, price_change, cost_of_sales_rate, opex_change, headcount_change, scenario_type, last_saved_at) VALUES (gen_random_uuid()::text, ..., 'custom', now())` and returns the inserted row. Also exports `listScenarios()`: `SELECT * FROM scenarios ORDER BY last_saved_at DESC`.
- `app/src/app/api/scenarios/route.ts` — `POST` handler: parses the JSON body, calls `insertScenario`, returns `201 { scenario }` on success or the specific `4xx` from the failed condition above.

**Files modified:**
- `app/src/app/api/fpa/scenario-modelling/route.ts` — replace the `savedScenarios` block (currently built from `SAMPLE_SCENARIOS` in `sampleData.ts`) with a call to `listScenarios()`, computing each one's EBITDA the same way the existing code already does (`applyScenario` on its stored levers).
- `app/src/app/scenario-modelling/page.tsx` — add a "Scenario name" text field (not currently in the UI) next to the lever sliders; wire the existing "Save scenario" button's `onClick` to `POST /api/scenarios` with `{ linkMode, name, territoryKey: territory, fiscalYear: year, salesGrowth, priceChange, cosRate, opexChange, headcount }`; on success, show a inline confirmation message and re-fetch `/api/fpa/scenario-modelling` so the new row appears in "Saved scenarios"; on error, show the returned `error` message instead of a generic one.

**Uses from a previous step:** nothing — this is the first step.
**Produces for the next step:** the `requireEditLink` helper (reused as-is by every later step); a real row in `scenarios` with a real `id`; the "Saved scenarios" list now reads from the database instead of `sampleData.ts`.

**How to test:**
1. On `/scenario-modelling` with the rail set to "Edit", set Sales growth to 4%, Headcount to 2, type a name, click "Save scenario". A confirmation message appears and the new name shows up in "Saved scenarios" with a computed EBITDA.
2. Run `select id, name, territory_key, fiscal_year, sales_growth, headcount_change, scenario_type from scenarios;` in Supabase — the row is there with `scenario_type = 'custom'`.
3. Switch the rail to "View", try to save again — the request is rejected, the message names it as a view-link restriction, and the row count in `scenarios` is unchanged.
4. `curl -X POST /api/scenarios` with `salesGrowth: 999` (out of range) — response is `400` naming `salesGrowth`, and no row is inserted.

## Step 2 — Save changes to an existing Scenario

**Action:** Let a saved scenario's levers be reloaded into the sliders, edited, and saved back to the same row with `PUT`.

**Conditions to check, in this order:**
1. `linkMode: "edit"` via `requireEditLink` from Step 1 — otherwise `403`.
2. `:id` in the URL exists — `SELECT id FROM scenarios WHERE id = $1`; zero rows is `404 { error: "scenario not found" }`.
3. Each lever passes the same range validation as Step 1, condition 5 — same per-lever `400`.

**Territory and fiscal year are not part of this request** — per `sequence.md` #1, only lever values change on an update; a scenario's territory/fiscal-year are fixed at creation (Step 1) and never re-validated or re-written here.

**Files created:**
- `app/src/app/api/scenarios/[id]/route.ts` — `PUT` handler: reads `:id` from the route, validates as above, and on success calls a new `updateScenarioLevers` function.

**Files modified:**
- `app/src/lib/db/scenarios.ts` — add `updateScenarioLevers(id, levers)`: `UPDATE scenarios SET sales_growth = $1, price_change = $2, cost_of_sales_rate = $3, opex_change = $4, headcount_change = $5, last_saved_at = now() WHERE id = $6 RETURNING *`; if zero rows affected, throw a typed `NotFoundError`.
- `app/src/app/scenario-modelling/page.tsx` — make each row in "Saved scenarios" clickable: clicking it sets a new `loadedScenarioId` state and populates the lever sliders from that scenario's stored values (fetched via the existing `/api/fpa/scenario-modelling` payload, which Step 1 already extended to return each saved scenario's levers — add `levers` to that response's `savedScenarios` entries if not already present). When `loadedScenarioId` is set, show a "Save" button (`PUT /api/scenarios/{loadedScenarioId}`) instead of "Save as new"; add a "New scenario" link that clears `loadedScenarioId` and resets levers to Base Case, restoring the Step 1 "Save as new" button.

**Uses from Step 1:** `requireEditLink`; a scenario row already saved in Step 1's test to load and edit.
**Produces for the next step:** `updateScenarioLevers` and the `[id]` route file, which Step 3 adds its `DELETE` handler to.

**How to test:**
1. Click the scenario saved in Step 1 from the "Saved scenarios" list — the sliders jump to its stored values and the button now reads "Save".
2. Change Opex change to 5%, click "Save" — confirmation message appears, and the list's displayed EBITDA for that scenario updates without a page reload.
3. Run `select opex_change, last_saved_at from scenarios where id = '<that id>';` — the new value and a fresh timestamp are there.
4. `curl -X PUT /api/scenarios/does-not-exist` with valid levers — response is `404`.

## Step 3 — Delete a Scenario

**Action:** Add a delete control to each row in "Saved scenarios" that removes it from `scenarios`.

**Conditions to check, in this order:**
1. `linkMode: "edit"` via `requireEditLink` — otherwise `403`.
2. `:id` exists — same existence check as Step 2, condition 2 — otherwise `404`.

**Files modified:**
- `app/src/app/api/scenarios/[id]/route.ts` — add a `DELETE` handler alongside the existing `PUT` one.
- `app/src/lib/db/scenarios.ts` — add `deleteScenario(id)`: `DELETE FROM scenarios WHERE id = $1`; if zero rows affected, throw the same `NotFoundError` used in Step 2.
- `app/src/app/scenario-modelling/page.tsx` — add a small "Delete" link/icon next to each "Saved scenarios" row; clicking it sends `DELETE /api/scenarios/{id}` with `{ linkMode }` in the body; on success, remove it from the list in state and, if it was the currently-loaded scenario, clear `loadedScenarioId` and reset the sliders to Base Case.

**Uses from Step 2:** the `[id]/route.ts` file (this step adds a second export to it); a scenario row to delete (from Steps 1–2's testing).
**Produces for the next step:** nothing functional — this closes out full CRUD on `scenarios`, proving the request-validation-response pattern that Step 4 reuses on a different table shape.

**How to test:**
1. Click "Delete" on the test scenario from Steps 1–2 — it disappears from "Saved scenarios" immediately.
2. Run `select count(*) from scenarios;` — confirms the row is gone.
3. `curl -X DELETE /api/scenarios/does-not-exist` — response is `404`.
4. Switch to "View" link mode and attempt delete on any scenario — `403`, and the row still exists in the database afterward.

## Step 4 — Generate a Report

**Action:** Wire the "Generate report" button on `/reports` to freeze the current live figures into one `reports` row plus its `report_sections` rows, instead of only rendering a client-side preview.

**Conditions to check, in this order:**
1. `linkMode: "edit"` via `requireEditLink` — otherwise `403`.
2. `reportType` is one of `monthly_management_pack | board_pack | territory_review | variance_memo` — otherwise `400 { error: "unknown reportType" }`.
3. `fiscalYear` exists in `fiscal_years` — same check as Step 1, condition 4 — otherwise `400`.
4. `territoryKey` is either `null` (All Territories) or exists in `territory` — same check as Step 1, condition 3 — otherwise `400`.
5. `period` is one of `fy | h1 | h2 | q1 | q2 | q3 | q4` — otherwise `400 { error: "unknown period" }`.
6. `currency` is `usd` or `local` — otherwise `400`.
7. `sections` is a non-empty array where every entry is one of `kpi_summary | profit_and_loss | territory_summary | ranked_variances | forecast_outlook` — otherwise `400 { error: "unknown section: <value>" }` naming the first bad one, or `400 { error: "at least one section is required" }` if empty.

**Files created:**
- `app/src/app/api/reports/route.ts` — `POST` handler: validates as above, calls `buildReportBlocks` (already implemented in `app/src/lib/db/reports.ts`, currently used only by the read-only preview route) to compute the figures right now, then calls a new `insertReport`.
- `app/src/app/api/reports/[id]/route.ts` — `GET` handler: `SELECT * FROM reports WHERE id = $1` joined with `SELECT section_name FROM report_sections WHERE report_id = $1`; `404` if not found; returns the report's stored scope, `frozen_figures` (parsed back from JSON text), and its section list — this is what makes Step 4 testable (proof the figures were actually frozen, not just recomputed on every view).

**Files modified:**
- `app/src/lib/db/reports.ts` — add `insertReport(input, blocks)`: serializes `blocks` (the already-computed report content) to a JSON string, `INSERT INTO reports (id, report_type, territory_key, fiscal_year, period, currency, frozen_figures, generated_at) VALUES (gen_random_uuid()::text, ..., now()) RETURNING id`, then loops `input.sections` inserting one `INSERT INTO report_sections (report_id, section_name) VALUES ($1, $2)` per section.
- `app/src/app/reports/page.tsx` — change "Generate report" from only setting local `generated` state off the live preview to first `POST /api/reports` with the current filter-bar scope + selected sections + `reportType`; on success, `GET /api/reports/{id}` and render **that** frozen response instead of the live preview, so the preview visibly stops changing when the filter bar is changed afterward; show the returned report `id` next to "Frozen \<timestamp\>".

**Uses from Step 3:** `requireEditLink` (same helper, unchanged).
**Produces for the next step:** a real `reports` row and its `report_sections` rows; the `GET /api/reports/{id}` route, which Step 5 calls directly to read the original scope before regenerating.

**How to test:**
1. On `/reports`, pick territory = Germany, FY2025, H1, check "KPI Summary" and "Profit and Loss" only, click "Generate report". A report `id` and a frozen timestamp appear.
2. Run `select report_type, territory_key, fiscal_year, period, currency from reports order by generated_at desc limit 1;` and `select section_name from report_sections where report_id = '<that id>';` — exactly the two sections chosen are there.
3. Change the filter bar to territory = France — the report preview on screen does **not** change (it's still showing Germany's frozen figures), proving the freeze worked; only clicking "Generate report" again would create a new one.
4. `curl -X POST /api/reports` with `sections: []` — `400`, no row inserted. With `fiscalYear: 1999` — `400`, no row inserted.

## Step 5 — Regenerate a Report

**Action:** Add a "Regenerate" action on a previously generated report that recomputes its exact same scope and sections fresh, as a new, separate report row — the original is never edited (per `design.md` §2: "A Generated Report is never edited after creation").

**Conditions to check, in this order:**
1. `linkMode: "edit"` via `requireEditLink` — otherwise `403`.
2. `:id` exists — `SELECT * FROM reports WHERE id = $1`; zero rows is `404 { error: "report not found" }`.

**No other validation is needed** — the scope (`report_type`, `territory_key`, `fiscal_year`, `period`, `currency`) and section list are read back from the original row (via the `GET /api/reports/{id}` query already built in Step 4), not re-supplied by the caller, so there is nothing new to invalidate.

**Files created:**
- `app/src/app/api/reports/[id]/regenerate/route.ts` — `POST` handler: loads the original report by `:id` (reusing Step 4's lookup), recomputes `buildReportBlocks` against that same stored scope, and calls `insertReport` (from Step 4) to create a new row with a new id and a new `generated_at`, copying the original's `section_name` list into the new report's `report_sections`.

**Files modified:**
- `app/src/app/reports/page.tsx` — add a "Regenerate" button next to a displayed generated report (visible once a report has been generated per Step 4); clicking it calls `POST /api/reports/{id}/regenerate`, then `GET`s the new id and replaces the on-screen preview with it, while leaving the original report's data untouched in the database.

**Uses from Step 4:** the `GET /api/reports/{id}` lookup and `insertReport` function, both called directly rather than re-implemented.
**Produces for the next step:** none — this is the last step in this plan; all 5 fully-specified write actions from `sequence.md` are now implemented end to end.

**How to test:**
1. Using the report generated in Step 4's test, click "Regenerate". A **different** report `id` and a newer timestamp appear on screen.
2. Run `select id, generated_at from reports order by generated_at desc limit 2;` — two distinct rows exist, the newer one from this step.
3. Run `select frozen_figures from reports where id = '<the original Step 4 id>';` — it is byte-for-byte the same as it was right after Step 4, proving regenerate did not touch it.
4. `curl -X POST /api/reports/does-not-exist/regenerate` — `404`.

## Not in this plan

- **Action 6, Save a Forecast Version** — `sequence.md` itself marks this a gap: no `forecast_versions` table exists in `erd.md`. Needs a new table proposed and approved the same way the 7 `erd.md` improvements were (one proposal at a time, "what/if-not/if-yes"), before any step here could be written.
- **Actions 7–9, Data Library refresh/upload (manual, scheduled, and file upload)** — all three need a real Google Drive service account, which `CLAUDE.md`'s "Current stage" lists as still open. Right now there is no source-of-truth Drive folder to read from or write to, so "read source file from Google Drive" in `sequence.md` has nothing to call.
- **Action 10, Variance Analysis "Save analysis" / "Export"** — `sequence.md` marks this a gap too: no destination table or export format has been decided. Needs that decision made first (a new table, like Action 6, or a literal file export with no persistence at all) before steps can be written.
