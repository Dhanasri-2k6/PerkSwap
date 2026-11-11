export const DEFAULT_STARTER_COINS = 150;

export interface CoinPackage {
  id: string;
  coins: number;
  priceInr: number;
  title: string;
  description: string;
  popular?: boolean;
  bonusCoins?: number;
}

export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: "pkg_100",
    coins: 100,
    priceInr: 49,
    title: "Starter Pack",
    description: "100 coins for basic coupon purchases",
    popular: false,
    bonusCoins: 0,
  },
  {
    id: "pkg_250",
    coins: 250,
    priceInr: 99,
    title: "Popular Pack",
    description: "250 coins with best value for frequent traders",
    popular: true,
    bonusCoins: 0,
  },
  {
    id: "pkg_500",
    coins: 500,
    priceInr: 179,
    title: "Pro Trader",
    description: "500 coins + 25 bonus coins included",
    popular: false,
    bonusCoins: 25,
  },
  {
    id: "pkg_1000",
    coins: 1000,
    priceInr: 349,
    title: "Mega Saver",
    description: "1000 coins + 100 bonus coins included",
    popular: false,
    bonusCoins: 100,
  },
];
