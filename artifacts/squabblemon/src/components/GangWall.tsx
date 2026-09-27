import { useRef, useState, type CSSProperties } from "react";
import type { PlayerBootstrap } from "@workspace/api-client-react";
import {
  cardCatalog,
  canonicalElement,
  decks,
  getCardImage,
  type CatalogCard,
} from "../data";
import { getAssetUrl } from "../lib/assets";
import "../styles/gang-wall.css";

type WallMode = "elements" | "groups" | "bonds" | "combos" | "road";
type WallGroup = { name: string; cards: CatalogCard[]; note?: string };
const paintColors: Record<string, string> = {
  Earth: "#eac27e",
  Fire: "#ff8c58",
  Light: "#ffe6a1",
  Electric: "#dcc0ff",
  Dark: "#c2a8f0",
  Plant: "#a9ee99",
  Water: "#85e2ec",
  Ice: "#b7eafa",
  Air: "#b2e3cf",
  Poison: "#d5b4e8",
  Normal: "#efddbe",
};
const layers: [WallMode, string][] = [
  ["elements", "Elements"],
  ["groups", "Crews"],
  ["bonds", "Bonds"],
  ["combos", "Combos"],
  ["road", "Rewards"],
];

export function GangWall({
  bootstrap,
  onClaim,
  busy,
  error,
}: {
  bootstrap: PlayerBootstrap;
  onClaim: (id: string) => void;
  busy: boolean;
  error: string;
}) {
  const [mode, setMode] = useState<WallMode>("elements");
  const [groupIndex, setGroupIndex] = useState(0);
  const [cardId, setCardId] = useState<string | null>(null);
  const tags = useRef<HTMLElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const members = useRef<HTMLElement>(null);
  const owned = new Set(bootstrap.profile.ownedCardIds);
  const groups: WallGroup[] =
    mode === "elements"
      ? [...new Set(cardCatalog.map((c) => canonicalElement(c.type)))].map(
          (name) => ({
            name,
            cards: cardCatalog.filter((c) => canonicalElement(c.type) === name),
          }),
        )
      : mode === "groups"
        ? [...new Set(cardCatalog.map((c) => c.faction))].map((name) => ({
            name,
            cards: cardCatalog.filter((c) => c.faction === name),
          }))
        : mode === "bonds"
          ? cardCatalog
              .filter((c) => c.elementalBond)
              .map((c) => ({
                name: c.name,
                cards: [
                  c,
                  ...cardCatalog.filter(
                    (p) =>
                      p.catalogId !== c.catalogId &&
                      canonicalElement(p.type) === c.elementalBond,
                  ),
                ],
                note: c.effect,
              }))
          : decks
              .filter(
                (d) =>
                  d.archetype.includes("Combo") ||
                  d.id === "voltage" ||
                  d.id === "compound",
              )
              .map((d) => ({
                name: d.name,
                cards: cardCatalog.filter((c) => d.cards.includes(c.engineId)),
                note: d.plan,
              }));
  const milestones = bootstrap.collectionRoad;
  const index = Math.min(
    groupIndex,
    Math.max(0, (mode === "road" ? milestones.length : groups.length) - 1),
  );
  const group = groups[index];
  const milestone = milestones[index];
  const featured =
    group?.cards.find((c) => c.catalogId === cardId) ?? group?.cards[0];
  const supporting =
    group?.cards
      .filter((c) => c.catalogId !== featured?.catalogId)
      .slice(0, 2) ?? [];
  const label = mode === "road" ? milestone?.title : group?.name;
  const paint =
    paintColors[
      mode === "elements"
        ? (group?.name ?? "")
        : canonicalElement(featured?.type ?? "Normal")
    ] ?? "#dfd4a3";
  const selectGroup = (next: number) => {
    setGroupIndex(next);
    setCardId(null);
    if (members.current) members.current.scrollLeft = 0;
  };
  const selectLayer = (next: WallMode) => {
    setMode(next);
    selectGroup(0);
    if (tags.current) tags.current.scrollLeft = 0;
  };
  function moveTag(direction: number) {
    const count = mode === "road" ? milestones.length : groups.length;
    const next = Math.max(0, Math.min(count - 1, index + direction));
    selectGroup(next);
    tags.current?.querySelectorAll("button")[next]?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "auto",
    });
  }
  return (
    <section
      className="gang-mural"
      aria-label="The Gang Wall"
      style={
        {
          "--mural-paint": paint,
          "--brick": `url(${getAssetUrl("assets/progression/brick.png")})`,
        } as CSSProperties
      }
    >
      <header className="gang-mural__header">
        <img
          src={getAssetUrl("assets/progression/gang-wall.png")}
          alt="The Gang Wall"
        />
        <p>
          <b>{owned.size}</b> collected{" "}
          <span>LVL {bootstrap.profile.collectionProgress}</span>
        </p>
      </header>
      <nav className="gang-mural__layers" aria-label="Wall layers">
        {layers.map(([key, name]) => (
          <button
            key={key}
            aria-pressed={mode === key}
            onClick={() => selectLayer(key)}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="gang-mural__selector">
        <button
          aria-label="Previous tag"
          disabled={!index}
          onClick={() => moveTag(-1)}
        >
          ←
        </button>
        <nav ref={tags} aria-label="Painted tags" className="gang-mural__tags">
          {(mode === "road"
            ? milestones.map((m) => m.title)
            : groups.map((g) => g.name)
          ).map((name, i) => (
            <button
              key={`${mode}-${i}`}
              aria-pressed={index === i}
              onClick={() => selectGroup(i)}
            >
              <sup>{String(i + 1).padStart(2, "0")}</sup>
              {name}
            </button>
          ))}
        </nav>
        <button
          aria-label="Next tag"
          disabled={
            index >= (mode === "road" ? milestones.length : groups.length) - 1
          }
          onClick={() => moveTag(1)}
        >
          →
        </button>
      </div>
      <div
        className="gang-mural__scene"
        data-mode={mode}
        key={`${mode}-${index}`}
        onTouchStart={(event) => {
          if (
            (event.target as HTMLElement).closest("button, .gang-mural__skill")
          )
            return;
          const touch = event.touches[0];
          swipe.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start) return;
          const touch = event.changedTouches[0];
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
            moveTag(dx < 0 ? 1 : -1);
        }}
        onTouchCancel={() => {
          swipe.current = null;
        }}
      >
        <img
          className="gang-mural__paint"
          src={getAssetUrl("assets/progression/graffiti-paint-v2.png")}
          alt=""
          aria-hidden="true"
        />
        <div className="gang-mural__title">
          <span>
            {mode === "road"
              ? "LEAVE YOUR MARK"
              : mode === "bonds"
                ? "BUILT DIFFERENT. BONDED TOGETHER."
                : "SAME WALL. DIFFERENT ENERGY."}
          </span>
          <h2 data-long={(label?.length ?? 0) > 14}>
            {label ?? "Your story starts here"}
          </h2>
          <p>
            {mode === "road"
              ? `COLLECTION LEVEL ${milestone?.threshold ?? 0}`
              : `${group?.cards.filter((c) => owned.has(c.catalogId)).length ?? 0} / ${group?.cards.length ?? 0} COLLECTED`}
            <i aria-hidden="true">↘</i>
          </p>
        </div>
        {mode === "road" ? (
          <div className="gang-mural__reward-art" aria-hidden="true">
            <span>LVL</span>
            <b>{milestone?.threshold ?? 0}</b>
            <em>
              {milestone?.status === "claimed"
                ? "MARK MADE"
                : milestone?.status === "claimable"
                  ? "YOUR TURN"
                  : "KEEP BUILDING"}
            </em>
          </div>
        ) : (
          <div className="gang-mural__characters" aria-hidden="true">
            {supporting.map((c, i) => (
              <img
                className={`gang-mural__support gang-mural__support--${i}`}
                key={c.catalogId}
                src={getCardImage(c.catalogId)}
                alt=""
              />
            ))}
            {featured && (
              <img
                className="gang-mural__featured"
                key={featured.catalogId}
                src={getCardImage(featured.catalogId)}
                alt=""
              />
            )}
            <div className="gang-mural__grain" />
          </div>
        )}
        <section
          className="gang-mural__readout"
          aria-label={
            mode === "road" ? "Collection reward" : "Painted character details"
          }
          aria-live="polite"
        >
          {mode === "road" ? (
            <>
              <span className="gang-mural__caption">THE NEXT MARK</span>
              <h3>{milestone?.rewardLabel ?? "Keep collecting"}</h3>
              <p>
                {milestone?.description ??
                  "Grow your crew to unlock collection rewards."}
              </p>
              {milestone?.status === "claimable" ? (
                <button
                  className="gang-mural__claim"
                  data-testid={`button-claim-${milestone.id}`}
                  disabled={busy}
                  onClick={() => onClaim(milestone.id)}
                >
                  {busy ? "Collecting…" : "Claim your reward →"}
                </button>
              ) : (
                <strong className="gang-mural__status">
                  {milestone?.status === "claimed"
                    ? "✓ Collected"
                    : `Unlock at collection level ${milestone?.threshold ?? 0}`}
                </strong>
              )}
            </>
          ) : featured ? (
            <>
              <span className="gang-mural__caption">
                {owned.has(featured.catalogId)
                  ? "IN YOUR CREW"
                  : "NOT COLLECTED"}{" "}
                / {featured.rarity}
              </span>
              <h3>{featured.name}</h3>
              <div className="gang-mural__stats">
                <span>
                  <b>{featured.power}</b> HANDS
                </span>
                <span>
                  <b>{featured.cost}</b> MOTION
                </span>
                <span>{canonicalElement(featured.type)}</span>
              </div>
              <div
                className="gang-mural__skill"
                tabIndex={0}
                aria-label={`${featured.name} ability`}
              >
                <h4>{featured.ability}</h4>
                <p>{featured.effect}</p>
                {group?.note && group.note !== featured.effect && (
                  <p className="gang-mural__connection">
                    <b>THE CONNECTION</b>
                    {group.note}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p>No tags here yet.</p>
          )}
        </section>
        {error && (
          <p className="gang-mural__error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="gang-mural__footer">
        {mode !== "road" && group ? (
          <>
            <span>
              WHO'S ON THIS WALL? <i aria-hidden="true">→</i>
            </span>
            <nav
              ref={members}
              className="gang-mural__members"
              aria-label="Characters on the wall"
            >
              {group.cards.map((c, i) => (
                <button
                  key={c.catalogId}
                  aria-pressed={featured?.catalogId === c.catalogId}
                  onClick={() => setCardId(c.catalogId)}
                >
                  <sup>{String(i + 1).padStart(2, "0")}</sup>
                  {c.name}
                  <small>{owned.has(c.catalogId) ? "●" : "○"}</small>
                </button>
              ))}
            </nav>
          </>
        ) : (
          <p>Every new card leaves a mark. Every milestone pays.</p>
        )}
      </footer>
    </section>
  );
}
