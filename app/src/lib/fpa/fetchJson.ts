/**
 * Wraps fetch + JSON parsing so every caller gets one consistent failure mode
 * instead of three silent ones (network rejection, a non-JSON body, or a
 * non-2xx response quietly parsed as if it were the expected payload).
 * Always throws a plain Error with a message safe to show the user.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Couldn't reach the server — check your connection and try again.");
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`The server returned an unreadable response (status ${res.status}).`);
  }

  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (status ${res.status}).`;
    throw new Error(message);
  }

  return body as T;
}
