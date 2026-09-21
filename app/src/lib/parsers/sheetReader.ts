import ExcelJS from "exceljs";

export interface RawRow {
  /** 1-indexed row number in the sheet, for error messages. */
  rowNumber: number;
  values: Record<string, ExcelJS.CellValue>;
}

/**
 * Reads a worksheet into header-keyed rows. Row 1 is the header; a row is
 * skipped only if every cell in it is empty (several source workbooks —
 * Chart of Accounts, SoCE, CashFlow_St — have large trailing blank ranges).
 */
export async function readSheetAsync(buffer: Buffer, sheetName: string): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found (available: ${workbook.worksheets.map((w) => w.name).join(", ")})`);
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: RawRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, ExcelJS.CellValue> = {};
    let hasAnyValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const value = cell.value;
      values[header] = value;
      if (value !== null && value !== undefined && value !== "") hasAnyValue = true;
    });
    if (hasAnyValue) rows.push({ rowNumber, values });
  });

  return rows;
}
