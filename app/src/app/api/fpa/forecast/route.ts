import { forecastRows } from "@/lib/db/forecast";
import { MONTHS } from "@/lib/fpa/sampleData";
import type { ForecastDriverValues, ForecastMethod, TerritoryFilter } from "@/lib/fpa/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const territoryParam = url.searchParams.get("territory") ?? "all";
  const territory: TerritoryFilter = territoryParam === "all" ? "all" : Number(territoryParam);
  const year = Number(url.searchParams.get("year") ?? "2025");
  const currency = url.searchParams.get("currency") ?? "usd";
  const cutover = Number(url.searchParams.get("cutover") ?? "7");
  const method = (url.searchParams.get("method") ?? "budget") as ForecastMethod;

  const territoryKeys = territory === "all" ? undefined : [territory as number];
  const single = territory !== "all";
  const toUsd = !single || currency === "usd";

  const drivers: ForecastDriverValues = {
    salesDriver: Number(url.searchParams.get("salesDriver") ?? "0"),
    cosDriver: Number(url.searchParams.get("cosDriver") ?? "0"),
    opexDriver: Number(url.searchParams.get("opexDriver") ?? "0"),
  };

  const rows = await forecastRows(year, territoryKeys, toUsd, cutover, method, drivers);
  const ebitdaRow = rows.find((r) => r.lineId === "ebitda")!;
  const salesRow = rows.find((r) => r.lineId === "sales")!;
  const cosRow = rows.find((r) => r.lineId === "cos")!;
  const opexRow = rows.find((r) => r.lineId === "opex")!;

  const bridge = [
    { label: "Budget EBITDA", value: ebitdaRow.budget },
    { label: "Sales vs budget", value: salesRow.total - salesRow.budget },
    { label: "Cost of sales vs budget", value: cosRow.total - cosRow.budget },
    { label: "Opex vs budget", value: opexRow.total - opexRow.budget },
    { label: "Forecast EBITDA", value: ebitdaRow.total },
  ];

  const monthOptions = MONTHS.map((m, i) => ({ value: String(i + 1), label: `${m} (month ${i + 1})` }));

  return Response.json({ rows, bridge, monthOptions, months: MONTHS });
}
