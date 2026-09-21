"use client";

import { useEffect, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { LineChart } from "@/components/fpa/charts";
import { formatCurrency, formatPercentPlain, varianceColor, varianceTint } from "@/lib/fpa/format";
import type { ProfitAndLossLineId } from "@/lib/fpa/types";

interface PlRow {
  id: ProfitAndLossLineId;
  label: string;
  actual: number;
  budget: number;
  varAbs: number;
  varPct: number | null;
  pctSales: number;
  headline: boolean;
  drillable: boolean;
}

interface DrillRow {
  accountKey: number | null;
  label: string;
  actual: number;
  budget: number;
  varAbs: number;
  varPct: number | null;
  share: number;
}

interface Drill {
  groupField: string | null;
  title: string;
  colLabel: string;
  rows: DrillRow[];
}

interface GlRow {
  entryNo: number;
  date: string;
  details: string;
  territoryKey: number;
  accountKey: number;
  amount: number;
}

interface PlPayload {
  plRows: PlRow[];
  marginTrend: { months: string[]; actualMargin: number[]; budgetMargin: number[] };
  drill: Drill | null;
  glRows: GlRow[];
}

export default function ProfitAndLossPage() {
  return (
    <AppShell>
      <ProfitAndLossBody />
    </AppShell>
  );
}

function ProfitAndLossBody() {
  const { territory, year, period, currency } = useFpaFilters();
  const [data, setData] = useState<PlPayload | null>(null);
  const [line, setLine] = useState<ProfitAndLossLineId | null>(null);
  // Each entry is one drill step already chosen: [Chart-of-Accounts field, value]. Depth varies by
  // line — some lines (e.g. Sales) reach individual accounts in one step, others need two or three.
  const [path, setPath] = useState<[string, string][]>([]);
  const [account, setAccount] = useState<number | null>(null);

  function resetToLine(newLine: ProfitAndLossLineId | null) {
    setLine(newLine);
    setPath([]);
    setAccount(null);
  }

  useEffect(() => {
    const params = new URLSearchParams({ territory: String(territory), year: String(year), period, currency });
    if (line) params.set("line", line);
    if (path.length) params.set("path", JSON.stringify(path));
    if (account != null) params.set("account", String(account));
    fetch(`/api/fpa/pl?${params}`)
      .then((r) => r.json())
      .then(setData);
  }, [territory, year, period, currency, line, path, account]);

  if (!data) return <div style={{ padding: "var(--space-6)" }}>Loading…</div>;

  const crumbs: { label: string; onClick: () => void }[] = [{ label: "Profit and loss", onClick: () => resetToLine(null) }];
  if (line) {
    const lineLabel = data.plRows.find((r) => r.id === line)?.label ?? line;
    crumbs.push({ label: lineLabel, onClick: () => { setPath([]); setAccount(null); } });
  }
  path.forEach(([, value], i) => {
    crumbs.push({ label: value, onClick: () => { setPath(path.slice(0, i + 1)); setAccount(null); } });
  });
  if (account != null) crumbs.push({ label: "GL transactions", onClick: () => {} });

  return (
    <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 12, minHeight: 22 }}>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); c.onClick(); }} style={i === crumbs.length - 1 ? { fontWeight: 600, color: "var(--color-text)" } : undefined}>
              {c.label}
            </a>
            {i < crumbs.length - 1 && <span className="text-muted">›</span>}
          </span>
        ))}
      </div>

      {!line && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h5 style={{ margin: 0 }}>Profit and loss</h5>
              <span className="text-muted" style={{ fontSize: 11 }}>underlined lines drill into the chart of accounts · flagged past ±5%</span>
            </div>
            <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: "38%" }}>Line</th>
                    <th style={{ textAlign: "right" }}>Actual</th>
                    <th style={{ textAlign: "right" }}>Budget</th>
                    <th style={{ textAlign: "right" }}>Var</th>
                    <th style={{ textAlign: "right" }}>Var %</th>
                    <th style={{ textAlign: "right" }}>% of sales</th>
                  </tr>
                </thead>
                <tbody>
                  {data.plRows.map((r) => (
                    <tr
                      key={r.id}
                      className={r.drillable ? "drillable" : ""}
                      onClick={r.drillable ? () => resetToLine(r.id) : undefined}
                      style={r.headline ? { fontWeight: 600, background: "var(--color-accent-100)" } : undefined}
                    >
                      <td style={r.drillable ? { textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "3px" } : undefined}>{r.label}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(r.actual)}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(r.budget)}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(r.varAbs)}</td>
                      <td style={{ textAlign: "right", color: varianceColor(r.varPct), background: Math.abs(r.varPct ?? 0) >= 5 ? varianceTint(r.varPct) : undefined }}>{formatPercentPlain(r.varPct)}</td>
                      <td className="text-muted" style={{ textAlign: "right" }}>{r.pctSales.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: "var(--space-4) var(--space-6) var(--space-3)" }}>
            <div>
              <h5 style={{ margin: 0 }}>EBITDA margin trend</h5>
              <div className="text-muted" style={{ fontSize: 11 }}>Actual vs budget margin, FY{year}</div>
            </div>
            <LineChart
              months={data.marginTrend.months}
              series={[
                { values: data.marginTrend.budgetMargin, color: "var(--color-accent-300)", dashed: true, width: 1.5 },
                { values: data.marginTrend.actualMargin, color: "var(--color-accent)", width: 2 },
              ]}
            />
          </div>
        </>
      )}

      {line && account == null && data.drill && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h5 style={{ margin: 0 }}>{data.drill.title}</h5>
            <span className="text-muted" style={{ fontSize: 11 }}>click a row to drill further</span>
          </div>
          <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "38%" }}>{data.drill.colLabel}</th>
                  <th style={{ textAlign: "right" }}>Actual</th>
                  <th style={{ textAlign: "right" }}>Budget</th>
                  <th style={{ textAlign: "right" }}>Var</th>
                  <th style={{ textAlign: "right" }}>Var %</th>
                  <th style={{ textAlign: "right" }}>Share of line</th>
                </tr>
              </thead>
              <tbody>
                {data.drill.rows.map((r, i) => (
                  <tr
                    key={r.accountKey ?? `${r.label}-${i}`}
                    className="drillable"
                    onClick={() =>
                      data.drill!.groupField
                        ? setPath((p) => [...p, [data.drill!.groupField as string, r.label]])
                        : setAccount(r.accountKey)
                    }
                  >
                    <td style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "3px" }}>{r.label}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(r.actual)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(r.budget)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(r.varAbs)}</td>
                    <td style={{ textAlign: "right", color: varianceColor(r.varPct) }}>{formatPercentPlain(r.varPct)}</td>
                    <td className="text-muted" style={{ textAlign: "right" }}>{r.share.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {account != null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h5 style={{ margin: 0 }}>Underlying GL transactions</h5>
            <span className="text-muted" style={{ fontSize: 11 }}>{data.glRows.length} transactions</span>
          </div>
          <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Entry</th>
                  <th style={{ width: 110 }}>Date</th>
                  <th>Details</th>
                  <th>Territory</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.glRows.slice(0, 40).map((g) => (
                  <tr key={g.entryNo}>
                    <td>
                      <code style={{ fontSize: 11 }}>{g.entryNo}</code>
                    </td>
                    <td>{g.date}</td>
                    <td>{g.details}</td>
                    <td className="text-muted">{g.territoryKey}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(g.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
