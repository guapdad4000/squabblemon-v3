import { getAssetUrl } from "../../lib/assets";
import "../../styles/hall-of-hands.css";
import { revealProfileRewards } from "../../lib/rewardReceipts";
import { GameGlyph } from "../../components/venue/GameGlyph";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from "@workspace/api-client-react";
import {
  availableCareerChoices,
  readCareer,
} from "@workspace/squabblemon-engine/career";
import {
  ArrowRight,
  Check,
  FlaskConical,
  Shield,
  Shuffle,
  Wind,
} from "lucide-react";
import {
  cardCatalog,
  catalogCardById,
  catalogCardByEngineId,
  getCardImage,
} from "../../data";
import "../../styles/mastery-board.css";

export function CareerBoard({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const dossier = useRef<HTMLDialogElement>(null);
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const client = useQueryClient(),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const progress = readCareer(bootstrap.profile.storyProgress.gameplay),
    choices = availableCareerChoices(progress);
  const available = cardCatalog.filter(
    (c) =>
      c.rarity === "Common" &&
      !bootstrap.profile.ownedCardIds.includes(c.catalogId),
  );
  const chosen =
    available.find((c) => c.catalogId === selected) ?? available[0];
  async function choose(cardId: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await customFetch<PlayerBootstrap>(
        "/api/player/experiments/card",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId }),
        },
      );
      client.setQueryData(getGetPlayerBootstrapQueryKey(), result);
      revealProfileRewards(bootstrap, result, cardId, "New gang member", "recruit");
      setSelected(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not claim this card. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const milestones = [
    {
      done: progress.cleansed,
      label: "Cleanse a friendly card",
      hint: "Turn their disruption into your comeback.",
      icon: Shield,
    },
    {
      done: progress.movementWin,
      label: "Win with a moved ally in a district you hold",
      hint: "Put your footwork to work.",
      icon: Wind,
    },
    {
      done: progress.changedCrew,
      label: "Test a changed gang after a previous practice fade",
      hint: "Try a fresh lineup. Drafts excluded.",
      icon: Shuffle,
    },
  ];
  const masteryEntries = Object.entries(progress.wins).sort(
    (a, b) => (a[1] >= 5 ? 1 : 0) - (b[1] >= 5 ? 1 : 0) || b[1] - a[1],
  );
  const masteredCount = masteryEntries.filter(([, wins]) => wins >= 5).length;
  const featured =
    masteryEntries.find(([id]) => id === featuredId) ??
    masteryEntries.find(([, wins]) => wins >= 5) ??
    masteryEntries[0];
  const featuredCard = featured
    ? (catalogCardById[featured[0]] ?? catalogCardByEngineId[featured[0]])
    : undefined;
  const badges = bootstrap.profile.unlockedCosmeticIds.filter((id) =>
    id.startsWith("badge:"),
  );
  return (
    <section
      className="career-stage hall-of-hands hall-of-hands--spotlight"
      style={{
        backgroundImage: `url(${getAssetUrl("assets/progression/hall-wallpaper.png")})`,
      }}
      aria-label="Hall of Hands"
    >
      <header className="hall-heading">
        <img
          src={getAssetUrl("assets/progression/hall-of-hands.png")}
          alt="Hall of Hands"
        />
        <p>
          {masteredCount} mastered · {masteryEntries.length - masteredCount} in
          training
        </p>
        <button
          className="progression-sign"
          onClick={() => dossier.current?.showModal()}
        >
          Records · {choices} {choices === 1 ? "reward" : "rewards"} →
        </button>
      </header>
      <dialog
        className="progression-dossier"
        aria-label="Records and rewards"
        ref={dossier}
      >
        <header>
          <h2>Records &amp; rewards</h2>
          <button onClick={() => dossier.current?.close()}>Close ×</button>
        </header>
        <div className="hustle-stage__section">
          <div>
            <span className="studio-eyebrow">
              <FlaskConical size={14} />
              Try something new
            </span>
            <h2>Your experiments. Your rewards.</h2>
            <p>
              Each first-time milestone earns one Common of your choice.
              Complete these in verified practice or events.
            </p>
          </div>
          <span className="career-stage__milestone-count">
            {milestones.filter((m) => m.done).length}
            <small>/ 3</small>
          </span>
        </div>
        <ul className="career-stage__experiments">
          {milestones.map((m) => (
            <li key={m.label} data-complete={m.done}>
              <span className="career-stage__experiment-icon">
                <GameGlyph
                  icon={m.done ? Check : m.icon}
                  color={m.done ? "#bfe1a4" : undefined}
                />
              </span>
              <div>
                <strong>{m.label}</strong>
                <p>{m.hint}</p>
              </div>
              <span>{m.done ? "Complete" : "1 Common"}</span>
            </li>
          ))}
        </ul>
        {choices > 0 && (
          <section
            className="career-stage__reward"
            aria-label="Choose your Common reward"
          >
            <span className="studio-eyebrow">
              {choices} card choice{choices === 1 ? "" : "s"} available
            </span>
            {chosen ? (
              <>
                <div className="career-stage__choices">
                  {available.map((card) => (
                    <button
                      key={card.catalogId}
                      aria-pressed={chosen.catalogId === card.catalogId}
                      disabled={busy}
                      onClick={() => setSelected(card.catalogId)}
                    >
                      <img src={getCardImage(card.catalogId)} alt="" />
                      <span>{card.name}</span>
                    </button>
                  ))}
                </div>
                <div className="career-stage__claim">
                  <p>
                    <strong>{chosen.name}</strong>
                    <span>Common · Yours to keep</span>
                  </p>
                  <button
                    className="studio-action studio-action--gold"
                    disabled={busy}
                    onClick={() => void choose(chosen.catalogId)}
                  >
                    {busy ? "Claiming…" : `Claim ${chosen.name}`}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </>
            ) : (
              <p>You own every available Common. Your choices remain saved.</p>
            )}
          </section>
        )}
        {error && (
          <p className="studio-notice" role="alert">
            {error}
          </p>
        )}
        {!!badges.length && (
          <div className="career-stage__medals">
            {badges.map((id) => (
              <div key={id} data-notification-id={`style:${id}`}>
                <GameGlyph name="mastery" />
                <strong>
                  {(
                    {
                      "badge:after-hours": "After-hours champion",
                      "badge:street-draft": "Street draft winner",
                      "badge:neighborhood": "Neighborhood champion",
                    } as Record<string, string>
                  )[id] ?? id}
                </strong>
              </div>
            ))}
          </div>
        )}
      </dialog>
      {featured ? (
        <div
          className="hall-spotlight"
          data-tier={
            featured[1] >= 5 ? "gold" : featured[1] >= 3 ? "silver" : "bronze"
          }
        >
          <figure
            className="hall-spotlight__portrait"
            data-notification-id={
              featured[1] >= 5 ? `style:mastery:${featured[0]}` : undefined
            }
          >
            <span className="hall-spotlight__serial">
              HALL ARCHIVE /{" "}
              {String(
                masteryEntries.findIndex(([id]) => id === featured[0]) + 1,
              ).padStart(3, "0")}
            </span>
            <img
              key={featured[0]}
              src={getCardImage(featured[0])}
              alt={featuredCard?.name ?? featured[0]}
            />
            <figcaption>
              <span>ON THE RECORD</span>
              <strong>{featuredCard?.name ?? featured[0]}</strong>
            </figcaption>
            <i className="hall-spotlight__clip" aria-hidden="true" />
          </figure>
          <section
            className="hall-spotlight__record"
            aria-label="Character mastery record"
          >
            <span className="hall-spotlight__eyebrow">RESPECT IS EARNED.</span>
            <h2>
              {featured[1] >= 5 ? (
                <>
                  HANDS OF
                  <br />
                  <em>GOLD.</em>
                </>
              ) : (
                <>
                  PUT IN
                  <br />
                  <em>WORK.</em>
                </>
              )}
            </h2>
            <div className="hall-spotlight__seal">
              <GameGlyph name="mastery" />
              <span>{featured[1] >= 5 ? "MASTERED" : "IN THE MAKING"}</span>
            </div>
            <div
              className="hall-spotlight__wins"
              aria-label={`${Math.min(5, featured[1])} of 5 wins`}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} data-earned={featured[1] >= n}>
                  <Check aria-hidden="true" />
                  <small>{String(n).padStart(2, "0")}</small>
                </span>
              ))}
            </div>
            <p>
              {featured[1] >= 5
                ? "Five wins. A permanent mark in the hall."
                : `${5 - featured[1]} more ${5 - featured[1] === 1 ? "win" : "wins"} with ${featuredCard?.name ?? featured[0]} to earn gold.`}
            </p>
            <small className="hall-spotlight__fine-print">
              Recognition earned in battle. No extra Hands.
            </small>
          </section>
        </div>
      ) : (
        <div className="hall-empty">
          <h2>Your name goes here.</h2>
          <p>Win with your crew to start a record in the Hall of Hands.</p>
        </div>
      )}
      <nav
        className="hall-portrait-rail"
        aria-label="Choose a character record"
      >
        {masteryEntries.map(([id, wins]) => (
          <button
            key={id}
            aria-pressed={featured?.[0] === id}
            onClick={() => setFeaturedId(id)}
            data-mastered={wins >= 5}
          >
            <img src={getCardImage(id)} alt="" />
            <span>
              {(catalogCardById[id] ?? catalogCardByEngineId[id])?.name ?? id}
            </span>
            <b>{wins >= 5 ? "★" : `${wins}/5`}</b>
          </button>
        ))}
      </nav>
    </section>
  );
}
