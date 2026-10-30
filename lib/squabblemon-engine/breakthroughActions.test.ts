import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  advance,
  advancePractice,
  createGame,
  deploy,
  chooseAi,
  replayCommand,
  deploymentCost,
  legalActionTarget,
  effectiveHands,
  type GameState,
  type Unit,
  type Side,
  type Lane,
} from './src/breakthrough';
import {
  BREAKTHROUGH_ROSTER as roster,
  BREAKTHROUGH_STARTER_DECKS,
  resolveBreakthroughCard,
} from './src/breakthroughCatalog';
const other = (s: Side): Side => (s === 'player' ? 'opponent' : 'player');
let id = 0;
function unit(
  cardId: string,
  side: Side,
  lane: Lane = 0,
  progress = 0.3,
  hands?: number,
): Unit {
  const card = resolveBreakthroughCard(cardId)!;
  return {
    id: `fixture-${++id}`,
    cardId,
    side,
    lane,
    position: side === 'player' ? progress : 1 - progress,
    hands: hands ?? card.hands,
    baseHands: card.hands,
    maxHands: hands ?? card.hands,
    squabbled: false,
    nextEffectAt: 999999,
  };
}
function game(units: Unit[] = []): GameState {
  const deck = BREAKTHROUGH_STARTER_DECKS[0].catalogCardIds;
  const s = createGame(roster, {
    decks: { player: deck, opponent: deck },
    travelMs: 1e9,
  });
  s.units = units;
  for (const side of ['player', 'opponent'] as const) {
    s.players[side].hand = [];
    s.players[side].queue = [];
    s.players[side].handAuraAt = {};
  }
  return s;
}
function play(
  s: GameState,
  card: string,
  side: Side = 'player',
  lane: Lane = 0,
) {
  s.players[side].hand = [card];
  s.players[side].motion = 9;
  const result = deploy(s, side, card, lane);
  assert.equal(result.error, undefined);
  return result.state;
}
const find = (s: GameState, u: Unit) => s.units.find((x) => x.id === u.id)!;
function afflicted(s: GameState, u: Unit) {
  for (const kind of ['freeze', 'silence', 'weaken', 'burn'] as const)
    s.statuses.push({
      id: s.nextEffectId++,
      kind,
      targetId: u.id,
      sourceUnitId: 'enemy-source',
      sourceSide: other(u.side),
      sourceLane: u.lane,
      sourcePosition: 0.8,
      appliedAt: 0,
      nextTickAt: 2000,
      expiresAt: 10000,
      stacks: 1,
    });
  u.frozen = true;
  u.silenced = true;
  u.weakened = true;
  u.burnStacks = 1;
}
test('actions never becomeunits,score,orconsumeSquabble, and failedtargets charge nothing', () => {
  for (const card of ['soul-food', 'cognac-bottle']) {
    const s = game();
    s.players.player.hand = [card];
    const snapshot = structuredClone(s);
    assert.equal(legalActionTarget(s, 'player', card, 0).valid, false);
    const result = deploy(s, 'player', card, 0);
    assert.ok(result.error);
    assert.equal(result.state, s);
    assert.deepEqual(s, snapshot);
  }
  const s = game();
  s.players.player.hand = ['bus-pass'];
  assert.ok(deploy(s, 'player', 'bus-pass', 0, true).error);
  assert.equal(s.players.player.squabbleUsed, false);
  const n = deploy(s, 'player', 'bus-pass', 0).state;
  assert.equal(n.units.length, 0);
  assert.equal(n.players.player.returns[0].cardId, 'bus-pass');
  assert.equal(n.players.player.returns[0].readyAt, 8000);
  assert.equal(n.metrics.player.deployments, 0);
  assert.equal(n.players.player.breaches, 0);
  assert.equal(advance(n, 30000).players.player.breaches, 0);
});
test('BusPass ticket survivesotheractions andfailedfighterplays, discountsnextcharacteronly, thenadds2 beforeentrance', () => {
  let s = play(game([unit('cornball', 'player')]), 'bus-pass');
  assert.equal(s.players.player.transferTicket, true);
  s.players.player.hand = ['cognac-bottle'];
  s.players.player.motion = 1;
  assert.equal(deploymentCost(s, 'player', 'cognac-bottle', 0), 1);
  s = deploy(s, 'player', 'cognac-bottle', 0).state;
  assert.equal(s.players.player.transferTicket, true);
  s.players.player.hand = ['baby-momma'];
  s.players.player.motion = 0;
  assert.ok(deploy(s, 'player', 'baby-momma', 1).error);
  assert.equal(s.players.player.transferTicket, true);
  s.players.player.motion = 3;
  assert.equal(deploymentCost(s, 'player', 'baby-momma', 1), 3);
  s = deploy(s, 'player', 'baby-momma', 1).state;
  assert.equal(s.units.find((u) => u.cardId === 'baby-momma')!.hands, 7);
  assert.equal(s.players.player.motion, 0);
  assert.equal(s.players.player.transferTicket, undefined);
  s.players.player.hand = ['bus-pass'];
  s = deploy(s, 'player', 'bus-pass', 0).state;
  s.players.player.hand = ['bus-pass'];
  assert.ok(deploy(s, 'player', 'bus-pass', 0).error);
});
test('SoulFood fullycleansesweakestafflictedbeforebuff; CognacbuffsonlyweakestlocalandFiregets4', () => {
  for (const side of ['player', 'opponent'] as const) {
    const healthy = unit('cornball', side, 0, 0.3, 1),
      sick = unit('baby-momma', side, 0, 0.5, 8),
      remote = unit('edgar', side, 1, 0.3, 1);
    let s = game([healthy, sick, remote]);
    afflicted(s, sick);
    s = play(s, 'soul-food', side);
    assert.equal(find(s, sick).hands, 11);
    assert.equal(effectiveHands(find(s, sick)), 11);
    assert.equal(s.statuses.length, 0);
    assert.equal(find(s, healthy).hands, 1);
    assert.equal(find(s, remote).hands, 1);
    assert.equal(s.units.length, 3);
    const fire = unit('young-bull', side, 0, 0.3, 1);
    let n = play(game([fire, remote]), 'cognac-bottle', side);
    assert.equal(find(n, fire).hands, 5);
    assert.equal(find(n, remote).hands, 1);
    n = play(game([healthy]), 'cognac-bottle', side);
    assert.equal(find(n, healthy).hands, 4);
  }
});
test('targetlocks reject enemy,remote,noncanonicalandstaletargets atomically; commandsown targetcopies', () => {
  const weak = unit('cornball', 'player', 0, 0.3, 1),
    strong = unit('edgar', 'player', 0, 0.5, 5),
    remote = unit('edgar', 'player', 1),
    enemy = unit('cornball', 'opponent');
  const s = game([weak, strong, remote, enemy]);
  s.players.player.hand = ['soul-food'];
  for (const unitId of [strong.id, remote.id, enemy.id, 'gone']) {
    const n = deploy(s, 'player', 'soul-food', 0, false, { unitId });
    assert.ok(n.error);
    assert.equal(n.state, s);
    assert.equal(s.players.player.motion, 4);
  }
  const target = { unitId: weak.id };
  const n = deploy(s, 'player', 'soul-food', 0, false, target).state;
  target.unitId = 'changed';
  assert.equal(n.commands.at(-1)!.target!.unitId, weak.id);
  assert.deepEqual(replayCommand(s, n.commands[0]).state, n);
});
test('supportsreturnthroughnormal8secondqueue andLastStandneverredrawsaspentaction', () => {
  let s = game([unit('cornball', 'player')]);
  s.players.player.hand = ['soul-food'];
  s = deploy(s, 'player', 'soul-food', 0).state;
  assert.equal(s.players.player.returns.length, 1);
  s = advance(s, 9000);
  assert.ok(s.players.player.hand.includes('soul-food'));
  let end = game([unit('cornball', 'player')]);
  end.elapsedMs = 150000;
  end.players.player.hand = ['soul-food'];
  end = deploy(end, 'player', 'soul-food', 0).state;
  end = advance(end, 15000);
  assert.ok(!end.players.player.hand.includes('soul-food'));
  assert.equal(end.players.player.returns.length, 1);
});
test('ClosetNerdbypassesSideEye butnotProtectionandprivatelyrevealsonlyanactualnewOngoinginterrupt', () => {
  for (const side of ['player', 'opponent'] as const) {
    const target = unit('buddy', other(side), 0, 0.2, 8),
      wife = unit('wifey', other(side), 0, 0.1);
    let s = game([target, wife]);
    s.players[other(side)].hand = ['cornball', 'baby-momma'];
    s = play(s, 'closet-nerd', side);
    assert.equal(find(s, target).silenced, true);
    assert.equal(s.players[other(side)].sideEyeReadyAt ?? 0, 0);
    assert.equal(s.units.find((u) => u.cardId === 'closet-nerd')!.hands, 6);
    const reveal = s.events.find((e) => e.type === 'reveal-hand')!;
    assert.equal(reveal.visibleTo, side);
    assert.equal(reveal.cardId, 'baby-momma');
    const guarded = { ...target, protected: true };
    const blocked = play(game([guarded, wife]), 'closet-nerd', side);
    assert.equal(!!find(blocked, guarded).silenced, false);
    assert.equal(
      blocked.events.filter((e) => e.type === 'reveal-hand').length,
      0,
    );
    assert.equal(
      blocked.units.find((u) => u.cardId === 'closet-nerd')!.hands,
      5,
    );
    const plain = play(game([unit('edgar', other(side))]), 'closet-nerd', side);
    assert.equal(plain.units.find((u) => u.cardId === 'closet-nerd')!.hands, 5);
    assert.equal(
      plain.events.some((e) => e.type === 'reveal-hand'),
      false,
    );
  }
});
test('BabyMomma retaliatesonlyonactualenemydamage, neverblockedhits orconfiscation, andoncepermatch survivesrecycling', () => {
  for (const side of ['player', 'opponent'] as const) {
    const child = unit('edgar', side, 0, 0.3, 8);
    let s = play(game([child]), 'baby-momma', side);
    const mother = s.units.find((u) => u.cardId === 'baby-momma')!;
    assert.equal(mother.familyTargetId, child.id);
    find(s, child).protected = true;
    s = play(s, 'dr-fade', other(side));
    assert.equal(s.players[side].familyRetaliationUsed ?? false, false);
    s = play(s, 'dr-fade', other(side));
    const attacker = s.units.filter((u) => u.cardId === 'dr-fade').at(-1)!;
    assert.equal(attacker.hands, 3);
    assert.equal(s.players[side].familyRetaliationUsed, true);
    s.units = s.units.filter((u) => u.id !== mother.id);
    s = play(s, 'baby-momma', side);
    s = play(s, 'dr-fade', other(side));
    assert.equal(
      s.units.filter((u) => u.cardId === 'dr-fade').at(-1)!.hands,
      5,
    );
    const bonus = unit('edgar', side, 0, 0.3, 8);
    let trim = play(game([bonus]), 'baby-momma', side);
    trim = play(trim, 'sho-nuff', other(side));
    assert.equal(trim.players[side].familyRetaliationUsed ?? false, false);
  }
});
test('familydefeatgrantsMother2, retaliationrespectsProtection anddisabledmotherdoesnotreact', () => {
  const child = unit('cornball', 'player', 0, 0.3, 1);
  let s = play(game([child]), 'baby-momma');
  s = play(s, 'mr-mc-hands', 'opponent');
  assert.equal(s.units.find((u) => u.cardId === 'baby-momma')!.hands, 5); // McHands hits Mother for2 too, then familyKO gives2.
  assert.equal(s.units.find((u) => u.cardId === 'mr-mc-hands')!.hands, 2);
  assert.equal(
    s.units.some((u) => u.id === child.id),
    false,
  );
  const guardedChild = unit('edgar', 'player', 0, 0.3, 8);
  let defended = play(
    game([
      guardedChild,
      unit('nguyen', 'opponent', 1),
      unit('john-henry', 'opponent', 2),
    ]),
    'baby-momma',
  );
  defended = play(defended, 'leroy', 'opponent');
  const guardedAttacker = defended.units.find((u) => u.cardId === 'leroy')!;
  assert.equal(guardedAttacker.hands, 8);
  assert.equal(guardedAttacker.protected, false);
  assert.equal(defended.players.player.familyRetaliationUsed, true);
  const weak = unit('edgar', 'player', 0, 0.3, 7);
  let disabled = play(game([weak]), 'baby-momma');
  const mom = disabled.units.find((u) => u.cardId === 'baby-momma')!;
  disabled.statuses.push({
    id: 1,
    kind: 'silence',
    targetId: mom.id,
    sourceUnitId: 'mute',
    sourceSide: 'opponent',
    sourceLane: 0,
    sourcePosition: 0.8,
    appliedAt: 0,
    nextTickAt: 2000,
    expiresAt: 10000,
    stacks: 1,
  });
  mom.silenced = true;
  disabled = play(disabled, 'dr-fade', 'opponent');
  assert.equal(disabled.players.player.familyRetaliationUsed ?? false, false);
});
test('Motherfollowsonelegalfamilymove withprogresspreserved andneverrearmsafterreturning', () => {
  const child = unit('edgar', 'player', 0, 0.3, 1);
  let s = play(game([child]), 'baby-momma');
  const mother = s.units.find((u) => u.cardId === 'baby-momma')!;
  s = play(s, 'cool-vibe-yn', 'player', 1);
  assert.equal(find(s, child).lane, 1);
  assert.equal(find(s, mother).lane, 1);
  assert.equal(find(s, mother).position, 0);
  assert.equal(s.players.player.familyFollowUsed, true);
  s = play(s, 'cool-vibe-yn', 'player', 2);
  assert.equal(find(s, child).lane, 2);
  assert.equal(find(s, mother).lane, 1);
  s.units = s.units.filter((u) => u.id !== mother.id);
  s = play(s, 'baby-momma', 'player', 2);
  const returned = s.units.find((u) => u.cardId === 'baby-momma')!;
  s = play(s, 'cool-vibe-yn', 'player', 0);
  assert.equal(find(s, child).lane, 0);
  assert.equal(find(s, returned).lane, 2);
});
test('allfiveactualstarterdecks runcompleteCPUduelswithactionsandidentityconservationindependentlyofrenderchunks', () => {
  for (const deck of BREAKTHROUGH_STARTER_DECKS) {
    const run = (frame: number) => {
      let s = createGame(roster, {
        seed: 431,
        decks: { player: deck.catalogCardIds, opponent: deck.catalogCardIds },
      });
      for (
        let time = 0;
        time < 180000 && s.status === 'playing';
        time += 1000
      ) {
        const command = chooseAi(s, 'player', 'support');
        if (command) {
          const n = deploy(
            s,
            'player',
            command.cardId,
            command.lane,
            command.squabble,
            command.target,
          );
          assert.equal(n.error, undefined);
          s = n.state;
        }
        for (
          let elapsed = 0;
          elapsed < 1000 && s.status === 'playing';
          elapsed += frame
        )
          s = advancePractice(s, Math.min(frame, 1000 - elapsed));
        for (const side of ['player', 'opponent'] as const) {
          const p = s.players[side],
            ids = [
              ...p.hand,
              ...p.queue,
              ...p.returns.map((r) => r.cardId),
              ...p.reinforcements.map((r) => r.cardId),
              ...s.units.filter((u) => u.side === side).map((u) => u.cardId),
            ];
          assert.deepEqual(ids.sort(), [...deck.catalogCardIds].sort());
          assert.ok(p.motion >= 0 && p.motion <= 9);
        }
      }
      assert.equal(s.status, 'complete');
      assert.ok(
        s.events.every(
          (e) =>
            e.type !== 'deploy' ||
            resolveBreakthroughCard(e.cardId!)!.kind !== 'support',
        ),
      );
      return s;
    };
    assert.deepEqual(run(1000), run(50), deck.id);
  }
});
