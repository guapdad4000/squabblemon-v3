import { lazy, Suspense, useMemo, useState } from "react";
import { BossRaidCabinet } from "../../components/fadecade/BossRaidCabinet";
import type { ArcadeKind } from "@workspace/squabblemon-engine/arcadeGames";
import { ArcadeGameCabinet } from "../../components/fadecade/ArcadeCabinets";
import "../../styles/arcade-games.css";
import type { PlayerBootstrap } from "@workspace/api-client-react";
import { useListChallengeRuns } from "@workspace/api-client-react";
import { starterRecipes, validateSavedDeck, type Deck } from "../../data";
import { PlayLoop } from "../../components/PlayLoop";
import { FightTabs } from "./FadePark";
import { getAssetUrl } from "../../lib/assets";
import {
  FlagshipMachine,
  type RoadReturn,
} from "../../components/fadecade/FlagshipMachine";
import { EventsMachine } from "../../components/fadecade/EventsMachine";
import { StockzMachine } from "../../components/fadecade/StockzMachine";
import { TrainingMachine } from "../../components/fadecade/TrainingMachine";
import {
  WaffleMachine,
  WaffleRunGame,
} from "../../components/fadecade/WaffleRunGame";
import { ChromeBanner } from "../../components/fadecade/FadecadeChrome";
import { useFadecadeMusic } from "../../components/fadecade/FadecadeMusic";
import { getMatchWinner } from "../../gameEngine";
import "../../styles/challenges-hub.css";
import { type ActivityId } from "@workspace/squabblemon-engine/activities";
import { isTrainingCircuitActivity } from "../../lib/resultBroadcastEligibility";

const BossRaidGame = lazy(() => import("../../components/fadecade/BossRaidGame"));
const ArcadeGame = lazy(() => import("../../components/fadecade/ArcadeGames"));

export type BattleConfig = {
  mode: "practice" | "guest";
  challengeRunId?: string;
  activity?: ActivityId;
  customPlayerDeck?: Deck;
  initialDeckId?: string;
  draftWeek?: string;
  draftPicks?: string[];
};

export function ChallengesHub({
  bootstrap,
  openTraining = false,
}: {
  bootstrap: PlayerBootstrap;
  openTraining?: boolean;
}) {
  const [arcadeKind, setArcadeKind] = useState<ArcadeKind | null>(null);
  const [bossOpen, setBossOpen] = useState(false);
  const [waffleOpen, setWaffleOpen] = useState(false);
  const [battleConfig, setBattleConfig] = useState<BattleConfig | null>(null);
  useFadecadeMusic(!battleConfig && !waffleOpen && !arcadeKind && !bossOpen);
  const [roadReturn, setRoadReturn] = useState<RoadReturn | undefined>();
  const runsQuery = useListChallengeRuns();
  function launchBattle(config: BattleConfig) {
    setRoadReturn(undefined);
    setBattleConfig(config);
  }

  const legalCrews = useMemo(() => {
    const saved = bootstrap.profile.savedDecks
      .filter(
        (deck) =>
          validateSavedDeck(
            deck.cardIds,
            bootstrap.profile.ownedCardIds,
            deck.heroCardId,
          ).valid,
      )
      .map(
        (deck) =>
          ({
            id: deck.id,
            name: deck.name,
            cards: deck.cardIds,
            hero: deck.heroCardId,
            archetype: "Your crew",
            accent: "ROAD",
            plan: "Your cards. Your strategy.",
          }) as Deck,
      );

    const fallback = starterRecipes
      .filter(
        (recipe) =>
          recipe.id === bootstrap.profile.starterDeckId &&
          validateSavedDeck(
            recipe.catalogCardIds,
            bootstrap.profile.ownedCardIds,
            recipe.hero,
          ).valid,
      )
      .map(
        (recipe) =>
          ({
            id: recipe.id,
            name: recipe.name,
            cards: recipe.catalogCardIds,
            hero: recipe.hero,
            archetype: "Starter crew",
            accent: "ROAD",
            plan: "Learn the block.",
          }) as Deck,
      );

    return saved.length ? saved : fallback;
  }, [bootstrap]);

  if (bossOpen)
    return (
      <Suspense
        fallback={
          <main className="boss-raid raid-loading">CALLING THE BLOCK…</main>
        }
      >
        <BossRaidGame
          key={bootstrap.profile.id}
          bootstrap={bootstrap}
          crews={legalCrews}
          onExit={() => setBossOpen(false)}
        />
      </Suspense>
    );

  if (arcadeKind)
    return (
      <Suspense
        fallback={
          <main className="arcade-game arc-loading">
            <strong>GLOVES UP…</strong>
          </main>
        }
      >
        <ArcadeGame
          key={arcadeKind}
          kind={arcadeKind}
          bootstrap={bootstrap}
          onExit={() => setArcadeKind(null)}
        />
      </Suspense>
    );
  if (waffleOpen)
    return (
      <WaffleRunGame
        bootstrap={bootstrap}
        onExit={() => setWaffleOpen(false)}
      />
    );

  if (battleConfig) {
    return (
      <PlayLoop
        mode={battleConfig.mode}
        hideLobby
        challengeRunId={battleConfig.challengeRunId}
        activity={battleConfig.activity}
        trainingCircuit={isTrainingCircuitActivity(battleConfig.activity)}
        customPlayerDeck={battleConfig.customPlayerDeck}
        initialDeckId={battleConfig.initialDeckId}
        draftWeek={battleConfig.draftWeek}
        draftPicks={battleConfig.draftPicks}
        turnTimerEnabled={bootstrap.profile.settings.turnTimerEnabled}
        equippedVariants={bootstrap.profile.equippedVariants}
        cardProgression={bootstrap.profile.cardProgression}
        onExit={() => {
          if (battleConfig.challengeRunId) {
            setRoadReturn((previous) =>
              previous?.runId === battleConfig.challengeRunId
                ? previous
                : {
                    runId: battleConfig.challengeRunId!,
                    outcome: "resume",
                    key: Date.now(),
                  },
            );
          }
          setBattleConfig(null);
          void runsQuery.refetch();
        }}
        onVerifiedComplete={(match) => {
          if (battleConfig.challengeRunId && match) {
            const winner = getMatchWinner(match);
            const outcome =
              winner === "player" ? "win" : winner === "cpu" ? "loss" : "draw";
            setRoadReturn({
              runId: battleConfig.challengeRunId,
              outcome,
              key: Date.now(),
            });
          }
          void runsQuery.refetch();
        }}
      />
    );
  }

  return (
    <main
      className="fadecade-hub"
      aria-label="The Fadecade"
      data-reduce-motion={bootstrap.profile.settings.reducedMotion}
    >
      <img
        className="fadecade-room-bg"
        src={getAssetUrl("assets/fadecade/room.webp?v=1790163409738")}
        alt=""
        role="presentation"
        draggable={false}
      />

      <header className="fadecade-hub__topline">
        <FightTabs challenges />
      </header>

      <div className="fadecade-content">
        <img
          src={getAssetUrl("assets/fadecade/logo.webp")}
          alt="The Fadecade"
          className="fadecade-logo"
          draggable={false}
        />

        <div className="fadecade-layout">
          <FlagshipMachine
            bootstrap={bootstrap}
            legalCrews={legalCrews}
            runsQuery={runsQuery}
            onBattle={launchBattle}
            roadReturn={roadReturn}
          />

          <div className="fadecade-row">
            <ArcadeGameCabinet
              kind="fade-market"
              onOpen={() => setArcadeKind("fade-market")}
            />
            <ArcadeGameCabinet
              kind="block-takeover"
              onOpen={() => setArcadeKind("block-takeover")}
            />
            {openTraining && (
              <TrainingMachine
                playerId={bootstrap.profile.id}
                legalCrews={legalCrews}
                onBattle={launchBattle}
                initiallyOpen
              />
            )}
            <ArcadeGameCabinet
              kind="girl-fade"
              onOpen={() => setArcadeKind("girl-fade")}
            />
            <BossRaidCabinet onOpen={() => setBossOpen(true)} />
            <StockzMachine bootstrap={bootstrap} />
            <EventsMachine
              playerId={bootstrap.profile.id}
              legalCrews={legalCrews}
              onBattle={launchBattle}
            />
            <WaffleMachine onOpen={() => setWaffleOpen(true)} />
          </div>
        </div>

        {Array.isArray(runsQuery.data) && runsQuery.data.length > 0 && (
          <div className="fadecade-history">
            <h3>Recent Road Log</h3>
            <ul>
              {runsQuery.data.slice(0, 4).map((run) => (
                <li key={run.id}>
                  {run.status.toUpperCase()} · STOP {run.encounterIndex + 1} ·{" "}
                  {run.wins} CLEARED
                </li>
              ))}
            </ul>
          </div>
        )}

        <ChromeBanner variant="footer">
          <h3>No Shortcuts</h3>
          <p>
            Battle rewards are saved after each verified fight.
            <br />
            Your progress persists.
          </p>
        </ChromeBanner>
      </div>
    </main>
  );
}
