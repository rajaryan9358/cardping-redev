import crypto from "crypto";
import { env, isWhatsappOtpLoginEnabled } from "../config/env";
import { otpCodesRepo, OtpPurpose } from "../db/repositories/otpCodes.repo";
import { whatsappClient } from "../integrations/whatsapp/client";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(code: string, target: string): string {
  // target is folded into the hash so a leaked hash from one row can't be
  // replayed against a different phone number's attempt.
  return crypto.createHash("sha256").update(`${code}:${target}`).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export class OtpNotConfiguredError extends Error {
  constructor() {
    super("WhatsApp OTP is not configured on this server yet.");
    this.name = "OtpNotConfiguredError";
  }
}

/** Generates a code, stores its hash, and sends it via the Meta
 * Authentication template — throws OtpNotConfiguredError (checked before
 * ever calling Meta's API) if the template env var isn't set yet. */
export async function requestOtp(target: string, purpose: OtpPurpose): Promise<void> {
  if (!isWhatsappOtpLoginEnabled) throw new OtpNotConfiguredError();

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
  await otpCodesRepo.create({ purpose, target, codeHash: hashCode(code, target), expiresAt });

  const templateName =
    purpose === "login" ? env.WHATSAPP_LOGIN_OTP_TEMPLATE_NAME : env.WHATSAPP_CHANNEL_LINK_OTP_TEMPLATE_NAME;

  await whatsappClient.sendTemplate(env.WHATSAPP_PHONE_NUMBER_ID, target, templateName, "en", [
    { type: "body", parameters: [{ type: "text", text: code }] },
  ]);
}

export type OtpVerifyResult = "valid" | "invalid" | "expired" | "too_many_attempts";

/** Validates a code against the most recent pending code for this
 * target+purpose, marking it consumed on success so it can't be reused. */
export async function verifyOtp(target: string, purpose: OtpPurpose, code: string): Promise<OtpVerifyResult> {
  const row = await otpCodesRepo.findLatestPending(target, purpose);
  if (!row) return "invalid";
  if (new Date(row.expires_at) < new Date()) return "expired";
  if (row.attempts >= MAX_ATTEMPTS) return "too_many_attempts";

  const matches = row.code_hash === hashCode(code, target);
  if (!matches) {
    await otpCodesRepo.setAttempts(row.id, row.attempts + 1);
    return "invalid";
  }

  await otpCodesRepo.markConsumed(row.id);
  return "valid";
}
