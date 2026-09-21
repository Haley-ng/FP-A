"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PERIOD_LABELS } from "@/lib/fpa/sampleData";
import type { CurrencyMode, Dataset, FiscalYear, LinkMode, Period, Territory, TerritoryFilter } from "@/lib/fpa/types";

type NavEntry = { kind: "group"; label: string } | { kind: "item"; num: string; label: string; href: string };

const NAV: NavEntry[] = [
  { kind: "group", label: "Overview" },
  { kind: "item", num: "01", label: "Executive Overview", href: "/" },
  { kind: "group", label: "Statements" },
  { kind: "item", num: "02", label: "P&L", href: "/pl" },
  { kind: "item", num: "03", label: "Balance Sheet", href: "/balance-sheet" },
  { kind: "item", num: "04", label: "Cash Flow", href: "/cash-flow" },
  { kind: "group", label: "Variance" },
  { kind: "item", num: "05", label: "Budget vs Actual", href: "/budget-vs-actual" },
  { kind: "item", num: "06", label: "Variance Analysis", href: "/variance-analysis" },
  { kind: "group", label: "Planning" },
  { kind: "item", num: "07", label: "Scenario Modelling", href: "/scenario-modelling" },
  { kind: "item", num: "08", label: "Forecast", href: "/forecast" },
  { kind: "item", num: "09", label: "Territory Performance", href: "/territory-performance" },
  { kind: "group", label: "Output" },
  { kind: "item", num: "10", label: "Reports", href: "/reports" },
  { kind: "item", num: "11", label: "Data Library", href: "/data-library" },
];

const NO_TERRITORY_CURRENCY_FILTER = new Set(["/variance-analysis"]);
const NO_FILTER_BAR = new Set(["/data-library"]);
const NO_PERIOD_FILTER = new Set(["/balance-sheet", "/territory-performance"]);

/** design.md's one view-only tier (previously the public/Executive/Board link) — every other role can write. Matches src/lib/auth/member.ts's isEditRole. */
const VIEW_ONLY_ROLE = "board";

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

export interface FpaFiltersValue {
  territory: TerritoryFilter;
  year: FiscalYear;
  period: Period;
  currency: CurrencyMode;
  linkMode: LinkMode;
  canEdit: boolean;
  queryString: string;
  setFilter: (patch: Record<string, string>) => void;
}

const FpaFiltersContext = createContext<FpaFiltersValue | null>(null);

export function useFpaFilters(): FpaFiltersValue {
  const ctx = useContext(FpaFiltersContext);
  if (!ctx) throw new Error("useFpaFilters must be used within AppShell");
  return ctx;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [memberChecked, setMemberChecked] = useState(false);

  useEffect(() => {
    fetch("/api/fpa/territories")
      .then((r) => r.json())
      .then(setTerritories);
    fetch("/api/fpa/data-library")
      .then((r) => r.json())
      .then((d) => setDatasets(d.datasets ?? []));
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then(async (r) => {
        if (r.status === 403) {
          // Signed in with Google, but removed from (or never added to) the members
          // allow-list since — don't leave a live session sitting on a page they
          // can't use, sign out for real and send them to the explained error.
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push("/login?error=no_access");
          return;
        }
        if (r.status === 401) {
          router.push("/login");
          return;
        }
        const data = await r.json();
        setMember(data.member ?? null);
        setMemberChecked(true);
      })
      .catch(() => setMemberChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const territoryRaw = searchParams.get("territory") ?? "all";
  const territory: TerritoryFilter = territoryRaw === "all" ? "all" : Number(territoryRaw);
  const year = (Number(searchParams.get("year") ?? "2025") as FiscalYear) || 2025;
  const period = (searchParams.get("period") as Period) ?? "fy";
  const currency = (searchParams.get("currency") as CurrencyMode) ?? "usd";
  // The role now comes from the signed-in member's row in `members`, not a client-side toggle.
  const canEdit = !!member && member.role.trim().toLowerCase() !== VIEW_ONLY_ROLE;
  const linkMode: LinkMode = canEdit ? "edit" : "view";

  const queryString = searchParams.toString();

  const setFilter = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v == null) params.delete(k);
      else params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const buildHref = (href: string) => (queryString ? `${href}?${queryString}` : href);

  const currentItem = NAV.find((n) => n.kind === "item" && n.href === pathname) as Extract<NavEntry, { kind: "item" }> | undefined;
  const screenName = currentItem?.label ?? "FP&A Model";

  const single = territory !== "all";
  const territoryObj = single ? territories.find((t) => t.key === territory) : undefined;
  const scopeLine = [
    single ? territoryObj?.name ?? "" : "All territories",
    `FY${year}`,
    PERIOD_LABELS[period] ?? "Full year",
    single && currency === "local" ? territoryObj?.currency ?? "USD" : "USD",
  ].join(" · ");

  const glDataset = datasets.find((d) => d.id === "gl");
  const failingDatasets = datasets.filter((d) => d.validationStatus === "fail");

  const showFilterBar = !NO_FILTER_BAR.has(pathname);
  const showTerritoryCurrency = !NO_TERRITORY_CURRENCY_FILTER.has(pathname);
  const showPeriod = !NO_PERIOD_FILTER.has(pathname);

  const contextValue = useMemo<FpaFiltersValue>(
    () => ({ territory, year, period, currency, linkMode, canEdit, queryString, setFilter }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [territory, year, period, currency, linkMode, canEdit, queryString]
  );

  return (
    <FpaFiltersContext.Provider value={contextValue}>
      <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", fontFamily: "var(--font-body)", display: "flex", alignItems: "stretch" }}>
        <nav className="noprint" style={{ width: 240, background: "var(--color-surface)", flex: "none", borderRight: "1px solid var(--color-divider)", padding: "var(--space-4) 0 var(--space-3)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflow: "auto" }}>
          <div style={{ padding: "0 var(--space-4) var(--space-2)" }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 17 }}>FP&amp;A Model</div>
            <div className="text-muted" style={{ fontSize: 11 }}>{memberChecked ? (member ? member.role : "Signed in") : "Loading…"}</div>
          </div>
          {NAV.map((n, i) =>
            n.kind === "group" ? (
              <span key={i} style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-muted)", padding: "var(--space-4) var(--space-4) var(--space-1)" }}>
                {n.label}
              </span>
            ) : (
              <Link
                key={n.href}
                href={buildHref(n.href)}
                className={n.href === pathname ? "" : "rail-item"}
                style={
                  n.href === pathname
                    ? { display: "flex", alignItems: "center", gap: 9, padding: "6px var(--space-4)", fontSize: 13, color: "var(--color-accent-700)", textDecoration: "none", borderLeft: "2px solid var(--color-accent-500)", background: "var(--color-accent-100)", fontWeight: 600 }
                    : { display: "flex", alignItems: "center", gap: 9, padding: "6px var(--space-4)", fontSize: 13, color: "var(--color-muted)", textDecoration: "none", borderLeft: "2px solid transparent" }
                }
              >
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, width: 16, flex: "none", color: n.href === pathname ? "var(--color-accent-500)" : "var(--color-neutral-500)" }}>{n.num}</span>
                {n.label}
              </Link>
            )
          )}
          <div style={{ marginTop: "auto", padding: "var(--space-4) var(--space-4) 0", borderTop: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div className="text-muted" style={{ fontSize: 11 }}>
              {glDataset ? `Refreshed from ${glDataset.fileName} · ${glDataset.rowCount.toLocaleString()} GL rows` : "Loading from Supabase…"}
            </div>
            <Link href={buildHref("/data-library")} style={{ fontSize: 11 }}>
              {failingDatasets.length > 0 ? `${failingDatasets.length} validation failure${failingDatasets.length > 1 ? "s" : ""} →` : "All datasets passing →"}
            </Link>
          </div>
        </nav>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid var(--color-divider)" }}>
            <div>
              <h4 style={{ margin: 0 }}>{screenName}</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, paddingTop: 1 }}>
                <span className="text-muted">Showing</span>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 12 }}>{scopeLine}</span>
              </div>
            </div>
            <div className="noprint" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              {canEdit && (
                <Link className="btn btn-secondary" href={buildHref("/reports")}>
                  Compile to report
                </Link>
              )}
              {member && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", paddingLeft: "var(--space-3)", borderLeft: "1px solid var(--color-divider)" }}>
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatarUrl} alt="" width={28} height={28} style={{ borderRadius: "50%", display: "block" }} referrerPolicy="no-referrer" />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-accent-200)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--color-accent-800)" }}>
                      {member.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{member.name}</span>
                    <span className="text-muted" style={{ fontSize: 10.5 }}>{member.role}</span>
                  </div>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={signOut}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>

          {showFilterBar && (
            <div className="noprint" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-4)", padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid var(--color-divider)", background: "var(--color-surface-low)" }}>
              {showTerritoryCurrency && (
                <div className="field" style={{ width: 200, flex: "none" }}>
                  <label>Territory</label>
                  <select className="input" value={String(territory)} onChange={(e) => setFilter({ territory: e.target.value })}>
                    <option value="all">All territories ({territories.length || 7})</option>
                    {territories.map((t) => (
                      <option key={t.key} value={String(t.key)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field" style={{ width: 130, flex: "none" }}>
                <label>Fiscal year</label>
                <select className="input" value={String(year)} onChange={(e) => setFilter({ year: e.target.value })}>
                  <option value="2025">FY2025</option>
                  <option value="2024">FY2024</option>
                  <option value="2023">FY2023</option>
                </select>
              </div>
              {showPeriod && (
                <div className="field" style={{ width: 160, flex: "none" }}>
                  <label>Period</label>
                  <select className="input" value={period} onChange={(e) => setFilter({ period: e.target.value })}>
                    {Object.entries(PERIOD_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {showTerritoryCurrency && (
                <div className="field" style={{ flex: "none" }}>
                  <label>Currency</label>
                  <div className="seg" style={{ whiteSpace: "nowrap" }}>
                    <label className="seg-opt">
                      <input type="radio" name="cur" checked={currency === "usd" || !single} onChange={() => setFilter({ currency: "usd" })} />
                      <span>USD</span>
                    </label>
                    <label className="seg-opt" style={!single ? { opacity: 0.45, cursor: "not-allowed" } : undefined}>
                      <input type="radio" name="cur" checked={single && currency === "local"} disabled={!single} onChange={() => setFilter({ currency: "local" })} />
                      <span>{single ? `${territoryObj?.currency} (local)` : "Local"}</span>
                    </label>
                  </div>
                </div>
              )}
              <Link className="btn btn-secondary" href={pathname + (queryString ? `?${queryString}` : "")} style={{ flex: "none" }}>
                Recalculate
              </Link>
              <div className="text-muted" style={{ flex: "1 1 22ch", minWidth: "22ch", fontSize: 11, textAlign: "right" }}>
                {single ? `Rate ${territoryObj?.rate} · constant closing rate` : "Local currency unlocks once a single territory is selected"}
              </div>
            </div>
          )}

          {children}
        </div>
      </div>
    </FpaFiltersContext.Provider>
  );
}
