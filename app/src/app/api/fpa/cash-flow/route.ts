import { computeCashFlow } from "@/lib/db/cashFlow";
import { resolvePeriodRange } from "@/lib/db/aggregate";
import { monthlyCashBalance } from "@/lib/db/monthly";
import { MONTHS } from "@/lib/fpa/sampleData";
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
  const scope = { ...resolvePeriodRange(year, period), territoryKeys };

  const [{ lines, reconciliationGap }, monthlyCash] = await Promise.all([computeCashFlow(scope, toUsd), monthlyCashBalance(year, territoryKeys)]);

  const operating = lines.find((l) => l.label === "Net Cash from Operating Activities")?.value ?? 0;
  const investing = lines.find((l) => l.label === "Net Cash from Investing Activities")?.value ?? 0;
  const netMovement = lines.find((l) => l.label === "Net Movement in Cash")?.value ?? 0;
  const closingCash = lines.find((l) => l.label === "Cash at End of Period")?.value ?? 0;

  const kpis = [
    { label: "Operating Cash Flow", value: operating },
    { label: "Free Cash Flow", value: operating + investing },
    { label: "Net Movement", value: netMovement },
    { label: "Closing Cash", value: closingCash },
  ];

  return Response.json({ kpis, lines, monthlyCash, months: MONTHS, reconciliationGap });
}
