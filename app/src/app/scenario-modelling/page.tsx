"use client";

import { useEffect, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { formatCurrency, formatPercentPlain, varianceColor } from "@/lib/fpa/format";
import { SCENARIO_LEVERS } from "@/lib/fpa/sampleData";
import type { ProfitAndLossLineId, ScenarioLeverValues } from "@/lib/fpa/types";

interface ScenarioRow {
  id: ProfitAndLossLineId;
  label: string;
  base: number;
  scenario: number;
  delta: number;
  deltaPct: number | null;
  headline: boolean;
}

interface ScenarioKpi {
  label: string;
  base: number;
  value: number;
  delta: number;
  deltaPct: number | null;
}

interface SavedScenario {
  id: string;
  name: string;
  ebitda: number;
  territoryKey: number;
  fiscalYear: number;
  levers: ScenarioLeverValues;
}

interface ScenarioPayload {
  scenarioRows: ScenarioRow[];
  kpis: ScenarioKpi[];
  savedScenarios: SavedScenario[];
}

const DEFAULT_LEVERS: ScenarioLeverValues = { salesGrowth: 0, priceChange: 0, cosRate: 0, opexChange: 0, headcount: 0 };

export default function ScenarioModellingPage() {
  return (
    <AppShell>
      <ScenarioModellingBody />
    </AppShell>
  );
}

function ScenarioModellingBody() {
  const { territory, year, currency, canEdit } = useFpaFilters();
  const [levers, setLevers] = useState<ScenarioLeverValues>(DEFAULT_LEVERS);
  const [data, setData] = useState<ScenarioPayload | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [saveState, setSaveState] = useState<{ status: "idle" | "saving" | "error"; message?: string }>({ status: "idle" });
  const [loadedScenarioId, setLoadedScenarioId] = useState<string | null>(null);
  const [loadedScenarioName, setLoadedScenarioName] = useState("");

  function scenarioQueryParams() {
    return new URLSearchParams({
      territory: String(territory),
      year: String(year),
      currency,
      salesGrowth: String(levers.salesGrowth),
      priceChange: String(levers.priceChange),
      cosRate: String(levers.cosRate),
      opexChange: String(levers.opexChange),
      headcount: String(levers.headcount),
    });
  }

  async function saveAsNew() {
    setSaveState({ status: "saving" });
    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkMode: canEdit ? "edit" : "view",
          name: scenarioName,
          territoryKey: territory,
          fiscalYear: year,
          ...levers,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setSaveState({ status: "error", message: result.error ?? "Could not save the scenario." });
        return;
      }
      setSaveState({ status: "idle" });
      setScenarioName("");
      fetch(`/api/fpa/scenario-modelling?${scenarioQueryParams()}`)
        .then((r) => r.json())
        .then(setData);
    } catch {
      setSaveState({ status: "error", message: "Could not reach the server." });
    }
  }

  async function saveExisting() {
    if (!loadedScenarioId) return;
    setSaveState({ status: "saving" });
    try {
      const res = await fetch(`/api/scenarios/${loadedScenarioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkMode: canEdit ? "edit" : "view", ...levers }),
      });
      const result = await res.json();
      if (!res.ok) {
        setSaveState({ status: "error", message: result.error ?? "Could not save the scenario." });
        return;
      }
      setSaveState({ status: "idle" });
      fetch(`/api/fpa/scenario-modelling?${scenarioQueryParams()}`)
        .then((r) => r.json())
        .then(setData);
    } catch {
      setSaveState({ status: "error", message: "Could not reach the server." });
    }
  }

  function loadScenario(s: SavedScenario) {
    setLoadedScenarioId(s.id);
    setLoadedScenarioName(s.name);
    setLevers(s.levers);
    setSaveState({ status: "idle" });
  }

  function startNewScenario() {
    setLoadedScenarioId(null);
    setLoadedScenarioName("");
    setScenarioName("");
    setLevers(DEFAULT_LEVERS);
    setSaveState({ status: "idle" });
  }

  async function removeScenario(id: string) {
    setSaveState({ status: "saving" });
    try {
      const res = await fetch(`/api/scenarios/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkMode: canEdit ? "edit" : "view" }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        setSaveState({ status: "error", message: result.error ?? "Could not delete the scenario." });
        return;
      }
      setSaveState({ status: "idle" });
      if (id === loadedScenarioId) startNewScenario();
      fetch(`/api/fpa/scenario-modelling?${scenarioQueryParams()}`)
        .then((r) => r.json())
        .then(setData);
    } catch {
      setSaveState({ status: "error", message: "Could not reach the server." });
    }
  }

  useEffect(() => {
    fetch(`/api/fpa/scenario-modelling?${scenarioQueryParams()}`)
      .then((r) => r.json())
      .then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territory, year, currency, levers]);

  if (!data) return <div style={{ padding: "var(--space-6)" }}>Loading…</div>;

  return (
    <div style={{ padding: "var(--space-6)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h5 style={{ margin: 0 }}>Assumptions</h5>
          <span className="text-muted" style={{ fontSize: 11 }}>Base Case in grey</span>
        </div>
        {canEdit ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {SCENARIO_LEVERS.map((l) => (
                <div key={l.id} className="field" style={{ margin: 0 }}>
                  <label style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span>{l.label}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 12.5 }}>
                      {levers[l.id] > 0 ? "+" : ""}
                      {levers[l.id]}
                      {l.unit}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={l.min}
                    max={l.max}
                    step={l.step}
                    value={levers[l.id]}
                    onChange={(e) => setLevers((prev) => ({ ...prev, [l.id]: Number(e.target.value) }))}
                    style={{ width: "100%", accentColor: "var(--color-accent)" }}
                  />
                  <span className="text-muted" style={{ fontSize: 10.5 }}>Base Case {l.base}{l.unit}</span>
                </div>
              ))}
            </div>
            {loadedScenarioId ? (
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", fontSize: 12.5 }}>
                <span>
                  Editing <strong>{loadedScenarioName}</strong>
                </span>
                <a href="#" onClick={(e) => { e.preventDefault(); startNewScenario(); }} style={{ fontSize: 11 }}>
                  New scenario
                </a>
              </div>
            ) : (
              <div className="field" style={{ margin: 0 }}>
                <label>Scenario name</label>
                <input
                  className="input"
                  type="text"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="e.g. Upside case — price led"
                  maxLength={200}
                />
              </div>
            )}
            {territory === "all" && !loadedScenarioId && (
              <span className="text-muted" style={{ fontSize: 11 }}>
                Select a single territory in the filter bar before saving — a Scenario must belong to exactly one territory.
              </span>
            )}
            <div style={{ display: "flex", gap: "var(--space-2)", borderTop: "1px solid var(--color-divider)", paddingTop: "var(--space-3)" }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, fontSize: 12 }} onClick={() => setLevers(DEFAULT_LEVERS)}>
                Reset to Base
              </button>
              {loadedScenarioId ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: 12 }}
                  disabled={saveState.status === "saving"}
                  onClick={saveExisting}
                >
                  {saveState.status === "saving" ? "Saving…" : "Save"}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: 12 }}
                  disabled={saveState.status === "saving" || territory === "all" || scenarioName.trim().length === 0}
                  onClick={saveAsNew}
                >
                  {saveState.status === "saving" ? "Saving…" : "Save scenario"}
                </button>
              )}
            </div>
            {saveState.status === "error" && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--color-neg)" }}>{saveState.message}</p>
            )}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {SCENARIO_LEVERS.map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, borderBottom: "1px solid var(--color-divider)", paddingBottom: 4 }}>
                <span className="text-muted">{l.label}</span>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600 }}>
                  {levers[l.id]}
                  {l.unit}
                </span>
              </div>
            ))}
            <span className="text-muted" style={{ fontSize: 11 }}>A view link shows the saved assumptions as values. Switch to an edit link in the rail to move them.</span>
          </div>
        )}
        <div style={{ borderTop: "1px solid var(--color-divider)", paddingTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="text-muted" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" }}>Saved scenarios</div>
          {data.savedScenarios.map((s) => (
            <div
              key={s.id}
              className="rowpick"
              onClick={canEdit ? () => loadScenario(s) : undefined}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)", fontSize: 11.5, padding: "2px 4px", borderRadius: "var(--radius-sm)", background: s.id === loadedScenarioId ? "var(--color-accent-100)" : undefined }}
            >
              <span>{s.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span className="text-muted">{formatCurrency(s.ebitda)}</span>
                {canEdit && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeScenario(s.id);
                    }}
                    style={{ fontSize: 11, color: "var(--color-neg)" }}
                  >
                    Delete
                  </a>
                )}
              </span>
            </div>
          ))}
          {data.savedScenarios.length === 0 && <span className="text-muted" style={{ fontSize: 11 }}>None saved yet.</span>}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-4)" }}>
          {data.kpis.map((k) => (
            <div key={k.label} className="card">
              <div className="card-kicker">{k.label}</div>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, lineHeight: 1 }}>{formatCurrency(k.value)}</div>
              <div className="card-meta">
                Base {formatCurrency(k.base)} · <span style={{ color: varianceColor(k.deltaPct) }}>{formatPercentPlain(k.deltaPct)}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h5 style={{ margin: 0 }}>Scenario against Base Case</h5>
          <span className="text-muted" style={{ fontSize: 11 }}>recalculated by the same engine that produces the P&amp;L</span>
        </div>
        <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "34%" }}>Line</th>
                <th style={{ textAlign: "right" }}>Base Case</th>
                <th style={{ textAlign: "right" }}>Scenario</th>
                <th style={{ textAlign: "right" }}>Delta</th>
                <th style={{ textAlign: "right" }}>Delta %</th>
              </tr>
            </thead>
            <tbody>
              {data.scenarioRows.map((r) => (
                <tr key={r.id} style={r.headline ? { fontWeight: 600, background: "var(--color-accent-100)" } : undefined}>
                  <td>{r.label}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.base)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.scenario)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.delta)}</td>
                  <td style={{ textAlign: "right", color: varianceColor(r.deltaPct) }}>{formatPercentPlain(r.deltaPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
