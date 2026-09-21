# FP&A Web App — User Flow & Page Design (Refreshed)

This reflects the **working prototype** in `docs/3-plan/prototype/FP&A web app prototype/`
— the source of truth for this revision, verified against its actual computation
logic (`FP&A Prototype.dc.html`), not just the static wireframe board. All 11
pages are built there. Anything the prototype draws or computes differently
from an earlier draft of this document has been corrected here; anything it
doesn't build at all has been removed rather than left as a stale claim.

> **Data layer note:** the prototype reads from a bundled data snapshot
> (`fpa-data.js` / `fpa-bs.js`), standing in for the live Google Drive +
> Supabase data layer described in `docs/3-plan/plan.md`. Every page here is
> written against the *calculated figures*, not against where the data
> physically lives — swapping the data source shouldn't change anything
> described below.

**Status legend:** ✅ Built and verified · 📝 Designed, not yet built

---

## Site Map — How the Pages Connect

```
                        ┌─────────────────────────────┐
                        │        DATA LIBRARY ✅          │
                        │  10 datasets · refresh ·       │
                        │      validation status          │
                        └───────────────┬─────────────────┘
                                         │  feeds validated data
                                         │  to every page below
                                         ▼
                        ┌─────────────────────────────┐
                        │      EXECUTIVE OVERVIEW ✅         │  ◄── home / hub page
                        └──┬─────────┬─────────┬────────┘
             ┌─────────────┘         │         └─────────────┐
             ▼                       ▼                       ▼
     ┌───────────────┐     ┌────────────────┐      ┌───────────────────┐
     │      P&L ✅      │     │   CASH FLOW ✅    │      │  BUDGET VS ACTUAL ✅ │
     └───────┬────────┘     └───────┬────────┘      └─────────┬──────────┘
             │                       │  ▲                       │
             │              (cross-linked with Balance Sheet)   │
             ▼                       ▼                          ▼
     ┌───────────────┐     ┌────────────────┐      ┌───────────────────┐
     │ BALANCE SHEET ✅ │     │  (drill to GL     │      │  VARIANCE ANALYSIS ✅ │
     │ (expand-in-place, │     │   transactions,   │      │                      │
     │  no drill screen) │     │   P&L only)       │      └─────────┬──────────┘
     └───────────────┘     └────────────────┘                     │
                                                                    ▼
                                                    ┌───────────────────────┐
                                                    │   SCENARIO MODELLING ✅   │
                                                    └───────────┬────────────┘
                                                                ▼
                                                    ┌───────────────────────┐
                                                    │        FORECAST ✅         │
                                                    └───────────────────────┘

     ┌───────────────────────┐            ┌───────────────────────┐
     │ TERRITORY PERFORMANCE ✅  │───────────▶│        REPORTS ✅          │◄─ pulls from
     └───────────────────────┘            └───────────────────────┘   every page above

                        ┌─────────────────────────────┐
                        │        AI COMMENTARY ✅          │  embedded panel, not a
                        │   Budget vs Actual · Variance    │  standalone page — the
                        │   Analysis · Scenario Modelling   │  three screens that carry it
                        └─────────────────────────────┘
```

---

## 1 · Executive Overview ✅

**Route:** `/` · **Answers:** *"Are we on track, what is off target, and what requires my attention?"*

```
┌──────────────────────────────────────────────────┐
│ 1. User opens the app (this is the home page)      │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Selects filters: Territory (All, or one of 7) · │
│    Fiscal Year · Period (Full year/H1/H2/Q1–Q4) ·   │
│    Currency (USD default; Local unlocks once one    │
│    territory is selected)                           │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. KPI cards update, each with a sparkline:         │
│    Sales · Gross Profit · EBITDA · EBITDA Margin ·  │
│    Net Profit                                        │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Actual-vs-budget chart for a selectable line     │
│    (any of the 12 P&L lines), toggled Monthly or     │
│    Cumulative                                        │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 5. P&L summary table — one row per territory        │
│    (Sales/Gross Profit/EBITDA/Net Profit) + a        │
│    Total row; clicking a row filters to it in place  │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 6. "Requires attention" — top 5 variances beyond     │
│    ±5%, ranked by absolute value across every        │
│    territory × line combination                      │
└───────────────────────┬────────────────────────────┘
                        ▼
              ┌─────────┴─────────┐
              ▼                   ▼
   ┌────────────────────┐  ┌─────────────────────────┐
   │ 7a. Clicks a flagged │  │ 7b. Clicks "Rank all       │
   │ row → opens it        │  │ variances" → Variance        │
   │ preselected on         │  │ Analysis, full ranking       │
   │ Variance Analysis      │  │                              │
   └────────────────────┘  └─────────────────────────┘
```

**If Currency data fails validation:** any view needing an FX conversion (all-territories, or one territory reported in USD) shows a blocked state instead of a wrong number — figures shown are timestamped from the last good refresh, and a link opens Data Library to fix it. A single territory viewed in its own local currency is unaffected.

---

## 2 · P&L ✅

**Route:** `/pl` · **Answers:** *"What is driving our profitability?"*

```
┌──────────────────────────────────────────────────┐
│ 1. Selects Territory · Fiscal Year · Period ·       │
│    Currency                                        │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Views the full 12-line chain, each with Actual,  │
│    Budget, Variance ($ and %, ⚠ past ±5%), and       │
│    % of Sales:                                       │
│    Sales → Cost of Sales → Gross Profit → Operating  │
│    Expenses → EBITDA → D&A → EBIT → Non-operating    │
│    Income → Interest Expense → Profit Before Tax →   │
│    Taxation → Net Profit                             │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. Reviews the EBITDA margin trend chart — actual    │
│    solid line vs budget dashed line, by month        │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Clicks a drillable line — Sales, Cost of Sales,   │
│    Operating Expenses, D&A, Non-operating Income,     │
│    Interest Expense, or Taxation (subtotal lines      │
│    like EBITDA aren't drill roots — the drill into    │
│    EBITDA starts at Operating Expenses)               │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 5. Drills: Line → Account Group → Account →          │
│    underlying GL transactions, breadcrumb-based,      │
│    replacing the table in place                      │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 6. GL transaction list: sortable by Entry/Date/       │
│    Amount, "Show 20 more" to page further             │
└───────────────────────┬────────────────────────────┘
                        ▼
              ┌─────────┴─────────┐
              ▼                   ▼
   ┌────────────────────┐  ┌─────────────────────┐
   │ 7a. Back to          │  │ 7b. On to Cash Flow    │
   │ Executive Overview   │  │ or Balance Sheet       │
   └────────────────────┘  └─────────────────────┘
```

---

## 3 · Balance Sheet ✅

**Route:** `/balance-sheet` · **Answers:** *"What has changed in our financial position, and where should I investigate?"*

```
┌──────────────────────────────────────────────────┐
│ 1. Selects Territory · Fiscal Year · Currency       │
│    (no Period filter — a balance sheet is a          │
│    position as at a date, not a period)               │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Views 7 groups (Current/Non-current Assets,       │
│    Current/Long-term Liabilities, Share Capital,      │
│    Share Premium, Retained Earnings) rolling into     │
│    Total Assets / Total Liabilities / Total Equity,   │
│    as at period end vs the same date one year          │
│    earlier — no Budget column, no materiality flag:    │
│    a balance sheet is a position, not a target         │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. Reads the balance-tie check: "Balances tie:        │
│    assets equal liabilities and equity at $X" or       │
│    "Out of balance by $X — check Trial Balance.xlsx"   │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Reviews KPIs: Total Assets, Working Capital        │
│    (with current ratio), Net Debt, Total Equity        │
│    (with gearing %)                                    │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 5. Clicks a group to expand it in place — shows its    │
│    individual accounts inline (one level, not a         │
│    multi-step drill to a new screen)                    │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 6. Navigates to Cash Flow                             │
└──────────────────────────────────────────────────┘
```

---

## 4 · Cash Flow ✅

**Route:** `/cash-flow` · **Answers:** *"Where did the cash go, and does it reconcile?"*

```
┌──────────────────────────────────────────────────┐
│ 1. Selects Territory · Fiscal Year · Currency       │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Views the indirect-method statement:              │
│    Operating (Profit Before Tax, Depreciation,        │
│    Amortization, non-operating/interest add-backs,    │
│    changes in receivables/inventory/prepayments/       │
│    payables, interest and tax paid) → Investing        │
│    (PP&E, intangibles, investments, interest/           │
│    dividends received) → Financing (share issuance,     │
│    borrowing, dividends) → an "other movements"          │
│    line for any residual → Net Movement in Cash →        │
│    Cash at Start → Cash at End                            │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. Reviews KPIs: Operating Cash Flow (with % of        │
│    EBITDA converted to cash), Free Cash Flow, Net       │
│    Movement, Closing Cash                                │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Reads the monthly closing-cash chart across the      │
│    fiscal year                                           │
└───────────────────────┬────────────────────────────┘
                        ▼
              ┌─────────┴─────────┐
              ▼                   ▼
   ┌────────────────────┐  ┌─────────────────────┐
   │ 5a. Back to          │  │ 5b. To P&L or          │
   │ Executive Overview   │  │ Balance Sheet          │
   └────────────────────┘  └─────────────────────┘
```

**Known gap:** no click-to-drill into GL transactions here yet (design.md calls for it). The line items are hand-defined statement groupings, not a Chart of Accounts subtree, so the generic drill used on P&L/Balance Sheet doesn't apply directly.

---

## 5 · Budget vs Actual ✅

**Route:** `/budget-vs-actual` · **Answers:** *"Where did we miss or exceed budget, and why?"*

```
┌──────────────────────────────────────────────────┐
│ 1. Selects Territory · Fiscal Year · Period ·       │
│    Currency, and a Commentary Focus line              │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Views the same 12-line P&L table as screen 2,     │
│    Actual/Budget/Variance ($ and %) — ⚠ flags          │
│    anything beyond ±5% of budget                      │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. Commentary focus defaults to whichever line has    │
│    the largest absolute $ variance — the thing that   │
│    actually needs explaining, not just the first row  │
└───────────────────────┬────────────────────────────┘
                        ▼
              ┌─────────┴─────────┐
              ▼                   ▼
   ┌────────────────────┐  ┌─────────────────────┐
   │ 4a. Clicks a         │  │ 4b. Clicks Generate    │
   │ drillable line to    │  │ Commentary → AI writes │
   │ open it in P&L        │  │ a short explanation,   │
   │                       │  │ using the full P&L as   │
   │                       │  │ context                 │
   └────────────────────┘  └─────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 5. Navigates to Variance Analysis for a cross-        │
│    territory view of the same kind of variance        │
└──────────────────────────────────────────────────┘
```

---

## 6 · Variance Analysis ✅

**Route:** `/variance-analysis` · **Answers:** *"Which variances matter most, across every territory at once?"*

```
┌──────────────────────────────────────────────────┐
│ 1. Selects Fiscal Year · Period, and a line filter    │
│    (All lines, or one specific line) — ranking is      │
│    always in USD across all 7 territories, so no        │
│    Territory or Currency filter applies here             │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Views the ranked table, sortable by any column,     │
│    paginated ("show more" in batches)                    │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. Selects one — defaults to the largest               │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Views the variance bridge: Budget → the top          │
│    3 contributing accounts (+ an "other accounts"        │
│    residual) → Actual, as a waterfall, plus a driver      │
│    table (Actual/Budget/Contribution/Share of variance)   │
└───────────────────────┬────────────────────────────┘
                        ▼
              ┌─────────┼─────────┐
              ▼         ▼         ▼
   ┌──────────┐ ┌──────────────┐ ┌─────────────────┐
   │ 5a. Drills │ │ 5b. Generate  │ │ 5c. Save the        │
   │ that line's │ │ Commentary —  │ │ analysis, or export  │
   │ accounts on │ │ same panel as │ │                      │
   │ the P&L      │ │ Budget vs      │ │                      │
   │              │ │ Actual         │ │                      │
   └──────────┘ └──────────────┘ └─────────────────┘
```

---

## 7 · Scenario Modelling ✅

**Route:** `/scenario-modelling` · **Answers:** *"What happens to the year if our assumptions change?"*

```
┌──────────────────────────────────────────────────┐
│ 1. Selects Territory · Fiscal Year · Scenario        │
│    (defaults to Base Case)                           │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Views Base Case results next to the current        │
│    scenario                                           │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. Adjusts 5 levers: Sales Growth · Price Change ·    │
│    Cost of Sales Rate · Opex Change · Headcount        │
│    Change                                             │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Clicks "Run Scenario" — the same calculation       │
│    engine that produces the P&L recalculates the       │
│    full 12-line chain live, with the lever              │
│    adjustments applied on top of actual data            │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 5. Compares Sales/EBITDA/Net Profit vs Base Case,      │
│    reviews the full line-by-line $ and % impact         │
└───────────────────────┬────────────────────────────┘
                        ▼
              ┌─────────┼─────────┐
              ▼         ▼         ▼
      ┌───────────┐ ┌─────────┐ ┌─────────────────┐
      │ 6a. Save    │ │ 6b. Save │ │ 6c. Reset all 5    │
      │ (private     │ │ as new   │ │ levers / Generate   │
      │ edit-link)    │ │ scenario │ │ Commentary          │
      └───────────┘ └─────────┘ └─────────────────┘
```

---

## 8 · Forecast ✅

**Route:** `/forecast` · **Answers:** *"Based on what we know today, where will we finish the year?"*

```
┌──────────────────────────────────────────────────┐
│ 1. Selects Territory · Fiscal Year · Forecast         │
│    version                                          │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Moves the cutover month (which month actuals       │
│    end and forecast begins) and picks a method:         │
│    Budget + drivers, or Run-rate off actuals             │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. When using Budget + drivers, adjusts 3 drivers:     │
│    Sales vs Budget · Cost of Sales Recovery ·           │
│    Opex Control (drivers are inactive under Run-rate)    │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Views the full 12-line table: Actual-to-cutover,    │
│    Forecast-for-remaining-months, Full-year total,      │
│    Budget, Variance, and a period-split bar per line     │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 5. Reviews the Budget→Forecast EBITDA bridge            │
│    (Sales, Cost of Sales, Opex + an "other" residual)     │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 6. Clicks "Save Version" → creates the next FC-nn        │
│    version, tracked against the prior version's move      │
│    and the variance to budget                              │
└──────────────────────────────────────────────────┘
```

---

## 9 · Territory Performance ✅

**Route:** `/territory-performance` · **Answers:** *"Which territories are performing, once currency is set aside?"*

```
┌──────────────────────────────────────────────────┐
│ 1. Selects Fiscal Year and Period (no Territory       │
│    filter — the screen exists to compare all 7 at       │
│    once)                                                │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Toggles Local Currency ↔ Reporting (USD) Currency   │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. Views the sortable territory table — Sales          │
│    (local and USD), EBITDA (USD), EBITDA Margin          │
│    (bar read against a 30% ceiling, so all 7 stay         │
│    comparable regardless of their own currency)            │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Clicks a territory → opens it pre-filtered on         │
│    Executive Overview                                     │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 5. Reviews the FX-impact table: revenue at the           │
│    current rate vs at a prior-year-implied rate,            │
│    split into the operational movement and the FX           │
│    movement, per territory and in total                       │
└──────────────────────────────────────────────────┘
```

---

## 10 · Reports ✅

**Route:** `/reports` · **Answers:** *"What do we send out, and what exactly will it contain?"*

```
┌──────────────────────────────────────────────────┐
│ 1. Selects report type (Monthly management pack,      │
│    Board pack, Territory review, Variance memo),         │
│    period, territory, and currency                        │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Toggles which sections to include: KPI Summary,      │
│    Profit and Loss, Territory Summary, Ranked             │
│    Variances, Forecast Outlook                              │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. Previews the compiled report — "Live preview"          │
│    while unsaved, following the filter bar                  │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Clicks "Generate report" → freezes a snapshot,          │
│    badge switches to "Frozen snapshot"; the filter bar        │
│    no longer moves it — "Regenerate" makes a new one           │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 5. Prints/exports the report                                │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 6. Previously generated reports stay accessible for          │
│    comparison — frozen figures, never recalculated             │
│    after creation, even if the underlying data is later          │
│    restated                                                       │
└──────────────────────────────────────────────────┘
```

---

## 11 · Data Library ✅

**Route:** `/data-library` · **Answers:** *"Is the data behind all of this trustworthy?"*

```
┌──────────────────────────────────────────────────┐
│ 1. Views all 10 connected datasets and their status      │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Datasets shown: GL · Budget · Trial Balance ·          │
│    Chart of Accounts · Currency · Territory ·               │
│    Cash Flow Statement · SoCE · Calendar ·                    │
│    Calculations BI — each with row count, last                │
│    refreshed date, and Pass/Fail status                         │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. Selects a dataset to see its flagged issues,            │
│    named row by row rather than as a generic warning        │
│    — e.g. Currency_data's invalid 29 Feb 2025 dates,          │
│    GL's duplicate entries, or SoCE's malformed row             │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Initiates a manual refresh or uploads a new source        │
│    file (edit-link only)                                       │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 5. New data is validated before it reaches the                │
│    financial model — if a critical dataset (e.g.                │
│    Currency) fails, screens that need it hold rather              │
│    than show a wrong number, until it's fixed here                 │
└──────────────────────────────────────────────────┘
```

---

## AI Commentary ✅ (embedded feature, not a standalone page)

**Principle:** the AI never calculates results — it only explains validated
output already produced by the calculation engine.

```
┌──────────────────────────────────────────────────┐
│ 1. User is on Budget vs Actual, Variance Analysis,       │
│    or Scenario Modelling — the three screens that           │
│    carry this panel                                          │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 2. Clicks "Generate Commentary"                       │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 3. The panel sends the figures currently on screen —    │
│    the focus line/row plus the full table as context —    │
│    and composes a short explanation                        │
└───────────────────────┬────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│ 4. Reads the result — tagged "Not saved"; every            │
│    number in it traces back to a row in the table            │
│    beside it. Regenerates fresh on the next click or          │
│    filter change; nothing is kept between sessions              │
└──────────────────────────────────────────────────┘
```

---

## Reconciling With the Approved Spec

`docs/2-spec/design.md` describes this same 11-page + AI-Commentary scope, and
this document is now the accurate reference for it, verified directly against
the working prototype's computation logic rather than a static drawing. Two
corrections worth calling out because they changed real numbers/behavior, not
just wording: the P&L is a **12-line** statement (EBIT and Profit Before Tax
are named separately from Interest Expense and Taxation, which are also now
two separate lines rather than one combined "Interest & Tax" line), and
Scenario Modelling's assumptions are **5 levers** (Sales Growth, Price Change,
Cost of Sales Rate, Opex Change, Headcount Change) with no separate Tax Rate
lever. A validation-failure **blocked state** — screens needing an FX
conversion hold if Currency data fails, rather than compute at a stale rate —
is also confirmed behavior, not previously documented here.
