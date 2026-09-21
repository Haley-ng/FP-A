import { generateCommentary, type CommentaryRequest } from "@/lib/ai/commentary";

export async function POST(request: Request) {
  let body: CommentaryRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body?.title || !body?.focus || !Array.isArray(body?.fullPl)) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  const result = await generateCommentary(body);
  if ("error" in result) {
    return Response.json(result, { status: 200 }); // a graceful "unavailable" state, not a server error
  }
  return Response.json(result);
}
