import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DatasetName } from "../types";
import type { DataSource } from "./types";

// Filenames as they actually exist in Finance Dataset/ (see docs/3-plan/data-model.md).
const FILENAMES: Record<DatasetName, string> = {
  GL: "GL.xlsx",
  Budget: "Budget.xlsx",
  TrialBalance: "Trial Balance.xlsx",
  ChartOfAccounts: "Chart of Accounts.xlsx",
  Currency: "Currency_data.xlsx",
  Territory: "Territory.xlsx",
  CashFlowMapping: "CashFlow_St.xlsx",
  SoCE: "SoCE.xlsx",
  Calendar: "Calendar.xlsx",
};

/**
 * Reads workbooks from a local folder — stands in for the Google Drive sync
 * described in plan.md §1 until a real shared folder + service account exist.
 * Defaults to the `Finance Dataset/` folder at the project root.
 */
export class LocalFileSource implements DataSource {
  constructor(private readonly folder: string = path.resolve(process.cwd(), "..", "Finance Dataset")) {}

  async getWorkbook(dataset: DatasetName): Promise<Buffer | null> {
    const filePath = path.join(this.folder, FILENAMES[dataset]);
    try {
      return await readFile(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  describe(): string {
    return `local folder: ${this.folder}`;
  }
}
