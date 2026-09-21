import type { ParsedFinanceData, GlEntry, BudgetEntry } from "../types";
import { convertEntriesToUsd } from "../calcEngine/fx";

export type TerritorySelection = "all" | number;
export type CurrencyMode = "usd" | "local";

export interface CurrencyAdjustedData {
  gl: GlEntry[];
  budget: BudgetEntry[];
  effectiveCurrency: CurrencyMode;
  currencyLabel: string;
  unconvertedFxRows: number;
}

/**
 * Local Currency only makes sense for a single territory (design.md §2) — so
 * "all territories" always forces USD regardless of what was requested.
 */
export function prepareCurrencyAdjustedData(
  data: ParsedFinanceData,
  territory: TerritorySelection,
  requestedCurrency: CurrencyMode,
): CurrencyAdjustedData {
  const effectiveCurrency: CurrencyMode = territory === "all" ? "usd" : requestedCurrency;

  if (effectiveCurrency === "local") {
    const currencyLabel = data.currencyRates.find((r) => r.territoryKey === territory)?.currency ?? "local currency";
    return { gl: data.gl, budget: data.budget, effectiveCurrency, currencyLabel, unconvertedFxRows: 0 };
  }

  const glConv = convertEntriesToUsd(data.gl, data.currencyRates);
  const budgetConv = convertEntriesToUsd(data.budget, data.currencyRates);
  return {
    gl: glConv.converted,
    budget: budgetConv.converted,
    effectiveCurrency,
    currencyLabel: "USD",
    unconvertedFxRows: glConv.unconvertedCount + budgetConv.unconvertedCount,
  };
}
