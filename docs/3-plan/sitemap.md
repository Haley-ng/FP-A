# Sitemap — FP&A Web App

Derived from `docs/1-discovery/fp&awepapp_userflow.md` and `docs/2-spec/design.md`, verified directly against `docs/3-plan/prototype/FP&A web app prototype/` (source of truth for this revision — the working prototype, not just the static wireframe board). No accounts — access is split by *link*, not by user: a public view-link (read-only) and a private edit-link (create/edit Scenarios, save Forecast versions, trigger Data Library refresh/upload), per `design.md` §2. Routes below are the same for both links; the edit-link additionally unlocks write actions noted under each page.

**Status legend:** ✅ Built · 📝 Designed, not yet built

## Site Tree

```
/                                    Executive Overview ✅  (home)
│     ?territory=<all|1-7>              shared filter — carries across every page below
│     ?year=<fiscalYear>                shared filter
│     ?period=<fy|h1|h2|q1|q2|q3|q4>    shared filter — full year, half, or quarter
│     ?currency=<usd|local>             shared filter — "local" ignored when territory=all
│     ?barsLine=<P&L line id>           which line the actual-vs-budget chart shows
│
├── /pl                             P&L ✅
│     ?root=<sales|cogs|opex|da|nonop|intexp|tax>   one of the 7 drillable lines
│     ?group=&account=                              drill path within that line
│                                                    (Line → Account Group → Account → GL transactions)
│
├── /balance-sheet                  Balance Sheet ✅
│     (no drill-path params — groups expand/collapse in place, one level, not a multi-step drill)
│
├── /cash-flow                      Cash Flow ✅
│     (flat statement — no drill path, see Known Gaps)
│
├── /budget-vs-actual               Budget vs Actual ✅
│     ?metric=<P&L line key>            which line the commentary section focuses on;
│                                        defaults to the largest absolute variance
│
├── /variance-analysis              Variance Analysis ✅
│     ?year=&period=                    ranking filters — always all 7 territories, USD
│     ?line=<all|P&L line id>           rank every territory×line combo, or one line across territories
│     ?selected=<row index>             which ranked row the bridge below shows
│
├── /scenario-modelling             Scenario Modelling ✅
│     ?territory=&year=
│     ?scenario=<base|scenarioId>       Base Case or a saved Scenario
│     (write action — edit-link only: adjust levers, Run, Save, Save as new, Reset)
│
├── /forecast                       Forecast ✅
│     ?territory=&year=
│     ?version=<forecastVersionId>
│     ?cutover=<1-12>                   month actuals end and forecast begins
│     ?method=<budget|runrate>
│     (write action — edit-link only: adjust drivers, Save Version)
│
├── /territory-performance          Territory Performance ✅
│     ?year=&period=&currency=          same shared filters, no territory filter
│                                        (all 7 always shown side by side)
│
├── /reports                        Reports ✅
│     ?reportId=<id>                    viewing a previously generated report
│                                        (a frozen snapshot — see design.md §2)
│     (write action — edit-link only: generate/regenerate a report)
│
└── /data-library                   Data Library ✅
      ?dataset=<gl|budget|coa|territory|currency|calendar|tb|cashflow|soce|calc>
      (write action — edit-link only: manual refresh, upload a source file)
```

## Pages

| # | Page | Route | Reached from | Purpose |
|---|---|---|---|---|
| 1 | Executive Overview | `/` | App entry point | "Are we on track, what is off target, and what requires my attention?" |
| 2 | P&L | `/pl` | Executive Overview, Budget vs Actual (drill), Variance Analysis (drill), Cash Flow | "What is driving our profitability?" |
| 3 | Balance Sheet | `/balance-sheet` | Executive Overview, Cash Flow | "What has changed in our financial position, and where should I investigate?" |
| 4 | Cash Flow | `/cash-flow` | Executive Overview, P&L, Balance Sheet | "Where did the cash go, and does it reconcile?" |
| 5 | Budget vs Actual | `/budget-vs-actual` | Executive Overview | "Where did we miss or exceed budget, and why?" |
| 6 | Variance Analysis | `/variance-analysis` | Executive Overview, Budget vs Actual | "Which variances matter most, across every territory at once?" |
| 7 | Scenario Modelling | `/scenario-modelling` | Executive Overview (nav) | "What happens to the year if our assumptions change?" |
| 8 | Forecast | `/forecast` | Scenario Modelling (nav) | "Based on what we know today, where will we finish the year?" |
| 9 | Territory Performance | `/territory-performance` | Executive Overview (nav) | "Which territories are performing, once currency is set aside?" |
| 10 | Reports | `/reports` | Any page ("Compile to report") | "What do we send out, and what exactly will it contain?" |
| 11 | Data Library | `/data-library` | Executive Overview footer ("N data issues flagged →") | "Is the data behind all of this trustworthy?" |

Eleven pages total — matches `design.md`'s approved scope, and all eleven are built in the prototype.

## Persistent / Global Elements

- **Left rail** (fixed width) — every screen, grouped: Overview (01) · Statements (02–04) · Variance (05–06) · Planning (07–09) · Output (10–11). No top nav — eleven screens is past that capacity.
- **Filter bar** — Territory · Fiscal Year · Period (Full year / H1 / H2 / Q1–Q4) · Currency, plus a **Recalculate** button, present on every screen except Variance Analysis (no Territory or Currency — ranking is always all-territories, USD) and Data Library (no financial-period filter applies at all).
- **Cross-nav links** at the top of every screen — 1–2 links to related screens (e.g. P&L ↔ Cash Flow ↔ Balance Sheet, Scenario Modelling ↔ Forecast) plus "Compile to report" (edit-link only).
- **Link-type badge** ("Edit link · FP&A team" / "View link · read-only") and the last-refresh / data-issues line, both in the rail's footer.

## Deliberately *Not* Separate Pages

| Would-be page | Why it isn't one |
|---|---|
| GL transaction detail (P&L) | Reached as the last step of the drill path via `?group=&account=` on `/pl` — not its own route |
| Balance Sheet account detail | Each group expands in place when clicked — not a drill to a new screen, just more rows in the same table |
| Variance Bridge | Inline section on `/variance-analysis` when a ranked row is selected — not a separate page |
| AI Commentary | An embedded panel (Budget vs Actual, Variance Analysis, Scenario Modelling) — not a page, and not backed by a persisted record; each click regenerates fresh |
| Dataset issue detail (Data Library) | Selecting a dataset shows its flagged issues inline via `?dataset=`, not a separate route |

## Known Gaps vs `design.md`

- **Cash Flow has no drill path.** `design.md` calls for one; the statement's line items are hand-defined groupings (Operating/Investing/Financing), not a Chart of Accounts subtree, so no `?group=/?account=`-style params exist for it.
- **The public/private link split isn't a real second URL yet.** The prototype represents it as an Edit/View toggle in the rail for demo purposes; the actual product needs two distinct links (or an equivalent access check), not a client-side switch.
- **Variance Analysis's "Save analysis" / "Export" buttons are drawn but not wired to real output yet.**
- **Balance Sheet has no materiality flag and no Budget column, by design** — not a gap, but a deliberate difference from every other statement screen: a balance sheet is a position (compared to the same date one year earlier), not a budgeted target.

## Open Question for `docs/3-plan`

Whether `/territory-performance` should be its own route at all, given `/?territory=all` on Executive Overview already renders a similar side-by-side comparison (though Executive Overview's is USD-only, while Territory Performance also shows local currency and the FX-impact split). Flagged here rather than decided — `design.md` already commits to it as a separate screen, so cutting it would be a scope change, not a routing detail.
