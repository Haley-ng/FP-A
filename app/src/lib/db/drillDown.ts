import { query } from "./client";
import type { Scope } from "./aggregate";
import type { CoaCategory } from "./accountFilters";
import { CATEGORY_SQL } from "./accountFilters";
import type { GlTransaction } from "@/lib/fpa/types";

interface CoaRow {
  account_key: number;
  class: string;
  sub_class: string;
  sub_class2: string;
  account: string;
}

// Same hierarchy order as src/lib/calcEngine/drillDown.ts (SubAccount skipped — it duplicates Account here).
const HIERARCHY_FIELDS = ["class", "sub_class", "sub_class2", "account"] as const;
type HierarchyField = (typeof HIERARCHY_FIELDS)[number];

async function accountsForCategory(category: CoaCategory): Promise<CoaRow[]> {
  return query<CoaRow>(`select account_key, class, sub_class, sub_class2, account from chart_of_accounts coa where ${CATEGORY_SQL[category]}`);
}

async function accountAmounts(table: "gl" | "budget", scope: Scope, accountKeys: number[], toUsd: boolean): Promise<Map<number, number>> {
  if (accountKeys.length === 0) return new Map();
  const rateExpr = toUsd
    ? `* coalesce((select max(cr.exchange_rate) from currency_rate cr where cr.date = t.date and cr.territory_key = t.territory_key), 1)`
    : "";
  const sql = `
    select t.account_key, sum(t.amount ${rateExpr}) as total
    from ${table} t
    where t.date between $1 and $2
      and t.account_key = ANY($3::int[])
      and (t.territory_key = ANY($4::int[]) OR $4::int[] IS NULL)
    group by t.account_key
  `;
  const rows = await query<{ account_key: number; total: string }>(sql, [scope.dateFrom, scope.dateTo, accountKeys, scope.territoryKeys ?? null]);
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.account_key, Number(r.total));
  return map;
}

export interface DrillRow {
  accountKey: number | null;
  label: string;
  actual: number;
  budget: number;
}

export interface DrillResult {
  field: HierarchyField | null; // null when leaf accounts are the result, not another group level
  rows: DrillRow[];
}

/** One level of the P&L drill-down: given a line's Chart-of-Accounts category and any hierarchy filters already chosen, returns either the next group level or the leaf accounts. */
export async function drillLevel(
  category: CoaCategory,
  appliedFilters: Partial<Record<HierarchyField, string>>,
  scope: Scope,
  toUsd: boolean
): Promise<DrillResult> {
  const allAccounts = await accountsForCategory(category);
  const matching = allAccounts.filter((a) => HIERARCHY_FIELDS.every((f) => !appliedFilters[f] || a[f] === appliedFilters[f]));

  for (const field of HIERARCHY_FIELDS) {
    if (appliedFilters[field]) continue;
    const distinct = Array.from(new Set(matching.map((a) => a[field]))).filter(Boolean);
    if (distinct.length <= 1) continue; // trivial level — skip straight to the next field, same as the TS engine

    const keys = matching.map((a) => a.account_key);
    const [actualByKey, budgetByKey] = await Promise.all([
      accountAmounts("gl", scope, keys, toUsd),
      accountAmounts("budget", scope, keys, toUsd),
    ]);
    const rows: DrillRow[] = distinct.map((value) => {
      const memberKeys = matching.filter((a) => a[field] === value).map((a) => a.account_key);
      const actual = memberKeys.reduce((s, k) => s + (actualByKey.get(k) ?? 0), 0);
      const budget = memberKeys.reduce((s, k) => s + (budgetByKey.get(k) ?? 0), 0);
      return { accountKey: null, label: value, actual, budget };
    });
    rows.sort((a, b) => Math.abs(b.actual) - Math.abs(a.actual));
    return { field, rows };
  }

  // No hierarchy field left — leaf accounts.
  const keys = matching.map((a) => a.account_key);
  const [actualByKey, budgetByKey] = await Promise.all([
    accountAmounts("gl", scope, keys, toUsd),
    accountAmounts("budget", scope, keys, toUsd),
  ]);
  const rows: DrillRow[] = matching.map((a) => ({
    accountKey: a.account_key,
    label: a.account,
    actual: actualByKey.get(a.account_key) ?? 0,
    budget: budgetByKey.get(a.account_key) ?? 0,
  }));
  rows.sort((a, b) => Math.abs(b.actual) - Math.abs(a.actual));
  return { field: null, rows };
}

/** Underlying GL transactions for one account within a scope, for the final drill step. */
export async function glTransactions(accountKey: number, scope: Scope): Promise<GlTransaction[]> {
  const sql = `
    select entry_no, date, details, territory_key, account_key, amount
    from gl
    where account_key = $1
      and date between $2 and $3
      and (territory_key = ANY($4::int[]) OR $4::int[] IS NULL)
    order by date, entry_no
    limit 500
  `;
  const rows = await query<{ entry_no: string; date: string; details: string; territory_key: number; account_key: number; amount: string }>(sql, [
    accountKey,
    scope.dateFrom,
    scope.dateTo,
    scope.territoryKeys ?? null,
  ]);
  return rows.map((r) => ({
    entryNo: Number(r.entry_no),
    date: r.date,
    details: r.details,
    territoryKey: r.territory_key,
    accountKey: r.account_key,
    amount: Number(r.amount),
  }));
}
