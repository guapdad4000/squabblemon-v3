import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from "@workspace/api-client-react";
import {
  ARCADE_RULES,
  GIRL_FIGHTERS,
  STOCK_ITEMS,
  DISTRICTS,
  BLOCK_CREWS,
  DIRECTIONS,
  blockCanAttack,
  type ArcadeKind,
  type ArcadeRun,
  type ArcadeAction,
  type ArcadeReward,
  type GirlRun,
  type MarketRun,
  type BlockRun,
  type Direction,
  type BoxBeat,
} from "@workspace/squabblemon-engine/arcadeGames";
import { getAssetUrl } from "../../lib/assets";
import { setBattleActive } from "../../lib/imageWarmup";
import "../../styles/arcade-games.css";
import { AnimatedSprite, motionSpriteUrl } from "./AnimatedSprite";
import { arcadeSpriteAnimation, blockSpriteAnimation } from "./motionSpriteCatalog";
export type ArcadeGameStatus = {
  kind: ArcadeKind;
  period: string;
  attemptsRemaining: number;
  resetsAt: string;
  serverNow: number;
  run: ArcadeRun | null;
  earned: ArcadeReward;
};
const art = (name: string) => getAssetUrl(`assets/arcade-games/${name}.webp`);
const names: Record<ArcadeKind, string> = {
  "girl-fade": "Girl Fade",
  "fade-market": "Fade Market",
  "block-takeover": "Block Takeover",
};
const captions: Record<ArcadeKind, string> = {
  "girl-fade": "GIRLS GOT HANDS",
  "fade-market": "HOLD DOWN THE NIGHT SHIFT",
  "block-takeover": "THE BLOCK BELONGS TO SOMEBODY",
};
const help: Record<ArcadeKind, string[]> = {
  "girl-fade": [
    "Choose a girl. Watch her opponent’s red attack pattern, then recreate the opposite directions from memory.",
    "Moving into a red attack gets you hit. The opposite direction lands a counter; the other directions dodge. Use arrows or WASD, or tap the direction buttons.",
    "Queue every step before time runs out. Beat six girls to win the belt. Health carries into the next round. Clout per hit and win; tickets at three and six wins.",
  ],
  "fade-market": [
    "Dr. Fade defends the lane you aim at. Night Cashier moves toward the shelf you choose and restocks while you hold the store.",
    "Six restock beats trigger a power-up: espresso speeds punches, hot sauce increases damage, ice bags freeze the lanes, vitamins repair the store, protein bars clear a crowd.",
    "Waves grow faster and tougher. Don’t let YNs reach the counter. Pause whenever you need. Clout per stop and restock; tickets when you reach waves three and six.",
  ],
  "block-takeover": [
    "Capture neighboring districts, fortify your turf, and collect supplies. Every action gives rival crews a turn.",
    "The red raid marker shows where rivals will attack next. Rally repairs your crew and increases attack power. Own six districts to unlock the headquarters at The Gym.",
    "Take the headquarters within 24 turns to win. Fade Market supplies your crew; The Park restores health. District rewards bank immediately; victory adds two tickets.",
  ],
};
function Sprite({
  name,
  className = "",
  style,
  paused = false,
  animationKey,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
  paused?: boolean;
  animationKey?: string | number;
}) {
  const animation = arcadeSpriteAnimation(name);
  if (animation) return <AnimatedSprite animation={animation} name={name} className={`arc-sprite ${className}`} style={style} paused={paused} animationKey={animationKey} fallback={art(name)} />;
  return (
    <img
      className={`arc-sprite ${className}`}
      src={art(name)}
      alt=""
      draggable={false}
      style={style}
    />
  );
}
function Health({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  return (
    <div className="arc-health" data-low={value / max < 0.25}>
      <span>{label}</span>
      <div
        role="progressbar"
        aria-label={`${label} health`}
        aria-valuenow={Math.max(0, value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <i style={{ width: `${Math.max(0, value / max) * 100}%` }} />
      </div>
      <b>
        {Math.max(0, value)}/{max}
      </b>
    </div>
  );
}
function Fist() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 6h5V4h5v2h5v2h4v12l-7 8H9l-5-8V10h3z" fill="currentColor" />
      <path
        d="M12 6v9m5-9v9m5-7v8M7 11v7l6 3 7-3"
        fill="none"
        stroke="#191623"
        strokeWidth="2"
      />
    </svg>
  );
}
function soundTone(enabled: boolean, kind: "hit" | "win" | "stock") {
  if (!enabled) return;
  try {
    const a = new AudioContext(),
      o = a.createOscillator(),
      g = a.createGain();
    o.type = kind === "hit" ? "sawtooth" : "triangle";
    o.frequency.setValueAtTime(
      kind === "hit" ? 140 : kind === "win" ? 660 : 440,
      a.currentTime,
    );
    o.frequency.exponentialRampToValueAtTime(
      kind === "hit" ? 45 : 880,
      a.currentTime + 0.12,
    );
    g.gain.setValueAtTime(0.035, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.16);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.18);
    setTimeout(() => void a.close(), 240);
  } catch {
    /* Silent mode remains playable. */
  }
}
export default function ArcadeGame({
  kind,
  bootstrap,
  onExit,
}: {
  kind: ArcadeKind;
  bootstrap: PlayerBootstrap;
  onExit: () => void;
}) {
  const client = useQueryClient(),
    key = ["arcade-game", kind, bootstrap.profile.id],
    endpoint = `/api/player/arcade/${kind}`;
  const query = useQuery({
    queryKey: key,
    queryFn: () => customFetch<ArcadeGameStatus>(endpoint),
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const status = query.data,
    run = status?.run ?? null;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [choice, setChoice] = useState(0),
    [clock, setClock] = useState(Date.now),
    [confirm, setConfirm] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [sound, setSound] = useState(() => {
      try {
        return localStorage.getItem("squabblemon:arcade-sound") !== "off";
      } catch {
        return true;
      }
    });
  const [paused, setPaused] = useState(false),
    [animation, setAnimation] = useState<{
      run: GirlRun;
      beats: BoxBeat[];
      index: number;
    } | null>(null);
  const lock = useRef(false),
    active = useRef(true),
    player = useRef(bootstrap.profile.id),
    retry = useRef<{ path: string; body: unknown } | null>(null),
    startId = useRef<string | null>(null),
    offset = useRef(0),
    reset = useRef(""),
    helpDialog = useRef<HTMLDialogElement>(null),
    retireDialog = useRef<HTMLDialogElement>(null);
  player.current = bootstrap.profile.id;
  useEffect(() => {
    active.current = true;
    setBattleActive(true);
    return () => {
      active.current = false;
      setBattleActive(false);
    };
  }, []);
  useEffect(() => {
    if (status) {
      offset.current = status.serverNow - Date.now();
      setClock(status.serverNow);
    }
  }, [status]);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now() + offset.current), 120);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (
      status &&
      clock >= Date.parse(status.resetsAt) &&
      reset.current !== status.resetsAt
    ) {
      reset.current = status.resetsAt;
      void query.refetch();
    }
  }, [clock, status?.resetsAt]);
  useEffect(() => {
    if (helpOpen) {
      setPaused(true);
      helpDialog.current?.showModal();
    } else helpDialog.current?.close();
  }, [helpOpen]);
  useEffect(() => {
    if (confirm) {
      setPaused(true);
      retireDialog.current?.showModal();
    } else retireDialog.current?.close();
  }, [confirm]);
  useEffect(() => {
    if (!animation) return;
    const timer = setTimeout(
      () =>
        setAnimation((previous) =>
          previous && previous.index + 1 < previous.beats.length
            ? { ...previous, index: previous.index + 1 }
            : null,
        ),
      440,
    );
    soundTone(
      sound,
      animation.beats[animation.index]?.outcome === "counter" ? "win" : "hit",
    );
    return () => clearTimeout(timer);
  }, [animation, sound]);
  async function send(path: string, body: unknown) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    retry.current = { path, body };
    const oldRun = run,
      oldEarned = status?.earned ?? {
        softCurrency: 0,
        packTickets: 0,
        styleShards: 0,
      };
    try {
      const next = await customFetch<ArcadeGameStatus>(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!active.current || player.current !== bootstrap.profile.id) return;
      retry.current = null;
      client.setQueryData(key, next);
      const delta = {
        softCurrency: next.earned.softCurrency - oldEarned.softCurrency,
        packTickets: next.earned.packTickets - oldEarned.packTickets,
        styleShards: next.earned.styleShards - oldEarned.styleShards,
      };
      if (Object.values(delta).some((v) => v > 0))
        client.setQueryData<PlayerBootstrap>(
          getGetPlayerBootstrapQueryKey(),
          (old) =>
            old
              ? {
                  ...old,
                  profile: {
                    ...old.profile,
                    softCurrency:
                      old.profile.softCurrency +
                      Math.max(0, delta.softCurrency),
                    packTickets:
                      old.profile.packTickets + Math.max(0, delta.packTickets),
                    styleShards:
                      old.profile.styleShards + Math.max(0, delta.styleShards),
                  },
                }
              : old,
        );
      if (
        oldRun?.kind === "girl-fade" &&
        next.run?.kind === "girl-fade" &&
        (body as { action?: ArcadeAction }).action?.type === "pattern"
      )
        setAnimation({ run: oldRun, beats: next.run.box.beats, index: 0 });
      if (
        next.run?.kind === "fade-market" &&
        next.run.market.powerups >
          (oldRun?.kind === "fade-market" ? oldRun.market.powerups : 0)
      )
        soundTone(sound, "stock");
    } catch (reason) {
      if (active.current) {
        setPaused(true);
        setError(
          reason instanceof Error
            ? reason.message
            : "Your turn did not connect. Retry the same turn.",
        );
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  function act(action: ArcadeAction) {
    if (!run || busy || retry.current || animation) return;
    void send(`${endpoint}/${run.id}/action`, {
      revision: run.revision,
      actionId: crypto.randomUUID(),
      action,
    });
  }
  const actionRef = useRef(act);
  actionRef.current = act;
  function start() {
    if (
      !startId.current ||
      (run?.phase === "ended" && run.id === startId.current)
    )
      startId.current = crypto.randomUUID();
    setPaused(false);
    void send(`${endpoint}/start`, { requestId: startId.current, choice });
  }
  const playing = run?.phase === "active" || animation;
  const exit = () => {
    void client.invalidateQueries({
      queryKey: getGetPlayerBootstrapQueryKey(),
    });
    onExit();
  };
  return (
    <main
      className="arcade-game"
      data-kind={kind}
      data-reduce-motion={bootstrap.profile.settings.reducedMotion}
      data-motion-paused={paused}
      aria-label={names[kind]}
    >
      <header className="arc-top">
        <button onClick={exit}>← FADECADE</button>
        <span>{captions[kind]}</span>
        <nav>
          <button
            disabled={run?.kind === "girl-fade" && run.box.stage === "pattern"}
            onClick={() => setHelpOpen(true)}
            aria-label={`How to play ${names[kind]}`}
          >
            HOW TO PLAY
          </button>
          <button
            aria-label="Toggle arcade sound"
            aria-pressed={sound}
            onClick={() => {
              setSound(!sound);
              try {
                localStorage.setItem(
                  "squabblemon:arcade-sound",
                  sound ? "off" : "on",
                );
              } catch {}
            }}
          >
            {sound ? "SFX ON" : "SFX OFF"}
          </button>
        </nav>
      </header>
      <section className="arc-stage" data-testid={`game-${kind}`}>
        <img
          className="arc-backdrop"
          src={art(
            kind === "girl-fade"
              ? "girl-close-ring"
              : kind === "fade-market"
                ? "market-stage"
                : "block-stage",
          )}
          alt=""
        />
        {!playing ? (
          <div className="arc-intro">
            <small>
              {kind === "block-takeover"
                ? "WEEKLY TURF WAR"
                : "TWO SHOTS / EVERY DAY"}
            </small>
            <h1>{names[kind]}</h1>
            <span className="arc-intro-tag">{captions[kind]}</span>
            {query.isPending ? (
              <p role="status">Opening the cabinet…</p>
            ) : query.isError ? (
              <>
                <p role="alert">Your game could not connect.</p>
                <button onClick={() => void query.refetch()}>RECONNECT</button>
              </>
            ) : run?.phase === "ended" ? (
              <div className="arc-result">
                {kind === "girl-fade" && run.result !== "retired" ? (
                  <Sprite name="callout-ko" className="arc-result-callout" />
                ) : (
                  <Fist />
                )}
                <strong>
                  {run.result === "win"
                    ? "YOU OWN THIS"
                    : run.result === "retired"
                      ? "CLOCKED OUT"
                      : kind === "girl-fade"
                        ? "DOWN FOR THE COUNT"
                        : kind === "fade-market"
                          ? "THE SHIFT IS OVER"
                          : "THE BLOCK FOUGHT BACK"}
                </strong>
                <p>
                  {run.kind === "girl-fade"
                    ? `${run.box.wins} wins · ${run.box.hits} counters`
                    : run.kind === "fade-market"
                      ? `Wave ${run.market.wave} · ${run.market.kills} YNs stopped`
                      : `${run.block.captured} districts captured · ${run.block.turn} turns`}
                </p>
                <div>
                  <b>
                    {status?.earned.softCurrency}
                    <small>CLOUT</small>
                  </b>
                  <b>
                    {status?.earned.packTickets}
                    <small>TICKETS</small>
                  </b>
                  <b>
                    {status?.earned.styleShards}
                    <small>STYLE SHARDS</small>
                  </b>
                </div>
                <small>Banked to your account. Kept when the run ends.</small>
              </div>
            ) : (
              <>
                <p className="arc-intro-copy">{help[kind][0]}</p>
                {kind === "girl-fade" || kind === "block-takeover" ? (
                  <div
                    className="arc-choices"
                    aria-label={
                      kind === "girl-fade"
                        ? "Choose your fighter"
                        : "Choose your crew"
                    }
                  >
                    {(kind === "girl-fade" ? GIRL_FIGHTERS : BLOCK_CREWS).map(
                      (c, i) => (
                        <button
                          key={c.name}
                          aria-pressed={choice === i}
                          onClick={() => setChoice(i)}
                        >
                          <img
                            src={
                              kind === "girl-fade"
                                ? art(`girl-${i}-front`)
                                : getAssetUrl(
                                    `assets/characters/${BLOCK_CREWS[i].card}.webp`,
                                  )
                            }
                            alt=""
                          />
                          <strong>{c.name}</strong>
                          <small>
                            {kind === "girl-fade"
                              ? GIRL_FIGHTERS[i].style
                              : `${BLOCK_CREWS[i].power} attack / ${BLOCK_CREWS[i].health} HP`}
                          </small>
                        </button>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="arc-market-cast">
                    <Sprite name="market-doctor" />
                    <span>
                      DR. FADE
                      <br />
                      <b>+ NIGHT CASHIER</b>
                    </span>
                    <Sprite name="market-cashier" />
                  </div>
                )}
              </>
            )}
            {status && (
              <>
                <button
                  className="arc-primary"
                  disabled={
                    busy ||
                    status.attemptsRemaining === 0 ||
                    Boolean(retry.current)
                  }
                  onClick={start}
                >
                  {busy
                    ? "SAVING…"
                    : status.attemptsRemaining === 0
                      ? "BACK AFTER RESET"
                      : kind === "girl-fade"
                        ? "GLOVES UP →"
                        : kind === "fade-market"
                          ? "OPEN THE SHIFT →"
                          : "TAKE THE BLOCK →"}
                </button>
                <small className="arc-entry-count">
                  {status.attemptsRemaining}/{ARCADE_RULES[kind].limit} ENTRIES
                  LEFT ·{" "}
                  {ARCADE_RULES[kind].cadence === "weekly"
                    ? "RESETS MONDAY UTC"
                    : "RESETS DAILY UTC"}
                </small>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="arc-run-title">
              <h1>{names[kind]}</h1>
              <span>
                {run?.kind === "girl-fade"
                  ? `ROUND ${animation?.run.box.round ?? run.box.round} / 6`
                  : run?.kind === "fade-market"
                    ? `WAVE ${run.market.wave}`
                    : run?.kind === "block-takeover"
                      ? `TURN ${run.block.turn} / ${run.block.maxTurns}`
                      : ""}
              </span>
              <b>{status?.earned.softCurrency} CLOUT BANKED</b>
            </div>
            {run?.kind === "girl-fade" && (
              <GirlFight
                run={animation?.run ?? run}
                beat={animation?.beats[animation.index] ?? null}
                animating={Boolean(animation)}
                now={clock}
                disabled={
                  busy ||
                  Boolean(retry.current) ||
                  Boolean(animation) ||
                  helpOpen ||
                  confirm
                }
                act={(action) => actionRef.current(action)}
              />
            )}
            {run?.kind === "fade-market" && (
              <MarketDefense
                run={run}
                disabled={busy || Boolean(retry.current) || helpOpen || confirm}
                paused={paused}
                setPaused={setPaused}
                act={(action) => actionRef.current(action)}
              />
            )}
            {run?.kind === "block-takeover" && (
              <BlockTakeover
                run={run}
                disabled={busy || Boolean(retry.current) || helpOpen || confirm}
                act={(action) => actionRef.current(action)}
              />
            )}
          </>
        )}
      </section>
      {error && (
        <aside className="arc-error" role="alert">
          <span>{error}</span>
          <button
            disabled={busy}
            onClick={() => {
              if (retry.current)
                void send(retry.current.path, retry.current.body);
            }}
          >
            RETRY SAME TURN
          </button>
          <button
            disabled={busy}
            onClick={() => {
              retry.current = null;
              setError("");
              void query.refetch();
            }}
          >
            SYNC GAME
          </button>
        </aside>
      )}
      {run?.phase === "active" && (
        <footer className="arc-run-footer">
          <p
            role="status"
            aria-live={kind === "fade-market" ? "off" : "polite"}
          >
            {run.log.join(" ")}
          </p>
          <button
            disabled={busy || Boolean(animation) || Boolean(retry.current)}
            onClick={() => setConfirm(true)}
          >
            END RUN
          </button>
        </footer>
      )}
      <dialog
        ref={helpDialog}
        className="arc-paper-dialog"
        aria-label={`How to play ${names[kind]}`}
        onCancel={() => setHelpOpen(false)}
        onClose={() => setHelpOpen(false)}
      >
        <h2>{names[kind]}</h2>
        {help[kind].map((line) => (
          <p key={line}>{line}</p>
        ))}
        <button className="arc-primary" onClick={() => setHelpOpen(false)}>
          GOT IT
        </button>
      </dialog>
      <dialog
        ref={retireDialog}
        className="arc-paper-dialog"
        aria-label="End arcade run"
        onCancel={() => setConfirm(false)}
        onClose={() => setConfirm(false)}
      >
        <h2>Clock out?</h2>
        <p>This ends the run and uses your entry. Banked rewards stay yours.</p>
        <button onClick={() => setConfirm(false)}>KEEP PLAYING</button>
        <button
          disabled={busy}
          onClick={() => {
            setConfirm(false);
            act({ type: "retire" });
          }}
        >
          END RUN
        </button>
      </dialog>
    </main>
  );
}
const moveSprites: Record<Direction, string> = {
  left: "jab-left",
  right: "jab-right",
  up: "uppercut",
  down: "duck",
};
const arrows: Record<Direction, string> = {
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
};
function GirlFight({
  run,
  beat,
  animating,
  now,
  disabled,
  act,
}: {
  run: GirlRun;
  beat: BoxBeat | null;
  animating: boolean;
  now: number;
  disabled: boolean;
  act: (action: ArcadeAction) => void;
}) {
  useEffect(() => {
    const urls = [
      [run.box.fighter, "back"],
      [run.box.opponent, "front"],
    ].map(([i, view]) => motionSpriteUrl(arcadeSpriteAnimation(`girl-${i}-${view}`)!));
    for (const url of urls) {
      const img = new Image();
      img.src = url;
      void img.decode().catch(() => undefined);
    }
  }, [run.box.fighter, run.box.opponent]);
  const b = run.box,
    [queue, setQueue] = useState<Direction[]>([]),
    [pose, setPose] = useState<Direction | null>(null),
    lastRevision = useRef(run.revision),
    sent = useRef(false);
  useEffect(() => {
    if (lastRevision.current !== run.revision) {
      lastRevision.current = run.revision;
      setQueue([]);
      setPose(null);
      sent.current = false;
    }
  }, [run.revision]);
  const watching = b.stage === "pattern" && now < b.opensAt,
    entering = b.stage === "pattern" && !watching && !animating,
    remaining = Math.max(0, Math.ceil((b.deadline - now) / 1000));
  function input(d: Direction) {
    if (disabled || !entering || queue.length >= b.pattern.length) return;
    setPose(d);
    setQueue((q) => (q.length < b.pattern.length ? [...q, d] : q));
  }
  const inputRef = useRef(input);
  inputRef.current = input;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const key: Record<string, Direction> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        a: "left",
        d: "right",
        w: "up",
        s: "down",
      };
      if (key[e.key]) {
        e.preventDefault();
        inputRef.current(key[e.key]);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (entering && now >= b.deadline && !disabled && !sent.current) {
      sent.current = true;
      act({ type: "pattern", directions: queue });
    }
  }, [entering, now, disabled]);
  const watchDuration = Math.max(1050, 2200 - b.wins * 150);
  const watchIndex = Math.min(
    b.pattern.length - 1,
    Math.max(
      0,
      Math.floor((1 - (b.opensAt - now) / watchDuration) * b.pattern.length),
    ),
  );
  const opponentMove =
    beat?.attack ?? (watching ? b.pattern[watchIndex] : null);
  const direction = beat?.direction ?? pose,
    dx = direction === "left" ? -30 : direction === "right" ? 30 : 0,
    dy = direction === "up" ? -18 : direction === "down" ? 18 : 0;
  return (
    <div className="girl-arena" data-outcome={beat?.outcome}>
      <div className="girl-player-hp">
        <Health
          value={run.health}
          max={run.maxHealth}
          label={GIRL_FIGHTERS[b.fighter].name}
        />
      </div>
      <div className="girl-opponent-hp">
        <Health
          value={b.enemyHealth}
          max={b.enemyMax}
          label={GIRL_FIGHTERS[b.opponent].name}
        />
      </div>
      <div
        className="girl-fight-window"
        style={{ backgroundImage: `url(${art("girl-close-ring")})` }}
      >
        <Sprite
          name={
            opponentMove
              ? `girl-${b.opponent}-front-${moveSprites[opponentMove]}`
              : `girl-${b.opponent}-front`
          }
          className={`girl-opponent ${opponentMove ? "" : "is-idle"}`}
          animationKey={`${run.revision}-${watchIndex}-${beat?.damage ?? 0}`}
          style={{
            transform: `translate(${beat?.attack === "left" ? -22 : beat?.attack === "right" ? 22 : 0}px,${beat?.attack === "down" ? 15 : 0}px)`,
          }}
        />
        <Sprite
          name={
            direction
              ? `girl-${b.fighter}-back-${moveSprites[direction]}`
              : `girl-${b.fighter}-back`
          }
          className={`girl-player ${direction ? "" : "is-idle"}`}
          animationKey={`${run.revision}-${queue.length}-${beat?.damage ?? 0}`}
          style={{ transform: `translate(${dx}px,${dy}px)` }}
        />
        {beat && (
          <div
            className="girl-impact"
            key={`${run.revision}-${beat.direction}-${beat.damage}-${now > 0 ? beat.outcome : ""}`}
          >
            <Sprite
              name={
                beat.outcome === "hit"
                  ? "callout-hit"
                  : beat.outcome === "counter"
                    ? "callout-counter"
                    : "callout-slip"
              }
            />
            <strong
              aria-label={
                beat.outcome === "counter"
                  ? `Counter, ${beat.damage} damage`
                  : beat.outcome === "hit"
                    ? `Hit, ${beat.damage} health lost`
                    : "Clean slip, no damage"
              }
            >
              {beat.outcome === "counter"
                ? `+${beat.damage}`
                : beat.outcome === "hit"
                  ? `−${beat.damage}`
                  : "NO DAMAGE"}
            </strong>
          </div>
        )}
      </div>
      <div className="girl-pattern-dock">
        {b.stage === "ready" || animating ? (
          <>
            <small>
              {animating
                ? "EXCHANGE RESOLVING"
                : "READY FOR THE NEXT EXCHANGE?"}
            </small>
            <button
              className="arc-primary"
              disabled={disabled}
              onClick={() => act({ type: "ready" })}
            >
              READ HER HANDS →
            </button>
          </>
        ) : (
          <>
            <header>
              <strong>
                {watching ? "WATCH HER ATTACK" : "YOUR COUNTER PATTERN"}
              </strong>
              <b>
                {watching
                  ? `${Math.ceil((b.opensAt - now) / 1000)}s`
                  : `${remaining}s`}
              </b>
            </header>
            <div
              className="girl-pattern"
              aria-label={
                watching ? "Opponent attack pattern" : "Your input pattern"
              }
            >
              {b.pattern.map((d, i) => (
                <span
                  key={i}
                  data-filled={Boolean(queue[i])}
                  data-danger={watching}
                  data-active={watching && i === watchIndex}
                >
                  {watching ? arrows[d] : queue[i] ? arrows[queue[i]] : "·"}
                </span>
              ))}
            </div>
            <p>
              {watching
                ? "Red direction = hit. Opposite direction = counter."
                : "Remember the red arrows. Queue the opposite steps."}
            </p>
            <div className="girl-direction-pad">
              {DIRECTIONS.map((d) => (
                <button
                  key={d}
                  disabled={
                    disabled || watching || queue.length >= b.pattern.length
                  }
                  aria-label={`Box ${d}`}
                  onClick={() => input(d)}
                >
                  {arrows[d]}
                  <small>
                    {d === "up"
                      ? "UPPERCUT"
                      : d === "down"
                        ? "DUCK"
                        : `${d} JAB`}
                  </small>
                </button>
              ))}
            </div>
            <div className="girl-pattern-actions">
              <button
                disabled={disabled || watching || !queue.length}
                onClick={() => {
                  setQueue((q) => q.slice(0, -1));
                  setPose(null);
                }}
              >
                UNDO
              </button>
              <button
                className="arc-primary"
                disabled={
                  disabled || watching || queue.length !== b.pattern.length
                }
                onClick={() => {
                  sent.current = true;
                  act({ type: "pattern", directions: queue });
                }}
              >
                THROW THE PATTERN
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
const laneX = (lane: number) => 15 + lane * 17.5;
function MarketDefense({
  run,
  disabled,
  paused,
  setPaused,
  act,
}: {
  run: MarketRun;
  disabled: boolean;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  act: (action: ArcadeAction) => void;
}) {
  const m = run.market,
    [aim, setAim] = useState(m.aim),
    [stockLane, setStockLane] = useState(m.destination),
    actionRef = useRef(act),
    stateRef = useRef({ aim, stockLane, disabled, paused }),
    [waveNotice, setWaveNotice] = useState(true);
  useEffect(() => {
    setWaveNotice(true);
    const timer = setTimeout(() => setWaveNotice(false), 1600);
    return () => clearTimeout(timer);
  }, [m.wave]);
  actionRef.current = act;
  stateRef.current = { aim, stockLane, disabled, paused };
  useEffect(() => {
    const timer = setInterval(() => {
      const s = stateRef.current;
      if (!s.disabled && !s.paused)
        actionRef.current({ type: "duty", aim: s.aim, stockLane: s.stockLane });
    }, 700);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "d"].includes(e.key)) {
        e.preventDefault();
        if (e.key === "a" || e.key === "d")
          setStockLane((n) =>
            Math.max(0, Math.min(4, n + (e.key === "a" ? -1 : 1))),
          );
        else
          setAim((n) =>
            Math.max(0, Math.min(4, n + (e.key === "ArrowLeft" ? -1 : 1))),
          );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <div className="market-defense" data-frozen={m.freeze > 0} data-motion-paused={paused}>
      <div className="market-health">
        <Health value={run.health} max={100} label="STORE INTEGRITY" />
        <button
          className="arc-pause"
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? "RESUME SHIFT" : "PAUSE SHIFT"}
        </button>
      </div>
      <div className="market-lanes">
        {Array.from({ length: 5 }, (_, i) => (
          <button
            key={i}
            style={{ left: `${laneX(i)}%` }}
            className="market-aim"
            data-aimed={aim === i}
            onClick={() => setAim(i)}
            aria-label={`Aim Dr. Fade at aisle ${i + 1}`}
          >
            <Fist />
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
      {m.enemies.map((e) => (
        <div
          className="market-enemy"
          key={e.id}
          style={{
            left: `${laneX(e.lane)}%`,
            top: `${17 + e.position * 5.2}%`,
          }}
          data-hit={m.firing.includes(e.id)}
        >
          <Sprite name={`market-yn-${e.variant}`} paused={m.freeze > 0} />
          {m.firing.includes(e.id) && (
            <Sprite name="callout-hit" className="market-hit-callout" />
          )}
          <meter
            aria-label={`YN ${e.id} health`}
            min={0}
            max={e.maxHp}
            value={e.hp}
          />
        </div>
      ))}
      <Sprite
        name={m.firing.length ? "market-punch-north" : "market-doctor-north"}
        className={`market-doctor ${m.firing.length ? "is-punching" : ""}`}
        animationKey={m.firing.length ? m.tick : undefined}
        style={{ left: `${laneX(m.aim)}%` }}
      />
      {m.firing.length > 0 && (
        <div
          className="market-hands"
          key={m.tick}
          style={{ left: `${laneX(m.aim)}%` }}
        >
          <Fist />
          <Fist />
        </div>
      )}
      <Sprite
        name={m.cashier === m.destination ? "market-restock" : "market-cashier"}
        className="market-cashier"
        style={{ left: `${laneX(m.cashier)}%` }}
      />
      {waveNotice && !paused && (
        <div className="market-wave-callout" role="status">
          <Sprite name="callout-wave" />
          <strong>WAVE {m.wave}</strong>
        </div>
      )}
      <div className="market-powerline">
        <span>{m.kills} YNs STOPPED</span>
        <b>
          POWER {m.power}
          {m.rapid > 0 ? " / RAPID HANDS" : ""}
          {m.freeze > 0 ? " / LANES FROZEN" : ""}
        </b>
        <span>{m.powerups} RESTOCK BOOSTS</span>
      </div>
      {m.restock !== null && (
        <div className="market-stock-flash" role="status">
          <Sprite name="callout-power" />
          {STOCK_ITEMS[m.restock].name.toUpperCase()}
          <strong>{STOCK_ITEMS[m.restock].effect}</strong>
        </div>
      )}
      <div
        className="market-restock-controls"
        aria-label="Night Cashier restock shelves"
      >
        {STOCK_ITEMS.map((item, i) => (
          <button
            key={item.name}
            data-selected={stockLane === i}
            onClick={() => setStockLane(i)}
            aria-label={`Restock ${item.name}`}
          >
            <span style={{ color: item.color }}>{item.name}</span>
            <meter
              aria-label={`${item.name} restock progress`}
              min={0}
              max={6}
              value={m.stock[i]}
            />
            <small>{item.effect}</small>
          </button>
        ))}
      </div>
      {paused && (
        <div className="market-paused">
          <Fist />
          <strong>SHIFT PAUSED</strong>
          <small>Your saved store is safe.</small>
          <button className="arc-primary" onClick={() => setPaused(false)}>
            BACK TO WORK →
          </button>
        </div>
      )}
    </div>
  );
}
function BlockTakeover({
  run,
  disabled,
  act,
}: {
  run: BlockRun;
  disabled: boolean;
  act: (action: ArcadeAction) => void;
}) {
  const b = run.block,
    [selected, setSelected] = useState(6),
    tile = b.tiles[selected],
    owned = b.tiles.filter((t) => t.owner === "player").length;
  return (
    <div className="block-takeover">
      <div className="block-health">
        <Health
          value={run.health}
          max={run.maxHealth}
          label={BLOCK_CREWS[b.crew].name}
        />
        <span>
          {b.supplies} SUPPLIES · {b.power} ATTACK · {owned}/9 HELD
        </span>
      </div>
      <div
        className="block-map"
        aria-label="District map"
        style={{ backgroundImage: `url(${art("block-stage")})` }}
      >
        {b.tiles.map((t, i) => (
          <button
            className="block-district"
            key={i}
            data-owner={t.owner}
            data-selected={selected === i}
            data-threat={b.threat === i}
            data-reachable={blockCanAttack(run, i)}
            disabled={disabled}
            onClick={() => setSelected(i)}
            aria-label={`${DISTRICTS[i]} · ${t.owner} · ${Math.max(0, t.defense)} defense${b.threat === i ? " · incoming raid" : ""}`}
          >
            {t.owner !== "neutral" && <AnimatedSprite animation={blockSpriteAnimation(t.owner === "player" ? b.crew : (b.crew + 1) % BLOCK_CREWS.length)} name={`block-${t.owner}-crew`} className="block-crew-token" paused={disabled} />}
            <span className="block-flag">
              <Fist />
              <b>{Math.max(0, t.defense)}</b>
            </span>
            <strong>{DISTRICTS[i]}</strong>
            {b.threat === i && <small>INCOMING RAID</small>}
            {i === 0 && owned < 6 && <small>HQ / HOLD SIX FIRST</small>}
          </button>
        ))}
      </div>
      <div className="block-command">
        <header>
          <strong>{DISTRICTS[selected]}</strong>
          <span>
            {tile.owner === "player"
              ? "YOUR TURF"
              : tile.owner === "rival"
                ? "RIVAL CREW"
                : "UNCLAIMED"}{" "}
            · {Math.max(0, tile.defense)}{" "}
            {tile.owner === "player" ? "DEFENSE" : "RESISTANCE"}
          </span>
        </header>
        <div>
          <button
            disabled={
              disabled || !blockCanAttack(run, selected) || b.supplies < 1
            }
            onClick={() => act({ type: "attack", tile: selected })}
          >
            TAKE DISTRICT<small>1 SUPPLY</small>
          </button>
          <button
            disabled={disabled || tile.owner !== "player" || b.supplies < 1}
            onClick={() => act({ type: "defend", tile: selected })}
          >
            FORTIFY<small>1 SUPPLY / +5 DEFENSE</small>
          </button>
          <button disabled={disabled} onClick={() => act({ type: "supply" })}>
            GET SUPPLIES<small>+3 / RIVALS MOVE</small>
          </button>
          <button
            disabled={disabled || b.supplies < 3}
            onClick={() => act({ type: "rally" })}
          >
            RALLY CREW<small>3 SUPPLIES / HEAL + POWER</small>
          </button>
        </div>
      </div>
    </div>
  );
}
