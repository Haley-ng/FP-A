import type { ParsedFinanceData, DatasetSyncStatus, Territory, GlEntry, BudgetEntry } from "../types";
import { computeProfitAndLoss, computeBudgetProfitAndLoss, type ProfitAndLoss } from "../calcEngine/plAndBs";
import { computeFtpVariance, type VarianceResult } from "../calcEngine/variance";
import type { PeriodFilter } from "../calcEngine/aggregate";
import { prepareCurrencyAdjustedData, type TerritorySelection, type CurrencyMode } from "./currency";

export type { TerritorySelection, CurrencyMode };

export interface ExecutiveOverviewOptions {
  territory: TerritorySelection;
  fiscalYear: number;
  /** Ignored (forced to "usd") when territory is "all" — see design.md §2. */
  currency: CurrencyMode;
}

export interface TerritoryRow {
  territory: Territory;
  pl: ProfitAndLoss;
  budget: { sales: number; ebitda: number; netProfit: number };
  variance: { sales: VarianceResult; ebitda: VarianceResult; netProfit: VarianceResult };
}

export interface ExecutiveOverviewViewModel {
  fiscalYear: number;
  territorySelection: TerritorySelection;
  effectiveCurrency: CurrencyMode;
  currencyLabel: string;
  rows: TerritoryRow[];
  total: TerritoryRow;
  unconvertedFxRows: number;
  lastRefreshedAt: string | null;
  datasetIssueCount: number;
}

export function availableFiscalYears(gl: GlEntry[]): number[] {
  const years = new Set(gl.map((e) => e.date.getFullYear()));
  return Array.from(years).sort((a, b) => a - b);
}

function computeRow(
  label: Territory,
  gl: GlEntry[],
  budget: BudgetEntry[],
  data: ParsedFinanceData,
  filter: PeriodFilter,
): TerritoryRow {
  const pl = computeProfitAndLoss(gl, data.chartOfAccounts, filter);
  const budgetPl = computeBudgetProfitAndLoss(budget, data.chartOfAccounts, filter);
  return {
    territory: label,
    pl,
    budget: budgetPl,
    variance: {
      sales: computeFtpVariance(pl.sales, budgetPl.sales),
      ebitda: computeFtpVariance(pl.ebitda, budgetPl.ebitda),
      netProfit: computeFtpVariance(pl.netProfit, budgetPl.netProfit),
    },
  };
}

export function buildExecutiveOverview(
  data: ParsedFinanceData,
  statuses: DatasetSyncStatus[],
  options: ExecutiveOverviewOptions,
): ExecutiveOverviewViewModel {
  const { gl, budget, effectiveCurrency, currencyLabel, unconvertedFxRows } = prepareCurrencyAdjustedData(
    data,
    options.territory,
    options.currency,
  );

  const filter: PeriodFilter = {
    dateFrom: new Date(Date.UTC(options.fiscalYear, 0, 1)),
    dateTo: new Date(Date.UTC(options.fiscalYear, 11, 31, 23, 59, 59)),
  };

  const territoriesToShow =
    options.territory === "all" ? data.territories : data.territories.filter((t) => t.territoryKey === options.territory);

  const rows = territoriesToShow.map((t) =>
    computeRow(t, gl, budget, data, { ...filter, territoryKeys: [t.territoryKey] }),
  );

  const totalLabel: Territory =
    options.territory === "all"
      ? { territoryKey: -1, country: "All Territories", region: "" }
      : rows[0]?.territory ?? { territoryKey: options.territory, country: "Unknown", region: "" };
  const total = computeRow(totalLabel, gl, budget, data, {
    ...filter,
    territoryKeys: options.territory === "all" ? undefined : [options.territory],
  });

  const lastRefreshedAt = statuses.reduce<string | null>((latest, s) => {
    if (!latest || s.lastRefreshedAt > latest) return s.lastRefreshedAt;
    return latest;
  }, null);
  const datasetIssueCount = statuses.reduce((sum, s) => sum + s.issues.length, 0);

  return {
    fiscalYear: options.fiscalYear,
    territorySelection: options.territory,
    effectiveCurrency,
    currencyLabel,
    rows,
    total,
    unconvertedFxRows,
    lastRefreshedAt,
    datasetIssueCount,
  };
}
