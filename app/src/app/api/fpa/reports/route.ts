import { buildReportBlocks } from "@/lib/db/reports";
import { REPORT_SECTIONS, REPORT_TYPES } from "@/lib/fpa/sampleData";
import type { ReportSectionId, TerritoryFilter } from "@/lib/fpa/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const territoryParam = url.searchParams.get("territory") ?? "all";
  const territory: TerritoryFilter = territoryParam === "all" ? "all" : Number(territoryParam);
  const year = Number(url.searchParams.get("year") ?? "2025");
  const period = url.searchParams.get("period") ?? "fy";
  const currency = url.searchParams.get("currency") ?? "usd";
  const sectionsParam = url.searchParams.get("sections") ?? "kpi_summary,profit_and_loss";
  const sections = sectionsParam.split(",").filter(Boolean) as ReportSectionId[];

  const single = territory !== "all";
  const toUsd = !single || currency === "usd";

  const blocks = await buildReportBlocks(sections, territory, year, period, toUsd);

  return Response.json({ blocks, sectionDefs: REPORT_SECTIONS, reportTypes: REPORT_TYPES });
}
