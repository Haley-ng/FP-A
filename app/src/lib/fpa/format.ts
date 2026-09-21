/** Formatting helpers, ported from the prototype's fmt()/pct()/pctPlain() functions. */

export function formatCurrency(n: number, currencyCode?: string): string {
  const sym = !currencyCode || currencyCode === "USD" ? "$" : "";
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e6) return `${sign}${sym}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}${sym}${(a / 1e3).toFixed(0)}k`;
  return `${sign}${sym}${a.toFixed(0)}`;
}

export function formatPercent(n: number, digits = 1): string {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}%`;
}

export function formatPercentPlain(n: number | null, digits = 1): string {
  if (n == null) return "—";
  return `${n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}%`;
}

export function varianceColor(v: number | null): string {
  if (v == null) return "";
  return v >= 0 ? "var(--color-pos)" : "var(--color-neg)";
}

export function varianceTint(v: number | null): string {
  if (v == null) return "";
  return v >= 0 ? "var(--color-pos-tint)" : "var(--color-neg-tint)";
}
