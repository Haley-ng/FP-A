"use client";

import { useEffect, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { REPORT_SECTIONS, REPORT_TYPES } from "@/lib/fpa/sampleData";
import type { ReportSectionId, ReportType } from "@/lib/fpa/types";

interface ReportBlock {
  title: string;
  head: { label: string }[];
  rows: { cells: { v: string }[] }[];
}

interface ReportsPayload {
  blocks: ReportBlock[];
}

interface GeneratedReport {
  id: string;
  generatedAt: string;
  data: ReportsPayload;
}

const DEFAULT_SECTIONS: Record<ReportSectionId, boolean> = {
  kpi_summary: true,
  profit_and_loss: true,
  territory_summary: true,
  ranked_variances: true,
  forecast_outlook: false,
};

export default function ReportsPage() {
  return (
    <AppShell>
      <ReportsBody />
    </AppShell>
  );
}

function ReportsBody() {
  const { territory, year, period, currency, canEdit } = useFpaFilters();
  const [reportType, setReportType] = useState<ReportType>("monthly_management_pack");
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [generated, setGenerated] = useState<GeneratedReport | null>(null);
  const [preview, setPreview] = useState<ReportsPayload | null>(null);
  const [generateState, setGenerateState] = useState<{ status: "idle" | "generating" | "error"; message?: string }>({ status: "idle" });

  const activeSections = REPORT_SECTIONS.filter((s) => sections[s.id]).map((s) => s.id);

  useEffect(() => {
    const params = new URLSearchParams({ territory: String(territory), year: String(year), period, currency, sections: activeSections.join(",") });
    fetch(`/api/fpa/reports?${params}`)
      .then((r) => r.json())
      .then(setPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory, year, period, currency, JSON.stringify(sections)]);

  async function generate() {
    setGenerateState({ status: "generating" });
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkMode: canEdit ? "edit" : "view",
          reportType,
          territoryKey: territory === "all" ? null : territory,
          fiscalYear: year,
          period,
          currency,
          sections: activeSections,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setGenerateState({ status: "error", message: result.error ?? "Could not generate the report." });
        return;
      }
      const reportRes = await fetch(`/api/reports/${result.report.id}`);
      const reportData = await reportRes.json();
      setGenerated({ id: result.report.id, generatedAt: result.report.generatedAt, data: { blocks: reportData.report.blocks } });
      setGenerateState({ status: "idle" });
    } catch {
      setGenerateState({ status: "error", message: "Could not reach the server." });
    }
  }

  async function regenerate() {
    if (!generated) return;
    setGenerateState({ status: "generating" });
    try {
      const res = await fetch(`/api/reports/${generated.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkMode: canEdit ? "edit" : "view" }),
      });
      const result = await res.json();
      if (!res.ok) {
        setGenerateState({ status: "error", message: result.error ?? "Could not regenerate the report." });
        return;
      }
      const reportRes = await fetch(`/api/reports/${result.report.id}`);
      const reportData = await reportRes.json();
      setGenerated({ id: result.report.id, generatedAt: result.report.generatedAt, data: { blocks: reportData.report.blocks } });
      setGenerateState({ status: "idle" });
    } catch {
      setGenerateState({ status: "error", message: "Could not reach the server." });
    }
  }

  const shown = generated?.data ?? preview;

  return (
    <div style={{ display: "flex", alignItems: "stretch", minHeight: 0 }}>
      <div className="noprint" style={{ width: 312, flex: "none", borderRight: "1px solid var(--color-divider)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <h5 style={{ margin: 0 }}>Compose</h5>
          <div className="field">
            <label>Report type</label>
            <select className="input" value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
              {REPORT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Sections</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
              {REPORT_SECTIONS.map((s) => (
                <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={sections[s.id]}
                    onChange={(e) => setSections((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                    style={{ accentColor: "var(--color-accent)" }}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "var(--space-3)", borderTop: "1px solid var(--color-divider)", paddingTop: "var(--space-4)" }}>
          <div className="text-muted" style={{ fontSize: 11 }}>
            {canEdit ? "Generating freezes the figures currently on screen into a snapshot." : "View-link — generation is edit-link only."}
          </div>
          {canEdit && (
            <button type="button" className="btn btn-primary btn-block" disabled={generateState.status === "generating" || activeSections.length === 0} onClick={generate}>
              {generateState.status === "generating" ? "Generating…" : "Generate report"}
            </button>
          )}
          {generateState.status === "error" && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-neg)" }}>{generateState.message}</p>
          )}
          {generated && canEdit && (
            <button type="button" className="btn btn-secondary btn-block" disabled={generateState.status === "generating"} onClick={regenerate}>
              {generateState.status === "generating" ? "Regenerating…" : "Regenerate"}
            </button>
          )}
          {generated && (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => window.print()}>
                Export PDF
              </button>
              <button type="button" className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => setGenerated(null)}>
                Discard
              </button>
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div className="noprint" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
            <h5 style={{ margin: 0 }}>Preview</h5>
            <span className="text-muted" style={{ fontSize: 11 }}>
              {generated ? `Frozen ${new Date(generated.generatedAt).toLocaleString("en-US")} · id ${generated.id}` : "Live — recalculates with the filter bar"}
            </span>
          </div>
          <span className="tag tag-outline">{generated ? "Generated" : "Draft"}</span>
        </div>
        <div className="card" style={{ padding: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-6)", background: "var(--color-bg)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: "1px solid var(--color-divider)", paddingBottom: "var(--space-4)" }}>
            <div>
              <div className="text-muted" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" }}>{REPORT_TYPES.find((t) => t.id === reportType)?.label}</div>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, lineHeight: 1.1 }}>
                {territory === "all" ? "All territories" : `Territory ${territory}`} · FY{year}
              </div>
            </div>
            <div className="text-muted" style={{ fontSize: 11, textAlign: "right" }}>{new Date().toLocaleDateString("en-US")}</div>
          </div>
          {shown?.blocks.map((b, bi) => (
            <div key={bi} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 16 }}>{b.title}</div>
              <div style={{ overflow: "auto", maxWidth: "100%" }}>
                <table className="table">
                  <thead>
                    <tr>
                      {b.head.map((h, hi) => (
                        <th key={hi} style={hi > 0 ? { textAlign: "right" } : undefined}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.cells.map((c, ci) => (
                          <td key={ci} style={ci > 0 ? { textAlign: "right" } : undefined}>
                            {c.v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
