# plan.md — Technical Plan for the FP&A Web App

Source of truth for scope: `docs/2-spec/design.md` (11 pages + AI Commentary panel).
This document translates that approved scope into an architecture and a build order.

## 1. Architecture

```
┌─────────────────────────┐
│   Google Drive folder     │   GL · Trial Balance · Budget · Chart of Accounts ·
│  (source Excel files)     │   Currency · Territory · Cash Flow · SoCE
└────────────┬──────────────┘
             │  scheduled pull (15-30 min) + manual "Refresh Now"
             ▼
┌─────────────────────────┐
│    Sync & Parse layer     │   reads each workbook, validates structure,
│                           │   records Dataset Sync Status
└────────────┬──────────────┘
             ▼
┌─────────────────────────┐
│   Calculation engine       │   re-implements the DAX measure library:
│  (server-side)             │   P&L / BS / CF / KPI / variance / FX conversion
└────────────┬──────────────┘
             │
     ┌───────┴────────┐
     ▼                ▼
┌───────────┐   ┌─────────────────┐
│  Web app    │   │  Scenario engine  │  live recalculation on top of the
│ (11 pages)  │◄─►│                   │  same calculation engine, using
└─────┬──────┘   └─────────────────┘  saved/edited assumptions
      │
      ▼
┌─────────────────────────┐
│   Small database           │   Scenarios · Generated Reports ·
│                           │   Dataset Sync Status  (the only 3 things
│                           │   this app stores itself — see design.md §4)
└─────────────────────────┘

      │
      ▼
┌─────────────────────────┐
│   AI Commentary            │  on-demand call to the Anthropic API with the
│   (Anthropic API)          │  validated figures currently on screen
└─────────────────────────┘
```

**Access model:** no login. The app is served at one public URL (read-only — all 11
pages, no edit/refresh/upload controls visible or callable). A second, unguessable
long-token URL (e.g. `/team/<random-secret>`) unlocks the same pages with edit
controls (Scenario create/edit/save/delete, Data Library refresh/upload). This is a
shared-secret link, not individual accounts, matching the design decision in
`design.md` §1–2.

## 2. Proposed Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (React) | One codebase serves both the public and edit-link routes; good fit for dashboards with heavy client-side filtering |
| Charts | Recharts | Covers KPI cards, P&L/variance charts, variance bridges without heavy setup |
| Backend | Next.js API routes | Avoids standing up a separate service for a team this size; handles Drive sync, calculations, Anthropic calls, PDF export |
| Excel parsing | SheetJS (`xlsx`) | Reads GL/Budget/etc. workbooks server-side on each sync |
| Database | Supabase (Postgres) | Free tier is enough for 3 small tables (Scenarios, Reports, Dataset Sync Status); no need for anything heavier |
| Google Drive access | Drive API, service account | Read-only access to the shared folder, no per-user OAuth needed since there's no login |
| AI Commentary | Anthropic API (Claude) | As specified |
| PDF export (Reports) | Puppeteer (server-side render → PDF) | Reliable formatting for a "board-ready" export |
| Hosting | Vercel | Native fit for Next.js; free tier covers this scale; scheduled sync via Vercel Cron |

These are implementation details, not business requirements — reversible if you'd
rather use something else. Flag now if any of these conflict with an existing
company standard (e.g. your CFO's team already uses Azure/AWS, or has a Microsoft
365 rather than Google Drive environment for other tools).

## 3. Build Phases

Phased because 11 pages is well past what fits in one build pass (per the
`brainstorm` skill's own guidance). Each phase is independently demoable.

| Phase | Delivers | Depends on |
|---|---|---|
| **0 · Foundation** | Drive sync + Excel parsing, Dataset Sync Status tracking, calculation engine for core P&L/BS/CF/KPI figures + USD conversion, public/edit-link access split | Real data files or accurate schemas (see §4 below) |
| **1 · Executive Overview** | The hub page — KPI cards, P&L Summary, Budget vs Actual, territory/year/currency filters | Phase 0 |
| **2 · Statement drill-downs** | P&L, Balance Sheet, Cash Flow pages with account-level drill-down | Phase 0–1 |
| **3 · Variance & Commentary** | Budget vs Actual, Variance Analysis, AI Commentary panel | Phase 0–2, Anthropic API key |
| **4 · Scenario Modelling** | Assumption inputs, live recalculation, Scenario save/share/reset | Phase 0, calculation engine extended to accept overridden assumptions |
| **5 · Forecast & Territory Performance** | Forecast page, cross-territory comparison with FX toggle | Phase 0–1 |
| **6 · Reports & Data Library UI** | Report generation/export/history, Data Library dataset inspection UI | Phase 0 (Data Library UI surfaces what Phase 0 already tracks) |

## 4. Data Status

Items (1) and (2) below are resolved — the real workbooks and the full DAX measure
library have been inspected directly; see `docs/3-plan/data-model.md` for the
verified schema and calculation logic. Two items remain before Phase 0 can go live
against production data:

1. ~~The 8 source workbooks~~ — **done**. Received via `Finance Dataset/`, schema
   verified against `design.md`'s assumptions (see `data-model.md`). One real data
   quality issue found along the way (invalid 29 Feb 2025 dates in Currency_data,
   stored as text) — a good first Data Library validation test case.
2. ~~The DAX measure library~~ — **done**. All 70 measures extracted and mapped to
   the relevant screens in `data-model.md`. Confirmed Budget vs Actual already has a
   built-in materiality threshold (±5% FTP / ±3% TTD) to reuse.
3. **Google Drive folder access** — once there's a real shared folder in production
   use, either share it with a service account I'll help you create, or confirm
   you'll set that up when we reach Phase 0. Development can proceed against the
   `Finance Dataset/` files already provided in the meantime.
4. **An Anthropic API key** — needed only starting Phase 3 (AI Commentary); not a
   blocker for Phases 0–2.

Phase 0 can now start building real calculations against real data.

## 5. Phase 0 — Built

`app/` is a Next.js (TypeScript) project. Foundation plumbing is built and verified
end-to-end against `Finance Dataset/` via `npm run verify:phase0`:

- `src/lib/dataSources/` — `DataSource` interface + `LocalFileSource` (reads
  `Finance Dataset/` locally; swap in a Google Drive-backed implementation later
  without touching anything above this layer).
- `src/lib/parsers/` — one parser per workbook, matching `data-model.md`'s verified
  schema, using `exceljs` (not `xlsx`/SheetJS — that package has an unpatched high
  severity prototype-pollution/ReDoS advisory with no fix available, and Data
  Library will eventually parse files the FP&A team uploads, so unpatched parsing
  code was ruled out). A `uuid` override pins exceljs's transitive dependency past
  a moderate advisory too — `npm audit` is clean.
- `src/lib/validation/` — structural checks (invalid dates/numbers, unmapped
  Account_key references, duplicate GL entries) feeding Dataset Sync Status.
- `src/lib/calcEngine/` — P&L, Balance Sheet, key ratios, Budget variance
  (reusing the DAX library's own ±5%/±3% materiality thresholds), and USD FX
  conversion. Cash Flow and SoCE bridges are deferred to Phase 2, per the phasing
  above — they're materially more involved (multi-condition `ValueType` bridges)
  and belong with the dedicated Cash Flow page work.
- `src/lib/store/datasetSyncStatus.ts` — local JSON file standing in for Supabase
  until a project exists; same read/write shape either way.

**Three real data issues found while building the parsers, and how each was handled:**
1. GL rows for "Transfer of Net Profit to Retained Earnings" use chained Excel
   formulas (`=C27407`) for Territory_key, which a naive parser reads as a formula
   object instead of the cached number — fixed in the parser, not a data problem.
2. Trial Balance's `Amount` is blank for many account/territory/month combinations
   — legitimate zero balances, not missing data; parser now defaults these to 0
   instead of flagging an error.
3. Currency_data has 7 rows (29 Feb 2025 — not a leap year) with the date stored
   as text — a genuine source data bug, correctly surfaced as a Data Library
   validation failure rather than silently worked around.

Also found and correctly flagged (not a parser issue): one malformed trailing row
in SoCE.xlsx (a stray Account_key with no other fields).

**Not yet done:** the public/edit access-link split, and the Supabase/Google Drive
swap-ins — all still pending real accounts/credentials per §4.

## 6. Phase 1 — Built

`src/app/page.tsx` is the Executive Overview screen, server-rendered (recalculates
live on every request — `export const dynamic = "force-dynamic"`, per design.md's
"never store a calculated number" rule). A plain HTML GET form (no client JS
required) drives Territory / Fiscal Year / Currency filters via URL search params,
built in `src/lib/reporting/executiveOverview.ts`.

Verified with Playwright (`npm run smoke`, dev server must be running) across three
states — all-territories USD comparison, single-territory USD, single-territory
Local Currency — no console errors, numbers correctly differ by currency (e.g.
Germany FY2023 Revenue: $581,558 USD vs €504,295 local, consistent with the
EUR/USD rate). Type-checks, lints, and `npm audit` all clean.

**Scope note:** the "Operating Cash Flow" KPI card is intentionally showing "—
Coming in Phase 2" rather than a computed number. The DAX library's own
`Cashflow Values` measure is a per-row bridge formula that only resolves correctly
inside a specific Power BI matrix layout I don't have visibility into — reproducing
it as a flat function risked shipping a plausible-looking but wrong cash flow
figure. Building the Cash Flow bridge properly (from the `CashFlow_St` mapping,
independent of the ambiguous DAX measure) is Phase 2 work, alongside the dedicated
Cash Flow, P&L, and Balance Sheet drill-down pages. The other four KPIs (Revenue,
EBITDA, EBITDA Margin, Net Profit) and Balance Sheet figures don't have this
ambiguity and are fully implemented.

Also not yet done on this page: click-to-drill-down into an account (Phase 2),
navigation to the other pages (they don't exist yet), and the public/edit
access-link split (no gated actions exist yet to require it — first needed at
Scenario Modelling, Phase 4).

## 7. Phase 2 — Built (P&L + Balance Sheet; Cash Flow deferred)

**P&L** (`src/app/pl/page.tsx`) and **Balance Sheet** (`src/app/balance-sheet/page.tsx`)
are built with full account-level drill-down, sharing one generic engine
(`src/lib/calcEngine/drillDown.ts`): given a starting Chart of Accounts filter,
it groups by the next hierarchy level that actually distinguishes the matching
accounts — skipping a level transparently when every account shares one value
for it — until it bottoms out at individual GL transactions. The same engine
drives both pages via a pluggable aggregator (FTP/period sums for P&L, ±5%
materiality; cumulative-to-date sums for Balance Sheet, ±3% materiality,
matching the DAX library's own TTD convention). Verified end-to-end with
Playwright (`node e2e/smoke-drilldown.mjs`) walking the exact path from
`fp&awepapp_userflow.md`: EBITDA → Opex → Marketing → Advertisements → real GL
transactions, and Assets → Current/Non-Current Assets on the Balance Sheet.

**A real bug found and fixed during this build:** Budget.xlsx's Balance Sheet
accounts turned out to be monthly point-in-time targets (like Trial Balance),
not period flows like GL — confirmed by inspecting the raw file (see
`data-model.md`). Cumulatively summing them the way GL sums to a running
balance inflated the Balance Sheet's budget figures roughly 6x (Current Assets
showed as $5.3M budget against a real $878K actual). Fixed by taking the
latest dated Budget row at-or-before the as-of date instead of summing —
verified sane afterward (Current Assets −4.0%, Non-Current Assets −10.3%,
both plausible). This was caught by the Balance Sheet page's own tie-out check
(Assets − Liabilities − Equity = **$0** exactly), which is now a standing
sanity indicator on that page — a genuine confidence signal that the
Class/SubClass categorization logic in `accountFilters.ts` is correct.

**Cash Flow is deliberately not built this phase.** Its DAX measure
(`Cashflow Values`, see `data-model.md`) is a per-row compound formula whose
correct evaluation depends on the exact Power BI matrix layout it's used in,
which isn't visible from the exported formula text alone — tracing through it
in detail surfaced a real risk of double-counting if flattened naively.
Building a standard indirect-method cash flow statement independently (using
`CashFlow_St`'s Type/Subtype grouping for display structure, but reasoned from
first principles — Net Profit + D&A add-back − non-operating reclassifications
± working capital changes — then validated against the independently-computed
change in cash per GL) is real, non-mechanical financial-modelling work and is
scoped as a focused follow-up rather than rushed alongside this phase's other
two pages.

Not yet done: Forecast/Budget toggle on P&L (Actual vs Budget vs Forecast — no
Forecast data exists yet, Phase 5), and navigation onward to Variance Analysis
(doesn't exist yet).

## 8. Cash Flow — Built (follow-up, completes Phase 2)

`src/app/cash-flow/page.tsx` and `src/lib/calcEngine/cashFlow.ts`. Built from
first principles as a full partition of the Balance Sheet (see
`data-model.md`'s new "Cash Flow — Rebuilt From First Principles" section for
the detailed account mapping and the two real findings — no D&A add-back is
valid for this dataset, and Interest/Tax/Dividends Payable model real accrual
timing that must be included). Validated with a dedicated reconciliation
script (`npm run verify:cashflow`) across 5 territory/year combinations,
including an all-territories aggregate — every one ties to exactly $0 gap
between computed and actual closing cash.

The Executive Overview's "Operating Cash Flow" KPI now shows this real,
validated figure instead of the earlier placeholder. Cash Flow page shows the
full statement (Operating/Investing/Financing/Net Change/Start/End) with the
reconciliation result displayed prominently — if it ever stops tying (e.g.
after a future schema change), the page will say so visibly rather than
silently showing a wrong number.

**Not done:** click-to-drill-down into GL transactions on Cash Flow lines
(design.md asks for this on the Cash Flow screen). The line items here are
hand-defined account groupings for the statement structure, not a Chart of
Accounts subtree, so the generic drill engine used by P&L/Balance Sheet
doesn't apply directly — worth a small dedicated pass if wanted, not
attempted here to avoid rushing something else that needs its own care.

**Phase 2 is now fully complete**: P&L, Balance Sheet, and Cash Flow, all
with real validated figures. Next: Phase 3 (Budget vs Actual dedicated page,
Variance Analysis, AI Commentary).

## 9. Phase 3 — Built (Budget vs Actual, Variance Analysis, AI Commentary)

- `src/app/budget-vs-actual/page.tsx` — all 11 P&L lines with Actual/Budget/
  Variance ($ and %), materiality flags, drill-through links into `/pl` for
  the lines that map to a real Chart of Accounts category, and a metric
  selector (defaults to whichever line has the largest absolute variance).
- `src/app/variance-analysis/page.tsx` — ranks (territory × P&L line)
  variance pairs by absolute USD value across all 7 territories, shows the
  top 15, and a "variance bridge" breaking the selected variance into its
  P&L-line contributions.
- `src/lib/ai/commentary.ts` + `src/app/api/commentary/route.ts` +
  `src/components/GenerateCommentaryButton.tsx` — AI Commentary, wired into
  both pages above. Server-side only (the API key never reaches the
  client); the prompt sends the model the full validated P&L context (not
  just the one figure) so it can identify real offsetting drivers rather
  than inventing them, and is instructed to follow the exact structure from
  design.md — what happened → how significant → why → what offset it.

**No Anthropic API key is configured yet.** Rather than block on that, the
whole feature is built to degrade visibly: `generateCommentary()` checks for
`ANTHROPIC_API_KEY` before constructing a client, and the UI shows a clear
"AI Commentary is unavailable: ANTHROPIC_API_KEY is not configured on this
server" message instead of erroring — verified end-to-end with Playwright
(the button click, fetch, and graceful message all confirmed working). Real
commentary generation itself hasn't been tested against a live key. See
`.env.example` for what to set. Model used: `claude-opus-5` at `effort: "low"`
(appropriate for a short, grounded explanatory task, not open-ended
reasoning).

**Phases 0-3 are now complete.** Next: Phase 4 (Scenario Modelling — needs
the public/edit access-link split designed in `design.md` §2, since this is
the first feature with actual write/edit actions).
