import type { ChartOfAccount, GlEntry, BudgetEntry } from "../types";
import { sumGl, sumBudget, sumGlCumulative, latestBudgetBalance, type PeriodFilter } from "./aggregate";
import { computeFtpVariance, computeTtdVariance, type VarianceResult } from "./variance";

export interface DrillAggregator {
  actual: (gl: GlEntry[], filter: PeriodFilter, accountKeys: Set<number>) => number;
  budget: (budget: BudgetEntry[], filter: PeriodFilter, accountKeys: Set<number>) => number;
  variance: (actual: number, budget: number) => VarianceResult;
  /** Date range the leaf transaction list should show, consistent with how actual/budget above were aggregated. */
  transactionDateRange: (gl: GlEntry[], filter: PeriodFilter) => { from: Date; to: Date };
}

/** Default aggregator: FTP (period) sums, ±5% materiality — what P&L lines use. */
export const FTP_AGGREGATOR: DrillAggregator = {
  actual: sumGl,
  budget: sumBudget,
  variance: computeFtpVariance,
  transactionDateRange: (_gl, filter) => ({ from: filter.dateFrom, to: filter.dateTo }),
};

/**
 * Balance Sheet aggregator: cumulative-to-date balance as of filter.dateTo,
 * ±3% materiality — matches the DAX library's own TTD variance convention
 * (data-model.md), including its budget-minus-actual sign.
 */
export const CUMULATIVE_AGGREGATOR: DrillAggregator = {
  actual: (gl, filter, keys) => sumGlCumulative(gl, filter.dateTo, filter.territoryKeys, keys),
  budget: (budget, filter, keys) => latestBudgetBalance(budget, filter.dateTo, filter.territoryKeys, keys),
  variance: computeTtdVariance,
  transactionDateRange: (gl, filter) => {
    let earliest = filter.dateTo;
    for (const e of gl) if (e.date.getTime() < earliest.getTime()) earliest = e.date;
    return { from: earliest, to: filter.dateTo };
  },
};

// Hierarchy order used for drill-down, per data-model.md (SubAccount is
// skipped — it duplicates Account for every account in this dataset).
export const HIERARCHY_FIELDS = ["class", "subClass", "subClass2", "account"] as const;
export type HierarchyField = (typeof HIERARCHY_FIELDS)[number];

export type DrillFilters = Partial<Record<HierarchyField, string>>;

function matches(account: ChartOfAccount, filters: DrillFilters): boolean {
  return HIERARCHY_FIELDS.every((f) => !filters[f] || account[f] === filters[f]);
}

export interface DrillGroup {
  field: HierarchyField;
  value: string;
  accountKeys: number[];
  actual: number;
  budget: number;
  variance: VarianceResult;
}

export interface DrillLevel {
  kind: "groups";
  field: HierarchyField;
  groups: DrillGroup[];
}

export interface DrillLeaf {
  kind: "leaf";
  accountKeys: number[];
  transactions: GlEntry[];
  actual: number;
  budget: number;
  variance: VarianceResult;
}

/**
 * Given a root filter (e.g. { subClass: "Operating Expenses" }) plus any
 * deeper filters already chosen by clicking through, groups the matching
 * Chart of Accounts rows by the next hierarchy field that actually
 * distinguishes them — skipping a field transparently when every matching
 * account shares the same value for it (a one-option level is not a real
 * choice) — until reaching individual accounts, at which point the
 * underlying GL transactions are returned instead of another group level.
 */
export function resolveDrillLevel(
  coa: ChartOfAccount[],
  gl: GlEntry[],
  budget: BudgetEntry[],
  filter: PeriodFilter,
  appliedFilters: DrillFilters,
  aggregator: DrillAggregator = FTP_AGGREGATOR,
): DrillLevel | DrillLeaf {
  const matchingAccounts = coa.filter((a) => matches(a, appliedFilters));

  for (const field of HIERARCHY_FIELDS) {
    if (appliedFilters[field]) continue;
    const distinctValues = Array.from(new Set(matchingAccounts.map((a) => a[field]))).filter(Boolean);
    if (distinctValues.length <= 1) continue; // trivial level — skip straight to the next field

    const groups: DrillGroup[] = distinctValues.map((value) => {
      const accountKeys = matchingAccounts.filter((a) => a[field] === value).map((a) => a.accountKey);
      const keySet = new Set(accountKeys);
      const actual = aggregator.actual(gl, filter, keySet);
      const budgetTotal = aggregator.budget(budget, filter, keySet);
      return { field, value, accountKeys, actual, budget: budgetTotal, variance: aggregator.variance(actual, budgetTotal) };
    });
    groups.sort((a, b) => Math.abs(b.actual) - Math.abs(a.actual));
    return { kind: "groups", field, groups };
  }

  // No hierarchy field left to group by — this is a single leaf account (or set of accounts sharing every field value).
  const accountKeys = Array.from(new Set(matchingAccounts.map((a) => a.accountKey)));
  const keySet = new Set(accountKeys);
  const txnRange = aggregator.transactionDateRange(gl, filter);
  const transactions = gl
    .filter((e) => {
      if (!keySet.has(e.accountKey)) return false;
      if (e.date.getTime() < txnRange.from.getTime() || e.date.getTime() > txnRange.to.getTime()) return false;
      if (filter.territoryKeys && !filter.territoryKeys.includes(e.territoryKey)) return false;
      return true;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const actual = aggregator.actual(gl, filter, keySet);
  const budgetTotal = aggregator.budget(budget, filter, keySet);
  return { kind: "leaf", accountKeys, transactions, actual, budget: budgetTotal, variance: aggregator.variance(actual, budgetTotal) };
}
