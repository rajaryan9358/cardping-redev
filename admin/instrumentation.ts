// Next.js calls register() exactly once when the server process starts
// (both `next dev` and `next start`) — the officially supported place to
// kick off a background interval, since admin/ runs as a long-lived pm2
// process rather than a serverless function. Requires
// experimental.instrumentationHook in next.config.js on Next 14.
//
// instrumentation.ts is bundled for both the Node.js and Edge runtimes
// (Next.js middleware can run on either), but everything this file
// imports (fs, the Supabase client, etc.) is Node-only. The
// `if (process.env.NEXT_RUNTIME === 'nodejs') { await import(...) }`
// shape below isn't just a runtime guard — Next's bundler specifically
// recognizes this exact pattern and excludes the dynamic import from the
// Edge bundle. Don't refactor it to an early-return / inverted condition;
// that form doesn't get the same treatment and breaks the Edge build.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
