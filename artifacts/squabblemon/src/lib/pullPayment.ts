import { affordableStreetPacks, isPullCount, streetPackCost, type PullCount } from '@workspace/squabblemon-engine/packRules';

export type PullPaymentQuoteInput = {
  paymentMethod: 'ticket' | 'softCurrency';
  selectedCount: PullCount;
  balance: number;
  supportsFlexibleBatches: boolean;
  pendingCount?: PullCount;
};

/** Quote new intent without changing an already saved purchase or authorizing payment. */
export function quotePullPayment({
  paymentMethod, selectedCount, balance, supportsFlexibleBatches, pendingCount,
}: PullPaymentQuoteInput): { count: PullCount; cost: number } {
  let count = pendingCount;
  if (count === undefined) {
    if (selectedCount === 1) count = 1;
    else if (!supportsFlexibleBatches) count = 10;
    else {
      const affordable = affordableStreetPacks(balance, paymentMethod);
      count = isPullCount(affordable) ? affordable : 1;
    }
  }
  const price = streetPackCost(count);
  return { count, cost: paymentMethod === 'ticket' ? price.ticketCost : price.softCurrencyCost };
}
