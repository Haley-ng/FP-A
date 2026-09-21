import Link from "next/link";
import type { DrillLevel, DrillLeaf } from "@/lib/calcEngine/drillDown";
import type { VarianceResult } from "@/lib/calcEngine/variance";

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

function pct(n: number | null): string {
  return n === null ? "n/a" : `${(n * 100).toFixed(1)}%`;
}

function VarianceCell({ v }: { v: VarianceResult }) {
  const color = v.variance >= 0 ? "text-emerald-700" : "text-red-700";
  return (
    <span className={color}>
      {money(v.variance)} ({pct(v.pctVariance)}){v.isMaterial ? " ⚠" : ""}
    </span>
  );
}

export interface Breadcrumb {
  label: string;
  href: string;
}

export function DrillDownSection({
  breadcrumbs,
  level,
  currencyLabel,
  makeGroupHref,
}: {
  breadcrumbs: Breadcrumb[];
  level: DrillLevel | DrillLeaf;
  currencyLabel: string;
  makeGroupHref: (value: string) => string;
}) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4">
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-black/50">
        {breadcrumbs.map((b, i) => (
          <span key={b.href} className="flex items-center gap-1">
            {i > 0 ? <span>/</span> : null}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-black">{b.label}</span>
            ) : (
              <Link href={b.href} className="hover:underline">
                {b.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {level.kind === "groups" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-black/50">
                <th className="py-1.5 pr-3">{level.field === "class" ? "Class" : level.field === "subClass" ? "Sub-class" : level.field === "subClass2" ? "Category" : "Account"}</th>
                <th className="py-1.5 pr-3 text-right">Actual ({currencyLabel})</th>
                <th className="py-1.5 pr-3 text-right">Budget</th>
                <th className="py-1.5 pr-3 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {level.groups.map((g) => (
                <tr key={g.value} className="border-b border-black/5">
                  <td className="py-1.5 pr-3">
                    <Link href={makeGroupHref(g.value)} className="text-blue-700 hover:underline">
                      {g.value}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3 text-right">{money(g.actual)}</td>
                  <td className="py-1.5 pr-3 text-right">{money(g.budget)}</td>
                  <td className="py-1.5 pr-3 text-right">
                    <VarianceCell v={g.variance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="mb-2 flex gap-4 text-sm text-black/60">
            <span>
              Actual: <strong className="text-black">{money(level.actual)}</strong>
            </span>
            <span>
              Budget: <strong className="text-black">{money(level.budget)}</strong>
            </span>
            <span>
              Variance: <VarianceCell v={level.variance} />
            </span>
          </div>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-black/50">
                <th className="py-1.5 pr-3">Date</th>
                <th className="py-1.5 pr-3">Entry</th>
                <th className="py-1.5 pr-3">Details</th>
                <th className="py-1.5 pr-3 text-right">Amount ({currencyLabel})</th>
              </tr>
            </thead>
            <tbody>
              {level.transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-black/40">
                    No GL transactions in this period/territory.
                  </td>
                </tr>
              ) : (
                level.transactions.map((t, i) => (
                  <tr key={`${t.entryNo}-${i}`} className="border-b border-black/5">
                    <td className="py-1.5 pr-3">{t.date.toLocaleDateString("en-US")}</td>
                    <td className="py-1.5 pr-3">{t.entryNo}</td>
                    <td className="py-1.5 pr-3">{t.details}</td>
                    <td className="py-1.5 pr-3 text-right">{money(t.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
