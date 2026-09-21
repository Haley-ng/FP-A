import type { GlEntry, ChartOfAccount, ValidationIssue } from "../types";

/**
 * Checks that every Account_key referenced by a dataset exists in Chart of
 * Accounts — the join key everything (GL, Budget, TB, the two statement
 * bridges) depends on. An unmapped key means a transaction/mapping the
 * calculation engine will silently drop.
 */
export function findUnmappedAccountKeys(
  datasetLabel: string,
  entries: Array<{ accountKey: number }>,
  chartOfAccounts: ChartOfAccount[],
): ValidationIssue[] {
  const known = new Set(chartOfAccounts.map((a) => a.accountKey));
  const unmapped = new Set<number>();
  for (const e of entries) {
    if (!known.has(e.accountKey)) unmapped.add(e.accountKey);
  }
  return Array.from(unmapped)
    .sort((a, b) => a - b)
    .map((key) => ({
      severity: "error" as const,
      rowRef: `${datasetLabel} Account_key ${key}`,
      message: `Account_key ${key} used in ${datasetLabel} has no matching row in Chart of Accounts`,
    }));
}

/**
 * GL.EntryNo repeats across territories by design (the same journal-entry
 * template/numbering is applied per territory — verified: every EntryNo
 * appears at most once per territory in clean data). A true duplicate is the
 * same EntryNo *within the same territory*.
 */
export function findDuplicateGlEntries(gl: GlEntry[]): ValidationIssue[] {
  const seen = new Map<string, number>();
  for (const e of gl) {
    const key = `${e.entryNo}|${e.territoryKey}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return Array.from(seen.entries())
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [entryNo, territoryKey] = key.split("|");
      return {
        severity: "warning" as const,
        rowRef: `GL EntryNo ${entryNo}, Territory ${territoryKey}`,
        message: `EntryNo "${entryNo}" appears ${count} times within Territory ${territoryKey}`,
      };
    });
}
