# data-model.md — Verified Source Data & Calculation Logic

Derived by directly inspecting `Finance Dataset/` (2026-09-03). This replaces
guessed schemas in `plan.md` §4 with the real structure. All 8 files from
`design.md` are present, plus two not previously mentioned: `Calendar.xlsx`
(date dimension) and `Calculations BI.xlsx` (70 named DAX measures, stored as
plain text formulas — fully readable, not "indexed" in a way I need to query
separately).

## Source Files & Real Schema

| File | Sheet | Columns | Grain / rows |
|---|---|---|---|
| **GL.xlsx** | GL | EntryNo, Date, Territory_key, Account_key, Details, Amount | Transaction-level actuals. 27,909 rows, 2023-01-01 → 2025-12-31. Amount is signed (expenses negative, e.g. Cost of Sales = -884) — the calculation engine must **not** re-sign these. |
| **Budget.xlsx** | Budget | EntryNo, Date, Territory_key, Account_key, Details, Amount, Type | Monthly budget lines. 7,980 rows. `Details` is always "Budget", `Type` always "B" — not useful discriminators, safe to ignore. **Two different semantics by account type** (found while building Phase 2, confirmed against the raw file): for **P&L accounts**, each month's row is that month's budgeted flow (sum one period at a time, same as GL). For **Balance Sheet accounts**, each month's row is already the budgeted *ending balance* for that month (values grow steadily in the same magnitude as a running balance, e.g. Territory 1's Cash at Bank budget goes 152,823 → 202,405 → … → 582,985 across 2023) — summing these across months the way GL is cumulatively summed inflates the figure ~6x. Use the latest dated row at-or-before the as-of date, not a sum, for BS budget comparisons. |
| **Trial Balance.xlsx** | TB | Date, Territory_key, Account_key, Amount | Monthly balances per account/territory, 13,356 rows. **Not** the source the DAX measures actually read from for Balance Sheet — see "TTD vs TB" note below. Used as an independent reconciliation check. |
| **Chart of Accounts.xlsx** | Chart of Accounts | Account_key, Report, Class, Class_sorting, SubClass, SubClass_sorting, SubClass2, SubClass2_sorting, Account, Account_sorting, SubAccount | 46 leaf accounts (Account_key 10–450, plus 1010 "Adjusting"). Full 6-level hierarchy: Report → Class → SubClass → SubClass2 → Account → SubAccount. This **is** the drill-down path in `design.md` (e.g. EBITDA → OPEX → Marketing → Advertisements = Report "Profit and Loss" → SubClass "Operating Expenses" → SubClass2 "Marketing" → Account "Advertisements", Account_key 280). |
| **Currency_data.xlsx** | EUR_USD Historical Data | Date, Currency, Exchange_Rate, Territory _key (note the space in the header) | Daily local-currency-to-USD rate per territory. 7,672 rows. Rate is "1 unit of local currency = X USD" (USD/territory 1 rate is always 1.000). **Data quality issue found:** 7 rows (one per currency) for 29 Feb 2025 — an invalid date, since 2025 isn't a leap year — are stored as the literal text `"2/29/2025"` instead of a real date, which breaks date-based lookups. This is a real, concrete first test case for the Data Library's "inconsistent data" validation. |
| **Territory.xlsx** | Territory | Territory_key, Country, Region | 7 territories: USA, Canada, UK, Germany, France, Australia, New Zealand. |
| **CashFlow_St.xlsx** | CashFlow_St | Type, Subtype, Account, SubAccount, ValueType, Account_Key, Sort on Type, Sort on SubType | 66 rows mapping Account_key → indirect cash flow statement line (Operating/Investing/Financing), with a `ValueType` tag (Opening_balance, All_FTP, All_FTP_CS, All_FTP_Positive/Negative(_CS), Closing_balance) controlling how each account feeds the bridge. |
| **SoCE.xlsx** | SoCE_St | Type, Account, Balancetype, AccountKey, Sort by type, Sort by Account | 12 rows mapping Account_key → Statement of Changes in Equity line, with a similar Balancetype tag (Opening_balance, FTP, FTP_positive/negative, Closing_balance). |
| **Calendar.xlsx** *(not in original file list)* | Calendar | Date, Year, Quarter, Month, Day | Standard date dimension — daily rows with Year/Quarter/Month/Day-of-week labels. |

**Join keys:** `Account_key` links GL/Budget/TB/CashFlow_St/SoCE to Chart of Accounts. `Territory_key` links GL/Budget/TB/Currency_data to Territory. `Date` links everything to Calendar.

**TTD vs FTP vs TB:** the DAX measures use two time semantics — `Total_FTP` = SUM of GL amounts for the currently filtered period ("for the period"), and `Total_TTD (cumulative)` = SUM of GL amounts from the earliest date up to the filtered date ("to this date" — this is how Balance Sheet figures are derived, by cumulating GL, not by reading Trial Balance.xlsx directly). Trial Balance.xlsx exists as an independent monthly snapshot for reconciliation — the calculation engine should compare GL-derived cumulative balances against it and flag mismatches, not use it as a primary data source.

## Calculation Logic (from Calculations BI.xlsx)

All 70 measures were extracted as plain text (see git history of this file's first
version for the raw list, or re-read `Finance Dataset/Calculations BI.xlsx` directly).
Key ones mapped to `design.md`'s screens:

- **P&L structure:** `Sales` (SubClass=Sales) → `Cost of Sales` (SubClass=Cost of Sales) → `Gross Profit` (Class=Trading account) → `Opex` (SubClass=Operating Expenses) → `EBITDA` = Gross Profit + Opex-class total → `Depreciation & Amortization` → `Operating Profit` → `PBIT` (+ Non-operating) → `Interest & Tax` → `Net Profit` (Report=Profit and Loss).
- **Margins & ratios:** GP margin, NP margin, Current Ratio, Quick Ratio, ROE, ROCE, Interest Cover, Asset Turnover, Gearing, Inventory/Payable/Receivable Days — all simple divisions of the above.
- **Balance Sheet:** Current Asset / Current Liabilities / Total Asset / Total Debt / Total Equity / Capital Employed, all via `Total_TTD (cumulative)` filtered by SubClass/SubClass2.
- **Budget vs Actual / Variance:** `Variance_FTP` = Total_FTP − Total_FTP_Budget; `%_Variance_TTD` = Variance_TTD / Total_TTD_Budget; `Outliers_Variance_FTP/TTD` flag variances beyond ±5%/±3% — this is the built-in "material variance" threshold `design.md`'s Budget vs Actual page should reuse rather than inventing a new one.
- **Growth/trend:** Sales Growth %, CoGS Growth %, PoP Growth (period-over-period), PCP Growth (prior comparative period), 90-day and 3-month rolling averages — feed the Forecast page.
- **FX conversion:** `Amount USD` = GL amount × the matching date+territory rate from Currency_data. `Exchange_rate_used` takes the rate as of the latest date in the filtered Calendar range.
- **Cash Flow bridge:** `Cashflow Values` — a single measure that sums GL amounts filtered by each `CashFlow_St[ValueType]` tag (opening balance, in-period flows split by sign, closing balance) to build the indirect cash flow statement.
- **SoCE bridge:** `StoCE value` — same pattern using `SoCE_St[Balancetype]`.

**Two minor issues in the source formulas worth knowing about** (not blockers, just things not to silently "fix" without asking): row 47 duplicates row 45 (`Sales Target` defined twice, identically), and row 76 has an unbalanced parenthesis (`([Total_FTP] = SUM(GL[ Amount ])`) that looks like a leftover fragment rather than a real measure — I'll treat it as redundant with row 60's clean `Total_FTP` definition rather than implement it literally.

## Cash Flow — Rebuilt From First Principles, Not From "Cashflow Values"

The `Cashflow Values` DAX measure described earlier in this document was not
implemented as written. Tracing it in detail showed it depends on a specific
Power BI matrix row/column context (`CashFlow_St[ValueType]` combined with
row-context Account_Key pinning) that isn't recoverable from the exported
formula text alone, and a literal port risked double-counting.

Instead, `src/lib/calcEngine/cashFlow.ts` builds a standard indirect-method
statement as a **complete partition of every non-cash Balance Sheet account**
(Report = "Adjusting", account 1010, and Retained Earnings, account 200, are
excluded together — a self-cancelling pair the source model uses purely to
transfer Net Profit into Retained Earnings monthly). This was validated by
reconciling computed closing cash against closing cash computed independently
from cumulative GL — it now ties to **exactly $0** across every territory and
year tested.

Two real findings from getting that reconciliation to tie, worth knowing:

1. **No Depreciation & Amortization add-back.** Textbook indirect method adds
   D&A back to Net Profit since it's non-cash — but that only works when a
   matching Accumulated Depreciation account absorbs it on the Balance Sheet
   side. This dataset has none. Adding the textbook addback broke the
   reconciliation by exactly the D&A amount, every time — a genuine,
   dataset-specific deviation from the textbook method, not a shortcut.
2. **Interest Payable (121), Tax Payable (122), and Dividends Payable (135)
   model real accrual-to-cash timing differences** and must be included as
   working-capital-style adjustments (changes in these payables) — they're
   not disclosed anywhere in the original file list or the DAX measures, and
   were only found by the reconciliation check failing until they were added.

## What This Confirms/Changes vs `plan.md`

- Confirms the Chart of Accounts hierarchy exactly matches the drill-down example in `design.md` and `fp&awepapp_userflow.md`.
- Confirms Budget vs Actual has a genuine, pre-existing materiality threshold (±5% FTP / ±3% TTD) to reuse, rather than needing a new one invented.
- Corrects Phase 0: Balance Sheet must be built from **cumulative GL**, with Trial Balance used for reconciliation/validation — not the other way around.
- Gives Data Library a real first validation rule to implement: detect non-date values in a Date column (the Currency_data 29 Feb issue), not just missing/duplicate rows.
