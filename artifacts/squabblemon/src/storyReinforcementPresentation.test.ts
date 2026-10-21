import assert from 'node:assert/strict';
import test from 'node:test';
import { createCardInstance, createMatch, createStoryMatch, getStoryModifierSummaries, nextRound, pass, revealCpuTurn, type StoryEncounterSnapshot } from './gameEngine';
import { getStoryBattle } from '@workspace/squabblemon-engine/story';
import { squabbleHouseChapters, SQUABBLE_HOUSE_SUGGESTED_CREW } from '../../../lib/squabblemon-engine/src/storySquabbleHouse';

const oink = getStoryBattle('s2-noise-complaint-main-event')!;
const drawEncounter: StoryEncounterSnapshot = {
  ...oink.encounter,
  phases: [{
    id: 'remaining-deck', name: 'Remaining Deck', trigger: { kind: 'round', atLeast: 2 },
    onEnter: [{ kind: 'draw', owner: 'cpu', amount: 1 }],
  }],
};

test('Chapter Twelve briefing describes the actual remaining-deck draw and its empty-deck limit', () => {
  const lateArrival = oink.encounter.phases!.find(phase => phase.id.endsWith('-late-arrival'))!;
  const summaries = getStoryModifierSummaries(oink.encounter);
  assert(summaries.includes(`Phase ${lateArrival.name}: ${lateArrival.description}`));
  assert.match(lateArrival.description!, /draws one card.*remaining ten-card deck/i);
  assert.match(lateArrival.description!, /deck is empty, no card is added/i);
  assert.doesNotMatch(summaries.join(' '), /supporter reinforces|Snow Bunny|reinforces with snow/);
});

test('legacy descriptionless draw phases explain round timing and an exhausted deck without exposing the next card', () => {
  const summary = getStoryModifierSummaries(drawEncounter).find(item => item.startsWith('Phase Remaining Deck:'))!;
  assert.match(summary, /At round 2/);
  assert.match(summary, /cpu draws up to 1 remaining card from their deck/);
  assert.match(summary, /empty deck adds no cards/);
  assert.doesNotMatch(summary, /snow|bunny|hooper|plug/i);
});

test('authored phase descriptions remain the briefing source of truth', () => {
  const description = 'At round two, the rival draws up to one remaining deck card. An empty deck adds nothing.';
  const snapshot = { ...drawEncounter, phases: [{ ...drawEncounter.phases![0], description }] };
  assert.equal(getStoryModifierSummaries(snapshot).at(-1), `Phase Remaining Deck: ${description}`);
});

test('modifier summaries use public encounter rules rather than either live hand or draw order', () => {
  const initial = createStoryMatch(drawEncounter, 'block');
  const expected = getStoryModifierSummaries(drawEncounter);
  const changed = { ...initial,
    playerHand: [createCardInstance('janitor', 'player', 'hidden-player', 0)],
    cpuHand: [createCardInstance('snow', 'cpu', 'hidden-cpu', 0)],
    cpuCardIds: [...initial.cpuCardIds].reverse(), cpuDrawIndex: 9,
  };
  assert.deepEqual(getStoryModifierSummaries(initial), expected);
  assert.deepEqual(getStoryModifierSummaries(changed), expected);
  assert.deepEqual(getStoryModifierSummaries(createMatch('block', 'combo')), []);
});

for (const chapter of squabbleHouseChapters) {
  const battle = chapter.nodes.find(node => node.kind === 'battle')!;
  test(`${chapter.id}: both announced temporary practice copies survive owning the same staff in the deck`, () => {
    const support = battle.encounter.modifiers!.reinforcements!;
    assert(support.every(item => item.owner === 'player' && item.allowDuplicate === true));
    assert.match(battle.encounter.passive!.description, /temporary copies/);
    const summaries = getStoryModifierSummaries(battle.encounter);
    for (const item of support) {
      assert(summaries.some(summary => summary.includes(`Round ${item.round}:`)
        && summary.includes(item.cardId) && summary.includes('temporary practice copy')));
    }
    const initial = createStoryMatch(battle.encounter, SQUABBLE_HOUSE_SUGGESTED_CREW, 'owned-house-staff');
    assert.equal(initial.playerHand.filter(card => card.cardId === support[0].cardId).length, 2);
    const advance = (match: typeof initial) => nextRound(revealCpuTurn(pass(match, 'player')));
    const next = advance(initial);
    assert.deepEqual(advance(JSON.parse(JSON.stringify(initial))), next);
    assert.equal(next.playerHand.filter(card => card.cardId === support[1].cardId).length, 2);
    const ids = next.playerHand.map(card => card.instanceId);
    assert.equal(new Set(ids).size, ids.length, 'practice copies have separate instance identities');
    assert.deepEqual(next.playerCardIds, SQUABBLE_HOUSE_SUGGESTED_CREW, 'practice support never changes the submitted deck');
  });
}
