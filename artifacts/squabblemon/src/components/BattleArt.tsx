import { useEffect } from 'react';
import { cards, getAssetUrl, getCardImage, type Deck } from '../data';
import type { PresentationPhase } from './PlayLoop';
import './battle-art.css';

export const COMBAT_SPRITES = [
  'fight-start-burst',
  'defeat-slash',
  'lock-chain-strand',
  'lock-padlock',
  'freeze-rim',
] as const;
type CombatSpriteId = (typeof COMBAT_SPRITES)[number];
export const combatSpriteUrl = (asset: CombatSpriteId) => getAssetUrl(`assets/combat/${asset}.webp`);

/** Load the small shared sprite set before an impact needs it. */
export function BattleArtPreload() {
  useEffect(() => {
    // These effects may occur many turns later. Warm the normal image cache
    // without promising the browser that every sprite is immediately needed.
    for (const asset of COMBAT_SPRITES) {
      const sprite = new Image();
      sprite.src = combatSpriteUrl(asset);
    }
  }, []);
  return null;
}

export function CombatSprite({ asset, className = '' }: { asset: CombatSpriteId; className?: string }) {
  return (
    <img
      className={`combat-sprite ${className}`}
      src={combatSpriteUrl(asset)}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
    />
  );
}

export function DefeatCross() {
  return (
    <div className="defeat-cross" data-battle-fx="defeat-cross" aria-hidden="true">
      <span>
        <CombatSprite asset="defeat-slash" />
      </span>
      <span>
        <CombatSprite asset="defeat-slash" />
      </span>
    </div>
  );
}

/** The original timeline controls duration and skipping; artwork has no game state. */
export function BattleStartArt({ phase, player, rival }: { phase: PresentationPhase; player: Deck; rival: Deck }) {
  const countdown = phase.startsWith('countdown-');
  const versus = phase === 'versus';
  const title = countdown ? phase.slice(-1) : versus ? 'VS' : phase === 'deal' ? 'GANG UP' : 'SQUABBLE!';
  return (
    <span
      className={`battle-start-art ${countdown ? 'is-countdown' : ''} ${versus ? 'is-versus' : ''}`}
      data-testid="battle-start-art"
      data-start-phase={phase}
      aria-hidden="true"
    >
      {versus && (
        <>
          <span className="battle-start-art__fighter is-player">
            <img src={getCardImage(cards[player.hero]?.id ?? player.hero)} alt="" />
            <b>{player.name}</b>
          </span>
          <span className="battle-start-art__fighter is-rival">
            <img src={getCardImage(cards[rival.hero]?.id ?? rival.hero)} alt="" />
            <b>{rival.name}</b>
          </span>
        </>
      )}
      <span className="battle-start-art__impact" key={phase}>
        <CombatSprite asset="fight-start-burst" className="battle-start-art__burst" />
        {!countdown && !versus && (
          <img className="battle-start-art__emblem" src={getAssetUrl('assets/ui/fight-emblem.webp')} alt="" />
        )}
        <strong>{title}</strong>
        <small>
          {countdown
            ? 'Get ready'
            : versus
              ? 'Your gang · Their turf'
              : phase === 'deal'
                ? 'Make your first move'
                : 'Take the block'}
        </small>
      </span>
    </span>
  );
}
