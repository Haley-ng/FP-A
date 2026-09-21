import { query } from "./client";
import type { Scope } from "./aggregate";
import type { CashFlowLine } from "@/lib/fpa/types";

/**
 * Account-key groupings, taken verbatim from src/lib/calcEngine/cashFlow.ts —
 * a first-principles indirect-method statement built as a complete partition
 * of every non-cash Balance Sheet account (see that file's header comment for
 * why: no Depreciation & Amortization add-back in this dataset, and why
 * Report="Adjusting"/Retained Earnings are excluded as a self-cancelling pair).
 */
const ACCOUNTS = {
  cash: [10, 20],
  workingCapitalAssets: [30, 40, 50, 60, 70],
  workingCapitalLiabilities: [110, 120, 121, 122, 130, 140],
  investments: [75],
  ppeAndIntangibles: [80, 90, 100],
  interestReceivable: [41],
  dividendReceivable: [42],
  longTermDebt: [150, 160, 170],
  shareCapitalAndPremium: [180, 190],
  dividendsPaid: [201],
  dividendsPayable: [135],
  interestIncome: [410],
  dividendIncome: [431],
  gainLossOnSale: [420],
} as const;

/** `t.amount` for local currency, or `t.amount * matching daily rate` for USD — see aggregate.ts's ftpTotalUsd for the same per-row conversion pattern. */
function amountExpr(alias: string, toUsd: boolean): string {
  return toUsd
    ? `${alias}.amount * coalesce((select max(cr.exchange_rate) from currency_rate cr where cr.date = ${alias}.date and cr.territory_key = ${alias}.territory_key), 1)`
    : `${alias}.amount`;
}

async function sumByAccounts(scope: Scope, accountKeys: number[], toUsd: boolean): Promise<number> {
  const sql = `
    select coalesce(sum(${amountExpr("gl", toUsd)}), 0) as total
    from gl
    where date between $1 and $2
      and account_key = ANY($3::int[])
      and (territory_key = ANY($4::int[]) OR $4::int[] IS NULL)
  `;
  const rows = await query<{ total: string }>(sql, [scope.dateFrom, scope.dateTo, accountKeys, scope.territoryKeys ?? null]);
  return Number(rows[0]?.total ?? 0);
}

async function cumulativeCash(asOfDate: string, territoryKeys: number[] | undefined, toUsd: boolean): Promise<number> {
  const sql = `
    select coalesce(sum(${amountExpr("gl", toUsd)}), 0) as total
    from gl
    where date <= $1
      and account_key = ANY($2::int[])
      and (territory_key = ANY($3::int[]) OR $3::int[] IS NULL)
  `;
  const rows = await query<{ total: string }>(sql, [asOfDate, ACCOUNTS.cash as unknown as number[], territoryKeys ?? null]);
  return Number(rows[0]?.total ?? 0);
}

async function netProfitFor(scope: Scope, toUsd: boolean): Promise<number> {
  const sql = `
    select coalesce(sum(${amountExpr("gl", toUsd)}), 0) as total
    from gl
    join chart_of_accounts coa on coa.account_key = gl.account_key
    where gl.date between $1 and $2
      and coa.report = 'profit_and_loss'
      and (gl.territory_key = ANY($3::int[]) OR $3::int[] IS NULL)
  `;
  const rows = await query<{ total: string }>(sql, [scope.dateFrom, scope.dateTo, scope.territoryKeys ?? null]);
  return Number(rows[0]?.total ?? 0);
}

export async function computeCashFlow(scope: Scope, toUsd: boolean): Promise<{ lines: CashFlowLine[]; reconciliationGap: number }> {
  const dayBefore = new Date(scope.dateFrom);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayBeforeStr = dayBefore.toISOString().slice(0, 10);

  const [
    netProfit,
    cashAtStart,
    cashAtEnd,
    interestIncome,
    dividendIncome,
    gainLossOnSale,
    wcAssets,
    wcLiabilities,
    ppe,
    investments,
    interestReceivable,
    dividendReceivable,
    shareCapitalAndPremium,
    longTermDebt,
    dividendsPaid,
    dividendsPayable,
  ] = await Promise.all([
    netProfitFor(scope, toUsd),
    cumulativeCash(dayBeforeStr, scope.territoryKeys, toUsd),
    cumulativeCash(scope.dateTo, scope.territoryKeys, toUsd),
    sumByAccounts(scope, ACCOUNTS.interestIncome as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.dividendIncome as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.gainLossOnSale as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.workingCapitalAssets as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.workingCapitalLiabilities as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.ppeAndIntangibles as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.investments as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.interestReceivable as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.dividendReceivable as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.shareCapitalAndPremium as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.longTermDebt as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.dividendsPaid as unknown as number[], toUsd),
    sumByAccounts(scope, ACCOUNTS.dividendsPayable as unknown as number[], toUsd),
  ]);

  const removeInterestIncome = -interestIncome;
  const removeDividendIncome = -dividendIncome;
  const removeGainLossOnSale = -gainLossOnSale;
  const changeInWorkingCapitalAssets = -wcAssets;
  const changeInWorkingCapitalLiabilities = wcLiabilities;
  const operating = netProfit + removeInterestIncome + removeDividendIncome + removeGainLossOnSale + changeInWorkingCapitalAssets + changeInWorkingCapitalLiabilities;

  const investingPpe = -ppe;
  const investingInvestments = -investments;
  const interestReceivedCash = interestIncome - interestReceivable;
  const dividendsReceivedCash = dividendIncome - dividendReceivable;
  const saleProceedsAdjustment = gainLossOnSale;
  const investing = investingPpe + investingInvestments + interestReceivedCash + dividendsReceivedCash + saleProceedsAdjustment;

  const dividendsPaidCash = dividendsPaid + dividendsPayable;
  const financing = shareCapitalAndPremium + longTermDebt + dividendsPaidCash;

  const netMovement = operating + investing + financing;
  const cashAtEndComputed = cashAtStart + netMovement;

  const lines: CashFlowLine[] = [
    { label: "Net Profit", section: "operating", value: netProfit, isSubtotal: false },
    { label: "Remove: Interest Income", section: "operating", value: removeInterestIncome, isSubtotal: false },
    { label: "Remove: Dividend Income", section: "operating", value: removeDividendIncome, isSubtotal: false },
    { label: "Remove: Gain/Loss on Sale of Asset", section: "operating", value: removeGainLossOnSale, isSubtotal: false },
    { label: "Change in Working Capital — Assets", section: "operating", value: changeInWorkingCapitalAssets, isSubtotal: false },
    { label: "Change in Working Capital — Liabilities", section: "operating", value: changeInWorkingCapitalLiabilities, isSubtotal: false },
    { label: "Net Cash from Operating Activities", section: "operating", value: operating, isSubtotal: true },
    { label: "Purchase of PP&E and Intangibles", section: "investing", value: investingPpe, isSubtotal: false },
    { label: "Purchase of Investments", section: "investing", value: investingInvestments, isSubtotal: false },
    { label: "Interest Received (cash)", section: "investing", value: interestReceivedCash, isSubtotal: false },
    { label: "Dividends Received (cash)", section: "investing", value: dividendsReceivedCash, isSubtotal: false },
    { label: "Proceeds from Sale of Assets", section: "investing", value: saleProceedsAdjustment, isSubtotal: false },
    { label: "Net Cash from Investing Activities", section: "investing", value: investing, isSubtotal: true },
    { label: "Share Capital & Premium Issued", section: "financing", value: shareCapitalAndPremium, isSubtotal: false },
    { label: "Net Borrowing (Long Term Debt)", section: "financing", value: longTermDebt, isSubtotal: false },
    { label: "Dividends Paid (cash)", section: "financing", value: dividendsPaidCash, isSubtotal: false },
    { label: "Net Cash from Financing Activities", section: "financing", value: financing, isSubtotal: true },
    { label: "Net Movement in Cash", section: "total", value: netMovement, isSubtotal: true },
    { label: "Cash at Start of Period", section: "total", value: cashAtStart, isSubtotal: false },
    { label: "Cash at End of Period", section: "total", value: cashAtEndComputed, isSubtotal: true },
  ];

  // Independent check: closing cash computed above should match cumulative GL's
  // own cash balance as of the same date — see calcEngine/cashFlow.ts's reconciliationGap.
  // Only meaningful in local currency: converting cashAtStart/cashAtEnd with two different
  // per-row rate joins can differ by rounding once toUsd mixes multiple territories/dates.
  const reconciliationGap = cashAtEndComputed - cashAtEnd;

  return { lines, reconciliationGap };
}
