import { childLogger } from "../lib/logger";

const log = childLogger("supabase-fetch");

// Node's global fetch is typed via @types/node's bundled undici types
// rather than lib.dom.d.ts (this project's tsconfig has no "dom" lib),
// which doesn't expose RequestInfo/RequestInit as standalone global
// names — deriving from `typeof fetch` itself sidesteps that entirely.
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

// See the incident this was added for: a single Supabase query spiked to
// 68s before self-resolving with no code-level cause, and a WhatsApp
// reply chain (several sequential Supabase calls) waited ~5 minutes with
// no ceiling at all — the call just hung exactly as long as Supabase's
// backend took, however long that was. Without SUPABASE_DB_URL or a
// paid tier's dedicated compute, that intermittent slowness isn't
// something this app can fix directly — but it can stop waiting on it
// forever.
const TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 500;

function isReadRequest(init: FetchInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

async function fetchWithTimeout(input: FetchInput, init: FetchInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Passed as supabase-js's `global.fetch` — every REST/Storage call this
 * client makes goes through here, so this is the one place to add a
 * ceiling without touching every repo file individually.
 *
 * Reads (GET/HEAD — PostgREST maps every `.select()` to one) get a single
 * fast retry on timeout or failure, since they're side-effect-free.
 * Writes never retry automatically: retrying a mutation without knowing
 * whether the first attempt actually landed on Supabase's side risks a
 * duplicate (a double coin-credit, a duplicate row) — a write that times
 * out fails fast and surfaces to the caller instead, same as it always
 * did on a genuine error, just bounded to TIMEOUT_MS now instead of
 * unbounded. */
export async function resilientSupabaseFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  try {
    return await fetchWithTimeout(input, init);
  } catch (err) {
    if (!isReadRequest(init)) throw err;
    const timedOut = err instanceof Error && err.name === "AbortError";
    log.warn({ url: String(input), timedOut }, "Supabase read slow/failed — retrying once");
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetchWithTimeout(input, init); // a second failure propagates normally
  }
}
