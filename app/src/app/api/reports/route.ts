import { generateReport } from "@/lib/db/reports";
import { requireEditLink, toErrorResponse } from "@/lib/db/writeGuards";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await requireEditLink();
    const report = await generateReport(body);
    return Response.json({ report }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
