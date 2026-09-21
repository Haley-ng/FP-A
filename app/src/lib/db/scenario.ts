import type { ProfitAndLossStatement, ScenarioLeverValues } from "@/lib/fpa/types";
import { LINE_RATIOS_OF_SALES } from "@/lib/fpa/sampleData";

const AVG_COST_PER_FTE = 68000; // USD/yr, illustrative — no per-head cost is in the source dataset.

/** Applies the 5 Scenario Modelling levers to a real Base-Case P&L pulled from Supabase (design.md §2/§3 screen 7). */
export function applyScenario(base: ProfitAndLossStatement, levers: ScenarioLeverValues): ProfitAndLossStatement {
  const salesFactor = (1 + levers.salesGrowth / 100) * (1 + levers.priceChange / 100);
  const newSalesActual = base.sales.actual * salesFactor;

  const baseCosRatio = base.sales.actual !== 0 ? base.cos.actual / base.sales.actual : 0;
  const newCosRatio = baseCosRatio - levers.cosRate / 100;
  const newCosActual = newSalesActual * newCosRatio;

  const headcountCost = levers.headcount * AVG_COST_PER_FTE;
  const newOpexActual = base.opex.actual * (1 + levers.opexChange / 100) - headcountCost;

  const gpActual = newSalesActual + newCosActual;
  const ebitdaActual = gpActual + newOpexActual;
  const ebitActual = ebitdaActual + base.da.actual;
  const pbtActual = ebitActual + base.nonop.actual + base.intexp.actual;
  // design.md §2: "The effective tax rate is held constant from Base Case" — derived from
  // the real Base Case actual (tax / PBT), not an assumed rate, with the sample-data
  // constant only as a fallback for the edge case where Base Case PBT is exactly $0.
  const baseEffectiveTaxRate = base.pbt.actual !== 0 ? base.tax.actual / base.pbt.actual : LINE_RATIOS_OF_SALES.taxRateOfPbt;
  const taxActual = pbtActual * baseEffectiveTaxRate;
  const npActual = pbtActual + taxActual;

  return {
    sales: { actual: newSalesActual, budget: base.sales.budget },
    cos: { actual: newCosActual, budget: base.cos.budget },
    gp: { actual: gpActual, budget: base.gp.budget },
    opex: { actual: newOpexActual, budget: base.opex.budget },
    ebitda: { actual: ebitdaActual, budget: base.ebitda.budget },
    da: { actual: base.da.actual, budget: base.da.budget },
    ebit: { actual: ebitActual, budget: base.ebit.budget },
    nonop: { actual: base.nonop.actual, budget: base.nonop.budget },
    intexp: { actual: base.intexp.actual, budget: base.intexp.budget },
    pbt: { actual: pbtActual, budget: base.pbt.budget },
    tax: { actual: taxActual, budget: base.tax.budget },
    np: { actual: npActual, budget: base.np.budget },
  };
}
