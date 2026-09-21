import { varianceRanking } from "@/lib/db/variance";
import { drillLevel } from "@/lib/db/drillDown";
import { resolvePeriodRange } from "@/lib/db/aggregate";
import type { CoaCategory } from "@/lib/db/accountFilters";
import { PL_LINES } from "@/lib/fpa/sampleData";
import type { ProfitAndLossLineId } from "@/lib/fpa/types";

const LINE_CATEGORY: Partial<Record<ProfitAndLossLineId, CoaCategory>> = {
  sales: "sales",
  cos: "costOfSales",
  opex: "opex",
  da: "depreciationAmortization",
  nonop: "nonOperating",
  intexp: "interestExpense",
  tax: "taxation",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year") ?? "2025");
  const period = url.searchParams.get("period") ?? "fy";
  const line = (url.searchParams.get("line") ?? "all") as ProfitAndLossLineId | "all";
  const selectedIndex = url.searchParams.get("selected");

  const rows = await varianceRanking(line, year, period);
  const lineOptions = [{ id: "all", label: "All lines × territories" }, ...PL_LINES.map((l) => ({ id: l.id, label: l.label }))];

  let bridge: unknown = null;
  if (selectedIndex != null) {
    const idx = Number(selectedIndex);
    const row = rows[idx];
    const category = row ? LINE_CATEGORY[row.lineId] : undefined;
    if (row && category) {
      const scope = { ...resolvePeriodRange(year, period), territoryKeys: [row.territoryKey] };
      const level = await drillLevel(category, {}, scope, true);
      const items = level.rows
        .map((r) => ({ label: r.label, value: r.actual - r.budget }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      const top = items.slice(0, 4);
      const otherValue = items.slice(4).reduce((s, r) => s + r.value, 0);
      bridge = { row, items: items.length > 4 ? [...top, { label: "Other accounts", value: otherValue }] : top };
    } else if (row) {
      bridge = { row, items: [] };
    }
  }

  return Response.json({ rows, lineOptions, bridge });
}
