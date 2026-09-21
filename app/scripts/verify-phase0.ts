import { LocalFileSource } from "../src/lib/dataSources/localFileSource";
import { refreshAll } from "../src/lib/sync/refresh";
import { computeProfitAndLoss, computeBalanceSheet, computeKeyRatios } from "../src/lib/calcEngine/plAndBs";
import { computeFtpVariance } from "../src/lib/calcEngine/variance";
import { sumBudget } from "../src/lib/calcEngine/aggregate";
import { sumGlToUsd } from "../src/lib/calcEngine/fx";
import { CATEGORY } from "../src/lib/calcEngine/accountFilters";

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

async function main() {
  const source = new LocalFileSource();
  console.log(`Data source: ${source.describe()}\n`);

  const { data, statuses } = await refreshAll(source);

  console.log("=== Dataset Sync Status ===");
  for (const s of statuses) {
    console.log(`${s.status === "pass" ? "PASS" : "FAIL"}  ${s.dataset.padEnd(16)} rows=${s.rowCount}  issues=${s.issues.length}`);
    for (const issue of s.issues.slice(0, 5)) {
      console.log(`    [${issue.severity}] ${issue.rowRef}: ${issue.message}`);
    }
    if (s.issues.length > 5) console.log(`    ... and ${s.issues.length - 5} more`);
  }

  const territoryKeys = [1]; // USA
  const periodFilter = { territoryKeys, dateFrom: new Date("2023-01-01"), dateTo: new Date("2023-01-31") };

  console.log("\n=== P&L — USA, Jan 2023 ===");
  const pl = computeProfitAndLoss(data.gl, data.chartOfAccounts, periodFilter);
  for (const [k, v] of Object.entries(pl)) console.log(`  ${k.padEnd(22)} ${money(v)}`);

  console.log("\n=== Balance Sheet — USA, as of 31 Jan 2023 ===");
  const bs = computeBalanceSheet(data.gl, data.chartOfAccounts, periodFilter.dateTo, territoryKeys);
  for (const [k, v] of Object.entries(bs)) console.log(`  ${k.padEnd(22)} ${money(v)}`);

  console.log("\n=== Key Ratios — USA, Jan 2023 ===");
  const ratios = computeKeyRatios(pl, bs);
  for (const [k, v] of Object.entries(ratios)) {
    console.log(`  ${k.padEnd(22)} ${v === null ? "n/a" : v.toFixed(3)}`);
  }

  console.log("\n=== Budget vs Actual — USA, Jan 2023 ===");
  const salesBudget = sumBudget(data.budget, periodFilter, CATEGORY.sales(data.chartOfAccounts));
  const salesVariance = computeFtpVariance(pl.sales, salesBudget);
  console.log(`  Sales actual=${money(pl.sales)}  budget=${money(salesBudget)}  variance=${money(salesVariance.variance)}  pct=${salesVariance.pctVariance === null ? "n/a" : (salesVariance.pctVariance * 100).toFixed(1) + "%"}  material=${salesVariance.isMaterial}`);

  console.log("\n=== USD Conversion check — USA Sales, Jan 2023 ===");
  const usdResult = sumGlToUsd(data.gl, data.currencyRates, periodFilter, CATEGORY.sales(data.chartOfAccounts));
  console.log(`  Local total=${money(pl.sales)}  USD total=${money(usdResult.totalUsd)}  unconverted rows=${usdResult.unconvertedCount}`);
  console.log("  (USA is already in USD, so local === USD here; this just confirms the FX join works.)");

  console.log("\n=== Cross-territory USD sanity check — Germany Sales, Jan 2023 ===");
  const deFilter = { territoryKeys: [4], dateFrom: periodFilter.dateFrom, dateTo: periodFilter.dateTo };
  const deSalesLocal = sumGlToUsd(data.gl, data.currencyRates, deFilter, CATEGORY.sales(data.chartOfAccounts));
  console.log(`  Germany Sales in USD=${money(deSalesLocal.totalUsd)}  unconverted rows=${deSalesLocal.unconvertedCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
