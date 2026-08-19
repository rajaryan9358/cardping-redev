import { plansRepo } from "../db/repositories/plans.repo";
import { UserWithEvent } from "../types/domain";

export type SubscriptionTone = "active" | "expired" | "trial" | "none";

export interface SubscriptionStatus {
  tone: SubscriptionTone;
  planName: string | null;
  planExpiresAt: string | null;
  coinBalance: number;
}

/** Same tri-state logic dashboard/'s lib/planStatus.ts encodes (active /
 * expired / trial-on-coins / no plan), ported here for the bot's balance
 * view and the insufficient-coins gate — the two apps don't share a lib. */
export async function getSubscriptionStatus(user: UserWithEvent): Promise<SubscriptionStatus> {
  const coinBalance = user.effective_coin_balance;

  if (user.effective_plan_id) {
    const plan = await plansRepo.findById(user.effective_plan_id);
    const expired = !user.effective_plan_expires_at || new Date(user.effective_plan_expires_at).getTime() < Date.now();
    return {
      tone: expired ? "expired" : "active",
      planName: plan?.name ?? null,
      planExpiresAt: user.effective_plan_expires_at,
      coinBalance,
    };
  }

  if (coinBalance > 0) {
    return { tone: "trial", planName: null, planExpiresAt: null, coinBalance };
  }

  return { tone: "none", planName: null, planExpiresAt: null, coinBalance };
}
