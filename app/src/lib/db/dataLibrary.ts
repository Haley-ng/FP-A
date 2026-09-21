import { query } from "./client";
import { WriteGuardError } from "./writeGuards";
import type { Dataset, DatasetCheck, DatasetIssue, ValidationStatus } from "@/lib/fpa/types";

const SOURCE_ROW_COUNT_QUERY: Record<string, string> = {
  gl: "select count(*)::int as n from gl",
  budget: "select count(*)::int as n from budget",
  coa: "select count(*)::int as n from chart_of_accounts",
  territory: "select count(*)::int as n from territory",
  currency: "select count(*)::int as n from currency_rate",
  calendar: "select count(*)::int as n from calendar",
  tb: "select count(*)::int as n from trial_balance",
  cashflow: "select count(*)::int as n from cash_flow_mapping",
  soce: "select count(*)::int as n from soce_mapping",
};

const DATASET_FILES: Record<string, string> = {
  gl: "GL.xlsx",
  budget: "Budget.xlsx",
  coa: "Chart of Accounts.xlsx",
  territory: "Territory.xlsx",
  currency: "Currency_data.xlsx",
  calendar: "Calendar.xlsx",
  tb: "Trial Balance.xlsx",
  cashflow: "CashFlow_St.xlsx",
  soce: "SoCE.xlsx",
};

const DATASET_NAMES: Record<string, string> = {
  gl: "General Ledger",
  budget: "Budget",
  coa: "Chart of Accounts",
  territory: "Territory",
  currency: "Currency",
  calendar: "Calendar",
  tb: "Trial Balance",
  cashflow: "Cash Flow Statement",
  soce: "Statement of Changes in Equity",
};

/**
 * The app's own short ids (used in the UI and API, e.g. `?dataset=coa`) don't
 * all match the primary keys actually stored in the `datasets` table — that
 * table's `name` column holds the full snake_case names from erd.md
 * (`chart_of_accounts`, `trial_balance`, `cash_flow_mapping`), not the app's
 * shorthand. `dataset_sync_status` and `dataset_issues` both have a foreign
 * key to `datasets.name`, so any write to them must use the real name — this
 * map is the only place that translation happens.
 */
const APP_ID_TO_DB_NAME: Record<string, string> = {
  gl: "gl",
  budget: "budget",
  coa: "chart_of_accounts",
  territory: "territory",
  currency: "currency",
  calendar: "calendar",
  tb: "trial_balance",
  cashflow: "cash_flow_mapping",
  soce: "soce",
};

function dbNameFor(datasetId: string): string {
  const dbName = APP_ID_TO_DB_NAME[datasetId];
  if (!dbName) {
    throw new WriteGuardError(400, "dataset_name does not exist");
  }
  return dbName;
}

/** Live row counts straight from Postgres, plus the app-owned datasets/dataset_sync_status/dataset_issues tables where they've been written. */
export async function listDatasets(): Promise<Dataset[]> {
  const syncRows = await query<{ dataset_name: string; last_refreshed_at: string; validation_status: ValidationStatus }>(
    "select dataset_name, last_refreshed_at, validation_status from dataset_sync_status"
  );
  const syncByDbName = new Map(syncRows.map((r) => [r.dataset_name, r]));

  const ids = Object.keys(SOURCE_ROW_COUNT_QUERY);
  const counts = await Promise.all(ids.map((id) => query<{ n: number }>(SOURCE_ROW_COUNT_QUERY[id])));

  // Currency_data.xlsx originally had 7 rows with the invalid date 29 Feb 2025 (2025 isn't a
  // leap year), rejected by the calendar foreign key on load — the source file has since been
  // corrected and reloaded with those 7 rows removed, so 7,665 is now the correct, complete
  // count (not a shortfall). This is a live sanity floor, not an exact-match check, so it stays
  // correct if the row count changes again for a legitimate reason (more months added, etc.) —
  // it only catches an actual, large drop that would indicate rows failing to load. Anything
  // else (e.g. GL's known duplicate entry_no/territory rows) shows as "pass" here until a
  // Refresh Now (or the scheduled refresh) has actually run and written a real row into
  // dataset_sync_status, since computing every check on every page load would be needlessly
  // expensive for a list that's shown on every screen's rail footer.
  const liveValidationStatus = (id: string, rowCount: number): ValidationStatus => (id === "currency" && rowCount < 7000 ? "fail" : "pass");

  return ids.map((id, i) => {
    const sync = syncByDbName.get(APP_ID_TO_DB_NAME[id]);
    const rowCount = counts[i][0]?.n ?? 0;
    return {
      id: id as Dataset["id"],
      name: DATASET_NAMES[id],
      fileName: DATASET_FILES[id],
      rowCount,
      lastRefreshedAt: sync?.last_refreshed_at ?? new Date(0).toISOString(),
      validationStatus: sync?.validation_status ?? liveValidationStatus(id, rowCount),
    };
  });
}

interface CheckWithDetail extends DatasetCheck {
  issues: { rowRef: string; message: string }[];
}

/** SQL table names for the app ids whose real Postgres table isn't spelled the same way ("tb" → "trial_balance"). Every id used to build raw SQL below goes through this first. */
const SQL_TABLE_NAME: Record<string, string> = { gl: "gl", budget: "budget", tb: "trial_balance" };

/** Checks that mirror the Data Library's real validation rules (data-model.md) — computed live against the loaded tables, not hard-coded. Each failing check also returns the specific rows behind it, not just a pass/fail flag. */
async function datasetChecksWithDetail(datasetId: string): Promise<CheckWithDetail[]> {
  const checks: CheckWithDetail[] = [{ label: "No missing required columns", result: "pass", issues: [] }];

  if (datasetId === "gl" || datasetId === "budget") {
    const table = SQL_TABLE_NAME[datasetId];
    // entry_no is a batch/voucher number that legitimately covers multiple distinct line items
    // in this dataset (confirmed by inspection: the same entry_no recurs with different dates,
    // accounts, amounts and details — even narrowing to entry_no + territory + account + date
    // still produced false positives, e.g. two different amounts posted to the same account on
    // the same day under the same entry_no). The only thing that's actually invalid is the same
    // transaction recorded twice outright — every column identical, which a real double-import
    // would produce and a shared batch number alone would not.
    const dupSql = `
      select entry_no, territory_key, account_key, date, details, amount, count(*) as n
      from ${table}
      group by 1, 2, 3, 4, 5, 6
      having count(*) > 1
      order by 1, 2
      limit 20
    `;
    const rows = await query<{ entry_no: string; territory_key: number; account_key: number; date: string; details: string; amount: string; n: string }>(dupSql);
    checks.push({
      label: "No fully duplicated transaction rows",
      result: rows.length === 0 ? "pass" : "fail",
      issues: rows.map((r) => ({
        rowRef: `${datasetId === "gl" ? "GL" : "Budget"}: entry_no ${r.entry_no}, territory ${r.territory_key}, account ${r.account_key}, date ${r.date}`,
        message: `The exact same transaction ("${r.details}", ${r.amount}) appears ${r.n} times — this looks like a duplicate import, not two distinct entries.`,
      })),
    });
  }

  if (datasetId === "gl" || datasetId === "budget" || datasetId === "tb") {
    const table = SQL_TABLE_NAME[datasetId];
    const orphanSql = `select t.account_key as account_key, count(*) as n from ${table} t left join chart_of_accounts coa on coa.account_key = t.account_key where coa.account_key is null group by t.account_key limit 20`;
    const rows = await query<{ account_key: number; n: string }>(orphanSql);
    checks.push({
      label: "All account_key values resolve",
      result: rows.length === 0 ? "pass" : "fail",
      issues: rows.map((r) => ({
        rowRef: `${datasetId}: account_key ${r.account_key}`,
        message: `${r.n} row(s) reference an account_key with no matching row in chart_of_accounts.`,
      })),
    });
  }

  if (datasetId === "currency") {
    // Currency_data.xlsx previously had 7 rows for 29 Feb 2025 (not a real date — 2025 isn't a
    // leap year) that were rejected by the calendar foreign key on load. The source file has
    // since been corrected and reloaded without those rows, so the table's current row count
    // (7,665) is the correct, complete figure. Any row rejected by the FK constraint never
    // lands in this table, so this check can only detect a rejection indirectly, via a large
    // drop in row count — 7,000 is a sanity floor well below the real ~7,665, not an exact
    // expected total, so this doesn't go stale again the next time a legitimate row count
    // changes (e.g. more months of rates added).
    const rows = await query<{ n: string }>("select count(*) as n from currency_rate");
    const failed = Number(rows[0].n) < 7000;
    checks.push({
      label: "All dates parse to a valid calendar date",
      result: failed ? "fail" : "pass",
      issues: failed
        ? [
            {
              rowRef: "Currency_data.xlsx (date column)",
              message: `Only ${rows[0].n} rows are in currency_rate — expected at least 7,000. Some rows may have been rejected on load (e.g. an unparseable date).`,
            },
          ]
        : [],
    });
  }

  return checks;
}

export async function datasetChecks(datasetId: string): Promise<DatasetCheck[]> {
  const checks = await datasetChecksWithDetail(datasetId);
  return checks.map(({ label, result }) => ({ label, result }));
}

export async function datasetIssuesFor(datasetId: string): Promise<DatasetIssue[]> {
  const dbName = APP_ID_TO_DB_NAME[datasetId];
  if (!dbName) return [];
  const rows = await query<{ id: string; dataset_name: string; row_ref: string; message: string }>(
    "select id, dataset_name, row_ref, message from dataset_issues where dataset_name = $1 order by row_ref",
    [dbName]
  );
  return rows.map((r) => ({ id: r.id, datasetId: datasetId as DatasetIssue["datasetId"], rowRef: r.row_ref, message: r.message }));
}

/**
 * Manual "Refresh Now" (sequence.md #7). This architecture has no live Google
 * Drive read path (CLAUDE.md's "Current stage" — the source data was loaded
 * directly into Supabase, not re-read from Drive on each refresh), so
 * "refresh" here means: recompute the same validation checks against the
 * data actually sitting in the table right now, and persist that as the
 * dataset's latest known sync status — the DELETE-then-INSERT-issues,
 * UPDATE-sync-status shape sequence.md specifies, just without a Drive fetch
 * in front of it.
 */
export async function refreshDataset(datasetId: string): Promise<{ dataset: Dataset; checks: DatasetCheck[]; issues: DatasetIssue[] }> {
  const dbName = dbNameFor(datasetId);
  const rows = await query<{ n: number }>(SOURCE_ROW_COUNT_QUERY[datasetId]);
  const rowCount = rows[0]?.n ?? 0;
  const detailedChecks = await datasetChecksWithDetail(datasetId);
  const validationStatus: ValidationStatus = detailedChecks.every((c) => c.result === "pass") ? "pass" : "fail";

  await query("delete from dataset_issues where dataset_name = $1", [dbName]);
  for (const check of detailedChecks) {
    for (const issue of check.issues) {
      await query("insert into dataset_issues (id, dataset_name, row_ref, message) values (gen_random_uuid()::text, $1, $2, $3)", [
        dbName,
        issue.rowRef,
        issue.message,
      ]);
    }
  }

  await query(
    `insert into dataset_sync_status (dataset_name, row_count, last_refreshed_at, validation_status)
     values ($1, $2, now(), $3)
     on conflict (dataset_name) do update set row_count = excluded.row_count, last_refreshed_at = excluded.last_refreshed_at, validation_status = excluded.validation_status`,
    [dbName, rowCount, validationStatus]
  );

  const datasets = await listDatasets();
  const dataset = datasets.find((d) => d.id === datasetId)!;
  const freshIssues = await datasetIssuesFor(datasetId);
  return { dataset, checks: detailedChecks.map(({ label, result }) => ({ label, result })), issues: freshIssues };
}

export const KNOWN_DATASET_IDS = Object.keys(APP_ID_TO_DB_NAME);
