import { Router } from "express";
import { z } from "zod";
import { channelLinksRepo } from "../../db/repositories/channelLinks.repo";
import { usersRepo } from "../../db/repositories/users.repo";
import { requireSession } from "../../middleware/requireSession";
import * as channelLinkService from "../../services/channelLinkService";
import * as channelOnboardingService from "../../services/channelOnboardingService";
import { OtpNotConfiguredError, requestOtp, verifyOtp } from "../../services/otpService";
import { normalizeWaId } from "../../integrations/whatsapp/normalize";
import { ChannelLinkChannel } from "../../types/domain";
import { childLogger } from "../../lib/logger";
import { parseBody } from "./validate";

export const channelsRouter = Router();
const log = childLogger("api-channels-route");

channelsRouter.get("/channels", requireSession, async (req, res) => {
  const links = await channelLinksRepo.listByAccountId(req.account!.id);
  res.json({ channelLinks: links });
});

channelsRouter.delete("/channels/:id", requireSession, async (req, res) => {
  await channelLinksRepo.unlinkById(req.params.id, req.account!.id);
  res.json({ ok: true });
});

/** wa.me/t.me link back to wherever a bot-issued magic-login flow started
 * — used by the mobile /topup and /subscribe status pages' "back to
 * channel" button. Prefers the requested channel; falls back to whichever
 * one is actually linked if that one isn't (e.g. redeployed link, or the
 * hint is stale). */
channelsRouter.get("/channels/return-url", requireSession, async (req, res) => {
  const links = await channelLinksRepo.listByAccountId(req.account!.id);
  const requested = typeof req.query.channel === "string" ? (req.query.channel as ChannelLinkChannel) : undefined;
  const link = links.find((l) => l.channel === requested) ?? links[0];
  if (!link) {
    res.json({ returnUrl: null });
    return;
  }
  res.json({ returnUrl: channelOnboardingService.buildChannelReturnUrl(link.channel, link.channel_identifier) });
});

// ── WhatsApp OTP channel link ───────────────────────────────────────────
const otpRequestSchema = z.object({ mobile: z.string().min(6) });

channelsRouter.post("/channels/whatsapp/otp/request", requireSession, async (req, res) => {
  const body = parseBody(otpRequestSchema, req, res);
  if (!body) return;
  const mobile = normalizeWaId(body.mobile);

  try {
    const existing = await channelLinksRepo.findByChannelIdentifier("whatsapp", mobile);
    if (existing && existing.account_id !== req.account!.id) {
      res.status(409).json({ error: "already_linked_elsewhere" });
      return;
    }

    await requestOtp(mobile, "channel_link");
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof OtpNotConfiguredError) {
      res.status(501).json({ error: "whatsapp_otp_not_configured" });
      return;
    }
    log.error({ err }, "channel-link OTP request failed");
    res.status(500).json({ error: "otp_request_failed" });
  }
});

const otpVerifySchema = z.object({ mobile: z.string().min(6), code: z.string().length(6) });

channelsRouter.post("/channels/whatsapp/otp/verify", requireSession, async (req, res) => {
  const body = parseBody(otpVerifySchema, req, res);
  if (!body) return;
  const account = req.account!;
  const mobile = normalizeWaId(body.mobile);

  try {
    const existing = await channelLinksRepo.findByChannelIdentifier("whatsapp", mobile);
    if (existing && existing.account_id !== account.id) {
      res.status(409).json({ error: "already_linked_elsewhere" });
      return;
    }
    if (existing && existing.unlinked_at === null) {
      res.json({ ok: true }); // already actively linked to this same account — no-op
      return;
    }
    // Either never linked before, or linked to this same account and
    // currently disconnected — either way, fall through and (re)link it.

    const result = await verifyOtp(mobile, "channel_link", body.code);
    if (result !== "valid") {
      res.status(400).json({ error: result });
      return;
    }

    const user = await usersRepo.findOrCreate("whatsapp", mobile, mobile);
    await channelLinkService.linkChannel(account.id, user.user_id, "whatsapp", mobile, user.coin_balance);
    res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "already_linked_elsewhere" });
      return;
    }
    log.error({ err }, "channel-link OTP verify failed");
    res.status(500).json({ error: "otp_verify_failed" });
  }
});

// ── Telegram deep-link ──────────────────────────────────────────────────
channelsRouter.post("/channels/telegram/link-code", requireSession, async (req, res) => {
  try {
    const code = await channelLinkService.createTelegramLinkCode(req.account!.id);
    res.json({ deepLink: channelLinkService.buildTelegramDeepLink(code) });
  } catch (err) {
    log.error({ err }, "telegram link-code generation failed");
    res.status(500).json({ error: "link_code_failed" });
  }
});
