"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { formatCurrency, varianceColor } from "@/lib/fpa/format";
import type { FxImpactRow, TerritoryPerformanceRow } from "@/lib/fpa/types";

interface TerritoryPayload {
  rows: TerritoryPerformanceRow[];
  fxRows: FxImpactRow[];
  marginCeiling: number;
}

export default function TerritoryPerformancePage() {
  return (
    <AppShell>
      <TerritoryPerformanceBody />
    </AppShell>
  );
}

function TerritoryPerformanceBody() {
  const { year, period } = useFpaFilters();
  const [data, setData] = useState<TerritoryPayload | null>(null);
  const [sortKey, setSortKey] = useState<"name" | "salesLocal" | "ebitdaUsd" | "marginPct">("ebitdaUsd");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  useEffect(() => {
    const params = new URLSearchParams({ year: String(year), period });
    fetch(`/api/fpa/territory-performance?${params}`)
      .then((r) => r.json())
      .then(setData);
  }, [year, period]);

  if (!data) return <div style={{ padding: "var(--space-6)" }}>Loading…</div>;

  const sorted = [...data.rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * sortDir;
    return ((av as number) - (bv as number)) * sortDir;
  });

  const toggleSort = (key: typeof sortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  };

  return (
    <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div className="text-muted" style={{ fontSize: 11, maxWidth: "100ch" }}>
        All seven territories at once, so the territory filter does not apply here. Bars read EBITDA margin against a {data.marginCeiling}% ceiling, which keeps the seven comparable even though the revenue figures beside them are in seven currencies.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h5 style={{ margin: 0 }}>KPIs by territory</h5>
          <span className="text-muted" style={{ fontSize: 11 }}>click a territory to open it pre-filtered on Executive Overview</span>
        </div>
        <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
          <table className="table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("name")}>Territory</th>
                <th>Cur</th>
                <th className="sortable" onClick={() => toggleSort("salesLocal")} style={{ textAlign: "right" }}>Sales (local)</th>
                <th style={{ textAlign: "right" }}>Sales (USD)</th>
                <th className="sortable" onClick={() => toggleSort("ebitdaUsd")} style={{ textAlign: "right" }}>EBITDA (USD)</th>
                <th className="sortable" onClick={() => toggleSort("marginPct")} style={{ textAlign: "right" }}>Margin</th>
                <th style={{ width: 150 }}>Margin vs {data.marginCeiling}%</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.territoryKey} className="rowpick">
                  <td>
                    <Link href={`/?${new URLSearchParams({ territory: String(t.territoryKey), year: String(year), period }).toString()}`}>{t.name}</Link>
                  </td>
                  <td className="text-muted">{t.currency}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(t.salesLocal, t.currency)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(t.salesUsd)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(t.ebitdaUsd)}</td>
                  <td style={{ textAlign: "right" }}>{t.marginPct.toFixed(1)}%</td>
                  <td>
                    <div style={{ height: 10, background: "var(--color-accent-100)" }}>
                      <div style={{ height: "100%", width: `${Math.min((t.marginPct / data.marginCeiling) * 100, 100)}%`, background: "var(--color-accent)" }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", borderTop: "1px solid var(--color-divider)", paddingTop: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
          <h5 style={{ margin: 0 }}>FX impact, separated from operational performance</h5>
          <span className="text-muted" style={{ fontSize: 11 }}>revenue restated at the prior-year closing rate</span>
        </div>
        <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Territory</th>
                <th style={{ textAlign: "right" }}>Sales at current rate</th>
                <th style={{ textAlign: "right" }}>Sales at prior rate</th>
                <th style={{ textAlign: "right" }}>FX effect</th>
                <th style={{ textAlign: "right" }}>FX % of sales</th>
              </tr>
            </thead>
            <tbody>
              {data.fxRows.map((f) => (
                <tr key={f.territoryKey}>
                  <td>{f.name}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(f.salesAtCurrentRate)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(f.salesAtPriorRate)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(f.fxEffect)}</td>
                  <td style={{ textAlign: "right", color: varianceColor(f.fxPctOfSales) }}>{f.fxPctOfSales.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
