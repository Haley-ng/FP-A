import { computeProfitAndLoss, resolvePeriodRange } from "@/lib/db/profitAndLoss";
import { varPct } from "@/lib/db/variance";
import { PL_LINES } from "@/lib/fpa/sampleData";
import type { TerritoryFilter } from "@/lib/fpa/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const territoryParam = url.searchParams.get("territory") ?? "all";
  const territory: TerritoryFilter = territoryParam === "all" ? "all" : Number(territoryParam);
  const year = Number(url.searchParams.get("year") ?? "2025");
  const period = url.searchParams.get("period") ?? "fy";
  const currency = url.searchParams.get("currency") ?? "usd";

  const territoryKeys = territory === "all" ? undefined : [territory as number];
  const single = territory !== "all";
  const toUsd = !single || currency === "usd";

  const stmt = await computeProfitAndLoss({ ...resolvePeriodRange(year, period), territoryKeys }, toUsd);
  const plRows = PL_LINES.map((l) => {
    const v = stmt[l.id];
    return {
      id: l.id,
      label: l.label,
      actual: v.actual,
      budget: v.budget,
      varAbs: v.actual - v.budget,
      varPct: varPct(v.actual, v.budget),
      headline: !!l.headline,
      drillable: !!l.subs,
    };
  });

  const focusLine = plRows.reduce((max, r) => (Math.abs(r.varAbs) > Math.abs(max.varAbs) ? r : max), plRows[0]);

  return Response.json({ plRows, focusLine });
}
