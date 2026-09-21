import { listForecastVersions, saveForecastVersion } from "@/lib/db/forecastVersions";
import { requireEditLink, toErrorResponse } from "@/lib/db/writeGuards";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await requireEditLink();
    const version = await saveForecastVersion(body);
    return Response.json({ version }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const territoryKey = Number(url.searchParams.get("territory"));
    const fiscalYear = Number(url.searchParams.get("year"));
    if (!Number.isInteger(territoryKey) || !Number.isInteger(fiscalYear)) {
      return Response.json({ error: "territory and year are required" }, { status: 400 });
    }
    const versions = await listForecastVersions(territoryKey, fiscalYear);
    return Response.json({ versions });
  } catch (err) {
    return toErrorResponse(err);
  }
}
