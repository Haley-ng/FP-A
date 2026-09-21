"use client";

/** Small SVG charts matching the prototype's own hand-rolled chart markup (no charting library). */

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${24 - ((v - min) / range) * 22}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: "100%", height: 24, display: "block" }} aria-hidden="true">
      <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function niceAxis(max: number, steps = 4): string[] {
  const out: string[] = [];
  for (let i = steps; i >= 0; i--) {
    const v = (max / steps) * i;
    out.push(v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v.toFixed(0));
  }
  return out;
}

export function DualBarChart({
  months,
  actual,
  budget,
  height = 190,
}: {
  months: string[];
  actual: number[];
  budget: number[];
  height?: number;
}) {
  const max = Math.max(...actual, ...budget, 1) * 1.1;
  const axis = niceAxis(max);
  return (
    <div style={{ display: "flex", gap: "var(--space-3)" }}>
      <div className="text-muted" style={{ width: 44, flex: "none", height, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", fontSize: 10 }}>
        {axis.map((a, i) => (
          <span key={i}>{a}</span>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, height, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 1, background: "var(--color-divider)" }} />
          ))}
          <div style={{ height: 1, background: "var(--color-text)" }} />
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: "var(--space-3)" }}>
          {months.map((m, i) => (
            <div key={m} title={`${m}: actual ${actual[i]?.toFixed(0)}, budget ${budget[i]?.toFixed(0)}`} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3 }}>
              <div style={{ width: "38%", height: `${Math.max((actual[i] / max) * 100, 0)}%`, background: "var(--color-accent)" }} />
              <div style={{ width: "38%", height: `${Math.max((budget[i] / max) * 100, 0)}%`, background: "var(--color-accent-300)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LineChart({
  months,
  series,
  height = 150,
}: {
  months: string[];
  series: { values: number[]; color: string; dashed?: boolean; width?: number }[];
  height?: number;
}) {
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const axisMax = niceAxis(max - min).map((_, i) => {
    const v = min + ((max - min) / 4) * (4 - i);
    return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v.toFixed(0);
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div className="text-muted" style={{ width: 52, flex: "none", height, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", fontSize: 10 }}>
          {axisMax.map((a, i) => (
            <span key={i}>{a}</span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, height, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ height: 1, background: "var(--color-divider)" }} />
            ))}
            <div style={{ height: 1, background: "var(--color-text)" }} />
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
            {series.map((s, si) => {
              const points = s.values
                .map((v, i) => `${(i / Math.max(s.values.length - 1, 1)) * 100},${100 - ((v - min) / range) * 100}`)
                .join(" ");
              return (
                <polyline
                  key={si}
                  points={points}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 2}
                  strokeDasharray={s.dashed ? "3 3" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
        </div>
      </div>
      <div className="text-muted" style={{ display: "flex", gap: "var(--space-3)", paddingLeft: "calc(52px + var(--space-3))", fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase" }}>
        {months.map((m) => (
          <span key={m} style={{ flex: 1, textAlign: "center" }}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BridgeChart({ items }: { items: { label: string; value: number; display: string }[] }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1) * 1.15;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <div className="text-muted" style={{ width: 56, flex: "none", height: 170, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", fontSize: 10 }}>
          {niceAxis(max).map((a, i) => (
            <span key={i}>{a}</span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, height: 170, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ height: 1, background: "var(--color-divider)" }} />
            ))}
            <div style={{ height: 1, background: "var(--color-text)" }} />
          </div>
          <div style={{ position: "absolute", inset: 0, display: "flex", gap: "var(--space-6)", padding: "0 var(--space-6)" }}>
            {items.map((it, i) => {
              const heightPct = (Math.abs(it.value) / max) * 100;
              const positive = it.value >= 0;
              return (
                <div key={i} title={it.label} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <div style={{ height: `${100 - heightPct}%` }} />
                  <div
                    style={{
                      height: `${heightPct}%`,
                      background: positive ? "var(--color-pos)" : "var(--color-neg)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "var(--space-6)", paddingLeft: "calc(56px + var(--space-3) + var(--space-6))" }}>
        {items.map((it, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13 }}>{it.display}</div>
            <div className="text-muted" style={{ fontSize: 10 }}>
              {it.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
