"use client";

import { useEffect, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { formatCurrency, formatPercentPlain, varianceColor } from "@/lib/fpa/format";

interface BsLine {
  marker: string;
  label: string;
  isSubtotal: boolean;
  isHeadline: boolean;
  value: number;
  prior: number;
}

interface BsPayload {
  rows: BsLine[];
  tie: number;
  kpis: { totalAssets: number; workingCapital: number; netDebt: number; totalEquity: number };
}

export default function BalanceSheetPage() {
  return (
    <AppShell>
      <BalanceSheetBody />
    </AppShell>
  );
}

function BalanceSheetBody() {
  const { territory, year, currency } = useFpaFilters();
  const [data, setData] = useState<BsPayload | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ territory: String(territory), year: String(year), currency });
    fetch(`/api/fpa/balance-sheet?${params}`)
      .then((r) => r.json())
      .then(setData);
  }, [territory, year, currency]);

  if (!data) return <div style={{ padding: "var(--space-6)" }}>Loading…</div>;

  const kpiCards = [
    { label: "Total Assets", value: data.kpis.totalAssets },
    { label: "Working Capital", value: data.kpis.workingCapital },
    { label: "Net Debt", value: data.kpis.netDebt },
    { label: "Total Equity", value: data.kpis.totalEquity },
  ];

  return (
    <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "var(--space-4)" }}>
        {kpiCards.map((k) => (
          <div key={k.label} className="card">
            <div className="text-muted" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" }}>{k.label}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 26, lineHeight: 1.1 }}>{formatCurrency(k.value)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <h5 style={{ margin: 0 }}>As at FY{year} year end vs FY{year - 1}</h5>
          <span className="text-muted" style={{ fontSize: 11 }}>no materiality flag and no Budget column — a balance sheet is a position, not a budgeted target</span>
        </div>
        <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Line</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Balance</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Prior year</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Movement</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Movement %</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => {
                const move = r.value - r.prior;
                const movePct = r.prior !== 0 ? (move / Math.abs(r.prior)) * 100 : null;
                return (
                  <tr key={i} style={r.isHeadline ? { fontWeight: 600, background: "var(--color-neutral-200)" } : r.isSubtotal ? { fontWeight: 600 } : undefined}>
                    <td>
                      {r.marker && <span className="text-muted" style={{ fontFamily: "var(--font-heading)", paddingRight: 6 }}>{r.marker}</span>}
                      {r.label}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatCurrency(r.value)}</td>
                    <td className="text-muted" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatCurrency(r.prior)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap", color: varianceColor(move) }}>{formatCurrency(move)}</td>
                    <td className="text-muted" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatPercentPlain(movePct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: Math.abs(data.tie) < 1 ? "var(--color-pos)" : "var(--color-neg)" }}>
          Balance check — Total Assets minus Total Liabilities &amp; Equity: {formatCurrency(data.tie)} {Math.abs(data.tie) < 1 ? "✓ ties" : "⚠ does not tie"}
        </div>
      </div>
    </div>
  );
}
