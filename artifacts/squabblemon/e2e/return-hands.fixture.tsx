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

const ids = ['dorothy'];

function Fixture() {
  const [match, setMatch] = useState(() => {
    const initial = createMatch("block", "vibes");
    initial.playerMotion = 9;
    initial.cpuMotion = 9;
    initial.round = 3;
    initial.playerHand = ids.map((id, index) =>
      createCardInstance(id, "player", "after-hours-wave", index),
    );
    const ally = createCardInstance(
      "bonnetgirl",
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
    ally.powerModifier = 5;
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
        data-enemy-hands-modifier={match.boards.flat().find(c => c.owner === "cpu" && c.cardId === "cornball")?.powerModifier ?? "destroyed"}
        data-last-effect={match.effectLog.at(-1)?.note}
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
        phaseMessage="Returned cards keep earned Hands"
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


createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
