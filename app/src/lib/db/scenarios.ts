import { query } from "./client";
import { NotFoundError, WriteGuardError } from "./writeGuards";
import { SCENARIO_LEVERS } from "@/lib/fpa/sampleData";
import type { ScenarioLeverValues, ScenarioType, TerritoryFilter } from "@/lib/fpa/types";

export interface ScenarioRecord {
  id: string;
  name: string;
  territoryKey: TerritoryFilter;
  fiscalYear: number;
  levers: ScenarioLeverValues;
  scenarioType: ScenarioType;
  lastSavedAt: string;
}

interface ScenarioDbRow {
  id: string;
  name: string;
  territory_key: number;
  fiscal_year: number;
  sales_growth: string;
  price_change: string;
  cost_of_sales_rate: string;
  opex_change: string;
  headcount_change: number;
  scenario_type: ScenarioType;
  last_saved_at: string;
}

function toRecord(r: ScenarioDbRow): ScenarioRecord {
  return {
    id: r.id,
    name: r.name,
    territoryKey: r.territory_key,
    fiscalYear: r.fiscal_year,
    levers: {
      salesGrowth: Number(r.sales_growth),
      priceChange: Number(r.price_change),
      cosRate: Number(r.cost_of_sales_rate),
      opexChange: Number(r.opex_change),
      headcount: r.headcount_change,
    },
    scenarioType: r.scenario_type,
    lastSavedAt: r.last_saved_at,
  };
}

/** Throws WriteGuardError(400, ...) naming the specific bad field — never a generic "invalid" message. */
function validateLevers(levers: Partial<Record<keyof ScenarioLeverValues, unknown>>): ScenarioLeverValues {
  const result = {} as ScenarioLeverValues;
  for (const def of SCENARIO_LEVERS) {
    const raw = levers[def.id];
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      throw new WriteGuardError(400, `${def.id} is required and must be a number`);
    }
    if (value < def.min || value > def.max) {
      throw new WriteGuardError(400, `${def.id} is out of range (${def.min} to ${def.max})`);
    }
    result[def.id] = def.id === "headcount" ? Math.round(value) : value;
  }
  return result;
}

async function validateTerritoryKey(territoryKey: unknown): Promise<TerritoryFilter> {
  if (territoryKey === "all") return "all";
  const key = Number(territoryKey);
  if (!Number.isInteger(key)) {
    throw new WriteGuardError(400, "territoryKey does not exist");
  }
  const rows = await query<{ territory_key: number }>("select territory_key from territory where territory_key = $1", [key]);
  if (rows.length === 0) {
    throw new WriteGuardError(400, "territoryKey does not exist");
  }
  return key;
}

async function validateFiscalYear(fiscalYear: unknown): Promise<number> {
  const year = Number(fiscalYear);
  if (!Number.isInteger(year)) {
    throw new WriteGuardError(400, "fiscalYear does not exist");
  }
  const rows = await query<{ year: number }>("select year from fiscal_years where year = $1", [year]);
  if (rows.length === 0) {
    throw new WriteGuardError(400, "fiscalYear does not exist");
  }
  return year;
}

function validateName(name: unknown): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (trimmed.length < 1 || trimmed.length > 200) {
    throw new WriteGuardError(400, "name is required (1-200 characters)");
  }
  return trimmed;
}

export interface InsertScenarioInput {
  name: unknown;
  territoryKey: unknown;
  fiscalYear: unknown;
  salesGrowth: unknown;
  priceChange: unknown;
  cosRate: unknown;
  opexChange: unknown;
  headcount: unknown;
}

export async function insertScenario(input: InsertScenarioInput): Promise<ScenarioRecord> {
  const name = validateName(input.name);
  const territoryKey = await validateTerritoryKey(input.territoryKey);
  const fiscalYear = await validateFiscalYear(input.fiscalYear);
  const levers = validateLevers(input);

  // territory_key is an integer FK column in the schema — "all" (All Territories) has no row to
  // reference, so it is not persisted as a literal value here. Every scenario created through
  // this endpoint is scoped to one specific territory; "all" is rejected as out of scope for now.
  if (territoryKey === "all") {
    throw new WriteGuardError(400, "territoryKey does not exist");
  }

  const rows = await query<ScenarioDbRow>(
    `insert into scenarios (id, name, territory_key, fiscal_year, sales_growth, price_change, cost_of_sales_rate, opex_change, headcount_change, scenario_type, last_saved_at)
     values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, 'custom', now())
     returning *`,
    [name, territoryKey, fiscalYear, levers.salesGrowth, levers.priceChange, levers.cosRate, levers.opexChange, levers.headcount]
  );
  return toRecord(rows[0]);
}

export async function listScenarios(): Promise<ScenarioRecord[]> {
  const rows = await query<ScenarioDbRow>("select * from scenarios order by last_saved_at desc");
  return rows.map(toRecord);
}

export interface UpdateScenarioLeversInput {
  salesGrowth: unknown;
  priceChange: unknown;
  cosRate: unknown;
  opexChange: unknown;
  headcount: unknown;
}

/** Only the 5 lever values change on an update — territory_key and fiscal_year are fixed at creation (sequence.md #1). */
export async function updateScenarioLevers(id: string, input: UpdateScenarioLeversInput): Promise<ScenarioRecord> {
  const levers = validateLevers(input);
  const rows = await query<ScenarioDbRow>(
    `update scenarios
     set sales_growth = $1, price_change = $2, cost_of_sales_rate = $3, opex_change = $4, headcount_change = $5, last_saved_at = now()
     where id = $6
     returning *`,
    [levers.salesGrowth, levers.priceChange, levers.cosRate, levers.opexChange, levers.headcount, id]
  );
  if (rows.length === 0) {
    throw new NotFoundError("scenario not found");
  }
  return toRecord(rows[0]);
}

export async function deleteScenario(id: string): Promise<void> {
  const rows = await query<{ id: string }>("delete from scenarios where id = $1 returning id", [id]);
  if (rows.length === 0) {
    throw new NotFoundError("scenario not found");
  }
}
