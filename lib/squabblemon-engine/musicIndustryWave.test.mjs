import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from './src/data.ts';
import { createCardInstance, createMatch } from './src/gameEngine.ts';
import { MUSIC_INDUSTRY_WAVE, MUSIC_INDUSTRY_IDS, FITNESS_WAVE_IDS, musicIndustryWaveCards } from './src/musicIndustryWave.ts';
import { musicReveal, musicResolved, musicAfterPlay, musicMoved, musicDamage, musicAfterAction, musicRoundEnd, musicRoundStart, musicCleansed, musicCanMove, musicDistrictMarks, isMusicCharacter, isFitnessCharacter } from './src/musicIndustryAbilities.ts';

const blank = () => ({ ...createMatch('block', 'block'), round: 1, playerMotion: 2, cpuMotion: 2, boards: [[], [], []], playerHand: [], cpuHand: [], creativeMarks: [], effectLog: [] });
const unit = (id, owner = 'player', lane = 0, index = 0) => {
  const printed = musicIndustryWaveCards[id] ?? cards[id];
  return { ...createCardInstance('cornball', owner, 'music-test', index), ...printed, instanceId: `${owner}:${index}:${id}`, cardId: id, basePower: printed.power, lane, playedRound: 1 };
};
const find = (m, id) => [...m.boards.flat(), ...m.playerHand, ...m.cpuHand].find(c => c.instanceId === id);
const add = (m, ...cs) => ({ ...m, boards: m.boards.map((xs, lane) => [...xs, ...cs.filter(c => c.lane === lane)]) });
const modify = (m, id, fn) => ({ ...m, boards: m.boards.map(xs => xs.map(c => c.instanceId === id ? fn(c) : c)), playerHand: m.playerHand.map(c => c.instanceId === id ? fn(c) : c), cpuHand: m.cpuHand.map(c => c.instanceId === id ? fn(c) : c) });
const power = c => c.statuses.frozen ? 0 : c.basePower + c.powerModifier;
const guarded = (m, target) => target.statuses.uncounterable ? m : target.statuses.protected ? modify(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses, protected: false } })) : null;
const t = {
  power, modify, laneOpen: () => true, buff: (m, id, n) => modify(m, id, c => ({ ...c, powerModifier: c.powerModifier + n })),
  protect: (m, _s, id) => modify(m, id, c => ({ ...c, statuses: { ...c.statuses, protected: true } })),
  hit: (m, _s, target, n) => {
    const block = guarded(m, target); if (block) return block;
    let after = modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier + n, recoverableDamage: (c.recoverableDamage ?? 0) - n }));
    const current = find(after, target.instanceId);
    if (power(current) <= 0) after = { ...after, boards: after.boards.map(xs => xs.filter(c => c.instanceId !== target.instanceId)), laneDamage: [...(after.laneDamage ?? []), { round: m.round, lane: target.lane, instanceId: target.instanceId, amount: -n }] };
    return after;
  },
  trim: (m, _s, target, n) => guarded(m, target) ?? modify(m, target.instanceId, c => ({ ...c, powerModifier: c.powerModifier - Math.min(n, Math.max(0, c.powerModifier)) })),
  status: (m, _s, target, key) => guarded(m, target) ?? modify(m, target.instanceId, c => ({ ...c, statuses: { ...c.statuses, [key]: true } })),
  canMove: (m, c, lane) => c.lane !== lane && !c.statuses.locked && !c.statuses.frozen && musicCanMove(m, c.instanceId) && m.boards[lane].filter(x => x.owner === c.owner).length < 4,
  score: (m, owner, lane) => m.boards[lane].filter(c => c.owner === owner).reduce((sum, c) => sum + power(c), 0),
  move: (m, c, lane) => t.canMove(m, c, lane) ? { ...m, boards: m.boards.map((xs, l) => [...xs.filter(x => x.instanceId !== c.instanceId), ...(l === lane ? [{ ...c, lane, moved: true }] : [])]) } : m,
  returnAlly: (m, s, c) => {
    if (c.statuses.locked || !musicCanMove(m, c.instanceId)) return m;
    const key = c.owner === 'player' ? 'playerHand' : 'cpuHand', order = m.nextDiscountOrder;
    return { ...m, boards: m.boards.map(xs => xs.filter(x => x.instanceId !== c.instanceId)), [key]: [...m[key], { ...c, lane: null, powerModifier: 0 }], nextDiscountOrder: order + 1, discountTokens: [...m.discountTokens, { id: `test:${order}`, owner: s.owner, sourceInstanceId: s.instanceId, sourceLane: s.lane, targetInstanceId: c.instanceId, eligibility: 'homecoming', createdOrder: order }] };
  },
  echo: (m, source) => musicReveal(m, source, t, true) ?? m,
  refund: (m, owner, amount) => { const key = owner === 'player' ? 'playerMotion' : 'cpuMotion'; return { ...m, [key]: Math.min(9, m[key] + amount) }; },
  train: (m, id) => modify(m, id, c => ({ ...c, waveTrainingUsed: true })),
  event: (_before, m) => ({ ...m, nextEventSequence: m.nextEventSequence + 1 }),
  roundLimit: () => 6,
};
const cast = (m, source) => musicReveal(m, source, t) ?? m;
const at = (m, round) => musicRoundStart({ ...m, round }, t);

test('wave has fourteen unique identities; Nail Tech and working professionals retain their own identity', () => {
  assert.equal(MUSIC_INDUSTRY_WAVE.length, 14); assert.equal(new Set(MUSIC_INDUSTRY_WAVE.map(([id]) => id)).size, 14);
  assert.equal(MUSIC_INDUSTRY_IDS.length, 10); assert.equal(FITNESS_WAVE_IDS.length, 4);
  assert.equal(musicIndustryWaveCards.nail, undefined); assert.equal(cards.nail.cost, 2); assert.equal(cards.nail.elementalBond, 'Poison');
  assert.equal(isMusicCharacter(unit('piratedj')), true); assert.equal(isMusicCharacter(unit('promoter')), true);
  assert.equal(isFitnessCharacter(unit('sportsprodigy')), true); assert.equal(isFitnessCharacter(unit('nail')), false);
  assert.equal(isMusicCharacter({ ...unit('cornball'), copiedAbilityCardId: 'the-rapper' }), false);
});

test('a Soundcheck pays only for a successful real entrance and cannot be reopened after payout', () => {
  const opener = unit('the-opening-act'), artist = unit('the-manager-nice', 'player', 1, 1);
  let m = cast(add(blank(), opener), opener), before = add(m, artist);
  let failed = musicResolved(before, before, artist, t); assert.equal(failed.playerMotion, 2);
  let resolved = cast(before, artist); m = musicResolved(before, resolved, artist, t); assert.equal(m.playerMotion, 3);
  m = cast(m, find(m, opener.instanceId)); assert.equal(m.creativeMarks.some(x => x.kind === 'mi-soundcheck'), false);
  assert.equal(find(m, opener.instanceId).creativeEntranceSucceeded, false);
});

test('echoing an artist cannot collect Soundcheck or performance reactions', () => {
  const opener = unit('the-opening-act'), artist = unit('the-manager-nice', 'player', 1, 1);
  let m = cast(add(blank(), opener), opener), before = add(m, artist);
  m = musicResolved(before, cast(before, artist), artist, t, true);
  assert.equal(m.playerMotion, 2); assert.equal(m.creativeMarks.some(x => x.kind === 'mi-soundcheck'), true);
});

test('Spinback credit expires and its match cap survives a copied DJ and JSON snapshots', () => {
  const dj = unit('the-dj'), target = unit('the-battle-rapper', 'player', 0, 1);
  let m = cast(add(blank(), dj, target), dj);
  assert.equal(find(m, target.instanceId).lane, null); assert.equal(m.discountTokens[0].expiresAfterRound, 2);
  const copy = { ...unit('scammer', 'player', 0, 3), copiedAbilityCardId: 'the-dj' };
  const other = unit('the-hype-man', 'player', 0, 4);
  m = JSON.parse(JSON.stringify(add(m, copy, other)));
  m = cast(m, copy); assert.equal(find(m, other.instanceId).lane, 0); assert.equal(find(m, copy.instanceId).creativeEntranceSucceeded, false);
});

test('Call/Response requires another stage and active caller; pays exactly once', () => {
  const hype = unit('the-hype-man'), caller = unit('the-rapper', 'player', 0, 1), response = unit('the-dj', 'player', 1, 2);
  let m = cast(add(blank(), hype, caller), hype), before = m;
  m = musicAfterPlay(before, add(m, response), response.instanceId, t, response);
  assert.equal(find(m, caller.instanceId).powerModifier, 2); assert.equal(find(m, response.instanceId).powerModifier, 2); assert.equal(find(m, caller.instanceId).statuses.protected, true);
  const repeated = musicAfterPlay(before, m, response.instanceId, t, response); assert.equal(find(repeated, caller.instanceId).powerModifier, 2);
});

test('insurance uses authoritative cancelled/delayed facts and never reverses cancellation', () => {
  const manager = unit('the-manager-nice'), artist = unit('the-battle-rapper', 'player', 1, 1);
  for (const result of ['cancelled', 'delayed']) {
    let before = cast(add(blank(), manager), manager);
    let m = musicAfterPlay(before, add(before, artist), artist.instanceId, t, artist, result);
    assert.equal(m.playerMotion, 3); assert.equal(find(m, artist.instanceId).statuses.protected, false);
    m = musicAfterPlay(before, m, artist.instanceId, t, artist, result); assert.equal(m.playerMotion, 3);
  }
  const before = cast(add(blank(), manager), manager);
  const m = musicAfterPlay(before, add(before, artist), artist.instanceId, t, artist, 'resolved');
  assert.equal(m.playerMotion, 2); assert.equal(find(m, artist.instanceId).statuses.protected, true);
});

test('rapper has separate owner-shared local/wide caps; denied entrances give no payoff', () => {
  const rapper = unit('the-rapper'), rival = unit('hooper', 'cpu', 0, 1), artist = unit('the-manager-nice', 'player', 0, 2);
  let before = add(blank(), rapper, rival, artist), m = musicResolved(before, cast(before, artist), artist, t);
  assert.equal(find(m, rival.instanceId).powerModifier, -2);
  const second = unit('the-manager-nice', 'player', 0, 3); before = add(m, second); m = musicResolved(before, cast(before, second), second, t);
  assert.equal(find(m, rival.instanceId).powerModifier, -2);
  const wide = unit('the-manager-nice', 'player', 1, 4); before = add(m, wide); m = musicResolved(before, cast(before, wide), wide, t);
  assert.equal(find(m, wide.instanceId).powerModifier, 2);
});

test('a protected arrival consumes the public booking without Weaken or training', () => {
  const promoter = unit('the-janky-promoter'), arrival = unit('hooper', 'cpu', 1, 1);
  arrival.statuses.protected = true;
  const before = cast(add(blank(), promoter), promoter);
  const after = musicAfterPlay(before, add(before, arrival), arrival.instanceId, t, arrival);
  assert.equal(find(after, arrival.instanceId).powerModifier, 0); assert.equal(find(after, arrival.instanceId).statuses.weakened, false);
  assert.equal(after.creativeMarks.some(x => x.kind === 'mi-booking'), false);
});

test('booking triggers on real movement, damages first and Weakens only a survivor', () => {
  const promoter = unit('the-janky-promoter'), arrival = unit('hooper', 'cpu', 2, 1);
  let before = cast(add(blank(), promoter, arrival), promoter);
  let after = t.move(before, arrival, 1); after = musicMoved(before, after, arrival.instanceId, t);
  assert.equal(find(after, arrival.instanceId).powerModifier, -1); assert.equal(find(after, arrival.instanceId).statuses.weakened, true);
});

test('Diss Track trims only bonus; blocked initial hits cannot arm a Receipt', () => {
  const battle = unit('the-battle-rapper'), target = { ...unit('hooper', 'cpu', 0, 1), powerModifier: 3, recoverableDamage: 0 };
  let m = cast(add(blank(), battle, target), battle);
  assert.equal(find(m, target.instanceId).powerModifier, 0); assert.equal(find(m, target.instanceId).recoverableDamage, 0);
  let before = m; m = t.buff(m, target.instanceId, 1); m = musicAfterAction(before, m, t);
  assert.equal(find(m, target.instanceId).powerModifier, 1); assert.equal(find(m, target.instanceId).statuses.silenced, true);
  assert.equal(m.creativeMarks.some(x => x.kind === 'mi-diss'), false);
  target.statuses.protected = true; m = cast(add(blank(), battle, target), battle);
  assert.equal(m.creativeMarks.some(x => x.kind === 'mi-diss'), false); assert.equal(find(m, battle.instanceId).creativeEntranceSucceeded, false);
});

test('360 royalty never takes base Hands, manufactures injury or clears an independent Lock', () => {
  const manager = unit('the-manager-evil'), client = unit('the-rapper', 'player', 0, 1);
  let m = cast(add(blank(), manager, client), manager); assert.equal(musicCanMove(m, client.instanceId), false);
  m = t.modify(m, client.instanceId, c => ({ ...c, powerModifier: 1, recoverableDamage: 2, statuses: { ...c.statuses, locked: true } }));
  m = musicRoundEnd({ ...m, round: 2 }, t);
  assert.equal(find(m, client.instanceId).powerModifier, 0); assert.equal(find(m, manager.instanceId).powerModifier, 1);
  assert.equal(find(m, client.instanceId).recoverableDamage, 2); assert.equal(find(m, client.instanceId).statuses.locked, true); assert.equal(musicCanMove(m, client.instanceId), true);
});

test('cleansing cancels just the contract; a disabled manager receives no royalties', () => {
  const manager = unit('the-manager-evil'), client = unit('the-rapper', 'player', 0, 1);
  let m = cast(add(blank(), manager, client), manager); m = musicCleansed(m, client.instanceId, t);
  assert.equal(musicCanMove(m, client.instanceId), true); assert.equal(find(m, client.instanceId).powerModifier, 3);
  m = cast(add(blank(), manager, client), manager); m = t.modify(m, manager.instanceId, c => ({ ...c, statuses: { ...c.statuses, silenced: true } }));
  m = musicRoundEnd({ ...m, round: 2 }, t); assert.equal(find(m, client.instanceId).powerModifier, 3); assert.equal(find(m, manager.instanceId).powerModifier, 0);
});

test('Pass the Torch excludes failed history and is capped across copied Legends', () => {
  const legend = unit('the-og-rap-legend'), apprentice = unit('the-battle-rapper', 'player', 0, 1), rival = unit('hooper', 'cpu', 0, 2);
  let m = add(blank(), legend, apprentice, rival); m.entranceHistory = [apprentice.instanceId];
  m = cast(m, legend); assert.equal(find(m, rival.instanceId).powerModifier, 0);
  m = t.modify(m, apprentice.instanceId, c => ({ ...c, creativeEntranceSucceeded: true })); m = cast(m, legend);
  assert.equal(find(m, rival.instanceId).powerModifier, -4); assert.equal(find(m, apprentice.instanceId).statuses.protected, true);
  m = cast(m, legend); assert.equal(find(m, rival.instanceId).powerModifier, -4);
});

test('Fitness Bro counts real off-stage deployments, pays at most three round-end reps', () => {
  const bro = unit('fitness-bro'), ally = unit('cornball', 'player', 1, 1);
  let m = add(blank(), bro);
  for (let round = 1; round <= 4; round++) {
    m = at(m, round); const before = m; m = musicAfterPlay(before, add(m, { ...ally, instanceId: `${ally.instanceId}:${round}` }), `${ally.instanceId}:${round}`, t, ally);
    m = musicRoundEnd(m, t); m = musicRoundEnd(m, t);
  }
  assert.equal(find(m, bro.instanceId).powerModifier, 9); assert.equal(find(m, bro.instanceId).statuses.protected, true);
});

test('Active Recovery repairs actual damage after movement without cleansing unrelated statuses', () => {
  const girl = unit('fitness-girl'), client = { ...unit('hooper', 'player', 1, 1), powerModifier: -3, recoverableDamage: 3 };
  client.statuses.burnStacks = 2; client.statuses.silenced = true;
  // Force the destination through normal lane score ordering.
  const filler = unit('hooper', 'player', 2, 2); filler.powerModifier = 5;
  let m = cast(add(blank(), girl, client, filler), girl);
  assert.equal(find(m, girl.instanceId).lane, 1); assert.equal(find(m, client.instanceId).powerModifier, 0);
  assert.equal(find(m, client.instanceId).recoverableDamage, 0); assert.equal(find(m, client.instanceId).statuses.burnStacks, 0); assert.equal(find(m, client.instanceId).statuses.silenced, true);
  const blocked = { ...girl, statuses: { ...girl.statuses, locked: true } }; m = cast(add(blank(), blocked, client), blocked);
  assert.equal(find(m, blocked.instanceId).lane, 0); assert.equal(find(m, client.instanceId).powerModifier, -3); assert.equal(find(m, blocked.instanceId).creativeEntranceSucceeded, false);
});

test('Circuit Training requires all three districts; oscillation and expired circuits do not finish', () => {
  const trainer = unit('personal-trainer'), athlete = unit('fitness-bro', 'player', 0, 1);
  let m = cast(add(blank(), trainer, athlete), trainer), before = m;
  m = musicMoved(before, t.move(m, athlete, 1), athlete.instanceId, t); assert.equal(find(m, athlete.instanceId).powerModifier, 3);
  before = m; m = musicMoved(before, t.move(m, find(m, athlete.instanceId), 0), athlete.instanceId, t);
  before = m; m = musicMoved(before, t.move(m, find(m, athlete.instanceId), 1), athlete.instanceId, t); assert.equal(find(m, athlete.instanceId).powerModifier, 3);
  before = m; m = musicMoved(before, t.move(m, find(m, athlete.instanceId), 2), athlete.instanceId, t);
  assert.equal(find(m, athlete.instanceId).powerModifier, 6); assert.equal(find(m, athlete.instanceId).statuses.protected, true);
  m = cast(add(blank(), trainer, athlete), trainer); m = at(m, 4); before = m;
  m = musicMoved(before, t.move(m, athlete, 1), athlete.instanceId, t); assert.equal(find(m, athlete.instanceId).powerModifier, 0);
});

test('enemy-caused athlete defeats pay Demon twice across rounds; friendly damage and tokens never pay', () => {
  const demon = unit('demon-trainer'), athlete = unit('fitness-girl', 'player', 1, 1), foe = unit('hooper', 'cpu', 1, 2);
  let before = add(blank(), demon, athlete, foe);
  const injured = musicDamage(before, t.hit(before, foe, athlete, -1), foe, athlete, t);
  assert.equal(find(injured, demon.instanceId).powerModifier, 0, 'nonlethal damage does not pay a defeat reward');
  let m = t.hit(before, foe, athlete, -athlete.basePower);
  m = musicDamage(before, m, foe, athlete, t); assert.equal(find(m, demon.instanceId).powerModifier, 2); assert.equal(find(m, foe.instanceId).powerModifier, -1);
  const athlete2 = unit('fitness-girl', 'player', 1, 3); before = add(m, athlete2); m = musicDamage(before, t.hit(before, foe, athlete2, -athlete2.basePower), foe, athlete2, t); assert.equal(find(m, demon.instanceId).powerModifier, 2);
  m = at(m, 2); const athlete3 = unit('fitness-girl', 'player', 1, 4); before = add(m, athlete3); m = musicDamage(before, t.hit(before, foe, athlete3, -athlete3.basePower), foe, athlete3, t); assert.equal(find(m, demon.instanceId).powerModifier, 4);
  const friendly = unit('fitness-girl', 'player', 1, 5); before = add(at(m, 3), friendly); m = musicDamage(before, t.hit(before, demon, friendly, -friendly.basePower), demon, friendly, t); assert.equal(find(m, demon.instanceId).powerModifier, 4);
});

test('real damage tours Celebrity once; blocked hits and failed routes grant no Hands', () => {
  const celebrity = unit('the-local-celebrity'), victim = unit('the-rapper', 'player', 1, 1), foe = unit('hooper', 'cpu', 1, 2);
  const before = add(blank(), celebrity, victim, foe);
  let m = musicDamage(before, t.hit(before, foe, victim, -1), foe, victim, t); assert.equal(find(m, celebrity.instanceId).lane, 1); assert.equal(find(m, celebrity.instanceId).powerModifier, 1);
  victim.statuses.protected = true; const protectedBefore = add(blank(), celebrity, victim, foe);
  m = musicDamage(protectedBefore, t.hit(protectedBefore, foe, victim, -1), foe, victim, t); assert.equal(find(m, celebrity.instanceId).lane, 0); assert.equal(find(m, celebrity.instanceId).powerModifier, 0);
});

test('public marks hide permanent ledgers and replay JSON preserves all operational progress', () => {
  const trainer = unit('personal-trainer'), athlete = unit('fitness-bro', 'player', 0, 1);
  let m = cast(add(blank(), trainer, athlete), trainer); m = JSON.parse(JSON.stringify(m));
  const labels = musicDistrictMarks(m); assert.equal(labels.some(x => /ledger|mi-/.test(x.text)), false);
  assert.equal(labels.some(x => /Circuit Training/.test(x.text)), true);
  const before = m; m = musicMoved(before, t.move(m, athlete, 1), athlete.instanceId, t); assert.equal(find(m, athlete.instanceId).powerModifier, 3);
});
