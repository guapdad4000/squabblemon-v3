import { useEffect, useState } from "react";
import { getAssetUrl } from "../../lib/assets";
import { KumiteSearchBackdrop } from "./KumiteSearchBackdrop";
import "./kumite-opponent-search.css";

export interface KumiteSearchIdentity {
  name: string;
  art: string;
  level: number;
  crewName: string;
  rank?: string;
}
export type KumiteSearchState =
  | { phase: "searching" | "reconnecting"; elapsedSeconds: number }
  | {
      phase: "matched" | "connecting";
      elapsedSeconds: number;
      opponent: KumiteSearchIdentity;
    }
  | { phase: "cancelled" }
  | { phase: "error"; elapsedSeconds: number; message: string };

const headlines = {
  searching: ["FIND", "THE OPPS."],
  reconnecting: ["HOLD", "THE LINE."],
  matched: ["THE OPPS", "PULLED UP."],
  connecting: ["TIME TO", "THROW HANDS."],
  cancelled: ["BACK", "TO THE DOJO."],
  error: ["LINE", "CUT."],
} as const;

function Portrait({
  art,
  name,
  className = "",
}: {
  art: string;
  name: string;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  return failedSource === art ? (
    <span className={`km-portrait-fallback ${className}`} aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  ) : (
    <img
      className={className}
      src={art}
      alt=""
      draggable={false}
      decoding="async"
      onError={() => setFailedSource(art)}
    />
  );
}

/** Presentation only. Queue admission, elapsed time, identities and cancellation
 * must come from the owning transport; this component never invents a match. */
export function KumiteOpponentSearch({
  player,
  state,
  reducedMotion = false,
  busy = false,
  onCancel,
  onRetry,
  onEntryComplete,
}: {
  player: KumiteSearchIdentity;
  state: KumiteSearchState;
  reducedMotion?: boolean;
  busy?: boolean;
  onCancel(): void;
  onRetry?(): void;
  /** Decorative entry readiness only; the owner retains navigation/transport authority. */
  onEntryComplete?(): void;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const syncVisibility = () => setVisible(!document.hidden);
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () =>
      document.removeEventListener("visibilitychange", syncVisibility);
  }, []);
  const opponent = "opponent" in state ? state.opponent : undefined;
  const [lead, title] = headlines[state.phase];
  const elapsed =
    "elapsedSeconds" in state && Number.isFinite(state.elapsedSeconds)
      ? Math.max(0, Math.floor(state.elapsedSeconds))
      : 0;
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  const searching =
    state.phase === "searching" || state.phase === "reconnecting";
  const canRetry = state.phase === "error" || state.phase === "cancelled";
  const announcement =
    state.phase === "matched"
      ? `Opponent found: ${opponent?.name}.`
      : state.phase === "connecting"
        ? `Entering the arena against ${opponent?.name}.`
        : state.phase === "reconnecting"
          ? "Reconnecting. Your search is being checked."
          : state.phase === "error"
            ? state.message
            : state.phase === "cancelled"
              ? "Search cancelled."
              : "Finding The Opps.";

  return (
    <main
      className="km-search"
      data-phase={state.phase}
      data-color={Boolean(opponent)}
      data-visible={visible}
      data-reduced-motion={reducedMotion}
      aria-label="Kumite opponent search"
    >
      <div className="km-search-paper" aria-hidden="true" />
      <div className="km-search-dark" aria-hidden="true" />
      <KumiteSearchBackdrop
        key={opponent ? "assigned" : "unknown"}
        assigned={Boolean(opponent)}
        searching={searching}
        entering={state.phase === "connecting"}
        reducedMotion={reducedMotion}
        onEntryComplete={onEntryComplete}
      />
      <div className="km-search-dots" aria-hidden="true" />
      <div className="km-search-scratches" aria-hidden="true" />
      <div className="km-search-scan" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className="km-search-header">
        <img
          src={getAssetUrl("assets/kumite/squabblemon-wordmark.webp")}
          alt="Squabblemon"
          draggable={false}
        />
        <div className="km-search-mode">
          <b>KUMITE</b>
          <span>BREAKTHROUGH</span>
        </div>
      </header>

      <div className="km-search-player-art" aria-hidden="true">
        <Portrait
          art={player.art}
          name={player.name}
          className="km-search-player-echo"
        />
        <Portrait
          art={player.art}
          name={player.name}
          className="km-search-player-image"
        />
        <Portrait
          art={player.art}
          name={player.name}
          className="km-search-player-color"
        />
        <div className="km-search-ink-swipe" />
      </div>
      <div
        className="km-search-opponent-art"
        data-assigned={Boolean(opponent)}
        aria-hidden="true"
      >
        {opponent ? (
          <>
            <Portrait
              key={`${opponent.art}:ink`}
              art={opponent.art}
              name={opponent.name}
              className="km-search-opponent-image"
            />
            <Portrait
              key={`${opponent.art}:color`}
              art={opponent.art}
              name={opponent.name}
              className="km-search-opponent-color"
            />
          </>
        ) : (
          <img
            className="km-search-unknown-image"
            src={getAssetUrl(
              "assets/kumite/matchmaking/unknown-challenger-v1.webp",
            )}
            alt=""
            draggable={false}
          />
        )}
        {!opponent && <span className="km-search-question">?</span>}
      </div>

      <h1 className="km-search-headline" key={state.phase}>
        <span>{lead}</span>
        <strong>{title}</strong>
      </h1>
      <div
        className="km-search-state"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      <section className="km-search-player" aria-label="Your fighter">
        <div className="km-search-side-label">YOU / CREW LOCKED</div>
        <div className="km-search-player-name">
          <span className="km-search-level">
            <small>LV</small>
            {player.level}
          </span>
          <h2>{player.name}</h2>
        </div>
        <p>{player.crewName}</p>
        {player.rank && <small className="km-search-rank">{player.rank}</small>}
      </section>
      <section
        className="km-search-opponent"
        aria-label={opponent ? "Matched opponent" : "Opponent not yet revealed"}
      >
        <div className="km-search-side-label">
          {opponent ? "THE OPPS / LOCKED IN" : "CHALLENGER / UNKNOWN"}
        </div>
        <div className="km-search-opponent-name">
          {opponent && (
            <span className="km-search-level">
              <small>LV</small>
              {opponent.level}
            </span>
          )}
          <h2>{opponent?.name ?? "???"}</h2>
        </div>
        <p>
          {opponent?.crewName ?? (canRetry ? "OFF THE LINE" : "SEARCHING…")}
        </p>
        {opponent?.rank && (
          <small className="km-search-rank">{opponent.rank}</small>
        )}
      </section>

      <footer className="km-search-footer">
        <div className="km-search-signal" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="km-search-clock">
          <small>
            {state.phase === "reconnecting"
              ? "CHECKING SIGNAL"
              : opponent
                ? "MATCH LOCKED"
                : canRetry
                  ? "OFF THE LINE"
                  : "ON THE LINE"}
          </small>
          <time aria-label={`${elapsed} seconds elapsed`}>
            {minutes}
            <span>:</span>
            {seconds}
          </time>
        </div>
        <div className="km-search-footer-type" aria-hidden="true">
          {searching
            ? "ANYBODY CAN GET IT."
            : opponent
              ? "NO MORE TALK."
              : "KEEP YOUR HANDS READY."}
        </div>
        <div className="km-search-actions">
          {canRetry && onRetry && (
            <button
              className="km-search-retry"
              type="button"
              onClick={onRetry}
              disabled={busy}
            >
              RUN IT BACK <span aria-hidden="true">↗</span>
            </button>
          )}
          <button
            className="km-search-cancel"
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={
              state.phase === "cancelled"
                ? "Back to Kumite"
                : "Back out of opponent search"
            }
          >
            {busy
              ? "BACKING OUT…"
              : state.phase === "cancelled"
                ? "BACK TO KUMITE"
                : "BACK OUT"}
            <span aria-hidden="true">↙</span>
          </button>
        </div>
      </footer>
      {state.phase === "error" && (
        <p className="km-search-error">{state.message}</p>
      )}
      <div className="km-search-edge-type" aria-hidden="true">
        KUMITE / NO FREE HANDS / KUMITE / NO FREE HANDS
      </div>
    </main>
  );
}
