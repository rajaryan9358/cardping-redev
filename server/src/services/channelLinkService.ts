import crypto from "crypto";
import { env } from "../config/env";
import { channelLinksRepo } from "../db/repositories/channelLinks.repo";
import { otpCodesRepo } from "../db/repositories/otpCodes.repo";
import { usersRepo } from "../db/repositories/users.repo";
import { ChannelLink, ChannelLinkChannel } from "../types/domain";
import * as walletService from "./walletService";

const LINK_CODE_TTL_MINUTES = 10;

/** Links a bot channel identity to a dashboard account and, in the same
 * step, transfers whatever legacy coin balance that channel had
 * accumulated (see walletService.mergeLegacyBalanceOnLink). Throws
 * whatever channelLinksRepo.create throws on a unique-violation — callers
 * catch that and surface a 409 "already connected elsewhere," not a 500. */
export async function linkChannel(
  accountId: string,
  usersId: string,
  channel: ChannelLinkChannel,
  channelIdentifier: string,
  legacyBalance: number,
): Promise<ChannelLink> {
  const link = await channelLinksRepo.create({ accountId, usersId, channel, channelIdentifier });
  await walletService.mergeLegacyBalanceOnLink(usersId, accountId, legacyBalance);
  return link;
}

/** marketing_opt_in lives per channel identity, not on the account — this
 * applies one value to every channel currently linked to it. Shared by the
 * dashboard preferences toggle (account.route.ts) and the signup consent
 * checkbox (auth.route.ts), so both stay in sync with the same behavior:
 * an account with no linked channel yet is a harmless no-op, since there's
 * nothing to set until one links. */
export async function setMarketingOptInForAccount(accountId: string, optIn: boolean): Promise<void> {
  const links = await channelLinksRepo.listByAccountId(accountId);
  await Promise.all(links.map((link) => usersRepo.setMarketingOptIn(link.users_id, optIn)));
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Generates the code embedded in the t.me/<bot>?start=<code> deep link —
 * `target` on the otp_codes row holds the requesting account's id, since
 * (unlike a WhatsApp OTP) there's no separate phone number to key on;
 * the inbound Telegram /start only ever has the code itself. */
export async function createTelegramLinkCode(accountId: string): Promise<string> {
  const code = crypto.randomBytes(5).toString("hex");
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000).toISOString();
  await otpCodesRepo.create({ purpose: "channel_link", target: accountId, codeHash: hashCode(code), expiresAt });
  return code;
}

export function buildTelegramDeepLink(code: string): string {
  return `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code}`;
}

/** Resolves a /start <code> payload back to the account that requested
 * it, marking the code consumed. Returns null on any invalid/expired/
 * already-used code — callers just reply with a generic "link expired,
 * generate a new one from the dashboard" rather than distinguishing why. */
export async function resolveTelegramLinkCode(code: string): Promise<string | null> {
  const row = await otpCodesRepo.findByCodeHash(hashCode(code), "channel_link");
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  await otpCodesRepo.markConsumed(row.id);
  return row.target; // accountId
}
