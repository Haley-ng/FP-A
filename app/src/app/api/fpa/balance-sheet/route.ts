import { computeBalanceSheet } from "@/lib/db/balanceSheet";
import type { TerritoryFilter } from "@/lib/fpa/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const territoryParam = url.searchParams.get("territory") ?? "all";
  const territory: TerritoryFilter = territoryParam === "all" ? "all" : Number(territoryParam);
  const year = Number(url.searchParams.get("year") ?? "2025");
  const currency = url.searchParams.get("currency") ?? "usd";

  const territoryKeys = territory === "all" ? undefined : [territory as number];
  const toUsd = territory === "all" || currency === "usd";

  const result = await computeBalanceSheet(year, territoryKeys, toUsd);
  return Response.json(result);
}
