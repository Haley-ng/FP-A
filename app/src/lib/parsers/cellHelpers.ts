import type ExcelJS from "exceljs";
import type { ValidationIssue } from "../types";

/**
 * ExcelJS returns formula cells as `{formula, result, ...}` rather than the
 * plain cached value — GL.xlsx uses chained formulas (e.g. `=C27407`) for
 * Territory_key on several "Transfer of Net Profit" closing entries. Excel
 * caches the computed result in the file, so we read that instead of the
 * formula text.
 */
function unwrap(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (value !== null && typeof value === "object" && !(value instanceof Date) && "result" in value) {
    return (value as { result: ExcelJS.CellValue }).result;
  }
  return value;
}

export function toDate(
  rawValue: ExcelJS.CellValue,
  rowNumber: number,
  column: string,
  issues: ValidationIssue[],
): Date | null {
  const value = unwrap(rawValue);
  if (value instanceof Date) return value;
  issues.push({
    severity: "error",
    rowRef: `row ${rowNumber}`,
    message: `"${column}" is not a valid date (got ${JSON.stringify(value)}) — row excluded from calculations`,
  });
  return null;
}

export function toNumber(
  rawValue: ExcelJS.CellValue,
  rowNumber: number,
  column: string,
  issues: ValidationIssue[],
): number | null {
  const value = unwrap(rawValue);
  const n = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || value === "" || Number.isNaN(n)) {
    issues.push({
      severity: "error",
      rowRef: `row ${rowNumber}`,
      message: `"${column}" is not a valid number (got ${JSON.stringify(value)}) — row excluded from calculations`,
    });
    return null;
  }
  return n;
}

/** Like toNumber, but a blank cell means "no balance recorded" (0), not an error — e.g. Trial Balance's sparse Amount column. */
export function toNumberOrZero(rawValue: ExcelJS.CellValue, rowNumber: number, column: string, issues: ValidationIssue[]): number | null {
  const value = unwrap(rawValue);
  if (value === null || value === undefined || value === "") return 0;
  return toNumber(rawValue, rowNumber, column, issues);
}

export function toRequiredString(
  rawValue: ExcelJS.CellValue,
  rowNumber: number,
  column: string,
  issues: ValidationIssue[],
): string | null {
  const value = unwrap(rawValue);
  const s = value === null || value === undefined ? "" : String(value).trim();
  if (!s) {
    issues.push({
      severity: "error",
      rowRef: `row ${rowNumber}`,
      message: `"${column}" is missing — row excluded from calculations`,
    });
    return null;
  }
  return s;
}

/** For optional descriptive text (e.g. SubAccount) — blank is fine, not an issue. */
export function toOptionalString(rawValue: ExcelJS.CellValue): string {
  const value = unwrap(rawValue);
  return value === null || value === undefined ? "" : String(value).trim();
}
