import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { DatasetSyncStatus } from "../types";

// Placeholder for Supabase (plan.md's chosen store) until a project/credentials
// exist. Holds exactly what design.md §4 specifies: latest status per dataset,
// no history. Swap this file for a Supabase-backed implementation later —
// callers only depend on readAll/writeAll below.
const STORE_PATH = path.resolve(process.cwd(), ".data", "dataset-sync-status.json");

export async function readAllSyncStatuses(): Promise<DatasetSyncStatus[]> {
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as DatasetSyncStatus[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function writeAllSyncStatuses(statuses: DatasetSyncStatus[]): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(statuses, null, 2), "utf-8");
}

export async function upsertSyncStatus(status: DatasetSyncStatus): Promise<void> {
  const all = await readAllSyncStatuses();
  const next = all.filter((s) => s.dataset !== status.dataset);
  next.push(status);
  await writeAllSyncStatuses(next);
}
