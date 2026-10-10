import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { cards, cardCatalog } from './data';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, playTurnCard, nextRound,
  type Match, type Owner, type Lane, type CardInstance } from './gameEngine';
import { createOnlineRoom, joinOnlineRoom, onlineRoomView, applyOnlineCommand, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { TRIPLE_OG_LANE } from '../../../lib/squabblemon-engine/src/tripleOgs';
import { pairFixture, assertState } from '../../../scripts/src/fullBalanceInteractions';

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const ids = cardCatalog.filter(c => c.kind !== 'token' && !c.hazard).map(c => c.engineId).sort();
const reports = process.env.FULL_BALANCE_AUTHORITY_REPORT;
const record = (name: string, data: unknown) => {
  if (reports) { mkdirSync(reports, { recursive: true }); writeFileSync(path.join(reports, name), JSON.stringify(data, null, 2) + '\n'); }
};
const find = (match: Match, id: string) => match.boards.flat().find(card => card.instanceId === id);
function cast(match: Match, cardId: string, owner: Owner, lane: Lane = 0) {
  const source = createCardInstance(cardId, owner, 'authority-chain', match.nextEventSequence);
  const after = playTurnCard({ ...match, phase: owner === 'player' ? 'player' : 'cpu-reveal', playerMotion: 9, cpuMotion: 9,
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] }, owner, source.instanceId, lane);
  return { source, after };
}

test('every playable card preserves immutable deterministic play/round state under adverse states at base level and both PvP seats', () => {
  const failures: unknown[] = []; let cases = 0;
  for (const id of ids) for (const owner of ['player', 'cpu'] as const) for (const tier of [0]) {
    for (const variant of ['silenced', 'frozen', 'weakened', 'defended', 'movement-lock', 'burn'] as const) {
      cases++;
      const match = pairFixture(id, 'og', false, tier, owner);
      const source = owner === 'player' ? match.playerHand[0] : match.cpuHand[0];
      const lane = (TRIPLE_OG_LANE[id] ?? 0) as Lane;
      const target = match.boards[lane][0];
      if (variant === 'silenced' || variant === 'frozen' || variant === 'weakened') source.statuses = { ...source.statuses, [variant]: true };
      if (variant === 'burn') source.statuses = {...source.statuses,burnStacks:3};
      if (variant === 'defended') {
        target.statuses = { ...target.statuses, protected: true, uncounterable: true };
        match.timedEffects = [{ id: 'authority-covered', kind: 'church-protection', sourceInstanceId: target.instanceId,
          targetInstanceId: target.instanceId, owner: target.owner, lane, startsAtRound: 2, expiresAtRound: 5, expiration: 'round-start' }];
      }
      if (variant === 'movement-lock') source.statuses = { ...source.statuses, locked: true };
      const before = json(match), context = `${id}/${owner}/tier${tier}/${variant}`;
      try {
        const after = playTurnCard(match, owner, source.instanceId, lane);
        assert.deepEqual(match, before, `${context}: play mutated input`);
        assert.deepEqual(json(after), json(playTurnCard(json(before), owner, source.instanceId, lane)), `${context}: play serialization diverged`);
        assertState(after, context);
        const endInput: Match = { ...after, phase: 'resolved' };
        const endBefore = json(endInput), ended = nextRound(endInput);
        assert.deepEqual(json(endInput), endBefore, `${context}: round resolution mutated input`);
        assert.deepEqual(json(ended), json(nextRound(json(endBefore))), `${context}: round serialization diverged`);
        assertState(ended, `${context}/round`);
      } catch (error) { failures.push({ id, owner, tier, variant, message: error instanceof Error ? error.message : String(error) }); }
    }
  }
  record('adverse-state-results.json', { rosterCount: ids.length, cases, coveredCards: ids, failures });
  assert.deepEqual(failures, []);
});

test('all catalog cards project safely for either online participant after a real authoritative play', () => {
  const crew = ['cornball', 'snow', 'roaster', 'rastamon', 'wifey', 'oink', 'baby', 'buspass', 'soulfood', 'cognac'];
  let base = createOnlineRoom({ userId: 'authority-host', name: 'host', ready: false, deck: { id: 'authority', name: 'Authority', hero: 'cornball', cards: crew } }, 'player', 0);
  base = joinOnlineRoom(base, { userId: 'authority-guest', name: 'guest', ready: false, deck: { id: 'authority', name: 'Authority', hero: 'cornball', cards: crew } }, 1);
  let cases = 0;
  for (const id of ids) for (const owner of ['player', 'cpu'] as const) {
    const match = pairFixture(id, 'og', false, 0, owner), lane = (TRIPLE_OG_LANE[id] ?? 0) as Lane;
    const source = owner === 'player' ? match.playerHand[0] : match.cpuHand[0];
    const rival = owner === 'player' ? 'cpu' : 'player';
    const secret = createCardInstance('cornball', rival, `private-hand-${id}`, 99);
    match[rival === 'player' ? 'playerHand' : 'cpuHand'] = [secret];
    const room: OnlineRoom = { ...base, match, status: 'active', activeSeat: owner, deadline: 500000, turnsEnded: 0 };
    const before = json(room);
    const after = applyOnlineCommand(room, owner, { type: 'play', instanceId: source.instanceId, lane, squabble: false }, 10);
    assert.deepEqual(json(room), before, `${id}: online command mutated room`);
    assert.deepEqual(json(after), json(applyOnlineCommand(json(before), owner, { type: 'play', instanceId: source.instanceId, lane, squabble: false }, 10)), `${id}: serialized authority diverged`);
    const ownUser = owner === 'player' ? 'authority-host' : 'authority-guest';
    const otherUser = owner === 'player' ? 'authority-guest' : 'authority-host';
    const publicView = onlineRoomView(after, 'FULL', ownUser, 10), rivalView = onlineRoomView(after, 'FULL', otherUser, 10);
    assert(!JSON.stringify(publicView).includes(secret.instanceId), `${id}/${owner}: rival hand instance leaked`);
    for (const key of ['abilityUpgradeSnapshot', 'playerHand', 'cpuHand', 'replay', 'playerCardIds', 'cpuCardIds'])
      assert(!JSON.stringify(publicView).includes(`"${key}"`), `${id}: private engine key leaked: ${key}`);
    assert.deepEqual(publicView.boards, rivalView.boards);
    assert.deepEqual(publicView.scores, rivalView.scores);
    assert.deepEqual(publicView.events, rivalView.events);
    cases++;
  }
  record('online-projection-results.json', { rosterCount: ids.length, cases, coveredCards: ids });
});

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: Oz skips a non-repeatable creative contract without spending its charge`, () => {
    let match: Match = { ...createMatch('block', 'block'), round: 3, boards: [[], [], []], playerHand: [], cpuHand: [], playerMotion: 9, cpuMotion: 9 };
    const stylist = cast(match, 'hair-stylist', owner);
    const ally: CardInstance = { ...createCardInstance('og', owner, 'authority-ally', 2), lane: 0, playedRound: 2 };
    match = { ...stylist.after, boards: [[...stylist.after.boards[0], ally], [], []] };
    const echoed = cast(match, 'oz', owner);
    assert.equal(find(echoed.after, ally.instanceId)?.powerModifier, 0, 'persistent contracts cannot be re-armed');
    assert(!find(echoed.after, echoed.source.instanceId)?.waveOnce?.oz);
  });
}
