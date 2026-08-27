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

/** "8h 21m" style — for a process's `process.uptime()` seconds figure. */
export function formatUptime(totalSeconds: number): string {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}
