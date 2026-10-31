import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  deploy,
  advance,
  advancePractice,
  chooseAi,
  deploymentCost,
  entranceAvailable,
  effectiveHands,
  RULES,
  type FighterDefinition,
  type GameState,
  type Unit,
} from './src/breakthrough.ts';
const roster: FighterDefinition[] = Array.from({ length: 10 }, (_, i) => ({
  id: `c${i}`,
  name: `Fighter ${i}`,
  cost: 2,
  hands: (i % 5) + 2,
  art: '',
  description: 'Audition',
  ability: 'none',
}));
const fresh = () => createGame(roster);
function unit(
  id: string,
  side: 'player' | 'opponent',
  position: number,
  hands = 4,
  lane: 0 | 1 | 2 = 0,
): Unit {
  return {
    id,
    side,
    position,
    hands,
    lane,
    cardId: side === 'player' ? 'c0' : 'c1',
    baseHands: hands,
    maxHands: hands,
    squabbled: false,
    nextEffectAt: 999999,
  };
}
test('ten unique positive-Hands supported cards are required', () => {
  assert.throws(() => createGame(roster.slice(1)));
  assert.throws(() => createGame(roster.map(() => roster[0])));
  assert.throws(() =>
    createGame(roster.map((c, i) => (i ? c : { ...c, hands: 0 }))),
  );
  assert.throws(() => createGame(roster, { durationMs: 111 }));
});
test('same seed creates same private deck order and both seats receive equal opening', () => {
  const a = fresh();
  assert.deepEqual(a, fresh());
  assert.deepEqual(a.players.player.hand, a.players.opponent.hand);
  assert.notDeepEqual(
    a.players.player.hand,
    createGame(roster, { seed: 99 }).players.player.hand,
  );
});
test('subtick accumulation and chunked advancing replay identically', () => {
  const a = fresh();
  assert.equal(advance(a, 49).tick, 0);
  assert.deepEqual(advance(a, 1000), advance(advance(a, 137), 863));
  assert.equal(a.tick, 0);
});
test('deploy spends atomically without mutating input, disallows duplicate live card', () => {
  const a = fresh(),
    id = a.players.player.hand[0];
  const b = deploy(a, 'player', id, 0).state;
  assert.equal(a.units.length, 0);
  assert.equal(b.players.player.motion, 2);
  assert.equal(b.units.length, 1);
  assert.ok(deploy(b, 'player', id, 1).error);
});
test('occupied entrance accepts a reinforcement; unaffordable cards and reused Squabble still reject', () => {
  let s = fresh();
  s = deploy(s, 'player', s.players.player.hand[0], 0, true).state;
  const id = s.players.player.hand[0];
  const queued = deploy(s, 'player', id, 0);
  assert.equal(queued.error, undefined);
  assert.ok(queued.state.units.some((u) => u.cardId === id));
  assert.equal(queued.state.players.player.reinforcements.length, 0);
  assert.equal(s.players.player.reinforcements.length, 0);
  assert.ok(deploy(s, 'player', id, 1, true).error);
  s.players.player.motion = 0;
  assert.equal(deploy(s, 'player', id, 1).state, s);
  assert.ok(deploy(s, 'player', id, 1).error);
});
test('Squabble adds base Hands once', () => {
  const s = fresh(),
    id = s.players.player.hand[0],
    d = roster.find((c) => c.id === id)!;
  const b = deploy(s, 'player', id, 0, true).state;
  assert.equal(b.units[0].hands, 2 * d.hands);
  assert.ok(b.players.player.squabbleUsed);
});
test('Motion continuously refills and caps', () => {
  assert.ok(Math.abs(advance(fresh(), 2000).players.player.motion - 5) < 1e-8);
  assert.equal(advance(fresh(), 20000).players.player.motion, 9);
});
test('simultaneous collision subtracts pre-contact Hands from both', () => {
  const s = fresh();
  s.units = [unit('a', 'player', 0.499, 7), unit('b', 'opponent', 0.501, 4)];
  const n = advance(s, 50);
  assert.equal(n.units.length, 1);
  assert.equal(n.units[0].hands, 3);
  assert.equal(n.players.opponent.returns.length, 1);
});
test('equal contact knocks both out', () => {
  const s = fresh();
  s.units = [unit('a', 'player', 0.499), unit('b', 'opponent', 0.501)];
  assert.equal(advance(s, 50).units.length, 0);
});
test('same-tick two second breaches draw and remove scoring units once', () => {
  const s = fresh();
  s.players.player.breaches = s.players.opponent.breaches = 1;
  s.units = [
    unit('a', 'player', 0.999, 4, 0),
    unit('b', 'opponent', 0.001, 4, 1),
  ];
  const n = advance(s, 50);
  assert.equal(n.winner, 'draw');
  assert.equal(n.units.length, 0);
  assert.equal(n.players.player.breaches, 2);
  assert.equal(advance(n, 10000), n);
});
test('two breaches win', () => {
  const s = fresh();
  s.units = [
    unit('a', 'player', 0.999, 4, 0),
    unit('b', 'player', 0.999, 4, 1),
  ];
  assert.equal(advance(s, 50).winner, 'player');
});
test('Last Stand blocks draws and returns while retaining held hand and refilling Motion', () => {
  const s = fresh();
  s.elapsedMs = 149950;
  s.players.player.hand = [];
  s.players.player.motion = 0;
  s.players.player.nextDrawAt = 150000;
  s.players.player.returns = [{ cardId: 'c0', readyAt: 150000 }];
  const n = advance(s, 1000);
  assert.equal(n.players.player.hand.length, 0);
  assert.equal(n.players.player.returns.length, 1);
  assert.ok(n.players.player.motion > 0);
  assert.ok(n.events.some((e) => e.type === 'last-stand'));
});
test('normal draws fill only to four', () => {
  const s = fresh();
  s.players.player.hand.pop();
  const n = advance(s, 3000);
  assert.equal(n.players.player.hand.length, 4);
  assert.equal(advance(n, 6000).players.player.hand.length, 4);
});
test('defeated fighter returns after eight seconds and does not retain wounds', () => {
  let s = fresh();
  const id = s.players.player.hand[0];
  s = deploy(s, 'player', id, 0, true).state;
  s.units[0].hands = 0;
  s = advance(s, 50);
  assert.equal(s.players.player.returns[0].readyAt, 8050);
  s.players.player.queue = [];
  s.players.player.hand = [];
  s = advance(s, 8950);
  assert.ok(s.players.player.hand.includes(id));
  const n = deploy(s, 'player', id, 1).state;
  assert.equal(n.units[0].hands, roster.find((c) => c.id === id)!.hands);
  assert.equal(n.units[0].squabbled, false);
  assert.equal(n.players.player.squabbleUsed, true);
});
test('timeout prioritizes breaches over deployed Hands and ignores held cards', () => {
  const s = fresh();
  s.elapsedMs = 179950;
  s.players.player.breaches = 1;
  s.units = [unit('b', 'opponent', 0.5, 100)];
  assert.equal(advance(s, 50).winner, 'player');
  const t = fresh();
  t.elapsedMs = 179950;
  t.units = [unit('a', 'player', 0.2, 3), unit('b', 'opponent', 0.8, 2)];
  assert.equal(advance(t, 50).winner, 'player');
  assert.equal(
    advance(createGame(roster, { durationMs: 50 }), 50).winner,
    'draw',
  );
});
test('friendly fighters maintain separation without a UI lane cap', () => {
  const s = fresh();
  s.units = Array.from({ length: Math.floor(1 / RULES.spacing) + 1 }, (_, i) =>
    unit(`a${i}`, 'player', i * RULES.spacing),
  );
  const n = advance(s, 50);
  assert.equal(n.units.length, Math.floor(1 / RULES.spacing) + 1);
  const ps = n.units.map((u) => u.position).sort((a, b) => a - b);
  for (let i = 1; i < ps.length; i++)
    assert.ok(ps[i] - ps[i - 1] >= RULES.spacing - 1e-9);
});
test('burn uses deployment timer, not a shared round, and cannot let a dead unit breach', () => {
  const r = roster.map((c) => ({ ...c, ability: 'burn' as const }));
  let s = createGame(r);
  s = advance(s, 1000);
  s = deploy(s, 'player', s.players.player.hand[0], 0).state;
  assert.equal(s.units[0].nextEffectAt, 6000);
  s.units.push(unit('victim', 'opponent', 0.001, 1));
  s.units[0].nextEffectAt = 1050;
  const n = advance(s, 50);
  assert.equal(n.players.opponent.breaches, 0);
  assert.ok(!n.units.some((u) => u.id === 'victim'));
});
test('push cannot move a target through a blocker or score a breach', () => {
  const r = roster.map((c) => ({ ...c, ability: 'push' as const }));
  const s = createGame(r);
  s.units = [unit('a', 'opponent', 0.8), unit('b', 'opponent', 0.83)];
  const n = deploy(s, 'player', s.players.player.hand[0], 0).state;
  assert.equal(n.units[0].position, 0.8);
  assert.equal(n.players.player.breaches, 0);
});
test('mend caps at deployment starting Hands', () => {
  const r = roster.map((c) => ({ ...c, ability: 'mend' as const }));
  let s = createGame(r);
  s = deploy(s, 'player', s.players.player.hand[0], 0).state;
  s.units[0].hands--;
  s.units[0].nextEffectAt = 50;
  const n = advance(s, 50);
  assert.equal(n.units[0].hands, n.units[0].maxHands);
});
test('AI proposal is deterministic and valid, events stay bounded in long simulation', () => {
  let s = fresh();
  for (let i = 0; i < 1800 && s.status === 'playing'; i++) {
    const a = chooseAi(s);
    assert.deepEqual(a, chooseAi(s));
    if (a) {
      const d = deploy(s, 'opponent', a.cardId, a.lane, a.squabble);
      assert.ok(!d.error);
      s = d.state;
    }
    s = advance(s, 100);
  }
  assert.ok(s.events.length <= 64);
  assert.equal(s.status, 'complete');
});
test('reject nonfinite or negative elapsed time', () => {
  assert.throws(() => advance(fresh(), Infinity));
  assert.throws(() => advance(fresh(), -1));
});
test('seeded two-sided replays preserve every deck identity exactly once throughout matches', () => {
  const play = (seed: number) => {
    let s = createGame(roster, { seed });
    for (let n = 0; n < 1800 && s.status === 'playing'; n++) {
      for (const side of ['player', 'opponent'] as const) {
        const id = s.players[side].hand.find(
          (id) =>
            roster.find((c) => c.id === id)!.cost <= s.players[side].motion,
        );
        if (id)
          for (const lane of [0, 1, 2] as const) {
            const d = deploy(
              s,
              side,
              id,
              ((lane + n) % 3) as 0 | 1 | 2,
              !s.players[side].squabbleUsed,
            );
            if (!d.error) {
              s = d.state;
              break;
            }
          }
      }
      s = advance(s, 100);
      for (const side of ['player', 'opponent'] as const) {
        const p = s.players[side];
        const ids = [
          ...p.hand,
          ...p.queue,
          ...p.reinforcements.map((r) => r.cardId),
          ...p.returns.map((r) => r.cardId),
          ...s.units.filter((u) => u.side === side).map((u) => u.cardId),
        ];
        assert.equal(ids.length, 10);
        assert.equal(new Set(ids).size, 10);
        assert.ok(p.motion >= 0 && p.motion <= 9);
        assert.ok(p.hand.length <= 4);
      }
    }
    return s;
  };
  for (const seed of [1, 19, 53, 109, 802]) {
    const a = play(seed);
    assert.equal(a.status, 'complete');
    assert.deepEqual(a, play(seed));
  }
});
test('Last Stand boundary emits once and suppresses draw due exactly at cutoff', () => {
  const s = fresh();
  s.elapsedMs = 149900;
  s.players.player.hand = [];
  s.players.player.nextDrawAt = 150000;
  const before = advance(s, 50);
  assert.equal(before.events.filter((e) => e.type === 'last-stand').length, 0);
  const boundary = advance(before, 50);
  assert.equal(boundary.players.player.hand.length, 0);
  assert.equal(
    advance(boundary, 50).events.filter((e) => e.type === 'last-stand').length,
    1,
  );
});
test('defeat events identify damage deaths but scoring does not show KO', () => {
  const s = fresh();
  s.units = [unit('a', 'player', 0.499), unit('b', 'opponent', 0.501)];
  assert.equal(
    advance(s, 50).events.filter((e) => e.type === 'defeat').length,
    2,
  );
  const b = fresh();
  b.units = [unit('a', 'player', 0.999)];
  assert.equal(
    advance(b, 50).events.filter((e) => e.type === 'defeat').length,
    0,
  );
});
test('Motion exact integer threshold matches HUD flooring and legal deployment', () => {
  const s = createGame(roster.map((c) => ({ ...c, cost: 5 })));
  const before = advance(s, 1950);
  assert.equal(Math.floor(before.players.player.motion), 4);
  assert.ok(deploy(before, 'player', before.players.player.hand[0], 0).error);
  const exact = advance(before, 50);
  assert.equal(exact.players.player.motion, 5);
  assert.equal(Math.floor(exact.players.player.motion), 5);
  const played = deploy(exact, 'player', exact.players.player.hand[0], 0);
  assert.equal(played.error, undefined);
  assert.equal(played.state.players.player.motion, 0);
  assert.throws(() => createGame(roster.map((c) => ({ ...c, cost: 2.5 }))));
});
test('practice AI decisions and remainder are identical across delayed and split frames', () => {
  const start = advancePractice(fresh(), 37);
  let split = start;
  for (let i = 0; i < 20; i++) split = advancePractice(split, 100);
  assert.deepEqual(advancePractice(start, 2000), split);
  const boundary = advancePractice(fresh(), 900);
  const count = boundary.events.filter((e) => e.type === 'deploy').length;
  assert.equal(
    advancePractice(boundary, 49).events.filter((e) => e.type === 'deploy')
      .length,
    count,
  );
  assert.equal(
    advancePractice(boundary, 50).events.filter((e) => e.type === 'deploy')
      .length,
    count,
  );
});
test('full practice duel replay is independent of frame chunks with timed player commands', () => {
  const play = (chunk: number) => {
    let s = fresh();
    for (
      let commandAt = 0;
      commandAt < 180000 && s.status === 'playing';
      commandAt += 2000
    ) {
      const id = s.players.player.hand.find(
        (id) =>
          roster.find((c) => c.id === id)!.cost <= s.players.player.motion,
      );
      if (id)
        for (const lane of [0, 1, 2] as const) {
          const d = deploy(
            s,
            'player',
            id,
            lane,
            !s.players.player.squabbleUsed,
          );
          if (!d.error) {
            s = d.state;
            break;
          }
        }
      for (let t = 0; t < 2000; t += chunk)
        s = advancePractice(s, Math.min(chunk, 2000 - t));
    }
    return s;
  };
  const batched = play(2000);
  assert.equal(batched.status, 'complete');
  assert.deepEqual(batched, play(100));
  assert.deepEqual(batched, play(137));
});
import { resolveBreakthroughCard } from './src/breakthroughCatalog.ts';
const compatibilityRoster = [
  'bushedo-brown',
  'franklin-duke',
  'chonk-lee',
  'dragonfly-jones',
  'undercova-brotha',
  'sho-nuff',
  'leroy',
  'yasuke',
  'hooper',
  'racially-ambiguous-transplant',
  'homeless-yn',
  'plug',
  'pinay-nurse',
  'all-jokes-roaster',
  'kyle',
  'abuela',
  'guap',
  'buddy',
  'snow-bunny',
  'teacher',
].map((id) => resolveBreakthroughCard(id)!);
const authenticRoster = compatibilityRoster.slice(0, 10);
function authentic(id: string, units: Unit[] = []) {
  const s = createGame(authenticRoster);
  s.players.player.hand = [id];
  s.players.player.motion = 9;
  s.units = units;
  return s;
}
function fighter(
  cardId: string,
  side: 'player' | 'opponent',
  position: number,
  hands?: number,
  lane: 0 | 1 | 2 = 0,
): Unit {
  const c = authenticRoster.find((c) => c.id === cardId)!;
  return {
    ...unit(`${side}-${cardId}`, side, position, hands ?? c.hands, lane),
    cardId,
    baseHands: c.hands,
    maxHands: hands ?? c.hands,
  };
}
function playAuthentic(s: GameState, id: string, lane: 0 | 1 | 2 = 0) {
  const d = deploy(s, 'player', id, lane);
  assert.equal(d.error, undefined);
  return d.state;
}
test('authentic roster has canonical stats, elements and printed descriptions for all ten', () => {
  assert.equal(authenticRoster.length, 10);
  assert.equal(authenticRoster.find((c) => c.id === 'hooper')!.cost, 4);
  for (const c of authenticRoster) {
    assert.ok(c.abilityName);
    assert.ok(c.printedDescription);
    assert.ok(c.element);
    assert.ok(!['none', 'burn', 'mend', 'push'].includes(c.ability!));
  }
});
test('New Here grants one only when alone in lane', () => {
  const id = 'racially-ambiguous-transplant';
  assert.equal(playAuthentic(authentic(id), id).units[0].hands, 2);
  const n = playAuthentic(
    authentic(id, [fighter('yasuke', 'player', RULES.spacing + 0.02)]),
    id,
  );
  assert.equal(n.units.find((u) => u.cardId === id)!.hands, 1);
});
test('Personal Security grants ally buff/protection and confiscates bonus without damage credit', () => {
  const id = 'bushedo-brown';
  const enemy = fighter('chonk-lee', 'opponent', 0.8, 10);
  const n = playAuthentic(
    authentic(id, [fighter('yasuke', 'player', RULES.spacing + 0.02), enemy]),
    id,
  );
  const target = n.units.find((u) => u.id === enemy.id)!;
  assert.equal(target.hands, 7);
  assert.equal(target.damageTaken, undefined);
  assert.equal(n.events.filter((e) => e.type === 'damage').length, 0);
  const ally = n.units.find((u) => u.cardId === 'yasuke')!;
  assert.equal(ally.hands, 5);
  assert.equal(ally.protected, true);
});
test('Protection blocks entire Golden Glow package once; immunity persists', () => {
  for (const defense of ['protected', 'immune'] as const) {
    const enemy = fighter('chonk-lee', 'opponent', 0.8, 10);
    enemy[defense] = true;
    const n = playAuthentic(authentic('leroy', [enemy]), 'leroy');
    const target = n.units.find((u) => u.id === enemy.id)!;
    assert.equal(target.hands, 10);
    assert.equal(
      n.events.filter((e) => e.type === 'confiscate' || e.type === 'damage')
        .length,
      0,
    );
    assert.equal(target[defense], defense === 'immune');
  }
});
test('Golden Glow counts distinct live friendly elements then confiscates and damages separately', () => {
  const n = playAuthentic(
    authentic('leroy', [
      fighter('yasuke', 'player', 0.2, undefined, 1),
      fighter('chonk-lee', 'player', 0.3, undefined, 2),
      fighter('dragonfly-jones', 'player', 0.4, undefined, 1),
      fighter('chonk-lee', 'opponent', 0.8, 10),
    ]),
    'leroy',
  );
  const leroy = n.units.find((u) => u.cardId === 'leroy')!;
  assert.equal(leroy.hands, 8);
  assert.equal(leroy.protected, true);
  const enemy = n.units.find((u) => u.side === 'opponent')!;
  assert.equal(enemy.hands, 5);
  assert.equal(enemy.damageTaken, 2);
  assert.equal(n.events.find((e) => e.type === 'confiscate')!.amount, 3);
});
test('Franklin rewards actual landed damage only and otherwise coaches remote weakest ally', () => {
  const target = fighter('chonk-lee', 'opponent', 0.8);
  let n = playAuthentic(authentic('franklin-duke', [target]), 'franklin-duke');
  assert.equal(n.units.find((u) => u.cardId === 'franklin-duke')!.hands, 9);
  target.protected = true;
  n = playAuthentic(authentic('franklin-duke', [target]), 'franklin-duke');
  assert.equal(n.units.find((u) => u.cardId === 'franklin-duke')!.hands, 6);
  n = playAuthentic(
    authentic('franklin-duke', [
      fighter('yasuke', 'player', 0.2, undefined, 1),
    ]),
    'franklin-duke',
  );
  assert.equal(n.units[0].hands, 6);
  assert.equal(n.units[0].protected, true);
});
test('No Mercy counts actual damage per lane, not protected targets', () => {
  const targets = ([0, 1, 2] as const).map((l) => ({
    ...fighter('chonk-lee', 'opponent', 0.8, 7, l),
    id: `target${l}`,
  }));
  targets[1].protected = true;
  const n = playAuthentic(authentic('chonk-lee', targets), 'chonk-lee');
  assert.equal(n.units.find((u) => u.side === 'player')!.hands, 9);
  assert.equal(n.events.filter((e) => e.type === 'damage').length, 2);
});
test('Secret Technique prioritizes bonus and only earns reward from damage', () => {
  const bonus = fighter('yasuke', 'opponent', 0.7, 4);
  const heavy = fighter('chonk-lee', 'opponent', 0.8);
  const n = playAuthentic(
    authentic('dragonfly-jones', [heavy, bonus]),
    'dragonfly-jones',
  );
  assert.ok(!n.units.some((u) => u.id === bonus.id));
  assert.equal(n.units.find((u) => u.id === heavy.id)!.hands, 7);
  assert.equal(n.units.find((u) => u.side === 'player')!.hands, 4);
});
test('Sho Nuff only gains confiscated bonus, never printed Hands or healing credit', () => {
  let n = playAuthentic(
    authentic('sho-nuff', [fighter('chonk-lee', 'opponent', 0.8, 9)]),
    'sho-nuff',
  );
  assert.equal(n.units.find((u) => u.side === 'player')!.hands, 6);
  assert.equal(n.units.find((u) => u.side === 'opponent')!.hands, 7);
  assert.equal(
    n.events.filter((e) => e.type === 'damage' || e.type === 'mend').length,
    0,
  );
  n = playAuthentic(
    authentic('sho-nuff', [fighter('chonk-lee', 'opponent', 0.8)]),
    'sho-nuff',
  );
  assert.equal(n.units.find((u) => u.side === 'player')!.hands, 4);
  assert.equal(n.units.find((u) => u.side === 'opponent')!.hands, 4);
});
test('Black Blade chooses weakest unprotected ally and still strikes', () => {
  const weak = fighter(
    'racially-ambiguous-transplant',
    'player',
    RULES.spacing + 0.02,
  );
  weak.protected = true;
  const n = playAuthentic(
    authentic('yasuke', [
      weak,
      fighter('dragonfly-jones', 'player', 2 * RULES.spacing + 0.04),
      fighter('chonk-lee', 'opponent', 0.8),
    ]),
    'yasuke',
  );
  assert.equal(n.units.find((u) => u.cardId === 'dragonfly-jones')!.hands, 5);
  assert.equal(n.units.find((u) => u.side === 'opponent')!.hands, 5);
});
test('Hooper challenge lasts10s and cancels on target death; lane escape rewards once', () => {
  const target = fighter('chonk-lee', 'opponent', 0.8);
  let s = playAuthentic(authentic('hooper', [target]), 'hooper');
  const h = s.units.find((u) => u.side === 'player')!;
  assert.equal(h.challenge!.expiresAt, 10000);
  s.travelMs = 1000000;
  s = advance(s, 9950);
  assert.equal(s.units.find((u) => u.side === 'opponent')!.hands, 7);
  s = advance(s, 50);
  assert.equal(s.units.find((u) => u.side === 'opponent')!.hands, 4);
  assert.equal(s.units.find((u) => u.side === 'player')!.hands, 5);
  assert.equal(s.units.find((u) => u.side === 'player')!.challenge, undefined);
  s = playAuthentic(authentic('hooper', [target]), 'hooper');
  s.units.find((u) => u.side === 'opponent')!.lane = 1;
  s = advance(s, 50);
  assert.equal(s.units.find((u) => u.side === 'player')!.hands, 7);
  assert.equal(advance(s, 50).units.find((u) => u.side === 'player')!.hands, 7);
  s = playAuthentic(authentic('hooper', [target]), 'hooper');
  s.units = s.units.filter((u) => u.side === 'player');
  assert.equal(advance(s, 50).units[0].hands, 4);
});
test('Inside Man resolves after entrance, shares cooldown and two payouts across copies, escapes safely', () => {
  let s = authentic('racially-ambiguous-transplant', [
    fighter('undercova-brotha', 'opponent', 0.7),
  ]);
  s = playAuthentic(s, 'racially-ambiguous-transplant');
  let spy = s.units.find((u) => u.side === 'opponent')!;
  assert.equal(spy.hands, 5);
  assert.equal(spy.lane, 1);
  assert.equal(s.players.opponent.insideManPayouts, 1);
  assert.equal(s.players.opponent.insideManReadyAt, 10000);
  // Copy observes the shared cooldown; a fresh deployment cannot reset it.
  s.units = [{ ...fighter('undercova-brotha', 'opponent', 0.7), id: 'copy' }];
  s.players.player.hand = ['racially-ambiguous-transplant'];
  s.players.player.motion = 9;
  s = playAuthentic(s, 'racially-ambiguous-transplant');
  assert.equal(s.players.opponent.insideManPayouts, 1);
  assert.equal(s.units.find((u) => u.side === 'opponent')!.hands, 3);
  s.elapsedMs = 10000;
  s.units = s.units.filter((u) => u.side === 'opponent');
  s.players.player.hand = ['racially-ambiguous-transplant'];
  s.players.player.motion = 9;
  s = playAuthentic(s, 'racially-ambiguous-transplant');
  assert.equal(s.players.opponent.insideManPayouts, 2);
  s.elapsedMs = 20000;
  s.units = [fighter('undercova-brotha', 'opponent', 0.7)];
  s.players.player.hand = ['racially-ambiguous-transplant'];
  s.players.player.motion = 9;
  s = playAuthentic(s, 'racially-ambiguous-transplant');
  assert.equal(s.players.opponent.insideManPayouts, 2);
  assert.equal(s.units.find((u) => u.side === 'opponent')!.hands, 3);
});
test('blocked Inside Man package creates neither payout nor escape', () => {
  const id = 'leroy';
  const s = authentic(id, [
    fighter('undercova-brotha', 'opponent', 0.7),
    fighter('chonk-lee', 'player', 0.3, undefined, 1),
    fighter('dragonfly-jones', 'player', 0.4, undefined, 2),
  ]);
  const n = playAuthentic(s, id);
  const spy = n.units.find((u) => u.cardId === 'undercova-brotha')!;
  assert.equal(spy.hands, 1);
  assert.equal(spy.lane, 0);
  assert.equal(n.players.opponent.insideManPayouts, undefined);
  assert.equal(n.units.find((u) => u.cardId === 'leroy')!.hands, 8);
});
test('confiscation cannot steal printed Hands or create damage/healing credit on wounded fighters', () => {
  const enemy = fighter('chonk-lee', 'opponent', 0.8, 8);
  enemy.maxHands = 10;
  enemy.damageTaken = 2;
  const n = playAuthentic(authentic('sho-nuff', [enemy]), 'sho-nuff');
  const target = n.units.find((u) => u.side === 'opponent')!;
  assert.equal(target.hands, 7);
  assert.equal(target.damageTaken, 2);
  assert.equal(n.events.find((e) => e.type === 'confiscate')!.amount, 1);
  assert.equal(
    n.events.filter((e) => e.type === 'damage' || e.type === 'mend').length,
    0,
  );
});
test('authentic effects preserve deck ownership through a complete deterministic duel', () => {
  const run = () => {
    let s = createGame(authenticRoster, { seed: 918 });
    for (let t = 0; t < 180000 && s.status === 'playing'; t += 500) {
      const id = s.players.player.hand.find(
        (id) =>
          authenticRoster.find((c) => c.id === id)!.cost <=
          s.players.player.motion,
      );
      if (id)
        for (const lane of [0, 1, 2] as const) {
          const d = deploy(
            s,
            'player',
            id,
            lane,
            !s.players.player.squabbleUsed,
          );
          if (!d.error) {
            s = d.state;
            break;
          }
        }
      s = advancePractice(s, 500);
      for (const side of ['player', 'opponent'] as const) {
        const p = s.players[side];
        const ids = [
          ...p.hand,
          ...p.queue,
          ...p.reinforcements.map((r) => r.cardId),
          ...p.returns.map((r) => r.cardId),
          ...s.units.filter((u) => u.side === side).map((u) => u.cardId),
        ];
        assert.equal(ids.length, 10);
        assert.equal(new Set(ids).size, 10);
        assert.ok((p.insideManPayouts ?? 0) <= 2);
      }
    }
    return s;
  };
  const result = run();
  assert.equal(result.status, 'complete');
  assert.deepEqual(result, run());
});
test('ability damage events preserve source and target geometry for finite VFX', () => {
  const n = playAuthentic(
    authentic('dragonfly-jones', [fighter('chonk-lee', 'opponent', 0.8)]),
    'dragonfly-jones',
  );
  const damage = n.events.find((e) => e.type === 'damage')!;
  assert.equal(damage.position, 0.8);
  assert.equal(damage.sourcePosition, 0);
  assert.equal(damage.sourceSide, 'player');
  assert.equal(damage.side, 'opponent');
  assert.equal(damage.sourceLane, 0);
});
test('reciprocal lethal challenges both resolve before deaths without reward resurrection', () => {
  const run = (reverse: boolean) => {
    const s = authentic('hooper');
    s.units = [
      fighter('hooper', 'player', 0.2, 3),
      fighter('hooper', 'opponent', 0.8, 3),
    ];
    for (const u of s.units)
      u.challenge = {
        targetId: s.units.find((t) => t.side !== u.side)!.id,
        lane: 0,
        expiresAt: 50,
      };
    if (reverse) s.units.reverse();
    return advance(s, 50);
  };
  for (const reverse of [false, true]) {
    const n = run(reverse);
    assert.equal(n.units.length, 0);
    assert.equal(n.events.filter((e) => e.type === 'damage').length, 2);
    assert.equal(n.events.filter((e) => e.type === 'buff').length, 0);
    assert.equal(n.events.filter((e) => e.type === 'defeat').length, 2);
    assert.equal(n.players.player.returns.length, 1);
    assert.equal(n.players.opponent.returns.length, 1);
  }
});
test('reciprocal surviving challenges and shared protection are independent of input array order', () => {
  const run = (reverse: boolean, shield = false) => {
    const s = authentic('hooper');
    s.units = [
      fighter('hooper', 'player', 0.2, 4),
      fighter('hooper', 'opponent', 0.8, 4),
    ];
    for (const u of s.units) {
      u.challenge = {
        targetId: s.units.find((t) => t.side !== u.side)!.id,
        lane: 0,
        expiresAt: 50,
      };
      u.protected = shield;
    }
    if (reverse) s.units.reverse();
    return advance(s, 50);
  };
  for (const shield of [false, true]) {
    const a = run(false, shield),
      b = run(true, shield);
    const normalize = (s: GameState) => ({
      ...s,
      units: [...s.units].sort((a, b) => a.id.localeCompare(b.id)),
    });
    assert.deepEqual(normalize(a), normalize(b));
    assert.ok(a.units.every((u) => u.hands === (shield ? 5 : 2)));
  }
});
test('legacy burn and mend events use recipient coordinates and explicit source metadata', () => {
  const r = roster.map((c, i) => ({
    ...c,
    ability: i === 0 ? ('burn' as const) : ('mend' as const),
  }));
  const s = createGame(r);
  s.units = [
    { ...unit('burner', 'player', 0.2, 4), cardId: 'c0', nextEffectAt: 50 },
    {
      ...unit('healer', 'opponent', 0.8, 3),
      cardId: 'c1',
      maxHands: 4,
      nextEffectAt: 50,
    },
  ];
  const n = advance(s, 50),
    burn = n.events.find((e) => e.type === 'burn')!,
    mend = n.events.find((e) => e.type === 'mend')!;
  assert.equal(burn.side, 'opponent');
  assert.equal(burn.position, 0.8);
  assert.equal(burn.sourceSide, 'player');
  assert.equal(burn.sourcePosition, 0.2);
  assert.equal(burn.sourceUnitId, 'burner');
  assert.equal(mend.side, 'opponent');
  assert.equal(mend.sourceSide, 'opponent');
  assert.equal(mend.position, 0.8);
  assert.equal(mend.sourcePosition, 0.8);
  assert.equal(mend.sourceUnitId, 'healer');
});
function expanded(ids: string[] = []): GameState {
  const deck = [
    ...new Set([...ids, ...compatibilityRoster.map((c) => c.id)]),
  ].slice(0, 10);
  return createGame(compatibilityRoster, {
    seed: 41,
    decks: { player: deck, opponent: [...deck] },
  });
}
function expandedUnit(
  id: string,
  side: 'player' | 'opponent',
  position = 0.5,
  lane: 0 | 1 | 2 = 0,
  hands?: number,
): Unit {
  const c = compatibilityRoster.find((c) => c.id === id)!;
  return {
    ...unit(`${side}-${id}`, side, position, hands ?? c.hands, lane),
    cardId: id,
    baseHands: c.hands,
    maxHands: hands ?? c.hands,
    deployedAt: 0,
    arrivalOrder: 1,
  };
}
function playExpanded(
  s: GameState,
  id: string,
  lane: 0 | 1 | 2 = 0,
): GameState {
  s.players.player.hand = [id];
  s.players.player.motion = 9;
  return playAuthentic(s, id, lane);
}
test('twenty-card pool requires validated independent ten-card decks with seeded shuffle streams', () => {
  assert.equal(compatibilityRoster.length, 20);
  assert.throws(() => createGame(compatibilityRoster));
  const a = compatibilityRoster.slice(0, 10).map((c) => c.id),
    b = compatibilityRoster.slice(10).map((c) => c.id),
    s = createGame(compatibilityRoster, { decks: { player: a, opponent: b } });
  assert.deepEqual(
    new Set([...s.players.player.hand, ...s.players.player.queue]),
    new Set(a),
  );
  assert.deepEqual(
    new Set([...s.players.opponent.hand, ...s.players.opponent.queue]),
    new Set(b),
  );
  assert.deepEqual(
    s,
    createGame(compatibilityRoster, { decks: { player: a, opponent: b } }),
  );
  const changed = createGame(compatibilityRoster, {
    decks: { player: a, opponent: [...b].reverse() },
  });
  assert.deepEqual(s.players.player, changed.players.player);
  assert.equal(s.effectsRng, changed.effectsRng);
  assert.equal(s.aiSeed, changed.aiSeed);
  assert.throws(() =>
    createGame(compatibilityRoster, {
      decks: { player: a, opponent: a.slice(1) },
    }),
  );
  assert.throws(() =>
    createGame(compatibilityRoster, {
      decks: { player: a, opponent: [...b.slice(1), 'missing'] },
    }),
  );
});
test('Still Standing excludes self and evaluates live lane counts on deployment', () => {
  let s = expanded(['homeless-yn']);
  s.units = [expandedUnit('yasuke', 'opponent')];
  s = playExpanded(s, 'homeless-yn');
  assert.equal(s.units.find((u) => u.cardId === 'homeless-yn')!.hands, 5);
  s = expanded(['homeless-yn']);
  s.units = [
    expandedUnit('yasuke', 'opponent'),
    expandedUnit('kyle', 'player', 0.3),
  ];
  s = playExpanded(s, 'homeless-yn');
  assert.equal(s.units.find((u) => u.cardId === 'homeless-yn')!.hands, 2);
});
test('Connections applies only across lanes, survives source death, consumes atomically on success', () => {
  let s = playExpanded(expanded(['plug', 'homeless-yn']), 'plug');
  assert.equal(deploymentCost(s, 'player', 'homeless-yn', 0), 1);
  assert.equal(deploymentCost(s, 'player', 'homeless-yn', 1), 0);
  s.units = [];
  s.players.player.hand = ['homeless-yn'];
  s.players.player.motion = 0;
  s.units = [expandedUnit('yasuke', 'opponent', 0, 1)];
  assert.equal(entranceAvailable(s, 'player', 1), true);
  const denied = deploy(s, 'player', 'homeless-yn', 0);
  assert.ok(denied.error);
  assert.deepEqual(denied.state.players.player.discount, { origin: 0 });
  const played = deploy(s, 'player', 'homeless-yn', 1);
  assert.equal(played.error, undefined);
  assert.equal(played.state.players.player.discount, undefined);
  assert.equal(played.state.players.player.motion, 0);
});
test('Buddy lane discount is active normal-form only, non-stacking and zero-floor', () => {
  const s = expanded(['buddy', 'plug', 'homeless-yn']);
  s.units = [
    expandedUnit('buddy', 'player', 0.3),
    { ...expandedUnit('buddy', 'player', 0.4), id: 'secondBuddy' },
  ];
  assert.equal(deploymentCost(s, 'player', 'homeless-yn', 0), 0);
  assert.equal(deploymentCost(s, 'player', 'plug', 0), 1);
  s.units[0].silenced = true;
  s.units[1].squabbled = true;
  assert.equal(deploymentCost(s, 'player', 'homeless-yn', 0), 1);
  s.units[0].silenced = false;
  s.units[0].lane = 1;
  assert.equal(deploymentCost(s, 'player', 'homeless-yn', 0), 1);
});
test('Snow Bunny retains stored Hands, suppresses effective Hands/movement until expiry or Nurse cleanse', () => {
  let s = expanded(['snow-bunny', 'pinay-nurse']);
  s.units = [expandedUnit('chonk-lee', 'opponent', 0.8)];
  s = playExpanded(s, 'snow-bunny');
  const id = s.units.find((u) => u.side === 'opponent')!.id;
  assert.equal(s.units.find((u) => u.id === id)!.hands, 7);
  assert.equal(effectiveHands(s.units.find((u) => u.id === id)!), 0);
  s.travelMs = 1000000;
  s = advance(s, 9950);
  assert.equal(s.units.find((u) => u.id === id)!.position, 0.8);
  s = advance(s, 50);
  assert.equal(effectiveHands(s.units.find((u) => u.id === id)!), 7);
  // Use the same controlled unit as a friendly target in an isolated cleanse fixture.
  let clean = expanded(['pinay-nurse']);
  const target = expandedUnit('chonk-lee', 'player', 0.6);
  clean.units = [target];
  clean.statuses = [
    {
      id: 1,
      kind: 'freeze',
      targetId: target.id,
      sourceUnitId: 'gone',
      sourceSide: 'opponent',
      sourceLane: 0,
      sourcePosition: 0.9,
      appliedAt: 0,
      nextTickAt: 2000,
      expiresAt: 10000,
      stacks: 1,
    },
    {
      id: 2,
      kind: 'silence',
      targetId: target.id,
      sourceUnitId: 'gone',
      sourceSide: 'opponent',
      sourceLane: 0,
      sourcePosition: 0.9,
      appliedAt: 0,
      nextTickAt: 2000,
      expiresAt: 10000,
      stacks: 1,
    },
  ];
  clean = advance(clean, 50);
  clean = playExpanded(clean, 'pinay-nurse');
  assert.equal(clean.statuses.length, 0);
  assert.equal(
    effectiveHands(clean.units.find((u) => u.id === target.id)!),
    10,
  );
});
test('Freeze cannot silently kill a fighter before contact and scores zero at timeout', () => {
  let s = expanded(['snow-bunny']);
  s.units = [expandedUnit('chonk-lee', 'opponent', 0.8)];
  s = playExpanded(s, 'snow-bunny');
  s.elapsedMs = s.durationMs - 50;
  s.statuses[0].expiresAt = s.durationMs + 5000;
  s = advance(s, 50);
  assert.equal(s.winner, 'player');
  assert.equal(s.units.find((u) => u.side === 'opponent')!.hands, 7);
});
test('Teacher prioritizes active ongoing source; protected control package fails cleanly', () => {
  let s = expanded(['teacher', 'buddy']);
  s.units = [
    expandedUnit('chonk-lee', 'opponent', 0.8),
    expandedUnit('buddy', 'opponent', 0.7),
  ];
  s = playExpanded(s, 'teacher');
  assert.equal(s.units.find((u) => u.cardId === 'buddy')!.silenced, true);
  assert.equal(s.units.find((u) => u.cardId === 'chonk-lee')!.silenced, false);
  s = expanded(['teacher', 'buddy']);
  const buddy = expandedUnit('buddy', 'opponent', 0.7);
  buddy.protected = true;
  s.units = [buddy];
  s = playExpanded(s, 'teacher');
  assert.equal(s.statuses.length, 0);
  assert.equal(s.units[0].protected, false);
});
test('Roaster recent-deploy window and whole-package Protection block are explicit', () => {
  let s = expanded(['all-jokes-roaster']);
  s.elapsedMs = 10050;
  s.units = [expandedUnit('chonk-lee', 'opponent', 0.8)];
  s = playExpanded(s, 'all-jokes-roaster');
  assert.equal(s.units[0].hands, 6);
  assert.equal(s.statuses[0].kind, 'burn');
  s = expanded(['all-jokes-roaster']);
  const t = expandedUnit('chonk-lee', 'opponent', 0.8);
  t.protected = true;
  s.units = [t];
  s = playExpanded(s, 'all-jokes-roaster');
  assert.equal(s.units[0].hands, 7);
  assert.equal(s.statuses.length, 0);
  s = expanded(['all-jokes-roaster']);
  s.units = [expandedUnit('chonk-lee', 'opponent', 0.8)];
  s = playExpanded(s, 'all-jokes-roaster');
  assert.equal(s.units[0].hands, 5);
});
test('target-owned Burn persists after source death, has three timed ticks and expires', () => {
  let s = expanded(['all-jokes-roaster']);
  s.units = [expandedUnit('chonk-lee', 'opponent', 0.8, 0, 10)];
  s = playExpanded(s, 'all-jokes-roaster');
  s.units = s.units.filter((u) => u.side === 'opponent');
  s.travelMs = 1000000;
  s = advance(s, 6000);
  assert.equal(s.units[0].hands, 5);
  assert.equal(s.statuses.length, 0);
  assert.equal(s.events.filter((e) => e.type === 'damage').length, 4);
});
test('seeded bombs persist after source death but never pay recycled Kyle, skip empty lanes and late plants', () => {
  let s = playExpanded(expanded(['kyle']), 'kyle');
  assert.equal(s.hazards.length, 4);
  const planted = structuredClone(s.hazards);
  s.units = [
    { ...expandedUnit('kyle', 'player', 0.2), id: 'new-kyle' },
    ...([0, 1, 2] as const).map((l) => ({
      ...expandedUnit('chonk-lee', 'opponent', 0.8, l, 20),
      id: `enemy${l}`,
    })),
  ];
  s.travelMs = 1000000;
  s = advance(s, 10000);
  assert.equal(s.units.find((u) => u.id === 'new-kyle')!.hands, 3);
  assert.equal(s.hazards.length, 0);
  assert.equal(s.events.filter((e) => e.type === 'bomb').length, 4);
  assert.equal(
    s.events
      .filter((e) => e.type === 'damage')
      .reduce((n, e) => n + (e.amount ?? 0), 0),
    8,
  );
  const again = playExpanded(expanded(['kyle']), 'kyle');
  assert.deepEqual(again.hazards, planted);
  const late = expanded(['kyle']);
  late.elapsedMs = late.durationMs - 10000;
  assert.equal(playExpanded(late, 'kyle').hazards.length, 0);
  const empty = advance(playExpanded(expanded(['kyle']), 'kyle'), 10000);
  assert.equal(empty.hazards.length, 0);
  assert.equal(empty.units[0].hands, 3);
});
test('Kyle receives actual hit/KO credit only; blocked bombs yield none', () => {
  let s = playExpanded(expanded(['kyle']), 'kyle');
  s.hazards = s.hazards.slice(0, 1);
  const h = s.hazards[0];
  const victim = expandedUnit('yasuke', 'opponent', 0.8, h.lane, 1);
  s.units.push(victim);
  s.travelMs = 1000000;
  s = advance(s, 10000);
  assert.equal(s.units.find((u) => u.cardId === 'kyle')!.hands, 5);
  assert.ok(!s.units.some((u) => u.id === victim.id));
  s = playExpanded(expanded(['kyle']), 'kyle');
  s.hazards = s.hazards.slice(0, 1);
  const guard = expandedUnit('chonk-lee', 'opponent', 0.8, s.hazards[0].lane);
  guard.protected = true;
  s.units.push(guard);
  s.travelMs = 1000000;
  s = advance(s, 10000);
  assert.equal(s.units.find((u) => u.cardId === 'kyle')!.hands, 3);
});
test('Abuela restores actual wounds only, then lunch heals only first later damage if survived', () => {
  let s = expanded(['abuela']);
  const injured = expandedUnit('chonk-lee', 'player', 0.4, 1, 3);
  injured.maxHands = 7;
  injured.damageTaken = 4;
  s.units = [injured];
  s = playExpanded(s, 'abuela');
  const healed = s.units.find((u) => u.id === injured.id)!;
  assert.equal(healed.hands, 7);
  assert.equal(healed.damageTaken, 1);
  assert.equal(healed.maxHands, 8);
  assert.equal(healed.protected, true);
  s = expanded(['abuela', 'guap']);
  const target = expandedUnit('chonk-lee', 'opponent', 0.7);
  s.units = [target];
  s.players.opponent.hand = ['abuela'];
  s.players.opponent.motion = 9;
  s = deploy(s, 'opponent', 'abuela', 0).state;
  const lunch = s.units.find((u) => u.id === target.id)!;
  assert.ok(lunch.lunch);
  lunch.protected = false;
  s.units = s.units.filter((u) => u.cardId !== 'abuela');
  s = playExpanded(s, 'guap');
  const survived = s.units.find((u) => u.id === target.id)!;
  assert.equal(survived.hands, 8);
  assert.equal(survived.lunch, undefined);
  const healEvent = s.events.find((e) => e.type === 'mend')!;
  assert.equal(healEvent.amount, 1);
  assert.equal(healEvent.sourceSide, 'opponent');
  assert.equal(healEvent.sourceUnitId, 'u1');
});
test('lunch never rescues lethal damage and confiscation does not consume it', () => {
  let s = expanded(['sho-nuff']);
  const target = expandedUnit('chonk-lee', 'opponent', 0.8, 0, 9);
  target.lunch = {
    sourceUnitId: 'abuela-gone',
    sourceSide: 'opponent',
    sourceLane: 0,
    sourcePosition: 0.9,
  };
  s.units = [target];
  s = playExpanded(s, 'sho-nuff');
  assert.ok(s.units[0].lunch);
  assert.equal(s.events.filter((e) => e.type === 'mend').length, 0);
  s = expanded(['dragonfly-jones']);
  const weak = expandedUnit('yasuke', 'opponent', 0.8, 0, 1);
  weak.lunch = target.lunch;
  s.units = [weak];
  s = playExpanded(s, 'dragonfly-jones');
  assert.ok(!s.units.some((u) => u.id === weak.id));
  assert.equal(s.events.filter((e) => e.type === 'mend').length, 0);
});
test('hand-held Fire/Light auras pulse every10s only while held, including Last Stand without drawing', () => {
  let s = expanded(['guap', 'abuela']);
  s.players.player.hand = ['guap', 'abuela'];
  s.players.player.handAuraAt = {};
  s.units = [
    expandedUnit('kyle', 'player', 0.2),
    expandedUnit('yasuke', 'player', 0.2, 1),
  ];
  s.travelMs = 1000000;
  s = advance(s, 50);
  s = advance(s, 9950);
  assert.equal(s.units[0].hands, 3);
  s = advance(s, 50);
  assert.equal(s.units[0].hands, 4);
  assert.equal(s.units[1].hands, 4);
  s.players.player.hand = ['abuela'];
  s = advance(s, 10000);
  assert.equal(s.units[0].hands, 4);
  assert.equal(s.units[1].hands, 5);
  s.elapsedMs = 150000;
  s.players.player.hand = ['guap', 'abuela'];
  s.players.player.handAuraAt = { guap: 150050, abuela: 150050 };
  const queued = [...s.players.player.queue];
  s = advance(s, 50);
  assert.deepEqual(s.players.player.queue, queued);
  assert.equal(s.players.player.hand.length, 2);
  assert.equal(s.units[0].hands, 5);
});
test('FINNAM board hit respects shields, ally buff cap and shared10s repeat gate', () => {
  let s = expanded(['guap']);
  s.units = Array.from({ length: 6 }, (_, i) => ({
    ...expandedUnit(
      'yasuke',
      'player',
      0.3 + Math.floor(i / 3) * (RULES.spacing + 0.03),
      (i % 3) as 0 | 1 | 2,
    ),
    id: `ally${i}`,
  }));
  const guard = expandedUnit('chonk-lee', 'opponent', 0.8);
  guard.protected = true;
  s.units.push(guard);
  s = playExpanded(s, 'guap');
  assert.equal(s.units.find((u) => u.cardId === 'guap')!.hands, 11);
  assert.equal(s.units.find((u) => u.id === guard.id)!.hands, 7);
  assert.equal(s.players.player.finnamReadyAt, 10000);
  s.units = s.units.filter((u) => u.cardId !== 'guap');
  s = playExpanded(s, 'guap');
  assert.equal(s.units.find((u) => u.cardId === 'guap')!.hands, 6);
  assert.equal(s.units.find((u) => u.id === guard.id)!.hands, 7);
});
test('Buddy sprouting targets latest arrival not position or lexical id and survives source leaving', () => {
  let s = playExpanded(expanded(['buddy']), 'buddy');
  assert.ok(s.hazards.length >= 2 && s.hazards.length <= 3);
  const lane = s.hazards[0].lane;
  s.hazards = s.hazards.slice(0, 1);
  s.units = [
    {
      ...expandedUnit('yasuke', 'player', 0.8, lane),
      id: 'u9',
      arrivalOrder: 9,
    },
    {
      ...expandedUnit('kyle', 'player', 0.2, lane),
      id: 'u10',
      arrivalOrder: 10,
    },
  ];
  s.travelMs = 1000000;
  s = advance(s, 20000);
  assert.equal(s.units.find((u) => u.id === 'u9')!.hands, 3);
  assert.equal(s.units.find((u) => u.id === 'u10')!.hands, 6);
  assert.equal(s.hazards.length, 0);
  const late = expanded(['buddy']);
  late.elapsedMs = 160000;
  assert.equal(playExpanded(late, 'buddy').hazards.length, 0);
});
test('Buddy delayed growth applies once to original living instance, empty buds harmless', () => {
  let s = playExpanded(expanded(['buddy']), 'buddy');
  s.hazards = [];
  s.travelMs = 1000000;
  s = advance(s, 20000);
  assert.equal(s.units[0].hands, 6);
  assert.equal(s.units[0].growAt, undefined);
  s = advance(s, 5000);
  assert.equal(s.units[0].hands, 6);
  s = playExpanded(expanded(['buddy']), 'buddy');
  s.units = [];
  s = advance(s, 20000);
  assert.equal(s.hazards.length, 0);
  assert.equal(s.events.filter((e) => e.type === 'buff').length, 0);
});
test('Burn stacking is capped and silence suspends Buddy aura and Inside Man without erasing hazards', () => {
  let s = expanded(['all-jokes-roaster']);
  s.units = [expandedUnit('chonk-lee', 'opponent', 0.8, 0, 30)];
  for (let i = 0; i < 5; i++) {
    s.units = s.units.filter((u) => u.side === 'opponent');
    s = playExpanded(s, 'all-jokes-roaster');
  }
  assert.equal(s.statuses.length, 1);
  assert.equal(s.statuses[0].stacks, 3);
  s = expanded(['teacher', 'buddy']);
  s.units = [expandedUnit('buddy', 'opponent', 0.8)];
  s.hazards = [
    {
      id: 50,
      kind: 'bud',
      side: 'opponent',
      lane: 1,
      sourceUnitId: s.units[0].id,
      sourcePosition: 0.8,
      sourceLane: 0,
      readyAt: 20000,
    },
  ];
  s = playExpanded(s, 'teacher');
  assert.equal(deploymentCost(s, 'opponent', 'buddy', 0), 3);
  assert.equal(s.hazards.length, 1);
  s.travelMs = 1000000;
  s = advance(s, 10000);
  assert.equal(deploymentCost(s, 'opponent', 'buddy', 0), 2);
});
test('all three AI styles return legal side-specific commands with discounted costs', () => {
  let s = expanded(['plug', 'buddy', 'homeless-yn']);
  s = playExpanded(s, 'plug');
  s.units = [];
  s.players.player.hand = ['homeless-yn'];
  s.players.player.motion = 0;
  for (const style of ['rush', 'counter', 'support'] as const) {
    const move = chooseAi(s, 'player', style);
    assert.ok(move);
    assert.notEqual(move.lane, 0);
    assert.equal(
      deploy(s, 'player', move.cardId, move.lane, move.squabble, move.target)
        .error,
      undefined,
    );
    assert.deepEqual(move, chooseAi(s, 'player', style));
  }
});
test('expanded seeded full practice replay preserves independent ten-card identities and bounded trace', () => {
  const player = compatibilityRoster.slice(10).map((c) => c.id),
    opponent = compatibilityRoster.slice(0, 10).map((c) => c.id);
  const run = (frame: number) => {
    let s = createGame(compatibilityRoster, {
      seed: 813,
      decks: { player, opponent },
      aiStyle: 'support',
    });
    for (let at = 0; at < 180000 && s.status === 'playing'; at += 1000) {
      const move = chooseAi(s, 'player', 'rush');
      if (move)
        s = deploy(
          s,
          'player',
          move.cardId,
          move.lane,
          move.squabble,
          move.target,
        ).state;
      for (let t = 0; t < 1000; t += frame)
        s = advancePractice(s, Math.min(frame, 1000 - t));
      for (const side of ['player', 'opponent'] as const) {
        const p = s.players[side],
          ids = [
            ...p.hand,
            ...p.queue,
            ...p.reinforcements.map((r) => r.cardId),
            ...p.returns.map((x) => x.cardId),
            ...s.units.filter((u) => u.side === side).map((u) => u.cardId),
          ];
        assert.equal(ids.length, 10);
        assert.deepEqual(
          new Set(ids),
          new Set(side === 'player' ? player : opponent),
        );
        assert.ok(p.motion >= 0 && p.motion <= 9);
      }
      assert.ok(s.statuses.length <= 60);
      assert.ok(s.hazards.length <= 24);
    }
    return s;
  };
  const result = run(1000);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result, run(50));
  assert.ok(result.commands.length <= 512);
  assert.ok(result.events.length <= 64);
  assert.ok(result.metrics.player.deployments > 0);
  assert.ok(result.metrics.opponent.deployments > 0);
});
test('head-on contact occurs at physical spacing, with actual per-recipient damage and defeat identity', () => {
  const contactA = 0.5 - RULES.spacing / 2,
    contactB = 0.5 + RULES.spacing / 2,
    initialA = contactA - 0.001,
    initialB = contactB + 0.001,
    initialFollower = initialA - RULES.spacing;
  const s = fresh();
  s.units = [
    unit('a', 'player', initialA, 7),
    unit('b', 'opponent', initialB, 4),
    { ...unit('follower', 'player', initialFollower, 2), cardId: 'c2' },
  ];
  const n = advance(s, 50),
    survivor = n.units.find((u) => u.id === 'a')!,
    follower = n.units.find((u) => u.id === 'follower')!;
  assert.ok(Math.abs(survivor.position - contactA) < 1e-9);
  assert.ok(survivor.position >= initialA);
  assert.ok(follower.position >= initialFollower);
  assert.ok(survivor.position - follower.position >= RULES.spacing - 1e-9);
  const hits = n.events.filter((e) => e.type === 'hit');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].amount, undefined);
  const damage = n.events.filter((e) => e.type === 'collision-damage');
  assert.equal(damage.length, 2);
  assert.deepEqual(
    damage.map((e) => [e.targetUnitId, e.amount]),
    [
      ['a', 4],
      ['b', 4],
    ],
  );
  assert.equal(damage[0].sourceUnitId, 'b');
  assert.equal(damage[1].sourceUnitId, 'a');
  assert.equal(damage[0].cardId, 'c0');
  const defeated = n.events.find((e) => e.type === 'defeat')!;
  assert.equal(defeated.targetUnitId, 'b');
  assert.equal(defeated.cardId, 'c1');
  assert.ok(Math.abs(defeated.position! - contactB) < 1e-9);
});
function freezeFor(s: GameState, target: Unit, durationMs = 10000) {
  s.statuses.push({
    id: s.nextEffectId++,
    kind: 'freeze',
    targetId: target.id,
    sourceUnitId: 'source',
    sourceSide: target.side === 'player' ? 'opponent' : 'player',
    sourceLane: target.lane,
    sourcePosition: target.side === 'player' ? 0.9 : 0.1,
    appliedAt: s.elapsedMs,
    nextTickAt: s.elapsedMs + 2000,
    expiresAt: s.elapsedMs + durationMs,
    stacks: 1,
  });
}
test('only the frozen card stops; followers pass it and keep their own spacing in both directions', () => {
  for (const side of ['player', 'opponent'] as const)
    for (const reversed of [false, true]) {
      const at = (position: number) =>
        side === 'player' ? position : 1 - position;
      const s = fresh(),
        front = unit('ice', side, at(0.45), 5),
        follow = unit('follow', side, at(0.3), 3),
        tail = unit('tail', side, at(0.08), 2);
      s.units = [front, follow, tail];
      if (reversed) s.units.reverse();
      freezeFor(s, front);
      const n = advance(s, 5000),
        ice = n.units.find((u) => u.id === 'ice')!,
        a = n.units.find((u) => u.id === 'follow')!,
        b = n.units.find((u) => u.id === 'tail')!;
      assert.equal(ice.position, at(0.45));
      assert.equal(ice.frozen, true);
      assert.equal(ice.hands, 5);
      assert.equal(effectiveHands(ice), 0);
      assert.ok(Math.abs(a.position - at(0.5)) < 1e-9);
      assert.ok(Math.abs(b.position - at(0.28)) < 1e-9);
      assert.ok(Math.abs(a.position - b.position) >= RULES.spacing - 1e-9);
      assert.equal(a.frozen, false);
      assert.equal(b.frozen, false);
      assert.equal(n.players[side].breaches, 0);
      assert.deepEqual(n, advance(advance(s, 1750), 3250));
    }
});
test('freeze at the entrance never blocks an affordable same-lane deployment or its march', () => {
  for (const side of ['player', 'opponent'] as const) {
    let s = fresh();
    s.players[side].motion = 9;
    s = deploy(s, side, s.players[side].hand[0], 0).state;
    const ice = s.units[0];
    freezeFor(s, ice);
    const id = s.players[side].hand[0];
    s = deploy(s, side, id, 0).state;
    assert.ok(s.units.some((u) => u.cardId === id));
    assert.equal(s.players[side].reinforcements.length, 0);
    const n = advance(s, 1000),
      follower = n.units.find((u) => u.cardId === id)!;
    assert.equal(
      n.units.find((u) => u.id === ice.id)!.position,
      side === 'player' ? 0 : 1,
    );
    assert.ok(
      Math.abs(follower.position - (side === 'player' ? 0.04 : 0.96)) < 1e-9,
    );
  }
});
test('passing a frozen ally never bypasses enemy contact or transfers the freeze', () => {
  for (const side of ['player', 'opponent'] as const) {
    const at = (position: number) =>
        side === 'player' ? position : 1 - position,
      enemy = side === 'player' ? 'opponent' : 'player';
    const s = fresh(),
      ice = unit('ice', side, at(0.45), 5);
    s.units = [
      ice,
      unit('follow', side, at(0.3), 3),
      unit('enemy', enemy, at(0.68), 4),
    ];
    freezeFor(s, ice);
    const n = advance(s, 1000);
    assert.ok(!n.units.some((u) => u.id === 'ice'));
    assert.equal(n.units.find((u) => u.id === 'enemy')!.hands, 4);
    assert.equal(n.units.find((u) => u.id === 'follow')!.hands, 3);
    assert.ok(
      n.events.some((e) => e.type === 'defeat' && e.targetUnitId === 'ice'),
    );
    assert.ok(!n.units.some((u) => u.frozen));
    assert.equal(n.players[enemy].breaches, 0);
  }
});
test('thawing amid passing allies rejoins the lane without retreating, teleporting, or stopping its leader', () => {
  for (const side of ['player', 'opponent'] as const) {
    const at = (position: number) =>
      side === 'player' ? position : 1 - position;
    let s = fresh();
    const ice = unit('ice', side, at(0.45), 5);
    s.units = [ice, unit('follow', side, at(0.43), 3)];
    freezeFor(s, ice, 1000);
    for (let i = 0; i < 140; i++) {
      const before = new Map(s.units.map((u) => [u.id, u.position]));
      s = advance(s, 50);
      for (const u of s.units) {
        const moved =
          (u.position - before.get(u.id)!) * (side === 'player' ? 1 : -1);
        assert.ok(moved >= -1e-9 && moved <= RULES.tickMs / s.travelMs + 1e-9);
      }
    }
    assert.ok(s.units.every((u) => !u.frozen));
    assert.ok(
      Math.abs(s.units.find((u) => u.id === 'follow')!.position - at(0.71)) <
        1e-9,
    );
    assert.ok(
      Math.abs(s.units[0].position - s.units[1].position) >=
        RULES.spacing - 1e-9,
    );
  }
});
test('instant deployment streams stay in bounds and never move backwards without an explicit move effect', () => {
  let s = fresh();
  s.travelMs = 100000;
  for (let i = 0; i < 500; i++) {
    for (const side of ['player', 'opponent'] as const) {
      const id = s.players[side].hand.find(
        (id) =>
          s.roster.find((c) => c.id === id)!.cost <= s.players[side].motion,
      );
      if (id) {
        const result = deploy(s, side, id, 0);
        s = result.state;
      }
    }
    const positions = new Map(s.units.map((u) => [u.id, u.position]));
    s = advance(s, 50);
    for (const u of s.units) {
      const old = positions.get(u.id) ?? (u.side === 'player' ? 0 : 1);
      assert.ok(
        u.side === 'player'
          ? u.position >= old - 1e-9
          : u.position <= old + 1e-9,
      );
      assert.ok(u.position >= 0 && u.position <= 1);
    }
    for (const side of ['player', 'opponent'] as const) {
      const queue = s.units
        .filter((u) => u.side === side)
        .sort((a, b) => a.position - b.position);
      for (let j = 1; j < queue.length; j++)
        assert.ok(queue[j].position >= queue[j - 1].position);
    }
    const p = s.units
        .filter((u) => u.side === 'player')
        .sort((a, b) => b.position - a.position)[0],
      o = s.units
        .filter((u) => u.side === 'opponent')
        .sort((a, b) => a.position - b.position)[0];
    if (p && o) assert.ok(o.position - p.position >= RULES.spacing - 1e-9);
  }
});
