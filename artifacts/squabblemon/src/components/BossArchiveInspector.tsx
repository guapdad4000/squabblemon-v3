import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { BossArchiveEntry } from "@workspace/squabblemon-engine/bossArchive";
import { getAssetUrl } from "../lib/assets";
import "../styles/boss-archive.css";
export function BossArchiveInspector({
  card,
  onClose,
}: {
  card: BossArchiveEntry & { defeatedTier?: number | null };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="boss-archive__inspector"
      aria-labelledby="boss-archive-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <button autoFocus onClick={onClose} aria-label="Close boss archive">
        ×
      </button>
      <img src={getAssetUrl(card.art)} alt={card.name} />
      <div>
        <span>BOSS THREAT · UNPLAYABLE IN PVP</span>
        <h2 id="boss-archive-title">{card.name}</h2>
        <h3>{card.ability}</h3>
        {card.hp && (
          <strong>
            {card.hp.toLocaleString()} HP · TIER {card.tier}
          </strong>
        )}
        <p>{card.effect}</p>
        {card.defeatedTier && (
          <strong>DEFEATED · TIER {card.defeatedTier}</strong>
        )}
        <small>ARCHIVE RECORD · CANNOT ENTER DECKS OR PACKS</small>
      </div>
    </dialog>,
    document.body,
  );
}
