import { computeProfitAndLoss, resolvePeriodRange } from "@/lib/db/profitAndLoss";
import { applyScenario } from "@/lib/db/scenario";
import { listScenarios } from "@/lib/db/scenarios";
import { varPct } from "@/lib/db/variance";
import { PL_LINES } from "@/lib/fpa/sampleData";
import type { ScenarioLeverValues, TerritoryFilter } from "@/lib/fpa/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const territoryParam = url.searchParams.get("territory") ?? "all";
  const territory: TerritoryFilter = territoryParam === "all" ? "all" : Number(territoryParam);
  const year = Number(url.searchParams.get("year") ?? "2025");
  const currency = url.searchParams.get("currency") ?? "usd";

  const territoryKeys = territory === "all" ? undefined : [territory as number];
  const single = territory !== "all";
  const toUsd = !single || currency === "usd";

  const levers: ScenarioLeverValues = {
    salesGrowth: Number(url.searchParams.get("salesGrowth") ?? "0"),
    priceChange: Number(url.searchParams.get("priceChange") ?? "0"),
    cosRate: Number(url.searchParams.get("cosRate") ?? "0"),
    opexChange: Number(url.searchParams.get("opexChange") ?? "0"),
    headcount: Number(url.searchParams.get("headcount") ?? "0"),
  };

  const base = await computeProfitAndLoss({ ...resolvePeriodRange(year, "fy"), territoryKeys }, toUsd);
  const scenario = applyScenario(base, levers);

  const scenarioRows = PL_LINES.map((l) => {
    const b = base[l.id].actual;
    const s = scenario[l.id].actual;
    return { id: l.id, label: l.label, base: b, scenario: s, delta: s - b, deltaPct: varPct(s, b), headline: !!l.headline };
  });

  const kpis = [
    { label: "Sales", base: base.sales.actual, value: scenario.sales.actual },
    { label: "EBITDA", base: base.ebitda.actual, value: scenario.ebitda.actual },
    { label: "Net Profit", base: base.np.actual, value: scenario.np.actual },
  ].map((k) => ({ ...k, delta: k.value - k.base, deltaPct: varPct(k.value, k.base) }));

  const allScenarios = await listScenarios();
  const savedScenarios = await Promise.all(
    allScenarios.map(async (s) => {
      const savedTerritoryKeys = s.territoryKey === "all" ? undefined : [s.territoryKey as number];
      const savedBase = await computeProfitAndLoss({ ...resolvePeriodRange(s.fiscalYear, "fy"), territoryKeys: savedTerritoryKeys }, true);
      const savedScenario = applyScenario(savedBase, s.levers);
      return { id: s.id, name: s.name, ebitda: savedScenario.ebitda.actual, territoryKey: s.territoryKey, fiscalYear: s.fiscalYear, levers: s.levers };
    })
  );

  return Response.json({ scenarioRows, kpis, savedScenarios });
}
