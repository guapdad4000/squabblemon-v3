import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOnlineCommand,
  CARD_BALANCE_VERSION,
  createOnlineRoom,
  expireOnlineRoom,
  joinOnlineRoom,
  onlineRoomView,
  ROOM_LIFETIME_MS,
  ONLINE_RULES_VERSION,
  type OnlineRoom,
  type Seat,
} from "../../../lib/squabblemon-engine/src/multiplayer";
import { cards, decks } from "../../../lib/squabblemon-engine/src/data";

function fixture(opening: Seat = "player") {
  const member = (userId: string, deck: (typeof decks)[number]) => ({
    userId,
    name: userId,
    ready: false,
    deck: {
      id: deck.id,
      name: deck.name,
      cards: [...deck.cards],
      hero: deck.hero,
    },
  });
  let room = createOnlineRoom(member("a", decks[0]), opening, 0);
  room = joinOnlineRoom(room, member("b", decks[1]), 0);
  room = applyOnlineCommand(room, "player", { type: "ready" }, 1);
  return applyOnlineCommand(room, "cpu", { type: "ready" }, 2);
}
test("card balance and online room versions reject incompatible in-progress fades safely", () => {
  const room = fixture();
  assert.equal(room.rulesVersion, ONLINE_RULES_VERSION);
  assert.equal(CARD_BALANCE_VERSION, 5);
  assert.doesNotThrow(() => applyOnlineCommand(room, "player", { type: "end-turn" }, 3));
  assert.throws(
    () => applyOnlineCommand({ ...room, rulesVersion: ONLINE_RULES_VERSION - 1 }, "player", { type: "end-turn" }, 3),
    /older rules version|new room/,
  );
});

test('both players receive saved sticker avatars through ready, reconnect and rematch', () => {
  let room = fixture();
  room.members.player.avatarKey = 'sticker:kyle:point';
  room.members.cpu!.avatarKey = 'sticker:stockz:portrait';
  const check = () => {
    for (const seat of ['player', 'cpu'] as const) {
      const view = onlineRoomView(room, 'AVATAR-TEST', room.members[seat]!.userId, 10);
      assert.equal(view.members.player!.avatarKey, 'sticker:kyle:point');
      assert.equal(view.members.cpu!.avatarKey, 'sticker:stockz:portrait');
      assert.equal('userId' in view.members.player!, false);
    }
  };
  check();
  room = JSON.parse(JSON.stringify(room));
  check();
  room = applyOnlineCommand(room, 'player', { type: 'surrender' }, 11);
  room = applyOnlineCommand(room, 'player', { type: 'rematch' }, 12);
  room = applyOnlineCommand(room, 'cpu', { type: 'rematch' }, 13);
  check();
});

test("six rounds alternate the first human, preserve multi-card turns, and never auto-play a CPU", () => {
  let room = fixture();
  for (let round = 1; round <= 6; round++) {
    assert.equal(room.match!.round, round);
    const first = round % 2 ? "player" : "cpu";
    assert.equal(room.activeSeat, first);
    const beforeBoard = JSON.stringify(room.match!.boards);
    room = applyOnlineCommand(room, first, { type: "end-turn" }, round * 10);
    assert.equal(room.match!.round, round);
    assert.equal(JSON.stringify(room.match!.boards), beforeBoard);
    room = applyOnlineCommand(
      room,
      room.activeSeat,
      { type: "end-turn" },
      round * 10 + 1,
    );
  }
  assert.equal(room.status, "complete");
  assert.equal(room.winner, "draw");
  assert.equal(
    room.match!.effectLog.filter((e) => e.type === "play").length,
    0,
  );
});
test("both seats can Squabble exactly once, including the guest playing first", () => {
  let room = fixture("cpu");
  const playCheap = (state: OnlineRoom, seat: Seat, squabble: boolean) => {
    const hand =
      seat === "player" ? state.match!.playerHand : state.match!.cpuHand;
    const card = hand.find((c) => c.cost <= 2)!;
    return applyOnlineCommand(
      state,
      seat,
      { type: "play", instanceId: card.instanceId, lane: 0, squabble },
      3,
    );
  };
  room = playCheap(room, "cpu", true);
  assert.deepEqual(room.match!.squabbleByOwner, { player: false, cpu: true });
  assert.equal(room.activeSeat, "cpu");
  assert.throws(() => playCheap(room, "cpu", true), /SQUABBLE/);
  room = applyOnlineCommand(room, "cpu", { type: "end-turn" }, 4);
  room = playCheap(room, "player", true);
  assert.deepEqual(room.match!.squabbleByOwner, { player: true, cpu: true });
  assert(
    room.match!.effectLog.some((e) => e.replay.after.squabbleByOwner?.cpu),
  );
});
test("Buddy forms, Bud timing and hazard metadata are public to both seats and survive reconnect", () => {
  const member = (userId: string, base: (typeof decks)[number]) => ({
    userId,
    name: userId,
    ready: false,
    deck: {
      id: `buddy-${base.id}`,
      name: base.name,
      cards: ["buddy", ...base.cards.filter(id => id !== "buddy")].slice(0, 10),
      hero: base.hero,
    },
  });
  let room = createOnlineRoom(member("buddy-player", decks[0]), "player", 0);
  room = joinOnlineRoom(room, member("buddy-cpu", decks[1]), 0);
  room = applyOnlineCommand(room, "player", { type: "ready" }, 1);
  room = applyOnlineCommand(room, "cpu", { type: "ready" }, 2);

  room = applyOnlineCommand(room, "player", { type: "end-turn" }, 3);
  room = applyOnlineCommand(room, "cpu", { type: "end-turn" }, 4);
  const cpuBuddy = room.match!.cpuHand.find(card => card.cardId === "buddy")!;
  room = applyOnlineCommand(room, "cpu", {
    type: "play", instanceId: cpuBuddy.instanceId, lane: 0, squabble: true,
  }, 5);
  room = applyOnlineCommand(room, "cpu", { type: "end-turn" }, 6);
  const playerBuddy = room.match!.playerHand.find(card => card.cardId === "buddy")!;
  room = applyOnlineCommand(room, "player", {
    type: "play", instanceId: playerBuddy.instanceId, lane: 1, squabble: false,
  }, 7);

  assert.equal(cards["buddy-bud"], undefined, "Bud remains absent from the collectible catalog");
  const restored = JSON.parse(JSON.stringify(room)) as OnlineRoom;
  for (const [userId, seat] of [["buddy-player", "player"], ["buddy-cpu", "cpu"]] as const) {
    const live = onlineRoomView(room, "BUDDYROOM", userId, 8);
    const reconnected = onlineRoomView(restored, "BUDDYROOM", userId, 8);
    assert.deepEqual(reconnected.boards, live.boards, `${seat} sees identical public state after reconnect`);
    const normal = live.boards.flat().find(card => card.cardId === "buddy" && card.owner === "player")!;
    const transformed = live.boards.flat().find(card => card.cardId === "buddy" && card.owner === "cpu")!;
    assert.equal(normal.buddyForm, "earth");
    assert.equal(normal.buddyGrowthAtRound, 4);
    assert.equal(transformed.buddyForm, "squabble-earth");
    assert.equal(transformed.buddyEarthExpiresAtRound, 4);
    const bud = live.boards.flat().find(card => card.buddyBud)!;
    assert.equal(bud.kind, "token");
    assert.equal(bud.hazard, true);
    assert.equal(bud.buddyBud?.sproutsAtRound, 4);
    assert.equal(bud.buddyBud?.sprouted, false);
    assert.equal(typeof bud.arrivalOrder, "number");
  }
});
test("wrong turns, wrong hands, overspending and repeated used cards are rejected", () => {
  let room = fixture();
  const own = room.match!.playerHand[0],
    enemy = room.match!.cpuHand[0];
  assert.throws(
    () => applyOnlineCommand(room, "cpu", { type: "end-turn" }, 3),
    /Wait/,
  );
  assert.throws(
    () =>
      applyOnlineCommand(
        room,
        "player",
        {
          type: "play",
          instanceId: enemy.instanceId,
          lane: 0,
          squabble: false,
        },
        3,
      ),
    /not in this hand/,
  );
  const expensive = room.match!.playerHand.find((c) => c.cost > 2)!;
  assert.throws(
    () =>
      applyOnlineCommand(
        room,
        "player",
        {
          type: "play",
          instanceId: expensive.instanceId,
          lane: 0,
          squabble: false,
        },
        3,
      ),
    /Motion/,
  );
  room = applyOnlineCommand(
    room,
    "player",
    { type: "play", instanceId: own.instanceId, lane: 0, squabble: false },
    3,
  );
  assert.throws(
    () =>
      applyOnlineCommand(
        room,
        "player",
        { type: "play", instanceId: own.instanceId, lane: 0, squabble: false },
        3,
      ),
    /hand/,
  );
  assert.equal(
    room.deadline,
    75002,
    "playing a card never refreshes the turn clock",
  );
});
test("private projections omit rival hands, draw order, user IDs and full replay frames", () => {
  let room = fixture();
  for (let n = 0; n < 4; n++)
    room = applyOnlineCommand(
      room,
      room.activeSeat,
      { type: "end-turn" },
      n + 3,
    );
  for (const [user, seat] of [
    ["a", "player"],
    ["b", "cpu"],
  ] as const) {
    const view = onlineRoomView(room, "AB12CD34EF56", user, 10);
    assert.equal(view.seat, seat);
    assert(view.hand.every((c) => c.owner === seat));
    const json = JSON.stringify(view);
    for (const forbidden of [
      "cpuHand",
      "playerHand",
      "cpuCardIds",
      "userId",
      "replay",
      "abilityUpgradeSnapshot",
    ])
      assert(!json.includes(`"${forbidden}"`));
    const rivalHand =
      seat === "player" ? room.match!.cpuHand : room.match!.playerHand;
    for (const card of rivalHand) assert(!json.includes(card.instanceId));
    assert.equal(view.revealedDecks, null);
  }
  assert.throws(
    () => onlineRoomView(room, "AB12CD34EF56", "stranger", 10),
    /not a participant/,
  );
});
test("timeout forfeits once and both players must consent to a rematch", () => {
  const initial = fixture();
  const completed = expireOnlineRoom(initial, initial.deadline!);
  assert.equal(completed.status, "complete");
  assert.equal(completed.winner, "cpu");
  assert.equal(expireOnlineRoom(completed, initial.deadline! + 1), completed);
  let room = applyOnlineCommand(
    completed,
    "player",
    { type: "rematch" },
    80000,
  );
  assert.equal(room.status, "complete");
  room = applyOnlineCommand(room, "cpu", { type: "rematch" }, 80001);
  assert.equal(room.status, "waiting");
  assert.equal(room.gameNumber, 2);
  assert.equal(room.openingSeat, "cpu");
  assert.equal(room.match, null);
  assert.equal(room.members.player.ready, false);
});

test("either active seat forfeits on timeout regardless of the district board", () => {
  const active = fixture();
  for (const timedOutSeat of ["player", "cpu"] as const) {
    const expired = expireOnlineRoom(
      { ...active, activeSeat: timedOutSeat },
      active.deadline!,
    );
    assert.equal(expired.status, "complete");
    assert.equal(expired.reason, "timeout");
    assert.equal(expired.winner, timedOutSeat === "player" ? "cpu" : "player");
    assert.equal(expired.match, active.match, "Timeout does not score or alter the final board");
    const loserView = onlineRoomView(
      expired,
      "AB12CD34EF56",
      timedOutSeat === "player" ? "a" : "b",
      active.deadline!,
    );
    assert.equal(loserView.reason, "timeout");
    assert.equal(loserView.winner, timedOutSeat === "player" ? "cpu" : "player");
  }
});

test("normal district finishes and surrender retain their own result reasons", () => {
  let room = fixture();
  room = applyOnlineCommand(room, room.activeSeat, { type: "surrender" }, 3);
  assert.equal(room.status, "complete");
  assert.equal(room.reason, "surrender");
  assert.equal(room.winner, "cpu");

  room = fixture();
  for (let turn = 0; turn < 12; turn += 1) {
    room = applyOnlineCommand(room, room.activeSeat, { type: "end-turn" }, turn + 3);
  }
  assert.equal(room.status, "complete");
  assert.equal(room.reason, "districts");
  assert.equal(room.winner, "draw");

  room = fixture();
  while (room.match!.round < 6) {
    room = applyOnlineCommand(room, room.activeSeat, { type: "end-turn" }, room.turnsEnded + 3);
  }
  const finalRound = room.match!;
  room = {
    ...room,
    match: {
      ...finalRound,
      boards: [
        finalRound.playerHand.slice(0, 2).map((card, i) => ({ ...card, lane: 0, playedRound: 1 + i })),
        finalRound.playerHand.slice(2, 4).map((card, i) => ({ ...card, lane: 1, playedRound: 1 + i })),
        finalRound.cpuHand.slice(0, 2).map((card, i) => ({ ...card, lane: 2, playedRound: 1 + i })),
      ],
    },
  };
  room = applyOnlineCommand(room, room.activeSeat, { type: "end-turn" }, room.turnsEnded + 3);
  room = applyOnlineCommand(room, room.activeSeat, { type: "end-turn" }, room.turnsEnded + 3);
  assert.equal(room.status, "complete");
  assert.equal(room.reason, "districts");
  assert.equal(room.winner, "player");
});

test("starting near the waiting-room expiry gives the active fade its full lifetime", () => {
  const active = fixture();
  const waiting: OnlineRoom = {
    ...active,
    status: "waiting",
    match: null,
    expiresAt: ROOM_LIFETIME_MS,
    members: {
      ...active.members,
      cpu: { ...active.members.cpu!, ready: false },
    },
  };
  const now = ROOM_LIFETIME_MS - 1;
  const started = applyOnlineCommand(waiting, "cpu", { type: "ready" }, now);
  assert.equal(started.status, "active");
  assert.equal(started.expiresAt, now + ROOM_LIFETIME_MS);
  assert.equal(expireOnlineRoom(started, ROOM_LIFETIME_MS), started);
});
test("base-strength snapshots and saved opening order survive serialization", () => {
  const room = fixture();
  assert(
    room.match!.abilityUpgradeSnapshot.player.every(
      (c) => c.level === 1 && c.upgradeIds.length === 0,
    ),
  );
  const loaded: OnlineRoom = JSON.parse(JSON.stringify(room));
  assert.deepEqual(
    loaded.match!.playerHand.map((c) => c.cardId),
    decks[0].cards.slice(0, 5),
  );
  const card = loaded.match!.playerHand.find((c) => cards[c.cardId].cost <= 2)!;
  assert.deepEqual(
    applyOnlineCommand(
      room,
      "player",
      { type: "play", instanceId: card.instanceId, lane: 0, squabble: false },
      3,
    ),
    applyOnlineCommand(
      loaded,
      "player",
      { type: "play", instanceId: card.instanceId, lane: 0, squabble: false },
      3,
    ),
  );
});
