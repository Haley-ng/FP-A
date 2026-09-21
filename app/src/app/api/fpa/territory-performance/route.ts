import { fxImpact, territoryPerformance } from "@/lib/db/territoryPerformance";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year") ?? "2025");
  const period = url.searchParams.get("period") ?? "fy";

  const rows = await territoryPerformance(year, period);
  const fxRows = await fxImpact(year, period);
  const marginCeiling = Math.max(5, Math.ceil(Math.max(...rows.map((r) => r.marginPct), 0) / 5) * 5);

  return Response.json({ rows, fxRows, marginCeiling });
}
