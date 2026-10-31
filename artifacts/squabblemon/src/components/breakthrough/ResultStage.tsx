import { useRef, useEffect, type KeyboardEvent } from "react";
import { BREAKTHROUGH_TROPHY } from "./progressionArt";
import { KumiteMatchMedia } from "../kumite/KumiteMatchMedia";

export default function ResultStage({
  winner,
  reason,
  breaches,
  hands,
  stats,
  reducedMotion,
  rematch,
  newDeal,
  onExit,
}: {
  winner?: string | null;
  reason?: string | null;
  breaches: [number, number];
  hands: [number, number];
  stats?: { damage: number; deployments: number };
  reducedMotion: boolean;
  rematch(): void;
  newDeal(): void;
  onExit(): void;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusFirst = () => {
      const first = Array.from(
        node.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      ).find((button) => button.getClientRects().length);
      (first ?? node).focus({ preventScroll: true });
    };
    const containFocus = (event: FocusEvent) => {
      if (!node.contains(event.target as Node)) focusFirst();
    };
    focusFirst();
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("focusin", containFocus);
      if (
        previous?.isConnected &&
        (node.contains(document.activeElement) ||
          document.activeElement === document.body)
      ) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);
  function keys(event: KeyboardEvent<HTMLElement>) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      newDeal();
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = Array.from(
      dialog.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? [],
    ).filter((button) => button.getClientRects().length);
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (!first) {
      event.preventDefault();
      dialog.current?.focus();
    } else if (
      document.activeElement === dialog.current ||
      !dialog.current?.contains(document.activeElement)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  const outcome =
    winner === "player" ? "win" : winner === "opponent" ? "loss" : "draw";
  const handsDecided = breaches[0] === breaches[1] && reason?.includes("Hands");
  return (
    <section
      ref={dialog}
      onKeyDown={keys}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      tabIndex={-1}
      className={`bt-finish bt-finish-${outcome}${reducedMotion ? " bt-finish-still" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={
        outcome === "win" ? "Win" : outcome === "loss" ? "Loss" : "Draw"
      }
    >
      <div className="bt-finish-ink" aria-hidden="true" />
      <div className="bt-result-courts" aria-hidden="true">
        <div
          className="bt-result-court bt-result-court-you"
          data-winning={outcome === "win"}
        >
          <KumiteMatchMedia
            kind="golden"
            active={outcome === "win"}
            reducedMotion={reducedMotion}
          />
        </div>
        <div
          className="bt-result-court bt-result-court-opps"
          data-winning={outcome === "loss"}
        >
          <KumiteMatchMedia
            kind="crimson"
            active={outcome === "loss"}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>
      <div className="bt-finish-body">
        {outcome === "win" ? (
          <span
            className="bt-finish-hand bt-win-motion"
            role="img"
            aria-label="Win"
          >
            <KumiteMatchMedia kind="victory" reducedMotion={reducedMotion} />
          </span>
        ) : outcome === "loss" ? (
          <span
            className="bt-finish-hand bt-loss-motion"
            role="img"
            aria-label="Loss"
          >
            <i className="bt-batch10-sprite bt-b10-loss" />
          </span>
        ) : (
          <h2 className="bt-finish-draw">DRAW</h2>
        )}
        <div
          className="bt-finish-score"
          aria-label={`Breaches: you ${breaches[0]}, CPU ${breaches[1]}`}
        >
          <small>BREACHES</small>
          <strong>
            {breaches[0]} <i>—</i> {breaches[1]}
          </strong>
          {handsDecided && (
            <span className="bt-finish-hands">
              HANDS {hands[0]} — {hands[1]}
            </span>
          )}
        </div>
        <div className="bt-finish-actions">
          <button className="bt-primary" onClick={rematch}>
            RUN IT BACK →
          </button>
        </div>
        <div className="bt-trophy-summary">
          <img src={BREAKTHROUGH_TROPHY} alt="Breakthrough fist trophy" />
          <div>
            <small>CPU PRACTICE</small>
            <span>NO ACCOUNT REWARDS</span>
          </div>
          {stats && (
            <dl className="bt-match-stats">
              <div>
                <dt>DAMAGE</dt>
                <dd>{stats.damage}</dd>
              </div>
              <div>
                <dt>PLAYED</dt>
                <dd>{stats.deployments}</dd>
              </div>
            </dl>
          )}
        </div>
        <button className="bt-text-button bt-new-deal" onClick={newDeal}>
          CHANGE DECK ↗
        </button>
        <button className="bt-text-button" onClick={onExit}>
          BACK TO KUMITE ←
        </button>
      </div>
    </section>
  );
}
