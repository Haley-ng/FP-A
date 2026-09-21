import { LocalFileSource } from "../src/lib/dataSources/localFileSource";
import { refreshAll } from "../src/lib/sync/refresh";
import { computeCashFlowStatement } from "../src/lib/calcEngine/cashFlow";

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

async function main() {
  const { data } = await refreshAll(new LocalFileSource());

  const cases: Array<{ label: string; territoryKeys?: number[]; year: number }> = [
    { label: "USA 2023", territoryKeys: [1], year: 2023 },
    { label: "USA 2024", territoryKeys: [1], year: 2024 },
    { label: "Germany 2023", territoryKeys: [4], year: 2023 },
    { label: "Australia 2024", territoryKeys: [6], year: 2024 },
    { label: "All Territories 2023", territoryKeys: undefined, year: 2023 },
  ];

  for (const c of cases) {
    const filter = {
      territoryKeys: c.territoryKeys,
      dateFrom: new Date(Date.UTC(c.year, 0, 1)),
      dateTo: new Date(Date.UTC(c.year, 11, 31, 23, 59, 59)),
    };
    const cf = computeCashFlowStatement(data.gl, data.chartOfAccounts, filter);
    console.log(`\n=== ${c.label} ===`);
    console.log(`  Operating: ${money(cf.operatingCashFlow)}  Investing: ${money(cf.investingCashFlow)}  Financing: ${money(cf.financingCashFlow)}`);
    console.log(`  Net change: ${money(cf.netChangeInCash)}  Start: ${money(cf.cashAtStart)}  End (computed): ${money(cf.cashAtEndComputed)}  End (actual): ${money(cf.cashAtEndActual)}`);
    console.log(`  RECONCILIATION GAP: ${money(cf.reconciliationGap)} ${Math.abs(cf.reconciliationGap) < 1 ? "✅" : "❌"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
