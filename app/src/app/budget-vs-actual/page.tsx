"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { formatCurrency, formatPercentPlain, varianceColor, varianceTint } from "@/lib/fpa/format";
import type { CommentaryRequest } from "@/lib/ai/commentary";
import type { ProfitAndLossLineId } from "@/lib/fpa/types";

interface PlRow {
  id: ProfitAndLossLineId;
  label: string;
  actual: number;
  budget: number;
  varAbs: number;
  varPct: number | null;
  headline: boolean;
  drillable: boolean;
}

interface BvaPayload {
  plRows: PlRow[];
  focusLine: PlRow;
}

export default function BudgetVsActualPage() {
  return (
    <AppShell>
      <BudgetVsActualBody />
    </AppShell>
  );
}

function BudgetVsActualBody() {
  const { territory, year, period, currency } = useFpaFilters();
  const [data, setData] = useState<BvaPayload | null>(null);
  const [ai, setAi] = useState<{ status: "idle" | "loading" | "done" | "error"; text?: string }>({ status: "idle" });

  useEffect(() => {
    const params = new URLSearchParams({ territory: String(territory), year: String(year), period, currency });
    fetch(`/api/fpa/budget-vs-actual?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setAi({ status: "idle" });
      });
  }, [territory, year, period, currency]);

  if (!data) return <div style={{ padding: "var(--space-6)" }}>Loading…</div>;

  async function generateCommentary() {
    if (!data) return;
    setAi({ status: "loading" });
    const request: CommentaryRequest = {
      title: `EBITDA — FY${year}`,
      currencyLabel: currency === "usd" ? "$" : "",
      focus: {
        label: data.focusLine.label,
        actual: data.focusLine.actual,
        budget: data.focusLine.budget,
        variance: data.focusLine.varAbs,
        pctVariance: data.focusLine.varPct != null ? data.focusLine.varPct / 100 : null,
      },
      fullPl: data.plRows.map((r) => ({ label: r.label, actual: r.actual, budget: r.budget, variance: r.varAbs, pctVariance: r.varPct != null ? r.varPct / 100 : null })),
    };
    try {
      const res = await fetch("/api/commentary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      const result = await res.json();
      setAi(result.error ? { status: "error", text: result.error } : { status: "done", text: result.text });
    } catch {
      setAi({ status: "error", text: "Could not reach the commentary service." });
    }
  }

  return (
    <div style={{ padding: "var(--space-6)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h5 style={{ margin: 0 }}>All P&amp;L lines against budget</h5>
          <span className="text-muted" style={{ fontSize: 11 }}>⚠ beyond ±5% · drillable lines open in the P&amp;L</span>
        </div>
        <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "34%" }}>Line</th>
                <th style={{ textAlign: "right" }}>Actual</th>
                <th style={{ textAlign: "right" }}>Budget</th>
                <th style={{ textAlign: "right" }}>Var</th>
                <th style={{ textAlign: "right" }}>Var %</th>
              </tr>
            </thead>
            <tbody>
              {data.plRows.map((r) => (
                <tr key={r.id} style={r.headline ? { fontWeight: 600, background: "var(--color-accent-100)" } : undefined}>
                  <td style={r.drillable ? { textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "3px" } : undefined}>
                    {r.drillable ? (
                      <Link href={`/pl?${new URLSearchParams({ territory: String(territory), year: String(year), period, currency, line: r.id }).toString()}`}>{r.label}</Link>
                    ) : (
                      r.label
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.actual)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.budget)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.varAbs)}</td>
                  <td style={{ textAlign: "right", color: varianceColor(r.varPct), background: Math.abs(r.varPct ?? 0) >= 5 ? varianceTint(r.varPct) : undefined }}>{formatPercentPlain(r.varPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h5 style={{ margin: 0 }}>AI commentary</h5>
          <span className="tag tag-outline">{ai.status === "done" ? "Generated" : "On demand"}</span>
        </div>
        <div className="text-muted" style={{ fontSize: 11 }}>
          Sends the figures currently on screen — {data.focusLine.label} as the focus line, the full P&amp;L as context — and returns what happened.
        </div>
        <div style={{ borderTop: "1px solid var(--color-divider)", paddingTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="text-muted" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" }}>Context sent</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
            <span className="text-muted">Focus line</span>
            <span>{data.focusLine.label}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
            <span className="text-muted">Variance</span>
            <span>
              {formatCurrency(data.focusLine.varAbs)} ({formatPercentPlain(data.focusLine.varPct)})
            </span>
          </div>
        </div>
        {ai.status !== "done" ? (
          <button type="button" className="btn btn-primary btn-block" onClick={generateCommentary} disabled={ai.status === "loading"}>
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
  );
}
