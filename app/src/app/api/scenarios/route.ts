import { insertScenario } from "@/lib/db/scenarios";
import { requireEditLink, toErrorResponse } from "@/lib/db/writeGuards";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await requireEditLink();
    const scenario = await insertScenario(body);
    return Response.json({ scenario }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
