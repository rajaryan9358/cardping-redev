import { childLogger } from "./logger";

const log = childLogger("ip-geolocation");

const PRIVATE_IP_RANGES = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./, /^::1$/, /^::ffff:127\./];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(ip));
}

/** Best-effort "City, Region" lookup for a session's location column — a
 * local dev IP or a failed/slow lookup just means the field stays null,
 * never blocks session creation itself. Free tier of ip-api.com (no key,
 * 45 req/min), which is plenty for login volume this app sees. */
export async function resolveIpLocation(ip: string | undefined): Promise<string | null> {
  if (!ip) return null;
  const clean = ip.replace(/^::ffff:/, "");
  if (isPrivateIp(clean)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${clean}?fields=status,city,regionName`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { status: string; city?: string; regionName?: string };
    if (data.status !== "success") return null;
    return [data.city, data.regionName].filter(Boolean).join(", ") || null;
  } catch (err) {
    log.warn({ err }, "IP geolocation lookup failed");
    return null;
  }
}
