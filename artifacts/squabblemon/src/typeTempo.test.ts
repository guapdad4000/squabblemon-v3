import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from './data';
import {
  createCardInstance, createMatch, getLegalCardCost, nextRound, playCard,
  type CardInstance, type Lane, type Match, type Owner,
} from './gameEngine';

const unit = (id: string, owner: Owner, index: number, lane: Lane = 0): CardInstance =>
  ({ ...createCardInstance(id, owner, 'type-tempo', index), lane });
const find = (match: Match, instance: CardInstance) =>
  match.boards.flat().find(card => card.instanceId === instance.instanceId)!;
const opponent = (owner: Owner): Owner => owner === 'player' ? 'cpu' : 'player';
const motionKey = (owner: Owner) => owner === 'player' ? 'playerMotion' : 'cpuMotion';
const handKey = (owner: Owner) => owner === 'player' ? 'playerHand' : 'cpuHand';
const phase = (owner: Owner) => owner === 'player' ? 'player' as const : 'cpu-reveal' as const;
const blank = (): Match => ({
  ...createMatch('block', 'combo'), playerMotion: 9, cpuMotion: 9,
  playerHand: [], cpuHand: [], boards: [[], [], []],
});
function cast(match: Match, source: CardInstance, owner: Owner, lane: Lane = 0): Match {
  return playCard({
    ...match, phase: phase(owner),
    [handKey(owner)]: [source],
  }, owner, source.instanceId, lane);
}

for (const owner of ['player', 'cpu'] as const) {
  test(`Alchy starts at round 4, scales with district deficit, and obeys suppression: ${owner}`, () => {
    for (const round of [3, 4]) for (const losing of [false, true]) {
      for (const status of ['active', 'silenced', 'frozen', 'weakened'] as const) {
        const alchy = unit('alchy', owner, 1);
        if (status !== 'active') alchy.statuses[status] = true;
        const foe = unit('hooper', opponent(owner), 2);
        foe.powerModifier = 10;
        const match: Match = {
          ...blank(), round, phase: 'resolved',
          boards: [[alchy, ...(losing ? [foe] : [])], [], []],
        };
        const result = nextRound(match);
        const expected = round === 4 && status === 'active' ? (losing ? 2 : 1) : 0;
        assert.equal(find(result, alchy).powerModifier, expected, `${owner} round ${round}, ${losing ? 'losing' : 'winning'}, ${status}`);
      }
    }
    assert.match(cards.alchy.effect, /round 4 or later/);
    assert(cards.alchy.abilityUpgrades.every(upgrade => upgrade.description.includes('round 4 or later')));
  });

  test(`Conductor pays +2 or Water +3 only after a successful move and cleanse: ${owner}`, () => {
    for (const id of ['cornball', 'snow'] as const) {
      const passenger = unit(id, owner, 1);
      passenger.statuses.frozen = true;
      passenger.statuses.silenced = true;
      passenger.statuses.weakened = true;
      const conductor = unit('conductor', owner, 2);
      const match = blank();
      match.boards[0] = [passenger];
      const after = cast(match, conductor, owner);
      const moved = find(after, passenger);
      assert.notEqual(moved.lane, 0);
      assert.equal(moved.powerModifier, id === 'snow' ? 3 : 2);
      assert.equal(moved.statuses.frozen, false);
      assert.equal(moved.statuses.silenced, false);
      assert.equal(moved.statuses.weakened, false);
    }
    for (const reason of ['no passenger', 'locked passenger'] as const) {
      const conductor = unit('conductor', owner, 3);
      const match = blank();
      const passenger = unit('snow', owner, 4);
      passenger.statuses.locked = true;
      passenger.statuses.frozen = true;
      if (reason === 'locked passenger') match.boards[0] = [passenger];
      const after = cast(match, conductor, owner);
      assert.equal(find(after, conductor).powerModifier, 0, reason);
      if (reason === 'locked passenger') {
        assert.equal(find(after, passenger).lane, 0);
        assert.equal(find(after, passenger).powerModifier, 0);
        assert.equal(find(after, passenger).statuses.frozen, true, 'failed movement cannot cleanse');
      }
    }
    assert.match(cards.conductor.effect, /\+2 Hands, or \+3 if it is Water/);
  });

  test(`Wiretap posts one cross-district discount without a solo or crowded refund: ${owner}`, () => {
    for (const crowded of [false, true]) {
      const match = blank();
      if (crowded) match.boards[0] = [unit('snow', owner, 1)];
      const wiretap = unit('wiretap', owner, 2);
      const posted = cast(match, wiretap, owner);
      assert.equal(posted[motionKey(owner)], 7, 'only the printed 2 Motion was paid');
      assert.equal(posted.discountTokens.length, 1);
      assert.equal(posted.discountTokens[0].eligibility, 'another-district');
      assert.match(posted.effectLog.find(event => event.cardId === 'wiretap' && event.type === 'ability')?.note ?? '',
        /next card in another district costs 1 less Motion/);

      const local = createCardInstance('cornball', owner, 'type-tempo-local', 3);
      assert.equal(getLegalCardCost(posted, owner, local, 0), 1);
      const localPlayed = cast(posted, local, owner);
      assert.equal(localPlayed.discountTokens.length, 1, 'same-district play does not consume the discount');
      const remote = createCardInstance('cornball', owner, 'type-tempo-remote', 4);
      assert.equal(getLegalCardCost(localPlayed, owner, remote, 1), 0, 'zero-cost minimum is unchanged');
      const remotePlayed = cast(localPlayed, remote, owner, 1);
      assert.equal(remotePlayed.discountTokens.length, 0, 'one cross-district use consumes the token');
      const next = createCardInstance('cornball', owner, 'type-tempo-next', 5);
      assert.equal(getLegalCardCost(remotePlayed, owner, next, 2), 1, 'discount cannot be used twice');
    }
    assert.doesNotMatch(cards.wiretap.effect, /restore 1 Motion/);
  });
}