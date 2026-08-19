import { accountsRepo } from "../db/repositories/accounts.repo";
import { transactionsRepo } from "../db/repositories/transactions.repo";
import { usersRepo } from "../db/repositories/users.repo";

/** Decrements the coin balance for a card scan — the account's wallet if
 * this bot channel identity is linked to a dashboard login, otherwise the
 * legacy per-`users` balance. See the "dashboard/ real accounts" block in
 * db/schema.sql for why the legacy path is permanent, not transitional:
 * a brand-new phone number's very first scan happens before any account
 * could possibly exist. `accountId` should come from `UserWithEvent.account_id`
 * (already resolved by the `user_with_event` view — no extra lookup needed). */
export async function charge(usersId: string, accountId: string | null): Promise<void> {
  if (accountId) {
    await accountsRepo.decrementCoinBalance(accountId);
  } else {
    await usersRepo.decrementCoinBalance(usersId);
  }
  await transactionsRepo.recordCardScan(usersId, accountId);
}

/** One-time transfer when a channel successfully links: moves whatever
 * legacy balance this `users` row had accumulated into the account's
 * wallet, then zeroes the legacy column. Zeroing (not just leaving it
 * frozen) matters — without it, linking the same still-nonzero legacy
 * balance to a second account later would credit it twice. */
export async function mergeLegacyBalanceOnLink(usersId: string, accountId: string, legacyBalance: number): Promise<void> {
  if (legacyBalance <= 0) return;
  await accountsRepo.incrementCoinBalance(accountId, legacyBalance);
  await usersRepo.setCoinBalance(usersId, 0);
}
