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
  },
};

module.exports = nextConfig;
