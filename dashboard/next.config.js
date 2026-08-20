/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Default (unset) caches a dynamic page's data client-side for 30s
  // after a <Link> navigation — clicking to another page and back within
  // that window shows stale data (coin balance, cards, events...) with no
  // way to force a refresh short of a hard reload. 0 means every
  // navigation to a dynamic route re-fetches instead of reusing the
  // in-memory copy.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  // In production, nginx routes /api/* to server/ directly, so this never
  // fires there (nginx intercepts first). In local dev, with no reverse
  // proxy in front of either app, this is what makes lib/clientFetch.ts's
  // relative /api/... calls actually reach server/ on its own port.
  async rewrites() {
    const serverBaseUrl = process.env.SERVER_API_BASE_URL || "http://127.0.0.1:3000";
    return [{ source: "/api/:path*", destination: `${serverBaseUrl}/api/:path*` }];
  },
};

module.exports = nextConfig;
