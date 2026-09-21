# design.md — FP&A Web App

> One sentence: this app helps the FP&A team and executives run a full financial planning
> and analysis workflow — reporting, variance investigation, scenario modelling, forecasting,
> and board-ready output — from one live model, replacing fragmented Excel-based reporting
> that causes version conflicts, manual work, and delays.

## 1. Users & Problem

| Role | Name/department | What question do they open the app to ask |
|---|---|---|
| FP&A Manager | Head of FP&A (1 person) — leads the team, primary finance partner to CFO/CEO, signs off on budgets/strategy | "Are we on track, and what decision do I need to make?" |
| Senior Financial Analyst | 2 people — owns financial modelling, business partnering with departments, monthly forecasting & variance analysis | "Why are we off track, and what will happen next?" |
| Financial Analyst | 2 people — data gathering, routine reporting, month-end close support | "What is happening in the numbers, and where is the issue?" |
| Executive / Board (external viewers) | CFO, CEO, Board members — outside the FP&A team | "What's our financial performance and growth trajectory?" — view only, via a public link, never log in, never edit |

**Where the work currently lives:** Excel workbooks (GL, Trial Balance, Budget, Chart of Accounts, Currency data, Territory, Cash Flow, SoCE, Calendar) in a Google Drive shared folder, plus a separate DAX measure library ("Calculations BI") holding the calculation logic.

**Biggest pain point (verbatim):** "Fragmented Excel-based processes that create version conflicts, manual work, desktop dependencies, and reporting delays, limiting timely collaboration, performance analysis, and forecasting."

**Risk flagged:** all read-only pages are reachable by anyone with the public URL, with no login or passcode at all. This is the user's explicit, confirmed decision — but it means there is no access control whatsoever if the link circulates.

## 2. Business Logic & Stages

**Format B — app WITHOUT stages** (nothing in this app waits on approval)

A **Scenario** is logged as one of these types:
- **Base Case** — the default scenario per territory + fiscal year, reflecting the actual live assumptions (not user-edited)
- **Custom Scenario** — created when someone changes one or more levers (Sales Growth, Price Change, Cost of Sales Rate, Opex Change, Headcount Change) and saves it under its own name

Change type: No — a Custom Scenario never becomes the new Base Case; "Reset" returns the levers to Base Case's (zero-adjustment) position without replacing Base Case.

A **Report** is logged as one of these types:
- **Generated Report** — a frozen snapshot of the selected sections (KPI Summary, Profit and Loss, Territory Summary, Ranked Variances, Forecast Outlook) for a chosen period, territory, and currency, captured at the moment it's generated

Change type: No — a Generated Report is never edited after creation; a new report (or "Regenerate") produces a separate frozen snapshot instead.

**Numbers the app must calculate** (do not store):
- **P&L (12 lines):** Sales, Cost of Sales, Gross Profit, Operating Expenses, EBITDA, Depreciation & Amortization, EBIT, Non-operating Income, Interest Expense, Profit Before Tax, Taxation, Net Profit — plus EBITDA Margin and each line's % of Sales
- **Balance Sheet:** Current Assets, Non-Current Assets, Current Liabilities, Long-Term Liabilities, Share Capital, Share Premium, Retained Earnings, rolling into Total Assets / Total Liabilities / Total Equity, as at period end vs the same date one year earlier; Working Capital, Net Debt, Gearing
- **Cash Flow:** Operating (Profit Before Tax plus non-cash and working-capital adjustments), Investing, Financing, Net Movement in Cash, Cash at Start/End, reconciled to the Balance Sheet's cash position
- **Budget vs Actual / Variance:** Actual, Budget, Variance ($), Variance (%), ranked across every territory × P&L-line combination, with a driver-level variance bridge (top contributing accounts + "other accounts")
- **Forecast:** actual-to-cutover plus forecast-for-remaining-months by two selectable methods (Budget + drivers, or Run-rate off actuals), full-year total, expected year-end variance, a Budget→Forecast bridge, comparison to previously saved forecast versions
- **Territory Performance:** all 7 territories' KPIs side by side in both local currency and USD, plus revenue restated at a constant (prior-year) FX rate to isolate the operational movement from the currency movement
- All of the above = calculated live from GL/Trial Balance/Budget/etc. using the existing DAX logic
- **USD-converted figures** = calculated live using Currency_data.xlsx rates and the conversion formula already defined in the Calculations BI DAX library

**Rules:**
- Anyone with the private edit-link (FP&A team) can create, edit, or delete any Scenario — no ownership lock, no approval step
- Anyone with the public view-link can see all dashboards and saved Scenarios, but cannot create, edit, or delete anything, trigger a Data Library refresh, or upload a source file
- Reporting currency defaults to USD (all territories, group view); Local Currency becomes selectable once a single specific territory is filtered
- A materiality flag (±5%) applies to P&L, Budget vs Actual, Variance Analysis, and Forecast lines. The Balance Sheet shows period-over-period movement but does **not** apply a materiality flag or compare to budget — a balance sheet is a position, not a budgeted target
- If Currency_data fails validation, any screen that needs an FX conversion (all-territories view, or a single territory reported in USD) holds rather than compute at a stale or missing rate; a single territory viewed in its own local currency is unaffected, and the Data Library itself always remains reachable so the issue can be fixed
- Data Library validation issues (missing, duplicated, unmapped, or inconsistent data) are detected automatically by the app on each refresh — not manually flagged by a person
- A Generated Report never changes after creation, even if the underlying data is later restated

## 3. Screens

Unless noted otherwise, every screen below is visible on both the **public view-link** (read-only) and the **private edit-link** (FP&A team, full interaction) — the public view-link never exposes editing, uploading, or refresh-triggering controls.

| Screen | Primary audience | What they see when it opens | What they can do here |
|---|---|---|---|
| **1 · Executive Overview** | FP&A Manager; also Board's landing view | KPI cards (Sales, Gross Profit, EBITDA, EBITDA Margin, Net Profit) with sparklines; an actual-vs-budget chart for a selectable line; P&L summary by territory; top 5 variances requiring attention | Filter Territory/Fiscal Year/Period/Currency; switch the chart between Monthly/Cumulative and any of the 12 lines; click a territory row to filter to it; click a flagged variance to open it in Variance Analysis |
| **2 · P&L** | Senior & Financial Analysts | Sales → Cost of Sales → Gross Profit → Operating Expenses → EBITDA → Depreciation & Amortization → EBIT → Non-operating Income → Interest Expense → Profit Before Tax → Taxation → Net Profit, each with Actual, Budget, Variance ($ and %), and % of Sales; an EBITDA margin trend chart | Filter Territory/Fiscal Year/Period/Currency; drill a line through account group → account → underlying GL transactions (breadcrumb, replaces the table in place); sort and paginate the GL transaction list |
| **3 · Balance Sheet** | Senior & Financial Analysts | Current/Non-Current Assets, Current/Long-Term Liabilities, Share Capital, Share Premium, Retained Earnings rolling into Total Assets/Liabilities/Equity, as at period end vs the same date one year earlier; a balance-tie check; KPIs (Total Assets, Working Capital, Net Debt, Total Equity) | Filter Territory/Fiscal Year/Currency; expand a group in place to see its individual accounts; navigate to Cash Flow |
| **4 · Cash Flow** | Senior & Financial Analysts | Operating (Profit Before Tax plus non-cash and working-capital adjustments), Investing, Financing, Net Movement in Cash, Cash at Start/End; KPIs (Operating Cash Flow, Free Cash Flow, Net Movement, Closing Cash); a monthly closing-cash chart | Filter Territory/Fiscal Year/Currency; navigate to P&L or Balance Sheet |
| **5 · Budget vs Actual** | All FP&A roles | The same 12-line P&L table as screen 2, with a selectable commentary focus line (defaults to the largest absolute variance); material variances (±5%) highlighted | Filter Territory/Fiscal Year/Period/Currency; drill a line into the P&L; Generate Commentary |
| **6 · Variance Analysis** | Senior Financial Analysts | Every territory × P&L-line combination ranked by absolute USD variance (always USD, all territories, for comparability); a variance bridge for the selected row (top contributing accounts + "other accounts") | Filter Fiscal Year/Period only; sort and page through the ranking; select a row; drill its accounts in the P&L; Generate Commentary; save/export the analysis |
| **7 · Scenario Modelling** | FP&A team (edit); Board (view saved scenarios) | Base Case results next to the current scenario; 5 adjustable levers (Sales Growth, Price Change, Cost of Sales Rate, Opex Change, Headcount Change); the full 12-line Scenario vs Base Case table; saved scenario list | Adjust levers; Run Scenario; compare to Base Case; Save, Save as new, or Reset; Generate Commentary |
| **8 · Forecast** | Senior Financial Analysts, FP&A Manager | Actuals up to a selectable cutover month plus forecast for the remaining months (by Budget + drivers, or Run-rate); full-year total vs Budget; a Budget→Forecast bridge; saved version history | Filter Territory/Fiscal Year; move the cutover month; switch method; adjust the 3 forecast drivers (Sales vs Budget, Cost of Sales Recovery, Opex Control) when using Budget + drivers; Save Version to compare against later versions |
| **9 · Territory Performance** | FP&A Manager | All 7 territories' KPIs side by side, in local currency and USD; FX impact isolated from operational performance | Filter Fiscal Year/Period; toggle Local Currency vs Reporting (USD) Currency; sort the territory table; click a territory to open it pre-filtered on Executive Overview |
| **10 · Reports** | FP&A team | A composed report preview built from live figures (KPI Summary, Profit and Loss, Territory Summary, Ranked Variances, Forecast Outlook sections) | Select report type, period, territory, currency, and which sections to include; generate (freezes a snapshot); print/export; browse previously generated reports |
| **11 · Data Library** | Financial Analysts | All 10 connected datasets (GL, Budget, Trial Balance, Chart of Accounts, Currency, Territory, Cash Flow Statement, SoCE, Calendar, Calculations BI) with row counts, last-refresh date, and Pass/Fail status | Select a dataset to see its flagged issues named row by row; trigger a manual refresh or upload a new source file *(edit-link only)* |

**AI Commentary** is not a standalone screen — it's an on-demand panel invoked from Budget vs Actual, Variance Analysis, and Scenario Modelling. Clicking "Generate Commentary" sends the validated numbers currently on screen to the AI, which returns a short explanation with every number traceable back to the table beside it. It is stateless — never saved, regenerated fresh each time.

## 4. Data to Store

Things that must **remain** after the browser is closed:

| Record of | Each record contains | How they connect | Where I inferred — needs your confirmation |
|---|---|---|---|
| **Scenario** `scenarios` | Name · Territory · Fiscal Year · lever values (Sales Growth, Price Change, Cost of Sales Rate, Opex Change, Headcount Change) · last-saved date/time | One Territory + Fiscal Year combination can have many Scenarios; each Scenario belongs to exactly one Territory and one Fiscal Year | — |
| **Generated Report** `reports` | Report type · Territory · Fiscal Year/Period · Currency · sections included · the frozen figures shown · generated date/time | Each Generated Report is a standalone snapshot; not linked back to live data after creation | Confirmed: frozen snapshot, not live-updating |
| **Dataset Sync Status** `dataset_sync_status` | Dataset name (GL, Budget, Trial Balance, Chart of Accounts, Currency, Territory, Cash Flow Statement, SoCE, Calendar, Calculations BI) · row count · last-refreshed date/time · validation status (pass/fail) · list of flagged issues (missing/duplicated/unmapped/inconsistent) | One row per dataset, overwritten on each refresh (latest status only — no history kept) | Confirmed: latest status only, no historical refresh log |

**Not stored by this app:** the actual GL, Trial Balance, Budget, Chart of Accounts, Currency rates, Territory, Cash Flow, SoCE, and Calendar data — read live from the Google Drive Excel files on each refresh cycle, never copied into the app's own storage (only their sync/validation status is tracked, above).

## 5. Done Criteria

- Select a territory + fiscal year on Executive Overview → P&L, Balance Sheet, Cash Flow, KPIs, and Budget vs Actual all update consistently to match that filter
- On P&L, click Operating Expenses (or another drillable line) → drills through account group → account → underlying GL transactions
- On Balance Sheet, expand a group (e.g. Current Assets) → shows its individual accounts and the movement vs the same date one year earlier — with no budget comparison and no materiality flag, since a balance sheet is a position, not a budgeted target
- On Cash Flow, review the statement → Net Movement in Cash plus Cash at Start reconciles to Cash at End; navigating to P&L shows the same period's profitability
- On Budget vs Actual, the commentary focus defaults to the line with the largest absolute variance → clicking a drillable line opens it in the P&L
- On Variance Analysis, select a ranked variance → bridge shows the top contributing accounts plus an "other accounts" residual
- On Scenario Modelling, change Sales Growth from 0% to 4% and click Run Scenario → Sales, EBITDA, and Net Profit recalculate immediately, compared against Base Case
- Save a scenario → reopen it later (even a different team member, via the edit-link) → same saved lever values and numbers appear
- Click Reset on a Custom Scenario → all 5 levers return to their Base Case (zero-adjustment) position
- On Forecast, move the cutover month → Actual and Forecast columns re-split accordingly, and the full-year total, variance, and bridge all recalculate
- On Territory Performance, toggle Local Currency → Reporting Currency → all territories' figures convert to USD using the validated FX rates; toggle back → each territory reverts to its own currency
- Click "Generate Commentary" on Budget vs Actual, Variance Analysis, or Scenario Modelling → an AI-written explanation appears, every number traceable to what's on screen
- On Reports, generate a report, then reopen the Reports list later → the same report is still there unchanged, even if the underlying data has since been restated
- On Data Library, view a dataset with a flagged issue → the specific missing/duplicated/unmapped/inconsistent item is identified, not just a generic warning
- Make Currency_data fail validation → any screen needing an FX conversion (all-territories, or single-territory in USD) shows a blocked state instead of a wrong number; a single territory viewed in local currency, and the Data Library itself, keep working
- A source Excel file is updated in the Google Drive folder → within the scheduled refresh interval, or immediately after "Refresh Now" on the edit-link → all relevant screens reflect the updated numbers, and Data Library's last-refreshed date updates
- Open the public view-link with no login → see all 11 pages and saved Scenarios, but no way to create/edit/save/delete a Scenario, trigger a refresh, or upload a file
- Open the private edit-link → able to do all of the above edit/refresh/upload actions

## Considered and Deferred

| Feature | Why deferred |
|---|---|
| Anomaly detection | Tier 3 — long-term platform roadmap; Data Library's checks are structural validation (missing/duplicate/unmapped data), not statistical variance anomaly detection, and remain the only Tier 3 item not absorbed into this scope |
| Real-time file watching (instant Drive sync) | Considered and rejected in favour of scheduled refresh + manual "Refresh Now" button — financial data changes monthly, not by the second, so the added complexity/fragility of instant sync wasn't worth it |
| Fully open scenario editing (anyone with the public URL) | Considered and rejected — replaced with a separate private edit-link for the FP&A team, so public visitors can view but not alter shared scenarios |
| Saved/persisted AI commentary history | Not built — commentary regenerates fresh on each "Generate Commentary" click; no history is kept |
| Historical dataset refresh log (Data Library) | Only the latest sync status per dataset is tracked for now; a full refresh history was not requested |
| A user-adjustable Tax Rate lever in Scenario Modelling | The effective tax rate is held constant from Base Case; Scenario Modelling's 5 levers (Sales Growth, Price Change, Cost of Sales Rate, Opex Change, Headcount Change) don't include one — considered simpler and sufficient for now |
| AI Commentary as a Reports section | Reports compose from live figures across 5 sections (KPI Summary, P&L, Territory Summary, Ranked Variances, Forecast Outlook); commentary isn't one of them, since it's designed to explain one on-screen figure at a time, not a whole report |
| Balance Sheet materiality flagging / budget comparison | A balance sheet is a position, not a target — it shows movement against the same date last year, with no ±% flag and no Budget column, unlike every other statement |

**Note:** Rolling forecasts and board-pack export — originally deferred as "Tier 3" in the first iteration of this spec — are now in scope via the **Forecast** and **Reports** pages respectively, as a direct consequence of expanding to the 12-page design.
