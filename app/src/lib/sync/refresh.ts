import type { DataSource } from "../dataSources/types";
import type { DatasetName, DatasetSyncStatus, ParsedFinanceData, ValidationIssue } from "../types";
import {
  parseGl,
  parseBudget,
  parseTrialBalance,
  parseChartOfAccounts,
  parseCurrency,
  parseTerritory,
  parseCashFlowMapping,
  parseSoce,
  parseCalendar,
} from "../parsers";
import { findUnmappedAccountKeys, findDuplicateGlEntries } from "../validation/crossChecks";
import { writeAllSyncStatuses } from "../store/datasetSyncStatus";

export interface RefreshResult {
  data: ParsedFinanceData;
  statuses: DatasetSyncStatus[];
}

/**
 * Loads every dataset from the given source, parses and validates each one,
 * and records Dataset Sync Status for all of them (design.md §3/§4 — Data
 * Library screen). This is the one place Phase 0's "Refresh Now" / scheduled
 * sync (plan.md §1) should call into.
 */
export async function refreshAll(source: DataSource): Promise<RefreshResult> {
  const statuses: DatasetSyncStatus[] = [];
  const now = new Date().toISOString();

  async function loadRequired<T>(
    dataset: DatasetName,
    parse: (buf: Buffer) => Promise<{ rows: T[]; totalRowsSeen: number; issues: ValidationIssue[] }>,
  ): Promise<T[]> {
    const buffer = await source.getWorkbook(dataset);
    if (!buffer) {
      statuses.push({
        dataset,
        lastRefreshedAt: now,
        rowCount: 0,
        status: "fail",
        issues: [{ severity: "error", rowRef: dataset, message: `Workbook not found via ${source.describe()}` }],
      });
      return [];
    }
    const { rows, totalRowsSeen, issues } = await parse(buffer);
    statuses.push({
      dataset,
      lastRefreshedAt: now,
      rowCount: totalRowsSeen,
      status: issues.some((i) => i.severity === "error") ? "fail" : "pass",
      issues,
    });
    return rows;
  }

  const chartOfAccounts = await loadRequired("ChartOfAccounts", parseChartOfAccounts);
  const gl = await loadRequired("GL", parseGl);
  const budget = await loadRequired("Budget", parseBudget);
  const trialBalance = await loadRequired("TrialBalance", parseTrialBalance);
  const currencyRates = await loadRequired("Currency", parseCurrency);
  const territories = await loadRequired("Territory", parseTerritory);
  const cashFlowMapping = await loadRequired("CashFlowMapping", parseCashFlowMapping);
  const soce = await loadRequired("SoCE", parseSoce);
  const calendar = await loadRequired("Calendar", parseCalendar);

  // Cross-dataset checks, layered onto the per-dataset statuses already recorded above.
  addIssues(statuses, "GL", [
    ...findUnmappedAccountKeys("GL", gl, chartOfAccounts),
    ...findDuplicateGlEntries(gl),
  ]);
  addIssues(statuses, "Budget", findUnmappedAccountKeys("Budget", budget, chartOfAccounts));
  addIssues(statuses, "TrialBalance", findUnmappedAccountKeys("Trial Balance", trialBalance, chartOfAccounts));
  addIssues(statuses, "CashFlowMapping", findUnmappedAccountKeys("CashFlow_St", cashFlowMapping, chartOfAccounts));
  addIssues(statuses, "SoCE", findUnmappedAccountKeys("SoCE", soce, chartOfAccounts));

  await writeAllSyncStatuses(statuses);

  return {
    data: { gl, budget, trialBalance, chartOfAccounts, currencyRates, territories, cashFlowMapping, soce, calendar },
    statuses,
  };
}

function addIssues(statuses: DatasetSyncStatus[], dataset: DatasetName, issues: ValidationIssue[]): void {
  if (issues.length === 0) return;
  const status = statuses.find((s) => s.dataset === dataset);
  if (!status) return;
  status.issues.push(...issues);
  if (issues.some((i) => i.severity === "error")) status.status = "fail";
}
