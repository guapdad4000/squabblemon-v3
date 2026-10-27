import { catalogCardById } from "@workspace/squabblemon-engine/data";
import { useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from "@workspace/api-client-react";
import { useDeckPersistence } from "../../lib/useDeckPersistence";
import {
  getDeckSelectionStorage,
  resolveDeckSelection,
  persistDeckSelection,
} from "../../lib/deckSelection";
export function KumiteCrewActions({
  bootstrap,
  cardId,
}: {
  bootstrap: PlayerBootstrap;
  cardId: string;
}) {
  const lock = useRef(false);
  const { save } = useDeckPersistence(bootstrap),
    client = useQueryClient(),
    [message, setMessage] = useState("");
  const decks = bootstrap.profile.savedDecks.filter(
    (d) =>
      d.cardIds.length === 10 &&
      new Set(d.cardIds).size === 10 &&
      d.cardIds.every((id) => bootstrap.profile.ownedCardIds.includes(id)),
  );
  const ids = decks.map((d) => d.id),
    selected = resolveDeckSelection(
      bootstrap.profile.id,
      ids,
      undefined,
      getDeckSelectionStorage(),
    ),
    crew = decks.find((d) => d.id === selected);
  const owned = bootstrap.profile.ownedCardIds.includes(cardId);
  const replacing = crew?.cardIds.findLast((id) => id !== crew.heroCardId);
  async function equip() {
    if (!owned || !crew || save.isPending || lock.current) return;
    lock.current = true;
    setMessage("");
    try {
      if (!crew.cardIds.includes(cardId)) {
        const next = [...crew.cardIds],
          index = next.lastIndexOf(replacing!);
        if (index < 0) throw Error("Choose a complete crew first.");
        next[index] = cardId;
        const result = await save.mutateAsync({
          deckId: crew.id,
          data: {
            name: crew.name,
            cardIds: next,
            heroCardId: crew.heroCardId,
            recipeId: null,
          },
        });
        const active = client.getQueryData<PlayerBootstrap>(
          getGetPlayerBootstrapQueryKey(),
        );
        if (active?.profile.id !== bootstrap.profile.id)
          throw Error("Account changed while saving.");
        client.setQueryData(getGetPlayerBootstrapQueryKey(), result);
      }
      persistDeckSelection(
        bootstrap.profile.id,
        crew.id,
        ids,
        getDeckSelectionStorage(),
      );
      setMessage(`EQUIPPED · ${crew.name}`);
    } catch {
      setMessage("Crew could not save. Retry safely.");
    } finally {
      lock.current = false;
    }
  }
  return (
    <div className="kumite-crew-actions">
      {crew && owned && (
        <small>
          {crew.cardIds.includes(cardId)
            ? `ALREADY IN ${crew.name}`
            : `REPLACES ${catalogCardById[replacing ?? ""]?.name ?? replacing} · ${crew.name}`}
        </small>
      )}
      <button
        disabled={!owned || !crew || save.isPending}
        onClick={() => void equip()}
        title={
          crew && !crew.cardIds.includes(cardId)
            ? `Replace ${replacing} in ${crew.name}`
            : crew?.name
        }
      >
        {save.isPending ? "SAVING…" : "EQUIP TO ACTIVE CREW"}
      </button>
      {owned && crew ? (
        <Link
          href={`/game/challenges?game=punch-on-patrol&raid=kumite&practice=${encodeURIComponent(cardId)}`}
        >
          TEST STANCE · DOJO
        </Link>
      ) : (
        <Link href="/game/decks">
          {owned ? "CHOOSE A TEN-CARD CREW" : "UNLOCK FIGHTER FIRST"}
        </Link>
      )}
      {message && <span role="status">{message}</span>}
    </div>
  );
}
