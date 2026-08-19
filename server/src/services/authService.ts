import bcrypt from "bcryptjs";
import { Response } from "express";
import { env } from "../config/env";
import { sessionsRepo, SessionSource } from "../db/repositories/sessions.repo";
import { Account } from "../types/domain";

const BCRYPT_ROUNDS = 12; // matches admin/lib/auth.ts's convention

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Very rough device label from the user-agent — good enough for "which
 * session is which" on the Profile → Sessions screen, not real device
 * fingerprinting. */
export function deviceLabelFromUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  if (/iphone|ipad/i.test(userAgent)) return "iOS device";
  if (/android/i.test(userAgent)) return "Android device";
  if (/macintosh/i.test(userAgent)) return "Mac";
  if (/windows/i.test(userAgent)) return "Windows PC";
  if (/linux/i.test(userAgent)) return "Linux PC";
  return "Unknown device";
}

/** Creates a session row and sets the cookie on `res` — the one place both
 * happen together, so no route can set a cookie for a session that was
 * never persisted (or vice versa). */
export async function createSessionAndSetCookie(
  res: Response,
  accountId: string,
  userAgent: string | undefined,
  source: SessionSource = "login",
): Promise<void> {
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
  const sessionId = await sessionsRepo.create({
    accountId,
    deviceLabel: deviceLabelFromUserAgent(userAgent),
    userAgent: userAgent ?? null,
    expiresAt: expiresAt.toISOString(),
    source,
  });

  res.cookie(env.SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" });
}

export type PublicAccount = Omit<Account, "password_hash"> & { has_password: boolean };

/** Never send password_hash to the client — every route that returns an
 * account goes through this. has_password is computed here since the
 * frontend needs to know whether one is set (for the "as per logged-in
 * method" password-management UI) without ever seeing the hash itself. */
export function sanitizeAccount(account: Account): PublicAccount {
  const { password_hash, ...rest } = account;
  return { ...rest, has_password: Boolean(password_hash) };
}
