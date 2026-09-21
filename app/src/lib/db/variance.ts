import { computeProfitAndLoss } from "./profitAndLoss";
import { resolvePeriodRange } from "./aggregate";
import { query } from "./client";
import type { ProfitAndLossLineId, VarianceRow } from "@/lib/fpa/types";
import { PL_LINES } from "@/lib/fpa/sampleData";

export function varPct(actual: number, budget: number): number | null {
  if (budget === 0) return null;
  return ((actual - budget) / Math.abs(budget)) * 100;
}

const RANKED_LINES: ProfitAndLossLineId[] = ["sales", "gp", "opex", "ebitda", "da", "ebit", "nonop", "intexp", "pbt", "tax", "np"];

/** Every territory × P&L-line combination, ranked by absolute USD variance (always USD, all territories — design.md §3 screen 6). */
export async function varianceRanking(lineFilter: ProfitAndLossLineId | "all", year: number, period: string): Promise<VarianceRow[]> {
  const { dateFrom, dateTo } = resolvePeriodRange(year, period);
  const territories = await query<{ territory_key: number; country: string }>("select territory_key, country from territory order by territory_key");
  const lines = lineFilter === "all" ? RANKED_LINES : [lineFilter];

  const rows: VarianceRow[] = [];
  for (const t of territories) {
    const stmt = await computeProfitAndLoss({ dateFrom, dateTo, territoryKeys: [t.territory_key] }, true);
    for (const lineId of lines) {
      const v = stmt[lineId];
      const def = PL_LINES.find((l) => l.id === lineId)!;
      rows.push({
        rank: 0,
        territoryKey: t.territory_key,
        territoryName: t.country,
        lineId,
        lineLabel: lineFilter === "all" ? `${t.country} · ${def.label}` : t.country,
        actual: v.actual,
        budget: v.budget,
        varAbs: v.actual - v.budget,
        varPct: varPct(v.actual, v.budget),
      });
    }
  }
  rows.sort((a, b) => Math.abs(b.varAbs) - Math.abs(a.varAbs));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
