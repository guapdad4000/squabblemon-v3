import assert from 'node:assert/strict';
import test from 'node:test';
import { previewBattlePlay } from './battlePreview';
import { createMatch, createCardInstance, getDistrictResults, playCard, playTurnCard, type Lane, type Match } from './gameEngine';

test('known-board preview predicts a freeze and leaves the live fade untouched', () => {
  const match=createMatch('block','combo');
  const snow=createCardInstance('snow','player','preview',0);
  const victim={...createCardInstance('hooper','cpu','preview',1),lane:0 as const};
  match.playerMotion=20;match.playerHand=[snow];match.boards=[[victim],[],[]];
  const before=JSON.stringify(match);
  const preview=previewBattlePlay(match,snow.instanceId,0)!;
  assert.deepEqual(preview.after,getDistrictResults(playCard(match,'player',snow.instanceId,0)));
  assert.ok(preview.targets.includes(victim.instanceId));
  assert.equal(JSON.stringify(match),before);
});

test('preview cannot disclose which private cards the rival holds', () => {
  const match=createMatch('block','combo');
  const card=match.playerHand[0];
  const first=previewBattlePlay(match,card.instanceId,0);
  const other={...match,cpuHand:[createCardInstance('wifey','cpu','secret',0)],cpuCardIds:['wifey']};
  assert.deepEqual(previewBattlePlay(other,card.instanceId,0),first);
});

test('preview respects unaffordable choices and includes the armed Squabble', () => {
  const match=createMatch('block','combo');const card=match.playerHand[0];
  assert.equal(previewBattlePlay({...match,playerMotion:0},card.instanceId,0),null);
  assert.deepEqual(previewBattlePlay(match,card.instanceId,0,true)!.after,getDistrictResults(playCard(match,'player',card.instanceId,0,true)));
});

for (const [cardId, homeLane] of [['triple-og-blue', 0], ['triple-og-red', 2]] as const) {
  test(`${cardId} selection previews its home district and rejects off-side placement`, () => {
    const card = createCardInstance(cardId, 'player', 'og-preview', 0);
    const ally = { ...createCardInstance('hooper', 'player', 'og-preview', 1), lane: homeLane };
    const enemy = { ...createCardInstance('oink', 'cpu', 'og-preview', 2), lane: homeLane, powerModifier: 20 };
    const match: Match = { ...createMatch('block', 'combo'), round: 3, playerMotion: 8,
      playerHand: [card], boards: ([0, 1, 2] as Lane[]).map(lane => lane === homeLane ? [ally, enemy] : []) as Match['boards'] };
    const before = JSON.stringify(match);
    // Battle computes all three previews immediately on card selection, before
    // the player chooses a district. Reproduce that exact rendering input.
    const previews = ([0, 1, 2] as Lane[]).map(lane => previewBattlePlay(match, card.instanceId, lane));
    for (const lane of [0, 1, 2] as Lane[]) {
      if (lane === homeLane) {
        assert(previews[lane], 'the assigned home district keeps its real effect preview');
        assert.deepEqual(previews[lane]!.after, getDistrictResults(playTurnCard(match, 'player', card.instanceId, lane)));
      } else {
        assert.equal(previews[lane], null, 'other-side districts cannot be previewed');
      }
    }
    assert.equal(JSON.stringify(match), before, 'preview cannot mutate the live match');
    assert.equal(previewBattlePlay({ ...match, playerMotion: 0 }, card.instanceId, homeLane), null);

    const locked = { ...match, storyRuntime: { activePhaseIndex: 0, appliedEffectIds: [],
      lanePowerBonuses: [], laneLocks: [{ owner: 'player' as const, lanes: [homeLane] }] } };
    assert(previewBattlePlay(locked, card.instanceId, homeLane), 'a mythical OG retains its effect preview in a locked home lane');
    const ordinary = createCardInstance('hooper', 'player', 'og-preview', 3);
    assert.equal(previewBattlePlay({ ...locked, playerHand: [ordinary] }, ordinary.instanceId, homeLane), null,
      'ordinary card previews remain blocked by the same lane lock');
  });
}

test('preview highlights a creative buff even when its event has no explicit targets', () => {
  const barber = createCardInstance('barber', 'player', 'creative-preview', 0);
  const ally = { ...createCardInstance('hooper', 'player', 'creative-preview', 1), lane: 0 as const };
  const match = { ...createMatch('block', 'combo'), playerMotion: 20, playerHand: [barber], boards: [[ally], [], []] };
  ally.statuses.frozen = true;
  const before = JSON.stringify(match);
  assert.ok(previewBattlePlay(match, barber.instanceId, 0)!.targets.includes(ally.instanceId));
  assert.equal(JSON.stringify(match), before);
});


function freezeOwnedSnapshot<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeOwnedSnapshot(child);
    Object.freeze(value);
  }
  return value;
}

for (const [cardId, squabble, investment] of [
  ['snow', false, 0], ['barber', true, 0], ['redside3', false, 0],
  ['homelessguy', true, 3], ['the-concert', false, 0], ['the-concert', false, 1],
] as const) {
  test(`preview keeps immutable history and seeded/paid semantics: ${cardId}/${squabble}/${investment}`, () => {
    let history = createMatch('block', 'combo');
    for (let index = 0; index < 6; index++) {
      const owner = index % 2 ? 'cpu' : 'player';
      const card = createCardInstance('hooper', owner, 'preview-history', index);
      history = playTurnCard({ ...history, phase: owner === 'player' ? 'player' : 'cpu-reveal',
        [owner === 'player' ? 'playerHand' : 'cpuHand']: [card],
        [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 20 }, owner, card.instanceId, (Math.floor(index / 2) % 3) as Lane);
    }
    const actor = createCardInstance(cardId, 'player', 'preview-choice', 0);
    // Own all fixture objects before freezing; catalog definitions stay mutable
    // for unrelated test fixtures. A non-default sequence exercises seeded plays.
    const match: Match = JSON.parse(JSON.stringify({ ...history, phase: 'player', round: 4,
      playerMotion: 20, playerHand: [actor], nextEventSequence: 571 }));
    const originalBoards = JSON.parse(JSON.stringify(match.boards));
    const historicalEntry = JSON.parse(JSON.stringify(match.effectLog[0]));
    const expected = ([0, 1, 2] as Lane[]).map(lane => getDistrictResults(playTurnCard(
      JSON.parse(JSON.stringify({ ...match, cpuHand: [], cpuCardIds: [], cpuDrawIndex: 0 })),
      'player', actor.instanceId, lane, squabble, investment,
    )));
    const count = match.effectLog.length;
    Object.defineProperty(match.effectLog, 'toJSON', { value: () => {
      throw new Error('A lane preview must not serialize historical replay boards');
    } });
    freezeOwnedSnapshot(match);
    for (const lane of [0, 1, 2] as Lane[]) {
      const preview = previewBattlePlay(match, actor.instanceId, lane, squabble, investment)!;
      assert(preview);
      assert.deepEqual(preview.before, getDistrictResults(match));
      assert.deepEqual(preview.after, expected[lane]);
      assert(preview.targets.every(id => originalBoards.flat().some((card: { instanceId: string }) => card.instanceId === id)));
    }
    assert.equal(match.nextEventSequence, 571);
    assert.equal(match.effectLog.length, count);
    assert.deepEqual(match.effectLog[0], historicalEntry);
    assert.deepEqual(match.boards, originalBoards);
  });
}
