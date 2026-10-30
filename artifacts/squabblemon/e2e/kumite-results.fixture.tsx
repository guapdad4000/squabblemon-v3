// Local presentation only: no account state, reward logic or match transport.
import React from "react";
import { createRoot } from "react-dom/client";
import ResultStage from "../src/components/breakthrough/ResultStage";
import "../src/components/breakthrough/arena.css";
import "../src/components/breakthrough/combatPresentation.css";
import "../src/components/breakthrough/resultStage.css";
import "../src/components/breakthrough/resultScroll.css";
import "../src/components/breakthrough/assets/batch10/batch10.css";
import "../src/components/breakthrough/batch10Presentation.css";
import "../src/components/breakthrough/production.css";

if (!import.meta.env.DEV)
  throw new Error("The synthetic Kumite results audition is development-only.");

const query = new URLSearchParams(location.search);
const outcome = query.get("outcome") ?? "win";
const winner =
  outcome === "win" ? "player" : outcome === "loss" ? "opponent" : null;
const breaches: [number, number] =
  winner === "player" ? [2, 1] : winner === "opponent" ? [1, 2] : [1, 1];
const hands: [number, number] =
  winner === "player" ? [16, 10] : winner === "opponent" ? [10, 16] : [12, 12];
const action = (name: string) => {
  document.documentElement.dataset.fixtureAction = name;
};
const root = createRoot(document.getElementById("root")!);
import.meta.hot?.dispose(() => root.unmount());
root.render(
  <React.StrictMode>
    <main
      className="bt-arena"
      data-active="false"
      data-arena="dojo"
      data-fixture="kumite-results"
    >
      <ResultStage
        winner={winner}
        reason={winner ? "Breaches decided" : "Hands tied"}
        breaches={breaches}
        hands={hands}
        stats={{ damage: 145, deployments: 7 }}
        reducedMotion={query.get("motion") === "reduced"}
        rematch={() => action("rematch")}
        newDeal={() => action("change-deck")}
        onExit={() => action("exit")}
      />
    </main>
  </React.StrictMode>,
);
