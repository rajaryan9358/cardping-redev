import crypto from "crypto";
import { env } from "../config/env";
import { otpCodesRepo } from "../db/repositories/otpCodes.repo";
import { usersRepo } from "../db/repositories/users.repo";
import { ChannelLink, ChannelLinkChannel } from "../types/domain";
import * as channelLinkService from "./channelLinkService";

const ONBOARDING_LINK_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Sent to a bot user with no channel_links row yet, on every inbound
 * message, until they link — see whatsapp/telegram router.ts. `target`
 * holds "<channel>:<identifier>" since that's all the dashboard signup page
 * needs on redemption; like the Telegram deep-link code, the token is
 * hashed without folding in a target because the target isn't known until
 * the token itself comes back. A fresh token is minted every time rather
 * than reused, so there's no need to recover a raw token from a stored
 * hash. */
export async function createOnboardingLink(channel: ChannelLinkChannel, channelIdentifier: string): Promise<string> {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + ONBOARDING_LINK_TTL_MINUTES * 60_000).toISOString();
  await otpCodesRepo.create({
    purpose: "channel_onboarding",
    target: `${channel}:${channelIdentifier}`,
    codeHash: hashToken(token),
    expiresAt,
  });
  return `${env.DASHBOARD_BASE_URL}/signup?onboard=${token}`;
}

export interface ResolvedOnboardingToken {
  channel: ChannelLinkChannel;
  channelIdentifier: string;
}

function parseTarget(target: string): ResolvedOnboardingToken {
  const [channel, ...rest] = target.split(":");
  return { channel: channel as ChannelLinkChannel, channelIdentifier: rest.join(":") };
}

/** Resolves a signup page's ?onboard= token back to the channel it was
 * issued for, without consuming it — the signup page needs to show channel
 * context ("Connecting your WhatsApp") before the form is even submitted.
 * Consumption only happens once an account is actually created. */
export async function resolveOnboardingToken(token: string): Promise<ResolvedOnboardingToken | null> {
  const row = await otpCodesRepo.findByCodeHash(hashToken(token), "channel_onboarding");
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return parseTarget(row.target);
}

/** Marks the token consumed and performs the actual link — called right
 * after a new account is created via the onboard-token signup path. Mirrors
 * channelLinkService.linkChannel's create+merge-balance shape exactly, and
 * throws the same unique-violation callers already know how to catch. */
export async function consumeOnboardingToken(token: string, accountId: string): Promise<ChannelLink | null> {
  const row = await otpCodesRepo.findByCodeHash(hashToken(token), "channel_onboarding");
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  await otpCodesRepo.markConsumed(row.id);
  const { channel, channelIdentifier } = parseTarget(row.target);
  const user = await usersRepo.findOrCreate(channel, channelIdentifier, channelIdentifier);
  return channelLinkService.linkChannel(accountId, user.user_id, channel, channelIdentifier, user.coin_balance);
}

/** Where "Start scanning" on the post-signup success screen sends the user
 * back to — the practical version of "closes the browser and returns to
 * the channel," since a normally-navigated tab can't be force-closed. */
export function buildChannelReturnUrl(channel: ChannelLinkChannel, channelIdentifier: string): string {
  return channel === "telegram"
    ? `https://t.me/${env.TELEGRAM_BOT_USERNAME}`
    : `https://wa.me/${channelIdentifier.replace(/\D/g, "")}`;
}
