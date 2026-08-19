import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { env, isGoogleDashboardLoginEnabled, isWhatsappOtpLoginEnabled } from "../../config/env";
import { accountsRepo } from "../../db/repositories/accounts.repo";
import { channelLinksRepo } from "../../db/repositories/channelLinks.repo";
import { sessionsRepo } from "../../db/repositories/sessions.repo";
import { buildDashboardGoogleAuthUrl, exchangeCodeForProfile } from "../../integrations/google/dashboardOAuth";
import { requireSession } from "../../middleware/requireSession";
import {
  clearSessionCookie,
  createSessionAndSetCookie,
  hashPassword,
  sanitizeAccount,
  verifyPassword,
} from "../../services/authService";
import { OtpNotConfiguredError, requestOtp, verifyOtp } from "../../services/otpService";
import * as channelOnboardingService from "../../services/channelOnboardingService";
import * as magicLoginService from "../../services/magicLoginService";
import { completeOnboarding } from "../../services/onboardingService";
import { childLogger } from "../../lib/logger";
import { parseBody } from "./validate";

export const authRouter = Router();
const log = childLogger("api-auth-route");

// ── config ──────────────────────────────────────────────────────────────
// Public, no auth required — the frontend fetches this once to render
// login/signup buttons correctly instead of offering a dead click.
authRouter.get("/auth/config", (_req, res) => {
  res.json({
    googleEnabled: isGoogleDashboardLoginEnabled,
    whatsappOtpEnabled: isWhatsappOtpLoginEnabled,
    startingCoins: env.COINS_STARTER_BALANCE,
  });
});

// ── email + password ────────────────────────────────────────────────────
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).optional(),
  // Set when signup was reached via a bot-issued "complete your account"
  // link (see channelOnboardingService.ts) — links the issuing channel to
  // this account and skips the normal onboarding wizard, since arriving
  // this way already establishes everything that wizard exists to do.
  onboardToken: z.string().min(1).optional(),
});

authRouter.post("/auth/signup", async (req, res) => {
  const body = parseBody(signupSchema, req, res);
  if (!body) return;

  try {
    const existing = await accountsRepo.findByEmail(body.email);
    if (existing) {
      res.status(409).json({ error: "email_already_registered" });
      return;
    }

    let account = await accountsRepo.create({
      email: body.email,
      password_hash: await hashPassword(body.password),
      full_name: body.fullName ?? null,
    });

    let linkedChannel: string | undefined;
    let returnUrl: string | undefined;
    if (body.onboardToken) {
      try {
        const link = await channelOnboardingService.consumeOnboardingToken(body.onboardToken, account.id);
        if (link) {
          linkedChannel = link.channel;
          returnUrl = channelOnboardingService.buildChannelReturnUrl(link.channel, link.channel_identifier);
          account = await completeOnboarding(account.id);
        }
      } catch (err: any) {
        // Lost a race to link this identifier (someone else claimed it a
        // moment earlier) — the account itself is still created fine, it
        // just falls through to the normal onboarding wizard.
        if (err?.code !== "23505") throw err;
        log.warn({ err }, "onboard token lost a channel-link race");
      }
    }

    await createSessionAndSetCookie(res, account.id, req.header("user-agent"));
    res.json({ account: sanitizeAccount(account), linkedChannel, returnUrl });
  } catch (err) {
    log.error({ err }, "signup failed");
    res.status(500).json({ error: "signup_failed" });
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/auth/login", async (req, res) => {
  const body = parseBody(loginSchema, req, res);
  if (!body) return;

  try {
    const account = await accountsRepo.findByEmail(body.email);
    if (!account || !account.password_hash || !(await verifyPassword(body.password, account.password_hash))) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    if (account.blocked_at) {
      res.status(403).json({ error: "account_blocked" });
      return;
    }

    await createSessionAndSetCookie(res, account.id, req.header("user-agent"));
    res.json({ account: sanitizeAccount(account) });
  } catch (err) {
    log.error({ err }, "login failed");
    res.status(500).json({ error: "login_failed" });
  }
});

const passwordSchema = z.object({ currentPassword: z.string().optional(), newPassword: z.string().min(8) });

authRouter.post("/auth/password", requireSession, async (req, res) => {
  const body = parseBody(passwordSchema, req, res);
  if (!body) return;
  const account = req.account!;

  if (account.password_hash) {
    if (!body.currentPassword || !(await verifyPassword(body.currentPassword, account.password_hash))) {
      res.status(401).json({ error: "current_password_incorrect" });
      return;
    }
  }

  try {
    await accountsRepo.update(account.id, { password_hash: await hashPassword(body.newPassword) });
    res.json({ ok: true });
  } catch (err) {
    log.error({ err }, "password update failed");
    res.status(500).json({ error: "password_update_failed" });
  }
});

// ── Google OAuth ────────────────────────────────────────────────────────
authRouter.get("/auth/google/start", (_req, res) => {
  if (!isGoogleDashboardLoginEnabled) {
    res.status(501).json({ error: "google_login_not_configured" });
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  res.redirect(buildDashboardGoogleAuthUrl(state));
});

authRouter.get("/auth/google/callback", async (req, res) => {
  if (!isGoogleDashboardLoginEnabled) {
    res.status(501).json({ error: "google_login_not_configured" });
    return;
  }
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect("/login?error=google_auth_failed");
    return;
  }

  try {
    const profile = await exchangeCodeForProfile(code);
    let account = await accountsRepo.findByGoogleId(profile.googleId);
    if (!account) {
      account = await accountsRepo.create({
        google_id: profile.googleId,
        email: profile.email,
        email_verified_at: new Date().toISOString(),
        full_name: profile.fullName,
        avatar_url: profile.avatarUrl,
      });
    }
    if (account.blocked_at) {
      res.redirect("/login?error=account_blocked");
      return;
    }

    await createSessionAndSetCookie(res, account.id, req.header("user-agent"));
    res.redirect(account.onboarded_at ? "/home" : "/onboarding");
  } catch (err) {
    log.error({ err }, "Google dashboard login callback failed");
    res.redirect("/login?error=google_auth_failed");
  }
});

/** Bot-issued auto-login link (Buy Credits / Subscribe from WhatsApp or
 * Telegram) — see magicLoginService.ts. Unauthenticated by design: the
 * token itself, sent to the account's own linked channel, is the proof of
 * ownership, same trust model as the channel-onboarding link. */
authRouter.get("/auth/magic-login", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  const resolved = token ? await magicLoginService.resolveAndConsumeMagicLoginToken(token) : null;
  if (!resolved) {
    res.redirect("/login?error=link_expired");
    return;
  }

  const account = await accountsRepo.findById(resolved.accountId);
  if (!account || account.blocked_at) {
    res.redirect("/login?error=account_blocked");
    return;
  }

  await createSessionAndSetCookie(res, account.id, req.header("user-agent"));
  res.redirect(resolved.destinationPath);
});

// ── WhatsApp OTP login ──────────────────────────────────────────────────
const otpRequestSchema = z.object({ mobile: z.string().min(6) });

authRouter.post("/auth/otp/request", async (req, res) => {
  const body = parseBody(otpRequestSchema, req, res);
  if (!body) return;

  try {
    await requestOtp(body.mobile, "login");
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof OtpNotConfiguredError) {
      res.status(501).json({ error: "whatsapp_otp_not_configured" });
      return;
    }
    log.error({ err }, "OTP login request failed");
    res.status(500).json({ error: "otp_request_failed" });
  }
});

const otpVerifySchema = z.object({ mobile: z.string().min(6), code: z.string().length(6) });

authRouter.post("/auth/otp/verify", async (req, res) => {
  const body = parseBody(otpVerifySchema, req, res);
  if (!body) return;

  try {
    const result = await verifyOtp(body.mobile, "login", body.code);
    if (result !== "valid") {
      res.status(400).json({ error: result });
      return;
    }

    let account = await accountsRepo.findByMobile(body.mobile);
    if (!account) {
      account = await accountsRepo.create({ mobile: body.mobile, mobile_verified_at: new Date().toISOString() });
    }
    if (account.blocked_at) {
      res.status(403).json({ error: "account_blocked" });
      return;
    }

    await createSessionAndSetCookie(res, account.id, req.header("user-agent"));
    res.json({ account: sanitizeAccount(account) });
  } catch (err) {
    log.error({ err }, "OTP login verify failed");
    res.status(500).json({ error: "otp_verify_failed" });
  }
});

// ── session ─────────────────────────────────────────────────────────────
authRouter.get("/auth/me", requireSession, async (req, res) => {
  const account = req.account!;
  try {
    const channelLinks = await channelLinksRepo.listByAccountId(account.id);
    res.json({ account: sanitizeAccount(account), channelLinks });
  } catch (err) {
    log.error({ err }, "auth/me failed");
    res.status(500).json({ error: "failed_to_load_account" });
  }
});

authRouter.post("/auth/logout", requireSession, async (req, res) => {
  await sessionsRepo.deleteById(req.sessionId!);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.post("/auth/logout-all", requireSession, async (req, res) => {
  await sessionsRepo.deleteAllForAccount(req.account!.id);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/auth/sessions", requireSession, async (req, res) => {
  const sessions = await sessionsRepo.listForAccount(req.account!.id);
  res.json({
    sessions: sessions.map((s) => ({ ...s, isCurrent: s.id === req.sessionId })),
  });
});

authRouter.delete("/auth/sessions/:id", requireSession, async (req, res) => {
  await sessionsRepo.deleteByIdForAccount(req.params.id, req.account!.id);
  res.json({ ok: true });
});
