import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { canPresentRewardStinger, rewardReceipts, revealProfileRewards, revealStoryRewards } from './rewardReceipts';
import type { StoryGrantedReward } from '@workspace/api-client-react';
import { selectedChallengeRun } from './challengeJourney';
const bootstrap = (currency: number, cards: string[] = []) => ({ profile: { id:'receipt-test', softCurrency:currency, packTickets:1, styleShards:0, streetRep:0, xp:0, ownedCardIds:cards, unlockedCosmeticIds:[] } }) as unknown as PlayerBootstrap;
const resolveCharacter = (id: string) => id === 'dr-fade'
  ? { name: 'Dr. Fade', portraitAssetId: 'assets/characters/dr-fade.webp' }
  : undefined;
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

test('reward presentation eligibility is explicit and only confirmed producers opt in', () => {
  rewardReceipts.reset();
  revealProfileRewards(bootstrap(10), bootstrap(20), 'login-catchup', 'Rewards', undefined);
  assert.equal(rewardReceipts.current()?.presentation, undefined);
  rewardReceipts.dismiss();
  revealProfileRewards(bootstrap(10), bootstrap(20), 'mission', 'Bounty collected', 'mission');
  assert.equal(rewardReceipts.current()?.presentation, 'mission');
  rewardReceipts.reset();
});

test('story receipt derives the token counter from the confirmed wallet and only newly delivered grants', () => {
  rewardReceipts.reset();
  const rewards = [
    { kind: 'currency', id: 'clout', amount: 250, rewardKey: 'story-payout-make-good:v1:finale:clout', duplicateShards: 0, description: '+250 Clout' },
    { kind: 'pack-ticket', id: 'street-pack-ticket', amount: 8, rewardKey: 'story-payout-make-good:v1:finale:tickets', duplicateShards: 0, description: '+8 tickets' },
  ] as StoryGrantedReward[];
  assert.equal(revealStoryRewards({ nodeId: 'finale', title: 'Finale', rewards, bootstrap: bootstrap(900), resolveCharacter }), true);
  const receipt = rewardReceipts.current()!;
  assert.deepEqual(receipt.story?.cloutBalance, { from: 650, to: 900 });
  assert.equal(receipt.story?.catchUp, true);
  assert.deepEqual(receipt.items.map(item => item.amount), [250, 8]);
  rewardReceipts.dismiss();
  assert.equal(revealStoryRewards({ nodeId: 'finale', title: 'Finale', rewards, bootstrap: bootstrap(900), resolveCharacter }), true);
  assert.equal(rewardReceipts.current(), null, 'repeated checks never replay the same claim receipt');
  assert.equal(revealStoryRewards({ nodeId: 'finale', title: 'Finale', rewards: [], bootstrap: bootstrap(900), resolveCharacter }), false);
  rewardReceipts.reset();
});

test('story receipts opt into stingers only for non-catch-up non-Clout scene grants', () => {
  rewardReceipts.reset();
  const reward = { kind: 'pack-ticket', id: 'street-pack-ticket', amount: 1, rewardKey: 'story:ticket', duplicateShards: 0, description: 'Ticket' } as StoryGrantedReward;
  revealStoryRewards({ nodeId: 'scene', title: 'Scene', rewards: [reward], bootstrap: bootstrap(10), resolveCharacter, presentation: 'story' });
  assert.equal(rewardReceipts.current()?.presentation, 'story');
  rewardReceipts.reset();
  const clout = { kind: 'currency', id: 'clout', amount: 5, rewardKey: 'story:clout', duplicateShards: 0, description: 'Clout' } as StoryGrantedReward;
  revealStoryRewards({ nodeId: 'scene', title: 'Scene', rewards: [clout], bootstrap: bootstrap(15), resolveCharacter, presentation: 'story' });
  assert.equal(rewardReceipts.current()?.presentation, undefined, 'the existing Clout collection ceremony remains the only payoff');
  rewardReceipts.reset();
  const catchUp = { ...reward, rewardKey: 'story-payout-make-good:v1:scene:ticket' };
  revealStoryRewards({ nodeId: 'scene', title: 'Catch-up', rewards: [catchUp], bootstrap: bootstrap(10), resolveCharacter, presentation: 'story' });
  assert.equal(rewardReceipts.current()?.presentation, undefined);
  rewardReceipts.reset();
});

test('stinger policy rejects Clout and catch-up receipts even if a producer accidentally opts them in', () => {
  assert.equal(canPresentRewardStinger({
    id: 'clout', title: 'Scene', presentation: 'story',
    story: { chapterTitle: 'Chapter', backgroundAssetId: 'backdrop', cloutBalance: { from: 0, to: 5 } },
    items: [{ label: 'Clout', amount: 5 }],
  }), false);
  assert.equal(canPresentRewardStinger({
    id: 'catch-up', title: 'Scene', presentation: 'story',
    story: { chapterTitle: 'Chapter', backgroundAssetId: 'backdrop', catchUp: true },
    items: [{ label: 'Ticket', amount: 1 }],
  }), false);
  assert.equal(canPresentRewardStinger({
    id: 'mission', title: 'Mission', presentation: 'mission', items: [{ label: 'Clout', amount: 5 }],
  }, true), false, 'reduced motion never enables an optional reward video');
});

test('stinger selection and consumption are receipt-scoped, stable on remount, and FIFO-safe', () => {
  rewardReceipts.reset();
  rewardReceipts.show({ id: 'one', title: 'Mission', presentation: 'mission', items: [{ label: 'Clout', amount: 1 }] });
  rewardReceipts.show({ id: 'two', title: 'Promo', presentation: 'promo', items: [{ label: 'Ticket', amount: 1 }] });
  let selected = 0;
  const firstCut = rewardReceipts.stingerSelection('one', () => ({ id: ++selected }));
  assert.equal(rewardReceipts.stingerSelection('one', () => ({ id: ++selected })), firstCut);
  assert.equal(selected, 1);
  assert.equal(rewardReceipts.beginStinger('one'), true);
  assert.equal(rewardReceipts.beginStinger('one'), false, 'a remount cannot replay an already-started stinger');
  assert.equal(rewardReceipts.stingerWasStarted('one'), true);
  const beforeSkip = rewardReceipts.current();
  const snapshots: Array<ReturnType<typeof rewardReceipts.current>> = [];
  const unsubscribe = rewardReceipts.subscribe(() => snapshots.push(rewardReceipts.current()));
  rewardReceipts.consumeStinger('one');
  unsubscribe();
  assert.equal(rewardReceipts.stingerWasConsumed('one'), true);
  assert.notEqual(rewardReceipts.current(), beforeSkip, 'Skip publishes a new external-store snapshot so mounted consumers rerender');
  assert.equal(snapshots.at(-1), rewardReceipts.current(), 'subscribers observe the replacement receipt snapshot on Skip');
  assert.equal(rewardReceipts.stingerSelection('one', () => ({ id: ++selected })), undefined);
  assert.equal(rewardReceipts.current()?.id, 'one', 'consuming or skipping the stinger leaves this receipt in place');
  rewardReceipts.dismiss('one');
  assert.equal(rewardReceipts.current()?.id, 'two', 'skipping a stinger advances no queue item; only receipt dismissal does');
  rewardReceipts.consumeStinger('one');
  assert.equal(rewardReceipts.stingerWasConsumed('two'), false, 'a late callback cannot consume the next receipt');
  rewardReceipts.reset();
  assert.equal(rewardReceipts.stingerWasConsumed('one'), false, 'account reset clears presentation state');
});
test('story character grants keep their name and portrait without loading story content in the game shell', () => {
  rewardReceipts.reset();
  const rewards = [
    { kind: 'character-unlock', id: 'dr-fade', amount: 1, rewardKey: 'story:dr-fade', duplicateShards: 0, description: 'Dr. Fade unlocked' },
  ] as StoryGrantedReward[];
  revealStoryRewards({ nodeId: 'unlock', title: 'Unlock', rewards, bootstrap: bootstrap(0), resolveCharacter });
  assert.equal(rewardReceipts.current()?.items[0].label, 'Dr. Fade unlocked');
  assert.match(rewardReceipts.current()?.items[0].image ?? '', /assets\/characters\/dr-fade\.webp(?:\?v=[a-f0-9]+)?$/);
  rewardReceipts.reset();
});
test('saved challenge runs stay on the road until the player explicitly continues', () => {
  const active = { id: 'active-run', status: 'active' };
  const settled = { id: 'settled-run', status: 'settled' };
  const runs = [active, settled];
  assert.equal(selectedChallengeRun(runs, null), undefined);
  assert.equal(selectedChallengeRun(runs, active.id), active);
  assert.equal(selectedChallengeRun(runs, null), undefined);
  assert.equal(selectedChallengeRun(runs, settled.id), settled);
});

const levelReceipt = (level: number) => ({ id: `level-player:${level}`, title: 'Level up', level, items: [{ label: `Level ${level}` }] });
test('level rewards wait for a results exit and hold the next screen until dismissed', () => {
  rewardReceipts.reset();
  let continued = 0, acknowledged = 0;
  rewardReceipts.deferLevel(levelReceipt(2), () => acknowledged++);
  assert.equal(rewardReceipts.current(), null, 'a profile refresh must not interrupt the victory screen');
  const cancel = rewardReceipts.leaveBattleResults(() => continued++);
  assert.equal(rewardReceipts.current()?.level, 2);
  assert.equal(continued, 0, 'the next scene must not start its audio under level-up');
  assert.equal(acknowledged, 0);
  rewardReceipts.dismiss();
  assert.equal(continued, 1);
  assert.equal(acknowledged, 1);
  cancel?.();
  rewardReceipts.dismiss();
  assert.equal(continued, 1);
  rewardReceipts.deferLevel(levelReceipt(2));
  assert.equal(rewardReceipts.leaveBattleResults(() => continued++), null, 'refreshes do not replay an acknowledged level');
  rewardReceipts.reset();
});
test('multiple earned levels make one celebration; other reward receipts remain available', () => {
  rewardReceipts.reset();
  rewardReceipts.show(levelReceipt(2));
  rewardReceipts.deferLevel(levelReceipt(4));
  rewardReceipts.deferLevel(levelReceipt(3));
  rewardReceipts.show({ id: 'haul', title: 'Earnings', items: [{ label: 'Clout', amount: 50 }] });
  assert.equal(rewardReceipts.current()?.id, 'haul');
  rewardReceipts.dismiss();
  assert.equal(rewardReceipts.current(), null);
  rewardReceipts.leaveBattleResults(() => {});
  assert.equal(rewardReceipts.current()?.level, 4);
  rewardReceipts.dismiss();
  assert.equal(rewardReceipts.current(), null);
  assert.equal(rewardReceipts.leaveBattleResults(() => {}), null);
  rewardReceipts.reset();
});
test('changing route or player cancels a deferred results action', () => {
  rewardReceipts.reset();
  let continued = 0;
  rewardReceipts.deferLevel(levelReceipt(2));
  const cancel = rewardReceipts.leaveBattleResults(() => continued++);
  cancel?.();
  rewardReceipts.dismiss();
  assert.equal(continued, 0);
  rewardReceipts.deferLevel(levelReceipt(3));
  rewardReceipts.leaveBattleResults(() => continued++);
  rewardReceipts.reset();
  rewardReceipts.dismiss();
  assert.equal(continued, 0);
  assert.equal(rewardReceipts.leaveBattleResults(() => {}), null);
});

test('reward receipts separate rarity credits from universal credits and ignore debits', () => {
  rewardReceipts.reset();
  const before = bootstrap(0), after = bootstrap(0);
  before.profile.styleShardBalances = { Rare: 10, Common: 20 };
  after.profile.styleShardBalances = { Rare: 22, Common: 5 };
  after.profile.styleShards = 5;
  revealProfileRewards(before, after, 'shards', 'Style stash');
  assert.deepEqual(rewardReceipts.current()?.items, [
    { label: 'Universal Style Shards', amount: 5, glyph: 'shards' },
    { label: 'Rare Style Shards', amount: 12, glyph: 'shards', shardRarity: 'Rare' },
  ]);
  rewardReceipts.reset();
});
