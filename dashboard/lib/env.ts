import { z } from "zod";

// Same fail-fast-at-boot pattern as server/src/config/env.ts and
// admin/lib/env.ts. SERVER_API_BASE_URL is where lib/serverFetch.ts sends
// SSR requests directly, bypassing nginx — client-side calls stay relative
// (/api/...) since dashboard/ and server/ share one domain (see
// lib/clientFetch.ts), so no NEXT_PUBLIC_* equivalent is needed here.
const envSchema = z.object({
  SERVER_API_BASE_URL: z.string().default("http://127.0.0.1:3000"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
