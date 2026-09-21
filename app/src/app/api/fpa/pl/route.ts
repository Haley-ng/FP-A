import { computeProfitAndLoss, resolvePeriodRange } from "@/lib/db/profitAndLoss";
import { monthlySeries } from "@/lib/db/monthly";
import { drillLevel, glTransactions } from "@/lib/db/drillDown";
import { varPct } from "@/lib/db/variance";
import type { CoaCategory } from "@/lib/db/accountFilters";
import { MONTHS, PL_ACCOUNTS, PL_LINES } from "@/lib/fpa/sampleData";
import type { ProfitAndLossLineId, TerritoryFilter } from "@/lib/fpa/types";

const LINE_CATEGORY: Partial<Record<ProfitAndLossLineId, CoaCategory>> = {
  sales: "sales",
  cos: "costOfSales",
  opex: "opex",
  da: "depreciationAmortization",
  nonop: "nonOperating",
  intexp: "interestExpense",
  tax: "taxation",
};

const FIELD_LABEL: Record<string, string> = {
  class: "Class",
  sub_class: "Account subclass",
  sub_class2: "Account group",
  account: "Account",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const territoryParam = url.searchParams.get("territory") ?? "all";
  const territory: TerritoryFilter = territoryParam === "all" ? "all" : Number(territoryParam);
  const year = Number(url.searchParams.get("year") ?? "2025");
  const period = url.searchParams.get("period") ?? "fy";
  const currency = url.searchParams.get("currency") ?? "usd";
  const lineId = url.searchParams.get("line") as ProfitAndLossLineId | null;
  const account = url.searchParams.get("account");
  // Path is a JSON array of {field, value} pairs already chosen while drilling, e.g. [["sub_class2","Marketing"]].
  const pathParam = url.searchParams.get("path");
  const path: [string, string][] = pathParam ? JSON.parse(pathParam) : [];

  const territoryKeys = territory === "all" ? undefined : [territory as number];
  const single = territory !== "all";
  const toUsd = !single || currency === "usd";
  const scope = { ...resolvePeriodRange(year, period), territoryKeys };

  const stmt = await computeProfitAndLoss(scope, toUsd);
  const plRows = PL_LINES.map((l) => {
    const v = stmt[l.id];
    return {
      id: l.id,
      label: l.label,
      actual: v.actual,
      budget: v.budget,
      varAbs: v.actual - v.budget,
      varPct: varPct(v.actual, v.budget),
      pctSales: stmt.sales.actual !== 0 ? (v.actual / stmt.sales.actual) * 100 : 0,
      headline: !!l.headline,
      drillable: !!l.subs,
    };
  });

  const [ebitdaActual, ebitdaBudget, salesActual, salesBudget] = await Promise.all([
    monthlySeries("gl", year, ["grossProfitAccounts"], territoryKeys, toUsd).then(async (gp) => {
      const opex = await monthlySeries("gl", year, ["opex"], territoryKeys, toUsd);
      return gp.map((v, i) => v + opex[i]);
    }),
    monthlySeries("budget", year, ["grossProfitAccounts"], territoryKeys, toUsd).then(async (gp) => {
      const opex = await monthlySeries("budget", year, ["opex"], territoryKeys, toUsd);
      return gp.map((v, i) => v + opex[i]);
    }),
    monthlySeries("gl", year, ["sales"], territoryKeys, toUsd),
    monthlySeries("budget", year, ["sales"], territoryKeys, toUsd),
  ]);
  const marginTrend = {
    months: MONTHS,
    actualMargin: ebitdaActual.map((v, i) => (salesActual[i] ? (v / salesActual[i]) * 100 : 0)),
    budgetMargin: ebitdaBudget.map((v, i) => (salesBudget[i] ? (v / salesBudget[i]) * 100 : 0)),
  };

  let drill: unknown = null;
  let glRows: unknown[] = [];

  if (lineId) {
    const def = PL_LINES.find((l) => l.id === lineId);
    const category = LINE_CATEGORY[lineId];
    if (account) {
      glRows = await glTransactions(Number(account), scope);
    } else if (category) {
      const appliedFilters = Object.fromEntries(path) as Partial<Record<"class" | "sub_class" | "sub_class2" | "account", string>>;
      const level = await drillLevel(category, appliedFilters, scope, toUsd);
      const lineTotal = stmt[lineId].actual;
      const crumbLabel = path.length ? path[path.length - 1][1] : def?.label;
      drill = {
        groupField: level.field, // null once rows are individual accounts ready for GL
        title: crumbLabel,
        colLabel: level.field ? FIELD_LABEL[level.field] : "Account",
        rows: level.rows.map((r) => ({
          accountKey: r.accountKey,
          label: r.label,
          actual: r.actual,
          budget: r.budget,
          varAbs: r.actual - r.budget,
          varPct: varPct(r.actual, r.budget),
          share: lineTotal !== 0 ? (r.actual / lineTotal) * 100 : 0,
        })),
      };
    }
  }

  return Response.json({ plRows, marginTrend, drill, glRows, accounts: PL_ACCOUNTS });
}
