import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { rewardReceipts, revealProfileRewards } from './rewardReceipts';
const bootstrap = (currency: number, cards: string[] = []) => ({ profile: { id:'receipt-test', softCurrency:currency, packTickets:1, styleShards:0, streetRep:0, xp:0, ownedCardIds:cards, unlockedCosmeticIds:[] } }) as unknown as PlayerBootstrap;
test('confirmed reward receipts show only increases, deduplicate claims, and clear with account scope', () => {
  rewardReceipts.reset();
  revealProfileRewards(bootstrap(100),bootstrap(50),'spend','Purchase');
  assert.equal(rewardReceipts.current(),null);
  revealProfileRewards(bootstrap(100),bootstrap(150,['stockz']),'claim','Bounty');
  const receipt=rewardReceipts.current()!;
  assert.equal(receipt.items[0].amount,50);assert.equal(receipt.items[1].label,'STOCKZ');
  rewardReceipts.dismiss();revealProfileRewards(bootstrap(100),bootstrap(150,['stockz']),'claim','Bounty');
  assert.equal(rewardReceipts.current(),null);
  rewardReceipts.reset();
});
