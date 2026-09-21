import { WriteGuardError, requireEditLink, toErrorResponse } from "@/lib/db/writeGuards";
import { KNOWN_DATASET_IDS } from "@/lib/db/dataLibrary";

/**
 * Upload a new source file (sequence.md #9) — genuinely blocked, not a stub
 * left unfinished by oversight. sequence.md's own diagram calls for two
 * things this project doesn't have yet:
 *   1. A real Google Drive shared folder + service account to write the
 *      uploaded file into (CLAUDE.md "Current stage" — the source data was
 *      loaded into Supabase directly; there's no live Drive folder this app
 *      reads from or writes to).
 *   2. An agreed strategy for replacing a live table's contents from a
 *      re-parsed file (truncate-and-reload? diff-and-upsert? what happens to
 *      rows referenced by scenarios/reports while that runs?) — overwriting
 *      GL/Budget/etc. live is a destructive, hard-to-reverse operation this
 *      hasn't been asked for or reviewed, so it isn't something to guess at.
 * Returns 501 unconditionally, after the checks that don't depend on either
 * of those (edit-link, dataset exists) — same shape as the DELETE→INSERT→
 * UPDATE flow errors out for actions 6 and 10 in sequence.md until their own
 * missing pieces are decided.
 */
export async function POST(request: Request, context: RouteContext<"/api/data-library/[dataset]/upload">) {
  try {
    const { dataset } = await context.params;
    const form = await request.formData();
    await requireEditLink();
    if (!KNOWN_DATASET_IDS.includes(dataset)) {
      throw new WriteGuardError(400, "dataset_name does not exist");
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new WriteGuardError(400, "a file is required");
    }
    return Response.json(
      { error: "Upload is not implemented: no Google Drive folder is configured, and no table-replacement strategy has been agreed for this dataset." },
      { status: 501 }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
