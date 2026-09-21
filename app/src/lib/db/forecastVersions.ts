import { query } from "./client";
import { assertFiscalYearExists, assertTerritoryExists, WriteGuardError } from "./writeGuards";
import { forecastRows } from "./forecast";
import { FORECAST_DRIVERS } from "@/lib/fpa/sampleData";
import type { ForecastDriverValues, ForecastMethod } from "@/lib/fpa/types";

export interface ForecastVersionRecord {
  id: string;
  territoryKey: number;
  fiscalYear: number;
  cutoverMonth: number;
  method: ForecastMethod;
  drivers: ForecastDriverValues;
  fullYearEbitda: number;
  varVsBudget: number;
  moveVsPrior: number | null;
  createdAt: string;
}

interface ForecastVersionDbRow {
  id: string;
  territory_key: number;
  fiscal_year: number;
  cutover_month: number;
  method: ForecastMethod;
  sales_driver: string;
  cos_driver: string;
  opex_driver: string;
  full_year_ebitda: string;
  var_vs_budget: string;
  created_at: string;
}

function validateDrivers(input: Partial<Record<keyof ForecastDriverValues, unknown>>): ForecastDriverValues {
  const result = {} as ForecastDriverValues;
  for (const def of FORECAST_DRIVERS) {
    const raw = input[def.id];
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      throw new WriteGuardError(400, `${def.id} is required and must be a number`);
    }
    if (value < def.min || value > def.max) {
      throw new WriteGuardError(400, `${def.id} is out of range (${def.min} to ${def.max})`);
    }
    result[def.id] = value;
  }
  return result;
}

function validateCutover(cutover: unknown): number {
  const month = Number(cutover);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new WriteGuardError(400, "cutover must be an integer month between 1 and 12");
  }
  return month;
}

function validateMethod(method: unknown): ForecastMethod {
  if (method !== "budget" && method !== "runrate") {
    throw new WriteGuardError(400, "unknown method");
  }
  return method;
}

export interface SaveForecastVersionInput {
  territoryKey: unknown;
  fiscalYear: unknown;
  cutover: unknown;
  method: unknown;
  salesDriver: unknown;
  cosDriver: unknown;
  opexDriver: unknown;
  currency: unknown;
}

/** Validates the scope, recomputes the forecast right now (same engine the Forecast screen renders), and freezes the EBITDA outcome into one forecast_versions row (sequence.md #6). */
export async function saveForecastVersion(input: SaveForecastVersionInput): Promise<ForecastVersionRecord> {
  const territoryKey = Number(input.territoryKey);
  await assertTerritoryExists(territoryKey);
  const fiscalYear = Number(input.fiscalYear);
  await assertFiscalYearExists(fiscalYear);
  const cutoverMonth = validateCutover(input.cutover);
  const method = validateMethod(input.method);
  const drivers = validateDrivers(input);
  const toUsd = input.currency !== "local";

  const rows = await forecastRows(fiscalYear, [territoryKey], toUsd, cutoverMonth, method, drivers);
  const ebitdaRow = rows.find((r) => r.lineId === "ebitda")!;

  const inserted = await query<ForecastVersionDbRow>(
    `insert into forecast_versions (id, territory_key, fiscal_year, cutover_month, method, sales_driver, cos_driver, opex_driver, full_year_ebitda, var_vs_budget, created_at)
     values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     returning *`,
    [territoryKey, fiscalYear, cutoverMonth, method, drivers.salesDriver, drivers.cosDriver, drivers.opexDriver, ebitdaRow.total, ebitdaRow.varAbs]
  );
  return toRecord(inserted[0], null);
}

function toRecord(r: ForecastVersionDbRow, moveVsPrior: number | null): ForecastVersionRecord {
  return {
    id: r.id,
    territoryKey: r.territory_key,
    fiscalYear: r.fiscal_year,
    cutoverMonth: r.cutover_month,
    method: r.method,
    drivers: { salesDriver: Number(r.sales_driver), cosDriver: Number(r.cos_driver), opexDriver: Number(r.opex_driver) },
    fullYearEbitda: Number(r.full_year_ebitda),
    varVsBudget: Number(r.var_vs_budget),
    moveVsPrior,
    createdAt: r.created_at,
  };
}

/** Version history for one territory + fiscal year, oldest first, each row's "move vs prior" computed against the row before it. */
export async function listForecastVersions(territoryKey: number, fiscalYear: number): Promise<ForecastVersionRecord[]> {
  const rows = await query<ForecastVersionDbRow>(
    "select * from forecast_versions where territory_key = $1 and fiscal_year = $2 order by created_at asc",
    [territoryKey, fiscalYear]
  );
  let prior: number | null = null;
  return rows.map((r) => {
    const ebitda = Number(r.full_year_ebitda);
    const record = toRecord(r, prior === null ? null : ebitda - prior);
    prior = ebitda;
    return record;
  });
}
