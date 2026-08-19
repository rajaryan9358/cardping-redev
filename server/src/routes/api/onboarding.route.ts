import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../../middleware/requireSession";
import { sanitizeAccount } from "../../services/authService";
import { completeOnboarding } from "../../services/onboardingService";
import * as channelOnboardingService from "../../services/channelOnboardingService";
import { childLogger } from "../../lib/logger";
import { parseBody } from "./validate";

export const onboardingRouter = Router();
const log = childLogger("api-onboarding-route");

onboardingRouter.get("/onboarding/status", requireSession, (req, res) => {
  res.json({ onboarded: Boolean(req.account!.onboarded_at) });
});

/** Idempotent — grants trial coins + sets onboarded_at exactly once, safe
 * to call multiple times (the dashboard's onboarding flow can retry
 * freely without double-crediting). */
onboardingRouter.post("/onboarding/complete", requireSession, async (req, res) => {
  try {
    const updated = await completeOnboarding(req.account!.id);
    res.json({ account: sanitizeAccount(updated) });
  } catch (err) {
    log.error({ err }, "onboarding complete failed");
    res.status(500).json({ error: "onboarding_failed" });
  }
});

/** Resolves a bot-issued ?onboard= token (unauthenticated — called from the
 * signup page before any session exists) so it can show which channel it's
 * about to connect. Doesn't consume it; POST /auth/signup does that. */
onboardingRouter.get("/onboarding/channel-token", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  const resolved = token ? await channelOnboardingService.resolveOnboardingToken(token) : null;
  if (!resolved) {
    res.status(410).json({ error: "token_expired_or_invalid" });
    return;
  }
  res.json(resolved);
});

const attachSchema = z.object({ onboardToken: z.string().min(1) });

/** The "already logged in" onboarding path — the visitor opened a bot's
 * ?onboard= link in a browser that already has a dashboard session, so
 * there's no signup/login step, just an attach-or-warn decision against
 * the current account. See channelOnboardingService.attachChannelToAccount. */
onboardingRouter.post("/onboarding/attach", requireSession, async (req, res) => {
  const body = parseBody(attachSchema, req, res);
  if (!body) return;

  try {
    const attach = await channelOnboardingService.attachChannelToAccount(req.account!.id, body.onboardToken);
    if (attach.status === "linked") await completeOnboarding(req.account!.id);
    res.json(attach);
  } catch (err) {
    log.error({ err }, "channel attach failed");
    res.status(500).json({ error: "attach_failed" });
  }
});
