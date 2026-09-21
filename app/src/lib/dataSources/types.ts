import type { DatasetName } from "../types";

// Abstraction so "read from a local folder" (now) and "read from Google Drive"
// (once a real shared folder + service account exist, per plan.md §4) are
// interchangeable — nothing above this layer should know which one is in use.
export interface DataSource {
  /** Returns the raw workbook bytes for a dataset, or null if not found. */
  getWorkbook(dataset: DatasetName): Promise<Buffer | null>;
  describe(): string;
}
