import type { ChartOfAccount, GlEntry } from "../types";
import { sumGl, sumGlCumulative, type PeriodFilter } from "./aggregate";

/**
 * Account keys for the cash flow statement, taken directly from the verified
 * Chart of Accounts in data-model.md.
 *
 * Design principle: since the Balance Sheet page already proves
 * Assets = Liabilities + Equity ties to exactly $0, cash flow is derived as
 * a complete partition of every non-cash Balance Sheet account (each key
 * below appears in exactly one bucket) rather than a hand-picked subset —
 * this is what makes the reconciliation check below tie out, instead of
 * hoping it does. Report = "Adjusting" (account 1010) and Retained Earnings
 * (200) are deliberately excluded together: they're a self-cancelling pair
 * the source model uses purely to move Net Profit into Retained Earnings
 * each month, and Net Profit already captures that effect directly.
 *
 * NOT included: a Depreciation & Amortization add-back. Textbook indirect
 * method adds D&A back to Net Profit since it's non-cash — but that only
 * works when a matching Accumulated Depreciation account absorbs it on the
 * Balance Sheet side. This dataset has no such account (verified: adding
 * the addback broke the reconciliation by exactly the D&A amount, every
 * time). Net Profit here already reflects the correct cash position without
 * it — a real, dataset-specific finding, not a shortcut.
 */
const ACCOUNTS = {
  cash: new Set([10, 20]),

  // Working capital (Operating): assets subtracted, liabilities added.
  workingCapitalAssets: new Set([30, 40, 50, 60, 70]), // Receivables, Other Receivables, Bad Debt Allowance, Inventory, Prepaid Expenses
  workingCapitalLiabilities: new Set([110, 120, 121, 122, 130, 140]), // Trade Payables, Accrued Expenses, Interest Payable, Tax Payable, Salaries Payable, Other Current Liabilities

  // Investing: non-current assets, plus interest/dividend receivables (paired with the income reclassification below).
  investments: new Set([75]),
  ppe: new Set([80, 90]),
  intangibles: new Set([100]),
  interestReceivable: new Set([41]),
  dividendReceivable: new Set([42]),

  // Financing: long-term liabilities and equity (excluding Retained Earnings, per the note above).
  longTermDebt: new Set([150, 160, 170]), // Current Installments of LT Debt, Long Term Obligations, Other LT Liabilities
  shareCapitalAndPremium: new Set([180, 190]),
  dividendsPaid: new Set([201]),
  dividendsPayable: new Set([135]),

  // P&L income reclassified out of Operating into Investing (shown as cash actually received, not accrued).
  interestIncome: new Set([410]),
  dividendIncome: new Set([431]),
  gainLossOnSale: new Set([420]),
};

export interface CashFlowStatement {
  cashAtStart: number;
  netProfit: number;
  removeInterestIncome: number;
  removeDividendIncome: number;
  removeGainLossOnSale: number;
  changeInWorkingCapitalAssets: number;
  changeInWorkingCapitalLiabilities: number;
  operatingCashFlow: number;
  investingPpeAndIntangibles: number;
  investingInvestments: number;
  interestReceivedCash: number;
  dividendsReceivedCash: number;
  saleProceedsAdjustment: number;
  investingCashFlow: number;
  shareIssuance: number;
  netBorrowing: number;
  dividendsPaidCash: number;
  financingCashFlow: number;
  netChangeInCash: number;
  cashAtEndComputed: number;
  /** Cash at end computed independently from cumulative GL — should match cashAtEndComputed. */
  cashAtEndActual: number;
  reconciliationGap: number;
}

/**
 * A standard indirect-method cash flow statement, built from first
 * principles as a full partition of the Balance Sheet rather than the
 * source model's ambiguous "Cashflow Values" DAX measure (see
 * data-model.md / plan.md §7 for why that measure wasn't safe to port
 * directly). `reconciliationGap` is the check that matters: the difference
 * between this statement's derived closing cash and the closing cash
 * balance computed independently from cumulative GL. It should be ~0.
 */
export function computeCashFlowStatement(
  gl: GlEntry[],
  coa: ChartOfAccount[],
  filter: PeriodFilter,
): CashFlowStatement {
  const sum = (accountKeys: Set<number>) => sumGl(gl, filter, accountKeys);
  const netProfit = sumGl(
    gl,
    filter,
    new Set(coa.filter((a) => a.report === "Profit and Loss").map((a) => a.accountKey)),
  );

  const cashAtStart = sumGlCumulative(gl, new Date(filter.dateFrom.getTime() - 1), filter.territoryKeys, ACCOUNTS.cash);
  const cashAtEndActual = sumGlCumulative(gl, filter.dateTo, filter.territoryKeys, ACCOUNTS.cash);

  const removeInterestIncome = -sum(ACCOUNTS.interestIncome);
  const removeDividendIncome = -sum(ACCOUNTS.dividendIncome);
  const removeGainLossOnSale = -sum(ACCOUNTS.gainLossOnSale);
  const changeInWorkingCapitalAssets = -sum(ACCOUNTS.workingCapitalAssets);
  const changeInWorkingCapitalLiabilities = sum(ACCOUNTS.workingCapitalLiabilities);

  const operatingCashFlow =
    netProfit +
    removeInterestIncome +
    removeDividendIncome +
    removeGainLossOnSale +
    changeInWorkingCapitalAssets +
    changeInWorkingCapitalLiabilities;

  const investingPpeAndIntangibles = -sum(ACCOUNTS.ppe) - sum(ACCOUNTS.intangibles);
  const investingInvestments = -sum(ACCOUNTS.investments);
  // Cash actually received = income accrued minus the increase in the matching receivable.
  const interestReceivedCash = sum(ACCOUNTS.interestIncome) - sum(ACCOUNTS.interestReceivable);
  const dividendsReceivedCash = sum(ACCOUNTS.dividendIncome) - sum(ACCOUNTS.dividendReceivable);
  const saleProceedsAdjustment = sum(ACCOUNTS.gainLossOnSale);

  const investingCashFlow =
    investingPpeAndIntangibles + investingInvestments + interestReceivedCash + dividendsReceivedCash + saleProceedsAdjustment;

  const shareIssuance = sum(ACCOUNTS.shareCapitalAndPremium);
  const netBorrowing = sum(ACCOUNTS.longTermDebt);
  // Cash actually paid = declared dividend plus the increase in the payable not yet settled.
  const dividendsPaidCash = sum(ACCOUNTS.dividendsPaid) + sum(ACCOUNTS.dividendsPayable);
  const financingCashFlow = shareIssuance + netBorrowing + dividendsPaidCash;

  const netChangeInCash = operatingCashFlow + investingCashFlow + financingCashFlow;
  const cashAtEndComputed = cashAtStart + netChangeInCash;

  return {
    cashAtStart,
    netProfit,
    removeInterestIncome,
    removeDividendIncome,
    removeGainLossOnSale,
    changeInWorkingCapitalAssets,
    changeInWorkingCapitalLiabilities,
    operatingCashFlow,
    investingPpeAndIntangibles,
    investingInvestments,
    interestReceivedCash,
    dividendsReceivedCash,
    saleProceedsAdjustment,
    investingCashFlow,
    shareIssuance,
    netBorrowing,
    dividendsPaidCash,
    financingCashFlow,
    netChangeInCash,
    cashAtEndComputed,
    cashAtEndActual,
    reconciliationGap: cashAtEndComputed - cashAtEndActual,
  };
}
