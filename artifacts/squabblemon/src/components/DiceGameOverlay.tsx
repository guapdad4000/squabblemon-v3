import { useEffect, useState } from "react";
import type { Match } from "../gameEngine";
import "../styles/blockbusters.css";

export function DiceGameOverlay({ result }: { result?: Match["diceResult"] }) {
  const [dismissed, setDismissed] = useState<number | null>(null);
  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => setDismissed(result.sequence), 6500);
    return () => window.clearTimeout(timer);
  }, [result?.sequence]);
  if (!result || dismissed === result.sequence) return null;
  const row = (label: string, values: number[]) => {
    const lowest = values.indexOf(Math.min(...values));
    return (
      <div className="dice-game__row">
        <strong>{label}</strong>
        <div>
          {values.map((value, index) => (
            <span
              key={index}
              className={index === lowest ? "is-dropped" : ""}
              aria-label={`${value}${index === lowest ? " dropped" : ""}`}
            >
              {["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value - 1]}
            </span>
          ))}
        </div>
        <b>{values.reduce((n, x) => n + x, 0) - values[lowest]}</b>
      </div>
    );
  };
  return (
    <aside
      className="dice-game"
      aria-label="Dice Game result"
      role="status"
      key={result.sequence}
    >
      <button
        aria-label="Dismiss dice result"
        onClick={() => setDismissed(result.sequence)}
      >
        ×
      </button>
      <small>THE DICE GAME · {result.wager} MOTION EACH</small>
      {row("You", result.player)}
      {row("Rival", result.cpu)}
      <strong>
        {result.winner === "draw"
          ? "Even roll. Wagers back."
          : result.winner === "player"
            ? "You take the pot!"
            : "Rival takes the pot."}
      </strong>
      <p>Best two of three · Motion caps at 9</p>
    </aside>
  );
}
