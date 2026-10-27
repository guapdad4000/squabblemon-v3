import type { PlayerBootstrap } from "@workspace/api-client-react";
import { kumiteArtSources } from "../../lib/kumiteArt";
import { KumiteCrewActions } from "./KumiteCrewActions";
import {
  kumiteFighter,
  kumiteFormAsset,
} from "@workspace/squabblemon-engine/kumiteForms";
import { Check, HandFist, LockKeyhole, Swords, X } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { KumiteProgression } from "../../lib/kumite";
import { KumitePortrait } from "./KumiteWinnerCard";
import { catalogPortrait } from "../profile/FighterPortrait";
import { cards, catalogCardById, getAssetUrl, getCardImage } from "../../data";
import { KumiteFilmReplay } from "./KumiteFilmPlayer";

/** Reward receipts and progress come only from the authenticated server profile. */
export function KumiteRewards({
  progression,
  bootstrap,
}: {
  progression?: KumiteProgression | null;
  bootstrap?: PlayerBootstrap;
}) {
  const dossier = useRef<HTMLElement>(null);
  const dossierOpener = useRef<HTMLButtonElement | null>(null);
  function closeDossier() {
    setSelectedCardId(null);
    dossierOpener.current?.focus();
  }
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "progress" | "unlocked">("all");
  const [stanceTier, setStanceTier] = useState<
    "base" | "squabble" | "awakened"
  >("base");
  useEffect(() => {
    if (!selectedCardId) return;
    dossier.current?.focus({ preventScroll: true });
    dossier.current?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  }, [selectedCardId]);
  if (!progression) return null;
  const rewards = progression.rewards;
  const nextMilestone =
    rewards.find((r) => !r.claimed) ?? rewards[rewards.length - 1];
  const selectedReward =
    rewards.find((r) => r.cardId === selectedCardId) ?? null;
  const selectedCatalog = selectedReward
    ? catalogCardById[selectedReward.cardId]
    : null;
  const selectedEngine = selectedCatalog
    ? cards[selectedCatalog.engineId]
    : null;
  const selectedFighter = selectedReward && kumiteFighter(selectedReward.cardId);
  const selectedArt = selectedReward
    ? selectedFighter ? getAssetUrl(kumiteFormAsset(selectedFighter, stanceTier)) : getCardImage(selectedReward.cardId)
    : undefined;
  // Each server milestone sits on a branch of the illustrated road. Receipt order
  // stays stable; ownership alone never marks a Kumite milestone complete.
  return (
    <section
      className="kumite-rewards kumite-roadmap"
      aria-label="Your Kumite fighter rewards"
    >
      <header>
        <HandFist size={21} aria-hidden="true" />
        <h2>Kumite unlocks</h2>
        <span>
          {progression.completedMatches} FIGHTS · {progression.matchWins} WINS ·{" "}
          {progression.championships} TITLES
        </span>
        <Link
          href="/game/challenges?game=punch-on-patrol&raid=kumite"
          className="kumite-raid-cta"
        >
          <Swords size={14} aria-hidden="true" />
          <span>Grind Unlocks in Dojo Raid →</span>
        </Link>
      </header>
      {selectedReward && selectedCatalog && selectedEngine && (
        <aside
          ref={dossier}
          tabIndex={-1}
          className="kumite-dossier-preview"
          data-stance={stanceTier}
          aria-label={`${selectedReward.name} fighter dossier`}
          style={{ "--kumite-dossier-scene": `url(${getAssetUrl("assets/kumite/dojo-arena-wide.webp")})` } as CSSProperties}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeDossier();
          }}
        >
          <header className="kumite-dossier-preview__header">
            <h3>{selectedReward.name}</h3>
            <button type="button" className="kumite-dossier-preview__close"
              onClick={closeDossier} aria-label="Close fighter dossier">
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="kumite-dossier-preview__stage">
            <img className="kumite-dossier-preview__art"
              src={selectedArt}
              {...kumiteArtSources(selectedArt, "(max-width: 760px) 90vw, 420px")}
              decoding="async"
              onError={(event) => {
                if (event.currentTarget.hasAttribute("srcset")) event.currentTarget.removeAttribute("srcset");
              }}
              alt={selectedReward.name} />
          </div>
          <div className="kumite-dossier-preview__controls">
            {kumiteFighter(selectedReward.cardId) && (
              <div className="kumite-stance-tabs" role="group" aria-label="Preview dynamic Squabble forms">
                {([
                  ["base", "I", "BASE", `${selectedEngine.power} HANDS`],
                  ["squabble", "II", "SQUABBLE", "2× HANDS"],
                  ["awakened", "III", "GLO", "10+ HANDS"],
                ] as const).map(([tier, numeral, label, hint]) => (
                  <button key={tier} type="button" aria-pressed={stanceTier === tier}
                    onClick={() => setStanceTier(tier)}>
                    <span aria-hidden="true">{numeral}</span>
                    <strong>{label}</strong><small>{hint}</small>
                  </button>
                ))}
              </div>
            )}
            <div className="kumite-dossier-preview__progress">
              <span>{selectedReward.claimed ? <Check size={16} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}
                {selectedReward.claimed ? "UNLOCKED" : selectedReward.requirement}</span>
              {!selectedReward.claimed && <strong>{Math.min(selectedReward.required, selectedReward.progress)}/{selectedReward.required}</strong>}
            </div>
            {bootstrap ? <KumiteCrewActions key={selectedReward.cardId} bootstrap={bootstrap} cardId={selectedReward.cardId} /> : (
              <Link href="/game/challenges?game=punch-on-patrol&raid=kumite" className="kumite-raid-cta">FIGHT DOJO →</Link>
            )}
            <details key={selectedReward.cardId} className="kumite-dossier-preview__details">
              <summary>Moves &amp; mastery <span aria-hidden="true">＋</span></summary>
              <div className="kumite-dossier-preview__moves">
                <strong>{selectedEngine.ability}</strong>
                <span>{selectedEngine.effect}</span>
                <small>{selectedEngine.type.toUpperCase()} · {selectedEngine.cost} MOTION · {selectedEngine.power} BASE HANDS</small>
                <small>Forms preview the art. Live Hands follow the fight; Glo art adds no extra multiplier.</small>
              </div>
              {progression.mastery?.filter((m) => m.cardId === selectedReward.cardId).map((m) => (
                <div key={m.cardId} className="kumite-mastery">
                  <strong>{m.altOwned ? "✓ GRANDMASTER ART UNLOCKED" : "GRANDMASTER ART"}</strong>
                  <div><span>{m.dojoCleared ? "✓" : "○"} DOJO TIER {m.requiredTier}</span>
                    <span>{m.weeklyWin ? "✓" : "○"} WEEKLY WIN · IN CREW</span></div>
                  <ul>{m.quests.map((q) => (
                    <li key={q.id} data-complete={q.complete}>
                      <span>{q.claimed ? "✓" : q.complete ? "◆" : "○"} {q.label}</span>
                      <small>{q.claimed ? "SAVED" : `+${q.styleShards} SHARDS`}</small>
                    </li>
                  ))}</ul>
                </div>
              ))}
              {selectedReward.claimed && selectedReward.owned && (
                <KumiteFilmReplay cardId={selectedReward.cardId} ownedCardIds={[selectedReward.cardId]} />
              )}
            </details>
          </div>
        </aside>
      )}
      <details className="kumite-unlock-rules">
        <summary>HOW UNLOCKS COUNT</summary>
        <ul>
          <li>FIGHTS · Played weekly bouts and finished raid runs.</li>
          <li>WINS · Weekly wins, or finished raids with 50+ damage.</li>
          <li>FINALS · Played weekly final wins, or defeated raid tiers.</li>
          <li>
            GRANDMASTER ART · Clear the listed Dojo tier and win a weekly bout
            with this fighter in your crew.
          </li>
          <li>QUEST SHARDS · Each objective pays once per fighter.</li>
        </ul>
      </details>
      <div
        className="kumite-roadmap__filters"
        role="group"
        aria-label="Filter unlock road"
      >
        {(
          [
            ["all", "ALL"],
            ["progress", "IN PROGRESS"],
            ["unlocked", "UNLOCKED"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="kumite-roadmap__map">
        <div className="kumite-roadmap__embers" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <img
          className="kumite-roadmap__art"
          src={getAssetUrl("assets/kumite/unlock-roadmap.webp")}
          alt=""
          draggable={false}
          loading="lazy"
        />
        <svg
          className="kumite-roadmap__svg-spine"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {rewards.slice(0, -1).map((reward, index) => {
            const x1 = index % 2 === 0 ? 25 : 75;
            const y1 = 14.7 + index * 9.8;
            const x2 = (index + 1) % 2 === 0 ? 25 : 75;
            const y2 = 14.7 + (index + 1) * 9.8;
            return (
              <line
                key={reward.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                data-lit={reward.claimed}
              />
            );
          })}
        </svg>
        <div className="kumite-rewards__cards kumite-roadmap__nodes">
          {rewards.map((reward, index) => (
            <article
              key={reward.id}
              className="kumite-roadmap__node"
              hidden={
                filter === "unlocked"
                  ? !reward.claimed
                  : filter === "progress"
                    ? reward.claimed
                    : false
              }
              data-earned={reward.claimed}
              data-next={nextMilestone?.id === reward.id && !reward.claimed}
              data-selected={selectedCardId === reward.cardId}
              data-side={index % 2 === 0 ? "left" : "right"}
              style={
                {
                  "--node-x": `${index % 2 === 0 ? 25 : 75}%`,
                  "--node-y": `${14.7 + index * 9.8}%`,
                } as CSSProperties
              }
            >
              {nextMilestone?.id === reward.id && !reward.claimed && (
                <span className="kumite-roadmap__target-flag">
                  ★ NEXT TARGET
                </span>
              )}
              <div className="kumite-roadmap__rarity">
                {reward.rarity ??
                  catalogPortrait(reward.cardId)?.rarity ??
                  "CARD"}
              </div>
              <button
                type="button"
                className="kumite-roadmap__inspect-btn"
                onClick={(event) => {
                  dossierOpener.current = event.currentTarget;
                  setStanceTier("base");
                  setSelectedCardId((current) =>
                    current === reward.cardId ? null : reward.cardId,
                  );
                }}
                aria-label={`Inspect ${reward.name} dossier`}
              >
                <KumitePortrait hero={reward.cardId} name={reward.name} />
              </button>
              <div className="kumite-roadmap__node-copy">
                <h3>
                  <Link
                    href={`/game/collection?card=${encodeURIComponent(reward.cardId)}`}
                    aria-label={`View ${reward.name}`}
                  >
                    {reward.name}
                  </Link>
                </h3>
                <p>{reward.requirement}</p>
                <div className="kumite-roadmap__paths">
                  <span>
                    PROGRESS · {reward.progress}/{reward.required}
                  </span>
                  <Link href="/game/challenges?game=punch-on-patrol&raid=kumite">
                    DOJO RAID →
                  </Link>
                </div>
                <div
                  className="kumite-rewards__meter"
                  role="progressbar"
                  aria-label={`${reward.name} reward progress`}
                  aria-valuemin={0}
                  aria-valuemax={reward.required}
                  aria-valuenow={Math.min(reward.required, reward.progress)}
                >
                  <i
                    style={{
                      width: `${Math.min(100, (reward.progress / Math.max(1, reward.required)) * 100)}%`,
                    }}
                  />
                </div>
                <small>
                  {reward.claimed ? (
                    <>
                      <Check size={12} aria-hidden="true" />
                      Unlocked
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={11} aria-hidden="true" />
                      {Math.min(reward.required, reward.progress)} /{" "}
                      {reward.required}
                      {reward.owned ? " · Owned" : ""}
                    </>
                  )}
                </small>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
