import { redirectIfPaywalled, serverFetch } from "../serverFetch";

export interface HomeSummary {
  totalContacts: number;
  totalEvents: number;
  scansThisWeek: number;
  scansTrendPct: number | null;
}

export async function getHomeSummary(): Promise<HomeSummary> {
  const res = await serverFetch("/api/home/summary");
  redirectIfPaywalled(res);
  if (!res.ok) return { totalContacts: 0, totalEvents: 0, scansThisWeek: 0, scansTrendPct: null };
  const data = await res.json();
  return {
    totalContacts: data.totalContacts,
    totalEvents: data.totalEvents,
    scansThisWeek: data.scansThisWeek,
    scansTrendPct: data.scansTrendPct,
  };
}
