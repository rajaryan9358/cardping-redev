import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";

/** For Server Components/Server Actions — a fetch() issued from this
 * Node process during SSR is a plain server-to-server call and won't
 * carry the browser's cookies automatically, so this forwards the
 * incoming request's Cookie header by hand. Targets server/ directly
 * (bypassing nginx), mirroring admin/'s SERVER_HEALTH_URL convention. */
export async function serverFetch(path: string, init?: RequestInit): Promise<Response> {
  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  return fetch(`${env.SERVER_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Cookie: cookieHeader,
    },
    cache: "no-store",
  });
}

/** Convenience wrapper for the common case: GET, expect JSON, return null
 * on any non-2xx (typically 401 — no session yet) instead of throwing. */
export async function serverFetchJson<T>(path: string): Promise<T | null> {
  const res = await serverFetch(path);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Content routes (home/cards/events — see requireActivePlanOrTrial on
 * server/) 402 when an account is out of trial coins and has no active
 * plan. Call this right after the fetch on any page that hits one of
 * those routes, so an out-of-plan account lands on /subscription to fix
 * it instead of silently seeing an empty dashboard. */
export function redirectIfPaywalled(res: Response): void {
  if (res.status === 402) redirect("/subscription");
}
