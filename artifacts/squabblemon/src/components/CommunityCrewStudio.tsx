import { lazy, Suspense, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPlayerBootstrapQueryKey,
  useSavePlayerDeck,
  type PlayerBootstrap,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { DeckWorkbench } from "./DeckWorkbench";
import { catalogCardById, starterRecipes } from "../data";
import { crewLoaner, ownedCrewVersion } from "../lib/communityCrew";
import type { DeckDraft } from "../lib/deckWorkshop";
import type { CommunityCrew } from "./CommunityCrews";
const PlayLoop = lazy(() =>
  import("./PlayLoop").then((module) => ({ default: module.PlayLoop })),
);
export function CommunityCrewStudio({
  crew,
  mode,
  bootstrap,
  onClose,
}: {
  crew: CommunityCrew;
  mode: "try" | "build";
  bootstrap: PlayerBootstrap;
  onClose: () => void;
}) {
  const [version] = useState(() =>
    ownedCrewVersion(crew, bootstrap.profile.ownedCardIds),
  );
  const [playing, setPlaying] = useState<DeckDraft | null>(null),
    [rival, setRival] = useState(starterRecipes[0].id),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const dirty = useRef(false);
  const deckId = useRef(crypto.randomUUID());
  const save = useSavePlayerDeck();
  const client = useQueryClient();
  function close() {
    if (save.isPending) return;
    if (
      mode === "build" &&
      dirty.current &&
      !window.confirm("Discard your unsaved crew changes?")
    )
      return;
    onClose();
  }
  const loaner = crewLoaner(
    playing ? { ...crew, ...playing, heroCardId: playing.heroCardId } : crew,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className={`community-studio ${ready || playing ? "community-studio--playing" : ""}`}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogTitle>
          {mode === "try" ? "TRY THIS CREW" : "BUILD MY VERSION"} · {crew.name}
        </DialogTitle>
        <DialogDescription>
          {ready || playing
            ? "Practice loaner · Collection and rank stay unchanged."
            : "Borrow the full crew for practice, or save your own version using cards you own."}
        </DialogDescription>
        {error && <p role="alert">{error}</p>}
        {ready || playing ? (
          <Suspense fallback={<p role="status">Opening the practice floor…</p>}>
            <PlayLoop
              mode="guest"
              loanerPractice
              initialDeckId={loaner.id}
              initialRivalId={rival}
              hideLobby
              customPlayerDeck={loaner}
              turnTimerEnabled={bootstrap.profile.settings.turnTimerEnabled}
              onExit={() => {
                setPlaying(null);
                setReady(false);
              }}
            />
          </Suspense>
        ) : mode === "try" ? (
          <div className="community-trial-brief">
            <strong>ALL TEN CARDS. YOUR HANDS.</strong>
            <p>
              Test the creator’s exact lineup, including cards you haven’t
              collected. This practice doesn’t award currency, bounty progress,
              XP or ranked points.
            </p>
            <label>
              Choose the rival
              <select value={rival} onChange={(e) => setRival(e.target.value)}>
                {starterRecipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="notes-action" onClick={() => setReady(true)}>
              STEP INTO PRACTICE ✊
            </button>
          </div>
        ) : (
          <>
            {version.missing.length > 0 && (
              <div className="community-missing">
                <strong>{version.missing.length} cards to collect</strong>
                <p>
                  {version.missing
                    .map((id) => catalogCardById[id]?.name ?? id)
                    .join(" · ")}
                </p>
                <p>
                  Your owned cards stay in the crew. Suggested owned
                  replacements fill the gaps; edit them below.
                </p>
              </div>
            )}
            {saved && (
              <p role="status">Your version is saved in Cards &amp; Gangs.</p>
            )}
            <DeckWorkbench
              initial={version.draft}
              ownedCardIds={bootstrap.profile.ownedCardIds}
              equippedVariants={bootstrap.profile.equippedVariants}
              onDirtyChange={(value) => {
                dirty.current = value;
              }}
              onSave={async (draft) => {
                try {
                  const response = await save.mutateAsync({
                    deckId: deckId.current,
                    data: draft,
                  });
                  client.setQueryData(
                    getGetPlayerBootstrapQueryKey(),
                    response,
                  );
                  dirty.current = false;
                  setSaved(true);
                  setError("");
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not save this crew.",
                  );
                  throw e;
                }
              }}
              onTest={async (draft) => setPlaying(draft)}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
