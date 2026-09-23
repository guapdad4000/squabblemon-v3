export type StoreOffer = {
  id: string;
  name: string;
  kind: 'clout' | 'pack' | 'style' | 'shards';
  cost: number;
  amount?: number;
  price?: string;
  art: string;
  description: string;
  cards?: string[];
  variant?: string;
};

export const CORNER_OFFERS: StoreOffer[] = [
  { id: 'clout-pocket', name: 'Pocket change', kind: 'clout', cost: 0, amount: 500, price: '$2.99', art: 'assets/rewards/clout-token.webp', description: '500 Clout. A little something for the gang.' },
  { id: 'clout-stack', name: 'The stack', kind: 'clout', cost: 0, amount: 1500, price: '$7.99', art: 'assets/rewards/clout-stack.webp', description: '1,500 Clout for your next shopping trip.' },
  { id: 'clout-bag', name: 'Full bag', kind: 'clout', cost: 0, amount: 4000, price: '$19.99', art: 'assets/rewards/clout-bag.webp', description: '4,000 Clout. Keep something for later.' },
  { id: 'wiz-pack', name: 'Emerald City', kind: 'pack', cost: 400, art: 'assets/characters/oz.webp', description: 'The Wiz showcase. Preview the complete five-card lineup.', cards: ['dorothy', 'scarecrow', 'tin-man', 'lion', 'oz'] },
  { id: 'wonder-pack', name: 'Down the rabbit hole', kind: 'pack', cost: 300, art: 'assets/characters/cheshire.webp', description: 'A Wonderland showcase: Alice, Cheshire, and the Queen.', cards: ['alice', 'cheshire', 'queen-of-hearts'] },
  { id: 'dorothy-style', name: 'Dorothy · Homecoming', kind: 'style', cost: 180, art: 'assets/characters/dorothy-alternate.webp', description: 'Alternate card artwork. Same abilities and strength.', cards: ['dorothy'], variant: 'dorothy:alternate' },
  { id: 'sherlock-style', name: 'Sherlock · On the case', kind: 'style', cost: 180, art: 'assets/characters/sherlock-alternate.webp', description: 'Alternate card artwork. A new look for your detective.', cards: ['sherlock'], variant: 'sherlock:alternate' },
  { id: 'style-shards', name: 'Style supply', kind: 'shards', cost: 150, amount: 100, art: 'assets/rewards/style-hanger.webp', description: '100 Style Shards for the looks you want.' },
];

const CHECKOUT_KEY = 'squabblemon:checkout:v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_ID_PATTERN = /^\d{13}-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function checkoutKey(playerId: string, offerId: string) {
  return `${CHECKOUT_KEY}:${playerId}:${offerId}`;
}

export function getPendingCheckout(storage: Pick<Storage, 'getItem'>, playerId: string, offerId: string): string | null {
  const value = storage.getItem(checkoutKey(playerId, offerId));
  if (value === null) return null;
  if (!UUID_PATTERN.test(value)) {
    throw new Error('Saved checkout reference is invalid. Clear site data before trying again.');
  }
  return value;
}

export function savePendingCheckout(storage: Pick<Storage, 'setItem'>, playerId: string, offerId: string, idempotencyKey: string) {
  if (!UUID_PATTERN.test(idempotencyKey)) throw new Error('Checkout reference could not be created.');
  storage.setItem(checkoutKey(playerId, offerId), idempotencyKey);
}

export function clearPendingCheckout(storage: Pick<Storage, 'removeItem'>, playerId: string, offerId: string) {
  storage.removeItem(checkoutKey(playerId, offerId));
}

export function getOrCreatePendingCheckout(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  playerId: string,
  offerId: string,
  createUuid: () => string,
) {
  const existing = getPendingCheckout(storage, playerId, offerId);
  if (existing) return existing;
  const created = createUuid();
  savePendingCheckout(storage, playerId, offerId, created);
  if (getPendingCheckout(storage, playerId, offerId) !== created) {
    throw new Error('Checkout reference could not be saved. No payment request was sent.');
  }
  return created;
}

export function formatCurrency(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100);
}

export function isTerminalOrderStatus(status: string) {
  return ['fulfilled', 'failed', 'expired', 'refunded', 'disputed'].includes(status);
}

export function isValidOrderId(value: string | null): value is string {
  return typeof value === 'string' && ORDER_ID_PATTERN.test(value);
}

export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function safeStripeCheckoutUrl(value: string | null | undefined): string | null {
  const safe = safeHttpsUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  return url.origin === 'https://checkout.stripe.com' && !url.username && !url.password && !url.port ? safe : null;
}

export function orderStatusDetail(status: string, clout: number, fulfilledAt?: string | null) {
  switch (status) {
    case 'pending': return 'Checkout is still waiting for payment confirmation.';
    case 'processing': return 'Payment was received and your account reward is being finalized.';
    case 'fulfilled': return `${clout.toLocaleString()} Clout was added to your account.`;
    case 'failed': return 'Payment could not be completed. You can start a new purchase.';
    case 'expired': return 'This checkout expired. You can start a new purchase.';
    case 'refunded':
      return fulfilledAt
        ? 'This completed purchase was later refunded.'
        : 'This purchase was refunded before the account reward completed.';
    case 'disputed':
      return fulfilledAt
        ? 'This completed purchase is now disputed.'
        : 'This purchase is disputed and the account reward did not complete.';
    default: return 'The latest status is shown above.';
  }
}
