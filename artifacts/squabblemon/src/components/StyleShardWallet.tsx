import type { CSSProperties } from "react";
import type { CardRarity } from "@workspace/squabblemon-engine/data";
import {
  STYLE_SHARD_RARITIES,
  STYLE_SHARD_TIERS,
  normalizeStyleShardBalances,
  quoteStyleShards,
  styleShardRarityForCard,
  type StyleShardWallet as Wallet,
} from "@workspace/squabblemon-engine/styleShards";
import { GameGlyph } from "./venue/GameGlyph";
import "../styles/style-shards.css";

export function StyleShardWallet({
  wallet,
  cardRarity,
}: {
  wallet: Wallet;
  cardRarity?: CardRarity;
}) {
  const balances = normalizeStyleShardBalances(wallet.styleShardBalances);
  const selected = cardRarity ? styleShardRarityForCard(cardRarity) : null;
  return (
    <section className="shard-wallet" aria-label="Your Style Shards">
      <div className="shard-wallet__balances">
        <div className="shard-wallet__universal">
          <GameGlyph name="shards" />
          <div>
            <strong>{wallet.styleShards.toLocaleString()}</strong>
            <span>Universal</span>
          </div>
        </div>
        {STYLE_SHARD_RARITIES.map((rarity) => (
          <div
            key={rarity}
            className="shard-wallet__tier"
            data-selected={selected === rarity}
            style={
              {
                "--shard-color": STYLE_SHARD_TIERS[rarity].color,
              } as CSSProperties
            }
          >
            <GameGlyph name="shards" shardRarity={rarity} />
            <strong>{balances[rarity].toLocaleString()}</strong>
            <span>{STYLE_SHARD_TIERS[rarity].label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StyleShardCost({
  wallet,
  rarity,
  cost,
}: {
  wallet: Wallet;
  rarity: CardRarity;
  cost: number;
}) {
  const quote = quoteStyleShards(wallet, rarity, cost);
  const label = STYLE_SHARD_TIERS[quote.rarity].label;
  return (
    <div className="shard-cost" data-affordable={quote.canAfford}>
      <div>
        <GameGlyph name="shards" shardRarity={quote.rarity} />
        <strong>
          {cost} <span>{label} shards</span>
        </strong>
      </div>
      <p>
        {quote.canAfford
          ? `Uses ${quote.matchingSpend} ${label}${quote.universalSpend ? ` + ${quote.universalSpend} Universal` : ""}.`
          : `${quote.shortfall} more ${label} or Universal shards needed.`}
      </p>
      <small>
        You have {quote.matchingAvailable} {label} + {quote.universalAvailable}{" "}
        Universal.
      </small>
    </div>
  );
}
