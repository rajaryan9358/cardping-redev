import { Router } from "express";
import { z } from "zod";
import { accountsRepo } from "../../db/repositories/accounts.repo";
import { channelLinksRepo } from "../../db/repositories/channelLinks.repo";
import { notificationsRepo } from "../../db/repositories/notifications.repo";
import { requireSession } from "../../middleware/requireSession";
import { sanitizeAccount } from "../../services/authService";
import { setMarketingOptInForAccount } from "../../services/channelLinkService";
import { parseBody } from "./validate";

export const accountRouter = Router();

const settingsSchema = z.object({
  scanBothSides: z.boolean().optional(),
  eventLifetimeHours: z.number().int().positive().nullable().optional(),
});

const profileSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
});

/** Personal info — deliberately excludes email: it's the account's login
 * identity, so it's read-only from this form (the dashboard field is
 * disabled to match, but the rule is enforced here too, not just by
 * disabling the input). */
accountRouter.patch("/account/profile", requireSession, async (req, res) => {
  const body = parseBody(profileSchema, req, res);
  if (!body) return;

  const updated = await accountsRepo.update(req.account!.id, { full_name: `${body.firstName} ${body.lastName}`.trim() });
  res.json({ account: sanitizeAccount(updated) });
});

/** Scan/event preferences — edited from both here and the bot's Account
 * Settings menu (see scanFlowService.ts), same accounts columns either
 * way. */
accountRouter.patch("/account/settings", requireSession, async (req, res) => {
  const body = parseBody(settingsSchema, req, res);
  if (!body) return;

  const patch: { scan_both_sides?: boolean; event_lifetime_hours?: number | null } = {};
  if (body.scanBothSides !== undefined) patch.scan_both_sides = body.scanBothSides;
  if (body.eventLifetimeHours !== undefined) patch.event_lifetime_hours = body.eventLifetimeHours;

  const updated = await accountsRepo.update(req.account!.id, patch);
  res.json({ account: sanitizeAccount(updated) });
});

const NOTIFICATION_MESSAGES: Record<string, string> = {
  renewal_reminder: "Your plan renews soon.",
  low_balance_alert: "Your coin balance is low.",
};

const UNREAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Feeds the dashboard header's notification bell — resolves the logged-in
 * account to its linked channel identities (notification_log.user_id is a
 * channel identity, not an account) and returns the most recent successful
 * sends across all of them. No separate read-state table: "unread" is
 * just "sent within the last 7 days", same simple-scale tradeoff already
 * used elsewhere in this app (see adminSubscriptions.repo.ts). */
accountRouter.get("/notifications", requireSession, async (req, res) => {
  const links = await channelLinksRepo.listByAccountId(req.account!.id);
  const rows = await notificationsRepo.listForUserIds(
    links.map((l) => l.users_id),
    20,
  );

  const now = Date.now();
  const notifications = rows
    .filter((r) => r.status === "sent")
    .map((r) => ({
      id: r.id,
      message: NOTIFICATION_MESSAGES[r.type] ?? "You have a new notification.",
      createdAt: r.created_at,
      unread: now - new Date(r.created_at).getTime() < UNREAD_WINDOW_MS,
    }));

  res.json({ notifications });
});

const marketingOptInSchema = z.object({ marketingOptIn: z.boolean() });

/** marketing_opt_in lives on `users` (per channel identity), matching how
 * Broadcasts actually sends — per channel, not per account. From the
 * dashboard's perspective there's one account, so this applies the same
 * value to every channel currently linked to it. */
accountRouter.patch("/account/settings/marketing-opt-in", requireSession, async (req, res) => {
  const body = parseBody(marketingOptInSchema, req, res);
  if (!body) return;

  await setMarketingOptInForAccount(req.account!.id, body.marketingOptIn);
  res.json({ ok: true });
});
