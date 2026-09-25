import { MultiplayerBattle } from "../src/components/MultiplayerBattle";
import {
  createOnlineRoom,
  joinOnlineRoom,
  applyOnlineCommand,
  onlineRoomView,
} from "@workspace/squabblemon-engine/multiplayer";
import "../src/styles/multiplayer.css";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Battle } from "../src/components/Battle";
import { CardInspector } from "../src/components/CardInspector";
import {
  createCardInstance,
  createMatch,
  playTurnCard,
  type CardInstance,
  type Lane,
} from "../src/gameEngine";
import { decks } from "../src/data";
import "../src/index.css";

const ids = [
  new URLSearchParams(location.search).get("card") ?? "the-dice-game",
  "miami-surgeon",
  "teacher",
];

function Fixture() {
  const [match, setMatch] = useState(() => {
    const initial = createMatch("block", "vibes");
    initial.playerMotion = 9;
    initial.cpuMotion = 9;
    initial.round = 6;
    initial.playerHand = ids.map((id, index) =>
      createCardInstance(id, "player", "after-hours-wave", index),
    );
    const ally = createCardInstance(
      "bouncer",
      "player",
      "after-hours-setup",
      20,
    );
    const enemy = createCardInstance(
      "cornball",
      "cpu",
      "after-hours-setup",
      21,
    );
    ally.lane = enemy.lane = 0;
    initial.boards = [[ally, enemy], [], []];
    return initial;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  function play(instanceId: string, target: Lane, armed: boolean, choice = 0) {
    setMatch((current) =>
      playTurnCard(current, "player", instanceId, target, armed, choice),
    );
    setSelected(null);
    setLane(null);
    setSquabble(false);
  }
  return (
    <main style={{ height: "100dvh", background: "#080808" }}>
      <output
        data-testid="blockbuster-state"
        data-after-party={String(match.afterParty ?? false)}
        data-motion={match.playerMotion}
        data-count={
          match.boards.flat().filter((card) => ids.includes(card.cardId)).length
        }
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          overflow: "hidden",
          clipPath: "inset(50%)",
        }}
      />
      <Battle
        match={match}
        deck={decks[0]}
        rivalDeck={decks[1]}
        selectedInstanceId={selected}
        setSelectedInstanceId={setSelected}
        selectedLane={lane}
        setSelectedLane={setLane}
        squabble={squabble}
        setSquabble={setSquabble}
        onPlayCard={play}
        commit={() => {
          if (selected && lane !== null) play(selected, lane, squabble);
        }}
        presentationPhase="player-ready"
        phaseMessage="Blockbuster verification"
        timerEnabled={false}
        setInspect={setInspect}
        onShowRules={() => {}}
      />
      {inspect && (
        <CardInspector
          card={inspect}
          match={match}
          onClose={() => setInspect(null)}
        />
      )}
    </main>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <QueryClientProvider client={new QueryClient()}>
    {new URLSearchParams(location.search).get("mode") === "online" ? (
      <OnlineFixture />
    ) : (
      <Fixture />
    )}
  </QueryClientProvider>,
);
import.meta.hot?.dispose(() => root.unmount());

function OnlineFixture() {
  const seat =
    new URLSearchParams(location.search).get("seat") === "cpu"
      ? "cpu"
      : "player";
  const [room, setRoom] = useState(() => {
    const deck = decks[0];
    const now = Date.now();
    let r = joinOnlineRoom(
      createOnlineRoom(
        { userId: "host", name: "Host", ready: false, deck },
        seat,
        now,
      ),
      { userId: "guest", name: "Guest", ready: false, deck },
      now,
    );
    r = applyOnlineCommand(r, "player", { type: "ready" }, now);
    r = applyOnlineCommand(r, "cpu", { type: "ready" }, now);
    r.match = {
      ...r.match!,
      round: 6,
      playerMotion: 9,
      cpuMotion: 9,
      [seat === "player" ? "playerHand" : "cpuHand"]: ids.map((id, i) =>
        createCardInstance(id, seat, "events", i),
      ),
    };
    return r;
  });
  return (
    <main style={{ height: "100dvh" }}>
      <output
        data-testid="blockbuster-state"
        data-after-party={String(room.match?.afterParty ?? false)}
        style={{ display: "none" }}
      />
      <MultiplayerBattle
        room={onlineRoomView(
          room,
          "EVENTS",
          seat === "player" ? "host" : "guest",
          Date.now(),
        )}
        connected
        busy={false}
        reducedMotion
        send={(command) => {
          setRoom((current) =>
            applyOnlineCommand(current, seat, command, Date.now()),
          );
        }}
        onLeave={() => {}}
      />
    </main>
  );
}
