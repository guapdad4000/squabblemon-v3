import { Kumite } from '../src/pages/game/Kumite';
import '../src/styles/venue.css';
import '../src/pages/game/gameStyles';
import { CardInspector } from "../src/components/CardInspector";
import { cards, type Card } from "../src/data";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PlayerBootstrap } from "@workspace/api-client-react";
import { storyContent } from "@workspace/squabblemon-engine/story";
import { KUMITE_PUZZLES } from "@workspace/squabblemon-engine/storyKumitePuzzles";
import {
  KUMITE_FIGHTERS,
  kumiteFormAsset,
  kumiteAltId,
  KUMITE_ALT_TIERS,
} from "@workspace/squabblemon-engine/kumiteForms";
import {
  BOSS_ARCHIVE,
  type BossArchiveEntry,
} from "@workspace/squabblemon-engine/bossArchive";
import {
  KUMITE_CARD_REWARDS,
  catalogCardById,
  decks,
  engineIdsToCatalogIds,
} from "@workspace/squabblemon-engine/data";
import { StoryMovie } from "../src/pages/game/story/StoryMovie";
import { StoryPuzzle } from "../src/pages/game/story/StoryPuzzle";
import { KumiteDojoPractice } from "../src/components/fadecade/KumiteDojoPractice";
import { KumiteRewards } from "../src/components/kumite/KumiteRewards";
import { KumiteFormPortrait } from "../src/components/kumite/KumiteFormPortrait";
import {
  DojoMotionSprite,
  type DojoSpritePhase,
} from "../src/components/fadecade/DojoMotionSprite";
import { BossArchiveInspector } from "../src/components/BossArchiveInspector";
import { getAssetUrl } from "../src/lib/assets";
import "../src/index.css";
import "../src/styles/kumite.css";
import "./kumite-expansion.fixture.css";
// Component review must never submit to a signed-in player's real API.
const reviewFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  if (url.pathname === '/api/kumite/current' && (init?.method ?? (input instanceof Request ? input.method : 'GET')) === 'GET') return Response.json(hubCurrent);
  if (url.pathname === '/api/kumite/winners' && (init?.method ?? (input instanceof Request ? input.method : 'GET')) === 'GET') return Response.json({ winners: [], serverTime: Date.now() });
  if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Local component preview. No live saves or rewards.' }, { status: 403 });
  return reviewFetch(input, init);
};
const crew = engineIdsToCatalogIds(decks.find((d) => d.id === "block")!.cards);
const bootstrap = {
  profile: {
    id: "local-review-only",
    ownedCardIds: [...crew, ...KUMITE_FIGHTERS],
    savedDecks: [
      {
        id: "review",
        name: "LOCAL REVIEW CREW",
        heroCardId: crew[0],
        cardIds: crew,
      },
    ],
    settings: { reducedMotion: false },
  },
} as unknown as PlayerBootstrap;
const progression = {
  completedMatches: 2,
  matchWins: 1,
  championships: 0,
  rewards: KUMITE_CARD_REWARDS.map((r) => {
    const progress = r.metric === "completedMatches" ? 2 : r.metric === "matchWins" ? 1 : 0;
    return {
      ...r,
      name: catalogCardById[r.cardId].name,
      rarity: catalogCardById[r.cardId].rarity,
      owned: bootstrap.profile.ownedCardIds.includes(r.cardId),
      claimed: progress >= r.required,
      progress,
    };
  }),
  mastery: KUMITE_FIGHTERS.map((cardId) => ({
    cardId,
    variantId: kumiteAltId(cardId),
    requiredTier: KUMITE_ALT_TIERS[cardId],
    dojoCleared: false,
    weeklyWin: false,
    altOwned: false,
    quests: [
      {
        id: cardId + "-sweep",
        label: "WEEKLY SWEEP · 3 DISTRICTS",
        styleShards: 20,
        complete: false,
        claimed: false,
      },
      {
        id: cardId + "-damage",
        label: "DOJO · 35+ TOTAL DAMAGE · TIER 3+",
        styleShards: 20,
        complete: false,
        claimed: false,
      },
      {
        id: cardId + "-glo",
        label: "DOJO · REACH 10+ HANDS",
        styleShards: 20,
        complete: false,
        claimed: false,
      },
    ],
  })),
};
const hubNow = Date.now();
const hubCurrent = { serverTime: hubNow, tournament: { id:'local-review-week', weekLabel:'LOCAL REVIEW', status:'registration', registrationOpensAt:hubNow-86400000, startsAt:hubNow+3*86400000, endsAt:hubNow+4*86400000, capacity:8, poolCount:1, poolSize:8, entrants:[], pools:[], finals:[], champion:null }, registration:null, currentMatch:null, rules:{roundHours:24,turnSeconds:120}, progression, records:{scope:'LOCAL REVIEW', fastestFight:null, recentWinners:[], handThrowers:[]} };
function Review() {
  const [inspect, setInspect] = useState<Card | null>(null);
  const [view, setView] = useState("Forms"),
    [form, setForm] = useState<"base" | "squabble" | "awakened">("base"),
    [phase, setPhase] = useState<DojoSpritePhase>("idle"),
    [reduced, setReduced] = useState(false);
  const [puzzle, setPuzzle] = useState<(typeof KUMITE_PUZZLES)[number] | null>(
      null,
    ),
    [movie, setMovie] = useState<ReturnType<typeof films>[number] | null>(null),
    [archive, setArchive] = useState<BossArchiveEntry | null>(null);
  function films() {
    return storyContent.chapters
      .filter(
        (c) =>
          c.id === "kumite-break-the-bracket" ||
          c.id.startsWith("squabble-house-"),
      )
      .flatMap((c) =>
        c.nodes
          .filter(
            (n) =>
              n.cinematic &&
              !n.puzzle &&
              (c.id === "kumite-break-the-bracket" ||
                n.id.endsWith("-opening")),
          )
          .map((n) => ({
            title: c.id.startsWith("squabble-house-") ? c.title : n.title,
            cinematic: n.cinematic!,
          })),
      );
  }
  return (
    <>
      <header className="expansion-review-nav">
        <strong>KUMITE · EXPANSION REVIEW</strong>
        <small>
          LOCAL COMPONENT PREVIEW · SYNTHETIC STATE · NO LIVE REWARDS OR SAVES
        </small>
        <nav>
          {[
            "Hub",
            "Forms",
            "Titles",
            "Puzzles",
            "Sprites",
            "Archive",
            "Roadmap",
            "Practice",
          ].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={v === view}
            >
              {v}
            </button>
          ))}
        </nav>
      </header>
      <main className="expansion-review-stage">
        {view === "Hub" && <Kumite bootstrap={bootstrap} />}
        {view === "Forms" && (
          <>
            <div className="expansion-toolbar">
              {(["base", "squabble", "awakened"] as const).map((s) => (
                <button key={s} onClick={() => setForm(s)}>
                  {s}
                </button>
              ))}
            </div>
            <div className="expansion-art-grid">
              {KUMITE_FIGHTERS.map((id) => (
                <figure key={id}>
                  <div className="expansion-form">
                    <KumiteFormPortrait
                      formAsset={getAssetUrl(kumiteFormAsset(id, form))}
                      stance={form}
                      src={getAssetUrl(`assets/characters/${id}.webp`)}
                      alt={catalogCardById[id].name}
                    />
                  </div>
                  <figcaption>
                    {catalogCardById[id].name} · {form}
                  </figcaption>
                  <button
                    onClick={() =>
                      setInspect(cards[catalogCardById[id].engineId])
                    }
                  >
                    INSPECT {catalogCardById[id].name}
                  </button>
                </figure>
              ))}
            </div>
          </>
        )}
        {view === "Titles" && (
          <div className="expansion-title-grid">
            {films().map((f) => (
              <button key={f.title} onClick={() => setMovie(f)}>
                <img
                  src={getAssetUrl(f.cinematic.titleAssetId!)}
                  alt={f.title}
                />
                <span>PLAY · {f.title}</span>
              </button>
            ))}
          </div>
        )}
        {view === "Puzzles" && (
          <div className="expansion-title-grid">
            {KUMITE_PUZZLES.map((p) => (
              <button key={p.id} onClick={() => setPuzzle(p)}>
                <img src={getAssetUrl(p.imageAssetId)} alt="" />
                <span>{p.title}</span>
              </button>
            ))}
          </div>
        )}
        {view === "Sprites" && (
          <>
            <div className="expansion-toolbar">
              {(["idle", "windup", "strike", "recoil"] as const).map((s) => (
                <button key={s} onClick={() => setPhase(s)}>
                  {s}
                </button>
              ))}
              <label>
                <input
                  type="checkbox"
                  checked={reduced}
                  onChange={(e) => setReduced(e.target.checked)}
                />
                Reduced motion
              </label>
            </div>
            <div className="expansion-art-grid">
              {[
                "boss-tier-1",
                "boss-tier-2",
                "boss-tier-3",
                "boss-tier-4",
                "boss-tier-5",
                ...[
                  "backup",
                  "oink",
                  "hound",
                  "drone",
                  "operator",
                  "hog",
                  "ham",
                  "judge",
                  "protester",
                  "feds",
                ].map((s) => "npc-" + s),
              ].map((id) => (
                <figure key={id}>
                  <DojoMotionSprite
                    asset={"dojo:" + id}
                    name={id}
                    reduced={reduced}
                    phase={phase}
                  />
                  <figcaption>{id}</figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
        {view === "Archive" && (
          <div className="boss-archive">
            <div className="boss-archive__wall">
              {BOSS_ARCHIVE.map((c) => (
                <button
                  className="boss-archive__plaque"
                  key={c.id}
                  onClick={() => setArchive(c)}
                >
                  <img src={getAssetUrl(c.art)} alt="" loading="lazy" />
                  <strong>{c.name}</strong>
                  <small>UNPLAYABLE IN PVP</small>
                </button>
              ))}
            </div>
          </div>
        )}
        {view === "Roadmap" && <KumiteRewards progression={progression} bootstrap={bootstrap} />}
        {view === "Practice" && (
          <KumiteDojoPractice
            bootstrap={bootstrap}
            fighterId="leroy"
            onExit={() => setView("Forms")}
          />
        )}
      </main>
      {puzzle && (
        <StoryPuzzle
          puzzle={puzzle}
          nodeId={puzzle.id}
          onClose={() => setPuzzle(null)}
          onCompleted={() => setPuzzle(null)}
        />
      )}
      {movie && (
        <StoryMovie
          {...movie}
          onClose={() => setMovie(null)}
          onContinue={() => setMovie(null)}
        />
      )}
      {inspect && (
        <CardInspector card={inspect} onClose={() => setInspect(null)} />
      )}
      {archive && (
        <BossArchiveInspector card={archive} onClose={() => setArchive(null)} />
      )}
    </>
  );
}
const query = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const root = createRoot(document.getElementById("root")!);
root.render(
  <QueryClientProvider client={query}>
    <Review />
  </QueryClientProvider>,
);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
