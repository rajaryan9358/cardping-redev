/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
