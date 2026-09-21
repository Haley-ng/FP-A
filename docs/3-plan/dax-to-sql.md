# dax-to-sql.md — Calculations BI → Postgres

How the 70 DAX measures in `Finance Dataset/Calculations BI.xlsx` map onto real
SQL against the Supabase schema in `erd.md`. This is the reference for
`app/src/lib/db/*`, which is what the 11 `/api/fpa/*` routes actually call —
`app/src/lib/fpa/sampleData.ts` and `calculations.ts` are no longer read by
any page; they're kept only as the mock fallback this app started from.

## The two base measures everything else chains from

| DAX | Meaning | SQL |
|---|---|---|
| `Total_FTP = SUM(GL[Amount])` | "For the period" — GL amount summed over whatever date range and Chart-of-Accounts filter is active | `SUM(amount) FROM gl WHERE date BETWEEN :from AND :to AND <category>` |
| `Total_FTP_Budget = SUM(Budget[Amount])` | Same, over Budget | same query, `budget` table |
| `Total_TTD (cumulative) = CALCULATE([Total_FTP], DATESBETWEEN(...))` | "To this date" — every GL row from the start of the dataset up to the as-of date. This is how Balance Sheet figures are derived (data-model.md: built from cumulative GL, **not** read from Trial Balance) | `SUM(amount) FROM gl WHERE date <= :asOf AND <category>` — no lower bound needed, `gl` only starts 2023-01-01 |

Both live in `app/src/lib/db/aggregate.ts` as `ftpTotal()` / `ttdCumulativeTotal()`.

A `CALCULATE([Total_FTP], 'Chart of Accounts'[SubClass] = "X")`-style filter
becomes a `JOIN chart_of_accounts coa ON coa.account_key = t.account_key WHERE
coa.sub_class = 'X'` — the exact predicates are in
`app/src/lib/db/accountFilters.ts` (`CATEGORY_SQL`), copied from the
already-validated `app/src/lib/calcEngine/accountFilters.ts` and re-checked
against the real loaded `chart_of_accounts` table (54 rows) before use.

## The 12-line P&L (`app/src/lib/db/profitAndLoss.ts`)

| Line | DAX measure(s) | Category |
|---|---|---|
| Sales | `Sales` | `sub_class = 'Sales'` |
| Cost of Sales | `Cost of Sales` | `sub_class = 'Cost of Sales'` |
| Gross Profit | `Gross Profit` | `sales + cos` (equals `class = 'Trading account'` directly — checked, same number) |
| Operating Expenses | `Opex` | `sub_class = 'Operating Expenses'` |
| EBITDA | `EBITDA` | `gp + opex` |
| Depreciation & Amortization | `Depreciation & Amortization` | `sub_class = 'Depreciation & Amortization'` |
| EBIT | *(new — not a DAX measure)* | `ebitda + da` |
| Non-operating Income | *(new)* | `class = 'Non-operating'` (4 sub-classes: Interest Income, Dividend Income, Gain/Loss on Sale of Asset, Exchange Loss/Gain) |
| Interest Expense | *(split out of `Interest & Tax`)* | `sub_class = 'Interest Expense'` |
| Profit Before Tax | *(new)* | `ebit + nonop + intexp` |
| Taxation | *(split out of `Interest & Tax`)* | `sub_class = 'Taxation'` |
| Net Profit | `Net Profit` | `report = 'profit_and_loss'`, queried **directly**, not chained — confirmed against real data to equal `pbt + tax` exactly |

The old DAX model's `Interest & Tax` measure combines Interest Expense and
Taxation into one line. `docs/2-spec/design.md` (matching the working
prototype) splits them, and separates EBIT from Profit Before Tax — both of
those account categories already existed in `chart_of_accounts` on their own,
so this is a recombination of real, validated filters, not new logic.

**Known DAX bug, not reproduced:** the `Interest & Tax` measure filters
`SubClass = "Interest & Tax"`, but no account has that SubClass — it's the
*Class*. `accountFilters.ts` already found and worked around this
(`interestAndTaxClass` in `app/src/lib/db/accountFilters.ts`); the new 12-line
P&L doesn't need the combined measure at all, so the bug is moot here.

## Currency conversion — two different DAX approaches, used for two different things

- **`Amount USD` (`SUMX` over GL, matching each row's own date+territory
  rate)** — the right method for a **flow** (P&L, Cash Flow): each
  transaction converts at the rate on the day it happened. Implemented as
  `ftpTotalUsd()` — a `LEFT JOIN LATERAL`-style per-row rate lookup, rows with
  no matching rate excluded and counted rather than silently left unconverted.
- **`Exchange_rate_used` / `Total_FTP_currency converted`** (rate as of the
  *latest* date in range, applied once) — the right method for a **stock**
  (Balance Sheet): a closing balance translates at one closing rate, not a
  blend of every historical transaction's rate.

The first implementation of `ttdCumulativeTotalUsd()` used per-row conversion
(reusing the flow method) and it was wrong: verified against this real
dataset, every non-USD territory's Balance Sheet came out slightly off
(Germany was $763.81 short). Assets = Liabilities + Equity holds exactly in
local currency for every territory, so the gap was purely a currency-method
artifact. Fixed by summing each territory's local cumulative balance first,
then multiplying by that territory's own closing rate — now ties to exactly
$0 for every territory and combined (`app/src/lib/db/aggregate.ts`).

## Balance Sheet (`app/src/lib/db/balanceSheet.ts`)

7 groups, each a `sub_class2` on `chart_of_accounts`: Current Assets,
Non-Current Assets, Current Liabilities, Long Term Liabilities, Share
Capital, Share Premium, Retained Earnings. Per design.md, this screen has
**no Budget column and no materiality flag** — a position vs. the same date
one year earlier, so `latestBudgetBalance()` (the DAX library's "latest row,
not summed" logic for Budget's point-in-time BS targets — see data-model.md's
~6x-inflation finding) isn't needed by this screen, though it's implemented
in `aggregate.ts` in case a future screen needs it.

## Cash Flow (`app/src/lib/db/cashFlow.ts`)

**Not** built from the DAX `Cashflow Values` measure or the `cash_flow_mapping`
table (loaded in Supabase, but intentionally unused here) — that measure
depends on Power BI matrix row/column context that doesn't survive the export
to plain SQL, and a literal port risked double-counting (data-model.md).
Instead this is the same first-principles indirect-method statement already
validated in `app/src/lib/calcEngine/cashFlow.ts`, translated account-key
group by account-key group into SQL `SUM(...) WHERE account_key = ANY(...)`
queries. Re-verified against the real data: reconciles to **exactly $0**
(`reconciliationGap`) for every territory and period tested.

## Variance (`app/src/lib/db/variance.ts`)

`Variance_FTP = Total_FTP − Total_FTP_Budget` and `%_Variance_FTP =
Variance_FTP / Total_FTP_Budget` — used as-is (`varPct()`). The DAX library's
own materiality thresholds (±5% FTP / ±3% TTD, from `Outliers_Variance_FTP` /
`Outliers_Variance_TTD`) are the ±5% used on Executive Overview / P&L /
Budget vs Actual.

## Scenario Modelling & Forecast

Not DAX measures — design.md's 5 Scenario levers and 3 Forecast drivers are
this app's own additions, applied on top of a real Base Case pulled through
`computeProfitAndLoss()`. The effective tax rate applied to a scenario's
hypothetical Profit Before Tax is derived from the **real** Base Case's own
`tax / PBT` ratio (`app/src/lib/db/scenario.ts`), not an assumed constant —
per design.md §2: "the effective tax rate is held constant from Base Case."

## Growth / rolling-average measures — not wired to any screen yet

`Sales Growth_%`, `CoGS Growth_%`, `PoP Growth`, `Total_FTP_PCP_Growth`, the
90-day/3-month rolling averages, and the balance-sheet ratios (`Current
Ratio`, `Quick Ratio`, `ROE`, `ROCE`, `Interest Cover`, `Asset Turnover`,
`Gearing`, `Inventory/Payable/Receivable Days`) are all straightforward
`DATEADD`/`SAMEPERIODLASTYEAR`-style date-shifted queries or simple divisions
of figures this layer already computes — none of the 11 screens currently
display them, so they weren't built. `resolvePeriodRange()` in
`aggregate.ts` is the one piece that would need extending (a "prior period"
or "same period last year" range) if a future screen needs them.

## Two issues in the source formulas, not reproduced (see data-model.md)

- Row 47 duplicates row 45 (`Sales Target` defined twice, identically) — ignored, redundant.
- Row 76 (`([Total_FTP] = SUM(GL[ Amount ])`) has an unbalanced parenthesis and looks like a
  leftover fragment of row 60's clean `Total_FTP` definition — treated as the same measure, not
  implemented separately.
