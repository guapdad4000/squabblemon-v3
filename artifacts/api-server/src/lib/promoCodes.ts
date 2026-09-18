// Rewards are defined only on the server; the client submits a code, never amounts.
export type PromoCodeReward = {
  code: string;
  packTickets: number;
  softCurrency: number;
  styleShards: number;
  cardIds?: string[];
};

export const PROMO_CODES: Record<'DEVTEST' | 'DEVTEST2' | 'SIMMYFOODZ' | 'CITYLEGENDS', PromoCodeReward> = {
  DEVTEST: { code: 'DEVTEST', packTickets: 100, softCurrency: 25_000, styleShards: 5_000 },
  DEVTEST2: { code: 'DEVTEST2', packTickets: 100, softCurrency: 25_000, styleShards: 5_000 },
  SIMMYFOODZ: { code: 'SIMMYFOODZ', packTickets: 0, softCurrency: 0, styleShards: 0, cardIds: ['simmy', 'foodz'] },
  CITYLEGENDS: { code: 'CITYLEGENDS', packTickets: 0, softCurrency: 40_000, styleShards: 0,
    cardIds: ['dragonfly-jones', 'sho-nuff', 'yasuke', 'mansa-musa', 'tron', 'john-henry', 'leroy'] },
};

export function findPromoCode(input: string) {
  const code = input.trim().toUpperCase();
  if (!Object.hasOwn(PROMO_CODES, code)) return null;
  return PROMO_CODES[code as keyof typeof PROMO_CODES];
}
