"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { DualBarChart, Sparkline } from "@/components/fpa/charts";
import { formatCurrency, formatPercentPlain, varianceColor } from "@/lib/fpa/format";
import type { KpiCardData, VarianceRow } from "@/lib/fpa/types";

interface TerritoryRow {
  key: number;
  name: string;
  sales: number;
  gp: number;
  ebitda: number;
  np: number;
}

interface ExecPayload {
  kpis: KpiCardData[];
  months: string[];
  bars: { actual: number[]; budget: number[] };
  lineOptions: { id: string; label: string }[];
  territoryRows: TerritoryRow[];
  attention: VarianceRow[];
  currencyCode: string;
}

export default function ExecutiveOverviewPage() {
  return (
    <AppShell>
      <ExecutiveOverviewBody />
    </AppShell>
  );
}

function ExecutiveOverviewBody() {
  const { territory, year, period, currency, queryString } = useFpaFilters();
  const [data, setData] = useState<ExecPayload | null>(null);
  const [barsLine, setBarsLine] = useState("sales");
  const [barsMode, setBarsMode] = useState<"monthly" | "cumulative">("monthly");

  useEffect(() => {
    const params = new URLSearchParams({ territory: String(territory), year: String(year), period, currency, barsLine });
    fetch(`/api/fpa/executive-overview?${params}`)
      .then((r) => r.json())
      .then(setData);
  }, [territory, year, period, currency, barsLine]);

  if (!data) return <div style={{ padding: "var(--space-6)" }}>Loading…</div>;

  const cumulative = (values: number[]) => {
    let running = 0;
    return values.map((v) => (running += v));
  };
  const barsActual = barsMode === "cumulative" ? cumulative(data.bars.actual) : data.bars.actual;
  const barsBudget = barsMode === "cumulative" ? cumulative(data.bars.budget) : data.bars.budget;

  return (
    <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "var(--space-4)" }}>
        {data.kpis.map((k) => (
          <div key={k.label} className="card">
            <div className="card-kicker">{k.label}</div>
            <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 28, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {k.format === "percent" ? `${k.value.toFixed(1)}%` : formatCurrency(k.value, data.currencyCode)}
            </div>
            <div className="card-meta" style={{ display: "flex", flexWrap: "wrap", gap: "0 5px" }}>
              <span style={{ whiteSpace: "nowrap" }}>Budget {k.format === "percent" ? `${(k.budgetValue ?? 0).toFixed(1)}%` : formatCurrency(k.budgetValue ?? 0, data.currencyCode)}</span>
              <span style={{ color: varianceColor(k.varPct), whiteSpace: "nowrap" }}>· {formatPercentPlain(k.varPct)}</span>
            </div>
            <Sparkline values={k.spark} />
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "var(--space-4) var(--space-6) var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-6)" }}>
          <div>
            <h5 style={{ margin: 0 }}>Actual vs Budget</h5>
            <div className="text-muted" style={{ fontSize: 11 }}>Monthly, FY{year}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
            <div style={{ display: "flex", gap: "var(--space-4)", fontSize: 11 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, background: "var(--color-accent)", display: "block" }} />
                Actual
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, background: "var(--color-accent-300)", display: "block" }} />
                Budget
              </span>
            </div>
            <div className="seg">
              <label className="seg-opt">
                <input type="radio" name="plmode" checked={barsMode === "monthly"} onChange={() => setBarsMode("monthly")} />
                <span>Monthly</span>
              </label>
              <label className="seg-opt">
                <input type="radio" name="plmode" checked={barsMode === "cumulative"} onChange={() => setBarsMode("cumulative")} />
                <span>Cumulative</span>
              </label>
            </div>
            <div className="field" style={{ width: 150, margin: 0 }}>
              <select className="input" value={barsLine} onChange={(e) => setBarsLine(e.target.value)}>
                {data.lineOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <DualBarChart months={data.months} actual={barsActual} budget={barsBudget} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h5 style={{ margin: 0 }}>P&amp;L summary by territory</h5>
            <Link href={`/pl${queryString ? `?${queryString}` : ""}`} style={{ fontSize: 12 }}>
              Open full P&amp;L →
            </Link>
          </div>
          <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Territory</th>
                  <th style={{ textAlign: "right" }}>Sales</th>
                  <th style={{ textAlign: "right" }}>Gross profit</th>
                  <th style={{ textAlign: "right" }}>EBITDA</th>
                  <th style={{ textAlign: "right" }}>Net profit</th>
                </tr>
              </thead>
              <tbody>
                {data.territoryRows.map((r) => (
                  <tr key={r.key} className="rowpick">
                    <td>
                      <Link href={`/?${new URLSearchParams({ territory: String(r.key), year: String(year), period, currency }).toString()}`}>{r.name}</Link>
                    </td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(r.sales)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(r.gp)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(r.ebitda)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(r.np)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h5 style={{ margin: 0 }}>Requires attention</h5>
            <span className="text-muted" style={{ fontSize: 11 }}>beyond ±5%</span>
          </div>
          <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Territory · line</th>
                  <th style={{ textAlign: "right" }}>Var</th>
                  <th style={{ textAlign: "right" }}>Var %</th>
                </tr>
              </thead>
              <tbody>
                {data.attention.map((a, i) => (
                  <tr key={i} className="rowpick">
                    <td>
                      <Link href={`/variance-analysis?${new URLSearchParams({ year: String(year), period, line: a.lineId }).toString()}`}>{a.lineLabel}</Link>
                    </td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(a.varAbs)}</td>
                    <td style={{ textAlign: "right", color: varianceColor(a.varPct) }}>{formatPercentPlain(a.varPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link className="btn btn-secondary btn-block" href={`/variance-analysis${queryString ? `?${queryString}` : ""}`}>
            Rank all variances →
          </Link>
        </div>
      </div>
    </div>
  );
}
