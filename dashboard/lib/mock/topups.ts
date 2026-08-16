export interface TopUpPackage {
  id: string;
  coins: number;
  priceInr: number;
  popular?: boolean;
}

export const mockTopUpPackages: TopUpPackage[] = [
  { id: "topup_100", coins: 100, priceInr: 199 },
  { id: "topup_500", coins: 500, priceInr: 899, popular: true },
  { id: "topup_1000", coins: 1000, priceInr: 1599 },
  { id: "topup_2500", coins: 2500, priceInr: 3499 },
];
