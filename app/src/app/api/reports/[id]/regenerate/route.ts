import { regenerateReport } from "@/lib/db/reports";
import { requireEditLink, toErrorResponse } from "@/lib/db/writeGuards";

export async function POST(request: Request, context: RouteContext<"/api/reports/[id]/regenerate">) {
  try {
    const { id } = await context.params;
    await requireEditLink();
    const report = await regenerateReport(id);
    return Response.json({ report }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
