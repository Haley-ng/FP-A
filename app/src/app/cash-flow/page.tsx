"use client";

import { useEffect, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { LineChart } from "@/components/fpa/charts";
import { formatCurrency } from "@/lib/fpa/format";
import type { CashFlowSection } from "@/lib/fpa/types";

interface CfLine {
  label: string;
  section: CashFlowSection;
  value: number;
  isSubtotal: boolean;
}

interface CfPayload {
  kpis: { label: string; value: number }[];
  lines: CfLine[];
  monthlyCash: number[];
  months: string[];
}

export default function CashFlowPage() {
  return (
    <AppShell>
      <CashFlowBody />
    </AppShell>
  );
}

function CashFlowBody() {
  const { territory, year, period, currency } = useFpaFilters();
  const [data, setData] = useState<CfPayload | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ territory: String(territory), year: String(year), period, currency });
    fetch(`/api/fpa/cash-flow?${params}`)
      .then((r) => r.json())
      .then(setData);
  }, [territory, year, period, currency]);

  if (!data) return <div style={{ padding: "var(--space-6)" }}>Loading…</div>;

  return (
    <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "var(--space-4)" }}>
        {data.kpis.map((k) => (
          <div key={k.label} className="card">
            <div className="text-muted" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" }}>{k.label}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 26, lineHeight: 1.1 }}>{formatCurrency(k.value)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <h5 style={{ margin: 0 }}>Statement of Cash Flows</h5>
          <div className="text-muted" style={{ fontSize: 11 }}>Indirect method, from Profit Before Tax</div>
          <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "62%" }}>Line</th>
                  <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l, i) => (
                  <tr key={i} style={l.isSubtotal ? { fontWeight: 600, background: "var(--color-neutral-200)" } : undefined}>
                    <td>{l.label}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatCurrency(l.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: "var(--space-4) var(--space-6) var(--space-3)" }}>
          <div>
            <h5 style={{ margin: 0 }}>Cash balance</h5>
            <div className="text-muted" style={{ fontSize: 11 }}>Closing cash by month, FY{year}</div>
          </div>
          <LineChart months={data.months} series={[{ values: data.monthlyCash, color: "var(--color-accent)", width: 2 }]} height={170} />
        </div>
      </div>
    </div>
  );
}
