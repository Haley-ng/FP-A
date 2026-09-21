import type { GlEntry, BudgetEntry } from "../types";

export interface PeriodFilter {
  territoryKeys?: number[];
  dateFrom: Date;
  dateTo: Date;
}

function inRange(date: Date, from: Date, to: Date): boolean {
  return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
}

function matchesTerritory(territoryKey: number, territoryKeys?: number[]): boolean {
  return !territoryKeys || territoryKeys.includes(territoryKey);
}

/** Total_FTP ("for the period") — mirrors `SUM(GL[Amount])` filtered by period/territory/account. */
export function sumGl(gl: GlEntry[], filter: PeriodFilter, accountKeys?: Set<number>): number {
  let total = 0;
  for (const e of gl) {
    if (!inRange(e.date, filter.dateFrom, filter.dateTo)) continue;
    if (!matchesTerritory(e.territoryKey, filter.territoryKeys)) continue;
    if (accountKeys && !accountKeys.has(e.accountKey)) continue;
    total += e.amount;
  }
  return total;
}

/** Total_FTP_Budget — same shape as sumGl but over the Budget workbook. */
export function sumBudget(budget: BudgetEntry[], filter: PeriodFilter, accountKeys?: Set<number>): number {
  let total = 0;
  for (const e of budget) {
    if (!inRange(e.date, filter.dateFrom, filter.dateTo)) continue;
    if (!matchesTerritory(e.territoryKey, filter.territoryKeys)) continue;
    if (accountKeys && !accountKeys.has(e.accountKey)) continue;
    total += e.amount;
  }
  return total;
}

/**
 * Total_TTD (cumulative) — sums GL from the earliest date in the whole dataset
 * up to `asOfDate`, i.e. Balance Sheet figures are built from cumulative GL,
 * not read from Trial Balance.xlsx directly (see data-model.md).
 */
export function sumGlCumulative(
  gl: GlEntry[],
  asOfDate: Date,
  territoryKeys: number[] | undefined,
  accountKeys?: Set<number>,
): number {
  let earliest = asOfDate;
  for (const e of gl) if (e.date.getTime() < earliest.getTime()) earliest = e.date;
  return sumGl(gl, { dateFrom: earliest, dateTo: asOfDate, territoryKeys }, accountKeys);
}

/**
 * Budget's Balance Sheet accounts are monthly point-in-time targets (e.g.
 * "Cash at Bank should be $580K by December"), not period movements like GL —
 * verified against Budget.xlsx directly: monthly values grow steadily in the
 * same magnitude as a running balance, not as comparable-sized monthly flows.
 * So the budgeted balance as of a date is the latest dated row at-or-before
 * it per (territory, account) — summing every month's "target balance" the
 * way sumGlCumulative sums GL's actual transaction movements would wildly
 * overcount (confirmed: it inflated Current Assets budget to 6x actual).
 */
export function latestBudgetBalance(
  budget: BudgetEntry[],
  asOfDate: Date,
  territoryKeys: number[] | undefined,
  accountKeys?: Set<number>,
): number {
  const latestByKey = new Map<string, { date: Date; amount: number }>();
  for (const e of budget) {
    if (e.date.getTime() > asOfDate.getTime()) continue;
    if (!matchesTerritory(e.territoryKey, territoryKeys)) continue;
    if (accountKeys && !accountKeys.has(e.accountKey)) continue;
    const key = `${e.territoryKey}|${e.accountKey}`;
    const existing = latestByKey.get(key);
    if (!existing || e.date.getTime() > existing.date.getTime()) {
      latestByKey.set(key, { date: e.date, amount: e.amount });
    }
  }
  let total = 0;
  for (const v of latestByKey.values()) total += v.amount;
  return total;
}
