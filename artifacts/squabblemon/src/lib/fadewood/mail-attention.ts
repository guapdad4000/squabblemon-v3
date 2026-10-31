type Delivery = {
  id: string;
  readAt: unknown;
  claimedAt: unknown;
  gift: Record<string, number>;
};

/** A compact presentation identity, never a claim or a saved reward receipt. */
export function mailAttentionIdentity(accountId: string, letters: readonly Delivery[]): string {
  const pending = letters.flatMap(letter => {
    const giftWaiting = !letter.claimedAt && Object.values(letter.gift).some(amount => amount > 0);
    return !letter.readAt || giftWaiting ? [`${letter.id}:${Number(!letter.readAt)}:${Number(giftWaiting)}`] : [];
  }).sort();
  if (!pending.length) return '';
  const identity = JSON.stringify([accountId, pending]);
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index++) hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619) >>> 0;
  return `mail-v1:${pending.length}:${hash.toString(36)}`;
}
