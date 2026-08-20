import "server-only";

// See server/src/db/resilientFetch.ts (same idea, duplicated rather than
// shared since admin/ and server/ are separate packages) — a Supabase-
// side latency spike previously had no ceiling at all here either; admin
// talks to Supabase directly with its own service-role client, same as
// server/.
const TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 500;

function isReadRequest(init?: RequestInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Passed as supabase-js's `global.fetch`. Reads get one fast retry
 * (side-effect-free); writes fail fast on timeout instead of retrying,
 * since retrying a mutation without knowing whether the first attempt
 * already landed risks a duplicate. */
export async function resilientSupabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetchWithTimeout(input, init);
  } catch (err) {
    if (!isReadRequest(init)) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetchWithTimeout(input, init); // a second failure propagates normally
  }
}
