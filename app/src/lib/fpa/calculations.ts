/**
 * Pure derivation functions over src/lib/fpa/sampleData.ts.
 * No I/O, no database — everything here is a plain function of the sample
 * data plus whatever scope (territory/year/period/currency) is passed in.
 * The API routes under src/app/api/fpa/ are the only callers.
 */

import {
  ACCOUNT_WEIGHTS,
  BS_ACCOUNTS,
  BS_RATIOS_OF_SALES,
  DATASET_ISSUES,
  DATASETS,
  FORECAST_DRIVERS,
  LINE_RATIOS_OF_SALES,
  MONTH_WEIGHTS,
  MONTHS,
  PERIOD_MONTHS,
  PL_ACCOUNTS,
  PL_LINES,
  PRIOR_YEAR_RATE,
  REPORT_SECTIONS,
  SCENARIO_LEVERS,
  TERRITORIES,
  TERRITORY_YEAR_SALES,
  VARIANCE_SEED,
} from "./sampleData";
import type {
  ActualBudgetValue,
  BalanceSheetLine,
  CashFlowLine,
  DatasetCheck,
  DatasetIssue,
  DrillAccountRow,
  FxImpactRow,
  ForecastDriverValues,
  ForecastMethod,
  GlTransaction,
  KpiCardData,
  ProfitAndLossLineId,
  ProfitAndLossStatement,
  ScenarioLeverValues,
  Territory,
  TerritoryFilter,
  TerritoryPerformanceRow,
  VarianceBridgeItem,
  VarianceRow,
} from "./types";

export function territoryByKey(key: number): Territory | undefined {
  return TERRITORIES.find((t) => t.key === key);
}

export function resolveTerritoryKeys(filter: TerritoryFilter): number[] {
  return filter === "all" ? TERRITORIES.map((t) => t.key) : [filter];
}

export function periodFraction(period: string): number {
  const months = PERIOD_MONTHS[period] ?? PERIOD_MONTHS.fy;
  return months.reduce((sum, m) => sum + MONTH_WEIGHTS[m - 1], 0);
}

export function annualSales(territoryKey: number, year: number): number {
  const row = TERRITORY_YEAR_SALES.find((r) => r.territoryKey === territoryKey && r.year === year);
  if (row) return row.salesActual;
  // Outside the 3 modelled years: extrapolate from the nearest year at ~6%/yr.
  const nearest = TERRITORY_YEAR_SALES.filter((r) => r.territoryKey === territoryKey).sort(
    (a, b) => Math.abs(a.year - year) - Math.abs(b.year - year)
  )[0];
  if (!nearest) return 0;
  const yearsAway = year - nearest.year;
  return nearest.salesActual * Math.pow(1.06, yearsAway);
}

/** Full annual (12-month) P&L for one territory, in that territory's local currency. */
function annualStatement(territoryKey: number, year: number): ProfitAndLossStatement {
  const sales = annualSales(territoryKey, year);
  const seed = VARIANCE_SEED[territoryKey] ?? {};

  const leafActual: Record<string, number> = {
    sales,
    cos: sales * LINE_RATIOS_OF_SALES.cos,
    opex: sales * LINE_RATIOS_OF_SALES.opex,
    da: sales * LINE_RATIOS_OF_SALES.da,
    nonop: sales * LINE_RATIOS_OF_SALES.nonop,
    intexp: sales * LINE_RATIOS_OF_SALES.intexp,
  };
  const leafBudget: Record<string, number> = {};
  for (const id of ["sales", "cos", "opex", "da", "nonop", "intexp"] as const) {
    const s = seed[id] ?? 0;
    leafBudget[id] = s === 0 ? leafActual[id] : leafActual[id] / (1 + s);
  }

  const gpActual = leafActual.sales + leafActual.cos;
  const gpBudget = leafBudget.sales + leafBudget.cos;
  const ebitdaActual = gpActual + leafActual.opex;
  const ebitdaBudget = gpBudget + leafBudget.opex;
  const ebitActual = ebitdaActual + leafActual.da;
  const ebitBudget = ebitdaBudget + leafBudget.da;
  const pbtActual = ebitActual + leafActual.nonop + leafActual.intexp;
  const pbtBudget = ebitBudget + leafBudget.nonop + leafBudget.intexp;

  const taxSeed = seed.tax ?? 0;
  const taxActual = pbtActual * LINE_RATIOS_OF_SALES.taxRateOfPbt;
  const taxBudget = pbtBudget * LINE_RATIOS_OF_SALES.taxRateOfPbt * (taxSeed === 0 ? 1 : 1 / (1 + taxSeed));

  const npActual = pbtActual + taxActual;
  const npBudget = pbtBudget + taxBudget;

  return {
    sales: { actual: leafActual.sales, budget: leafBudget.sales },
    cos: { actual: leafActual.cos, budget: leafBudget.cos },
    gp: { actual: gpActual, budget: gpBudget },
    opex: { actual: leafActual.opex, budget: leafBudget.opex },
    ebitda: { actual: ebitdaActual, budget: ebitdaBudget },
    da: { actual: leafActual.da, budget: leafBudget.da },
    ebit: { actual: ebitActual, budget: ebitBudget },
    nonop: { actual: leafActual.nonop, budget: leafBudget.nonop },
    intexp: { actual: leafActual.intexp, budget: leafBudget.intexp },
    pbt: { actual: pbtActual, budget: pbtBudget },
    tax: { actual: taxActual, budget: taxBudget },
    np: { actual: npActual, budget: npBudget },
  };
}

function scaleValue(v: ActualBudgetValue, factor: number): ActualBudgetValue {
  return { actual: v.actual * factor, budget: v.budget * factor };
}

function addValue(a: ActualBudgetValue, b: ActualBudgetValue): ActualBudgetValue {
  return { actual: a.actual + b.actual, budget: a.budget + b.budget };
}

const ZERO: ActualBudgetValue = { actual: 0, budget: 0 };
const emptyStatement = (): ProfitAndLossStatement => ({
  sales: { ...ZERO }, cos: { ...ZERO }, gp: { ...ZERO }, opex: { ...ZERO }, ebitda: { ...ZERO },
  da: { ...ZERO }, ebit: { ...ZERO }, nonop: { ...ZERO }, intexp: { ...ZERO }, pbt: { ...ZERO },
  tax: { ...ZERO }, np: { ...ZERO },
});

/** P&L for a scope: one or more territories, a fiscal year, a period, converted to USD or not. */
export function computeStatement(territoryKeys: number[], year: number, period: string, toUsd: boolean): ProfitAndLossStatement {
  const frac = periodFraction(period);
  const out = emptyStatement();
  for (const key of territoryKeys) {
    const t = territoryByKey(key);
    const rate = toUsd ? (t?.rate ?? 1) : 1;
    const annual = annualStatement(key, year);
    for (const id of Object.keys(annual) as ProfitAndLossLineId[]) {
      out[id] = addValue(out[id], scaleValue(annual[id], frac * rate));
    }
  }
  return out;
}

export function varPct(actual: number, budget: number): number | null {
  if (budget === 0) return null;
  return ((actual - budget) / Math.abs(budget)) * 100;
}

/** Monthly actual/budget series for one line, summed across territories, for charts. */
export function monthlySeries(
  territoryKeys: number[],
  year: number,
  lineId: ProfitAndLossLineId,
  toUsd: boolean
): { actual: number[]; budget: number[] } {
  const actual: number[] = new Array(12).fill(0);
  const budget: number[] = new Array(12).fill(0);
  for (const key of territoryKeys) {
    const t = territoryByKey(key);
    const rate = toUsd ? (t?.rate ?? 1) : 1;
    const annual = annualStatement(key, year)[lineId];
    for (let m = 0; m < 12; m++) {
      actual[m] += annual.actual * MONTH_WEIGHTS[m] * rate;
      budget[m] += annual.budget * MONTH_WEIGHTS[m] * rate;
    }
  }
  return { actual, budget };
}

// ---------- P&L drill-down ----------

export function lineAccounts(lineId: ProfitAndLossLineId) {
  const def = PL_LINES.find((l) => l.id === lineId);
  if (!def?.subs) return [];
  const subs = new Set(def.subs);
  return PL_ACCOUNTS.filter((a) => subs.has(a.sub));
}

export function lineGroups(lineId: ProfitAndLossLineId): string[] {
  const accounts = lineAccounts(lineId);
  return Array.from(new Set(accounts.map((a) => a.sub2)));
}

/** Group-level (sub2) drill rows for a line, or account-level rows within one group. */
export function drillRows(
  lineId: ProfitAndLossLineId,
  group: string | null,
  territoryKeys: number[],
  year: number,
  period: string,
  toUsd: boolean
): DrillAccountRow[] {
  const accounts = group ? lineAccounts(lineId).filter((a) => a.sub2 === group) : lineAccounts(lineId);
  const line = computeStatement(territoryKeys, year, period, toUsd)[lineId];

  if (!group && lineGroups(lineId).length > 1) {
    // group-level rows
    const groups = lineGroups(lineId);
    return groups.map((g) => {
      const members = lineAccounts(lineId).filter((a) => a.sub2 === g);
      const weight = members.reduce((s, a) => s + (ACCOUNT_WEIGHTS[a.key] ?? 1 / members.length), 0);
      return {
        accountKey: -1,
        label: g,
        actual: line.actual * weight,
        budget: line.budget * weight,
      };
    });
  }

  // account-level rows (either within a chosen group, or the line's only group)
  const totalWeight = accounts.reduce((s, a) => s + (ACCOUNT_WEIGHTS[a.key] ?? 1 / accounts.length), 0) || 1;
  const groupWeight = group
    ? lineAccounts(lineId).filter((a) => a.sub2 === group).reduce((s, a) => s + (ACCOUNT_WEIGHTS[a.key] ?? 1), 0)
    : totalWeight;
  return accounts.map((a) => {
    const w = ACCOUNT_WEIGHTS[a.key] ?? 1 / accounts.length;
    const shareOfLine = group ? w / groupWeight * (groupWeight / totalWeight) : w / totalWeight;
    return {
      accountKey: a.key,
      label: a.subacct,
      actual: line.actual * shareOfLine,
      budget: line.budget * shareOfLine,
    };
  });
}

/** Synthetic GL transactions for one account within a scope — illustrative only. */
export function glTransactions(accountKey: number, territoryKeys: number[], year: number, period: string): GlTransaction[] {
  const months = PERIOD_MONTHS[period] ?? PERIOD_MONTHS.fy;
  const account = PL_ACCOUNTS.find((a) => a.key === accountKey);
  const lineDef = account ? PL_LINES.find((l) => l.subs?.includes(account.sub)) : undefined;
  if (!account || !lineDef) return [];

  const descriptions = [`${account.subacct} — monthly accrual`, `${account.subacct} — vendor settlement`, `${account.subacct} — adjustment`];
  const rows: GlTransaction[] = [];
  let entryNo = 1;
  for (const key of territoryKeys) {
    const drill = drillRows(lineDef.id, account.sub2, [key], year, "fy", false).find((r) => r.accountKey === accountKey);
    const annualAmount = drill?.actual ?? 0;
    for (const m of months) {
      const monthlyAmount = annualAmount * MONTH_WEIGHTS[m - 1];
      const perTxn = monthlyAmount / 2;
      for (let i = 0; i < 2; i++) {
        rows.push({
          entryNo: entryNo++,
          date: `${year}-${String(m).padStart(2, "0")}-${i === 0 ? "05" : "21"}`,
          details: descriptions[(entryNo + i) % descriptions.length],
          territoryKey: key,
          accountKey,
          amount: Math.round(perTxn * (1 + (i === 0 ? 0.04 : -0.04))),
        });
      }
    }
  }
  return rows;
}

// ---------- Balance Sheet ----------

export function balanceSheet(territoryKeys: number[], year: number, toUsd: boolean) {
  const linesByKey = new Map<number, BalanceSheetLine>();

  for (const key of territoryKeys) {
    const t = territoryByKey(key);
    const rate = toUsd ? (t?.rate ?? 1) : 1;
    const salesCurrent = annualSales(key, year);
    const salesPrior = annualSales(key, year - 1);

    let totalAssetsCurrent = 0;
    let totalAssetsPrior = 0;
    let otherEquityCurrent = 0;
    let otherEquityPrior = 0;

    for (const { key: acctKey, ratio } of BS_RATIOS_OF_SALES) {
      const account = BS_ACCOUNTS.find((a) => a.key === acctKey)!;
      const current = salesCurrent * ratio * rate;
      const prior = salesPrior * ratio * rate;
      if (account.cls === "Assets") {
        totalAssetsCurrent += current;
        totalAssetsPrior += prior;
      } else if (acctKey !== 200) {
        otherEquityCurrent += current;
        otherEquityPrior += prior;
      }
      const existing = linesByKey.get(acctKey);
      const value = existing ? existing.value + current : current;
      const prev = existing ? existing.prior + prior : prior;
      linesByKey.set(acctKey, {
        marker: "",
        label: account.subacct,
        isSubtotal: false,
        isHeadline: false,
        value,
        prior: prev,
      });
    }

    // Retained Earnings is the plug that makes Assets = Liabilities + Equity, per territory.
    const retainedCurrent = totalAssetsCurrent - otherEquityCurrent;
    const retainedPrior = totalAssetsPrior - otherEquityPrior;
    const existing = linesByKey.get(200);
    linesByKey.set(200, {
      marker: "",
      label: "Retained Earnings",
      isSubtotal: false,
      isHeadline: false,
      value: (existing?.value ?? 0) + retainedCurrent,
      prior: (existing?.prior ?? 0) + retainedPrior,
    });
  }

  const byGroup = (sub2: string) =>
    BS_ACCOUNTS.filter((a) => a.sub2 === sub2).map((a) => linesByKey.get(a.key)!).filter(Boolean);

  const groupTotal = (sub2: string) => {
    const rows = byGroup(sub2);
    return {
      value: rows.reduce((s, r) => s + r.value, 0),
      prior: rows.reduce((s, r) => s + r.prior, 0),
    };
  };

  const groups = ["Current Assets", "Non-Current Assets", "Current Liabilities", "Long Term Liabilities", "Share Capital", "Share Premium", "Retained Earnings"];
  const rows: BalanceSheetLine[] = [];
  let totalAssets = { value: 0, prior: 0 };
  let totalLiabEquity = { value: 0, prior: 0 };

  for (const g of groups) {
    const t = groupTotal(g);
    const isAsset = g === "Current Assets" || g === "Non-Current Assets";
    rows.push({ marker: "▸", label: g, isSubtotal: true, isHeadline: false, value: t.value, prior: t.prior });
    if (isAsset) {
      totalAssets = { value: totalAssets.value + t.value, prior: totalAssets.prior + t.prior };
    } else {
      totalLiabEquity = { value: totalLiabEquity.value + t.value, prior: totalLiabEquity.prior + t.prior };
    }
  }

  const totalAssetsLine: BalanceSheetLine = { marker: "", label: "Total Assets", isSubtotal: false, isHeadline: true, ...totalAssets };
  const totalLiabEquityLine: BalanceSheetLine = { marker: "", label: "Total Liabilities & Equity", isSubtotal: false, isHeadline: true, ...totalLiabEquity };

  const workingCapital = groupTotal("Current Assets").value - groupTotal("Current Liabilities").value;
  const cash = (linesByKey.get(10)?.value ?? 0) + (linesByKey.get(20)?.value ?? 0);
  const debt = groupTotal("Long Term Liabilities").value + (linesByKey.get(150)?.value ?? 0);
  const totalEquity = groupTotal("Share Capital").value + groupTotal("Share Premium").value + groupTotal("Retained Earnings").value;
  const netDebt = debt - cash;

  const accounts: Record<string, BalanceSheetLine> = {};
  for (const a of BS_ACCOUNTS) {
    const line = linesByKey.get(a.key);
    if (line) accounts[a.subacct] = line;
  }

  return {
    rows: [...rows, totalAssetsLine, totalLiabEquityLine],
    tie: totalAssets.value - totalLiabEquity.value,
    kpis: { totalAssets: totalAssets.value, workingCapital, netDebt, totalEquity },
    accounts,
  };
}

// ---------- Cash Flow ----------

export function cashFlow(territoryKeys: number[], year: number, period: string, toUsd: boolean): { lines: CashFlowLine[]; monthlyCash: number[] } {
  const months = PERIOD_MONTHS[period] ?? PERIOD_MONTHS.fy;
  const startMonth = months[0];

  const stmt = computeStatement(territoryKeys, year, period, toUsd);
  const daAddBack = -stmt.da.actual; // da is stored negative; add back as positive
  const capex = daAddBack * 0.65; // illustrative: capex runs a little below the D&A add-back
  const interestIncome = stmt.nonop.actual * 0.3;
  const dividendsPaid = stmt.sales.actual * 0.006; // illustrative small distribution

  const operatingBeforeWc = stmt.pbt.actual + daAddBack;

  // Working-capital movement across the period, from the balance-sheet model.
  const bsStart = balanceSheet(territoryKeys, startMonth === 1 ? year - 1 : year, toUsd);
  const bsEnd = balanceSheet(territoryKeys, year, toUsd);
  const wcLine = (label: string) => {
    const s = bsStart.accounts[label];
    const e = bsEnd.accounts[label];
    return (e?.value ?? 0) - (s?.value ?? 0);
  };
  const receivablesMove = wcLine("Trade Receivables");
  const inventoryMove = wcLine("Inventory");
  const payablesMove = wcLine("Trade Payables");
  const workingCapitalAdj = -receivablesMove - inventoryMove + payablesMove;

  const operating = operatingBeforeWc + workingCapitalAdj;
  const investing = -capex + interestIncome * 0.2;

  const cashStart = (bsStart.accounts["Cash at Bank"]?.value ?? 0) + (bsStart.accounts["Cash in hand"]?.value ?? 0);
  const cashEnd = (bsEnd.accounts["Cash at Bank"]?.value ?? 0) + (bsEnd.accounts["Cash in hand"]?.value ?? 0);
  const netMovementRequired = cashEnd - cashStart;
  const financing = netMovementRequired - operating - investing;

  const lines: CashFlowLine[] = [
    { label: "Profit Before Tax", section: "operating", value: stmt.pbt.actual, isSubtotal: false },
    { label: "Add back: Depreciation & Amortization", section: "operating", value: daAddBack, isSubtotal: false },
    { label: "Change in Trade Receivables", section: "operating", value: -receivablesMove, isSubtotal: false },
    { label: "Change in Inventory", section: "operating", value: -inventoryMove, isSubtotal: false },
    { label: "Change in Trade Payables", section: "operating", value: payablesMove, isSubtotal: false },
    { label: "Net Cash from Operating Activities", section: "operating", value: operating, isSubtotal: true },
    { label: "Purchase of Property, Plant & Equipment", section: "investing", value: -capex, isSubtotal: false },
    { label: "Interest & Investment Income", section: "investing", value: interestIncome * 0.2, isSubtotal: false },
    { label: "Net Cash from Investing Activities", section: "investing", value: investing, isSubtotal: true },
    { label: "Dividends Paid", section: "financing", value: -dividendsPaid, isSubtotal: false },
    { label: "Other Financing Movements", section: "financing", value: financing + dividendsPaid, isSubtotal: false },
    { label: "Net Cash from Financing Activities", section: "financing", value: financing, isSubtotal: true },
    { label: "Net Movement in Cash", section: "total", value: netMovementRequired, isSubtotal: true },
    { label: "Cash at Start of Period", section: "total", value: cashStart, isSubtotal: false },
    { label: "Cash at End of Period", section: "total", value: cashEnd, isSubtotal: true },
  ];

  // Monthly closing cash balance across the fiscal year, for the chart.
  const monthlyCash: number[] = [];
  const priorYearBs = balanceSheet(territoryKeys, year - 1, toUsd);
  const yearStartCash = (priorYearBs.accounts["Cash at Bank"]?.value ?? 0) + (priorYearBs.accounts["Cash in hand"]?.value ?? 0);
  for (let m = 1; m <= 12; m++) {
    const fracToDate = MONTH_WEIGHTS.slice(0, m).reduce((s, w) => s + w, 0);
    monthlyCash.push(yearStartCash + (cashEnd - yearStartCash) * fracToDate);
  }

  return { lines, monthlyCash };
}

// ---------- KPI cards (Executive Overview) ----------

export function executiveKpis(territoryKeys: number[], year: number, period: string, toUsd: boolean): KpiCardData[] {
  const stmt = computeStatement(territoryKeys, year, period, toUsd);
  const margin = stmt.sales.actual !== 0 ? (stmt.ebitda.actual / stmt.sales.actual) * 100 : 0;
  const marginBudget = stmt.sales.budget !== 0 ? (stmt.ebitda.budget / stmt.sales.budget) * 100 : 0;

  const sparkFor = (lineId: ProfitAndLossLineId): number[] => {
    const s = monthlySeries(territoryKeys, year, lineId, toUsd);
    let running = 0;
    return s.actual.map((v) => (running += v));
  };

  return [
    { label: "Sales", value: stmt.sales.actual, format: "currency" as const, budgetValue: stmt.sales.budget, varPct: varPct(stmt.sales.actual, stmt.sales.budget), spark: sparkFor("sales") },
    { label: "Gross Profit", value: stmt.gp.actual, format: "currency" as const, budgetValue: stmt.gp.budget, varPct: varPct(stmt.gp.actual, stmt.gp.budget), spark: sparkFor("gp") },
    { label: "EBITDA", value: stmt.ebitda.actual, format: "currency" as const, budgetValue: stmt.ebitda.budget, varPct: varPct(stmt.ebitda.actual, stmt.ebitda.budget), spark: sparkFor("ebitda") },
    { label: "EBITDA Margin", value: margin, format: "percent" as const, budgetValue: marginBudget, varPct: margin - marginBudget, spark: sparkFor("ebitda") },
    { label: "Net Profit", value: stmt.np.actual, format: "currency" as const, budgetValue: stmt.np.budget, varPct: varPct(stmt.np.actual, stmt.np.budget), spark: sparkFor("np") },
  ];
}

// ---------- Variance ranking ----------

const RANKED_LINES: ProfitAndLossLineId[] = ["sales", "gp", "opex", "ebitda", "da", "ebit", "nonop", "intexp", "pbt", "tax", "np"];

export function varianceRanking(lineFilter: ProfitAndLossLineId | "all", year: number, period: string): VarianceRow[] {
  const lines = lineFilter === "all" ? RANKED_LINES : [lineFilter];
  const rows: VarianceRow[] = [];
  for (const t of TERRITORIES) {
    for (const lineId of lines) {
      const stmt = computeStatement([t.key], year, period, true);
      const line = stmt[lineId];
      const def = PL_LINES.find((l) => l.id === lineId)!;
      rows.push({
        rank: 0,
        territoryKey: t.key,
        territoryName: t.name,
        lineId,
        lineLabel: lineFilter === "all" ? `${t.name} · ${def.label}` : t.name,
        actual: line.actual,
        budget: line.budget,
        varAbs: line.actual - line.budget,
        varPct: varPct(line.actual, line.budget),
      });
    }
  }
  rows.sort((a, b) => Math.abs(b.varAbs) - Math.abs(a.varAbs));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export function varianceBridge(territoryKey: number, lineId: ProfitAndLossLineId, year: number, period: string): VarianceBridgeItem[] {
  const rows = drillRows(lineId, null, [territoryKey], year, period, true)
    .map((r) => ({ label: r.label, value: r.actual - r.budget }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const top = rows.slice(0, 4);
  const otherValue = rows.slice(4).reduce((s, r) => s + r.value, 0);
  return rows.length > 4 ? [...top, { label: "Other accounts", value: otherValue }] : top;
}

// ---------- Scenario Modelling ----------

const AVG_COST_PER_FTE = 68000; // USD/yr, illustrative

export function applyScenario(
  base: ProfitAndLossStatement,
  levers: ScenarioLeverValues
): ProfitAndLossStatement {
  const salesFactor = (1 + levers.salesGrowth / 100) * (1 + levers.priceChange / 100);
  const newSalesActual = base.sales.actual * salesFactor;

  const baseCosRatio = base.sales.actual !== 0 ? base.cos.actual / base.sales.actual : 0;
  const newCosRatio = baseCosRatio - levers.cosRate / 100; // cos is negative; subtracting a positive point widens the (negative) ratio
  const newCosActual = newSalesActual * newCosRatio;

  const headcountCost = levers.headcount * AVG_COST_PER_FTE;
  const newOpexActual = base.opex.actual * (1 + levers.opexChange / 100) - headcountCost;

  const gpActual = newSalesActual + newCosActual;
  const ebitdaActual = gpActual + newOpexActual;
  const ebitActual = ebitdaActual + base.da.actual;
  const pbtActual = ebitActual + base.nonop.actual + base.intexp.actual;
  const taxActual = pbtActual * LINE_RATIOS_OF_SALES.taxRateOfPbt;
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

export { SCENARIO_LEVERS };

// ---------- Forecast ----------

export function forecastRows(
  territoryKeys: number[],
  year: number,
  toUsd: boolean,
  cutoverMonth: number,
  method: ForecastMethod,
  drivers: ForecastDriverValues
) {
  const actualMonths = Array.from({ length: cutoverMonth }, (_, i) => i + 1);
  const remainingMonths = Array.from({ length: 12 - cutoverMonth }, (_, i) => cutoverMonth + i + 1);

  const sumMonths = (lineId: ProfitAndLossLineId, months: number[], useBudget: boolean) => {
    const s = monthlySeries(territoryKeys, year, lineId, toUsd);
    return months.reduce((sum, m) => sum + (useBudget ? s.budget[m - 1] : s.actual[m - 1]), 0);
  };

  const driverFactor = (lineId: ProfitAndLossLineId) => {
    if (lineId === "sales") return 1 + drivers.salesDriver / 100;
    if (lineId === "cos") return 1 - drivers.cosDriver / 100;
    if (lineId === "opex") return 1 - drivers.opexDriver / 100;
    return 1;
  };

  const lineIds: ProfitAndLossLineId[] = ["sales", "cos", "gp", "opex", "ebitda", "da", "ebit", "nonop", "intexp", "pbt", "tax", "np"];
  const rows = lineIds.map((lineId) => {
    const actualToDate = sumMonths(lineId, actualMonths, false);
    const budgetFull = sumMonths(lineId, [...actualMonths, ...remainingMonths], true);

    let forecastRemaining: number;
    if (method === "budget") {
      forecastRemaining = sumMonths(lineId, remainingMonths, true) * driverFactor(lineId);
    } else {
      const monthlyRunRate = cutoverMonth > 0 ? actualToDate / cutoverMonth : 0;
      forecastRemaining = monthlyRunRate * remainingMonths.length * driverFactor(lineId);
    }
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
  return rows;
}

export { FORECAST_DRIVERS };

// ---------- Territory Performance ----------

export function territoryPerformance(year: number, period: string): TerritoryPerformanceRow[] {
  return TERRITORIES.map((t) => {
    const stmt = computeStatement([t.key], year, period, false);
    const salesUsd = stmt.sales.actual * t.rate;
    const ebitdaUsd = stmt.ebitda.actual * t.rate;
    return {
      territoryKey: t.key,
      name: t.name,
      currency: t.currency,
      salesLocal: stmt.sales.actual,
      salesUsd,
      ebitdaUsd,
      marginPct: salesUsd !== 0 ? (ebitdaUsd / salesUsd) * 100 : 0,
    };
  });
}

export function fxImpact(year: number, period: string): FxImpactRow[] {
  return TERRITORIES.map((t) => {
    const stmt = computeStatement([t.key], year, period, false);
    const salesLocal = stmt.sales.actual;
    const atCurrent = salesLocal * t.rate;
    const atPrior = salesLocal * (PRIOR_YEAR_RATE[t.key] ?? t.rate);
    const effect = atCurrent - atPrior;
    return {
      territoryKey: t.key,
      name: t.name,
      salesAtCurrentRate: atCurrent,
      salesAtPriorRate: atPrior,
      fxEffect: effect,
      fxPctOfSales: atCurrent !== 0 ? (effect / atCurrent) * 100 : 0,
    };
  });
}

// ---------- Data Library ----------

export function datasetChecks(datasetId: string): DatasetCheck[] {
  const ds = DATASETS.find((d) => d.id === datasetId);
  if (!ds) return [];
  const base: DatasetCheck[] = [
    { label: "No missing required columns", result: "pass" },
    { label: "No duplicate key rows", result: "pass" },
    { label: "All join keys resolve (territory_key / account_key)", result: "pass" },
    { label: "All dates parse to a valid calendar date", result: ds.validationStatus },
  ];
  return base;
}

export function datasetIssuesFor(datasetId: string): DatasetIssue[] {
  return DATASET_ISSUES.filter((i) => i.datasetId === datasetId);
}

export { DATASETS, REPORT_SECTIONS, TERRITORIES, MONTHS };
