import { env } from "../config/env";
import { usersRepo } from "../db/repositories/users.repo";
import * as walletService from "./walletService";

export function hasEnoughCoinsForScan(coinBalance: number): boolean {
  return coinBalance >= env.COINS_PER_CARD_SCAN;
}

/** `accountId` should come from `UserWithEvent.account_id` — pass the
 * account's wallet if this channel is linked, otherwise the legacy
 * per-`users` wallet is charged instead. See walletService.ts. */
export async function chargeForCardScan(userId: string, accountId: string | null): Promise<void> {
  await walletService.charge(userId, accountId);
}

export async function creditCoins(userId: string, amount: number): Promise<void> {
  await usersRepo.incrementCoinBalance(userId, amount);
}
