/**
 * Shared request-validation helpers for every write route under src/app/api/.
 *
 * `requireEditLink()` used to trust a client-asserted `linkMode` field on the
 * request body — documented at the time as "not real access control". Now
 * that real Google sign-in exists (src/lib/auth/member.ts), it checks the
 * actual signed-in session and that member's real role instead. The name is
 * kept (rather than renamed to e.g. requireEditRole) so every existing call
 * site didn't need touching beyond dropping the now-unused `body` argument.
 */

import { query } from "./client";
import { getCurrentMember, isEditRole } from "@/lib/auth/member";

export class WriteGuardError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class NotFoundError extends WriteGuardError {
  constructor(message: string) {
    super(404, message);
  }
}

export async function requireEditLink(): Promise<void> {
  const member = await getCurrentMember();
  if (!member) {
    throw new WriteGuardError(401, "not signed in, or your Google account is not on the members allow-list");
  }
  if (!isEditRole(member.role)) {
    throw new WriteGuardError(403, `your role (${member.role}) is view-only`);
  }
}

/** Converts a thrown WriteGuardError (or NotFoundError) into a Response; rethrows anything else so it surfaces as a real 500. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof WriteGuardError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

/** Throws WriteGuardError(400, "territoryKey does not exist") unless `key` is an integer present in `territory`. */
export async function assertTerritoryExists(key: number): Promise<void> {
  if (!Number.isInteger(key)) {
    throw new WriteGuardError(400, "territoryKey does not exist");
  }
  const rows = await query<{ territory_key: number }>("select territory_key from territory where territory_key = $1", [key]);
  if (rows.length === 0) {
    throw new WriteGuardError(400, "territoryKey does not exist");
  }
}

/** Throws WriteGuardError(400, "fiscalYear does not exist") unless `year` is an integer present in `fiscal_years`. */
export async function assertFiscalYearExists(year: number): Promise<void> {
  if (!Number.isInteger(year)) {
    throw new WriteGuardError(400, "fiscalYear does not exist");
  }
  const rows = await query<{ year: number }>("select year from fiscal_years where year = $1", [year]);
  if (rows.length === 0) {
    throw new WriteGuardError(400, "fiscalYear does not exist");
  }
}
