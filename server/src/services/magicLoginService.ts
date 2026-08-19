import crypto from "crypto";
import { env } from "../config/env";
import { otpCodesRepo } from "../db/repositories/otpCodes.repo";

const MAGIC_LOGIN_TTL_MINUTES = 10;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** A bot-issued link that logs the browser straight into an already-linked
 * account and lands on a specific dashboard page — used for "Buy Credits"
 * and "Subscribe" from the bot instead of a parallel in-bot Cashfree flow.
 * Shorter TTL than the channel-onboarding link (10 vs 30 minutes) since
 * this grants a full session, not just a channel link. Modeled directly on
 * channelOnboardingService.ts's token pattern. */
export async function createMagicLoginLink(accountId: string, destinationPath: string): Promise<string> {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LOGIN_TTL_MINUTES * 60_000).toISOString();
  await otpCodesRepo.create({
    purpose: "magic_login",
    target: `${accountId}:${destinationPath}`,
    codeHash: hashToken(token),
    expiresAt,
  });
  return `${env.PUBLIC_BASE_URL}/api/auth/magic-login?token=${token}`;
}

export interface ResolvedMagicLoginToken {
  accountId: string;
  destinationPath: string;
}

const LINK_PREVIEW_BOT_UA_PATTERN =
  /whatsapp|telegrambot|facebookexternalhit|slackbot|twitterbot|discordbot|linkedinbot|skypeuripreview|redditbot/i;

/** WhatsApp and Telegram both fetch a link server-side to generate a chat
 * preview card *before* the user ever taps it — since the token is
 * single-use, that fetch would otherwise burn it and leave the real tap
 * looking like an expired link. Checked before ever touching the token. */
export function isLikelyLinkPreviewBot(userAgent: string | undefined): boolean {
  return Boolean(userAgent && LINK_PREVIEW_BOT_UA_PATTERN.test(userAgent));
}

/** Resolves and consumes in one step — unlike the onboarding token, there's
 * no separate "peek without consuming" need here (the token is only ever
 * used once, immediately, to establish a session). */
export async function resolveAndConsumeMagicLoginToken(token: string): Promise<ResolvedMagicLoginToken | null> {
  const row = await otpCodesRepo.findByCodeHash(hashToken(token), "magic_login");
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  await otpCodesRepo.markConsumed(row.id);
  const [accountId, ...rest] = row.target.split(":");
  return { accountId, destinationPath: rest.join(":") };
}
