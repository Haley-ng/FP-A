import type { ChartOfAccount } from "../types";

/** Builds the set of Account_key values matching a Chart of Accounts predicate. */
export function accountKeysWhere(
  coa: ChartOfAccount[],
  predicate: (a: ChartOfAccount) => boolean,
): Set<number> {
  return new Set(coa.filter(predicate).map((a) => a.accountKey));
}

export const CATEGORY = {
  sales: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.subClass === "Sales"),
  costOfSales: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.subClass === "Cost of Sales"),
  grossProfitAccounts: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.class === "Trading account"),
  opex: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.subClass === "Operating Expenses"),
  depreciationAmortization: (coa: ChartOfAccount[]) =>
    accountKeysWhere(coa, (a) => a.subClass === "Depreciation & Amortization"),
  operatingAccounts: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.class === "Operating account"),
  nonOperating: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.class === "Non-operating"),
  interestExpense: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.subClass === "Interest Expense"),
  taxation: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.subClass === "Taxation"),
  profitAndLoss: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.report === "Profit and Loss"),
  balanceSheet: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.report === "Balance Sheet"),
  currentAssets: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.subClass2 === "Current Assets"),
  currentLiabilities: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.subClass2 === "Current Liabilities"),
  totalAssets: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.class === "Assets"),
  totalDebt: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.subClass === "Liabilities"),
  totalEquity: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.subClass === "Owners Equity"),
  longTermLiabilities: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.subClass2 === "Long Term Liabilities"),
  inventory: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.account === "Inventory"),
  receivables: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.account === "Receivables"),
  payables: (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.account === "Trade Payables"),
};

/**
 * KNOWN SOURCE INCONSISTENCY (see docs/3-plan/data-model.md): the DAX measure
 * "Interest & Tax" filters Chart of Accounts[SubClass] = "Interest & Tax",
 * but no account actually has that SubClass value — "Interest & Tax" is the
 * *Class* for those accounts, while their SubClass is "Interest Expense" /
 * "Taxation". Reproducing the DAX literally would make this measure always
 * return 0. We use the Class filter here instead, which is what the formula
 * evidently intended. This does not affect Net Profit, which is computed
 * directly from Report = "Profit and Loss" (see netProfit below), independent
 * of this chain.
 */
export const interestAndTax = (coa: ChartOfAccount[]) => accountKeysWhere(coa, (a) => a.class === "Interest & Tax");
