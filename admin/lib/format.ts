// A fixed locale, not the environment's default — `toLocaleDateString()`
// with no locale argument follows the *runtime's* locale, which differs
// between the Node server (SSR) and the browser (hydration), producing a
// React hydration mismatch on every date in a Client Component. Pin one
// locale so server and client always render the same string.
const LOCALE = "en-US";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE);
}
