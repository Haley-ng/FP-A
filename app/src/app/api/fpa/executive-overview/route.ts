import { computeProfitAndLoss, resolvePeriodRange } from "@/lib/db/profitAndLoss";
import { monthlySeries } from "@/lib/db/monthly";
import { varianceRanking } from "@/lib/db/variance";
import { query } from "@/lib/db/client";
import { MONTHS, PL_LINES } from "@/lib/fpa/sampleData";
import type { ProfitAndLossLineId, TerritoryFilter } from "@/lib/fpa/types";

async function territoryList() {
  return query<{ territory_key: number; country: string }>("select territory_key, country from territory order by territory_key");
}

function spark(values: number[]): number[] {
  let running = 0;
  return values.map((v) => (running += v));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const territoryParam = url.searchParams.get("territory") ?? "all";
  const territory: TerritoryFilter = territoryParam === "all" ? "all" : Number(territoryParam);
  const year = Number(url.searchParams.get("year") ?? "2025");
  const period = url.searchParams.get("period") ?? "fy";
  const currency = url.searchParams.get("currency") ?? "usd";
  const barsLine = (url.searchParams.get("barsLine") ?? "sales") as ProfitAndLossLineId;

  const territoryKeys = territory === "all" ? undefined : [territory as number];
  const single = territory !== "all";
  const toUsd = !single || currency === "usd";
  const scope = { ...resolvePeriodRange(year, period), territoryKeys };

  const stmt = await computeProfitAndLoss(scope, toUsd);
  const [barsActualByLine, barsBudgetByLine] = await Promise.all([
    monthlyLineSeries("gl", year, barsLine, territoryKeys, toUsd),
    monthlyLineSeries("budget", year, barsLine, territoryKeys, toUsd),
  ]);
  const bars = barsActualByLine;
  const barsBudget = barsBudgetByLine;

  const margin = stmt.sales.actual !== 0 ? (stmt.ebitda.actual / stmt.sales.actual) * 100 : 0;
  const marginBudget = stmt.sales.budget !== 0 ? (stmt.ebitda.budget / stmt.sales.budget) * 100 : 0;

  const sparkSeries = async (lineId: ProfitAndLossLineId) => spark(await monthlyLineSeries("gl", year, lineId, territoryKeys, toUsd));

  const kpis = await Promise.all([
    (async () => ({ label: "Sales", value: stmt.sales.actual, format: "currency" as const, budgetValue: stmt.sales.budget, varPct: pct(stmt.sales.actual, stmt.sales.budget), spark: await sparkSeries("sales") }))(),
    (async () => ({ label: "Gross Profit", value: stmt.gp.actual, format: "currency" as const, budgetValue: stmt.gp.budget, varPct: pct(stmt.gp.actual, stmt.gp.budget), spark: await sparkSeries("gp") }))(),
    (async () => ({ label: "EBITDA", value: stmt.ebitda.actual, format: "currency" as const, budgetValue: stmt.ebitda.budget, varPct: pct(stmt.ebitda.actual, stmt.ebitda.budget), spark: await sparkSeries("ebitda") }))(),
    (async () => ({ label: "EBITDA Margin", value: margin, format: "percent" as const, budgetValue: marginBudget, varPct: margin - marginBudget, spark: await sparkSeries("ebitda") }))(),
    (async () => ({ label: "Net Profit", value: stmt.np.actual, format: "currency" as const, budgetValue: stmt.np.budget, varPct: pct(stmt.np.actual, stmt.np.budget), spark: await sparkSeries("np") }))(),
  ]);

  const territories = await territoryList();
  const territoryRows = await Promise.all(
    territories.map(async (t) => {
      const s = await computeProfitAndLoss({ ...resolvePeriodRange(year, period), territoryKeys: [t.territory_key] }, true);
      return { key: t.territory_key, name: t.country, sales: s.sales.actual, gp: s.gp.actual, ebitda: s.ebitda.actual, np: s.np.actual };
    })
  );

  const attention = (await varianceRanking("all", year, period)).filter((r) => r.varPct != null && Math.abs(r.varPct) >= 5).slice(0, 5);

  return Response.json({
    kpis,
    months: MONTHS,
    bars: { actual: bars, budget: barsBudget },
    lineOptions: PL_LINES.map((l) => ({ id: l.id, label: l.label })),
    territoryRows,
    attention,
    currencyCode: "USD",
  });
}

function pct(actual: number, budget: number): number | null {
  if (budget === 0) return null;
  return ((actual - budget) / Math.abs(budget)) * 100;
}

type Cat = "sales" | "costOfSales" | "grossProfitAccounts" | "opex" | "depreciationAmortization" | "nonOperating" | "interestExpense" | "taxation" | "profitAndLoss";

const LEAF_CATEGORY: Partial<Record<ProfitAndLossLineId, Cat>> = {
  sales: "sales",
  cos: "costOfSales",
  gp: "grossProfitAccounts",
  opex: "opex",
  da: "depreciationAmortization",
  nonop: "nonOperating",
  intexp: "interestExpense",
  tax: "taxation",
  np: "profitAndLoss",
};

/** Monthly series for any of the 12 P&L lines — leaf lines query one Chart-of-Accounts category directly; subtotal lines (EBITDA/EBIT/PBT) are summed from their component lines' own monthly series, same chain as computeProfitAndLoss. */
async function monthlyLineSeries(table: "gl" | "budget", year: number, lineId: ProfitAndLossLineId, territoryKeys: number[] | undefined, toUsd: boolean): Promise<number[]> {
  const direct = LEAF_CATEGORY[lineId];
  if (direct) return monthlySeries(table, year, [direct], territoryKeys, toUsd);

  const add = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
  if (lineId === "ebitda") {
    const [gp, opex] = await Promise.all([monthlySeries(table, year, ["grossProfitAccounts"], territoryKeys, toUsd), monthlySeries(table, year, ["opex"], territoryKeys, toUsd)]);
    return add(gp, opex);
  }
  if (lineId === "ebit") {
    const [ebitda, da] = await Promise.all([monthlyLineSeries(table, year, "ebitda", territoryKeys, toUsd), monthlySeries(table, year, ["depreciationAmortization"], territoryKeys, toUsd)]);
    return add(ebitda, da);
  }
  if (lineId === "pbt") {
    const [ebit, nonop, intexp] = await Promise.all([
      monthlyLineSeries(table, year, "ebit", territoryKeys, toUsd),
      monthlySeries(table, year, ["nonOperating"], territoryKeys, toUsd),
      monthlySeries(table, year, ["interestExpense"], territoryKeys, toUsd),
    ]);
    return add(add(ebit, nonop), intexp);
  }
  return monthlySeries(table, year, ["sales"], territoryKeys, toUsd);
}
