import { env } from "../config/env";
import { transactionsRepo } from "../db/repositories/transactions.repo";
import { usersRepo } from "../db/repositories/users.repo";

export function hasEnoughCoinsForScan(coinBalance: number): boolean {
  return coinBalance >= env.COINS_PER_CARD_SCAN;
}

export async function chargeForCardScan(userId: string): Promise<void> {
  await usersRepo.decrementCoinBalance(userId);
  await transactionsRepo.recordCardScan(userId);
}

export async function creditCoins(userId: string, amount: number): Promise<void> {
  await usersRepo.incrementCoinBalance(userId, amount);
}
