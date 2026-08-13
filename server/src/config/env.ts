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
  OPENAI_EMAIL_MODEL: z.string().default("gpt-4o"),

  COINS_PER_CARD_SCAN: z.coerce.number().int().positive().default(1),
  COINS_STARTER_BALANCE: z.coerce.number().int().nonnegative().default(5),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional().default(""),

  CASHFREE_CLIENT_ID: z.string().optional().default(""),
  CASHFREE_CLIENT_SECRET: z.string().optional().default(""),
  CASHFREE_BASE_URL: z.string().default("https://sandbox.cashfree.com/pg"),
  CASHFREE_API_VERSION: z.string().default("2025-01-01"),
  CASHFREE_RETURN_URL: z.string().optional().default(""),
  COIN_TOPUP_AMOUNT_INR: z.coerce.number().positive().default(1000),
  COIN_TOPUP_COINS: z.coerce.number().int().positive().default(50),
});

type Env = z.infer<typeof envSchema> & {
  GOOGLE_OAUTH_REDIRECT_URI: string;
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
    GOOGLE_OAUTH_REDIRECT_URI:
      data.GOOGLE_OAUTH_REDIRECT_URI || `${data.PUBLIC_BASE_URL}/oauth/google/callback`,
  };
}

export const env = loadEnv();

export const isGmailFollowUpEnabled = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);

export const isCashfreeEnabled = Boolean(
  env.CASHFREE_CLIENT_ID && env.CASHFREE_CLIENT_SECRET,
);
