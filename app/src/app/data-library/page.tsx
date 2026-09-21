"use client";

import { useEffect, useState } from "react";
import { AppShell, useFpaFilters } from "@/components/fpa/AppShell";
import { ErrorState } from "@/components/fpa/ErrorState";
import { fetchJson } from "@/lib/fpa/fetchJson";
import type { Dataset, DatasetCheck, DatasetIssue } from "@/lib/fpa/types";

interface DataLibraryPayload {
  datasets: Dataset[];
  selected: Dataset;
  checks: DatasetCheck[];
  issues: DatasetIssue[];
}

export default function DataLibraryPage() {
  return (
    <AppShell>
      <DataLibraryBody />
    </AppShell>
  );
}

function DataLibraryBody() {
  const { canEdit } = useFpaFilters();
  const [dataset, setDataset] = useState("currency");
  const [data, setData] = useState<DataLibraryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshState, setRefreshState] = useState<{ status: "idle" | "refreshing" | "error"; message?: string }>({ status: "idle" });
  const [uploadState, setUploadState] = useState<{ status: "idle" | "uploading" | "error"; message?: string }>({ status: "idle" });

  function reload() {
    const params = new URLSearchParams({ dataset });
    fetchJson<DataLibraryPayload>(`/api/fpa/data-library?${params}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(reload, [dataset]);

  async function refreshNow() {
    if (refreshState.status === "refreshing") return;
    setRefreshState({ status: "refreshing" });
    try {
      const res = await fetch(`/api/data-library/${dataset}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkMode: canEdit ? "edit" : "view" }),
      });
      const result = await res.json();
      if (!res.ok) {
        setRefreshState({ status: "error", message: result.error ?? "Could not refresh the dataset." });
        return;
      }
      setRefreshState({ status: "idle" });
      reload();
    } catch {
      setRefreshState({ status: "error", message: "Could not reach the server." });
    }
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadState({ status: "uploading" });
    try {
      const form = new FormData();
      form.append("linkMode", canEdit ? "edit" : "view");
      form.append("file", file);
      const res = await fetch(`/api/data-library/${dataset}/upload`, { method: "POST", body: form });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadState({ status: "error", message: result.error ?? "Could not upload the file." });
        return;
      }
      setUploadState({ status: "idle" });
      reload();
    } catch {
      setUploadState({ status: "error", message: "Could not reach the server." });
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <div style={{ padding: "var(--space-6)" }}>Loading…</div>;

  const passing = data.datasets.filter((d) => d.validationStatus === "pass").length;

  return (
    <div style={{ padding: "var(--space-6)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h5 style={{ margin: 0 }}>Connected datasets</h5>
          <span className="text-muted" style={{ fontSize: 11 }}>
            {passing} of {data.datasets.length} passing
          </span>
        </div>
        <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Rows</th>
                <th>Last refreshed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.datasets.map((d) => (
                <tr key={d.id} className="rowpick" onClick={() => setDataset(d.id)} style={d.id === dataset ? { background: "var(--color-accent-100)" } : undefined}>
                  <td>{d.name}</td>
                  <td className="text-muted">{d.rowCount.toLocaleString()}</td>
                  <td className="text-muted">{new Date(d.lastRefreshedAt).toLocaleDateString("en-US")}</td>
                  <td>
                    <span className={d.validationStatus === "pass" ? "tag tag-accent" : "tag tag-outline"} style={d.validationStatus === "fail" ? { color: "var(--color-neg)", borderColor: "var(--color-neg)" } : undefined}>
                      {d.validationStatus === "pass" ? "Pass" : "Fail"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
          <h5 style={{ margin: 0 }}>{data.selected.name}</h5>
          <span className="text-muted" style={{ fontSize: 11 }}>{data.selected.fileName}</span>
        </div>
        <div style={{ overflow: "auto", maxWidth: "100%", maxHeight: "70vh" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "60%" }}>Check</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {data.checks.map((c, i) => (
                <tr key={i}>
                  <td>{c.label}</td>
                  <td>
                    <span className={c.result === "pass" ? "tag tag-accent" : "tag tag-outline"} style={c.result === "fail" ? { color: "var(--color-neg)", borderColor: "var(--color-neg)" } : undefined}>
                      {c.result === "pass" ? "Pass" : "Fail"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.issues.length > 0 && (
          <div className="card">
            <div className="card-kicker">Flagged rows</div>
            {data.issues.map((i) => (
              <div key={i.id} style={{ display: "flex", gap: "var(--space-3)", fontSize: 12, borderBottom: "1px solid var(--color-divider)", paddingBottom: 6 }}>
                <code style={{ fontSize: 11, flex: "none", color: "var(--color-accent-700)" }}>{i.rowRef}</code>
                <span>{i.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ alignItems: "flex-start" }}>
          <div className="card-kicker">Live validation</div>
          <p style={{ margin: 0, fontSize: 12.5 }}>
            These checks run against the real tables in Supabase on every load — not a simulated
            state. Any failing check is listed above with the specific rows behind it.
          </p>
        </div>

        {canEdit && (
          <div className="card" style={{ alignItems: "flex-start", gap: "var(--space-3)" }}>
            <div className="card-kicker">Edit-link actions</div>
            <button type="button" className="btn btn-secondary" disabled={refreshState.status === "refreshing"} onClick={refreshNow}>
              {refreshState.status === "refreshing" ? "Refreshing…" : "Refresh Now"}
            </button>
            {refreshState.status === "error" && <p style={{ margin: 0, fontSize: 12, color: "var(--color-neg)" }}>{refreshState.message}</p>}
            <div className="field" style={{ margin: 0, width: "100%" }}>
              <label>Upload a new source file</label>
              <input className="input" type="file" accept=".xlsx" disabled={uploadState.status === "uploading"} onChange={uploadFile} />
            </div>
            {uploadState.status === "error" && <p style={{ margin: 0, fontSize: 12, color: "var(--color-neg)" }}>{uploadState.message}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
