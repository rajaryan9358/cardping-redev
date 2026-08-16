import { Account, Plan } from "./types";

export type PlanTone = "active" | "trial" | "inactive";

export interface PlanStatus {
  label: string;
  tone: PlanTone;
}

/** Derives the plan state shown in the sidebar + Subscription page.
 * "trial" = no paid plan yet but still has starter coins to use;
 * "inactive" = no paid plan and no coins left, or a past plan expiry;
 * "active" = a paid plan with a future (or same-day) expiry. */
export function getPlanStatus(account: Account, plans: Plan[]): PlanStatus {
  const plan = plans.find((p) => p.id === account.planId);

  if (plan && account.planExpiresAt) {
    const expired = new Date(account.planExpiresAt).getTime() < Date.now();
    if (!expired) return { label: plan.name, tone: "active" };
    return { label: `${plan.name} (expired)`, tone: "inactive" };
  }

  if (account.coinBalance > 0) {
    return { label: "Free trial", tone: "trial" };
  }

  return { label: "No active plan", tone: "inactive" };
}
