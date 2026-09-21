import { query } from "./client";
import { CATEGORY_SQL, type CoaCategory } from "./accountFilters";

export interface Scope {
  dateFrom: string; // 'YYYY-MM-DD'
  dateTo: string;
  territoryKeys?: number[];
}

const PERIOD_MONTHS: Record<string, [number, number]> = {
  fy: [1, 12],
  h1: [1, 6],
  h2: [7, 12],
  q1: [1, 3],
  q2: [4, 6],
  q3: [7, 9],
  q4: [10, 12],
};

/** Resolves a fiscal-year + period into a concrete [dateFrom, dateTo] range. */
export function resolvePeriodRange(year: number, period: string): { dateFrom: string; dateTo: string } {
  const [startMonth, endMonth] = PERIOD_MONTHS[period] ?? PERIOD_MONTHS.fy;
  const dateFrom = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const dateTo = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom, dateTo };
}

function catWhere(categories: CoaCategory[]): string {
  return categories.map((c) => CATEGORY_SQL[c]).join(" OR ");
}

/** `territory_key = ANY($n) OR $n IS NULL` — a single always-present param slot that means "no filter" when null, so query text never has to branch on whether a territory scope was given. */
const TERR_CLAUSE = (col: string, n: number) => `(${col} = ANY($${n}::int[]) OR $${n}::int[] IS NULL)`;

/**
 * Total_FTP ("for the period") in local currency — SUM(t.amount) filtered by
 * date range, territory and one or more Chart-of-Accounts categories (OR'd
 * together, matching how the DAX measures combine multiple SubClass values
 * on one line, e.g. Non-operating Income's 4 sub-classes).
 */
export async function ftpTotal(table: "gl" | "budget", scope: Scope, categories: CoaCategory[]): Promise<number> {
  const sql = `
    select coalesce(sum(t.amount), 0) as total
    from ${table} t
    join chart_of_accounts coa on coa.account_key = t.account_key
    where t.date between $1 and $2
      and (${catWhere(categories)})
      and ${TERR_CLAUSE("t.territory_key", 3)}
  `;
  const rows = await query<{ total: string }>(sql, [scope.dateFrom, scope.dateTo, scope.territoryKeys ?? null]);
  return Number(rows[0]?.total ?? 0);
}

/**
 * Total_FTP converted to USD — the "Amount USD" measure: each row multiplied
 * by the matching daily rate for its own date + territory (a per-row SUMX,
 * not the whole-period total times one closing rate), reproducing
 * src/lib/calcEngine/fx.ts exactly. Rows with no matching currency_rate row
 * are excluded and counted (unconvertedCount), never silently left unconverted.
 */
export async function ftpTotalUsd(table: "gl" | "budget", scope: Scope, categories: CoaCategory[]): Promise<{ total: number; unconvertedCount: number }> {
  const sql = `
    with rated as (
      select t.amount,
             (select max(cr.exchange_rate) from currency_rate cr
                where cr.date = t.date and cr.territory_key = t.territory_key) as rate
      from ${table} t
      join chart_of_accounts coa on coa.account_key = t.account_key
      where t.date between $1 and $2
        and (${catWhere(categories)})
        and ${TERR_CLAUSE("t.territory_key", 3)}
    )
    select
      coalesce(sum(amount * rate) filter (where rate is not null), 0) as total,
      count(*) filter (where rate is null) as unconverted
    from rated
  `;
  const rows = await query<{ total: string; unconverted: string }>(sql, [scope.dateFrom, scope.dateTo, scope.territoryKeys ?? null]);
  return { total: Number(rows[0]?.total ?? 0), unconvertedCount: Number(rows[0]?.unconverted ?? 0) };
}

/**
 * Total_TTD (cumulative) in local currency — SUM(gl.amount) from the start of
 * the dataset up to `asOfDate`, per data-model.md's "Balance Sheet is built
 * from cumulative GL" finding (not read from Trial Balance).
 */
export async function ttdCumulativeTotal(asOfDate: string, territoryKeys: number[] | undefined, categories: CoaCategory[]): Promise<number> {
  const sql = `
    select coalesce(sum(gl.amount), 0) as total
    from gl
    join chart_of_accounts coa on coa.account_key = gl.account_key
    where gl.date <= $1
      and (${catWhere(categories)})
      and ${TERR_CLAUSE("gl.territory_key", 2)}
  `;
  const rows = await query<{ total: string }>(sql, [asOfDate, territoryKeys ?? null]);
  return Number(rows[0]?.total ?? 0);
}

/**
 * Same as ttdCumulativeTotal, converted to USD — but unlike ftpTotalUsd's
 * per-transaction rate (right for a flow), a Balance Sheet figure is a stock:
 * standard multi-currency consolidation translates a closing balance at ONE
 * closing rate, not a blend of every historical transaction date's rate. Per-row
 * conversion was tried first and left every non-USD territory's Balance Sheet
 * off by a small amount (confirmed against this real dataset) — this is why.
 * Local totals are summed per territory, then each territory's total is
 * multiplied by its own latest rate at-or-before asOfDate, then summed.
 */
export async function ttdCumulativeTotalUsd(asOfDate: string, territoryKeys: number[] | undefined, categories: CoaCategory[]): Promise<number> {
  const sql = `
    with local_by_territory as (
      select gl.territory_key, sum(gl.amount) as local_total
      from gl
      join chart_of_accounts coa on coa.account_key = gl.account_key
      where gl.date <= $1
        and (${catWhere(categories)})
        and ${TERR_CLAUSE("gl.territory_key", 2)}
      group by gl.territory_key
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
  const rows = await query<{ total: string }>(sql, [asOfDate, territoryKeys ?? null]);
  return Number(rows[0]?.total ?? 0);
}

/**
 * Budget's Balance Sheet accounts are monthly point-in-time targets, not
 * flows — the budgeted balance as of a date is the latest dated row
 * at-or-before it per (territory, account), never a sum (see aggregate.ts's
 * latestBudgetBalance and the ~6x-inflation finding in data-model.md).
 */
export async function latestBudgetBalance(asOfDate: string, territoryKeys: number[] | undefined, categories: CoaCategory[]): Promise<number> {
  const sql = `
    select coalesce(sum(latest.amount), 0) as total
    from (
      select distinct on (b.territory_key, b.account_key) b.territory_key, b.account_key, b.amount
      from budget b
      join chart_of_accounts coa on coa.account_key = b.account_key
      where b.date <= $1
        and (${catWhere(categories)})
        and ${TERR_CLAUSE("b.territory_key", 2)}
      order by b.territory_key, b.account_key, b.date desc
    ) latest
  `;
  const rows = await query<{ total: string }>(sql, [asOfDate, territoryKeys ?? null]);
  return Number(rows[0]?.total ?? 0);
}
