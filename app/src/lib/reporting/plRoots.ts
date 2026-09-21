import type { DrillFilters } from "../calcEngine/drillDown";

export interface PlRootConfig {
  key: string;
  label: string;
  filters: DrillFilters;
}

/**
 * The P&L lines a user can drill into. EBITDA/Gross Profit/Operating
 * Profit/PBIT/Net Profit are subtotals of these, not single Chart of
 * Accounts categories, so they aren't drill roots themselves — matching the
 * concrete example in fp&awepapp_userflow.md: "EBITDA → OPEX → Marketing →
 * Advertisements" starts the actual drill at Opex, not at EBITDA itself.
 */
export const PL_ROOTS: PlRootConfig[] = [
  { key: "sales", label: "Sales", filters: { subClass: "Sales" } },
  { key: "cogs", label: "Cost of Sales", filters: { subClass: "Cost of Sales" } },
  { key: "opex", label: "Operating Expenses (Opex)", filters: { subClass: "Operating Expenses" } },
  { key: "da", label: "Depreciation & Amortization", filters: { subClass: "Depreciation & Amortization" } },
  { key: "nonoperating", label: "Non-operating Income/Expense", filters: { class: "Non-operating" } },
  { key: "interesttax", label: "Interest & Tax", filters: { class: "Interest & Tax" } },
];

export function findPlRoot(key: string | undefined): PlRootConfig | undefined {
  return PL_ROOTS.find((r) => r.key === key);
}
