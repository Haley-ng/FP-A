/**
 * SQL translation of src/lib/calcEngine/accountFilters.ts's CATEGORY predicates.
 * Verified against the real `chart_of_accounts` table loaded in Supabase
 * (see docs/3-plan/dax-to-sql.md) — every string here is a value actually
 * present in the `class` / `sub_class` / `sub_class2` / `account` columns,
 * not guessed from the DAX text alone.
 *
 * These are static, hand-verified constants (not user input), so inlining
 * them into SQL text is safe — no request ever supplies a category string.
 */
export const CATEGORY_SQL = {
  sales: "coa.sub_class = 'Sales'",
  costOfSales: "coa.sub_class = 'Cost of Sales'",
  grossProfitAccounts: "coa.class = 'Trading account'",
  opex: "coa.sub_class = 'Operating Expenses'",
  depreciationAmortization: "coa.sub_class = 'Depreciation & Amortization'",
  operatingAccounts: "coa.class = 'Operating account'",
  nonOperating: "coa.class = 'Non-operating'",
  interestExpense: "coa.sub_class = 'Interest Expense'",
  taxation: "coa.sub_class = 'Taxation'",
  profitAndLoss: "coa.report = 'profit_and_loss'",
  balanceSheet: "coa.report = 'balance_sheet'",
  currentAssets: "coa.sub_class2 = 'Current Assets'",
  currentLiabilities: "coa.sub_class2 = 'Current Liabilities'",
  nonCurrentAssets: "coa.sub_class2 = 'Non-Current Assets'",
  longTermLiabilities: "coa.sub_class2 = 'Long Term Liabilities'",
  shareCapital: "coa.sub_class2 = 'Share Capital'",
  sharePremium: "coa.sub_class2 = 'Share Premium'",
  retainedEarnings: "coa.sub_class2 = 'Retained Earnings'",
  totalAssets: "coa.class = 'Assets'",
  totalDebt: "coa.sub_class = 'Liabilities'",
  totalEquity: "coa.sub_class = 'Owners Equity'",
  inventory: "coa.account = 'Inventory'",
  receivables: "coa.account = 'Receivables'",
  payables: "coa.account = 'Trade Payables'",
  /**
   * KNOWN SOURCE INCONSISTENCY (see data-model.md / accountFilters.ts): the
   * "Interest & Tax" DAX measure filters SubClass = "Interest & Tax", but no
   * account has that SubClass — it's the *Class*. Using the Class filter
   * here, as the already-validated TS engine does. Not used by the new
   * 12-line P&L (which splits Interest Expense and Taxation), kept only for
   * parity with the old measure if ever needed.
   */
  interestAndTaxClass: "coa.class = 'Interest & Tax'",
} as const;

export type CoaCategory = keyof typeof CATEGORY_SQL;
