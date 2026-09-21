"use client";

import { useEffect, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { BridgeChart } from "@/components/fpa/charts";
import { formatCurrency, formatPercentPlain, varianceColor } from "@/lib/fpa/format";
import { FORECAST_DRIVERS } from "@/lib/fpa/sampleData";
import type { ForecastDriverValues, ForecastMethod, ProfitAndLossLineId } from "@/lib/fpa/types";

interface ForecastRow {
  lineId: ProfitAndLossLineId;
  actualToDate: number;
  forecastRemaining: number;
  total: number;
  budget: number;
  varAbs: number;
  varPct: number | null;
  splitActualFraction: number;
}

interface ForecastPayload {
  rows: ForecastRow[];
  bridge: { label: string; value: number }[];
  monthOptions: { value: string; label: string }[];
}

interface ForecastVersion {
  id: string;
  createdAt: string;
  method: ForecastMethod;
  fullYearEbitda: number;
  moveVsPrior: number | null;
  varVsBudget: number;
}

const LINE_LABELS: Record<ProfitAndLossLineId, string> = {
  sales: "Sales", cos: "Cost of Sales", gp: "Gross Profit", opex: "Operating Expenses", ebitda: "EBITDA",
  da: "Depreciation & Amortization", ebit: "EBIT", nonop: "Non-operating Income", intexp: "Interest Expense",
  pbt: "Profit Before Tax", tax: "Taxation", np: "Net Profit",
};

const DEFAULT_DRIVERS: ForecastDriverValues = { salesDriver: 0, cosDriver: 0, opexDriver: 0 };

export default function ForecastPage() {
  return (
    <AppShell>
      <ForecastBody />
    </AppShell>
  );
}

function ForecastBody() {
  const { territory, year, currency, canEdit } = useFpaFilters();
  const [cutover, setCutover] = useState(7);
  const [method, setMethod] = useState<ForecastMethod>("budget");
  const [drivers, setDrivers] = useState<ForecastDriverValues>(DEFAULT_DRIVERS);
  const [data, setData] = useState<ForecastPayload | null>(null);
  const [versions, setVersions] = useState<ForecastVersion[] | null>(null);
  const [saveState, setSaveState] = useState<{ status: "idle" | "saving" | "error"; message?: string }>({ status: "idle" });

  useEffect(() => {
    const params = new URLSearchParams({
      territory: String(territory),
      year: String(year),
      currency,
      cutover: String(cutover),
      method,
      salesDriver: String(drivers.salesDriver),
      cosDriver: String(drivers.cosDriver),
      opexDriver: String(drivers.opexDriver),
    });
    fetch(`/api/fpa/forecast?${params}`)
      .then((r) => r.json())
      .then(setData);
  }, [territory, year, currency, cutover, method, drivers]);

  useEffect(() => {
    if (territory === "all") return;
    const params = new URLSearchParams({ territory: String(territory), year: String(year) });
    fetch(`/api/forecast/versions?${params}`)
      .then((r) => r.json())
      .then((d) => setVersions(d.versions ?? []));
  }, [territory, year]);

  async function saveVersion() {
    if (territory === "all") return;
    setSaveState({ status: "saving" });
    try {
      const res = await fetch("/api/forecast/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkMode: canEdit ? "edit" : "view",
          territoryKey: territory,
          fiscalYear: year,
          cutover,
          method,
          currency,
          ...drivers,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setSaveState({ status: "error", message: result.error ?? "Could not save the version." });
        return;
      }
      setSaveState({ status: "idle" });
      const params = new URLSearchParams({ territory: String(territory), year: String(year) });
      fetch(`/api/forecast/versions?${params}`)
        .then((r) => r.json())
        .then((d) => setVersions(d.versions ?? []));
    } catch {
      setSaveState({ status: "error", message: "Could not reach the server." });
    }
  }

  if (!data) return <div style={{ padding: "var(--space-6)" }}>Loading…</div>;

  return (
    <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-6)", flexWrap: "wrap" }}>
        <div className="field" style={{ width: 210, margin: 0 }}>
          <label>Actuals through</label>
          <select className="input" value={cutover} onChange={(e) => setCutover(Number(e.target.value))}>
            {data.monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ width: 230, margin: 0 }}>
          <label>Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as ForecastMethod)}>
            <option value="budget">Budget, adjusted by drivers</option>
            <option value="runrate">Run-rate from actuals</option>
          </select>
        </div>
        <div className="text-muted" style={{ fontSize: 11, maxWidth: "44ch" }}>
          {method === "budget" ? "Remaining months follow Budget, shifted by the drivers below." : "Remaining months extrapolate the average monthly actual to date."}
        </div>
        {canEdit && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginLeft: "auto", flex: "none" }}
            disabled={saveState.status === "saving" || territory === "all"}
            onClick={saveVersion}
            title={territory === "all" ? "Select a single territory before saving a version" : undefined}
          >
            {saveState.status === "saving" ? "Saving…" : "Save version"}
          </button>
        )}
      </div>
      {territory === "all" && canEdit && (
        <span className="text-muted" style={{ fontSize: 11, marginTop: "calc(-1 * var(--space-4))" }}>
          Select a single territory in the filter bar before saving a Forecast Version — it must belong to exactly one territory.
        </span>
      )}
      {saveState.status === "error" && <p style={{ margin: 0, fontSize: 12, color: "var(--color-neg)" }}>{saveState.message}</p>}

      <div className="card" style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
        {FORECAST_DRIVERS.map((d) => (
          <div key={d.id} className="field" style={{ width: 220, margin: 0 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span>{d.label}</span>
              <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 12.5 }}>
                {drivers[d.id] > 0 ? "+" : ""}
                {drivers[d.id]}
                {d.unit}
              </span>
            </label>
            <input
              type="range"
              min={d.min}
              max={d.max}
              step={d.step}
              value={drivers[d.id]}
              disabled={!canEdit}
              onChange={(e) => setDrivers((prev) => ({ ...prev, [d.id]: Number(e.target.value) }))}
              style={{ width: "100%", accentColor: "var(--color-accent)" }}
            />
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "var(--space-4) var(--space-6) var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-6)" }}>
          <div>
            <h5 style={{ margin: 0 }}>Budget to forecast — EBITDA</h5>
            <div className="text-muted" style={{ fontSize: 11 }}>Bridge from Budget EBITDA to the forecast full-year figure</div>
          </div>
        </div>
        <BridgeChart items={data.bridge.map((b) => ({ ...b, display: formatCurrency(b.value) }))} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <h5 style={{ margin: 0 }}>Actual to date + forecast for the remaining months</h5>
        <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "22%" }}>Line</th>
                <th style={{ textAlign: "right" }}>Actual to date</th>
                <th style={{ textAlign: "right" }}>Forecast</th>
                <th style={{ textAlign: "right" }}>Full year</th>
                <th style={{ textAlign: "right" }}>Budget</th>
                <th style={{ textAlign: "right" }}>Var</th>
                <th style={{ textAlign: "right" }}>Var %</th>
                <th style={{ width: 110 }}>Split</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.lineId} style={r.lineId === "ebitda" || r.lineId === "np" ? { fontWeight: 600, background: "var(--color-accent-100)" } : undefined}>
                  <td>{LINE_LABELS[r.lineId]}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.actualToDate)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.forecastRemaining)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.total)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.budget)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.varAbs)}</td>
                  <td style={{ textAlign: "right", color: varianceColor(r.varPct) }}>{formatPercentPlain(r.varPct)}</td>
                  <td>
                    <div style={{ display: "flex", height: 8 }}>
                      <div style={{ width: `${r.splitActualFraction * 100}%`, background: "var(--color-accent)" }} />
                      <div style={{ width: `${(1 - r.splitActualFraction) * 100}%`, background: "var(--color-accent-300)" }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", borderTop: "1px solid var(--color-divider)", paddingTop: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h5 style={{ margin: 0 }}>Version history</h5>
          <span className="text-muted" style={{ fontSize: 11 }}>
            {territory === "all" ? "Select a single territory to see saved versions" : `${versions?.length ?? 0} saved`}
          </span>
        </div>
        {territory !== "all" && versions && versions.length > 0 && (
          <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Created</th>
                  <th>Method</th>
                  <th style={{ textAlign: "right" }}>Full-year EBITDA</th>
                  <th style={{ textAlign: "right" }}>Move vs prior</th>
                  <th style={{ textAlign: "right" }}>Var vs budget</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <code style={{ fontSize: 11 }}>{v.id.slice(0, 8)}</code>
                    </td>
                    <td className="text-muted">{new Date(v.createdAt).toLocaleString("en-US")}</td>
                    <td className="text-muted">{v.method === "budget" ? "Budget, adjusted by drivers" : "Run-rate from actuals"}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(v.fullYearEbitda)}</td>
                    <td style={{ textAlign: "right", color: v.moveVsPrior == null ? undefined : varianceColor(v.moveVsPrior) }}>
                      {v.moveVsPrior == null ? "—" : formatCurrency(v.moveVsPrior)}
                    </td>
                    <td style={{ textAlign: "right", color: varianceColor(v.varVsBudget) }}>{formatCurrency(v.varVsBudget)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
