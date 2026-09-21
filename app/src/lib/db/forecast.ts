import { monthlySeries } from "./monthly";
import { varPct } from "./variance";
import type { CoaCategory } from "./accountFilters";
import type { ForecastDriverValues, ForecastMethod, ProfitAndLossLineId } from "@/lib/fpa/types";

const LINE_CATEGORIES: Record<ProfitAndLossLineId, CoaCategory[] | null> = {
  sales: ["sales"],
  cos: ["costOfSales"],
  gp: ["grossProfitAccounts"],
  opex: ["opex"],
  ebitda: null, // derived: gp + opex
  da: ["depreciationAmortization"],
  ebit: null, // derived: ebitda + da
  nonop: ["nonOperating"],
  intexp: ["interestExpense"],
  pbt: null, // derived: ebit + nonop + intexp
  tax: ["taxation"],
  np: ["profitAndLoss"],
};

const LINE_ORDER: ProfitAndLossLineId[] = ["sales", "cos", "gp", "opex", "ebitda", "da", "ebit", "nonop", "intexp", "pbt", "tax", "np"];

export interface ForecastRowResult {
  lineId: ProfitAndLossLineId;
  actualToDate: number;
  forecastRemaining: number;
  total: number;
  budget: number;
  varAbs: number;
  varPct: number | null;
  splitActualFraction: number;
}

/** Actual-to-cutover plus forecast-for-remaining-months, by Budget+drivers or Run-rate (design.md §2/§3 screen 8), built from real monthly GL/Budget totals. */
export async function forecastRows(
  year: number,
  territoryKeys: number[] | undefined,
  toUsd: boolean,
  cutoverMonth: number,
  method: ForecastMethod,
  drivers: ForecastDriverValues
): Promise<ForecastRowResult[]> {
  const monthly: Record<string, { actual: number[]; budget: number[] }> = {};
  for (const lineId of LINE_ORDER) {
    const cats = LINE_CATEGORIES[lineId];
    if (!cats) continue;
    const [actual, budget] = await Promise.all([
      monthlySeries("gl", year, cats, territoryKeys, toUsd),
      monthlySeries("budget", year, cats, territoryKeys, toUsd),
    ]);
    monthly[lineId] = { actual, budget };
  }
  // Derived lines (subtotals) are built from the leaf monthly series, not queried directly.
  monthly.ebitda = combine(monthly.gp, monthly.opex);
  monthly.ebit = combine(monthly.ebitda, monthly.da);
  monthly.pbt = combine(combine(monthly.ebit, monthly.nonop), monthly.intexp);

  const driverFactor = (lineId: ProfitAndLossLineId) => {
    if (lineId === "sales") return 1 + drivers.salesDriver / 100;
    if (lineId === "cos") return 1 - drivers.cosDriver / 100;
    if (lineId === "opex") return 1 - drivers.opexDriver / 100;
    return 1;
  };

  const sumMonths = (series: number[], from: number, to: number) => series.slice(from, to).reduce((s, v) => s + v, 0);

  return LINE_ORDER.map((lineId) => {
    const s = monthly[lineId];
    const actualToDate = sumMonths(s.actual, 0, cutoverMonth);
    const budgetFull = sumMonths(s.budget, 0, 12);
    const forecastRemaining =
      method === "budget"
        ? sumMonths(s.budget, cutoverMonth, 12) * driverFactor(lineId)
        : (cutoverMonth > 0 ? actualToDate / cutoverMonth : 0) * (12 - cutoverMonth) * driverFactor(lineId);
    const total = actualToDate + forecastRemaining;
    return {
      lineId,
      actualToDate,
      forecastRemaining,
      total,
      budget: budgetFull,
      varAbs: total - budgetFull,
      varPct: varPct(total, budgetFull),
      splitActualFraction: total !== 0 ? actualToDate / total : 0.5,
    };
  });
}

function combine(a: { actual: number[]; budget: number[] }, b: { actual: number[]; budget: number[] }) {
  return {
    actual: a.actual.map((v, i) => v + b.actual[i]),
    budget: a.budget.map((v, i) => v + b.budget[i]),
  };
}
