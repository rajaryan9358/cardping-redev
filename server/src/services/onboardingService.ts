import { env } from "../config/env";
import { accountsRepo } from "../db/repositories/accounts.repo";
import { Account } from "../types/domain";

/** Grants the trial coin balance and sets onboarded_at — idempotent, safe
 * to call more than once. Shared by POST /onboarding/complete (the normal
 * 3-step wizard's "coins" step) and POST /auth/signup (the channel-first
 * path, which skips the wizard entirely since arriving via a bot-issued
 * onboarding link already satisfies what the wizard exists to do). */
export async function completeOnboarding(accountId: string): Promise<Account> {
  const account = await accountsRepo.findById(accountId);
  if (account?.onboarded_at) return account;

  await accountsRepo.incrementCoinBalance(accountId, env.COINS_STARTER_BALANCE);
  return accountsRepo.update(accountId, { onboarded_at: new Date().toISOString() });
}
