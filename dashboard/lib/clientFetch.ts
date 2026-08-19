"use client";

/** For Client Components — relative path, browser attaches the session
 * cookie automatically (same-origin, nginx routes /api/* to server/), so
 * this just needs credentials: "include" for that to actually happen. */
export async function clientFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export interface ApiError {
  error: string;
  issues?: string[];
}

/** Parses a clientFetch() response, throwing an Error with the server's
 * `error` code as the message on failure — callers show that (or a
 * friendlier mapped string) inline instead of a generic failure state. */
export async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as ApiError | null)?.error ?? `request_failed_${res.status}`;
    throw new Error(message);
  }
  return body as T;
}
