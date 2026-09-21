import { deleteScenario, updateScenarioLevers } from "@/lib/db/scenarios";
import { requireEditLink, toErrorResponse } from "@/lib/db/writeGuards";

export async function PUT(request: Request, context: RouteContext<"/api/scenarios/[id]">) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    await requireEditLink();
    const scenario = await updateScenarioLevers(id, body);
    return Response.json({ scenario });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/scenarios/[id]">) {
  try {
    const { id } = await context.params;
    await requireEditLink();
    await deleteScenario(id);
    return new Response(null, { status: 200 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
