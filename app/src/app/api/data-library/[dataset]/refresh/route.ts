import { refreshDataset } from "@/lib/db/dataLibrary";
import { requireEditLink, toErrorResponse } from "@/lib/db/writeGuards";

/** Manual "Refresh Now" (sequence.md #7) — edit-link only. */
export async function POST(request: Request, context: RouteContext<"/api/data-library/[dataset]/refresh">) {
  try {
    const { dataset } = await context.params;
    await requireEditLink();
    const result = await refreshDataset(dataset);
    return Response.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
