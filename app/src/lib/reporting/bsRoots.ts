import type { DrillFilters } from "../calcEngine/drillDown";

export interface BsRootConfig {
  key: string;
  label: string;
  filters: DrillFilters;
}

/**
 * Balance Sheet top-level sections. Note Chart of Accounts uses the same
 * Class value ("Liabilities and Owners Equity") for both Liabilities and
 * Equity accounts — SubClass is what actually distinguishes them (see
 * data-model.md) — so these roots key off SubClass, not Class.
 */
export const BS_ROOTS: BsRootConfig[] = [
  { key: "assets", label: "Assets", filters: { subClass: "Assets" } },
  { key: "liabilities", label: "Liabilities", filters: { subClass: "Liabilities" } },
  { key: "equity", label: "Owners Equity", filters: { subClass: "Owners Equity" } },
];

export function findBsRoot(key: string | undefined): BsRootConfig | undefined {
  return BS_ROOTS.find((r) => r.key === key);
}
