/**
 * Sample data for the FP&A web app front end.
 *
 * This is the ONLY file with hard-coded numbers. Everything downstream
 * (src/lib/fpa/calculations.ts, the API routes, the pages) derives from
 * the constants below — nothing here talks to a database or reads an
 * Excel file. Structural facts (territory names/currencies/rates, the
 * Chart of Accounts, the 12-line P&L definition, the 5 Scenario levers,
 * the 3 Forecast drivers, the 10 Data Library datasets and their real row
 * counts) are taken from docs/3-plan/prototype/FP&A web app prototype/
 * (fpa-data.js, fpa-bs.js and the inline script in FP&A Prototype.dc.html)
 * since that prototype is this project's confirmed source of truth.
 *
 * The financial figures themselves (annual sales bases, cost ratios,
 * balance-sheet balances) are illustrative sample values only — not the
 * real Finance Dataset — for initial UI display before Supabase is wired
 * up, per design.md.
 */

import type {
  BalanceSheetAccount,
  Dataset,
  DatasetIssue,
  ForecastDriverDefinition,
  GeneratedReport,
  ProfitAndLossAccount,
  ProfitAndLossLineDefinition,
  ReportSectionDefinition,
  ReportType,
  Scenario,
  ScenarioLeverDefinition,
  Territory,
} from "./types";

/** Illustrative "closing rate one year earlier" per territory, for the Territory Performance FX-impact split (this dataset only carries one constant rate per territory, per fpa-data.js, so the prior-year rate is a small illustrative offset, not a second real rate table). */
export const PRIOR_YEAR_RATE: Record<number, number> = {
  1: 1,
  2: 0.712,
  3: 1.245,
  4: 1.041,
  5: 1.041,
  6: 0.706,
  7: 0.652,
};

export const TERRITORIES: Territory[] = [
  { key: 1, name: "USA", region: "North America", currency: "USD", rate: 1 },
  { key: 2, name: "Canada", region: "North America", currency: "CAD", rate: 0.738 },
  { key: 3, name: "UK", region: "Europe", currency: "GBP", rate: 1.21 },
  { key: 4, name: "Germany", region: "Europe", currency: "EUR", rate: 1.07 },
  { key: 5, name: "France", region: "Europe", currency: "EUR", rate: 1.07 },
  { key: 6, name: "Australia", region: "Oceania", currency: "AUD", rate: 0.681 },
  { key: 7, name: "New Zealand", region: "Oceania", currency: "NZD", rate: 0.635 },
];

export const FISCAL_YEARS = [2023, 2024, 2025] as const;

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Mild seasonality (higher close to calendar year-end), sums to 1. */
export const MONTH_WEIGHTS = [0.070, 0.068, 0.078, 0.080, 0.082, 0.086, 0.084, 0.082, 0.086, 0.090, 0.094, 0.100];

export const PERIOD_MONTHS: Record<string, number[]> = {
  fy: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  h1: [1, 2, 3, 4, 5, 6],
  h2: [7, 8, 9, 10, 11, 12],
  q1: [1, 2, 3],
  q2: [4, 5, 6],
  q3: [7, 8, 9],
  q4: [10, 11, 12],
};

export const PERIOD_LABELS: Record<string, string> = {
  fy: "Full year",
  h1: "H1 · Jan–Jun",
  h2: "H2 · Jul–Dec",
  q1: "Q1 · Jan–Mar",
  q2: "Q2 · Apr–Jun",
  q3: "Q3 · Jul–Sep",
  q4: "Q4 · Oct–Dec",
};

// ---------- P&L structure (12 lines) ----------

export const PL_LINES: ProfitAndLossLineDefinition[] = [
  { id: "sales", label: "Sales", subs: ["Sales"] },
  { id: "cos", label: "Cost of Sales", subs: ["Cost of Sales"] },
  { id: "gp", label: "Gross Profit", sum: ["sales", "cos"] },
  { id: "opex", label: "Operating Expenses", subs: ["Operating Expenses"] },
  { id: "ebitda", label: "EBITDA", sum: ["gp", "opex"], headline: true },
  { id: "da", label: "Depreciation & Amortization", subs: ["Depreciation & Amortization"] },
  { id: "ebit", label: "EBIT", sum: ["ebitda", "da"] },
  { id: "nonop", label: "Non-operating Income", subs: ["Interest Income", "Dividend Income", "Gain/Loss on Sales of Asset", "Exchange Loss/Gain"] },
  { id: "intexp", label: "Interest Expense", subs: ["Interest Expense"] },
  { id: "pbt", label: "Profit Before Tax", sum: ["ebit", "nonop", "intexp"] },
  { id: "tax", label: "Taxation", subs: ["Taxation"] },
  { id: "np", label: "Net Profit", sum: ["pbt", "tax"], headline: true },
];

/** Chart of Accounts — P&L accounts. Verbatim from fpa-data.js (source: GL.xlsx · Chart of Accounts.xlsx). */
export const PL_ACCOUNTS: ProfitAndLossAccount[] = [
  { key: 210, cls: "Trading account", clsSort: 3, sub: "Sales", subSort: 4, sub2: "Sales", sub2Sort: 8, name: "Sales", acctSort: 18, subacct: "Sales" },
  { key: 220, cls: "Trading account", clsSort: 3, sub: "Sales", subSort: 4, sub2: "Sales", sub2Sort: 8, name: "Sales Return", acctSort: 19, subacct: "Sales Return" },
  { key: 230, cls: "Trading account", clsSort: 3, sub: "Cost of Sales", subSort: 5, sub2: "Cost of Sales", sub2Sort: 9, name: "Cost of Sales", acctSort: 20, subacct: "Cost of Sales" },
  { key: 240, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Sales & Distribution", sub2Sort: 10, name: "Staff Costs", acctSort: 21, subacct: "Salaries" },
  { key: 250, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Sales & Distribution", sub2Sort: 10, name: "Bad Debt Expense", acctSort: 22, subacct: "Bad Debt Expense" },
  { key: 260, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Marketing", sub2Sort: 11, name: "Commissions", acctSort: 23, subacct: "Commissions" },
  { key: 270, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Marketing", sub2Sort: 11, name: "Conferences", acctSort: 24, subacct: "Conferences" },
  { key: 280, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Marketing", sub2Sort: 11, name: "Advertisements", acctSort: 25, subacct: "Advertisements" },
  { key: 290, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Administration", sub2Sort: 12, name: "Travel", acctSort: 26, subacct: "Travel" },
  { key: 300, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Administration", sub2Sort: 12, name: "Entertainment", acctSort: 27, subacct: "Entertainment" },
  { key: 310, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Administration", sub2Sort: 12, name: "Office Supplies", acctSort: 28, subacct: "Office Supplies" },
  { key: 320, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Administration", sub2Sort: 12, name: "Professional Services", acctSort: 29, subacct: "Professional Services" },
  { key: 330, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Administration", sub2Sort: 12, name: "Telephone", acctSort: 30, subacct: "Telephone" },
  { key: 340, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Administration", sub2Sort: 12, name: "Utilities", acctSort: 31, subacct: "Utilities" },
  { key: 350, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Administration", sub2Sort: 12, name: "Other Expenses", acctSort: 32, subacct: "Other Expenses" },
  { key: 360, cls: "Operating account", clsSort: 4, sub: "Operating Expenses", subSort: 6, sub2: "Administration", sub2Sort: 12, name: "Rent", acctSort: 33, subacct: "Rent" },
  { key: 370, cls: "Operating account", clsSort: 4, sub: "Depreciation & Amortization", subSort: 7, sub2: "Depreciation", sub2Sort: 13, name: "Vehicles", acctSort: 34, subacct: "Vehicles" },
  { key: 380, cls: "Operating account", clsSort: 4, sub: "Depreciation & Amortization", subSort: 7, sub2: "Depreciation", sub2Sort: 13, name: "Equipment", acctSort: 35, subacct: "Equipment" },
  { key: 390, cls: "Operating account", clsSort: 4, sub: "Depreciation & Amortization", subSort: 7, sub2: "Depreciation", sub2Sort: 13, name: "Furniture and Fixtures", acctSort: 36, subacct: "Furniture and Fixtures" },
  { key: 400, cls: "Operating account", clsSort: 4, sub: "Depreciation & Amortization", subSort: 7, sub2: "Amortization", sub2Sort: 14, name: "Amortization of Intangible Assets", acctSort: 37, subacct: "Amortization of Intangible Assets" },
  { key: 410, cls: "Non-operating", clsSort: 5, sub: "Interest Income", subSort: 8, sub2: "Interest Income", sub2Sort: 15, name: "Interest Income", acctSort: 38, subacct: "Interest Income" },
  { key: 420, cls: "Non-operating", clsSort: 5, sub: "Gain/Loss on Sales of Asset", subSort: 9, sub2: "Gain/Loss on Sales of Asset", sub2Sort: 16, name: "Gain/Loss on Sales of Asset", acctSort: 39, subacct: "Gain/Loss on Sales of Asset" },
  { key: 430, cls: "Non-operating", clsSort: 5, sub: "Exchange Loss/Gain", subSort: 10, sub2: "Exchange Loss/Gain", sub2Sort: 17, name: "Exchange Loss/Gain", acctSort: 40, subacct: "Exchange Loss/Gain" },
  { key: 431, cls: "Non-operating", clsSort: 5, sub: "Dividend Income", subSort: 11, sub2: "Dividend Income", sub2Sort: 18, name: "Dividend Income", acctSort: 41, subacct: "Dividend Income" },
  { key: 440, cls: "Interest & Tax", clsSort: 6, sub: "Interest Expense", subSort: 12, sub2: "Interest Expense", sub2Sort: 19, name: "Interest Expense", acctSort: 42, subacct: "Interest Expense" },
  { key: 450, cls: "Interest & Tax", clsSort: 6, sub: "Taxation", subSort: 13, sub2: "Taxation", sub2Sort: 20, name: "Taxation", acctSort: 43, subacct: "Taxation" },
];

/** Chart of Accounts — Balance Sheet accounts. Verbatim from fpa-bs.js (source: Trial Balance.xlsx). */
export const BS_ACCOUNTS: BalanceSheetAccount[] = [
  { key: 10, cls: "Assets", sub2: "Current Assets", name: "Cash & Cash Equivalents", subacct: "Cash at Bank" },
  { key: 20, cls: "Assets", sub2: "Current Assets", name: "Cash & Cash Equivalents", subacct: "Cash in hand" },
  { key: 30, cls: "Assets", sub2: "Current Assets", name: "Receivables", subacct: "Trade Receivables" },
  { key: 40, cls: "Assets", sub2: "Current Assets", name: "Receivables", subacct: "Other Receivables" },
  { key: 41, cls: "Assets", sub2: "Current Assets", name: "Receivables", subacct: "Interest Receivable" },
  { key: 42, cls: "Assets", sub2: "Current Assets", name: "Receivables", subacct: "Dividend Receivable" },
  { key: 50, cls: "Assets", sub2: "Current Assets", name: "Receivables", subacct: "Allowance for Bad Debt" },
  { key: 60, cls: "Assets", sub2: "Current Assets", name: "Inventory", subacct: "Inventory" },
  { key: 70, cls: "Assets", sub2: "Current Assets", name: "Other Current Assets", subacct: "Prepaid Expenses" },
  { key: 75, cls: "Assets", sub2: "Current Assets", name: "Investments", subacct: "Securities" },
  { key: 80, cls: "Assets", sub2: "Non-Current Assets", name: "Property, Plant, & Equipment", subacct: "Land & Buildings" },
  { key: 90, cls: "Assets", sub2: "Non-Current Assets", name: "Property, Plant, & Equipment", subacct: "Office Furniture & Equipment" },
  { key: 100, cls: "Assets", sub2: "Non-Current Assets", name: "Intangible Assets", subacct: "Patents and trademarks" },
  { key: 110, cls: "Liabilities and Owners Equity", sub2: "Current Liabilities", name: "Trade Payables", subacct: "Trade Payables" },
  { key: 120, cls: "Liabilities and Owners Equity", sub2: "Current Liabilities", name: "Other Payables", subacct: "Accrued Expenses" },
  { key: 121, cls: "Liabilities and Owners Equity", sub2: "Current Liabilities", name: "Other Payables", subacct: "Interest Payable" },
  { key: 122, cls: "Liabilities and Owners Equity", sub2: "Current Liabilities", name: "Other Payables", subacct: "Tax payable" },
  { key: 130, cls: "Liabilities and Owners Equity", sub2: "Current Liabilities", name: "Other Payables", subacct: "Salaries payable" },
  { key: 135, cls: "Liabilities and Owners Equity", sub2: "Current Liabilities", name: "Other Payables", subacct: "Dividends payable" },
  { key: 140, cls: "Liabilities and Owners Equity", sub2: "Current Liabilities", name: "Other Current Liabilities", subacct: "Other Current Liabilities" },
  { key: 150, cls: "Liabilities and Owners Equity", sub2: "Current Liabilities", name: "Current Installments of Long-term Debt", subacct: "Current Installments of Long-term Debt" },
  { key: 160, cls: "Liabilities and Owners Equity", sub2: "Long Term Liabilities", name: "Long Term Obligations", subacct: "Long Term Obligations" },
  { key: 170, cls: "Liabilities and Owners Equity", sub2: "Long Term Liabilities", name: "Other Long Term Liabilities", subacct: "Other Long Term Liabilities" },
  { key: 180, cls: "Liabilities and Owners Equity", sub2: "Share Capital", name: "Share Capital", subacct: "Share Capital" },
  { key: 190, cls: "Liabilities and Owners Equity", sub2: "Share Premium", name: "Share Premium", subacct: "Share Premium" },
  { key: 200, cls: "Liabilities and Owners Equity", sub2: "Retained Earnings", name: "Retained Earnings", subacct: "Retained Earnings" },
  { key: 201, cls: "Liabilities and Owners Equity", sub2: "Retained Earnings", name: "Dividends paid", subacct: "Dividends paid" },
];

// ---------- Scenario Modelling & Forecast ----------

export const SCENARIO_LEVERS: ScenarioLeverDefinition[] = [
  { id: "salesGrowth", label: "Sales growth", min: -20, max: 20, step: 0.5, base: 0, unit: "%" },
  { id: "priceChange", label: "Price change", min: -10, max: 10, step: 0.5, base: 0, unit: "%" },
  { id: "cosRate", label: "Cost of sales rate", min: -8, max: 8, step: 0.5, base: 0, unit: "pt" },
  { id: "opexChange", label: "Opex change", min: -15, max: 15, step: 0.5, base: 0, unit: "%" },
  { id: "headcount", label: "Headcount change", min: -20, max: 20, step: 1, base: 0, unit: " FTE" },
];

export const FORECAST_DRIVERS: ForecastDriverDefinition[] = [
  { id: "salesDriver", label: "Sales vs budget", min: -20, max: 20, step: 0.5, unit: "%" },
  { id: "cosDriver", label: "Cost of sales recovery", min: -10, max: 10, step: 0.5, unit: "%" },
  { id: "opexDriver", label: "Opex control", min: -10, max: 10, step: 0.5, unit: "%" },
];

export const SAMPLE_SCENARIOS: Scenario[] = [
  {
    id: "scn-1",
    name: "FY2025 Base Case",
    territoryKey: "all",
    fiscalYear: 2025,
    levers: { salesGrowth: 0, priceChange: 0, cosRate: 0, opexChange: 0, headcount: 0 },
    scenarioType: "base_case",
    lastSavedAt: "2025-01-05T09:00:00Z",
  },
  {
    id: "scn-2",
    name: "Upside case — price led",
    territoryKey: "all",
    fiscalYear: 2025,
    levers: { salesGrowth: 4, priceChange: 1.5, cosRate: -1, opexChange: 2, headcount: 3 },
    scenarioType: "custom",
    lastSavedAt: "2025-06-12T14:32:00Z",
  },
];

// ---------- Reports ----------

export const REPORT_SECTIONS: ReportSectionDefinition[] = [
  { id: "kpi_summary", label: "KPI summary" },
  { id: "profit_and_loss", label: "Profit and loss" },
  { id: "territory_summary", label: "Territory summary" },
  { id: "ranked_variances", label: "Ranked variances" },
  { id: "forecast_outlook", label: "Forecast outlook" },
];

export const REPORT_TYPES: { id: ReportType; label: string }[] = [
  { id: "monthly_management_pack", label: "Monthly management pack" },
  { id: "board_pack", label: "Board pack" },
  { id: "territory_review", label: "Territory review" },
  { id: "variance_memo", label: "Variance memo" },
];

export const SAMPLE_REPORTS: GeneratedReport[] = [
  {
    id: "rpt-1",
    reportType: "monthly_management_pack",
    territoryKey: "all",
    fiscalYear: 2025,
    period: "h1",
    currency: "usd",
    sections: ["kpi_summary", "profit_and_loss", "territory_summary", "ranked_variances"],
    generatedAt: "2025-07-02T08:15:00Z",
  },
];

// ---------- Data Library ----------

/** Real row counts, taken from the prototype's own generated sample (fpa-data.js / fpa-bs.js / the DATASETS list in FP&A Prototype.dc.html). */
export const DATASETS: Dataset[] = [
  { id: "gl", name: "General Ledger", fileName: "GL.xlsx", rowCount: 27909, lastRefreshedAt: "2025-07-01T06:00:00Z", validationStatus: "pass" },
  { id: "budget", name: "Budget", fileName: "Budget.xlsx", rowCount: 7980, lastRefreshedAt: "2025-07-01T06:00:00Z", validationStatus: "pass" },
  { id: "coa", name: "Chart of Accounts", fileName: "Chart of Accounts.xlsx", rowCount: 54, lastRefreshedAt: "2025-07-01T06:00:00Z", validationStatus: "pass" },
  { id: "territory", name: "Territory", fileName: "Territory.xlsx", rowCount: 7, lastRefreshedAt: "2025-07-01T06:00:00Z", validationStatus: "pass" },
  { id: "currency", name: "Currency", fileName: "Currency_data.xlsx", rowCount: 7672, lastRefreshedAt: "2025-07-01T06:00:00Z", validationStatus: "fail" },
  { id: "calendar", name: "Calendar", fileName: "Calendar.xlsx", rowCount: 1096, lastRefreshedAt: "2025-07-01T06:00:00Z", validationStatus: "pass" },
  { id: "tb", name: "Trial Balance", fileName: "Trial Balance.xlsx", rowCount: 13356, lastRefreshedAt: "2025-07-01T06:00:00Z", validationStatus: "pass" },
  { id: "cashflow", name: "Cash Flow Statement", fileName: "CashFlow_St.xlsx", rowCount: 66, lastRefreshedAt: "2025-07-01T06:00:00Z", validationStatus: "pass" },
  { id: "soce", name: "Statement of Changes in Equity", fileName: "SoCE.xlsx", rowCount: 1000, lastRefreshedAt: "2025-07-01T06:00:00Z", validationStatus: "pass" },
  { id: "calc", name: "Calculations BI", fileName: "Calculations BI.xlsx", rowCount: 1000, lastRefreshedAt: "2025-07-01T06:00:00Z", validationStatus: "pass" },
];

export const DATASET_ISSUES: DatasetIssue[] = [
  { id: "iss-1", datasetId: "currency", rowRef: "Currency_data!row 3,014", message: "Invalid date 29 Feb 2025 (2025 is not a leap year) stored as text — no FX rate could be parsed for this row." },
  { id: "iss-2", datasetId: "currency", rowRef: "Currency_data!row 3,015", message: "Same invalid 29 Feb 2025 date, GBP rate row — blocks USD conversion for UK on this date." },
];

// ---------- Annual base figures (illustrative, per territory per fiscal year) ----------
// Sales in the territory's OWN local currency. Everything else on the P&L and
// Balance Sheet is derived from these via the fixed ratios in calculations.ts.

export interface TerritoryYearBase {
  territoryKey: number;
  year: number;
  salesActual: number;
}

export const TERRITORY_YEAR_SALES: TerritoryYearBase[] = [
  // USA
  { territoryKey: 1, year: 2023, salesActual: 37_400_000 },
  { territoryKey: 1, year: 2024, salesActual: 39_600_000 },
  { territoryKey: 1, year: 2025, salesActual: 42_300_000 },
  // Canada
  { territoryKey: 2, year: 2023, salesActual: 16_100_000 },
  { territoryKey: 2, year: 2024, salesActual: 17_300_000 },
  { territoryKey: 2, year: 2025, salesActual: 18_600_000 },
  // UK
  { territoryKey: 3, year: 2023, salesActual: 12_600_000 },
  { territoryKey: 3, year: 2024, salesActual: 13_400_000 },
  { territoryKey: 3, year: 2025, salesActual: 14_250_000 },
  // Germany
  { territoryKey: 4, year: 2023, salesActual: 14_900_000 },
  { territoryKey: 4, year: 2024, salesActual: 15_800_000 },
  { territoryKey: 4, year: 2025, salesActual: 16_850_000 },
  // France
  { territoryKey: 5, year: 2023, salesActual: 10_900_000 },
  { territoryKey: 5, year: 2024, salesActual: 11_650_000 },
  { territoryKey: 5, year: 2025, salesActual: 12_400_000 },
  // Australia
  { territoryKey: 6, year: 2023, salesActual: 13_700_000 },
  { territoryKey: 6, year: 2024, salesActual: 14_650_000 },
  { territoryKey: 6, year: 2025, salesActual: 15_650_000 },
  // New Zealand
  { territoryKey: 7, year: 2023, salesActual: 5_400_000 },
  { territoryKey: 7, year: 2024, salesActual: 5_800_000 },
  { territoryKey: 7, year: 2025, salesActual: 6_250_000 },
];

/** Ratio of annual Sales used to derive each other P&L line's ACTUAL value (sign matches the GL convention: cost/expense lines are negative). */
export const LINE_RATIOS_OF_SALES: { cos: number; opex: number; da: number; nonop: number; intexp: number; taxRateOfPbt: number } = {
  cos: -0.41,
  opex: -0.27,
  da: -0.03,
  nonop: 0.008,
  intexp: -0.011,
  taxRateOfPbt: -0.22,
};

/**
 * Deterministic budget-variance seed per territory × drillable line, expressed as a
 * fraction (e.g. 0.05 = actual is 5% above budget). Germany's Opex is deliberately
 * tuned to roughly match the AI-commentary example already shipped in
 * src/lib/ai/commentary.ts ("Germany's EBITDA €6.2M below budget, driven by an
 * unfavorable OPEX variance of €8.1M").
 */
export const VARIANCE_SEED: Record<number, Partial<Record<"sales" | "cos" | "opex" | "da" | "nonop" | "intexp" | "tax", number>>> = {
  1: { sales: 0.03, cos: 0.01, opex: -0.02, da: 0, nonop: 0.10, intexp: -0.02, tax: 0.02 },
  2: { sales: -0.02, cos: -0.01, opex: 0.03, da: 0.01, nonop: -0.05, intexp: 0.01, tax: -0.01 },
  3: { sales: 0.015, cos: 0.02, opex: 0.01, da: 0, nonop: 0.04, intexp: 0, tax: 0.015 },
  // Germany's opex is deliberately unfavorable (actual overspends budget) to match the
  // AI-commentary example in src/lib/ai/commentary.ts ("Germany's EBITDA €6.2M below
  // budget, driven by an unfavorable OPEX variance"). For an expense line (stored
  // negative), a POSITIVE seed means actual overspends budget — see calculations.ts'
  // annualStatement(): budget = actual / (1 + seed).
  4: { sales: -0.01, cos: 0.03, opex: 0.09, da: 0.01, nonop: -0.03, intexp: -0.02, tax: -0.05 },
  5: { sales: 0.02, cos: -0.015, opex: 0.02, da: 0, nonop: 0.02, intexp: 0.01, tax: 0.01 },
  6: { sales: 0.045, cos: 0.01, opex: -0.03, da: 0, nonop: 0.06, intexp: 0, tax: 0.03 },
  7: { sales: -0.03, cos: -0.02, opex: 0.015, da: 0, nonop: -0.02, intexp: 0.02, tax: -0.02 },
};

/** Balance-sheet accounts as a ratio of the territory's FY2025 annual Sales, used to derive illustrative closing balances. Assets ratios are positive; Liabilities & Equity ratios are positive magnitudes that are then made to balance against Total Assets. */
export const BS_RATIOS_OF_SALES: { key: number; ratio: number }[] = [
  { key: 10, ratio: 0.085 }, // Cash at Bank
  { key: 20, ratio: 0.004 }, // Cash in hand
  { key: 30, ratio: 0.140 }, // Trade Receivables
  { key: 40, ratio: 0.012 }, // Other Receivables
  { key: 41, ratio: 0.003 }, // Interest Receivable
  { key: 42, ratio: 0.002 }, // Dividend Receivable
  { key: 50, ratio: -0.010 }, // Allowance for Bad Debt (contra-asset)
  { key: 60, ratio: 0.110 }, // Inventory
  { key: 70, ratio: 0.018 }, // Prepaid Expenses
  { key: 75, ratio: 0.020 }, // Securities
  { key: 80, ratio: 0.260 }, // Land & Buildings
  { key: 90, ratio: 0.070 }, // Office Furniture & Equipment
  { key: 100, ratio: 0.045 }, // Patents and trademarks
  { key: 110, ratio: 0.095 }, // Trade Payables
  { key: 120, ratio: 0.028 }, // Accrued Expenses
  { key: 121, ratio: 0.006 }, // Interest Payable
  { key: 122, ratio: 0.014 }, // Tax payable
  { key: 130, ratio: 0.016 }, // Salaries payable
  { key: 135, ratio: 0.005 }, // Dividends payable
  { key: 140, ratio: 0.010 }, // Other Current Liabilities
  { key: 150, ratio: 0.020 }, // Current Installments of Long-term Debt
  { key: 160, ratio: 0.180 }, // Long Term Obligations
  { key: 170, ratio: 0.022 }, // Other Long Term Liabilities
  { key: 180, ratio: 0.150 }, // Share Capital
  { key: 190, ratio: 0.060 }, // Share Premium
  // 200 Retained Earnings is the balancing figure — see calculations.ts
  { key: 201, ratio: -0.015 }, // Dividends paid (reduces equity)
];

/**
 * Relative weight of each P&L account within its line, for splitting a line's
 * total into its underlying accounts on the P&L drill-down. Weights within
 * each line sum to 1. Single-account lines (Sales, Cost of Sales, Interest
 * Expense, Taxation) are omitted — their one account simply gets the whole line
 * (Sales Return, the second Sales account, is a small negative contra amount).
 */
export const ACCOUNT_WEIGHTS: Record<number, number> = {
  // Sales (line "sales"): Sales, Sales Return (contra)
  210: 1.03,
  220: -0.03,
  // Operating Expenses (line "opex"): 13 accounts
  240: 0.30, // Staff Costs
  250: 0.02, // Bad Debt Expense
  260: 0.09, // Commissions
  270: 0.04, // Conferences
  280: 0.12, // Advertisements
  290: 0.05, // Travel
  300: 0.03, // Entertainment
  310: 0.04, // Office Supplies
  320: 0.08, // Professional Services
  330: 0.03, // Telephone
  340: 0.05, // Utilities
  350: 0.03, // Other Expenses
  360: 0.12, // Rent
  // Depreciation & Amortization (line "da"): 4 accounts
  370: 0.18, // Vehicles
  380: 0.42, // Equipment
  390: 0.16, // Furniture and Fixtures
  400: 0.24, // Amortization of Intangible Assets
  // Non-operating Income (line "nonop"): 4 accounts
  410: 0.55, // Interest Income
  420: 0.10, // Gain/Loss on Sales of Asset
  430: 0.15, // Exchange Loss/Gain
  431: 0.20, // Dividend Income
};
