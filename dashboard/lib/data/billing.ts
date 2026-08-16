import { mockPlans, mockTransactions } from "../mock/billing";
import { mockTopUpPackages } from "../mock/topups";
import { Plan, Transaction } from "../types";

export async function getPlans(): Promise<Plan[]> {
  return mockPlans;
}

export async function getTransactions(): Promise<Transaction[]> {
  return mockTransactions;
}

export async function getTopUpPackages() {
  return mockTopUpPackages;
}
