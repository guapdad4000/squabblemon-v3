import React, { useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { planShopPurchase } from "@workspace/squabblemon-engine/economy";
import {
  STYLE_SHARD_RARITIES,
  STYLE_SHARD_TIERS,
  addStyleShardBalances,
  quoteStyleShards,
  type StyleShardRarity,
} from "@workspace/squabblemon-engine/styleShards";
import { cardCatalog } from "../src/data";
import { GameGlyph } from "../src/components/venue/GameGlyph";
import {
  StyleShardWallet,
  StyleShardCost,
} from "../src/components/StyleShardWallet";
import { CharacterStyles } from "../src/pages/game/CharacterStyles";
import { CharacterCollections } from "../src/pages/game/CharacterCollections";
import { Inventory } from "../src/pages/game/Inventory";
import { Market } from "../src/pages/game/Market";
import { CardInspector } from "../src/components/CardInspector";
import { profileBootstrap } from "./fighter-id.fixture";
import "../src/index.css";
import "./style-shards.fixture.css";

const initial = () =>
  profileBootstrap({
    id: "e2e-player",
    styleShards: 40,
    styleShardBalances: {
      Common: 10,
      Uncommon: 24,
      Rare: 60,
      Epic: 40,
      Legendary: 40,
      Mythical: 0,
    },
    ownedCardIds: cardCatalog.map((card) => card.catalogId),
    discoveredCardIds: cardCatalog.map((card) => card.catalogId),
    settings: { reducedMotion: true, turnTimerEnabled: true },
  });
function Preview() {
  const [bootstrap, setBootstrap] = useState(initial);
  const [rarity, setRarity] = useState<StyleShardRarity>("Rare");
  const [message, setMessage] = useState("Select a rarity to try its shards.");
  const card = cardCatalog.find((card) => card.rarity === rarity)!;
  const tier = STYLE_SHARD_TIERS[rarity];
  const quote = quoteStyleShards(bootstrap.profile, card.rarity, 80);
  const owned = bootstrap.profile.ownedVariants.includes(
    `${card.catalogId}:tagged`,
  );
  const view = new URLSearchParams(location.search).get("view");
  if (view === "styles")
    return <CharacterStyles bootstrap={bootstrap} cardId="kyle" />;
  if (view === "collections")
    return <CharacterCollections bootstrap={bootstrap} />;
  if (view === "inventory") return <Inventory bootstrap={bootstrap} />;
  if (view === "market") return <Market bootstrap={bootstrap} />;
  if (view === "inspector")
    return (
      <CardInspector
        card={card}
        bootstrap={bootstrap}
        onClose={() => location.assign(location.pathname)}
      />
    );
  return (
    <main
      className="shard-preview"
      style={{ "--tier-color": tier.color } as CSSProperties}
    >
      <header className="shard-preview__header">
        <span>SQUABBLEMON / THE EXTRAS</span>
        <h1>
          RARE FINDS.
          <br />
          <em>FRESH FITS.</em>
        </h1>
        <p>Style Shards, by rarity.</p>
        <small>Local preview · Sample balances · No account changes</small>
      </header>
      <div className="shard-preview__bench">
        <section
          className="shard-preview__art"
          aria-label={`${tier.label} Style Shard artwork`}
        >
          <span>EXTRA COPY / NEW POSSIBILITIES</span>
          <GameGlyph name="shards" shardRarity={rarity} />
          <h2>{tier.label}</h2>
          <p>+{tier.duplicatePayout} shards per extra pack copy</p>
        </section>
        <section className="shard-preview__checkout">
          <span>TRY THE EXCHANGE</span>
          <h2>
            Keep the character.
            <br />
            Change the look.
          </h2>
          <p>
            Extra copies fund styles from their own rarity. Universal shards can
            finish any purchase.
          </p>
          <nav aria-label="Choose shard rarity">
            {STYLE_SHARD_RARITIES.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={value === rarity}
                onClick={() => {
                  setRarity(value);
                  setMessage("Select a rarity to try its shards.");
                }}
              >
                <GameGlyph name="shards" shardRarity={value} />
                <span>{STYLE_SHARD_TIERS[value].label}</span>
              </button>
            ))}
          </nav>
          <h3>{card.name} · Tagged finish</h3>
          {owned ? (
            <p className="shard-preview__owned">
              Tagged is yours. No further shard payment.
            </p>
          ) : (
            <StyleShardCost
              wallet={bootstrap.profile}
              rarity={card.rarity}
              cost={80}
            />
          )}
          <div className="shard-preview__actions">
            <button
              type="button"
              onClick={() => {
                setBootstrap((current) => ({
                  ...current,
                  profile: {
                    ...current.profile,
                    styleShardBalances: addStyleShardBalances(
                      current.profile.styleShardBalances,
                      { [rarity]: tier.duplicatePayout },
                    ),
                  },
                }));
                setMessage(
                  `Extra ${tier.label} copy → +${tier.duplicatePayout} ${tier.label} shards.`,
                );
              }}
            >
              Add a duplicate · +{tier.duplicatePayout}
            </button>
            <button
              type="button"
              disabled={!quote.canAfford || owned}
              onClick={() => {
                const result = planShopPurchase(bootstrap.profile, {
                  itemId: "tagged-style",
                  cardId: card.catalogId,
                });
                setBootstrap((current) => ({
                  ...current,
                  profile: { ...current.profile, ...result.wallet },
                }));
                setMessage(result.receipt.summary);
              }}
            >
              {owned ? "Tagged unlocked" : "Craft Tagged · 80"}
            </button>
          </div>
          <p role="status">{message}</p>
          <button
            type="button"
            className="shard-preview__reset"
            onClick={() => {
              setBootstrap(initial());
              setMessage("Sample balances reset.");
            }}
          >
            Reset preview
          </button>
        </section>
      </div>
      <StyleShardWallet wallet={bootstrap.profile} cardRarity={card.rarity} />
      <footer>
        Saved shards stay universal. Style prices stay the same. Gameplay stats
        stay the same.
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    <Preview />
  </QueryClientProvider>,
);
