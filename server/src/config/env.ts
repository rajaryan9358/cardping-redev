import { z } from "zod";

// Loaded once at process start. Any missing/invalid required variable fails
// fast here instead of surfacing as a confusing error deep in a request.
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().url(),
  LOG_LEVEL: z.string().default("info"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET_CARDS: z.string().default("visiting-cards"),
  SUPABASE_STORAGE_BUCKET_VOICE: z.string().default("voice-notes"),

  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_GRAPH_API_VERSION: z.string().default("v23.0"),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_VISION_MODEL: z.string().default("gpt-4o"),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("whisper-1"),

  COINS_PER_CARD_SCAN: z.coerce.number().int().positive().default(1),
  COINS_STARTER_BALANCE: z.coerce.number().int().nonnegative().default(5),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  CASHFREE_CLIENT_ID: z.string().optional().default(""),
  CASHFREE_CLIENT_SECRET: z.string().optional().default(""),
  CASHFREE_BASE_URL: z.string().default("https://sandbox.cashfree.com/pg"),
  CASHFREE_API_VERSION: z.string().default("2025-01-01"),
  CASHFREE_RETURN_URL: z.string().optional().default(""),
  COIN_TOPUP_AMOUNT_INR: z.coerce.number().positive().default(1000),
  COIN_TOPUP_COINS: z.coerce.number().int().positive().default(50),

  // dashboard/ auth — see docs/DASHBOARD_PLAN.md.
  SESSION_COOKIE_NAME: z.string().default("cardping_session"),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(24 * 30),

  GOOGLE_DASHBOARD_OAUTH_REDIRECT_URI: z.string().optional().default(""),

  // Unset until a Meta Business Manager Authentication template is created
  // and approved — until then, WhatsApp OTP login/channel-link routes
  // return a clear "not configured" error instead of calling Meta's API.
  WHATSAPP_LOGIN_OTP_TEMPLATE_NAME: z.string().optional().default(""),
  WHATSAPP_CHANNEL_LINK_OTP_TEMPLATE_NAME: z.string().optional().default(""),

  // Needed to build the t.me/<bot>?start=<code> channel-link deep link.
  TELEGRAM_BOT_USERNAME: z.string().optional().default(""),

  // Base URL for the "complete your account" link the bot sends an unlinked
  // channel identity — see channelOnboardingService.ts. Falls back to
  // PUBLIC_BASE_URL since dashboard/ and server/ share one origin in
  // production; only needs overriding in a local setup where they run on
  // separate ports with no shared reverse proxy.
  DASHBOARD_BASE_URL: z.string().optional().default(""),
});

type Env = z.infer<typeof envSchema> & {
  WHATSAPP_CHANNEL_LINK_OTP_TEMPLATE_NAME: string;
  DASHBOARD_BASE_URL: string;
};

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const data = parsed.data;
  return {
    ...data,
    // One Authentication template can usually serve both login and
    // channel-link OTPs — only set the second env var if Meta's review
    // ends up requiring a distinct template per use case.
    WHATSAPP_CHANNEL_LINK_OTP_TEMPLATE_NAME:
      data.WHATSAPP_CHANNEL_LINK_OTP_TEMPLATE_NAME || data.WHATSAPP_LOGIN_OTP_TEMPLATE_NAME,
    DASHBOARD_BASE_URL: data.DASHBOARD_BASE_URL || data.PUBLIC_BASE_URL,
  };
}

export const env = loadEnv();

export const isCashfreeEnabled = Boolean(
  env.CASHFREE_CLIENT_ID && env.CASHFREE_CLIENT_SECRET,
);

// Gates for the two dashboard login methods that need external setup this
// session can't complete itself (a Google Cloud redirect URI, a Meta
// Business Manager-approved Authentication template) — see
// docs/DASHBOARD_PLAN.md. Routes check these before ever calling out to
// Google/Meta, returning a clear "not configured" error instead.
export const isGoogleDashboardLoginEnabled = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_DASHBOARD_OAUTH_REDIRECT_URI,
);

export const isWhatsappOtpLoginEnabled = Boolean(env.WHATSAPP_LOGIN_OTP_TEMPLATE_NAME);
