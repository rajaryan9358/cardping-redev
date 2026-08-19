import { Router } from "express";
import { z } from "zod";
import { accountsRepo } from "../../db/repositories/accounts.repo";
import { requireSession } from "../../middleware/requireSession";
import { sanitizeAccount } from "../../services/authService";
import { parseBody } from "./validate";

export const accountRouter = Router();

const settingsSchema = z.object({
  scanBothSides: z.boolean().optional(),
  eventLifetimeHours: z.number().int().positive().nullable().optional(),
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
