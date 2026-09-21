// Types mirroring the verified schema in docs/3-plan/data-model.md.
// Keep field names close to the source workbooks so a discrepancy is easy to spot.

export interface GlEntry {
  entryNo: string;
  date: Date;
  territoryKey: number;
  accountKey: number;
  details: string;
  amount: number;
}

export interface BudgetEntry {
  entryNo: string;
  date: Date;
  territoryKey: number;
  accountKey: number;
  details: string;
  amount: number;
  type: string;
}

export interface TrialBalanceEntry {
  date: Date;
  territoryKey: number;
  accountKey: number;
  amount: number;
}

export interface ChartOfAccount {
  accountKey: number;
  report: string; // "Profit and Loss" | "Balance Sheet" | "Adjusting"
  class: string;
  classSorting: number;
  subClass: string;
  subClassSorting: number;
  subClass2: string;
  subClass2Sorting: number;
  account: string;
  accountSorting: number;
  subAccount: string;
}

export interface CurrencyRate {
  date: Date;
  currency: string;
  exchangeRate: number;
  territoryKey: number;
}

export interface Territory {
  territoryKey: number;
  country: string;
  region: string;
}

export interface CashFlowMapping {
  type: string;
  subtype: string;
  account: string;
  subAccount: string;
  valueType: string;
  accountKey: number;
  sortOnType: number;
  sortOnSubType: number;
}

export interface SoceMapping {
  type: string;
  account: string;
  balanceType: string;
  accountKey: number;
  sortByType: number;
  sortByAccount: number;
}

export interface CalendarDay {
  date: Date;
  year: number;
  quarter: string;
  month: string;
  day: string;
}

export type DatasetName =
  | "GL"
  | "Budget"
  | "TrialBalance"
  | "ChartOfAccounts"
  | "Currency"
  | "Territory"
  | "CashFlowMapping"
  | "SoCE"
  | "Calendar";

export interface ValidationIssue {
  severity: "error" | "warning";
  rowRef: string; // best-effort locator, e.g. "row 7365"
  message: string;
}

export interface DatasetSyncStatus {
  dataset: DatasetName;
  lastRefreshedAt: string; // ISO timestamp
  rowCount: number;
  status: "pass" | "fail";
  issues: ValidationIssue[];
}

export interface ParsedFinanceData {
  gl: GlEntry[];
  budget: BudgetEntry[];
  trialBalance: TrialBalanceEntry[];
  chartOfAccounts: ChartOfAccount[];
  currencyRates: CurrencyRate[];
  territories: Territory[];
  cashFlowMapping: CashFlowMapping[];
  soce: SoceMapping[];
  calendar: CalendarDay[];
}
