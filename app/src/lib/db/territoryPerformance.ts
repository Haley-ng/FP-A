import { query } from "./client";
import { computeProfitAndLoss } from "./profitAndLoss";
import { resolvePeriodRange } from "./aggregate";
import type { FxImpactRow, TerritoryPerformanceRow } from "@/lib/fpa/types";

interface TerritoryRow {
  territory_key: number;
  country: string;
}

async function territories(): Promise<TerritoryRow[]> {
  return query<TerritoryRow>("select territory_key, country from territory order by territory_key");
}

/** Territory.xlsx carries no currency column — the currency each territory reports in is read off its own currency_rate rows instead. */
async function territoryCurrency(territoryKey: number): Promise<string> {
  const rows = await query<{ currency: string }>("select currency from currency_rate where territory_key = $1 limit 1", [territoryKey]);
  return rows[0]?.currency ?? "USD";
}

/** All 7 territories side by side — the territory filter never applies here (design.md §3 screen 9). */
export async function territoryPerformance(year: number, period: string): Promise<TerritoryPerformanceRow[]> {
  const { dateFrom, dateTo } = resolvePeriodRange(year, period);
  const terrs = await territories();
  return Promise.all(
    terrs.map(async (t) => {
      const [local, usd, currency] = await Promise.all([
        computeProfitAndLoss({ dateFrom, dateTo, territoryKeys: [t.territory_key] }, false),
        computeProfitAndLoss({ dateFrom, dateTo, territoryKeys: [t.territory_key] }, true),
        territoryCurrency(t.territory_key),
      ]);
      return {
        territoryKey: t.territory_key,
        name: t.country,
        currency,
        salesLocal: local.sales.actual,
        salesUsd: usd.sales.actual,
        ebitdaUsd: usd.ebitda.actual,
        marginPct: usd.sales.actual !== 0 ? (usd.ebitda.actual / usd.sales.actual) * 100 : 0,
      };
    })
  );
}

/** Revenue restated at the prior fiscal year's closing rate, to isolate the FX effect from operational performance (design.md §3 screen 9). */
export async function fxImpact(year: number, period: string): Promise<FxImpactRow[]> {
  const { dateFrom, dateTo } = resolvePeriodRange(year, period);
  const terrs = await territories();
  const priorYearEnd = `${year - 1}-12-31`;

  return Promise.all(
    terrs.map(async (t) => {
      const [local, currentRateRows, priorRateRows] = await Promise.all([
        computeProfitAndLoss({ dateFrom, dateTo, territoryKeys: [t.territory_key] }, false),
        query<{ rate: number }>(
          "select max(exchange_rate) as rate from currency_rate where territory_key = $1 and date <= $2",
          [t.territory_key, dateTo]
        ),
        query<{ rate: number }>(
          "select max(exchange_rate) as rate from currency_rate where territory_key = $1 and date <= $2",
          [t.territory_key, priorYearEnd]
        ),
      ]);
      const currentRate = Number(currentRateRows[0]?.rate ?? 1);
      const priorRate = Number(priorRateRows[0]?.rate ?? currentRate);
      const salesLocal = local.sales.actual;
      const atCurrent = salesLocal * currentRate;
      const atPrior = salesLocal * priorRate;
      return {
        territoryKey: t.territory_key,
        name: t.country,
        salesAtCurrentRate: atCurrent,
        salesAtPriorRate: atPrior,
        fxEffect: atCurrent - atPrior,
        fxPctOfSales: atCurrent !== 0 ? ((atCurrent - atPrior) / atCurrent) * 100 : 0,
      };
    })
  );
}
