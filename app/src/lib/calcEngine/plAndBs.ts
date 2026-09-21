import type { ChartOfAccount, GlEntry, BudgetEntry } from "../types";
import { CATEGORY, interestAndTax } from "./accountFilters";
import { sumGl, sumGlCumulative, sumBudget, type PeriodFilter } from "./aggregate";

export interface ProfitAndLoss {
  sales: number;
  costOfSales: number;
  grossProfit: number;
  opex: number;
  ebitda: number;
  depreciationAmortization: number;
  operatingProfit: number;
  nonOperating: number;
  pbit: number;
  interestAndTax: number;
  netProfit: number;
}

/** Shared P&L computation, generic over which entries (GL actuals or Budget) and sum function to use. */
function computeProfitAndLossGeneric<T>(
  entries: T[],
  coa: ChartOfAccount[],
  filter: PeriodFilter,
  sum: (entries: T[], filter: PeriodFilter, accountKeys?: Set<number>) => number,
): ProfitAndLoss {
  const sales = sum(entries, filter, CATEGORY.sales(coa));
  const costOfSales = sum(entries, filter, CATEGORY.costOfSales(coa));
  const grossProfit = sum(entries, filter, CATEGORY.grossProfitAccounts(coa));
  const opex = sum(entries, filter, CATEGORY.opex(coa));
  const ebitda = grossProfit + opex;
  const depreciationAmortization = sum(entries, filter, CATEGORY.depreciationAmortization(coa));
  const operatingProfit = grossProfit + sum(entries, filter, CATEGORY.operatingAccounts(coa));
  const nonOperating = sum(entries, filter, CATEGORY.nonOperating(coa));
  const pbit = operatingProfit + nonOperating;
  const interestAndTaxTotal = sum(entries, filter, interestAndTax(coa));
  // Net Profit is computed directly (Report = "Profit and Loss"), not by
  // chaining PBIT - Interest & Tax — matches Calculations BI measure 28.
  const netProfit = sum(entries, filter, CATEGORY.profitAndLoss(coa));

  return {
    sales,
    costOfSales,
    grossProfit,
    opex,
    ebitda,
    depreciationAmortization,
    operatingProfit,
    nonOperating,
    pbit,
    interestAndTax: interestAndTaxTotal,
    netProfit,
  };
}

/** Mirrors the P&L chain of measures in Calculations BI.xlsx (see data-model.md). */
export function computeProfitAndLoss(gl: GlEntry[], coa: ChartOfAccount[], filter: PeriodFilter): ProfitAndLoss {
  return computeProfitAndLossGeneric(gl, coa, filter, sumGl);
}

/** Same P&L shape, computed from Budget instead of GL — the full line-by-line Budget vs Actual comparison. */
export type BudgetProfitAndLoss = ProfitAndLoss;

export function computeBudgetProfitAndLoss(
  budget: BudgetEntry[],
  coa: ChartOfAccount[],
  filter: PeriodFilter,
): BudgetProfitAndLoss {
  return computeProfitAndLossGeneric(budget, coa, filter, sumBudget);
}

export interface BalanceSheet {
  currentAsset: number;
  currentLiabilities: number;
  totalAsset: number;
  totalDebt: number;
  totalEquity: number;
  capitalEmployed: number;
  inventory: number;
  receivables: number;
  payables: number;
}

/** Balance Sheet figures built from cumulative GL as of `asOfDate` — see data-model.md's TTD note. */
export function computeBalanceSheet(
  gl: GlEntry[],
  coa: ChartOfAccount[],
  asOfDate: Date,
  territoryKeys?: number[],
): BalanceSheet {
  const cumulative = (accountKeys: Set<number>) => sumGlCumulative(gl, asOfDate, territoryKeys, accountKeys);

  const totalEquity = cumulative(CATEGORY.totalEquity(coa));
  const longTermLiabilities = cumulative(CATEGORY.longTermLiabilities(coa));

  return {
    currentAsset: cumulative(CATEGORY.currentAssets(coa)),
    currentLiabilities: cumulative(CATEGORY.currentLiabilities(coa)),
    totalAsset: cumulative(CATEGORY.totalAssets(coa)),
    totalDebt: cumulative(CATEGORY.totalDebt(coa)),
    totalEquity,
    capitalEmployed: totalEquity + longTermLiabilities,
    inventory: cumulative(CATEGORY.inventory(coa)),
    receivables: cumulative(CATEGORY.receivables(coa)),
    payables: cumulative(CATEGORY.payables(coa)),
  };
}

export interface KeyRatios {
  gpMargin: number | null;
  npMargin: number | null;
  ebitdaMargin: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  roe: number | null;
  roce: number | null;
  interestCover: number | null;
  assetTurnover: number | null;
  gearing: number | null;
  inventoryDays: number | null;
  payableDays: number | null;
  receivableDays: number | null;
}

function safeDiv(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function computeKeyRatios(pl: ProfitAndLoss, bs: BalanceSheet): KeyRatios {
  return {
    gpMargin: safeDiv(pl.grossProfit, pl.sales),
    npMargin: safeDiv(pl.netProfit, pl.sales),
    ebitdaMargin: safeDiv(pl.ebitda, pl.sales),
    currentRatio: safeDiv(bs.currentAsset, bs.currentLiabilities),
    quickRatio: safeDiv(bs.currentAsset - bs.inventory, bs.currentLiabilities),
    roe: safeDiv(pl.netProfit, bs.totalEquity),
    roce: safeDiv(pl.pbit, bs.capitalEmployed),
    interestCover: safeDiv(pl.pbit, pl.interestAndTax),
    assetTurnover: safeDiv(pl.sales, bs.totalAsset),
    gearing: safeDiv(bs.totalDebt, bs.totalEquity),
    inventoryDays: bs.inventory && pl.costOfSales ? safeDiv(bs.inventory, pl.costOfSales)! * 365 * -1 : null,
    payableDays: bs.payables && pl.costOfSales ? safeDiv(bs.payables, pl.costOfSales)! * 365 * -1 : null,
    receivableDays: bs.receivables && pl.sales ? safeDiv(bs.receivables, pl.sales)! * 365 : null,
  };
}
