import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, decks } from './data';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, playTurnCard, nextRound, replayMatchPrefix, verifyMatchTranscript, pass, revealCpuTurn, getCharacterDistrictMarks, getCharacterMovementLockThroughRound, getLegalCardCost, getMatchWinner, type Match, type Owner, type Lane, type CardInstance, type PlayerMove } from './gameEngine';
import { abilityTookEffect } from './abilityOutcome';
import { STREET_LEGENDS_WAVE } from '../../../lib/squabblemon-engine/src/streetLegendsWave';
import { MUSIC_INDUSTRY_WAVE } from '../../../lib/squabblemon-engine/src/musicIndustryWave';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '../../../lib/squabblemon-engine/src/multiplayer';

const ids = [...STREET_LEGENDS_WAVE, ...MUSIC_INDUSTRY_WAVE].map(row => row[0]);
const json = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, boards: [[], [], []], playerHand: [], cpuHand: [], playerMotion: 9, cpuMotion: 9 });
const unit = (id: string, owner: Owner, lane: Lane, index = 0): CardInstance => ({ ...createCardInstance(id, owner, 'wave-fixture', index), lane, playedRound: 3 });
const find = (m: Match, c: CardInstance) => m.boards.flat().find(x => x.instanceId === c.instanceId);
const kinds = (m: Match) => (m.creativeMarks ?? []).map(x => x.kind);
const end = (m: Match) => nextRound({ ...m, phase: 'resolved' });
function cast(m: Match, id: string, owner: Owner, lane: Lane = 0, patch: Partial<CardInstance> = {}) {
  const source = { ...createCardInstance(id, owner, 'wave-cast', m.nextEventSequence), ...patch };
  const after = playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal', playerMotion: 9, cpuMotion: 9, [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] }, owner, source.instanceId, lane);
  return { after, source };
}
function train(m: Match, id: string, owner: Owner, tier = 3) {
  const level = [1, 2, 5, 8][tier];
  return { ...m, abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(owner === 'player' ? [id] : [], owner === 'cpu' ? [id] : [], { [owner]: { [id]: { level, xp: 2800, moveTier: tier } } }) };
}
const event = (m: Match, c: CardInstance) => m.effectLog.findLast(e => e.type === 'ability' && e.cardInstanceId === c.instanceId && !e.abilityMetadata?.upgradeId)!;

for (const owner of ['player', 'cpu'] as const) {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  for (const id of ids) test(`${owner}: ${id} uses immutable, deterministic, serializable battle rules`, () => {
    const m = blank();
    m.boards = [[unit('cornball', owner, 0), unit('the-rapper', owner, 0), { ...unit('og', enemy, 0), basePower: 12 }], [unit('hooper', owner, 1), unit('baby', enemy, 1)], [unit('fitness-bro', owner, 2), unit('og', enemy, 2, 2)]];
    const before = json(m);
    const a = cast(m, id, owner).after;
    assert.deepEqual(json(m), before);
    assert.deepEqual(json(a), json(cast(json(m), id, owner).after));
    assert.deepEqual(json(end(a)), json(end(json(a))));
    assert.equal(new Set(a.boards.flat().map(c => c.instanceId)).size, a.boards.flat().length);
    for (const lane of a.boards) for (const side of ['player', 'cpu']) assert(lane.filter(c => c.owner === side && !c.hazard).length <= 4);
    const disabled = cast(train(m, id, owner), id, owner, 0, { statuses: { ...createCardInstance(id, owner).statuses, silenced: true } });
    assert(!disabled.after.creativeMarks?.some(x => x.source.instanceId === disabled.source.instanceId));
    assert.equal(find(disabled.after, disabled.source)?.waveTrainingUsed, undefined);
  });

  test(`${owner}: Lash Out pays a local ally and training only after actual damage`, () => {
    const m = train(blank(), 'lash-tech', owner), client = unit('cornball', owner, 0), remote = unit('cornball', owner, 1, 1), victim = { ...unit('og', enemy, 0), basePower: 12 };
    m.boards = [[client, victim], [remote], []];
    const result = cast(m, 'lash-tech', owner);
    assert.equal(find(result.after, victim)?.powerModifier, -1);
    assert.equal(find(result.after, client)?.powerModifier, 2);
    assert.equal(find(result.after, remote)?.powerModifier, 0);
    assert.equal(find(result.after, result.source)?.powerModifier, 3);
    assert(abilityTookEffect(event(result.after, result.source)));
  });
  test(`${owner}: blocked Lash Out does not boost an ally, train, or play a successful special`, () => {
    const m = train(blank(), 'lash-tech', owner), client = unit('cornball', owner, 0), victim = { ...unit('og', enemy, 0), basePower: 12 };
    victim.statuses.protected = true; m.boards[0] = [client, victim];
    m.timedEffects = [{ id: 'lash-shield', kind: 'church-protection', sourceInstanceId: victim.instanceId, targetInstanceId: victim.instanceId, owner: enemy, lane: 0, startsAtRound: 3, expiresAtRound: 5, expiration: 'round-start' }];
    const result = cast(m, 'lash-tech', owner);
    assert.equal(find(result.after, victim)?.powerModifier, 0);
    assert.equal(find(result.after, client)?.powerModifier, 0);
    assert.equal(find(result.after, result.source)?.powerModifier, 0);
    assert.equal(find(result.after, result.source)?.waveTrainingUsed, undefined);
    assert(!abilityTookEffect(event(result.after, result.source)));
  });
  test(`${owner}: Nail Tech's mitigation can fully absorb Lash Tech's hit without paying support`, () => {
    const m = train(blank(), 'lash-tech', owner), client = unit('cornball', owner, 0), victim = { ...unit('og', enemy, 0), basePower: 12 };
    m.boards[0] = [client, victim];
    m.timedEffects = [{ id: 'lash-mitigation', kind: 'nail-mitigation', sourceInstanceId: 'existing-nail', targetInstanceId: victim.instanceId, owner: enemy, lane: 0, startsAtRound: 3, expiresAtRound: 7, expiration: 'match-complete' }];
    const result = cast(m, 'lash-tech', owner);
    assert.equal(find(result.after, victim)?.powerModifier, 0);
    assert.equal(find(result.after, client)?.powerModifier, 0);
    assert.equal(find(result.after, result.source)?.powerModifier, 0);
    assert(!abilityTookEffect(event(result.after, result.source)));
  });
  test(`${owner}: lethal Lash Out earns support while an empty enemy district does not`, () => {
    const m = blank(), client = unit('cornball', owner, 0), victim = { ...unit('cornball', enemy, 0), basePower: 1 };
    m.boards[0] = [client, victim];
    const result = cast(m, 'lash-tech', owner);
    assert(!find(result.after, victim)); assert.equal(find(result.after, client)?.powerModifier, 2);
    const empty = blank(); empty.boards[0] = [client];
    const failed = cast(train(empty, 'lash-tech', owner), 'lash-tech', owner);
    assert.equal(find(failed.after, client)?.powerModifier, 0);
    assert.equal(find(failed.after, failed.source)?.powerModifier, 0);
    assert(!abilityTookEffect(event(failed.after, failed.source)));
  });

  test(`${owner}: Mr Mc Hands applies separate defenses and upgrades only real successes`, () => {
    for (const guarded of [false, true]) {
      const m = train(blank(), 'mr-mc-hands', owner), a = { ...unit('og', enemy, 0), basePower: 12 }, b = { ...unit('hooper', enemy, 0), basePower: 10 };
      a.statuses.protected = true; b.statuses.protected = guarded;
      m.boards[0] = [a, b];
      m.timedEffects = [a, b].filter(c => c.statuses.protected).map(c => ({ id: `shield:${c.instanceId}`, kind: "church-protection", sourceInstanceId: c.instanceId, targetInstanceId: c.instanceId, owner: enemy, lane: 0, startsAtRound: 3, expiresAtRound: 5, expiration: "round-start" }));
      const result = cast(m, 'mr-mc-hands', owner);
      assert.equal(find(result.after, a)?.powerModifier, 0);
      assert.equal(find(result.after, b)?.powerModifier, guarded ? 0 : -2);
      assert.equal(find(result.after, result.source)?.powerModifier, guarded ? 0 : 3);
      assert.equal(abilityTookEffect(event(result.after, result.source)), !guarded);
    }
  });
  test(`${owner}: Side Chick hits only enemy Baby Momma across districts and respects one shield`, () => {
    const friendly = { ...unit('baby', owner, 0), basePower: 8 }, rival = { ...unit('baby', enemy, 2), basePower: 8 };
    const m = blank(); m.boards = [[friendly], [], [rival]];
    const hit = cast(m, 'side-chick', owner).after;
    assert.equal(find(hit, friendly)?.powerModifier, 0);
    assert.equal(find(hit, rival)?.powerModifier, -3); assert(find(hit, rival)?.statuses.weakened);
    rival.statuses.protected = true;
    m.timedEffects = [{ id: "baby-shield", kind: "church-protection", sourceInstanceId: rival.instanceId, targetInstanceId: rival.instanceId, owner: enemy, lane: 2, startsAtRound: 3, expiresAtRound: 5, expiration: "round-start" }];
    const blocked = cast(train(m, 'side-chick', owner), 'side-chick', owner);
    assert.equal(find(blocked.after, rival)?.powerModifier, 0); assert(!find(blocked.after, rival)?.statuses.weakened);
    assert.equal(find(blocked.after, blocked.source)?.powerModifier, 0); assert(!abilityTookEffect(event(blocked.after, blocked.source)));
  });
  test(`${owner}: Name Check withholds a gain without damage or injury`, () => {
    const victim = { ...unit('og', enemy, 0), basePower: 12 }; const m = blank(); m.boards[0] = [victim];
    let after = cast(m, 'pimp-swookie', owner).after;
    assert(find(after, victim)?.statuses.weakened); assert(kinds(after).includes('sl-name-check'));
    after = cast(after, 'nail', enemy).after;
    assert.equal(find(after, victim)?.powerModifier, 0); assert.equal(find(after, victim)?.recoverableDamage ?? 0, 0);
    assert(!kinds(after).includes('sl-name-check')); assert(!after.laneDamage?.length);
  });
  test(`${owner}: Mary no longer copies ally growth; Lunch Bond still pays once`, () => {
    const mary = unit('ms-mary-mack', owner, 0), client = unit('cornball', owner, 0), remote = unit('hooper', owner, 2);
    const m = blank(); m.boards = [[mary, client], [], [remote]];
    const hubby = cast(m, 'work-hubby', owner); const after = cast(hubby.after, 'nail', owner).after;
    assert.equal(find(after, mary)?.powerModifier, 0); assert.equal(find(after, remote)?.powerModifier, 0);
    assert.equal(find(after, hubby.source)?.powerModifier, 1); assert(!kinds(after).includes('sl-lunch'));
    assert(!kinds(after).includes('sl-ledger-rhythm'));
  });
  test(`${owner}: Uncle Sam confiscates bonuses without damage and charges exactly one Audit`, () => {
    const m = blank(), rival = { ...unit('og', enemy, 0), basePower: 12, powerModifier: 4 }; m.boards[0] = [rival];
    const result = cast(m, 'uncle-sam', owner);
    assert.equal(find(result.after, rival)?.powerModifier, 1); assert.equal(find(result.after, rival)?.recoverableDamage ?? 0, 0);
    assert.equal(result.after.laneDamage?.length, 0); assert.equal(find(result.after, result.source)?.powerModifier, 3);
    let audit = cast(blank(), 'uncle-sam', owner).after;
    const guest = createCardInstance('hooper', enemy);
    assert.equal(getLegalCardCost(audit, enemy, guest, 0), guest.cost + 1);
    audit = cast(audit, 'hooper', enemy).after; assert(!kinds(audit).includes('sl-audit'));
    assert.equal(getLegalCardCost(audit, enemy, guest, 0), guest.cost);
  });
  test(`${owner}: routes require real arrival; Curfew blocks movement until Sage cleanses it`, () => {
    const locked = { ...createCardInstance('og-uncle-harley-davidson', owner).statuses, locked: true };
    const failed = cast(train(blank(), 'og-uncle-harley-davidson', owner), 'og-uncle-harley-davidson', owner, 0, { statuses: locked });
    assert.equal(find(failed.after, failed.source)?.lane, 0); assert.equal(find(failed.after, failed.source)?.powerModifier, 0);
    const m = blank(), client = { ...unit('hooper', owner, 0), basePower: 8 }; m.boards[0] = [client];
    let after = cast(m, 'parole-officer', enemy).after;
    assert.equal(getCharacterMovementLockThroughRound(after, find(after, client)!), 4);
    after = cast(after, 'apartment-maintenance-sage', owner).after;
    assert.equal(find(after, client)?.lane, 1); assert(find(after, client)?.statuses.protected);
    assert.equal(getCharacterMovementLockThroughRound(after, find(after, client)!), undefined);
  });
  test(`${owner}: Boo Boo's public trap resolves once and escapes only after damage`, () => {
    const result = cast(blank(), 'boo-boo-the-fool', owner), source = result.source;
    let m = cast(result.after, 'hooper', enemy).after;
    assert.equal(m.boards[0].find(c => c.cardId === 'hooper')?.powerModifier, -1);
    assert.equal(find(m, source)?.lane, 1); assert.equal(find(m, source)?.powerModifier, 1); assert(!kinds(m).includes('sl-decoy'));
    m = cast(m, 'hooper', enemy).after;
    assert.equal(find(m, source)?.powerModifier, 1);
  });
  test(`${owner}: Bail redirects once and pays for a real Poison entrance`, () => {
    const m = blank(), client = { ...unit('hooper', owner, 0), basePower: 12 }; m.boards[0] = [client];
    const auntie = cast(m, 'bail-bonds-auntie', owner, 0, { basePower: 8 });
    let after = cast(auntie.after, 'side-chick', enemy).after;
    assert.equal(find(after, client)?.powerModifier, 0); assert.equal(find(after, auntie.source)?.powerModifier, -1);
    assert(kinds(after).includes('sl-bail-credit')); assert(!kinds(after).includes('sl-bail'));
    const target = { ...unit('og', enemy, 1), basePower: 12 }; after.boards[1].push(target);
    const paid = cast(after, 'pimp-swookie', owner, 1).after;
    assert.equal(owner === 'player' ? paid.playerMotion : paid.cpuMotion, 7); assert(!kinds(paid).includes('sl-bail-credit'));
  });
  test(`${owner}: Evil Manager's expiry transfers bonuses without injury or counter triggers`, () => {
    const m = blank(), client = unit('the-rapper', owner, 0), medic = unit('bonnetgirl', owner, 0); m.boards[0] = [client, medic];
    const result = cast(m, 'the-manager-evil', owner); let after = result.after;
    assert.equal(find(after, client)?.powerModifier, 3); assert.equal(getCharacterMovementLockThroughRound(after, find(after, client)!), 4);
    after = end(end(after));
    assert.equal(find(after, client)?.powerModifier, 1); assert.equal(find(after, result.source)?.powerModifier, 2);
    assert.equal(find(after, client)?.recoverableDamage ?? 0, 0); assert.equal(find(after, medic)?.powerModifier, 0);
    assert(!after.laneDamage?.length); assert(!kinds(after).includes('mi-contract'));
  });
  test(`${owner}: Diss receipt reacts to a genuine gain and never replays`, () => {
    const m = blank(), rival = { ...unit('og', enemy, 0), basePower: 12, powerModifier: 3 }; m.boards[0] = [rival];
    let after = cast(m, 'the-battle-rapper', owner).after; assert.equal(find(after, rival)?.powerModifier, 1);
    assert.equal(find(after, rival)?.recoverableDamage ?? 0, 0);
    after = cast(after, 'nail', enemy).after;
    assert.equal(find(after, rival)?.powerModifier, 3); assert(find(after, rival)?.statuses.silenced); assert(!kinds(after).includes('mi-diss'));
  });
  test(`${owner}: Soundcheck, Rider and Rapper react to actual entrances`, () => {
    let m = cast(blank(), 'the-opening-act', owner).after;
    const rapper = unit('the-rapper', owner, 0); m.boards[0].push(rapper);
    const performer = cast(m, 'the-manager-nice', owner, 1);
    assert.equal(owner === 'player' ? performer.after.playerMotion : performer.after.cpuMotion, 8);
    assert.equal(find(performer.after, performer.source)?.powerModifier, 1); assert(!kinds(performer.after).includes('mi-soundcheck'));
    const response = cast(performer.after, 'the-hype-man', owner, 2);
    assert(find(response.after, response.source)?.statuses.protected); assert(!kinds(response.after).includes('mi-rider'));
    assert(getCharacterDistrictMarks(response.after).every(x => !x.text.includes('ledger')));
  });
  test(`${owner}: Personal Trainer completes three distinct districts, not a bounce`, () => {
    const m = blank(), client = unit('cornball', owner, 0); m.boards[0] = [client];
    let after = cast(m, 'personal-trainer', owner).after;
    after = cast(after, 'apartment-maintenance-sage', owner).after;
    assert.equal(find(after, client)?.lane, 1); assert.equal(find(after, client)?.powerModifier, 2);
    after = cast(after, 'apartment-maintenance-sage', owner, 1).after;
    assert.equal(find(after, client)?.lane, 2); assert.equal(find(after, client)?.powerModifier, 4);
    assert(find(after, client)?.statuses.protected); assert(!kinds(after).includes('mi-circuit'));
  });
  test(`${owner}: Fitness Girl restores only real injury after movement`, () => {
    const m = blank(), client = { ...unit('hooper', owner, 1), basePower: 12 }; m.boards[1] = [client]; m.boards[2] = [{ ...unit('og', owner, 2), basePower: 30 }];
    let after = cast(m, 'side-chick', enemy, 1).after;
    assert.equal(find(after, client)?.recoverableDamage, 1);
    const girl = cast(after, 'fitness-girl', owner);
    assert.equal(find(girl.after, girl.source)?.lane, 1); assert.equal(find(girl.after, client)?.recoverableDamage, 0);
    assert.equal(find(girl.after, client)?.powerModifier, 0);
  });
  test(`${owner}: Fitness Bro and Demon Trainer have bounded actual triggers`, () => {
    let m = blank(), bro = unit('fitness-bro', owner, 0); m.boards[0] = [bro];
    m = cast(m, 'cornball', owner, 1).after; m = end(m); assert.equal(find(m, bro)?.powerModifier, 2);
    const demon = unit('demon-trainer', owner, 0), victim = { ...unit('fitness-bro', owner, 1), basePower: 1 }; m = blank(); m.boards = [[demon], [victim], []];
    m = cast(m, 'mr-mc-hands', enemy, 1).after;
    assert(!find(m, victim)); assert.equal(find(m, demon)?.powerModifier, 2);
    assert.equal(m.creativeMarks?.find(x => x.kind === 'mi-ledger-demon')?.amount, 1);
  });
}

test('both new complete starter crews reproduce exact replay decision states', () => {
  let m = createMatch('music-industry', 'fitness-circuit'); const initial = json(m); const moves: PlayerMove[] = [];
  while (m.phase !== 'complete') {
    const options = m.playerHand.flatMap(c => ([0,1,2] as Lane[]).filter(l => getLegalCardCost(m, 'player', c, l) <= m.playerMotion && m.boards[l].filter(x => x.owner === 'player' && !x.hazard).length < 4).map(l => ({ c, l })));
    const choice = options[0];
    if (choice) { moves.push({ cardInstanceId: choice.c.instanceId, lane: choice.l, squabble: false, endTurn: false }); m = playTurnCard(m, 'player', choice.c.instanceId, choice.l); }
    else { moves.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true }); m = nextRound(revealCpuTurn(pass(m, 'player'))); }
    assert(moves.length < 64);
  }
  assert.deepEqual(json(replayMatchPrefix(initial, moves)), json(m));
  const verified = verifyMatchTranscript('music-industry', 'fitness-circuit', moves);
  assert.equal(getMatchWinner(verified), getMatchWinner(m));
});

for (const owner of ['player', 'cpu'] as const) test(`${owner}: all wave cards resolve identically online and expose their public marks`, () => {
  const member = (userId: string, id: string) => { const d = decks.find(d => d.id === id)!; return {userId,name:userId,ready:false,deck:{...d,cards:[...d.cards]}}; };
  let room = joinOnlineRoom(createOnlineRoom(member('a','music-industry'),'player',0),member('b','fitness-circuit'),0);
  room = applyOnlineCommand(room,'player',{type:'ready'},1); room = applyOnlineCommand(room,'cpu',{type:'ready'},2);
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  for (const id of ids) {
    const state=blank();state.boards=[[unit('the-rapper',owner,0),{...unit('og',enemy,0),basePower:12}],[],[]];
    const source=createCardInstance(id,owner,'online-wave',0);
    const initial={...state,phase:owner==='player'?'player' as const:'cpu-reveal' as const,[owner==='player'?'playerHand':'cpuHand']:[source]};
    const expected=playTurnCard(json(initial),owner,source.instanceId,0);
    const played=applyOnlineCommand({...room,match:initial,activeSeat:owner,turnsEnded:0},owner,{type:'play',instanceId:source.instanceId,lane:0,squabble:false},10);
    assert.deepEqual(json(played.match!.boards),json(expected.boards),id);
    assert.deepEqual(json(played.match!.creativeMarks??[]),json(expected.creativeMarks??[]),id);
    const view=onlineRoomView(json(played),'WAVE',owner==='player'?'a':'b',11);
    assert(view.boards.flat().some(c=>c.cardId===id),`${id} has its canonical art identity online`);
    assert(!JSON.stringify(view).includes('mi-ledger-')&&!JSON.stringify(view).includes('sl-ledger-'),'permanent caps remain private implementation state');
  }
});

test('every Street Legends training tier pays once only after a real success',()=>{
  for(const tier of [0,1,2,3]) {
    const m=train(blank(),'mr-mc-hands','player',tier); const target={...unit('og','cpu',0),basePower:12};m.boards[0]=[target];
    const result=cast(m,'mr-mc-hands','player');assert.equal(find(result.after,result.source)?.powerModifier,tier);
    const round=end(result.after);assert.equal(find(round,result.source)?.powerModifier,tier);
    assert.equal(round.effectLog.filter(e=>e.abilityMetadata?.sourceInstanceId===result.source.instanceId).length,tier);
  }
});
