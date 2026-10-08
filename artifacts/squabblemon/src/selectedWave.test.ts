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
    assert.equal(find(first.m, a)?.powerModifier, 1);
    const second = cast(first.m, 'one-man-band', o, 1);
    assert.equal(find(second.m, a)?.powerModifier, 1);
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
        2,
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
    assert.equal(find(a.m, athlete)?.powerModifier, 1);
    const b = cast(a.m, 'last-set-og', owner, 2);
    assert.equal(find(b.m, athlete)?.powerModifier, 1);
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
