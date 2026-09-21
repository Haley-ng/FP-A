import { KNOWN_DATASET_IDS, refreshDataset } from "@/lib/db/dataLibrary";

/**
 * Scheduled automatic refresh (sequence.md #8). The caller here is a
 * scheduler, not a person — no linkMode/edit-link check applies (per the
 * diagram's own "User is a Scheduler (system job), not a person" note).
 *
 * There is no cron actually configured to call this in this project yet —
 * see vercel.json for the schedule this would run on if deployed to Vercel,
 * and CLAUDE.md's "Current stage" for why (no scheduling infra decided).
 * If CRON_SECRET is set in the environment, requests must present it as
 * `Authorization: Bearer <CRON_SECRET>` (Vercel Cron does this automatically
 * for a deployed project); if it isn't set, the check is skipped rather than
 * locking the route out entirely with no secret configured to unlock it.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const results = await Promise.all(
    KNOWN_DATASET_IDS.map(async (id) => {
      try {
        const { dataset } = await refreshDataset(id);
        return { id, ok: true, validationStatus: dataset.validationStatus, rowCount: dataset.rowCount };
      } catch (err) {
        return { id, ok: false, error: err instanceof Error ? err.message : "unknown error" };
      }
    })
  );

  return Response.json({ refreshed: results });
}
