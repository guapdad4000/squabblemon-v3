import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOnlineCommand,
  createOnlineRoom,
  expireOnlineRoom,
  joinOnlineRoom,
  onlineRoomView,
  ROOM_LIFETIME_MS,
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

test("starting near the waiting-room expiry gives the active match its full lifetime", () => {
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
