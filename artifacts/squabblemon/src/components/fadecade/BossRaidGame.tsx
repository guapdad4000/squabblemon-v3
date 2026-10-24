import { policeRevealDuration } from "./bossRaidPresentation";
import { setBattleMusicMode } from "../../musicStore";
import { getAssetUrl } from "../../lib/assets";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from "@workspace/api-client-react";
import {
  bossForm,
  bossFormForMode,
  KUMITE_BOSS_FORMS,
  type BossStatus,
  type BossAction,
  type BossBlast,
  type BossRaidMode,
} from "@workspace/squabblemon-engine/bossRaid";
import { KUMITE_LINEUP_REWARDS, getCardImage, type Deck } from "../../data";
import { CompactDeckPicker } from "../CompactDeckPicker";
import { BossRaidView } from "./BossRaidView";
import "../../styles/boss-raid.css";
const endpoint = "/api/player/boss-raid";
export default function BossRaidGame({
  bootstrap,
  crews,
  onExit,
}: {
  bootstrap: PlayerBootstrap;
  crews: Deck[];
  onExit: () => void;
}) {
  useEffect(() => {
    setBattleMusicMode("boss");
    return () => setBattleMusicMode(null);
  }, []);
  const [mode, setMode] = useState<BossRaidMode>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("raid") === "kumite"
      ? "kumite"
      : "precinct",
  );
  const modeEndpoint =
    mode === "kumite" ? `${endpoint}?mode=kumite` : endpoint;
  const client = useQueryClient(),
    key = ["boss-raid", bootstrap.profile.id, mode];
  const query = useQuery({
    queryKey: key,
    queryFn: () => customFetch<BossStatus>(modeEndpoint),
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [choice, setChoice] = useState(0),
    [blast, setBlast] = useState<BossBlast | null>(null);
  const pending = useRef<{ path: string; body: unknown } | null>(null),
    mounted = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!blast) return;
    const timer = setTimeout(
      () => setBlast(null),
      Math.max(2800, policeRevealDuration(blast.policePlays.length) + 1600),
    );
    return () => clearTimeout(timer);
  }, [blast]);
  async function send(path: string, body: unknown) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    pending.current = { path, body };
    const count = query.data?.run?.blasts.length ?? 0;
    try {
      const next = await customFetch<BossStatus>(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!mounted.current) return;
      pending.current = null;
      client.setQueryData(key, next);
      if (next.run && next.run.blasts.length > count)
        setBlast(next.run.blasts.at(-1)!);
      const previousEarned = query.data?.campaign.earned;
      if (
        !previousEarned ||
        Object.keys(next.campaign.earned).some(
          (k) =>
            next.campaign.earned[k as keyof typeof next.campaign.earned] !==
            previousEarned[k as keyof typeof previousEarned],
        )
      ) {
        void client.invalidateQueries({
          queryKey: getGetPlayerBootstrapQueryKey(),
        });
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Could not save. Retry safely.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const status = query.data,
    run = status?.run;
  function switchMode(nextMode: BossRaidMode) {
    if (busy || nextMode === mode) return;
    setError("");
    setBlast(null);
    setMode(nextMode);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (nextMode === "kumite") params.set("raid", "kumite");
      else params.delete("raid");
      const search = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
      );
    }
  }
  function action(action: BossAction) {
    if (!run || pending.current || blast) return;
    const actionUrl =
      mode === "kumite"
        ? `${endpoint}/${run.id}/action?mode=kumite`
        : `${endpoint}/${run.id}/action`;
    void send(actionUrl, {
      revision: run.revision,
      actionId: crypto.randomUUID(),
      action,
    });
  }
  if (query.isPending || query.isError || !status)
    return (
      <main className="boss-raid raid-loading">
        <button onClick={onExit}>← Fadecade</button>
        <h1>{query.isError ? mode === "kumite" ? "DOJO CONNECTION LOST" : "PRECINCT RADIO LOST" : "CALLING THE BLOCK…"}</h1>
        {query.isError && (
          <button onClick={() => void query.refetch()}>Retry connection</button>
        )}
      </main>
    );
  if (run && (run.phase === "active" || status.attemptsRemaining === 0))
    return (
      <BossRaidView
        status={status}
        mode={mode}
        onModeChange={switchMode}
        ownedCardIds={bootstrap.profile.ownedCardIds}
        busy={busy}
        blast={blast}
        reducedMotion={bootstrap.profile.settings.reducedMotion}
        error={error}
        onAction={action}
        onExit={onExit}
        onRetry={() => {
          const p = pending.current;
          if (p) void send(p.path, p.body);
        }}
        onSync={() => {
          pending.current = null;
          setError("");
          void query.refetch();
        }}
      />
    );
  const currentForm = bossFormForMode(status.campaign.tier, mode);
  const kumiteForm = KUMITE_BOSS_FORMS[status.campaign.tier - 1];
  const unlockedKumiteCount = KUMITE_LINEUP_REWARDS.filter((r) =>
    bootstrap.profile.ownedCardIds.includes(r.cardId),
  ).length;
  return (
    <main
      className="boss-raid raid-entry raid-entry-v4"
      data-raid-mode={mode}
      data-reduced-motion={bootstrap.profile.settings.reducedMotion}
      style={
        {
          "--raid-bg": `url("${getAssetUrl(
            mode === "kumite"
              ? "assets/kumite/layers/backdrop.webp"
              : "assets/boss-raid/precinct-arena-v3.webp",
          )}")`,
        } as React.CSSProperties
      }
    >
      <div className="raid-entry-topbar">
        <button onClick={onExit}>← Fadecade</button>
        <div className="raid-mode-flip" role="tablist" aria-label="Choose Raid Operation">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "precinct"}
            onClick={() => switchMode("precinct")}
          >
            PRECINCT RAID · OINK
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "kumite"}
            onClick={() => switchMode("kumite")}
          >
            KUMITE RAID · DOJO MASTERS
          </button>
        </div>
      </div>
      <div className="raid-entry-content">
        <div className="raid-entry-hero-art">
          <img
            src={
              mode === "kumite"
                ? getCardImage(kumiteForm.fighterId)
                : getAssetUrl("assets/boss-raid/oink-splash-v4.webp")
            }
            alt={
              mode === "kumite"
                ? `${kumiteForm.bossTitle} challenging your crew`
                : "Officer Oink challenging your crew"
            }
          />
          <span className="raid-entry-siren-glow" />
        </div>
        <div className="raid-entry-story">
          <small>
            {mode === "kumite"
              ? `KUMITE DOJO RAID · TIER ${status.campaign.tier}/5 · ${kumiteForm.name.toUpperCase()}`
              : `DAILY BOSS · TIER ${status.campaign.tier}/5 · ${currentForm.name.toUpperCase()}`}
          </small>
          <h1 aria-label={mode === "kumite" ? "Way of the Fist" : "Punch on Patrol"}>
            {mode === "kumite" ? (
              <>
                WAY OF
                <br />
                THE FIST
              </>
            ) : (
              <>
                PUNCH ON
                <br />
                PATROL
              </>
            )}
          </h1>
          <p>
            {mode === "kumite"
              ? `Challenge ${kumiteForm.bossTitle} (${kumiteForm.hp} HP · ×${kumiteForm.multiplier} damage). Every full raid, 50+ DMG win, and defeated tier advances your Kumite Fighter Unlocks (${unlockedKumiteCount}/${KUMITE_LINEUP_REWARDS.length} unlocked).`
              : "Five evolving bosses. Your damage stays on Oink between days—and every completed raid, 50+ DMG win, and tier clear also advances your Kumite Fighter Unlocks."}
          </p>
          <div className="raid-kumite-unlock-strip" aria-label="Kumite fighter unlock connection">
            <span>KUMITE LINEUP UNLOCKS ({unlockedKumiteCount}/{KUMITE_LINEUP_REWARDS.length})</span>
            <div className="raid-kumite-unlock-pills">
              {KUMITE_LINEUP_REWARDS.map((item) => {
                const owned = bootstrap.profile.ownedCardIds.includes(item.cardId);
                return (
                  <span key={item.id} className="raid-kumite-pill" data-owned={owned}>
                    {owned ? "✓ " : ""}{item.name}
                  </span>
                );
              })}
            </div>
          </div>
          <p>
            Tier {status.campaign.tier}/5 · {status.campaign.hp} HP remaining ·{" "}
            {status.campaign.tierAttacks} attacks so far · Personal best:{" "}
            {status.bestScore} DMG
          </p>
          <div className="raid-entry-launch">
            <small className="raid-entry-crew-label">BRING YOUR CREW</small>
            <CompactDeckPicker
              decks={crews.map((crew) => ({
                id: crew.id,
                name: crew.name,
                heroCardId: crew.hero,
                cardIds: crew.cards,
              }))}
              selectedId={crews[choice]?.id ?? ""}
              onSelect={(id) =>
                setChoice(crews.findIndex((crew) => crew.id === id))
              }
              disabled={busy}
              label="Bring your crew"
            />
            {!crews.length && (
              <p>Save a legal ten-card deck in your collection first.</p>
            )}
            <button
              className="raid-fire raid-launch-fight"
              disabled={
                busy || !crews.length || !!error || status.campaign.completed
              }
              onClick={() =>
                void send(
                  mode === "kumite"
                    ? `${endpoint}/start?mode=kumite`
                    : `${endpoint}/start`,
                  {
                    requestId: crypto.randomUUID(),
                    cardIds: crews[choice].cards,
                  },
                )
              }
            >
              {status.campaign.completed
                ? "ALL FIVE TIERS DEFEATED"
                : busy
                  ? "ENTERING…"
                  : mode === "kumite"
                    ? `CHALLENGE ${kumiteForm.bossTitle} →`
                    : "FIGHT THE PRECINCT →"}
            </button>
          </div>
          {error && (
            <div role="alert">
              <p>{error}</p>
              <button
                onClick={() => {
                  const p = pending.current;
                  if (p) void send(p.path, p.body);
                }}
              >
                Retry entry
              </button>
              <button
                onClick={() => {
                  pending.current = null;
                  setError("");
                  void query.refetch();
                }}
              >
                Sync
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
