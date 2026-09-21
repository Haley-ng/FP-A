import { requireEditLink, toErrorResponse } from "@/lib/db/writeGuards";

/**
 * "Save analysis" / "Export" (sequence.md #10) — genuinely blocked, not an
 * oversight. sequence.md itself marks this a gap: no destination table or
 * export format has ever been decided (sitemap.md's Known Gaps says the same
 * — "drawn but not wired to real output yet"). Unlike action #6 (Save a
 * Forecast Version), where sequence.md's own INSERT payload names concrete
 * fields to build a table from, this action has no such spec to build
 * against — inventing one now would be guessing at a decision that's the
 * user's to make, not filling in a documented gap. Returns 501 after the one
 * check that doesn't depend on that decision (edit-link).
 */
export async function POST() {
  try {
    await requireEditLink();
    return Response.json(
      { error: "Not implemented: no destination table or export format has been decided for Variance Analysis save/export yet." },
      { status: 501 }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
