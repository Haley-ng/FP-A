"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { BridgeChart } from "@/components/fpa/charts";
import { formatCurrency, formatPercentPlain, varianceColor } from "@/lib/fpa/format";
import type { CommentaryRequest } from "@/lib/ai/commentary";
import type { ProfitAndLossLineId, VarianceRow } from "@/lib/fpa/types";

interface VarPayload {
  rows: VarianceRow[];
  lineOptions: { id: string; label: string }[];
  bridge: { row: VarianceRow; items: { label: string; value: number }[] } | null;
}

export default function VarianceAnalysisPage() {
  return (
    <AppShell>
      <VarianceAnalysisBody />
    </AppShell>
  );
}

function VarianceAnalysisBody() {
  const { year, period, canEdit } = useFpaFilters();
  const [line, setLine] = useState<ProfitAndLossLineId | "all">("all");
  const [limit, setLimit] = useState(15);
  const [selected, setSelected] = useState(0);
  const [data, setData] = useState<VarPayload | null>(null);
  const [ai, setAi] = useState<{ status: "idle" | "loading" | "done" | "error"; text?: string }>({ status: "idle" });
  const [saveOrExportState, setSaveOrExportState] = useState<{ status: "idle" | "busy" | "error"; message?: string }>({ status: "idle" });

  function changeLine(next: ProfitAndLossLineId | "all") {
    setLine(next);
    setSelected(0);
    setLimit(15);
  }

  useEffect(() => {
    const params = new URLSearchParams({ year: String(year), period, line, selected: String(selected) });
    fetch(`/api/fpa/variance-analysis?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setAi({ status: "idle" });
      });
  }, [year, period, line, selected]);

  const visibleRows = useMemo(() => data?.rows.slice(0, limit) ?? [], [data, limit]);

  if (!data) return <div style={{ padding: "var(--space-6)" }}>Loading…</div>;

  async function generateCommentary() {
    if (!data?.bridge) return;
    setAi({ status: "loading" });
    const { row, items } = data.bridge;
    const request: CommentaryRequest = {
      title: `${row.territoryName} · ${row.lineLabel} — FY${year}`,
      currencyLabel: "$",
      focus: { label: row.lineLabel, actual: row.actual, budget: row.budget, variance: row.varAbs, pctVariance: row.varPct != null ? row.varPct / 100 : null },
      fullPl: items.map((i) => ({ label: i.label, actual: i.value, budget: 0, variance: i.value, pctVariance: null })),
    };
    try {
      const res = await fetch("/api/commentary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      const result = await res.json();
      setAi(result.error ? { status: "error", text: result.error } : { status: "done", text: result.text });
    } catch {
      setAi({ status: "error", text: "Could not reach the commentary service." });
    }
  }

  async function saveOrExport() {
    setSaveOrExportState({ status: "busy" });
    try {
      const res = await fetch("/api/variance-analysis/save-or-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkMode: canEdit ? "edit" : "view" }),
      });
      const result = await res.json().catch(() => ({}));
      setSaveOrExportState({ status: "error", message: result.error ?? `Request failed (${res.status}).` });
    } catch {
      setSaveOrExportState({ status: "error", message: "Could not reach the server." });
    }
  }

  return (
    <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(520px, 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h5 style={{ margin: 0 }}>Ranked variances</h5>
            <div className="field" style={{ width: 220, margin: 0 }}>
              <select className="input" value={line} onChange={(e) => changeLine(e.target.value as ProfitAndLossLineId | "all")}>
                {data.lineOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>All 7 territories · USD, ranked by absolute variance</div>
          <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>{line === "all" ? "Territory · line" : "Territory"}</th>
                  <th style={{ textAlign: "right" }}>Actual</th>
                  <th style={{ textAlign: "right" }}>Budget</th>
                  <th style={{ textAlign: "right" }}>Var</th>
                  <th style={{ textAlign: "right" }}>Var %</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => (
                  <tr key={i} className="rowpick" style={i === selected ? { background: "var(--color-accent-100)" } : undefined} onClick={() => setSelected(i)}>
                    <td className="text-muted">{r.rank}</td>
                    <td>{r.lineLabel}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatCurrency(r.actual)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatCurrency(r.budget)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatCurrency(r.varAbs)}</td>
                    <td style={{ textAlign: "right", color: varianceColor(r.varPct) }}>{formatPercentPlain(r.varPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            {limit < data.rows.length && (
              <button type="button" className="btn btn-secondary" onClick={() => setLimit((l) => l + 15)}>
                Show 15 more
              </button>
            )}
            <span className="text-muted" style={{ fontSize: 11 }}>
              Showing {visibleRows.length} of {data.rows.length}
            </span>
            {canEdit && (
              <div style={{ display: "flex", gap: "var(--space-2)", marginLeft: "auto" }}>
                <button type="button" className="btn btn-secondary" disabled={saveOrExportState.status === "busy"} onClick={saveOrExport}>
                  Save analysis
                </button>
                <button type="button" className="btn btn-secondary" disabled={saveOrExportState.status === "busy"} onClick={saveOrExport}>
                  Export
                </button>
              </div>
            )}
          </div>
          {saveOrExportState.status === "error" && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-neg)" }}>{saveOrExportState.message}</p>
          )}
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h5 style={{ margin: 0 }}>AI commentary</h5>
            <span className="tag tag-outline">{ai.status === "done" ? "Generated" : "On demand"}</span>
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>Focused on the selected ranked row and the driver bridge below it.</div>
          {ai.status !== "done" ? (
            <button type="button" className="btn btn-primary btn-block" onClick={generateCommentary} disabled={ai.status === "loading" || !data.bridge}>
              {ai.status === "loading" ? "Generating…" : "Generate Commentary"}
            </button>
          ) : (
            <div style={{ borderTop: "1px solid var(--color-divider)", paddingTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{ai.text}</p>
              <a href="#" onClick={(e) => { e.preventDefault(); setAi({ status: "idle" }); }} style={{ fontSize: 11 }}>
                Regenerate
              </a>
            </div>
          )}
          {ai.status === "error" && <p style={{ margin: 0, fontSize: 12, color: "var(--color-neg)" }}>{ai.text}</p>}
        </div>
      </div>

      {data.bridge && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", borderTop: "1px solid var(--color-divider)", paddingTop: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
            <h5 style={{ margin: 0 }}>{data.bridge.row.territoryName} · {data.bridge.row.lineLabel} — driver bridge</h5>
            <span className="text-muted" style={{ fontSize: 11 }}>driver contributions for the selected row</span>
          </div>
          <div className="card" style={{ padding: "var(--space-4) var(--space-6) var(--space-3)" }}>
            <BridgeChart items={data.bridge.items.map((b) => ({ ...b, display: formatCurrency(b.value) }))} />
          </div>
        </div>
      )}
    </div>
  );
}
