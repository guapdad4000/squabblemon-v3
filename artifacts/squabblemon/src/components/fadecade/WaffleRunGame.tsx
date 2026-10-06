import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from "@workspace/api-client-react";
import {
  WAFFLE_MOVES,
  WAFFLE_STAFF,
  WAFFLE_REWARD_STOPS,
  waffleHopTargets,
  waffleWatchedPlate,
  type WaffleRun,
  type WaffleReward,
  type WaffleAction,
  type WaffleMoveId,
} from "@workspace/squabblemon-engine/waffleRun";
import { getAssetUrl } from "../../lib/assets";
import { setBattleActive } from "../../lib/imageWarmup";
import "../../styles/waffle-run.css";
export type WaffleRunStatus = {
  date: string;
  attemptsRemaining: number;
  resetsAt: string;
  serverNow: number;
  run: WaffleRun | null;
  earned: WaffleReward;
};
const endpoint = "/api/player/challenges/waffle-run";
const art = (name: string) => getAssetUrl(`assets/waffle-run/${name}.webp`);
const positions = [
  [20, 42],
  [50, 42],
  [80, 42],
  [20, 71],
  [50, 71],
  [80, 71],
];
const glyphs: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
};
function PixelTitle({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <svg
      className={`wr-pixel-title ${className}`}
      viewBox={`0 0 ${text.length * 6 - 1} 7`}
      role="img"
      aria-label={text}
      shapeRendering="crispEdges"
    >
      {[...text].flatMap((letter, i) =>
        (glyphs[letter] ?? []).flatMap((row, y) =>
          [...row].map((bit, x) =>
            bit === "1" ? (
              <rect
                key={`${i}-${x}-${y}`}
                x={i * 6 + x}
                y={y}
                width={1}
                height={1}
              />
            ) : null,
          ),
        ),
      )}
    </svg>
  );
}
function Sprite({
  name,
  className = "",
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={art(name)}
      className={`wr-sprite ${className}`}
      style={style}
      alt=""
      draggable={false}
    />
  );
}
function HP({ hp, max, label }: { hp: number; max: number; label: string }) {
  return (
    <div className="wr-hp" data-low={hp / max < 0.3}>
      <span>{label}</span>
      <div
        role="progressbar"
        aria-label={`${label} health`}
        aria-valuenow={hp}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <i style={{ width: `${Math.max(0, hp / max) * 100}%` }} />
      </div>
      <b>
        {hp}/{max}
      </b>
    </div>
  );
}
function playSound(
  kind: "hop" | "battle" | "move" | "win" | "end",
  enabled: boolean,
) {
  if (!enabled) return;
  try {
    const Context = window.AudioContext;
    if (!Context) return;
    const audio = new Context(),
      gain = audio.createGain();
    gain.connect(audio.destination);
    gain.gain.value = 0.025;
    const notes =
      kind === "hop"
        ? [440, 660, 880]
        : kind === "win"
          ? [523, 659, 784, 1046]
          : kind === "battle"
            ? [196, 147, 98]
            : kind === "end"
              ? [330, 247, 165]
              : [220, 110];
    notes.forEach((note, i) => {
      const oscillator = audio.createOscillator();
      oscillator.type = "square";
      oscillator.frequency.value = note;
      oscillator.connect(gain);
      oscillator.start(audio.currentTime + i * 0.075);
      oscillator.stop(audio.currentTime + i * 0.075 + 0.065);
    });
    window.setTimeout(() => void audio.close(), notes.length * 75 + 100);
  } catch {
    /* Silent play remains fully functional. */
  }
}
export function WaffleRunGame({
  bootstrap,
  onExit,
}: {
  bootstrap: PlayerBootstrap;
  onExit: () => void;
}) {
  const client = useQueryClient(),
    key = ["waffle-run", bootstrap.profile.id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => customFetch<WaffleRunStatus>(endpoint),
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const status = query.data,
    run = status?.run ?? null;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [clock, setClock] = useState(Date.now),
    [animatedPlate, setAnimatedPlate] = useState<number | null>(null),
    [effect, setEffect] = useState("");
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem("squabblemon:waffle-sound") !== "off";
    } catch {
      return true;
    }
  });
  const [replace, setReplace] = useState(1),
    [confirmRetire, setConfirmRetire] = useState(false);
  const lock = useRef(false),
    retry = useRef<{ body: unknown; path: string } | null>(null),
    startId = useRef<string | null>(null),
    active = useRef(true);
  const clockOffset = useRef(0),
    retireDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmRetire) retireDialog.current?.showModal();
    else retireDialog.current?.close();
  }, [confirmRetire]);
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
      clockOffset.current = status.serverNow - Date.now();
      setClock(status.serverNow);
    }
  }, [status]);
  useEffect(() => {
    const timer = setInterval(
      () => setClock(Date.now() + clockOffset.current),
      150,
    );
    return () => clearInterval(timer);
  }, []);
  const refreshedReset = useRef<string | null>(null);
  useEffect(() => {
    if (
      status &&
      clock >= Date.parse(status.resetsAt) &&
      refreshedReset.current !== status.resetsAt
    ) {
      refreshedReset.current = status.resetsAt;
      void query.refetch();
    }
  }, [clock, status?.resetsAt, query.refetch]);
  const watched = run ? waffleWatchedPlate(run, clock) : 0;
  const targets = run ? waffleHopTargets(run) : [];
  const lastPhase = useRef(run?.phase);
  useEffect(() => {
    if (run?.phase && lastPhase.current !== run.phase) {
      playSound(
        run.phase === "learning"
          ? "battle"
          : run.phase === "ended"
            ? "end"
            : "win",
        sound,
      );
      lastPhase.current = run.phase;
    }
  }, [run?.phase, sound]);
  useEffect(() => {
    if (!effect) return;
    const timer = setTimeout(() => setEffect(""), 700);
    return () => clearTimeout(timer);
  }, [effect]);
  async function send(path: string, body: unknown) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    retry.current = { path, body };
    try {
      const next = await customFetch<WaffleRunStatus>(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!active.current) return;
      client.setQueryData(key, next);
      retry.current = null;
      setAnimatedPlate(null);
      if (
        next.earned.softCurrency !== status?.earned.softCurrency ||
        next.earned.packTickets !== status?.earned.packTickets ||
        next.earned.styleShards !== status?.earned.styleShards
      )
        void client.invalidateQueries({
          queryKey: getGetPlayerBootstrapQueryKey(),
        });
    } catch (reason) {
      if (active.current) {
        setAnimatedPlate(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not save your move. Retry it.",
        );
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  function start() {
    if (
      !startId.current ||
      (run?.id === startId.current && run.phase === "ended")
    )
      startId.current = crypto.randomUUID();
    void send(`${endpoint}/start`, { requestId: startId.current });
  }
  function act(action: WaffleAction) {
    if (!run || busy || retry.current) return;
    if (action.type === "hop") {
      setAnimatedPlate(action.plate);
      playSound("hop", sound);
    }
    if (action.type === "move") {
      setEffect(`${action.move}-${Date.now()}`);
      playSound("move", sound);
    }
    void send(`${endpoint}/${run.id}/action`, {
      revision: run.revision,
      actionId: crypto.randomUUID(),
      action,
    });
  }
  const activeRun = run && run.phase !== "ended";
  return (
    <main
      className="waffle-run"
      data-phase={run?.phase ?? "intro"}
      data-reduce-motion={bootstrap.profile.settings.reducedMotion}
      aria-label="Squabblehouse Waffle Run"
    >
      <header className="wr-top">
        <button onClick={onExit} aria-label="Leave Squabblehouse">
          ← FADECADE
        </button>
        <span>SQUABBLEHOUSE / NIGHT SHIFT</span>
        <button
          aria-label={
            sound ? "Mute Waffle Run sounds" : "Enable Waffle Run sounds"
          }
          aria-pressed={sound}
          onClick={() => {
            const next = !sound;
            setSound(next);
            try {
              localStorage.setItem(
                "squabblemon:waffle-sound",
                next ? "on" : "off",
              );
            } catch {}
          }}
        >
          {sound ? "SFX ON" : "SFX OFF"}
        </button>
      </header>
      <section className="wr-cabinet-screen" data-testid="waffle-run-screen">
        <img className="wr-diner" src={art("diner")} alt="" />
        <div className="wr-scanlines" aria-hidden="true" />
        {!activeRun ? (
          <div className="wr-intro">
            <span className="wr-neon-kicker">SQUABBLEHOUSE PRESENTS</span>
            <PixelTitle text="WAFFLE RUN" />
            <div className="wr-intro-bird">
              <Sprite
                name={run?.phase === "ended" ? "pigeon-hurt" : "pigeon-idle"}
              />
            </div>
            {query.isPending ? (
              <p role="status">Warming up the griddle…</p>
            ) : query.isError ? (
              <div className="wr-load-error" role="alert">
                <p>The diner did not connect.</p>
                <button
                  className="wr-pixel-button"
                  onClick={() => void query.refetch()}
                >
                  TRY AGAIN
                </button>
              </div>
            ) : run?.phase === "ended" ? (
              <div className="wr-receipt">
                <PixelTitle text="BIRD DOWN" />
                <strong>
                  {run.endReason === "retired"
                    ? "YOU CASHED OUT"
                    : "THE HOUSE CAUGHT YOU"}
                </strong>
                <p>
                  {run.waffles} waffles · {run.wins} battles won
                </p>
                <div>
                  <b>
                    {status?.earned.softCurrency ?? 0}
                    <small>CLOUT BANKED</small>
                  </b>
                  <b>
                    {status?.earned.packTickets ?? 0}
                    <small>TICKETS</small>
                  </b>
                  <b>
                    {status?.earned.styleShards ?? 0}
                    <small>STYLE SHARDS</small>
                  </b>
                </div>
                <small>Saved to your account. No claim button needed.</small>
              </div>
            ) : (
              <p className="wr-howto">
                Hop plate to plate. Avoid the red watch.
                <br />
                Get caught? Learn a move and fight your way out.
              </p>
            )}
            {status && (
              <>
                <button
                  className="wr-pixel-button wr-start"
                  disabled={
                    busy ||
                    status.attemptsRemaining === 0 ||
                    Boolean(retry.current)
                  }
                  onClick={start}
                >
                  {busy
                    ? "OPENING…"
                    : status.attemptsRemaining === 0
                      ? "BACK AFTER RESET"
                      : "SNEAK IN →"}
                </button>
                <span className="wr-daily">
                  {status.attemptsRemaining}/2 RUNS LEFT TODAY · RESET{" "}
                  {new Date(status.resetsAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="wr-score">
              <span>
                <small>WAFFLES</small>
                <b>{String(run.waffles).padStart(2, "0")}</b>
              </span>
              <span>
                <small>FADES WON</small>
                <b>{run.wins}</b>
              </span>
              <span>
                <small>BANKED</small>
                <b>{status?.earned.softCurrency} C</b>
              </span>
              <span>
                <small>TICKETS</small>
                <b>{status?.earned.packTickets}</b>
              </span>
            </div>
            {run.phase === "hopping" ? (
              <div className="wr-hop-board" aria-label="Diner tables">
                <div className="wr-patrol">
                  <span>HOUSE ATTENTION</span>
                  <meter
                    min={0}
                    max={100}
                    value={run.alarm}
                    aria-label="Staff attention"
                  />
                  <b>{run.alarm}%</b>
                </div>
                {positions.map(([x, y], i) => (
                  <button
                    key={i}
                    className="wr-plate"
                    data-current={run.plate === i}
                    data-target={targets.includes(i)}
                    data-watched={watched === i}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    disabled={
                      busy ||
                      clock - run.phaseStartedAt < 260 ||
                      !targets.includes(i) ||
                      Boolean(retry.current)
                    }
                    aria-label={`Hop to plate ${i + 1}${watched === i ? " · staff watching" : ""}`}
                    onClick={() => act({ type: "hop", plate: i })}
                  >
                    <Sprite
                      name={run.plate === i ? "plate-empty" : "plate-waffle"}
                    />
                    {targets.includes(i) && (
                      <span>{watched === i ? "WATCHED" : "HOP HERE"}</span>
                    )}
                  </button>
                ))}
                <Sprite
                  name={animatedPlate === null ? "pigeon-idle" : "pigeon-hop"}
                  className={`wr-hopping-bird ${animatedPlate !== null ? "is-hopping" : ""}`}
                  style={{
                    left: `${positions[animatedPlate ?? run.plate][0]}%`,
                    top: `${positions[animatedPlate ?? run.plate][1] - 5}%`,
                  }}
                />
                <div className="wr-bird-health">
                  <HP hp={run.hp} max={run.maxHp} label="INNERCITY PIGEON" />
                </div>
                <div className="wr-hop-tip">
                  {busy
                    ? "LANDING…"
                    : "Tap a glowing plate. The red plate is being watched."}
                </div>
              </div>
            ) : (
              <div className={`wr-battle ${effect ? "wr-battle--attack" : ""}`}>
                <div className="wr-staff-health">
                  <HP
                    hp={run.enemyHp}
                    max={run.enemyMaxHp}
                    label={WAFFLE_STAFF[run.enemy].name.toUpperCase()}
                  />
                  <span className="wr-intent">
                    {run.phase === "learning"
                      ? "CAUGHT YOU"
                      : run.enemyIntent === "wind-up"
                        ? "WINDING UP"
                        : run.enemyCharge
                          ? "HEAVY HIT COMING"
                          : run.enemyIntent === "guard"
                            ? "GUARDING"
                            : "READY TO SWING"}
                  </span>
                </div>
                <Sprite
                  name={`staff-${run.enemy}`}
                  className="wr-staff-sprite"
                />
                <Sprite
                  name={
                    effect.startsWith("syrup-spit")
                      ? "pigeon-syrup"
                      : effect
                        ? "pigeon-attack"
                        : "pigeon-back"
                  }
                  className="wr-battle-bird"
                />
                <div className="wr-battle-health">
                  <HP hp={run.hp} max={run.maxHp} label="INNERCITY PIGEON" />
                </div>
                {run.phase === "learning" ? (
                  <div className="wr-learning">
                    <PixelTitle text="NEW MOVE" />
                    <p>One new trick. Every time they catch you.</p>
                    {run.moves.length >= 4 && (
                      <label>
                        FORGET{" "}
                        <select
                          aria-label="Move to replace"
                          value={replace}
                          disabled={busy}
                          onChange={(e) => setReplace(Number(e.target.value))}
                        >
                          {run.moves.map(
                            (id, index) =>
                              index > 0 && (
                                <option key={id} value={index}>
                                  {WAFFLE_MOVES[id].name}
                                </option>
                              ),
                          )}
                        </select>
                      </label>
                    )}
                    <div>
                      {run.offeredMoves.map((id) => (
                        <button
                          key={id}
                          disabled={busy || Boolean(retry.current)}
                          data-tone={WAFFLE_MOVES[id].tone}
                          onClick={() =>
                            act({
                              type: "learn",
                              move: id,
                              replace:
                                run.moves.length >= 4 ? replace : undefined,
                            })
                          }
                        >
                          <strong>{WAFFLE_MOVES[id].name}</strong>
                          <small>{WAFFLE_MOVES[id].description}</small>
                          <b>{WAFFLE_MOVES[id].pp} USES / FIGHT</b>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="wr-command">
                    <div
                      className="wr-battle-log"
                      role="status"
                      aria-live="polite"
                    >
                      {run.log.join(" ")}
                    </div>
                    <div className="wr-moves">
                      {run.moves.map((id) => (
                        <button
                          key={id}
                          data-tone={WAFFLE_MOVES[id].tone}
                          title={WAFFLE_MOVES[id].description}
                          disabled={
                            busy || !run.pp[id] || Boolean(retry.current)
                          }
                          onClick={() => act({ type: "move", move: id })}
                        >
                          <strong>{WAFFLE_MOVES[id].name}</strong>
                          <span>
                            {id === "peck"
                              ? "∞"
                              : `${run.pp[id]}/${WAFFLE_MOVES[id].pp}`}{" "}
                            PP
                          </span>
                          <small>{WAFFLE_MOVES[id].description}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
      {error && (
        <aside className="wr-save-error" role="alert">
          <span>{error}</span>
          <button
            disabled={busy}
            onClick={() => {
              if (retry.current)
                void send(retry.current.path, retry.current.body);
            }}
          >
            RETRY SAME MOVE
          </button>
          <button
            disabled={busy}
            onClick={() => {
              retry.current = null;
              setError("");
              void query.refetch();
            }}
          >
            SYNC RUN
          </button>
        </aside>
      )}
      <footer className="wr-bottom">
        <div
          className="wr-reward-strip"
          aria-label="Progressive reward checkpoints"
        >
          {WAFFLE_REWARD_STOPS.map((stop) => (
            <span
              key={stop.waffles}
              data-earned={(run?.waffles ?? 0) >= stop.waffles}
            >
              <b>{stop.waffles} WAFFLES</b>
              <small>{stop.label}</small>
            </span>
          ))}
        </div>
        {activeRun && (
          <button
            className="wr-end-run"
            disabled={busy || Boolean(retry.current)}
            onClick={() => setConfirmRetire(true)}
          >
            END RUN
          </button>
        )}
      </footer>
      <dialog
        ref={retireDialog}
        className="wr-retire-confirm"
        aria-label="End diner run"
        onCancel={() => setConfirmRetire(false)}
        onClose={() => setConfirmRetire(false)}
      >
        <strong>Clock out early?</strong>
        <p>
          This ends the run and uses the attempt. Your banked rewards stay
          yours.
        </p>
        <button onClick={() => setConfirmRetire(false)}>KEEP PLAYING</button>
        <button
          onClick={() => {
            setConfirmRetire(false);
            act({ type: "retire" });
          }}
        >
          END RUN
        </button>
      </dialog>
    </main>
  );
}
export function WaffleMachine({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="fadecade-machine-group waffle-machine">
      <button
        className="waffle-machine__cabinet"
        onClick={onOpen}
        aria-label="Open Squabblehouse Waffle Run"
        data-testid="fadecade-waffle"
      >
        <img
          src={art("cabinet-v3")}
          alt="Squabblehouse Waffle Run arcade cabinet"
        />
        <span className="waffle-machine__preview">
          <img className="waffle-machine__diner" src={art("diner")} alt="" />
          <img
            className="waffle-machine__bird"
            src={art("pigeon-idle")}
            alt=""
          />
          <small>2 DAILY RUNS</small>
          <strong>STEAL. FIGHT. SURVIVE.</strong>
          <span className="waffle-machine__play">PLAY WAFFLE RUN →</span>
        </span>
      </button>
    </div>
  );
}
