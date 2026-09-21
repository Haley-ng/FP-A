import { query } from "./client";
import { CATEGORY_SQL, type CoaCategory } from "./accountFilters";

/** 12 monthly totals (Jan..Dec) for one Chart-of-Accounts category, across a fiscal year — powers the Executive Overview / P&L / Cash Flow charts. */
export async function monthlySeries(
  table: "gl" | "budget",
  year: number,
  categories: CoaCategory[],
  territoryKeys: number[] | undefined,
  toUsd: boolean
): Promise<number[]> {
  const where = categories.map((c) => CATEGORY_SQL[c]).join(" OR ");
  const rateExpr = toUsd
    ? `* coalesce((select max(cr.exchange_rate) from currency_rate cr where cr.date = t.date and cr.territory_key = t.territory_key), 1)`
    : "";
  const sql = `
    select extract(month from t.date)::int as month, sum(t.amount ${rateExpr}) as total
    from ${table} t
    join chart_of_accounts coa on coa.account_key = t.account_key
    where t.date >= $1 and t.date <= $2
      and (${where})
      and (t.territory_key = ANY($3::int[]) OR $3::int[] IS NULL)
    group by 1
  `;
  const rows = await query<{ month: number; total: string }>(sql, [`${year}-01-01`, `${year}-12-31`, territoryKeys ?? null]);
  const series = new Array(12).fill(0);
  for (const r of rows) series[r.month - 1] = Number(r.total);
  return series;
}

/** Cumulative closing cash balance for each month-end of a fiscal year (accounts 10, 20). */
export async function monthlyCashBalance(year: number, territoryKeys: number[] | undefined): Promise<number[]> {
  const sql = `
    select extract(month from t.date)::int as month, sum(t.amount) as total
    from gl t
    where t.date <= $1
      and t.account_key in (10, 20)
      and (t.territory_key = ANY($2::int[]) OR $2::int[] IS NULL)
      and t.date >= $3
    group by 1
  `;
  // Running total needs every prior month included, so fetch monthly deltas within the year
  // plus the opening balance, then accumulate — see caller.
  const openingSql = `
    select coalesce(sum(amount), 0) as total from gl
    where date < $1 and account_key in (10, 20) and (territory_key = ANY($2::int[]) OR $2::int[] IS NULL)
  `;
  const [openingRows, deltaRows] = await Promise.all([
    query<{ total: string }>(openingSql, [`${year}-01-01`, territoryKeys ?? null]),
    query<{ month: number; total: string }>(sql, [`${year}-12-31`, territoryKeys ?? null, `${year}-01-01`]),
  ]);
  const deltaByMonth = new Array(12).fill(0);
  for (const r of deltaRows) deltaByMonth[r.month - 1] = Number(r.total);
  let running = Number(openingRows[0]?.total ?? 0);
  return deltaByMonth.map((d) => (running += d));
}
