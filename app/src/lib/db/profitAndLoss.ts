import { ftpTotal, ftpTotalUsd, resolvePeriodRange, type Scope } from "./aggregate";
import type { CoaCategory } from "./accountFilters";
import type { ProfitAndLossLineId, ProfitAndLossStatement } from "@/lib/fpa/types";

/**
 * The 12-line P&L this app now uses (docs/2-spec/design.md §2), built from
 * the same Chart-of-Accounts categories as src/lib/calcEngine/plAndBs.ts,
 * but combined the way design.md's prototype does: EBIT and Profit Before
 * Tax named separately, Interest Expense and Taxation as two lines instead
 * of the old combined "Interest & Tax".
 */
const LEAF_CATEGORIES: Partial<Record<ProfitAndLossLineId, CoaCategory[]>> = {
  sales: ["sales"],
  cos: ["costOfSales"],
  opex: ["opex"],
  da: ["depreciationAmortization"],
  nonop: ["nonOperating"],
  intexp: ["interestExpense"],
  tax: ["taxation"],
};

async function leafTotal(table: "gl" | "budget", scope: Scope, categories: CoaCategory[], toUsd: boolean): Promise<number> {
  if (!toUsd) return ftpTotal(table, scope, categories);
  const { total } = await ftpTotalUsd(table, scope, categories);
  return total;
}

export async function computeProfitAndLoss(scope: Scope, toUsd: boolean): Promise<ProfitAndLossStatement> {
  const leafIds = Object.keys(LEAF_CATEGORIES) as (keyof typeof LEAF_CATEGORIES)[];
  const [actuals, budgets] = await Promise.all([
    Promise.all(leafIds.map((id) => leafTotal("gl", scope, LEAF_CATEGORIES[id]!, toUsd))),
    Promise.all(leafIds.map((id) => leafTotal("budget", scope, LEAF_CATEGORIES[id]!, toUsd))),
  ]);
  const actual: Record<string, number> = {};
  const budget: Record<string, number> = {};
  leafIds.forEach((id, i) => {
    actual[id] = actuals[i];
    budget[id] = budgets[i];
  });

  const gpActual = actual.sales + actual.cos;
  const gpBudget = budget.sales + budget.cos;
  const ebitdaActual = gpActual + actual.opex;
  const ebitdaBudget = gpBudget + budget.opex;
  const ebitActual = ebitdaActual + actual.da;
  const ebitBudget = ebitdaBudget + budget.da;
  const pbtActual = ebitActual + actual.nonop + actual.intexp;
  const pbtBudget = ebitBudget + budget.nonop + budget.intexp;
  // Net Profit is computed directly (Report = "Profit and Loss"), not chained
  // from Profit Before Tax + Taxation — matches Calculations BI measure 28
  // and lets the two independently-derived figures cross-check each other.
  const [npActual, npBudget] = await Promise.all([
    leafTotal("gl", scope, ["profitAndLoss"], toUsd),
    leafTotal("budget", scope, ["profitAndLoss"], toUsd),
  ]);

  return {
    sales: { actual: actual.sales, budget: budget.sales },
    cos: { actual: actual.cos, budget: budget.cos },
    gp: { actual: gpActual, budget: gpBudget },
    opex: { actual: actual.opex, budget: budget.opex },
    ebitda: { actual: ebitdaActual, budget: ebitdaBudget },
    da: { actual: actual.da, budget: budget.da },
    ebit: { actual: ebitActual, budget: ebitBudget },
    nonop: { actual: actual.nonop, budget: budget.nonop },
    intexp: { actual: actual.intexp, budget: budget.intexp },
    pbt: { actual: pbtActual, budget: pbtBudget },
    tax: { actual: actual.tax, budget: budget.tax },
    np: { actual: npActual, budget: npBudget },
  };
}

export { resolvePeriodRange };
