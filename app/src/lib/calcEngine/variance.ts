export interface VarianceResult {
  variance: number;
  pctVariance: number | null;
  isMaterial: boolean;
}

/**
 * Variance_FTP / %_Variance_FTP / Outliers_Variance_FTP from Calculations BI:
 * variance = actual - budget, flagged material beyond ±5%.
 */
export function computeFtpVariance(actual: number, budget: number): VarianceResult {
  const variance = actual - budget;
  const pctVariance = budget === 0 ? null : variance / budget;
  return { variance, pctVariance, isMaterial: pctVariance !== null && Math.abs(pctVariance) > 0.05 };
}

/**
 * Variance_TTD / %_Variance_TTD / Outliers_Variance_TTD from Calculations BI.
 * Note the sign is budget-minus-actual here (opposite of the FTP measure
 * above) — reproduced faithfully since it's how the existing model already
 * reports cumulative variance; flagged material beyond ±3%.
 */
export function computeTtdVariance(actualCumulative: number, budgetCumulative: number): VarianceResult {
  const variance = budgetCumulative - actualCumulative;
  const pctVariance = budgetCumulative === 0 ? null : variance / budgetCumulative;
  return { variance, pctVariance, isMaterial: pctVariance !== null && Math.abs(pctVariance) > 0.03 };
}
