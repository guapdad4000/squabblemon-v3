import assert from 'node:assert/strict';
import test from 'node:test';
import { DECK_SIZE } from './data';
import {
  createCardInstance, createStoryMatch, DISTRICT_CATALOG, nextRound, playTurnCard,
  type CardInstance, type DistrictSnapshot, type Lane, type Match, type Owner,
  type StoryEffect, type StoryEncounterSnapshot,
} from './gameEngine';
import { getStoryBattle, storyContent, validateStoryContent, type StoryContent } from '@workspace/squabblemon-engine/story';

const CREW = ['cornball', 'roaster', 'rastamon', 'oink', 'wifey', 'snow', 'plug', 'baby', 'buspass', 'soulfood'];
const other = (owner: Owner): Owner => owner === 'player' ? 'cpu' : 'player';
const handKey = (owner: Owner) => owner === 'player' ? 'playerHand' : 'cpuHand';
const drawKey = (owner: Owner) => owner === 'player' ? 'playerDrawIndex' : 'cpuDrawIndex';
const zones = (m: Match) => [...m.playerHand, ...m.cpuHand, ...m.boards.flat()];
const own = (m: Match, owner: Owner, id: string) => zones(m).filter(c => c.owner === owner && c.cardId === id);
const advance = (m: Match) => nextRound({ ...m, phase: 'resolved' });
const recover = (m: Match): Match => JSON.parse(JSON.stringify(m));
const crewWith = (id: string, index: number) => {
  const crew = CREW.filter(c => c !== id);
  crew.splice(index, 0, id);
  return crew.slice(0, DECK_SIZE);
};
const roundPhase = (round: number, effects: readonly StoryEffect[], id = `round-${round}`) => ({
  id, name: id, description: 'A deterministic story effect.', trigger: { kind: 'round' as const, atLeast: round }, onEnter: effects,
});
function start(owner: Owner, options: {
  crew?: string[]; opening?: number; phases?: StoryEncounterSnapshot['phases'];
  reinforcements?: NonNullable<StoryEncounterSnapshot['modifiers']>['reinforcements']; district?: DistrictSnapshot;
} = {}): Match {
  const crew = options.crew ?? CREW;
  const template = getStoryBattle('welcome-to-the-block')!.encounter;
  const snapshot: StoryEncounterSnapshot = {
    ...template, id: `reinforcement-fairness-${owner}`,
    enemy: { ...template.enemy, deckId: 'fairness-cpu', cardIds: owner === 'cpu' ? crew : CREW },
    roundLimit: 6, phases: options.phases ?? [],
    modifiers: { startingMotion: { player: 9, cpu: 9 }, handSize: { player: options.opening ?? 2, cpu: options.opening ?? 2 },
      reinforcements: options.reinforcements ?? [] },
  };
  return createStoryMatch(snapshot, owner === 'player' ? crew : CREW, 'fairness-player', undefined, options.district);
}
function play(m: Match, owner: Owner, card: CardInstance, lane: Lane = 0): Match {
  return playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerMotion' : 'cpuMotion']: 9,
  }, owner, card.instanceId, lane);
}
function cast(m: Match, owner: Owner, id: string, lane: Lane = 0): Match {
  const c = createCardInstance(id, owner, 'fairness-cast', m.nextEventSequence);
  return play({ ...m, [handKey(owner)]: [...m[handKey(owner)], c] }, owner, c, lane);
}
const assertUniqueInstances = (m: Match) => assert.equal(new Set(zones(m).map(c => c.instanceId)).size, zones(m).length);
const market: DistrictSnapshot = { version: 1, locations: ['night-market', 'magic-city', 'time-square'].map(id =>
  ({ ...DISTRICT_CATALOG.find(d => d.id === id)! })) as DistrictSnapshot['locations'] };

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: a named reinforcement cannot clone a character in the opening hand`, () => {
    const m = start(owner, { crew: crewWith('snow', 0), reinforcements: [{ round: 1, owner, cardId: 'snow' }] });
    assert.equal(own(m, owner, 'snow').length, 1);
    assert.equal(m[handKey(owner)].length, 2);
    assert.equal(own(m, owner, 'snow')[0].instanceId, `${owner}:fairness-${owner}:0:snow`);
    assertUniqueInstances(m);
  });

  test(`${owner}: reinforcement after an ordinary draw cannot deal that character again`, () => {
    let m = start(owner, { crew: crewWith('snow', 2), reinforcements: [{ round: 3, owner, cardId: 'snow' }] });
    m = advance(m);
    const original = own(m, owner, 'snow')[0];
    assert(original);
    m = advance(m);
    assert.deepEqual(own(m, owner, 'snow').map(c => c.instanceId), [original.instanceId]);
    assert.equal(m[drawKey(owner)], 4);
    assertUniqueInstances(m);
  });

  test(`${owner}: early tutoring keeps the deck order and future market/round draws skip its slot`, () => {
    const crew = crewWith('snow', 4);
    let m = start(owner, { crew, district: market, reinforcements: [{ round: 1, owner, cardId: 'snow' }] });
    const original = own(m, owner, 'snow')[0];
    assert.equal(original.instanceId, `${owner}:fairness-${owner}:4:snow`);
    assert.deepEqual(owner === 'player' ? m.playerCardIds : m.cpuCardIds, crew);
    assert.equal(m[drawKey(owner)], 2, 'tutoring does not discard earlier cards');
    assert.deepEqual(m.storyRuntime?.drawnReserveIndexes?.[owner], [4]);
    const first = m[handKey(owner)][0];
    m = play(m, owner, first, 0); // Market draws slot 2.
    assert.equal(m[drawKey(owner)], 3);
    m = advance(m); // Normal draw takes slot 3.
    const next = m[handKey(owner)].find(c => c.cardId !== 'snow')!;
    m = play(m, owner, next, 0); // Market skips tutored slot 4 and takes slot 5.
    assert.equal(m[drawKey(owner)], 6);
    assert.equal(own(m, owner, 'snow').length, 1);
    assert(m[handKey(owner)].some(c => c.instanceId === `${owner}:fairness-${owner}:5:${crew[5]}`));
    const before = JSON.stringify(m);
    const direct = advance(m), resumed = advance(recover(m));
    assert.deepEqual(resumed, direct);
    assert.equal(JSON.stringify(m), before, 'round advancement does not mutate the saved input');
    assertUniqueInstances(direct);
  });

  test(`${owner}: ordinary round draw alone skips a previously tutored slot`, () => {
    let m = start(owner, { crew: crewWith('snow', 3), reinforcements: [{ round: 1, owner, cardId: 'snow' }] });
    m = advance(m);
    m = advance(m);
    assert.equal(m[drawKey(owner)], 5);
    assert.equal(own(m, owner, 'snow').length, 1);
    assertUniqueInstances(m);
  });

  test(`${owner}: a named character cannot respawn after its canonical card is destroyed`, () => {
    let m = start(owner, { crew: crewWith('snow', 0), reinforcements: [{ round: 2, owner, cardId: 'snow' }] });
    const snow = own(m, owner, 'snow')[0];
    m = play(m, owner, snow);
    m = cast(m, other(owner), 'queenofhearts');
    assert.equal(zones(m).some(c => c.instanceId === snow.instanceId), false, 'the real execution removed Snow');
    assert(m.boards.flat().some(c => c.cardId === 'cardguard'), 'the ordinary ability summon still resolved');
    m = advance(m);
    assert.equal(own(m, owner, 'snow').length, 0, 'reinforcement does not recreate a spent deck card');
    assertUniqueInstances(m);
  });

  test(`${owner}: a named character cannot be cloned after its canonical instance changes sides`, () => {
    let m = start(owner, { crew: crewWith('snow', 0), reinforcements: [{ round: 2, owner, cardId: 'snow' }] });
    const snow = own(m, owner, 'snow')[0];
    m = play(m, owner, snow);
    m = { ...m, boards: m.boards.map(cs => cs.map(c => c.instanceId === snow.instanceId ? { ...c, owner: other(owner) } : c)) as Match['boards'] };
    m = advance(m);
    assert.equal(zones(m).filter(c => c.instanceId === snow.instanceId).length, 1);
    assert.equal(own(m, owner, 'snow').length, 0);
    assertUniqueInstances(m);
  });

  test(`${owner}: repeated outside-deck character grants share a persistent once-only budget`, () => {
    const crew = CREW.map(id => id === 'snow' ? 'nerd' : id);
    let m = start(owner, { crew, reinforcements: [
      { round: 1, owner, cardId: 'snow' }, { round: 1, owner, cardId: 'snow' }, { round: 3, owner, cardId: 'snow' },
    ], phases: [roundPhase(1, [{ kind: 'reinforcement', owner, cardId: 'snow' }])] });
    const original = own(m, owner, 'snow')[0];
    assert.equal(own(m, owner, 'snow').length, 1);
    assert.deepEqual(m.storyRuntime?.reinforcedCharacterIds?.[owner], ['snow']);
    m = play(m, owner, original);
    m = cast(m, other(owner), 'queenofhearts');
    assert.equal(own(m, owner, 'snow').length, 0);
    const direct = advance(advance(m)), resumed = advance(advance(recover(m)));
    assert.deepEqual(resumed, direct);
    assert.equal(own(direct, owner, 'snow').length, 0, 'later phases cannot restore a destroyed named reinforcement');
    assert.equal(direct.storyRuntime?.appliedEffectIds.length, 4, 'skipped grants are still idempotently consumed');
    assertUniqueInstances(direct);
  });

  test(`${owner}: distinct named tutors and generic draws in one phase consume distinct canonical slots`, () => {
    const crew = crewWith('snow', 4);
    const effects: StoryEffect[] = [{ kind: 'reinforcement', owner, cardId: 'snow' },
      { kind: 'draw', owner, amount: 2 }, { kind: 'reinforcement', owner, cardId: crew[3] }];
    let m = start(owner, { crew, phases: [roundPhase(1, effects)] });
    assert.equal(m[handKey(owner)].length, 5);
    assert.equal(m[drawKey(owner)], 5, 'cursor is normalized past the tutored slot');
    assert.deepEqual(m[handKey(owner)].map(c => c.cardId), [crew[0], crew[1], 'snow', crew[2], crew[3]]);
    assert.equal(own(m, owner, crew[3]).length, 1);
    m = play(m, owner, m[handKey(owner)][0], 1);
    assert.equal(m[handKey(owner)].length, 4, 're-evaluating a phase cannot replay draws');
    assertUniqueInstances(m);
  });

  test(`${owner}: bounded generic draws exhaust the remaining legal deck without new copies`, () => {
    let m = start(owner, { phases: [roundPhase(1, [{ kind: 'draw', owner, amount: 10 }])] });
    assert.equal(m[handKey(owner)].length, 10);
    assert.equal(m[drawKey(owner)], 10);
    m = advance(m);
    assert.equal(m[handKey(owner)].length, 10);
    assert.equal(m[drawKey(owner)], 10);
    assertUniqueInstances(m);
  });

  test(`${owner}: repeatable support items retain distinct identities`, () => {
    const m = start(owner, { reinforcements: [{ round: 1, owner, cardId: 'buspass' }, { round: 1, owner, cardId: 'buspass' }] });
    assert.equal(own(m, owner, 'buspass').length, 2);
    assertUniqueInstances(m);
  });

  test(`${owner}: legitimate Mad Hatter return and Snow freeze preserve their existing mechanics`, () => {
    let m = start(owner, { crew: crewWith('snow', 0), opening: 2 });
    const snow = own(m, owner, 'snow')[0];
    const enemy = { ...createCardInstance('cornball', other(owner), 'snow-target'), lane: 0 as Lane, basePower: 30 };
    m = { ...m, boards: [[enemy], [], []] };
    m = play(m, owner, snow);
    assert(m.boards.flat().find(c => c.instanceId === enemy.instanceId)!.statuses.frozen);
    m = cast(m, owner, 'madhatter');
    const returned = m[handKey(owner)].find(c => c.instanceId === snow.instanceId);
    assert(returned, 'Tea Party returns the existing Snow instance');
    assert.equal(zones(m).filter(c => c.instanceId === snow.instanceId).length, 1);
    m = play(m, owner, returned, 1);
    assert.equal(m.boards.flat().filter(c => c.instanceId === snow.instanceId).length, 1);
    assertUniqueInstances(m);
  });
}

test('House trial character copies remain explicit, limited to authored player grants', () => {
  const exceptions: string[] = [];
  for (const chapter of storyContent.chapters) for (const node of chapter.nodes) {
    if (node.kind !== 'battle') continue;
    const effects = [...(node.encounter.modifiers?.reinforcements ?? []),
      ...(node.encounter.phases ?? []).flatMap(p => (p.onEnter ?? []).filter(e => e.kind === 'reinforcement'))];
    for (const effect of effects) if (effect.allowDuplicate) {
      assert.equal(effect.owner, 'player');
      assert(chapter.id.startsWith('squabble-house-'));
      exceptions.push(node.id);
    }
  }
  assert.equal(exceptions.length, 12, 'only the two trial grants in each of the six House chapters allow copies');
  const chapter = storyContent.chapters.find(c => c.id === 'squabble-house-last-waffle')!;
  const battle = chapter.nodes.find(n => n.kind === 'battle')!;
  assert.equal(battle.kind, 'battle');
  const crew = ['squabble-house-manager', 'squabbleserver', ...CREW].slice(0, DECK_SIZE);
  const initial = createStoryMatch(battle.encounter, crew, 'house-copy-contract');
  assert.equal(own(initial, 'player', 'squabble-house-manager').length, 2);
  const next = advance(initial);
  assert.equal(own(next, 'player', 'squabbleserver').length, 2);
  assertUniqueInstances(next);
});

function contentWithEffects(effects: readonly StoryEffect[], reinforcements?: NonNullable<StoryEncounterSnapshot['modifiers']>['reinforcements']): StoryContent {
  const chapter = storyContent.chapters[0];
  const battle = chapter.nodes.find(n => n.kind === 'battle')!;
  assert.equal(battle.kind, 'battle');
  return { version: 1, chapters: [{ ...chapter, prerequisites: [], nodes: [{ ...battle, prerequisites: [],
    encounter: { ...battle.encounter, phases: [roundPhase(1, effects)], modifiers: { reinforcements } } }] }] };
}

test('content validation accepts bounded draws and well-typed explicit copy grants', () => {
  const content = contentWithEffects([{ kind: 'draw', owner: 'cpu', amount: 1 },
    { kind: 'draw', owner: 'player', amount: DECK_SIZE },
    { kind: 'reinforcement', owner: 'player', cardId: 'snow', allowDuplicate: true }]);
  assert.equal(validateStoryContent(content), content);
  assert.equal(validateStoryContent(storyContent), storyContent);
});

for (const amount of [0, -1, 1.5, DECK_SIZE + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
  test(`content validation rejects invalid generic draw count ${amount}`, () => {
    assert.throws(() => validateStoryContent(contentWithEffects([{ kind: 'draw', owner: 'cpu', amount }])), /invalid phases/);
  });
}

test('content validation rejects malformed draw sides and nonboolean duplicate flags in both paths', () => {
  assert.throws(() => validateStoryContent(contentWithEffects([{ kind: 'draw', owner: 'rival', amount: 1 } as unknown as StoryEffect])), /invalid phases/);
  assert.throws(() => validateStoryContent(contentWithEffects([{ kind: 'reinforcement', owner: 'cpu', cardId: 'snow', allowDuplicate: 'yes' } as unknown as StoryEffect])), /invalid phases/);
  const malformed = [{ round: 1, owner: 'player', cardId: 'snow', allowDuplicate: 1 }] as unknown as NonNullable<StoryEncounterSnapshot['modifiers']>['reinforcements'];
  assert.throws(() => validateStoryContent(contentWithEffects([], malformed)), /invalid modifiers/);
});
