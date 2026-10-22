import { BattleFxImage } from './BattleFxImage';
import { memo, useEffect, useRef } from "react";
import type { CardInstance } from "../gameEngine";
import "./battle-hand-peek.css";

export type BattleHandPeekProps = {
  card: CardInstance;
  cost: number;
  baseCost?: boolean;
  unavailable?: boolean;
  reducedMotion?: boolean;
};

/** A quick read of the selected hand card; normal inspection keeps the full rules. */
export const BattleHandPeek = memo(function BattleHandPeek({
  card,
  cost,
  baseCost = false,
  unavailable = false,
  reducedMotion = false,
}: BattleHandPeekProps) {
  const peekRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const deck = peekRef.current?.closest(".battle-command-deck");
    const tray = deck?.querySelector<HTMLElement>("#hand-tray");
    if (!tray) return;
    let frame: number | null = null;
    const keepSelectedVisible = () => {
      frame = null;
      const selected = tray.querySelector<HTMLElement>(".battle-hand-card[aria-pressed='true']");
      if (!selected || selected.dataset.instanceId !== card.instanceId) return;
      const trayRect = tray.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      if (!tray.clientWidth || !tray.clientHeight || !selectedRect.width || !selectedRect.height) return;
      const row = tray.querySelector<HTMLElement>(".battle-hand-row");
      const vertical = !!row && window.getComputedStyle(row).flexDirection === "column";
      const scale = vertical
        ? (tray.offsetHeight ? trayRect.height / tray.offsetHeight : 1)
        : (tray.offsetWidth ? trayRect.width / tray.offsetWidth : 1);
      if (!Number.isFinite(scale) || scale <= 0) return;
      const margin = vertical
        ? Math.max(12, selected.offsetHeight * .05 + 8)
        : Math.max(8, selected.offsetWidth * .05 + 4);
      const visibleStart = (vertical ? trayRect.top + tray.clientTop * scale : trayRect.left + tray.clientLeft * scale) + margin * scale;
      const visibleEnd = visibleStart + (vertical ? tray.clientHeight : tray.clientWidth) * scale - margin * scale * 2;
      const cardStart = vertical ? selectedRect.top : selectedRect.left;
      const cardEnd = vertical ? selectedRect.bottom : selectedRect.right;
      // Prefer its leading edge if a very short tray cannot show the whole card.
      const oversized = cardEnd - cardStart > visibleEnd - visibleStart;
      const delta = cardStart < visibleStart || oversized ? cardStart - visibleStart
        : cardEnd > visibleEnd ? cardEnd - visibleEnd : 0;
      if (Math.abs(delta) <= 1) return;
      const current = vertical ? tray.scrollTop : tray.scrollLeft;
      const maximum = Math.max(0, vertical ? tray.scrollHeight - tray.clientHeight : tray.scrollWidth - tray.clientWidth);
      const destination = Math.max(0, Math.min(maximum, current + delta / scale));
      if (Math.abs(destination - current) <= 1) return;
      const reduced = reducedMotion || Boolean(deck?.closest('[data-reduced-motion="true"]'))
        || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (typeof tray.scrollTo === "function") {
        tray.scrollTo(vertical ? { top: destination, behavior: reduced ? "auto" : "smooth" }
          : { left: destination, behavior: reduced ? "auto" : "smooth" });
      } else if (vertical) tray.scrollTop = destination;
      else tray.scrollLeft = destination;
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(keepSelectedVisible);
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(tray);
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
    return () => {
      resize?.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [card.instanceId, reducedMotion]);
  const liveCost = Number.isFinite(cost) ? cost : card.cost;
  const unavailableAbility = card.statuses.silenced || card.statuses.frozen || card.statuses.weakened;
  return (
    <aside
      ref={peekRef}
      className="battle-hand-peek"
      data-testid="battle-hand-peek"
      data-unavailable={unavailable || undefined}
      data-reduced-motion={reducedMotion || undefined}
      aria-label={`Selected fighter: ${card.name}. ${liveCost} ${baseCost ? 'base ' : ''}Motion${unavailable ? ". Cannot play in this selection" : ""}.`}
    >
      <div className="battle-hand-peek__heading">
        <strong>{card.name}</strong>
        <span className="battle-hand-peek__cost">{baseCost && <small className="battle-hand-peek__cost-label">Base</small>}<BattleFxImage kind="motion-orb" className="inline-motion-orb" />{liveCost}<small className="sr-only"> Motion</small></span>
      </div>
      <div className="battle-hand-peek__move">
        <b>{card.ability}</b>
        {unavailableAbility && <span>{card.statuses.frozen ? "FROZEN" : card.statuses.silenced ? "SILENCED" : "WEAKENED"}</span>}
      </div>
      <p title={card.effect}>{card.effect}</p>
    </aside>
  );
});
