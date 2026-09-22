export type StoreOffer = { id: string; name: string; kind: 'clout' | 'pack' | 'style' | 'shards'; cost: number; amount?: number; price?: string; art: string; description: string; cards?: string[]; variant?: string };
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
export type StoreReceipt = { id: string; offerId: string; at: string };
export type DemoWallet = { version: 1; clout: number; receipts: StoreReceipt[] };
export const emptyDemoWallet = (): DemoWallet => ({ version: 1, clout: 0, receipts: [] });
export function readDemoWallet(storage: Pick<Storage, 'getItem'>, key: string): DemoWallet {
  try {
    const value = JSON.parse(storage.getItem(key) ?? 'null');
    if (value?.version !== 1 || !Number.isSafeInteger(value.clout) || value.clout < 0 || !Array.isArray(value.receipts)) return emptyDemoWallet();
    return { version: 1, clout: value.clout, receipts: value.receipts.filter((r: StoreReceipt) => r && typeof r.id === 'string' && typeof r.at === 'string' && CORNER_OFFERS.some(o => o.id === r.offerId)) };
  } catch { return emptyDemoWallet(); }
}
/** Demo-only ledger. Production entitlements must come from a verified payment service. */
export function checkoutDemo(wallet: DemoWallet, offerId: string, receiptId: string, at: string): DemoWallet {
  const offer = CORNER_OFFERS.find(o => o.id === offerId);
  if (!offer) throw new Error('This item is unavailable.');
  if (wallet.receipts.some(r => r.id === receiptId)) return wallet;
  if (offer.kind === 'style' && wallet.receipts.some(r => r.offerId === offerId)) throw new Error('This style is already on your demo shelf.');
  if (wallet.clout < offer.cost) throw new Error('Add demo Clout before buying this item.');
  const clout = wallet.clout - offer.cost + (offer.kind === 'clout' ? offer.amount! : 0);
  if (!Number.isSafeInteger(clout)) throw new Error('Wallet limit reached.');
  return { version: 1, clout, receipts: [...wallet.receipts, { id: receiptId, offerId, at }] };
}
