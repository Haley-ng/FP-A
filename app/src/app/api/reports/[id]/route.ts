import { getReportById } from "@/lib/db/reports";
import { toErrorResponse } from "@/lib/db/writeGuards";

export async function GET(_request: Request, context: RouteContext<"/api/reports/[id]">) {
  try {
    const { id } = await context.params;
    const report = await getReportById(id);
    return Response.json({ report });
  } catch (err) {
    return toErrorResponse(err);
  }
}
