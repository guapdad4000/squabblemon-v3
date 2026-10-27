import { useEffect, useState } from "react";
import {
  createBossRaid,
  createBossCampaign,
  applyBossAction,
  type BossAction,
  type BossBlast,
  type BossStatus,
} from "@workspace/squabblemon-engine/bossRaid";
import type { PlayerBootstrap } from "@workspace/api-client-react";
import {catalogCardById} from "@workspace/squabblemon-engine/data";
import {
  getDeckSelectionStorage,
  resolveDeckSelection,
} from "../../lib/deckSelection";
import { BossRaidView } from "./BossRaidView";
/** Local practice never calls a mutation endpoint, consumes entries, or creates a reward receipt. */
export function KumiteDojoPractice({
  bootstrap,
  fighterId,
  onExit,
}: {
  bootstrap: PlayerBootstrap;
  fighterId: string;
  onExit: () => void;
}) {
  const [revision, setRevision] = useState(0),
    [error, setError] = useState("");
  const setup = () => {
    if (
      !catalogCardById[fighterId] ||
      !bootstrap.profile.ownedCardIds.includes(fighterId)
    )
      throw Error("Unlock this fighter before practice.");
    const valid = bootstrap.profile.savedDecks.filter(
      (d) =>
        d.cardIds.length === 10 &&
        new Set(d.cardIds).size === 10 &&
        d.cardIds.every((id) => bootstrap.profile.ownedCardIds.includes(id)),
    );
    const selected = resolveDeckSelection(
      bootstrap.profile.id,
      valid.map((d) => d.id),
      undefined,
      getDeckSelectionStorage(),
    );
    const saved = valid.find((d) => d.id === selected);
    if (!saved) throw Error("Save a complete ten-card crew first.");
    const ids = [...saved.cardIds];
    if (!ids.includes(fighterId))
      ids[ids.findLastIndex((id) => id !== saved.heroCardId)] = fighterId;
    const fighter = ids.indexOf(fighterId);
    [ids[0], ids[fighter]] = [ids[fighter], ids[0]];
    return createBossRaid(
      "local-dojo-practice",
      "practice",
      ids,
      saved.name,
      undefined,
      "kumite",
    );
  };
  const [run, setRun] = useState(() => {
      try {
        return setup();
      } catch {
        return null;
      }
    }),
    [blast, setBlast] = useState<BossBlast | null>(null);
  useEffect(() => {
    if (!blast) return;
    const timer = setTimeout(
      () => setBlast(null),
      Math.max(2800, blast.policePlays.length * 900 + 1750),
    );
    return () => clearTimeout(timer);
  }, [blast]);
  function action(action: BossAction) {
    if (!run || blast) return;
    try {
      const next = applyBossAction(run, action);
      if (next.blasts.length > run.blasts.length) setBlast(next.blasts.at(-1)!);
      setRun(next);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!run || (run.phase !== "active" && !blast))
    return (
      <section className="kumite-practice-result">
        <h1>DOJO PRACTICE</h1>
        <strong>{run ? `${run.score} DAMAGE` : "CREW NOT READY"}</strong>
        <p>NO ENTRIES USED · NO REWARDS CLAIMED</p>
        <button
          onClick={() => {
            try {
              setRun(setup());
              setRevision(revision + 1);
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          TRY AGAIN
        </button>
        <button onClick={onExit}>BACK TO KUMITE</button>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  const status: BossStatus = {
    day: "practice",
    resetsAt: "",
    serverNow: 0,
    attemptsRemaining: 0,
    run: blast ? { ...run, phase: "active" } : run,
    campaign: createBossCampaign(),
    earned: { softCurrency: 0, packTickets: 0, styleShards: 0 },
    bestScore: 0,
    history: [],
  };
  return (
    <div className="kumite-practice">
      <div className="kumite-practice-label" role="status">
        DOJO PRACTICE · NO ENTRIES OR REWARDS
      </div>
      <BossRaidView
        key={revision}
        status={status}
        mode="kumite"
        exitLabel="← Kumite"
        onAction={action}
        onExit={onExit}
        ownedCardIds={bootstrap.profile.ownedCardIds}
        blast={blast}
        error={error}
        onRetry={() => setError("")}
        reducedMotion={bootstrap.profile.settings.reducedMotion}
      />
    </div>
  );
}
