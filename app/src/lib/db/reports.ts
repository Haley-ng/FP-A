import { computeProfitAndLoss, resolvePeriodRange } from "./profitAndLoss";
import { varianceRanking } from "./variance";
import { territoryPerformance } from "./territoryPerformance";
import { forecastRows } from "./forecast";
import { query } from "./client";
import { assertFiscalYearExists, assertTerritoryExists, NotFoundError, WriteGuardError } from "./writeGuards";
import { formatCurrency, formatPercentPlain } from "@/lib/fpa/format";
import { PL_LINES } from "@/lib/fpa/sampleData";
import type { CurrencyMode, Period, ProfitAndLossLineId, ReportSectionId, ReportType, TerritoryFilter } from "@/lib/fpa/types";
import { varPct } from "./variance";

export interface ReportBlock {
  title: string;
  head: { label: string }[];
  rows: { cells: { v: string }[] }[];
}

async function buildSection(id: ReportSectionId, territoryKeys: number[] | undefined, year: number, period: string, toUsd: boolean): Promise<ReportBlock> {
  if (id === "profit_and_loss") {
    const stmt = await computeProfitAndLoss({ ...resolvePeriodRange(year, period), territoryKeys }, toUsd);
    return {
      title: "Profit and Loss",
      head: [{ label: "Line" }, { label: "Actual" }, { label: "Budget" }, { label: "Var %" }],
      rows: PL_LINES.map((l) => {
        const v = stmt[l.id];
        return { cells: [{ v: l.label }, { v: formatCurrency(v.actual) }, { v: formatCurrency(v.budget) }, { v: formatPercentPlain(varPct(v.actual, v.budget)) }] };
      }),
    };
  }
  if (id === "kpi_summary") {
    const stmt = await computeProfitAndLoss({ ...resolvePeriodRange(year, period), territoryKeys }, toUsd);
    const margin = stmt.sales.actual !== 0 ? (stmt.ebitda.actual / stmt.sales.actual) * 100 : 0;
    const rows: { cells: { v: string }[] }[] = [
      { cells: [{ v: "Sales" }, { v: formatCurrency(stmt.sales.actual) }, { v: formatPercentPlain(varPct(stmt.sales.actual, stmt.sales.budget)) }] },
      { cells: [{ v: "Gross Profit" }, { v: formatCurrency(stmt.gp.actual) }, { v: formatPercentPlain(varPct(stmt.gp.actual, stmt.gp.budget)) }] },
      { cells: [{ v: "EBITDA" }, { v: formatCurrency(stmt.ebitda.actual) }, { v: formatPercentPlain(varPct(stmt.ebitda.actual, stmt.ebitda.budget)) }] },
      { cells: [{ v: "EBITDA Margin" }, { v: `${margin.toFixed(1)}%` }, { v: "—" }] },
      { cells: [{ v: "Net Profit" }, { v: formatCurrency(stmt.np.actual) }, { v: formatPercentPlain(varPct(stmt.np.actual, stmt.np.budget)) }] },
    ];
    return { title: "KPI Summary", head: [{ label: "Metric" }, { label: "Value" }, { label: "vs Budget" }], rows };
  }
  if (id === "territory_summary") {
    const rows = await territoryPerformance(year, period);
    return {
      title: "Territory Summary",
      head: [{ label: "Territory" }, { label: "Sales (USD)" }, { label: "EBITDA (USD)" }, { label: "Margin" }],
      rows: rows.map((r) => ({ cells: [{ v: r.name }, { v: formatCurrency(r.salesUsd) }, { v: formatCurrency(r.ebitdaUsd) }, { v: `${r.marginPct.toFixed(1)}%` }] })),
    };
  }
  if (id === "ranked_variances") {
    const rows = (await varianceRanking("all", year, period)).slice(0, 10);
    return {
      title: "Ranked Variances",
      head: [{ label: "#" }, { label: "Territory · Line" }, { label: "Var" }, { label: "Var %" }],
      rows: rows.map((r) => ({ cells: [{ v: String(r.rank) }, { v: r.lineLabel }, { v: formatCurrency(r.varAbs) }, { v: formatPercentPlain(r.varPct) }] })),
    };
  }
  // forecast_outlook
  const rows = await forecastRows(year, territoryKeys, toUsd, 7, "budget", { salesDriver: 0, cosDriver: 0, opexDriver: 0 });
  return {
    title: "Forecast Outlook",
    head: [{ label: "Line" }, { label: "Full year" }, { label: "Budget" }, { label: "Var %" }],
    rows: rows.map((r) => {
      const l = PL_LINES.find((line) => line.id === (r.lineId as ProfitAndLossLineId))!;
      return { cells: [{ v: l.label }, { v: formatCurrency(r.total) }, { v: formatCurrency(r.budget) }, { v: formatPercentPlain(r.varPct) }] };
    }),
  };
}

export async function buildReportBlocks(sections: ReportSectionId[], territory: TerritoryFilter, year: number, period: string, toUsd: boolean) {
  const territoryKeys = territory === "all" ? undefined : [territory];
  return Promise.all(sections.map((id) => buildSection(id, territoryKeys, year, period, toUsd)));
}

const REPORT_TYPES: ReportType[] = ["monthly_management_pack", "board_pack", "territory_review", "variance_memo"];
const PERIODS: Period[] = ["fy", "h1", "h2", "q1", "q2", "q3", "q4"];
const CURRENCIES: CurrencyMode[] = ["usd", "local"];
const SECTION_IDS: ReportSectionId[] = ["kpi_summary", "profit_and_loss", "territory_summary", "ranked_variances", "forecast_outlook"];

export interface GenerateReportInput {
  reportType: unknown;
  territoryKey: unknown; // null means All Territories
  fiscalYear: unknown;
  period: unknown;
  currency: unknown;
  sections: unknown;
}

export interface ValidatedReportScope {
  reportType: ReportType;
  territoryKey: number | null;
  fiscalYear: number;
  period: Period;
  currency: CurrencyMode;
  sections: ReportSectionId[];
}

async function validateReportScope(input: GenerateReportInput): Promise<ValidatedReportScope> {
  if (!REPORT_TYPES.includes(input.reportType as ReportType)) {
    throw new WriteGuardError(400, "unknown reportType");
  }
  const fiscalYear = Number(input.fiscalYear);
  await assertFiscalYearExists(fiscalYear);

  let territoryKey: number | null = null;
  if (input.territoryKey !== null && input.territoryKey !== undefined && input.territoryKey !== "all") {
    territoryKey = Number(input.territoryKey);
    await assertTerritoryExists(territoryKey);
  }

  if (!PERIODS.includes(input.period as Period)) {
    throw new WriteGuardError(400, "unknown period");
  }
  if (!CURRENCIES.includes(input.currency as CurrencyMode)) {
    throw new WriteGuardError(400, "unknown currency");
  }
  if (!Array.isArray(input.sections) || input.sections.length === 0) {
    throw new WriteGuardError(400, "at least one section is required");
  }
  for (const s of input.sections) {
    if (!SECTION_IDS.includes(s as ReportSectionId)) {
      throw new WriteGuardError(400, `unknown section: ${s}`);
    }
  }

  return {
    reportType: input.reportType as ReportType,
    territoryKey,
    fiscalYear,
    period: input.period as Period,
    currency: input.currency as CurrencyMode,
    sections: input.sections as ReportSectionId[],
  };
}

export interface ReportRecord {
  id: string;
  reportType: ReportType;
  territoryKey: number | null;
  fiscalYear: number;
  period: Period;
  currency: CurrencyMode;
  sections: ReportSectionId[];
  blocks: ReportBlock[];
  generatedAt: string;
}

interface ReportDbRow {
  id: string;
  report_type: ReportType;
  territory_key: number | null;
  fiscal_year: number;
  period: string;
  currency: CurrencyMode;
  frozen_figures: string;
  generated_at: string;
}

export async function insertReportRow(scope: ValidatedReportScope, blocks: ReportBlock[]): Promise<ReportRecord> {
  const rows = await query<ReportDbRow>(
    `insert into reports (id, report_type, territory_key, fiscal_year, period, currency, frozen_figures, generated_at)
     values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, now())
     returning *`,
    [scope.reportType, scope.territoryKey, scope.fiscalYear, scope.period, scope.currency, JSON.stringify(blocks)]
  );
  const reportId = rows[0].id;
  await query(
    `insert into report_sections (report_id, section_name) select $1, unnest($2::report_section_name[])`,
    [reportId, scope.sections]
  );
  return {
    id: reportId,
    reportType: rows[0].report_type,
    territoryKey: rows[0].territory_key,
    fiscalYear: rows[0].fiscal_year,
    period: rows[0].period as Period,
    currency: rows[0].currency,
    sections: scope.sections,
    blocks,
    generatedAt: rows[0].generated_at,
  };
}

/** Validates the scope, computes live figures right now, and freezes them into one reports row + its report_sections rows (sequence.md #4). */
export async function generateReport(input: GenerateReportInput): Promise<ReportRecord> {
  const scope = await validateReportScope(input);
  const territory: TerritoryFilter = scope.territoryKey === null ? "all" : scope.territoryKey;
  const toUsd = territory === "all" || scope.currency === "usd";
  const blocks = await buildReportBlocks(scope.sections, territory, scope.fiscalYear, scope.period, toUsd);
  return insertReportRow(scope, blocks);
}

export async function getReportById(id: string): Promise<ReportRecord> {
  const reportRows = await query<ReportDbRow>("select * from reports where id = $1", [id]);
  if (reportRows.length === 0) {
    throw new NotFoundError("report not found");
  }
  const sectionRows = await query<{ section_name: ReportSectionId }>("select section_name from report_sections where report_id = $1", [id]);
  const r = reportRows[0];
  return {
    id: r.id,
    reportType: r.report_type,
    territoryKey: r.territory_key,
    fiscalYear: r.fiscal_year,
    period: r.period as Period,
    currency: r.currency,
    sections: sectionRows.map((s) => s.section_name),
    blocks: JSON.parse(r.frozen_figures) as ReportBlock[],
    generatedAt: r.generated_at,
  };
}

/**
 * Recomputes the original report's exact scope and sections fresh, as a new,
 * separate row — the original is never edited (design.md §2, sequence.md #5).
 * No new validation is needed: the scope was already validated when the
 * original report was generated, and it is read back from that row, not
 * re-supplied by the caller.
 */
export async function regenerateReport(id: string): Promise<ReportRecord> {
  const original = await getReportById(id);
  const territory: TerritoryFilter = original.territoryKey === null ? "all" : original.territoryKey;
  const toUsd = territory === "all" || original.currency === "usd";
  const blocks = await buildReportBlocks(original.sections, territory, original.fiscalYear, original.period, toUsd);
  const scope: ValidatedReportScope = {
    reportType: original.reportType,
    territoryKey: original.territoryKey,
    fiscalYear: original.fiscalYear,
    period: original.period,
    currency: original.currency,
    sections: original.sections,
  };
  return insertReportRow(scope, blocks);
}
