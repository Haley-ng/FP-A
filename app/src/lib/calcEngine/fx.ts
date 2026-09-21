import type { CurrencyRate, GlEntry } from "../types";
import type { PeriodFilter } from "./aggregate";

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Amount USD's rate lookup: exact date + territory match, MAX() if duplicates exist. */
export function getExchangeRate(rates: CurrencyRate[], territoryKey: number, date: Date): number | null {
  let best: number | null = null;
  for (const r of rates) {
    if (r.territoryKey !== territoryKey) continue;
    if (!sameDay(r.date, date)) continue;
    if (best === null || r.exchangeRate > best) best = r.exchangeRate;
  }
  return best;
}

export interface ConvertedEntries<T> {
  converted: T[];
  unconvertedCount: number;
}

/**
 * Converts any date+territory+amount entries (GL or Budget rows) to USD using
 * the matching daily rate. Entries with no matching rate are dropped from the
 * result and counted, rather than silently left in local currency mixed in
 * with USD — a hidden currency mismatch would be worse than an undercount.
 */
export function convertEntriesToUsd<T extends { date: Date; territoryKey: number; amount: number }>(
  entries: T[],
  rates: CurrencyRate[],
): ConvertedEntries<T> {
  const converted: T[] = [];
  let unconvertedCount = 0;
  for (const e of entries) {
    const rate = getExchangeRate(rates, e.territoryKey, e.date);
    if (rate === null) {
      unconvertedCount += 1;
      continue;
    }
    converted.push({ ...e, amount: e.amount * rate });
  }
  return { converted, unconvertedCount };
}

export interface UsdConversionResult {
  totalUsd: number;
  /** GL rows whose date+territory had no matching rate — excluded from totalUsd. */
  unconvertedCount: number;
}

/** Amount USD, summed over a filtered set of GL rows — local amount x matching daily rate. */
export function sumGlToUsd(
  gl: GlEntry[],
  rates: CurrencyRate[],
  filter: PeriodFilter,
  accountKeys?: Set<number>,
): UsdConversionResult {
  let totalUsd = 0;
  let unconvertedCount = 0;
  for (const e of gl) {
    if (e.date.getTime() < filter.dateFrom.getTime() || e.date.getTime() > filter.dateTo.getTime()) continue;
    if (filter.territoryKeys && !filter.territoryKeys.includes(e.territoryKey)) continue;
    if (accountKeys && !accountKeys.has(e.accountKey)) continue;
    const rate = getExchangeRate(rates, e.territoryKey, e.date);
    if (rate === null) {
      unconvertedCount += 1;
      continue;
    }
    totalUsd += e.amount * rate;
  }
  return { totalUsd, unconvertedCount };
}
