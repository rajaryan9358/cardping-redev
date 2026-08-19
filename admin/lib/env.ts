import { z } from "zod";

// Same fail-fast-at-boot pattern as server/src/config/env.ts. SERVER_ENV_PATH /
// DASHBOARD_ENV_PATH point at the sibling apps' .env files on the same VPS
// (../server/.env, ../dashboard/.env by default) — the Env Variables screen,
// the re-run-extraction vision call, and the broadcast send client all read
// secrets out of those files directly rather than duplicating them into this
// app's own .env. See admin/lib/appEnvFiles.ts.
const envSchema = z.object({
  PORT: z.coerce.number().default(3200),
  NODE_ENV: z.string().default("development"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  SERVER_ENV_PATH: z.string().default("../server/.env"),
  DASHBOARD_ENV_PATH: z.string().default("../dashboard/.env"),
  SERVER_HEALTH_URL: z.string().default("http://127.0.0.1:3000/health"),

  SESSION_COOKIE_NAME: z.string().default("cardping_admin_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 7),

  // Proactive WhatsApp notifications (renewal reminders, low-balance
  // alerts) — see lib/notificationChecks.ts. Template names are entered by
  // hand, same as Broadcasts, since there's no API to list approved
  // WhatsApp templates. These are Utility-category templates, not
  // Marketing — see docs/ADMIN_APP.md.
  WHATSAPP_RENEWAL_TEMPLATE_NAME: z.string().default("subscription_renewal_reminder"),
  WHATSAPP_LOW_BALANCE_TEMPLATE_NAME: z.string().default("low_coin_balance_alert"),
  RENEWAL_REMINDER_DAYS_BEFORE_EXPIRY: z.coerce.number().int().positive().default(3),
  LOW_BALANCE_THRESHOLD: z.coerce.number().int().nonnegative().default(10),
  NOTIFICATION_CHECK_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
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
