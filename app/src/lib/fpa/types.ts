/**
 * Domain types for the FP&A web app front-end (prototype-matched build).
 * Every type here names a real concept from docs/2-spec/design.md and
 * docs/3-plan/erd.md — nothing is a bare generic container.
 */

// ---------- Filters (shared across every page, carried in the URL) ----------

export type TerritoryFilter = "all" | number;
export type FiscalYear = 2023 | 2024 | 2025;
export type Period = "fy" | "h1" | "h2" | "q1" | "q2" | "q3" | "q4";
export type CurrencyMode = "usd" | "local";
export type LinkMode = "edit" | "view";

export interface FpaFilters {
  territory: TerritoryFilter;
  year: FiscalYear;
  period: Period;
  currency: CurrencyMode;
  linkMode: LinkMode;
}

// ---------- Territory dimension ----------

export interface Territory {
  key: number;
  name: string;
  region: string;
  currency: string;
  /** Units of USD per 1 unit of local currency. */
  rate: number;
}

// ---------- Chart of Accounts ----------

export interface ProfitAndLossAccount {
  key: number;
  cls: string;
  clsSort: number;
  sub: string;
  subSort: number;
  sub2: string;
  sub2Sort: number;
  name: string;
  acctSort: number;
  subacct: string;
}

export interface BalanceSheetAccount {
  key: number;
  cls: "Assets" | "Liabilities and Owners Equity";
  sub2: string;
  name: string;
  subacct: string;
}

// ---------- Profit & Loss (12-line structure) ----------

export type ProfitAndLossLineId =
  | "sales"
  | "cos"
  | "gp"
  | "opex"
  | "ebitda"
  | "da"
  | "ebit"
  | "nonop"
  | "intexp"
  | "pbt"
  | "tax"
  | "np";

export interface ProfitAndLossLineDefinition {
  id: ProfitAndLossLineId;
  label: string;
  /** Chart-of-Accounts SubClass values rolled into this line, when it is a drillable leaf line. */
  subs?: string[];
  /** Other line ids summed to produce this line, when it is a subtotal/total line. */
  sum?: ProfitAndLossLineId[];
  headline?: boolean;
}

export interface ActualBudgetValue {
  actual: number;
  budget: number;
}

export interface ProfitAndLossStatement {
  sales: ActualBudgetValue;
  cos: ActualBudgetValue;
  gp: ActualBudgetValue;
  opex: ActualBudgetValue;
  ebitda: ActualBudgetValue;
  da: ActualBudgetValue;
  ebit: ActualBudgetValue;
  nonop: ActualBudgetValue;
  intexp: ActualBudgetValue;
  pbt: ActualBudgetValue;
  tax: ActualBudgetValue;
  np: ActualBudgetValue;
}

export interface DrillAccountRow {
  accountKey: number;
  label: string;
  actual: number;
  budget: number;
}

export interface GlTransaction {
  entryNo: number;
  date: string;
  details: string;
  territoryKey: number;
  accountKey: number;
  amount: number;
}

// ---------- Balance Sheet ----------

export interface BalanceSheetLine {
  marker: string;
  label: string;
  isSubtotal: boolean;
  isHeadline: boolean;
  value: number;
  prior: number;
}

// ---------- Cash Flow ----------

export type CashFlowSection = "operating" | "investing" | "financing" | "total";

export interface CashFlowLine {
  label: string;
  section: CashFlowSection;
  value: number;
  isSubtotal: boolean;
}

// ---------- KPIs ----------

export interface KpiCardData {
  label: string;
  value: number;
  format: "currency" | "percent";
  budgetValue: number | null;
  varPct: number | null;
  spark: number[];
}

// ---------- Variance ----------

export interface VarianceRow {
  rank: number;
  territoryKey: number;
  territoryName: string;
  lineId: ProfitAndLossLineId;
  lineLabel: string;
  actual: number;
  budget: number;
  varAbs: number;
  varPct: number | null;
}

export interface VarianceBridgeItem {
  label: string;
  value: number;
}

// ---------- Scenario Modelling ----------

export type ScenarioLeverId = "salesGrowth" | "priceChange" | "cosRate" | "opexChange" | "headcount";

export interface ScenarioLeverDefinition {
  id: ScenarioLeverId;
  label: string;
  min: number;
  max: number;
  step: number;
  base: number;
  unit: string;
}

export interface ScenarioLeverValues {
  salesGrowth: number;
  priceChange: number;
  cosRate: number;
  opexChange: number;
  headcount: number;
}

export type ScenarioType = "base_case" | "custom";

export interface Scenario {
  id: string;
  name: string;
  territoryKey: TerritoryFilter;
  fiscalYear: FiscalYear;
  levers: ScenarioLeverValues;
  scenarioType: ScenarioType;
  lastSavedAt: string;
}

// ---------- Forecast ----------

export type ForecastDriverId = "salesDriver" | "cosDriver" | "opexDriver";

export interface ForecastDriverDefinition {
  id: ForecastDriverId;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export interface ForecastDriverValues {
  salesDriver: number;
  cosDriver: number;
  opexDriver: number;
}

export type ForecastMethod = "budget" | "runrate";

export interface ForecastVersion {
  id: string;
  createdAt: string;
  method: ForecastMethod;
  cutoverMonth: number;
  drivers: ForecastDriverValues;
  fullYearEbitda: number;
  moveVsPrior: number | null;
  varVsBudget: number;
}

// ---------- Territory Performance ----------

export interface TerritoryPerformanceRow {
  territoryKey: number;
  name: string;
  currency: string;
  salesLocal: number;
  salesUsd: number;
  ebitdaUsd: number;
  marginPct: number;
}

export interface FxImpactRow {
  territoryKey: number;
  name: string;
  salesAtCurrentRate: number;
  salesAtPriorRate: number;
  fxEffect: number;
  fxPctOfSales: number;
}

// ---------- Reports ----------

export type ReportType = "monthly_management_pack" | "board_pack" | "territory_review" | "variance_memo";

export type ReportSectionId = "kpi_summary" | "profit_and_loss" | "territory_summary" | "ranked_variances" | "forecast_outlook";

export interface ReportSectionDefinition {
  id: ReportSectionId;
  label: string;
}

export interface GeneratedReport {
  id: string;
  reportType: ReportType;
  territoryKey: TerritoryFilter | null;
  fiscalYear: FiscalYear;
  period: Period;
  currency: CurrencyMode;
  sections: ReportSectionId[];
  generatedAt: string;
}

// ---------- Data Library ----------

export type DatasetId = "gl" | "budget" | "coa" | "territory" | "currency" | "calendar" | "tb" | "cashflow" | "soce" | "calc";

export type ValidationStatus = "pass" | "fail";

export interface Dataset {
  id: DatasetId;
  name: string;
  fileName: string;
  rowCount: number;
  lastRefreshedAt: string;
  validationStatus: ValidationStatus;
}

export interface DatasetCheck {
  label: string;
  result: "pass" | "fail";
}

export interface DatasetIssue {
  id: string;
  datasetId: DatasetId;
  rowRef: string;
  message: string;
}
