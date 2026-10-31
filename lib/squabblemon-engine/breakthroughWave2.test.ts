import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  advance,
  advancePractice,
  chooseAi,
  createGame,
  deploy,
  deploymentCost,
  effectiveHands,
  type GameState,
  type Lane,
  type Side,
  type TimedStatus,
  type Unit,
} from './src/breakthrough';
import { BREAKTHROUGH_ROSTER } from './src/breakthroughCatalog';
const originalRoster = BREAKTHROUGH_ROSTER.slice(0, 20),
  wave2Roster = BREAKTHROUGH_ROSTER.slice(20, 40);

const allCards = [...originalRoster, ...wave2Roster];
const seats = ['player', 'opponent'] as const;
const other = (side: Side): Side => (side === 'player' ? 'opponent' : 'player');
const at = (side: Side, progress: number) =>
  side === 'player' ? progress : 1 - progress;
let identity = 0;
function unit(
  cardId: string,
  side: Side,
  lane: Lane = 0,
  progress = 0.5,
  hands?: number,
): Unit {
  const card = allCards.find((c) => c.id === cardId)!;
  return {
    id: `probe-${++identity}`,
    cardId,
    side,
    lane,
    position: at(side, progress),
    hands: hands ?? card.hands,
    baseHands: card.hands,
    maxHands: hands ?? card.hands,
    squabbled: false,
    deployedAt: 0,
    arrivalOrder: identity,
    nextEffectAt: 999999,
  };
}
function fresh(units: Unit[] = []): GameState {
  const deck = wave2Roster.slice(0, 10).map((c) => c.id);
  const s = createGame(allCards, {
    seed: 41,
    travelMs: 1e9,
    decks: { player: deck, opponent: deck },
  });
  s.units = units;
  for (const side of seats) {
    s.players[side].hand = [];
    s.players[side].queue = [];
    s.players[side].handAuraAt = {};
  }
  return s;
}
function play(
  s: GameState,
  id: string,
  side: Side = 'player',
  lane: Lane = 0,
): GameState {
  s.players[side].hand = [id];
  s.players[side].motion = 9;
  const result = deploy(s, side, id, lane);
  assert.equal(result.error, undefined, `${id} must deploy`);
  return result.state;
}
const find = (s: GameState, u: Unit) => s.units.find((v) => v.id === u.id)!;
const entrant = (s: GameState, id: string, side: Side) =>
  s.units.filter((u) => u.cardId === id && u.side === side).at(-1)!;
function status(
  s: GameState,
  target: Unit,
  kind: TimedStatus['kind'],
  stacks = 1,
): void {
  s.statuses.push({
    id: s.nextEffectId++,
    kind,
    targetId: target.id,
    sourceUnitId: 'control-source',
    sourceSide: other(target.side),
    sourceLane: target.lane,
    sourcePosition: at(target.side, 0.9),
    appliedAt: s.elapsedMs,
    nextTickAt: s.elapsedMs + 2000,
    expiresAt: s.elapsedMs + 10000,
    stacks,
  });
  Object.assign(
    target,
    kind === 'burn'
      ? { burnStacks: stacks }
      : {
          [kind === 'freeze'
            ? 'frozen'
            : kind === 'silence'
              ? 'silenced'
              : 'weakened']: true,
        },
  );
}

test('Cornball burns every enemy here independently, respecting defenses without damaging another lane', () => {
  for (const side of seats) {
    const one = unit('edgar', other(side), 0, 0.2, 8),
      two = unit('nguyen', other(side), 0, 0.3, 7);
    const shield = { ...unit('dr-fade', other(side), 0, 0.1), protected: true };
    const immune = { ...unit('man-man', other(side), 0, 0.05), immune: true };
    const remote = unit('edgar', other(side), 1, 0.2);
    const s = play(fresh([one, two, shield, immune, remote]), 'cornball', side);
    assert.deepEqual(
      s.statuses.map((x) => x.targetId).sort(),
      [one.id, two.id].sort(),
    );
    assert.ok(s.statuses.every((x) => x.kind === 'burn' && x.stacks === 1));
    assert.equal(find(s, one).hands, 8);
    assert.equal(find(s, two).hands, 7);
    assert.equal(find(s, shield).protected, false);
    assert.equal(find(s, immune).immune, true);
    assert.equal(s.metrics[side].damage, 0);
    const next = advance(s, 2000);
    assert.equal(find(next, one).hands, 7);
    assert.equal(find(next, two).hands, 6);
    assert.equal(find(next, remote).hands, remote.hands);
  }
});

test('Rastamon favors an afflicted local ally, clears only Freeze/Silence, and otherwise buffs the weakest local ally', () => {
  for (const side of seats) {
    const sick = unit('man-man', side, 0, 0.4, 8),
      weak = unit('edgar', side, 0, 0.2, 1),
      remote = unit('nguyen', side, 1, 0.2, 1);
    let s = fresh([sick, weak, remote]);
    for (const kind of ['freeze', 'silence', 'burn', 'weaken'] as const)
      status(s, sick, kind);
    s = play(s, 'rastamon', side);
    assert.equal(find(s, sick).hands, 10);
    assert.equal(find(s, weak).hands, 1);
    assert.equal(find(s, sick).frozen, false);
    assert.equal(find(s, sick).silenced, false);
    assert.deepEqual(s.statuses.map((x) => x.kind).sort(), ['burn', 'weaken']);
    const healthy = play(fresh([weak, remote]), 'rastamon', side);
    assert.equal(find(healthy, weak).hands, 2);
    assert.equal(find(healthy, remote).hands, 1);
    assert.equal(
      entrant(play(fresh(), 'rastamon', side), 'rastamon', side).hands,
      2,
    );
  }
});

test('Edgar requires another cheap local fighter; neither himself, an enemy, nor a remote ally qualifies', () => {
  for (const side of seats) {
    const yes = play(fresh([unit('cornball', side)]), 'edgar', side);
    assert.equal(entrant(yes, 'edgar', side).hands, 4);
    for (const allies of [
      [],
      [unit('dr-fade', side)],
      [unit('cornball', side, 1)],
      [unit('cornball', other(side))],
    ]) {
      const no = play(fresh(allies), 'edgar', side);
      assert.equal(entrant(no, 'edgar', side).hands, 2);
    }
  }
});

test('Nguyen checks a friendly other lane while Man-Man requires two other local fighters', () => {
  for (const side of seats) {
    assert.equal(
      entrant(
        play(fresh([unit('edgar', side, 1)]), 'nguyen', side),
        'nguyen',
        side,
      ).hands,
      3,
    );
    assert.equal(
      entrant(
        play(fresh([unit('edgar', side)]), 'nguyen', side),
        'nguyen',
        side,
      ).hands,
      2,
    );
    assert.equal(
      entrant(
        play(fresh([unit('edgar', other(side), 1)]), 'nguyen', side),
        'nguyen',
        side,
      ).hands,
      2,
    );
    assert.equal(
      entrant(
        play(
          fresh([unit('edgar', side), unit('nguyen', side)]),
          'man-man',
          side,
        ),
        'man-man',
        side,
      ).hands,
      6,
    );
    assert.equal(
      entrant(
        play(
          fresh([unit('edgar', side), unit('nguyen', side, 1)]),
          'man-man',
          side,
        ),
        'man-man',
        side,
      ).hands,
      3,
    );
  }
});

test('OG Uncle compares complete board counts including himself and only hits the weakest local enemy at a three-card deficit', () => {
  for (const side of seats) {
    const strong = unit('dr-fade', other(side), 0, 0.8, 8),
      weak = unit('edgar', other(side), 0, 0.7, 2);
    const remote = [
      unit('nguyen', other(side), 1),
      unit('man-man', other(side), 2),
    ];
    const yes = play(fresh([strong, weak, ...remote]), 'og-uncle', side);
    assert.equal(entrant(yes, 'og-uncle', side).hands, 7);
    assert.equal(find(yes, weak).hands, 1);
    assert.equal(find(yes, strong).hands, 8);
    const smallerDeficit = play(fresh([strong, weak]), 'og-uncle', side);
    assert.equal(entrant(smallerDeficit, 'og-uncle', side).hands, 7);
    assert.equal(find(smallerDeficit, weak).hands, 2);
    const tied = play(fresh([strong]), 'og-uncle', side);
    assert.equal(entrant(tied, 'og-uncle', side).hands, 4);
    const blocked = play(
      fresh([strong, { ...weak, protected: true }, ...remote]),
      'og-uncle',
      side,
    );
    assert.equal(find(blocked, weak).hands, 2);
    assert.equal(entrant(blocked, 'og-uncle', side).hands, 7);
  }
});

test('Young Bull always gains one, burns only the strongest local enemy, and gets the Fire versus Plant stack', () => {
  for (const side of seats) {
    const plant = unit('rastamon', other(side), 0, 0.8, 9),
      weak = unit('edgar', other(side), 0, 0.7, 2);
    const s = play(fresh([plant, weak]), 'young-bull', side);
    assert.equal(entrant(s, 'young-bull', side).hands, 5);
    assert.equal(s.statuses.length, 1);
    assert.equal(s.statuses[0].targetId, plant.id);
    assert.equal(s.statuses[0].stacks, 2);
    assert.equal(find(s, plant).hands, 9);
    assert.equal(find(s, weak).hands, 2);
    const blocked = play(
      fresh([{ ...plant, protected: true }]),
      'young-bull',
      side,
    );
    assert.equal(blocked.statuses.length, 0);
    assert.equal(entrant(blocked, 'young-bull', side).hands, 5);
    assert.equal(
      entrant(play(fresh(), 'young-bull', side), 'young-bull', side).hands,
      5,
    );
  }
});

test('Bikelife moves to the weakest legal other lane and earns the bonus only for an actual arrival', () => {
  for (const side of seats) {
    const s = play(fresh([unit('dr-fade', side, 0)]), 'bikelife-yn', side, 1);
    const bike = entrant(s, 'bikelife-yn', side);
    assert.equal(bike.lane, 2);
    assert.equal(bike.hands, 5);
    assert.equal(bike.position, at(side, 0));
    const blockers = ([0, 2] as Lane[]).map((lane) =>
      unit('edgar', other(side), lane, 0.9),
    );
    const blocked = play(fresh(blockers), 'bikelife-yn', side, 1),
      stayed = entrant(blocked, 'bikelife-yn', side);
    assert.equal(stayed.lane, 1);
    assert.equal(stayed.hands, 4);
  }
});

test('Inside Man reacts to Bikelife paid deployment lane after Ride Out, never to an unrelated destination deployment', () => {
  for (const side of seats) {
    const originSpy = unit('undercova-brotha', other(side), 1, 0.2);
    const s = play(fresh([originSpy]), 'bikelife-yn', side, 1),
      bike = entrant(s, 'bikelife-yn', side);
    assert.equal(bike.lane, 0);
    assert.equal(bike.position, at(side, 0));
    assert.equal(bike.hands, 2); // Ride Out +1, then confiscate that bonus and take two actual damage.
    assert.equal(find(s, originSpy).hands, 6);
    assert.equal(s.players[other(side)].insideManPayouts, 1);
    assert.equal(s.metrics[other(side)].confiscated, 1);
    assert.equal(s.metrics[other(side)].damage, 2);
    const hit = s.events.find((e) => e.type === 'damage')!;
    assert.equal(hit.sourceUnitId, originSpy.id);
    assert.equal(hit.sourceLane, 1);
    assert.equal(hit.targetUnitId, bike.id);
    assert.equal(hit.lane, 0);

    const destinationSpy = unit('undercova-brotha', other(side), 0, 0.2);
    const unrelated = play(fresh([destinationSpy]), 'bikelife-yn', side, 1);
    assert.equal(entrant(unrelated, 'bikelife-yn', side).lane, 0);
    assert.equal(entrant(unrelated, 'bikelife-yn', side).hands, 5);
    assert.equal(find(unrelated, destinationSpy).hands, 3);
    assert.equal(unrelated.players[other(side)].insideManPayouts ?? 0, 0);
    assert.equal(unrelated.metrics[other(side)].damage, 0);
  }
});

test('Wifey can block the origin Inside Man package after Bikelife arrives, without false payout, escape, or Hands gain', () => {
  for (const side of seats) {
    const originSpy = unit('undercova-brotha', other(side), 1, 0.2),
      guard = unit('wifey', side, 0, 0.4);
    // Occupy the other candidate lane so Ride Out selects the protected lane.
    const otherLane = unit('john-henry', side, 2, 0.3);
    const s = play(
      fresh([originSpy, guard, otherLane]),
      'bikelife-yn',
      side,
      1,
    );
    const bike = entrant(s, 'bikelife-yn', side);
    assert.equal(bike.lane, 0);
    assert.equal(bike.hands, 5);
    assert.equal(find(s, originSpy).hands, 3);
    assert.equal(find(s, originSpy).lane, 1);
    assert.equal(s.players[other(side)].insideManPayouts ?? 0, 0);
    assert.equal(s.players[other(side)].insideManReadyAt ?? 0, 0);
    assert.equal(s.metrics[other(side)].confiscated, 0);
    assert.equal(s.metrics[other(side)].damage, 0);
    assert.equal(s.players[side].sideEyeReadyAt, 10000);
    assert.equal(
      s.events.find((e) => e.type === 'block')!.sourceUnitId,
      guard.id,
    );
  }
});

test('Cool Vibe pulls the weakest movable remote ally without teleporting its progress or buffing a failed move', () => {
  for (const side of seats) {
    const ally = unit('edgar', side, 1, 0.4, 2),
      frozen = unit('cornball', side, 2, 0.3, 1);
    let state = fresh([ally, frozen]);
    status(state, frozen, 'freeze');
    const s = play(state, 'cool-vibe-yn', side),
      vibe = entrant(s, 'cool-vibe-yn', side);
    assert.equal(find(s, ally).lane, 0);
    assert.equal(find(s, ally).position, ally.position);
    assert.equal(find(s, ally).hands, 3);
    assert.equal(vibe.hands, 4);
    assert.equal(find(s, frozen).lane, 2);
    assert.equal(find(s, frozen).hands, 1);
    const blocked = play(
      fresh([ally, unit('dr-fade', other(side), 0, 0.9)]),
      'cool-vibe-yn',
      side,
    );
    assert.equal(find(blocked, ally).lane, 1);
    assert.equal(find(blocked, ally).hands, 2);
    assert.equal(entrant(blocked, 'cool-vibe-yn', side).hands, 3);
  }
});

test('Water Boy refunds one actual Motion for another local friendly card and cannot count himself', () => {
  for (const side of seats) {
    assert.equal(
      play(fresh([unit('edgar', side)]), 'water-boy', side).players[side]
        .motion,
      9,
    );
    assert.equal(play(fresh(), 'water-boy', side).players[side].motion, 8);
    assert.equal(
      play(fresh([unit('edgar', side, 1)]), 'water-boy', side).players[side]
        .motion,
      8,
    );
    assert.equal(
      play(fresh([unit('edgar', other(side))]), 'water-boy', side).players[side]
        .motion,
      8,
    );
  }
});

test('Dr Fade independently targets the strongest local enemy and weakest remote friend, preserving his coaching when the hit is blocked', () => {
  for (const side of seats) {
    const strong = unit('john-henry', other(side), 0, 0.8, 9),
      weak = unit('edgar', other(side), 0, 0.7, 2);
    const ally = unit('cornball', side, 1, 0.4, 1),
      otherAlly = unit('nguyen', side, 2, 0.4, 4);
    const s = play(fresh([strong, weak, ally, otherAlly]), 'dr-fade', side);
    assert.equal(find(s, strong).hands, 7);
    assert.equal(find(s, weak).hands, 2);
    assert.equal(find(s, ally).hands, 3);
    assert.equal(find(s, otherAlly).hands, 4);
    const blocked = play(
      fresh([{ ...strong, protected: true }, ally]),
      'dr-fade',
      side,
    );
    assert.equal(find(blocked, strong).hands, 9);
    assert.equal(find(blocked, ally).hands, 3);
  }
});

test('Officer Oink applies ten-second Weaken only here without stealing Hands or stopping marching', () => {
  for (const side of seats) {
    const buddy = unit('buddy', other(side), 0, 0.2, 6),
      guard = { ...unit('edgar', other(side), 0, 0.05), protected: true };
    const immune = { ...unit('nguyen', other(side), 0, 0.1), immune: true },
      remote = unit('man-man', other(side), 1);
    let s = play(fresh([buddy, guard, immune, remote]), 'officer-oink', side);
    assert.equal(entrant(s, 'officer-oink', side).hands, 5);
    assert.equal(s.statuses.length, 1);
    assert.equal(s.statuses[0].targetId, buddy.id);
    assert.equal(s.statuses[0].kind, 'weaken');
    assert.equal(s.statuses[0].expiresAt, 10000);
    assert.equal(find(s, buddy).hands, 6);
    assert.equal(effectiveHands(find(s, buddy)), 6);
    assert.equal(deploymentCost(s, other(side), 'edgar', 0), 2);
    const start = find(s, buddy).position;
    s = advance(s, 1000);
    assert.ok(
      (find(s, buddy).position - start) * (other(side) === 'player' ? 1 : -1) >
        0,
    );
    assert.equal(find(s, buddy).hands, 6);
    assert.equal(find(s, remote).hands, remote.hands);
    s = advance(s, 9000);
    assert.ok(!s.statuses.some((x) => x.kind === 'weaken'));
    assert.equal(deploymentCost(s, other(side), 'edgar', 0), 1);
  }
});

test('FOLKS applies global Burn with four stacks against Plant, buffs only other friendly Fire, and cannot have four stacks reduced by Roaster', () => {
  for (const side of seats) {
    const plant = unit('rastamon', other(side), 1, 0.2, 20),
      normal = unit('edgar', other(side), 0, 0.2, 20);
    const shield = { ...unit('nguyen', other(side), 2, 0.2), protected: true };
    const fire = unit('young-bull', side, 2),
      plain = unit('edgar', side, 1);
    let s = play(fresh([plant, normal, shield, fire, plain]), 'folks', side);
    assert.equal(s.statuses.find((x) => x.targetId === plant.id)!.stacks, 4);
    assert.equal(s.statuses.find((x) => x.targetId === normal.id)!.stacks, 3);
    assert.ok(!s.statuses.some((x) => x.targetId === shield.id));
    assert.equal(find(s, fire).hands, fire.hands + 1);
    assert.equal(find(s, plain).hands, plain.hands);
    assert.equal(entrant(s, 'folks', side).hands, 2);
    s = play(s, 'all-jokes-roaster', side, 1);
    assert.equal(s.statuses.find((x) => x.targetId === plant.id)!.stacks, 4);
    s = advance(s, 2000);
    assert.equal(find(s, plant).hands, 14); // Two immediate Roaster damage, then four Burn.
    assert.equal(find(s, normal).hands, 17);
  }
});

test('Titan collects one weakest movable ally from each other lane, with per-arrival bonuses and no progress reset', () => {
  for (const side of seats) {
    const first = unit('edgar', side, 1, 0.35, 2),
      second = unit('nguyen', side, 2, 0.45, 3);
    const stronger = unit('john-henry', side, 1, 0.2, 9),
      frozen = unit('cornball', side, 2, 0.3, 1);
    let start = fresh([first, second, stronger, frozen]);
    status(start, frozen, 'freeze');
    const s = play(start, 'block-party-titan', side);
    assert.equal(entrant(s, 'block-party-titan', side).hands, 9);
    for (const ally of [first, second]) {
      assert.equal(find(s, ally).lane, 0);
      assert.equal(find(s, ally).position, ally.position);
    }
    assert.equal(find(s, stronger).lane, 1);
    assert.equal(find(s, frozen).lane, 2);
    const blocked = play(
      fresh([first, second, unit('dr-fade', other(side), 0, 0.9)]),
      'block-party-titan',
      side,
    );
    assert.equal(entrant(blocked, 'block-party-titan', side).hands, 7);
    assert.equal(find(blocked, first).lane, 1);
    assert.equal(find(blocked, second).lane, 2);
  }
});

test('Vibe and Titan select a stronger legally arriving friend instead of a weaker fighter that would bypass a defender', () => {
  for (const side of seats)
    for (const card of ['cool-vibe-yn', 'block-party-titan']) {
      const blocked = unit('cornball', side, 1, 0.8, 1),
        safe = unit('nguyen', side, 1, 0.2, 3);
      const defender = unit('dr-fade', other(side), 0, 0.4, 8);
      const s = play(fresh([blocked, safe, defender]), card, side);
      assert.equal(find(s, safe).lane, 0);
      assert.equal(find(s, safe).position, safe.position);
      assert.equal(find(s, blocked).lane, 1);
      assert.equal(find(s, blocked).position, blocked.position);
      assert.equal(find(s, blocked).hands, 1);
      assert.equal(find(s, safe).hands, card === 'cool-vibe-yn' ? 4 : 3);
      assert.equal(
        entrant(s, card, side).hands,
        card === 'cool-vibe-yn' ? 4 : 8,
      );
      assert.equal(find(s, defender).hands, 8);
    }
});

test('John Henry counts only other Earth fighters, caps his bonus at four, and needs two local Earth friends to strike', () => {
  for (const side of seats) {
    const local = [unit('man-man', side), unit('og-uncle', side)]; // OG Uncle is Fire and cannot satisfy the Earth gate.
    const enemy = unit('dr-fade', other(side), 0, 0.8, 8);
    const no = play(fresh([...local, enemy]), 'john-henry', side);
    assert.equal(entrant(no, 'john-henry', side).hands, 7);
    assert.equal(find(no, enemy).hands, 8);
    const earth = [
      unit('man-man', side),
      unit('big-zoey', side),
      unit('block-party-titan', side, 1),
      unit('man-man', side, 2),
      unit('big-zoey', side, 2),
    ];
    const yes = play(fresh([...earth, enemy]), 'john-henry', side);
    assert.equal(entrant(yes, 'john-henry', side).hands, 10);
    assert.equal(find(yes, enemy).hands, 6);
    const blocked = play(
      fresh([...earth, { ...enemy, protected: true }]),
      'john-henry',
      side,
    );
    assert.equal(entrant(blocked, 'john-henry', side).hands, 10);
    assert.equal(find(blocked, enemy).hands, 8);
  }
});

test('Mr Mc Hands chooses two different strongest local enemies and never retries a blocked first target', () => {
  for (const side of seats) {
    const one = {
      ...unit('john-henry', other(side), 0, 0.9, 9),
      protected: true,
    };
    const two = unit('dr-fade', other(side), 0, 0.8, 8),
      third = unit('edgar', other(side), 0, 0.7, 2);
    const remote = unit('block-party-titan', other(side), 1, 0.7, 20);
    const s = play(fresh([one, two, third, remote]), 'mr-mc-hands', side);
    assert.equal(find(s, one).hands, 9);
    assert.equal(find(s, two).hands, 6);
    assert.equal(find(s, third).hands, 2);
    assert.equal(find(s, remote).hands, 20);
    const alone = play(fresh([two]), 'mr-mc-hands', side);
    assert.equal(find(alone, two).hands, 6);
  }
});

test('Big Zoey independently helps the weakest local ally and hits the weakest local enemy', () => {
  for (const side of seats) {
    const ally = unit('edgar', side, 0, 0.3, 1),
      strongAlly = unit('nguyen', side, 0, 0.5, 7);
    const enemy = unit('rastamon', other(side), 0, 0.8, 3),
      strongEnemy = unit('dr-fade', other(side), 0, 0.9, 9);
    const s = play(
      fresh([ally, strongAlly, enemy, strongEnemy]),
      'big-zoey',
      side,
    );
    assert.equal(find(s, ally).hands, 3);
    assert.equal(find(s, strongAlly).hands, 7);
    assert.equal(find(s, enemy).hands, 1);
    assert.equal(find(s, strongEnemy).hands, 9);
    const blocked = play(
      fresh([ally, { ...enemy, protected: true }]),
      'big-zoey',
      side,
    );
    assert.equal(find(blocked, ally).hands, 3);
    assert.equal(find(blocked, enemy).hands, 3);
  }
});

test('Barber Bro transfers only actual trimmed bonus, never damage, and keeps his no-bonus fallback separate from a blocked trim', () => {
  for (const side of seats) {
    const ally = unit('edgar', side, 0, 0.2, 1),
      enemy = unit('nguyen', other(side), 0, 0.8, 7);
    const s = play(fresh([ally, enemy]), 'barber-bro', side);
    assert.equal(find(s, enemy).hands, 5);
    assert.equal(find(s, ally).hands, 3);
    assert.equal(find(s, enemy).damageTaken, undefined);
    assert.equal(s.metrics[side].damage, 0);
    assert.equal(s.metrics[side].confiscated, 2);
    const blocked = play(
      fresh([ally, { ...enemy, protected: true }]),
      'barber-bro',
      side,
    );
    assert.equal(find(blocked, ally).hands, 1);
    assert.equal(find(blocked, enemy).hands, 7);
    const base = unit('nguyen', other(side));
    const fallback = play(fresh([ally, base]), 'barber-bro', side);
    assert.equal(find(fallback, ally).hands, 2);
    assert.equal(find(fallback, base).hands, base.hands);
  }
});

test('held Barber Bro pulses only friendly Normal every ten seconds and deployment removes the hand aura clock', () => {
  for (const side of seats) {
    const normal = unit('edgar', side, 1, 0.3),
      fire = unit('young-bull', side, 2, 0.3),
      enemy = unit('edgar', other(side), 1, 0.2);
    let s = fresh([normal, fire, enemy]);
    s.players[side].hand = ['barber-bro'];
    s = advance(advance(s, 50), 10000);
    assert.equal(find(s, normal).hands, 3);
    assert.equal(find(s, fire).hands, fire.hands);
    assert.equal(find(s, enemy).hands, enemy.hands);
    s = play(s, 'barber-bro', side, 0);
    s = advance(s, 10000);
    assert.equal(find(s, normal).hands, 3);
    assert.equal(s.players[side].handAuraAt?.['barber-bro'], undefined);
  }
});

test('Church Auntie grants the element-specific local Protection package and globally rewards one blocked Light ally per ten seconds', () => {
  for (const side of seats) {
    const light = unit('dr-fade', side, 0, 0.3, 2),
      remote = unit('edgar', side, 1, 0.3, 1);
    let s = play(fresh([light, remote]), 'church-auntie', side);
    assert.equal(find(s, light).hands, 5);
    assert.equal(find(s, light).protected, true);
    assert.equal(find(s, remote).hands, 1);
    s = play(s, 'dr-fade', other(side));
    assert.equal(find(s, light).hands, 7);
    assert.equal(find(s, light).protected, false);
    find(s, light).protected = true;
    s = play(s, 'dr-fade', other(side));
    assert.equal(find(s, light).hands, 7);
    s = advance(s, 10000);
    find(s, light).protected = true;
    s = play(s, 'dr-fade', other(side));
    assert.equal(find(s, light).hands, 9);
    const plain = unit('edgar', side, 0, 0.3, 1);
    const nonLight = play(fresh([plain]), 'church-auntie', side);
    assert.equal(find(nonLight, plain).hands, 3);
    assert.equal(find(nonLight, plain).protected, true);
  }
});

test('immunity does not spend Wifey or trigger Church, and Wifey preserves the blocked target personal Protection', () => {
  for (const side of seats) {
    const target = {
      ...unit('dr-fade', side, 0, 0.4, 10),
      immune: true,
      protected: true,
    };
    const wife = unit('wifey', side, 0, 0.2),
      church = unit('church-auntie', side, 1, 0.3);
    let s = play(fresh([target, wife, church]), 'dr-fade', other(side));
    assert.equal(find(s, target).hands, 10);
    assert.equal(find(s, target).protected, true);
    assert.equal(s.players[side].sideEyeReadyAt ?? 0, 0);
    assert.equal(s.players[side].churchReadyAt ?? 0, 0);
    find(s, target).immune = false;
    s = play(s, 'dr-fade', other(side));
    assert.equal(find(s, target).protected, true);
    assert.equal(find(s, target).hands, 12);
    assert.equal(s.players[side].sideEyeReadyAt, 10000);
    assert.equal(s.players[side].churchReadyAt, 10000);
    s = play(s, 'dr-fade', other(side));
    assert.equal(find(s, target).protected, false);
    assert.equal(find(s, target).hands, 12);
    s = play(s, 'dr-fade', other(side));
    assert.equal(find(s, target).hands, 10);
    s = advance(s, 10000);
    s = play(s, 'dr-fade', other(side));
    assert.equal(find(s, target).hands, 12);
  }
});

test('a frozen, silenced, or Weakened Wifey cannot block for anyone else', () => {
  for (const kind of ['freeze', 'silence', 'weaken'] as const)
    for (const side of seats) {
      const target = unit('john-henry', side, 0, 0.4, 10),
        wife = unit('wifey', side, 0, 0.2);
      const s = fresh([target, wife]);
      status(s, wife, kind);
      const hit = play(s, 'dr-fade', other(side));
      assert.equal(find(hit, target).hands, 8);
      assert.equal(hit.players[side].sideEyeReadyAt ?? 0, 0);
    }
});

test('Church cannot pay a shield bonus while disabled and its shared clock survives replacement by another instance', () => {
  for (const side of seats) {
    for (const kind of ['freeze', 'silence', 'weaken'] as const) {
      const target = { ...unit('dr-fade', side, 0, 0.4, 8), protected: true },
        church = unit('church-auntie', side, 1, 0.3);
      const start = fresh([target, church]);
      status(start, church, kind);
      const s = play(start, 'dr-fade', other(side));
      assert.equal(find(s, target).hands, 8);
      assert.equal(find(s, target).protected, false);
      assert.equal(s.players[side].churchReadyAt ?? 0, 0);
    }
    const target = { ...unit('dr-fade', side, 0, 0.4, 8), protected: true },
      church = unit('church-auntie', side, 1, 0.3);
    let s = play(fresh([target, church]), 'dr-fade', other(side));
    assert.equal(find(s, target).hands, 10);
    s.units = s.units.filter((u) => u.id !== church.id);
    const replacement = unit('church-auntie', side, 2, 0.3);
    s.units.push(replacement);
    find(s, target).protected = true;
    s = play(s, 'dr-fade', other(side));
    assert.equal(find(s, target).hands, 10);
    assert.equal(s.players[side].churchReadyAt, 10000);
    const bonus = s.events.find((e) => e.type === 'buff' && e.amount === 2)!;
    assert.equal(bonus.sourceUnitId, church.id);
    assert.notEqual(bonus.sourceUnitId, replacement.id);
  }
});

test('Wifey shares a spent block across lanes and replacement instances without consuming the personal shield first', () => {
  for (const side of seats) {
    const one = unit('john-henry', side, 0, 0.4, 10),
      two = { ...unit('dr-fade', side, 1, 0.4, 9), protected: true };
    const first = unit('wifey', side, 0, 0.2),
      second = unit('wifey', side, 1, 0.2);
    let s = play(fresh([one, two, first, second]), 'dr-fade', other(side), 0);
    assert.equal(find(s, one).hands, 10);
    assert.equal(s.players[side].sideEyeReadyAt, 10000);
    s.units = s.units.filter((u) => u.id !== first.id && u.id !== second.id);
    s.units.push(unit('wifey', side, 1, 0.1));
    s = play(s, 'dr-fade', other(side), 1);
    assert.equal(find(s, two).protected, false);
    assert.equal(find(s, two).hands, 9);
    s = play(s, 'dr-fade', other(side), 1);
    assert.equal(find(s, two).hands, 7);
    assert.equal(s.players[side].sideEyeReadyAt, 10000);
  }
});

test('new status, movement, reactive shield, and held-aura resolutions never mutate an earlier state snapshot', () => {
  for (const card of [
    'cornball',
    'officer-oink',
    'cool-vibe-yn',
    'block-party-titan',
    'church-auntie',
    'barber-bro',
  ]) {
    const ally = unit('edgar', 'player', 1, 0.3, 2),
      target = { ...unit('dr-fade', 'opponent', 0, 0.2, 8), protected: true };
    const s = fresh([
      ally,
      target,
      unit('wifey', 'opponent', 0, 0.1),
      unit('church-auntie', 'opponent', 2, 0.1),
    ]);
    s.players.player.hand = [card];
    s.players.player.motion = 9;
    const before = structuredClone(s),
      next = deploy(s, 'player', card, 0).state;
    assert.deepEqual(
      s,
      before,
      `${card} deployment must preserve the old snapshot`,
    );
    const afterDeploy = structuredClone(next);
    advance(next, 10000);
    assert.deepEqual(
      next,
      afterDeploy,
      `${card} timers must preserve the old snapshot`,
    );
  }
});

test('Nurse cleanse remains limited when Weaken is present beside Freeze and Silence', () => {
  const target = unit('wifey', 'player', 0, 0.3),
    s = fresh([target]);
  for (const kind of ['freeze', 'silence', 'weaken'] as const)
    status(s, target, kind);
  const healed = play(s, 'pinay-nurse');
  assert.deepEqual(
    healed.statuses.map((x) => x.kind),
    ['weaken'],
  );
  assert.equal(find(healed, target).hands, 6);
});

function assertOwnership(s: GameState): void {
  for (const side of seats) {
    const p = s.players[side];
    const cards = [
      ...p.hand,
      ...p.queue,
      ...p.returns.map((r) => r.cardId),
      ...p.reinforcements.map((r) => r.cardId),
      ...s.units.filter((u) => u.side === side).map((u) => u.cardId),
    ];
    assert.equal(cards.length, 10);
    assert.equal(new Set(cards).size, 10);
    assert.deepEqual([...cards].sort(), [...s.decks[side]].sort());
    assert.ok(p.motion >= 0 && p.motion <= 9);
    assert.ok(Number.isFinite(s.metrics[side].damage));
  }
  assert.ok(
    s.units.every(
      (u) =>
        u.hands > 0 &&
        Number.isFinite(u.hands) &&
        u.position >= 0 &&
        u.position <= 1,
    ),
  );
  assert.ok(s.events.length <= 64);
}
test('fresh twenty and mixed forty matches conserve every deck identity and replay independently of frame chunks', () => {
  const configurations = [
    {
      roster: wave2Roster,
      decks: {
        player: wave2Roster.slice(0, 10).map((c) => c.id),
        opponent: wave2Roster.slice(10).map((c) => c.id),
      },
    },
    {
      roster: allCards,
      decks: {
        player: wave2Roster.filter((_, i) => i % 2).map((c) => c.id),
        opponent: originalRoster.filter((_, i) => !(i % 2)).map((c) => c.id),
      },
    },
  ];
  for (const options of configurations) {
    const run = (frame: number): GameState => {
      let s = createGame(options.roster, {
        seed: 4429,
        decks: options.decks,
        aiStyle: 'support',
      });
      for (let at = 0; at < 180000 && s.status === 'playing'; at += 1000) {
        const command = chooseAi(s, 'player', 'counter');
        if (command) {
          const result = deploy(
            s,
            'player',
            command.cardId,
            command.lane,
            command.squabble,
            command.target,
          );
          assert.equal(result.error, undefined);
          s = result.state;
        }
        for (
          let elapsed = 0;
          elapsed < 1000 && s.status === 'playing';
          elapsed += frame
        )
          s = advancePractice(s, Math.min(frame, 1000 - elapsed));
        assertOwnership(s);
      }
      assert.equal(s.status, 'complete');
      return s;
    };
    assert.deepEqual(run(1000), run(50));
  }
});
