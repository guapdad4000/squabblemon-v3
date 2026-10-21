import assert from 'node:assert/strict';
import test from 'node:test';
import { decks } from '../../../lib/squabblemon-engine/src/data';
import { getStoryBattle, getStoryChapter, storyContent } from '../../../lib/squabblemon-engine/src/story';
import { canAffordSelection, createCardInstance, createStoryMatch, getDistrictResults, getMatchWinner,
  getStoryModifierSummaries, nextRound, pass, playTurnCard, revealCpuTurn, verifyStoryMatchTranscript,
  type Lane, type Match, type PlayerMove, type StoryEncounterSnapshot,
} from '../../../lib/squabblemon-engine/src/gameEngine';

const node = getStoryBattle('s2-noise-complaint-main-event')!;
const cpuCards = ['bikelife', 'vibe', 'plug', 'hooper', 'baby', 'cornball', 'snow', 'buspass', 'soulfood', 'cognac'];

// A lawful line with the shipped WHO YOU KNOW crew, against the actual story AI.
// Every play is selected from the current hand; no card, Motion or board is injected.
const winningLine: readonly ({ cardId: string; lane: Lane; squabble?: boolean } | null)[] = [
  { cardId: 'streamer', lane: 2 }, { cardId: 'cornball', lane: 1 }, null,
  { cardId: 'plug', lane: 0, squabble: true }, null,
  { cardId: 'techbro', lane: 1 }, null,
  { cardId: 'bossbabe', lane: 2 }, { cardId: 'buspass', lane: 0 }, { cardId: 'gamer', lane: 0 }, null,
  { cardId: 'stockz', lane: 2 }, null,
  { cardId: 'sneaker', lane: 0 }, { cardId: 'wifey', lane: 2 }, null,
];

function playFixture(snapshot: StoryEncounterSnapshot) {
  let m = createStoryMatch(snapshot, 'combo');
  const moves: PlayerMove[] = [];
  for (const command of winningLine) {
    assert.equal(m.phase, 'player');
    if (command) {
      const card = m.playerHand.find(c => c.cardId === command.cardId);
      assert(card, `${command.cardId} is actually in hand during round ${m.round}`);
      assert(canAffordSelection(m, 'player', card.instanceId, command.lane));
      moves.push({ cardInstanceId: card.instanceId, lane: command.lane,
        squabble: command.squabble ?? false, endTurn: false });
      m = playTurnCard(m, 'player', card.instanceId, command.lane, command.squabble ?? false);
    } else {
      moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
      m = nextRound(revealCpuTurn(pass(m, 'player')));
    }
  }
  assert.equal(m.phase, 'complete');
  assert.deepEqual(verifyStoryMatchTranscript(snapshot, 'combo', moves), m);
  return { match: m, moves };
}

function assertCanonicalCpuCards(m: Match, snapshot: StoryEncounterSnapshot) {
  const expected = new Set(snapshot.enemy.cardIds.map((id, index) =>
    createCardInstance(id, 'cpu', snapshot.enemy.deckId, index).instanceId));
  const played = m.effectLog.filter(e => e.type === 'play' && e.owner === 'cpu');
  const seen = new Set([
    ...played.map(e => e.cardInstanceId),
    ...m.cpuHand.map(c => c.instanceId),
    ...m.boards.flat().filter(c => c.owner === 'cpu').map(c => c.instanceId),
  ]);
  assert(seen.size <= 10, 'the boss uses its authored ten cards');
  assert([...seen].every(id => expected.has(id)), 'every CPU card retains its original deck-slot identity');
  assert.deepEqual(m.cpuCardIds, snapshot.enemy.cardIds, 'story draws do not mutate or enlarge the CPU deck');
  const snow = played.filter(e => e.cardId === 'snow');
  assert.equal(snow.length, 1, 'Officer Oink plays Snow Bunny once, with no free final-round copy');
  assert.equal(snow[0].cardInstanceId, createCardInstance('snow', 'cpu', snapshot.enemy.deckId, 6).instanceId);
}

test('Chapter Twelve Officer Oink keeps its six-round deck and announces a remaining-deck draw', () => {
  const chapter = getStoryChapter('s2-regular-guy-behavior')!;
  assert.equal(chapter.order, 12);
  assert(chapter.nodes.includes(node));
  assert.equal(node.encounter.enemy.name, 'Officer Oink');
  assert.equal(node.encounter.roundLimit, 6);
  assert.deepEqual(node.encounter.enemy.cardIds, cpuCards);
  assert.equal(new Set(node.encounter.enemy.cardIds).size, 10);
  assert.deepEqual(node.encounter.modifiers, { startingMotion: { player: 3, cpu: 1 }, handSize: { cpu: 4 } });
  const late = node.encounter.phases!.find(p => p.id.endsWith('-late-arrival'))!;
  assert.deepEqual(late.trigger, { kind: 'round', atLeast: 6 });
  assert.deepEqual(late.onEnter, [{ kind: 'draw', owner: 'cpu', amount: 1 }]);
  assert.match(late.description!, /remaining ten-card deck/);
  assert.match(late.description!, /deck is empty, no card is added/);
  assert(getStoryModifierSummaries(node.encounter).some(summary =>
    /Phase Late Arrival:.*draws one card from its remaining ten-card deck/.test(summary)));
});

test('all eight Season Two late-arrival phases draw from the remaining deck instead of manufacturing Snow', () => {
  const late = storyContent.chapters.filter(c => c.id.startsWith('s2-')).flatMap(c => c.nodes)
    .flatMap(n => n.kind === 'battle' ? n.encounter.phases ?? [] : [])
    .filter(p => p.id.endsWith('-late-arrival'));
  assert.equal(late.length, 8);
  for (const phase of late) assert.deepEqual(phase.onEnter, [{ kind: 'draw', owner: 'cpu', amount: 1 }], phase.id);
});

test('the real Officer Oink encounter has a legal verified winning line without a second Snow Bunny', () => {
  const original = JSON.stringify(node.encounter);
  const { match, moves } = playFixture(node.encounter);
  assert.equal(JSON.stringify(node.encounter), original, 'playing the encounter never edits its authored snapshot');
  assert.equal(getMatchWinner(match), 'player');
  assert.equal(getDistrictResults(match).filter(d => d.winner === 'player').length, 2);
  assertCanonicalCpuCards(match, node.encounter);
  assert.deepEqual(playFixture(JSON.parse(original)).match, match, 'the full winning line survives serialization');
  assert.equal(moves.filter(move => move.endTurn).length, 6);
  assert.deepEqual(decks.find(d => d.id === 'combo')!.cards,
    ['cornball', 'plug', 'streamer', 'gamer', 'techbro', 'bossbabe', 'wifey', 'buspass', 'stockz', 'sneaker']);
});

test('legacy Officer Oink snapshots naming Snow cannot create a duplicate of an already-dealt character', () => {
  const legacy: StoryEncounterSnapshot = { ...node.encounter,
    phases: node.encounter.phases!.map(phase => phase.id.endsWith('-late-arrival')
      ? { ...phase, onEnter: [{ kind: 'reinforcement' as const, owner: 'cpu' as const, cardId: 'snow' }] }
      : phase),
  };
  const { match } = playFixture(legacy);
  assertCanonicalCpuCards(match, legacy);
  assert(match.effectLog.some(e => e.note.includes('That character was already dealt; no duplicate created.')));
});
