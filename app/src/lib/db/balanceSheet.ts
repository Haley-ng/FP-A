import { ttdCumulativeTotal, ttdCumulativeTotalUsd } from "./aggregate";
import type { CoaCategory } from "./accountFilters";
import { query } from "./client";
import type { BalanceSheetLine } from "@/lib/fpa/types";

/** The 7 groups design.md's Balance Sheet screen shows, each a Chart-of-Accounts SubClass2. */
const GROUPS: { label: string; category: CoaCategory; isAsset: boolean }[] = [
  { label: "Current Assets", category: "currentAssets", isAsset: true },
  { label: "Non-Current Assets", category: "nonCurrentAssets", isAsset: true },
  { label: "Current Liabilities", category: "currentLiabilities", isAsset: false },
  { label: "Long Term Liabilities", category: "longTermLiabilities", isAsset: false },
  { label: "Share Capital", category: "shareCapital", isAsset: false },
  { label: "Share Premium", category: "sharePremium", isAsset: false },
  { label: "Retained Earnings", category: "retainedEarnings", isAsset: false },
];

async function groupTotal(asOfDate: string, territoryKeys: number[] | undefined, category: CoaCategory, toUsd: boolean): Promise<number> {
  return toUsd ? ttdCumulativeTotalUsd(asOfDate, territoryKeys, [category]) : ttdCumulativeTotal(asOfDate, territoryKeys, [category]);
}

export interface BalanceSheetResult {
  rows: BalanceSheetLine[];
  tie: number;
  kpis: { totalAssets: number; workingCapital: number; netDebt: number; totalEquity: number };
}

/** As-at-year-end vs the same date one year earlier — no Period filter and no Budget column, per design.md §2 ("a balance sheet is a position, not a budgeted target"). */
export async function computeBalanceSheet(year: number, territoryKeys: number[] | undefined, toUsd: boolean): Promise<BalanceSheetResult> {
  const asOf = `${year}-12-31`;
  const priorAsOf = `${year - 1}-12-31`;

  const [current, prior] = await Promise.all([
    Promise.all(GROUPS.map((g) => groupTotal(asOf, territoryKeys, g.category, toUsd))),
    Promise.all(GROUPS.map((g) => groupTotal(priorAsOf, territoryKeys, g.category, toUsd))),
  ]);

  const rows: BalanceSheetLine[] = GROUPS.map((g, i) => ({
    marker: "▸",
    label: g.label,
    isSubtotal: true,
    isHeadline: false,
    value: current[i],
    prior: prior[i],
  }));

  const totalAssets = { value: 0, prior: 0 };
  const totalLiabEquity = { value: 0, prior: 0 };
  GROUPS.forEach((g, i) => {
    if (g.isAsset) {
      totalAssets.value += current[i];
      totalAssets.prior += prior[i];
    } else {
      totalLiabEquity.value += current[i];
      totalLiabEquity.prior += prior[i];
    }
  });

  rows.push({ marker: "", label: "Total Assets", isSubtotal: false, isHeadline: true, value: totalAssets.value, prior: totalAssets.prior });
  rows.push({ marker: "", label: "Total Liabilities & Equity", isSubtotal: false, isHeadline: true, value: totalLiabEquity.value, prior: totalLiabEquity.prior });

  const currentAssets = current[0];
  const currentLiabilities = current[2];
  const longTermLiabilities = current[3];
  const shareCapital = current[4];
  const sharePremium = current[5];
  const retainedEarnings = current[6];
  const totalEquity = shareCapital + sharePremium + retainedEarnings;

  // Net Debt needs the Current Installments of Long-term Debt (150) and Cash (10, 20) accounts directly.
  const debtInstalments = await ttdWithAccountKeys(asOf, territoryKeys, [150], toUsd);
  const cash = await ttdWithAccountKeys(asOf, territoryKeys, [10, 20], toUsd);
  const netDebt = longTermLiabilities + debtInstalments - cash;

  return {
    rows,
    tie: totalAssets.value - totalLiabEquity.value,
    kpis: {
      totalAssets: totalAssets.value,
      workingCapital: currentAssets - currentLiabilities,
      netDebt,
      totalEquity,
    },
  };
}

/** Cumulative total for a specific list of account_keys (used for cash & debt-instalment KPIs, not a whole SubClass2) — converted at each territory's closing rate, same as ttdCumulativeTotalUsd (a balance is a stock, not a per-transaction flow). */
async function ttdWithAccountKeys(asOfDate: string, territoryKeys: number[] | undefined, accountKeys: number[], toUsd: boolean): Promise<number> {
  if (!toUsd) {
    const rows = await query<{ total: string }>(
      `select coalesce(sum(amount), 0) as total from gl where date <= $1 and account_key = ANY($2::int[]) and (territory_key = ANY($3::int[]) OR $3::int[] IS NULL)`,
      [asOfDate, accountKeys, territoryKeys ?? null]
    );
    return Number(rows[0]?.total ?? 0);
  }
  const sql = `
    with local_by_territory as (
      select territory_key, sum(amount) as local_total
      from gl
      where date <= $1 and account_key = ANY($2::int[]) and (territory_key = ANY($3::int[]) OR $3::int[] IS NULL)
      group by territory_key
    ),
    closing_rate as (
      select distinct on (territory_key) territory_key, exchange_rate
      from currency_rate
      where date <= $1
      order by territory_key, date desc
    )
    select coalesce(sum(l.local_total * coalesce(r.exchange_rate, 1)), 0) as total
    from local_by_territory l
    left join closing_rate r on r.territory_key = l.territory_key
  `;
  const rows = await query<{ total: string }>(sql, [asOfDate, accountKeys, territoryKeys ?? null]);
  return Number(rows[0]?.total ?? 0);
}
