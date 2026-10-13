import { CommunityCrewStudio } from "./CommunityCrewStudio";
import { Link } from "wouter";
import { usePersistentDeckSelection } from "../lib/deckSelection";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch, type PlayerBootstrap } from "@workspace/api-client-react";
import { getCardImage, starterRecipes, validateSavedDeck } from "../data";
import { FighterPortrait } from "./profile/FighterPortrait";
import { CardPressTarget } from "./CardInspection";
import { catalogCardById } from "../data";
import { GameGlyph } from "./venue/GameGlyph";
import "../styles/community-crews.css";
export type CommunityCrew = {
  id: string;
  week: string;
  name: string;
  strategy: string;
  cardIds: string[];
  heroCardId: string;
  author: string;
  avatarKey: string;
  friendCode?: string | null;
  votes: number;
  voted: boolean;
  isOwn: boolean;
  createdAt: string;
};
export type CommunityFeed = {
  week: string;
  previousWeek: string;
  submissions: CommunityCrew[];
  weeklyPicks: CommunityCrew[];
  submitted: boolean;
  selectionRule: string;
  offset?: number;
  total?: number;
  nextOffset?: number | null;
};
function CrewCard({
  crew,
  featured,
  busy,
  onVote,
  onTry,
  onBuild,
}: {
  crew: CommunityCrew;
  featured?: number;
  busy: boolean;
  onVote: () => void;
  onTry: () => void;
  onBuild: () => void;
}) {
  return (
    <article className="community-crew" data-featured={Boolean(featured)}>
      <div className="community-crew__poster">
        <img src={getCardImage(crew.heroCardId)} alt="" />
        <span>
          {featured
            ? `CREW OF THE WEEK / ${String(featured).padStart(2, "0")}`
            : "FROM THE BLOCK"}
        </span>
        <h3>{crew.name}</h3>
        {featured && (
          <b className="community-pick-seal">
            ✊<small>PLAYER PICK</small>
          </b>
        )}
      </div>
      <div className="community-crew__body">
        <div className="community-author">
          <FighterPortrait
            name={crew.author}
            avatarKey={crew.avatarKey}
            decorative
          />
          <strong>
            {crew.friendCode ? (
              <Link to={`/game/settings?friend=${crew.friendCode}#homies`}>
                {crew.author}
              </Link>
            ) : (
              crew.author
            )}
            {crew.isOwn ? " · YOU" : ""}
          </strong>
        </div>
        <div className="community-elements">
          {[
            ...new Set(
              crew.cardIds
                .map((id) => catalogCardById[id]?.type)
                .filter(Boolean),
            ),
          ].map((type) => (
            <span key={type}>{type}</span>
          ))}
        </div>
        <p>{crew.strategy}</p>
        <div className="community-lineup" aria-label={`${crew.name} lineup`}>
          {crew.cardIds.map((id) => (
            <CardPressTarget
              tapToInspect
              key={id}
              card={catalogCardById[id]}
              aria-label={`Inspect ${catalogCardById[id]?.name ?? id}`}
            >
              <img
                src={getCardImage(id)}
                alt={catalogCardById[id]?.name ?? id}
                loading="lazy"
              />
            </CardPressTarget>
          ))}
        </div>
        <footer>
          <span>
            <GameGlyph name="fight" /> {crew.votes} respect
          </span>
          {!featured && (
            <button
              disabled={busy || crew.voted || crew.isOwn}
              onClick={onVote}
            >
              {crew.voted
                ? "RESPECT GIVEN"
                : crew.isOwn
                  ? "YOUR CREW"
                  : "GIVE RESPECT"}
            </button>
          )}
        </footer>
        <div className="community-crew-actions">
          <button onClick={onTry} disabled={busy}>
            TRY THIS CREW ↗
          </button>
          <button onClick={onBuild} disabled={busy}>
            BUILD MY VERSION +
          </button>
        </div>
      </div>
    </article>
  );
}
function CrewSelect({
  feed,
  busy,
  onVote,
  onTry,
  onBuild,
}: {
  feed: CommunityFeed;
  busy: boolean;
  onVote: (crew: CommunityCrew) => void;
  onTry: (crew: CommunityCrew) => void;
  onBuild: (crew: CommunityCrew) => void;
}) {
  const [view, setView] = useState<"picks" | "contenders">(
    feed.weeklyPicks.length ? "picks" : "contenders",
  );
  const [selectedId, setSelectedId] = useState("");
  const crews = view === "picks" ? feed.weeklyPicks : feed.submissions;
  const selected = crews.find((crew) => crew.id === selectedId) ?? crews[0];
  const index = selected ? crews.indexOf(selected) : 0;
  return (
    <div className="crew-select" data-testid="crew-select">
      <div className="crew-select__preview">
        {selected ? (
          <CrewCard
            key={selected.id}
            crew={selected}
            featured={view === "picks" ? index + 1 : undefined}
            busy={busy}
            onVote={() => onVote(selected)}
            onTry={() => onTry(selected)}
            onBuild={() => onBuild(selected)}
          />
        ) : (
          <div className="community-empty">
            <GameGlyph name="fight" />
            <h3>THE FIRST SPOT IS OPEN.</h3>
            <p>Submit a crew to put your name on the block.</p>
          </div>
        )}
      </div>
      <div className="crew-select__catalog">
        <div className="crew-select__filters" aria-label="Crew selection">
          <button
            aria-pressed={view === "picks"}
            onClick={() => setView("picks")}
          >
            WEEKLY PICKS <small>{feed.weeklyPicks.length}</small>
          </button>
          <button
            aria-pressed={view === "contenders"}
            onClick={() => setView("contenders")}
          >
            CONTENDERS <small>{feed.total ?? feed.submissions.length}</small>
          </button>
        </div>
        <div className="crew-select__sort">
          <span>SELECT YOUR CREW</span>
          <small>
            {view === "picks"
              ? "PLAYER PICKS · VOTES CLOSED"
              : "MOST RESPECTED FIRST · VOTING OPEN"}
          </small>
        </div>
        <div
          className="crew-select__rows"
          role="group"
          aria-label="Available crews"
        >
          {crews.map((crew, i) => (
            <button
              key={crew.id}
              type="button"
              className="crew-select__row"
              aria-pressed={selected?.id === crew.id}
              onClick={() => setSelectedId(crew.id)}
              onKeyDown={(event) => {
                if (
                  !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? crews.length - 1
                      : (i +
                          (event.key === "ArrowDown" ? 1 : crews.length - 1)) %
                        crews.length;
                setSelectedId(crews[next].id);
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>("button")
                  [next]?.focus();
              }}
            >
              <span className="crew-select__number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <img src={getCardImage(crew.heroCardId)} alt="" loading="lazy" />
              <span className="crew-select__copy">
                <strong>{crew.name}</strong>
                <small>
                  {crew.author} ·{" "}
                  {[
                    ...new Set(
                      crew.cardIds
                        .map((id) => catalogCardById[id]?.type)
                        .filter(Boolean),
                    ),
                  ]
                    .slice(0, 3)
                    .join(" / ")}
                </small>
              </span>
              <span className="crew-select__respect">
                <b>✊ {crew.votes}</b>
                <small>
                  {crew.voted
                    ? "RESPECT GIVEN"
                    : view === "picks"
                      ? "PLAYER PICK"
                      : "VOTE UP"}
                </small>
              </span>
            </button>
          ))}
        </div>
        {!crews.length && (
          <p className="crew-select__empty">
            {view === "picks"
              ? "This week’s votes choose the first featured crews."
              : "No crews submitted yet. Lead the way."}
          </p>
        )}
        <div className="crew-select__controls">
          <button
            aria-label="Previous team"
            disabled={crews.length < 2}
            onClick={() =>
              setSelectedId(crews[(index + crews.length - 1) % crews.length].id)
            }
          >
            ←
          </button>
          <span>
            {selected ? `${index + 1} / ${crews.length}` : "NO CREWS YET"}
          </span>
          <button
            aria-label="Next team"
            disabled={crews.length < 2}
            onClick={() => setSelectedId(crews[(index + 1) % crews.length].id)}
          >
            →
          </button>
          <small>SELECT · INSPECT · TRY · RESPECT</small>
        </div>
        <p className="community-rules">
          {feed.selectionRule} One vote per crew; self-votes are excluded.
        </p>
      </div>
    </div>
  );
}
function SubmitCrew({
  bootstrap,
  busy,
  onClose,
  onSubmit,
}: {
  bootstrap: PlayerBootstrap;
  busy: boolean;
  onClose: () => void;
  onSubmit: (deckId: string, strategy: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const saved = bootstrap.profile.savedDecks.filter(
    (deck) =>
      validateSavedDeck(
        deck.cardIds,
        bootstrap.profile.ownedCardIds,
        deck.heroCardId,
      ).valid,
  );
  const recipes = starterRecipes
    .filter(
      (recipe) =>
        !saved.some((deck) => deck.id === recipe.id) &&
        validateSavedDeck(
          recipe.catalogCardIds,
          bootstrap.profile.ownedCardIds,
          recipe.hero,
        ).valid,
    )
    .map((recipe) => ({ id: recipe.id, name: recipe.name }));
  const crews = [...saved, ...recipes];
  const [deckId, setDeckId] = usePersistentDeckSelection(
    bootstrap.profile.id,
    crews.map((crew) => crew.id),
  );
  const [strategy, setStrategy] = useState("");
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
      className="crew-submit-dialog"
      aria-labelledby="crew-submit-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
    >
      <button
        className="notes-close"
        disabled={busy}
        aria-label="Close crew submission"
        onClick={onClose}
      >
        ×
      </button>
      <header>
        <span>PUT YOUR CREW ON THE MAP</span>
        <h2 id="crew-submit-title">
          LET THE
          <br />
          <em>BLOCK JUDGE.</em>
        </h2>
        <p>
          One submission each week. Your exact lineup is saved when you submit.
          The top three become next week’s featured crews.
        </p>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (deckId && strategy.trim()) onSubmit(deckId, strategy.trim());
        }}
      >
        <label>
          Your battle-ready crew
          <select
            value={deckId}
            onChange={(event) => setDeckId(event.target.value)}
            disabled={busy}
          >
            {crews.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.name}
              </option>
            ))}
          </select>
        </label>
        {!crews.length && (
          <p>Save a legal ten-card crew in the deck builder first.</p>
        )}
        <label>
          How does it win?
          <textarea
            maxLength={280}
            rows={4}
            required
            value={strategy}
            disabled={busy}
            onChange={(event) => setStrategy(event.target.value)}
            placeholder="Your opener, your combo, your closer…"
          />
        </label>
        <small>{strategy.length} / 280</small>
        <button
          className="notes-action"
          disabled={busy || !deckId || !strategy.trim()}
        >
          {busy ? "Saving your submission…" : "Submit this week’s crew"}
        </button>
      </form>
    </dialog>
  );
}
export function CommunityCrews({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const client = useQueryClient();
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["community-crews", bootstrap.profile.id, page],
    queryFn: ({ signal }) =>
      customFetch<CommunityFeed>(`/api/player/community-decks?offset=${page}`, {
        signal,
      }),
    staleTime: 30000,
  });
  const [submitOpen, setSubmitOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const archive = useQuery({
    queryKey: ["community-archive", bootstrap.profile.id],
    enabled: archiveOpen,
    queryFn: ({ signal }) =>
      customFetch<{ weeks: { week: string; picks: CommunityCrew[] }[] }>(
        "/api/player/community-decks/archive",
        { signal },
      ),
    staleTime: 60000,
  });
  const [studio, setStudio] = useState<{
    crew: CommunityCrew;
    mode: "try" | "build";
  } | null>(null);
  const lock = useRef(false);
  async function write(path: string, body: unknown) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const feed = await customFetch<CommunityFeed>(`${path}?offset=${page}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
      client.setQueryData(
        ["community-crews", bootstrap.profile.id, page],
        feed,
      );
      setSubmitOpen(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save your crew. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="community-crews"
      id="community-crews"
      aria-labelledby="community-crews-title"
    >
      <header className="community-crews__headline">
        <span>BUILT BY PLAYERS. PROVEN ON THE BLOCK.</span>
        <h2 id="community-crews-title">
          CREWS OF{" "}
          <em>THE WEEK.</em>
        </h2>
        <p>
          Share your build. Give respect. Discover what the community is
          cooking.
        </p>
        <button
          className="notes-action"
          disabled={
            busy || query.isPending || query.isError || query.data?.submitted
          }
          onClick={() => setSubmitOpen(true)}
        >
          {query.data?.submitted
            ? "THIS WEEK’S CREW IS IN"
            : "Submit your crew"}{" "}
          <GameGlyph name="crew" />
        </button>
      </header>
      {studio && (
        <CommunityCrewStudio
          key={`${studio.crew.id}:${studio.mode}`}
          crew={studio.crew}
          mode={studio.mode}
          bootstrap={bootstrap}
          onClose={() => setStudio(null)}
        />
      )}
      {error && <p role="alert">{error}</p>}
      {query.isPending && <p role="status">Opening the crew board…</p>}
      {query.isError && (
        <p role="alert">
          The crew board couldn’t load.{" "}
          <button onClick={() => void query.refetch()}>Retry</button>
        </p>
      )}
      {query.data && (
        <>
          <CrewSelect
            feed={query.data}
            busy={busy}
            onTry={(crew) => setStudio({ crew, mode: "try" })}
            onBuild={(crew) => setStudio({ crew, mode: "build" })}
            onVote={(crew) =>
              void write(`/api/player/community-decks/${crew.id}/vote`, {})
            }
          />
          <button
            className="notes-action"
            onClick={() => setArchiveOpen((value) => !value)}
            aria-expanded={archiveOpen}
          >
            {archiveOpen ? "Close the wall" : "Previous player picks"} ✊
          </button>
          {archiveOpen && (
            <div className="community-archive">
              {archive.isPending ? (
                <p role="status">Opening the winners wall…</p>
              ) : archive.isError ? (
                <button onClick={() => void archive.refetch()}>
                  Retry winners wall
                </button>
              ) : archive.data?.weeks.length ? (
                archive.data.weeks.map((entry) => (
                  <section key={entry.week}>
                    <h3>FEATURED WEEK · {entry.week}</h3>
                    <div className="community-featured">
                      {entry.picks.map((crew, index) => (
                        <CrewCard
                          key={crew.id}
                          crew={crew}
                          featured={index + 1}
                          busy={busy}
                          onVote={() => {}}
                          onTry={() => setStudio({ crew, mode: "try" })}
                          onBuild={() => setStudio({ crew, mode: "build" })}
                        />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <p>
                  The first crews will join this wall after their featured week.
                </p>
              )}
            </div>
          )}
          <nav
            className="community-pagination"
            aria-label="Community crew pages"
          >
            <button
              disabled={busy || query.isFetching || page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 40))}
            >
              ← Previous crews
            </button>
            <span>
              {query.data.total ?? query.data.submissions.length} submissions
              this week
            </span>
            <button
              disabled={
                busy || query.isFetching || query.data.nextOffset == null
              }
              onClick={() => setPage(query.data!.nextOffset!)}
            >
              More crews →
            </button>
          </nav>
        </>
      )}
      {submitOpen && (
        <SubmitCrew
          bootstrap={bootstrap}
          busy={busy}
          onClose={() => setSubmitOpen(false)}
          onSubmit={(deckId, strategy) =>
            void write("/api/player/community-decks", { deckId, strategy })
          }
        />
      )}
    </section>
  );
}
