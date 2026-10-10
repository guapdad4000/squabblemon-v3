import {
  createOnlineRoom,
  joinOnlineRoom,
  applyOnlineCommand,
  onlineRoomView,
} from '../../../lib/squabblemon-engine/src/multiplayer';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, cardCatalog, decks } from './data';
import {
  getLegalCardCost,
  createAbilityUpgradeSnapshot,
  createMatchFromEngineCards,
  verifyMatchTranscript,
  pass,
  revealCpuTurn,
  type PlayerMove,
  createMatch,
  createCardInstance,
  playTurnCard,
  nextRound,
  type Match,
  type Owner,
  type Lane,
  type CardInstance,
} from './gameEngine';
import {
  SELECTED_WAVE,
  selectedCards,
} from '../../../lib/squabblemon-engine/src/selectedWave';
const blank = (): Match => ({
  ...createMatch('block', 'block'),
  round: 3,
  boards: [[], [], []],
  playerHand: [],
  cpuHand: [],
  playerMotion: 9,
  cpuMotion: 9,
});
const unit = (id: string, o: Owner, l: Lane, i = 0): CardInstance => ({
  ...createCardInstance(id, o, 'selected-fixture', i),
  lane: l,
  playedRound: 3,
});
const find = (m: Match, c: CardInstance) =>
  m.boards.flat().find((x) => x.instanceId === c.instanceId);
const cast = (
  m: Match,
  id: string,
  o: Owner,
  l: Lane = 0,
  patch: Partial<CardInstance> = {},
) => {
  const s = {
    ...createCardInstance(id, o, 'selected-cast', m.nextEventSequence),
    ...patch,
  };
  return {
    s,
    m: playTurnCard(
      {
        ...m,
        phase: o === 'player' ? 'player' : 'cpu-reveal',
        playerMotion: 9,
        cpuMotion: 9,
        [o === 'player' ? 'playerHand' : 'cpuHand']: [s],
      },
      o,
      s.instanceId,
      l,
    ),
  };
};
test('31 selected collectibles have unique stable IDs, rarity, and three training levels; summons excluded', () => {
  assert.equal(SELECTED_WAVE.length, 31);
  assert.equal(cardCatalog.filter((c) => selectedCards[c.engineId]).length, 31);
  assert(!cardCatalog.some((c) => c.engineId === 'fake-marriage'));
  for (const [id] of SELECTED_WAVE) {
    assert.equal(cards[id].id, id);
    assert.equal(cards[id].abilityUpgrades.length, 3);
    assert(cardCatalog.find((c) => c.engineId === id)?.rarity);
  }
});
for (const o of ['player', 'cpu'] as const) {
  const rival: Owner = o === 'player' ? 'cpu' : 'player';
  for (const [id] of SELECTED_WAVE)
    test(`${o}: ${id} deterministic immutable resolution and disabled entrance`, () => {
      const m = blank();
      m.boards = [
        [
          unit('fitness-bro', o, 0),
          unit('the-rapper', o, 0),
          { ...unit('og', rival, 0), powerModifier: 4 },
        ],
        [unit('fitness-girl', o, 1), unit('homelessguy', o, 1)],
        [],
      ];
      const old = JSON.stringify(m);
      const a = cast(m, id, o);
      assert.equal(JSON.stringify(m), old);
      assert.deepEqual(a, cast(JSON.parse(old), id, o));
      assert.doesNotThrow(() =>
        JSON.stringify(nextRound({ ...a.m, phase: 'resolved' })),
      );
      for (const lane of a.m.boards)
        for (const side of ['player', 'cpu'])
          assert(lane.filter((c) => c.owner === side && !c.hazard).length <= 4);
      const disabled = cast(m, id, o, 0, {
        statuses: { ...createCardInstance(id, o).statuses, silenced: true },
      });
      assert(
        !disabled.m.creativeMarks?.some(
          (x) => x.source.instanceId === disabled.s.instanceId,
        ),
      );
      assert.equal(find(disabled.m, disabled.s)?.waveTrainingUsed, undefined);
    });
  test(`${o}: cook recovers actual injury and shields Homeless recipient; copies cannot refeed`, () => {
    let m = blank();
    const h = { ...unit('homelessguy', o, 0), powerModifier: -2 };
    m.boards[0] = [h];
    let a = cast(m, 'community-cook', o);
    assert.equal(find(a.m, h)?.powerModifier, 0);
    assert.equal(find(a.m, h)?.statuses.protected, true);
    const b = cast(a.m, 'community-cook', o);
    assert.equal(find(b.m, h)?.powerModifier, 0);
  });
  test(`${o}: bag movement is shared per side per round and only legal arrival pays`, () => {
    const m = blank(),
      ally = unit('fitness-bro', o, 0);
    m.boards[0] = [ally];
    const a = cast(m, 'gym-bag-yn', o);
    assert.notEqual(find(a.m, ally)?.lane, 0);
    const fresh = unit('fitness-girl', o, 0, 2);
    a.m.boards[0].push(fresh);
    const b = cast(a.m, 'gym-bag-yn', o);
    assert.equal(find(b.m, fresh)?.lane, 0);
    const locked = blank();
    locked.boards[0] = [
      { ...ally, statuses: { ...ally.statuses, locked: true } },
    ];
    const c = cast(locked, 'gym-bag-yn', o);
    assert.equal(find(c.m, ally)?.lane, 0);
    assert(!c.m.creativeMarks?.some((x) => x.id.endsWith('gym-bag-yn')));
  });
  test(`${o}: Naija summons exactly one capped token; full district cannot spend summon`, () => {
    let m = blank();
    let a = cast(m, 'naija-scammer', o);
    assert.equal(
      a.m.boards.flat().filter((c) => c.cardId === 'fake-marriage').length,
      1,
    );
    let b = cast(a.m, 'naija-scammer', o, 1);
    assert.equal(
      b.m.boards.flat().filter((c) => c.cardId === 'fake-marriage').length,
      1,
    );
    const full = blank();
    full.boards[0] = [
      unit('cornball', o, 0, 0),
      unit('cornball', o, 0, 1),
      unit('cornball', o, 0, 2),
    ];
    const c = cast(full, 'naija-scammer', o);
    assert.equal(c.m.boards[0].length, 4);
    assert(!c.m.creativeMarks?.some((x) => x.id.endsWith('naija-scammer')));
  });
  test(`${o}: thieves cannot steal base Hands and protection blocks bonus trimming`, () => {
    let m = blank();
    const victim = unit('og', rival, 0);
    m.boards[0] = [victim];
    let a = cast(m, 'booster', o);
    assert.equal(find(a.m, victim)?.powerModifier, 0);
    assert.equal(find(a.m, a.s)?.powerModifier, 0);
    m.boards[0] = [
      {
        ...victim,
        powerModifier: 3,
        statuses: { ...victim.statuses, protected: true },
      },
    ];
    m.timedEffects = [
      {
        id: 'test-shield',
        kind: 'church-protection',
        sourceInstanceId: victim.instanceId,
        targetInstanceId: victim.instanceId,
        owner: rival,
        lane: 0,
        startsAtRound: 3,
        expiresAtRound: 5,
        expiration: 'round-start',
      },
    ];
    a = cast(m, 'indian-scammer', o);
    assert.equal(find(a.m, victim)?.powerModifier, 3);
  });
  test(`${o}: one-man band finisher is shared across copies`, () => {
    const m = blank();
    const a = unit('the-rapper', o, 0),
      b = unit('the-dj', o, 1),
      c = unit('mixtape-cousin', o, 2);
    m.boards = [[a], [b], [c]];
    const first = cast(m, 'one-man-band', o);
    assert.equal(find(first.m, a)?.powerModifier, 4);
    const second = cast(first.m, 'one-man-band', o, 1);
    assert.equal(find(second.m, a)?.powerModifier, 4);
  });
  test(`${o}: fit new Music and Fitness cards into existing tribe triggers`, () => {
    const m = blank();
    m.boards[0] = [unit('the-rapper', o, 0), unit('og', rival, 0)];
    const a = cast(m, 'studio-couch-yn', o);
    assert(a.m.effectLog.some((e) => e.note?.includes('Sixteen Bars')));
  });
}

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: merch grants local Music credit only twice and never below one`, () => {
    let m = blank();
    const merch = unit('merch-table-hustler', owner, 0);
    const artist = unit('the-rapper', owner, 0);
    m.boards[0] = [merch, artist];
    const a = cast(m, 'studio-couch-yn', owner);
    assert.equal(
      a.m.discountTokens.filter((x) => x.eligibility === 'selected-music')
        .length,
      1,
    );
    const cheap = createCardInstance('studio-couch-yn', owner);
    assert.equal(getLegalCardCost(a.m, owner, cheap, 0), 1);
    assert.equal(
      getLegalCardCost(
        a.m,
        owner,
        createCardInstance('mixtape-cousin', owner),
        1,
      ),
      2,
    );
    assert.equal(
      getLegalCardCost(a.m, owner, createCardInstance('cornball', owner), 0),
      1,
    );
    let b = cast(a.m, 'mixtape-cousin', owner);
    assert.equal(
      b.m.creativeMarks?.find((x) => x.id.endsWith('merch-table-hustler'))
        ?.amount,
      1,
    );
  });
  test(`${owner}: family sharing is bounded and does not recursively feed cousins`, () => {
    const m = blank(),
      first = unit('second-plate-cousin', owner, 0),
      second = unit('second-plate-cousin', owner, 0, 1),
      sister = unit('big-sister', owner, 0);
    m.boards[0] = [first, second, sister];
    const a = cast(m, 'plate-auntie', owner);
    assert.equal(
      a.m.creativeMarks?.find((x) => x.id.endsWith('second-plate-cousin'))
        ?.amount,
      1,
    );
    assert(
      (find(a.m, first)?.powerModifier ?? 0) +
        (find(a.m, second)?.powerModifier ?? 0) <=
        4,
    );
  });
  test(`${owner}: complete Fitness route activates Last Set without return resetting it`, () => {
    const m = blank(),
      athlete = unit('fitness-bro', owner, 1);
    m.boards[1] = [athlete];
    m.creativeMarks = [
      {
        id: `sw:${owner}:route:${athlete.instanceId}`,
        kind: 'sw-ledger',
        source: athlete,
        owner,
        lane: 1,
        targets: [],
        expires: 99,
        seen: ['0', '1', '2'],
      },
    ];
    const a = cast(m, 'last-set-og', owner);
    assert.equal(find(a.m, athlete)?.powerModifier, 2);
    const b = cast(a.m, 'last-set-og', owner, 2);
    assert.equal(find(b.m, athlete)?.powerModifier, 2);
  });
  test(`${owner}: each training tier pays once only after successful entrance`, () => {
    for (const tier of [0, 1, 2, 3]) {
      const m = blank(),
        ally = unit('the-rapper', owner, 0);
      m.boards[0] = [ally];
      m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(
        owner === 'player' ? ['studio-couch-yn'] : [],
        owner === 'cpu' ? ['studio-couch-yn'] : [],
        {
          [owner]: {
            'studio-couch-yn': {
              level: [1, 2, 5, 8][tier],
              xp: 2800,
              moveTier: tier,
            },
          },
        },
      );
      const a = cast(m, 'studio-couch-yn', owner);
      assert.equal(find(a.m, a.s)?.powerModifier, tier);
    }
  });
}
test('all selected cards complete server-verifiable battles with stable replay serialization', () => {
  const ids = SELECTED_WAVE.map((row) => row[0]);
  for (let offset = 0; offset < ids.length; offset += 8) {
    const crew = [...ids.slice(offset, offset + 8)];
    for (const id of [
      'cornball',
      'plug',
      'wifey',
      'rastamon',
      'snow',
      'bikelife',
      'og',
      'baby',
    ]) {
      if (crew.length === 10) break;
      crew.push(id);
    }
    let m = createMatchFromEngineCards('selected-custom', crew, 'block', [
      ...decks.find((d) => d.id === 'block')!.cards,
    ]);
    const moves: PlayerMove[] = [];
    let steps = 0;
    while (m.phase !== 'complete' && steps++ < 30) {
      const choice = m.playerHand
        .flatMap((card) =>
          ([0, 1, 2] as Lane[]).map((lane) => ({
            card,
            lane,
            cost: getLegalCardCost(m, 'player', card, lane),
          })),
        )
        .find(
          (x) =>
            x.cost <= m.playerMotion &&
            m.boards[x.lane].filter((c) => c.owner === 'player' && !c.hazard)
              .length < 4,
        );
      if (choice) {
        moves.push({
          cardInstanceId: choice.card.instanceId,
          lane: choice.lane,
          squabble: false,
          endTurn: false,
        });
        m = playTurnCard(m, 'player', choice.card.instanceId, choice.lane);
      }
      moves.push({
        cardInstanceId: null,
        lane: null,
        squabble: false,
        endTurn: true,
      });
      m = nextRound(revealCpuTurn(pass(m, 'player')));
    }
    assert.equal(m.phase, 'complete');
    assert.deepEqual(
      verifyMatchTranscript('selected-custom', 'block', moves, undefined, crew),
      m,
    );
  }
});
for (const owner of ['player', 'cpu'] as const)
  test(`${owner}: all selected kits resolve identically in authoritative online rooms`, () => {
    const member = (userId: string, id: string) => {
      const d = decks.find((d) => d.id === id)!;
      return {
        userId,
        name: userId,
        ready: false,
        deck: { ...d, cards: [...d.cards] },
      };
    };
    let room = joinOnlineRoom(
      createOnlineRoom(member('a', 'music-tour'), 'player', 0),
      member('b', 'fitness-routes'),
      0,
    );
    room = applyOnlineCommand(room, 'player', { type: 'ready' }, 1);
    room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, 2);
    const rival: Owner = owner === 'player' ? 'cpu' : 'player';
    for (const [id] of SELECTED_WAVE) {
      const state = blank();
      state.boards = [
        [
          unit('the-rapper', owner, 0),
          unit('fitness-bro', owner, 0),
          { ...unit('og', rival, 0), powerModifier: 3 },
        ],
        [unit('fitness-girl', owner, 1)],
        [],
      ];
      const s = createCardInstance(id, owner, 'online-selected', 0);
      const initial = {
        ...state,
        phase:
          owner === 'player' ? ('player' as const) : ('cpu-reveal' as const),
        [owner === 'player' ? 'playerHand' : 'cpuHand']: [s],
      };
      const expected = playTurnCard(
        JSON.parse(JSON.stringify(initial)),
        owner,
        s.instanceId,
        0,
      );
      const actual = applyOnlineCommand(
        { ...room, match: initial, activeSeat: owner, turnsEnded: 0 },
        owner,
        { type: 'play', instanceId: s.instanceId, lane: 0, squabble: false },
        10,
      );
      assert.deepEqual(actual.match!.boards, expected.boards, id);
      assert.deepEqual(
        actual.match!.creativeMarks ?? [],
        expected.creativeMarks ?? [],
        id,
      );
      const view = onlineRoomView(
        JSON.parse(JSON.stringify(actual)),
        'SELECTED',
        owner === 'player' ? 'a' : 'b',
        11,
      );
      assert(
        view.boards.flat().some((c) => c.cardId === id),
        id,
      );
    }
  });

for (const owner of ['player', 'cpu'] as const) {
  const rival: Owner = owner === 'player' ? 'cpu' : 'player';
  test(`${owner}: bonus thieves select a boosted enemy rather than an unboosted larger body`, () => {
    for (const id of ['booster', 'barbershop-heckler', 'indian-scammer']) {
      const m = blank();
      const plain = unit('og', rival, 0);
      const boosted = {...unit('cornball', rival, 0, 1), powerModifier: 2};
      m.boards[0] = [plain, boosted];
      const result = cast(m, id, owner).m;
      assert.equal(find(result, plain)?.powerModifier, 0);
      assert.equal(find(result, boosted)?.powerModifier, id === 'booster' ? 1 : 0);
    }
  });
  test(`${owner}: spotter pays immediate setup and preserves the next-round route ward`, () => {
    const m = blank(), athlete = unit('calisthenics-yn', owner, 0);
    m.boards[0] = [athlete];
    const result = cast(m, 'gym-spotter-yn', owner).m;
    assert.equal(find(result, athlete)?.powerModifier, 1);
    assert.equal(find(result, athlete)?.statuses.protected, true);
    const ward = result.creativeMarks?.find(x => x.kind === 'sw-ward');
    assert.equal(ward?.expires, m.round + 1);
    result.round += 1;
    // Keep the ward recipient the weakest athlete when the route starts.
    result.boards[0] = result.boards[0].map(c => c.cardId === 'gym-spotter-yn' ? {...c, powerModifier: 4} : c);
    const moved = cast(result, 'gym-bag-yn', owner).m;
    assert.notEqual(find(moved, athlete)?.lane, 0);
    // +1 spotter arrival and +2 Bodyweight, each paid once.
    assert.equal(find(moved, athlete)?.powerModifier, 4);
    assert(!moved.creativeMarks?.some(x => x.kind === 'sw-ward'));
  });
  test(`${owner}: cook heals only real loss, feeds uninjured allies and keeps per-recipient cap`, () => {
    const m = blank(), injured = {...unit('homelesslegend', owner, 0), powerModifier: -4};
    m.boards[0] = [injured];
    const first = cast(m, 'community-cook', owner).m;
    assert.equal(find(first, injured)?.powerModifier, -1);
    assert.equal(find(cast(first, 'community-cook', owner).m, injured)?.powerModifier, -1);
    const healthy = blank(), ally = unit('cornball', owner, 0);
    healthy.boards[0] = [ally];
    assert.equal(find(cast(healthy, 'community-cook', owner).m, ally)?.powerModifier, 2);
  });
  test(`${owner}: Grandma retains the one-entrance cap and both sides of route payoff`, () => {
    for (const routed of [false, true]) {
      const m = blank(), target = {...unit('og', rival, 0), powerModifier: 4};
      m.boards[0] = [target];
      if (routed) m.roundMovedIds = {...m.roundMovedIds, [owner]: ['route-a', 'route-b']};
      const result = cast(m, 'grandma-said-sit-down', owner).m;
      assert.equal(find(result, target)?.powerModifier, 4 - (routed ? 3 : 2));
    }
  });
}

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: Jump Rope pays distinct first and second legs with a six-Hand shared match cap`, () => {
    let m = blank();
    const menace = unit('jump-rope-menace', owner, 0);
    m.boards[0] = [menace];
    for (let lap = 0; lap < 3; lap++) {
      m.round = 3 + lap;
      m.roundMovedIds = {...m.roundMovedIds, [owner]: []};
      m.boards = [[find(m, menace)!], [], []];
      const first = cast(m, 'track-suit-auntie', owner).m;
      assert.equal(find(first, menace)?.powerModifier, Math.min(6, lap * 3 + 2));
      const second = cast(first, 'stairwell-sprinter', owner).m;
      assert.equal(find(second, menace)?.powerModifier, Math.min(6, lap * 3 + 3));
      m = second;
    }
  });
}

for (const owner of ['player', 'cpu'] as const) {
  for (const [heldId, entrantId] of [['og-calisthenics', 'track-suit-auntie'], ['one-man-band', 'the-manager-nice']] as const) {
    test(`${owner}: held ${heldId} pays once per round, shares a two-payout match cap and stops when absent`, () => {
      const key = owner === 'player' ? 'playerHand' : 'cpuHand';
      let m = blank();
      const held = createCardInstance(heldId, owner, 'held', 1);
      const duplicate = createCardInstance(heldId, owner, 'held', 2);
      m = {...m, [key]: [held, duplicate]};
      for (let round = 3; round <= 5; round++) {
        m = {...m, round, boards: [[], [], []]};
        for (let entrance = 0; entrance < 2; entrance++) {
          const c = createCardInstance(entrantId, owner, 'hand-trigger', round * 10 + entrance);
          m = playTurnCard({...m, phase: owner === 'player' ? 'player' : 'cpu-reveal', playerMotion: 9, cpuMotion: 9, [key]: [...m[key], c]}, owner, c.instanceId, 0);
          assert.equal(find(m, c)?.powerModifier, entrance === 0 && round < 5 ? 2 : 0);
          assert.equal(m[key].filter(x => x.cardId === heldId).length, 2);
        }
      }
      const ledger = m.creativeMarks?.find(x => x.id === `sw:${owner}:${heldId}:hand`);
      assert.equal(ledger?.amount, 2);
      assert.equal(held.powerModifier, 0);
      const fresh = createCardInstance(entrantId, owner, 'unheld', 99);
      m = playTurnCard({...blank(), [key]: [fresh], phase: owner === 'player' ? 'player' : 'cpu-reveal'}, owner, fresh.instanceId, 0);
      assert.equal(find(m, fresh)?.powerModifier, 0);
    });
    test(`${owner}: disabled held ${heldId} cannot coach`, () => {
      const key = owner === 'player' ? 'playerHand' : 'cpuHand';
      const held = createCardInstance(heldId, owner, 'disabled', 1);
      held.statuses.silenced = true;
      const c = createCardInstance(entrantId, owner, 'disabled', 2);
      const m = playTurnCard({...blank(), [key]: [held, c], phase: owner === 'player' ? 'player' : 'cpu-reveal'}, owner, c.instanceId, 0);
      assert.equal(find(m, c)?.powerModifier, 0);
    });
  }
}

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: held-hand coaching matches online authority and keeps the rival hand private`, () => {
    const member = (userId: string) => { const d = decks.find(x => x.id === 'music-tour')!; return {userId, name:userId, ready:false, deck:{...d, cards:[...d.cards]}}; };
    let room = joinOnlineRoom(createOnlineRoom(member('a'), 'player', 0), member('b'), 0);
    room = applyOnlineCommand(room, 'player', {type:'ready'}, 1);
    room = applyOnlineCommand(room, 'cpu', {type:'ready'}, 2);
    for (const [heldId, entrantId] of [['og-calisthenics','track-suit-auntie'],['one-man-band','the-manager-nice']] as const) {
      const key = owner === 'player' ? 'playerHand' : 'cpuHand';
      const held = createCardInstance(heldId, owner, 'online-held', 1), entrant = createCardInstance(entrantId, owner, 'online-held', 2);
      const initial: Match = {...blank(), phase:owner === 'player' ? 'player' : 'cpu-reveal', [key]:[held, entrant]};
      const expected = playTurnCard(structuredClone(initial), owner, entrant.instanceId, 0);
      const actual = applyOnlineCommand({...room, match:initial, activeSeat:owner, turnsEnded:0}, owner, {type:'play',instanceId:entrant.instanceId,lane:0,squabble:false}, 10);
      assert.deepEqual(actual.match, expected);
      assert(actual.match!.effectLog.some(e => e.note?.includes('(In Hand)')));
      const rivalView = onlineRoomView(actual, 'HELD', owner === 'player' ? 'b' : 'a', 11);
      assert.equal(rivalView.rivalHandCount, 1);
      assert(!rivalView.hand.some(c => c.cardId === heldId));
    }
  });
}

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: Fitness recovery clears destination athletes only after a legal move`, () => {
    const m = blank();
    const athlete = {...unit('calisthenics-yn', owner, 1), powerModifier:-3, recoverableDamage:3};
    athlete.statuses.burnStacks=3; athlete.statuses.silenced=true;
    const otherAthlete=unit('jump-rope-menace',owner,1,2); otherAthlete.statuses.burnStacks=2;
    const elsewhere=unit('fitness-bro',owner,2); elsewhere.statuses.burnStacks=2;
    const foe=unit('calisthenics-yn',owner==='player'?'cpu':'player',1,3); foe.statuses.burnStacks=2;
    m.boards=[[ ],[athlete,otherAthlete,foe],[{...elsewhere,basePower:99}]];
    const result=cast(m,'fitness-girl',owner,0).m;
    assert.equal(find(result,athlete)?.statuses.burnStacks,0);
    assert.equal(find(result,otherAthlete)?.statuses.burnStacks,0);
    assert.equal(find(result,athlete)?.recoverableDamage,0);
    assert.equal(find(result,athlete)?.statuses.silenced,true);
    assert.equal(find(result,elsewhere)?.statuses.burnStacks,2);
    assert.equal(find(result,foe)?.statuses.burnStacks,2);
    const blocked=cast(m,'fitness-girl',owner,0,{statuses:{...createCardInstance('fitness-girl',owner).statuses,locked:true}}).m;
    assert.equal(find(blocked,athlete)?.statuses.burnStacks,3);
    assert.equal(find(blocked,athlete)?.recoverableDamage,3);
  });
  test(`${owner}: OG Calisthenics rewards all three districts once across copies`, () => {
    const m=blank(); const athletes=[unit('gym-bag-yn',owner,0),unit('calisthenics-yn',owner,1),unit('stairwell-sprinter',owner,2)];
    m.boards=athletes.map(c=>[c]) as Match['boards'];
    const first=cast(m,'og-calisthenics',owner,0).m;
    for(const c of athletes) assert.equal(find(first,c)?.powerModifier,5);
    const second=cast(first,'og-calisthenics',owner,1).m;
    for(const c of athletes) assert.equal(find(second,c)?.powerModifier,5);
  });
  test(`${owner}: OG Rap Legend's distributed bonus stays shared and finite`, () => {
    const m=blank(); const a=unit('the-rapper',owner,1), b=unit('the-local-celebrity',owner,2);
    m.boards=[[],[a],[b]];
    const first=cast(m,'the-og-rap-legend',owner,0).m;
    assert.equal(find(first,a)?.powerModifier,3);assert.equal(find(first,b)?.powerModifier,3);
    const second=cast(first,'the-og-rap-legend',owner,0).m;
    assert.equal(find(second,a)?.powerModifier,3);assert.equal(find(second,b)?.powerModifier,3);
  });
}
