import type { CSSProperties } from 'react';
import { Sparkles, type LucideIcon } from 'lucide-react';
import { getAssetUrl } from '../../lib/assets';
import '../../styles/game-ornaments.css';

const artwork = {
  fight: 'ui/fight-emblem',
  motion: 'ui/motion-bolt',
  crew: 'props/deck-stack',
  story: 'props/neighborhood-map',
  bounty: 'props/sticker-phone',
  mastery: 'rewards/medallions',
  clout: 'rewards/clout-token',
  cloutStack: 'rewards/clout-stack',
  cloutBag: 'rewards/clout-bag',
  ticket: 'rewards/fight-ticket',
  cloutTicket: 'rewards/clout-ticket',
  shards: 'rewards/style-hanger',
  rep: 'rewards/medallion',
  squabble: 'rewards/squabble-chain',
  pack: 'props/foil-pack',
} as const;
const stamps = {
  xp: Sparkles,
} as const;
export type GameGlyphName = keyof typeof artwork | keyof typeof stamps;

/** Decorative only; visible labels and control names remain live, accessible text. */
export function GameGlyph({
  name,
  icon,
  className = '',
  color,
}: {
  name?: GameGlyphName;
  icon?: LucideIcon;
  className?: string;
  color?: string;
}) {
  const art = name && name in artwork ? artwork[name as keyof typeof artwork] : undefined;
  const Stamp = icon ?? (name && name in stamps ? stamps[name as keyof typeof stamps] : Sparkles);
  return (
    <i
      className={`game-glyph ${art ? 'game-glyph--art' : 'game-glyph--stamp'} ${name ? `game-glyph--${name}` : ''} ${className}`}
      style={color ? ({ '--glyph-color': color } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      {art ? (
        <img src={getAssetUrl(`assets/${art}.webp`)} alt="" width={64} height={64} decoding="async" draggable={false} />
      ) : (
        <Stamp size={22} strokeWidth={1.8} />
      )}
    </i>
  );
}
