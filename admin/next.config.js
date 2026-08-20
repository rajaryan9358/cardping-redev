/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Served at cardpingv2.rankkking.com/admin behind nginx, not its own
  // subdomain — basePath makes every Link/redirect/static asset resolve
  // under that prefix automatically.
  basePath: "/admin",
  // instrumentation.ts's register() starts the notification-check
  // scheduler once at server boot — stable by default only from Next 15;
  // on 14.x it needs this flag. See instrumentation.ts.
  experimental: {
    instrumentationHook: true,
    // Default (unset) caches a dynamic page's data client-side for 30s
    // after a <Link> navigation — clicking away and back within that
    // window shows stale data with no way to force a refresh short of a
    // hard reload. 0 means every navigation to a dynamic route re-fetches
    // instead of reusing the in-memory copy. Every page here (Users,
    // Cards, Events, Subscriptions...) is coin balances/block state/plan
    // status an admin is actively acting on, so staleness is a real
    // correctness problem, not just a minor UX one.
    staleTimes: {
      dynamic: 0,
    },
  },
};

module.exports = nextConfig;
