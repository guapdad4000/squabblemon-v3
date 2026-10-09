import { policeRevealDuration } from "./bossRaidPresentation";
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
  type BossStatus,
  type BossAction,
  type BossBlast,
} from "@workspace/squabblemon-engine/bossRaid";
import { type Deck } from "../../data";
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
  const client = useQueryClient(),
    key = ["boss-raid", bootstrap.profile.id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => customFetch<BossStatus>(endpoint),
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
  function action(action: BossAction) {
    if (!run || pending.current || blast) return;
    void send(`${endpoint}/${run.id}/action`, {
      revision: run.revision,
      actionId: crypto.randomUUID(),
      action,
    });
  }
  if (query.isPending || query.isError || !status)
    return (
      <main className="boss-raid raid-loading">
        <button onClick={onExit}>← Fadecade</button>
        <h1>{query.isError ? "PRECINCT RADIO LOST" : "CALLING THE BLOCK…"}</h1>
        {query.isError && (
          <button onClick={() => void query.refetch()}>Retry connection</button>
        )}
      </main>
    );
  if (run && (run.phase === "active" || status.attemptsRemaining === 0))
    return (
      <BossRaidView
        status={status}
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
  return (
    <main
      className="boss-raid raid-entry raid-entry-v4"
      data-reduced-motion={bootstrap.profile.settings.reducedMotion}
      style={
        {
          "--raid-bg": `url("${getAssetUrl("assets/boss-raid/precinct-arena-v3.webp")}")`,
        } as React.CSSProperties
      }
    >
      <button onClick={onExit}>← Fadecade</button>
      <div className="raid-entry-content">
        <div className="raid-entry-hero-art">
          <img
            src={getAssetUrl("assets/boss-raid/oink-splash-v4.webp")}
            alt="Officer Oink challenging your crew"
          />
          <span className="raid-entry-siren-glow" />
        </div>
        <div className="raid-entry-story">
          <small>DAILY BOSS / THE BLOCK FIGHTS BACK</small>
          <h1 aria-label="Punch on Patrol">
            PUNCH ON
            <br />
            PATROL
          </h1>
          <p>
            Five evolving bosses. One daily attack. Your damage stays on Oink
            between days—bring a deck that can break the precinct.
          </p>
          <strong>ONE REWARDED ENTRY DAILY</strong>
          <p>
            Tier {status.campaign.tier}/5 · {status.campaign.hp} HP remaining ·{" "}
            {status.campaign.tierAttacks} attacks so far
            <br />
            Personal best: {status.bestScore} damage
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
                void send(endpoint + "/start", {
                  requestId: crypto.randomUUID(),
                  cardIds: crews[choice].cards,
                })
              }
            >
              {status.campaign.completed
                ? "ALL FIVE TIERS DEFEATED"
                : busy
                  ? "ENTERING…"
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
