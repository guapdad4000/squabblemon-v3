import { useEffect, useRef, useState } from "react";
import { catalogCardById, canonicalElement, getCardImage } from "../data";
import { GameGlyph } from "./venue/GameGlyph";
import "../styles/player-notes.css";

export function AutoDeckDialog({
  ownedCardIds,
  onBuild,
  onClose,
}: {
  ownedCardIds: readonly string[];
  onBuild: (element: string | null) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const owned = [...new Set(ownedCardIds)]
    .map((id) => catalogCardById[id])
    .filter((card) => card && card.kind !== "token");
  const elements = [
    ...new Set(owned.map((card) => canonicalElement(card.type))),
  ].sort();
  const anchor =
    owned.find(
      (card) =>
        selected &&
        canonicalElement(card.type) === selected &&
        card.kind !== "support",
    ) ?? owned.find((card) => card.kind !== "support");
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="auto-deck-dialog"
      aria-labelledby="auto-deck-title"
      onCancel={onClose}
    >
      <button
        className="notes-close"
        aria-label="Close auto build"
        onClick={onClose}
      >
        ×
      </button>
      <header>
        <span>DR. FADE’S CREW LAB</span>
        <h2 id="auto-deck-title">
          PICK YOUR
          <br />
          <em>ENERGY.</em>
        </h2>
        <p>
          Choose an element. We’ll build ten owned cards around it, with a
          playable opening and support.
        </p>
        {anchor && <img src={getCardImage(anchor.catalogId)} alt="" />}
      </header>
      <div
        className="auto-element-grid"
        role="group"
        aria-label="Auto-build element"
      >
        <button
          aria-pressed={selected === null}
          onClick={() => setSelected(null)}
        >
          <GameGlyph name="crew" />
          <b>Best mix</b>
          <small>Follow your cover</small>
        </button>
        {elements.map((element) => (
          <button
            key={element}
            aria-pressed={selected === element}
            onClick={() => setSelected(element)}
          >
            <b>{element}</b>
            <small>
              {
                owned.filter((card) => canonicalElement(card.type) === element)
                  .length
              }{" "}
              owned
            </small>
          </button>
        ))}
      </div>
      <footer>
        <p>
          Other owned cards fill gaps when your element has fewer than ten.
          Review the result and use Undo before saving.
        </p>
        <button className="notes-action" onClick={() => onBuild(selected)}>
          Build {selected ?? "my"} crew <GameGlyph name="crew" />
        </button>
      </footer>
    </dialog>
  );
}
