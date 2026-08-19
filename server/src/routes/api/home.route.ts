import { Router } from "express";
import { eventsRepo } from "../../db/repositories/events.repo";
import { visitingCardsRepo } from "../../db/repositories/visitingCards.repo";
import { requireSession } from "../../middleware/requireSession";
import { requireActivePlanOrTrial } from "../../middleware/requireActivePlanOrTrial";
import { resolveUsersIds } from "../../services/accountScope";
import { childLogger } from "../../lib/logger";

export const homeRouter = Router();
const log = childLogger("api-home-route");

const RECENT_CARDS_LIMIT = 10;

// A paywalled account still needs auth/onboarding/channels/billing (see
// routes/api/index.ts) — just not this content route.

homeRouter.get("/home/summary", requireSession, requireActivePlanOrTrial, async (req, res) => {
  try {
    const usersIds = await resolveUsersIds(req.account!.id);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);

    const [recentCards, events, totalContacts, scansThisWeek, scansPriorWeek] = await Promise.all([
      visitingCardsRepo.getRecentForAccount(usersIds, RECENT_CARDS_LIMIT),
      eventsRepo.listForAccount(usersIds),
      visitingCardsRepo.listForAccount(usersIds, {}, 1, 1).then((r) => r.total),
      visitingCardsRepo.countScansSince(usersIds, weekAgo.toISOString()),
      visitingCardsRepo.countScansSince(usersIds, twoWeeksAgo.toISOString(), weekAgo.toISOString()),
    ]);

    const scansTrendPct = scansPriorWeek > 0 ? Math.round(((scansThisWeek - scansPriorWeek) / scansPriorWeek) * 100) : null;

    res.json({
      recentCards,
      events,
      totalContacts,
      totalEvents: events.length,
      scansThisWeek,
      scansTrendPct,
    });
  } catch (err) {
    log.error({ err }, "home summary failed");
    res.status(500).json({ error: "home_summary_failed" });
  }
});
