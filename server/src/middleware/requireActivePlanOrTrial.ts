import { NextFunction, Request, Response } from "express";

/** Mounted only on content routes (home/directory/cards/events) — auth,
 * onboarding, channels, and billing all stay reachable regardless, since a
 * paywalled account must still be able to pay its way out. Must run after
 * requireSession (reads req.account). */
export function requireActivePlanOrTrial(req: Request, res: Response, next: NextFunction): void {
  const account = req.account!;

  if (!account.onboarded_at) {
    res.status(403).json({ error: "onboarding_incomplete" });
    return;
  }

  const hasActivePlan = Boolean(account.plan_expires_at) && new Date(account.plan_expires_at!) > new Date();
  const hasTrialCoins = account.coin_balance > 0;
  if (!hasActivePlan && !hasTrialCoins) {
    res.status(402).json({ error: "plan_required" });
    return;
  }

  next();
}
