import { useEffect, useRef, useState } from 'react';
import { styleSetFor, stickerById } from '@workspace/squabblemon-engine/cosmetics';
import { catalogCardById, CARD_RARITY_DEFINITIONS } from '../data';
import { getAssetUrl, getCardImage } from '../lib/assets';
import '../styles/character-styles.css';

export function CharacterSticker({ id, decorative = false }: { id: string; decorative?: boolean }) {
  const found = stickerById(id);
  if (!found?.set.stickerAtlas) return null;
  return <span className="character-sticker" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : found.sticker.name} aria-hidden={decorative || undefined}
    style={{ backgroundImage: 'url("' + getAssetUrl(found.set.stickerAtlas) + '")', backgroundPosition: (found.sticker.cell % 2 ? '100%' : '0%') + ' ' + (found.sticker.cell > 1 ? '100%' : '0%') }} />;
}
export function CharacterBanner({ cardId, finish = 'base', stickers = [], displayName, animated = true, compact = false }: {
  cardId: string; finish?: 'base' | 'silver'; stickers?: string[]; displayName?: string; animated?: boolean; compact?: boolean;
}) {
  const set = styleSetFor(cardId), card = catalogCardById[cardId];
  const root = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const element = root.current; if (!element || !animated) return;
    let visible = false;
    const update = () => setRunning(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(element); document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, [animated, cardId]);
  if (!set || !card) return null;
  return <div ref={root} className={'character-banner' + (compact ? ' character-banner--compact' : '')} data-finish={finish} data-animated={animated && running} aria-label={card.name + ' character banner'}>
    <img className="character-banner__scene" src={getAssetUrl(set.background)} alt="" decoding="async" />
    <div className="character-banner__shade" />
    <span className="character-banner__print" aria-hidden="true">K★</span>
    <img className="character-banner__fighter" src={getCardImage(cardId)} alt="" decoding="async" />
    <div className="character-banner__copy"><span>{displayName ?? 'SQUABBLEMON / SIGNATURE SERIES 001'}</span><strong>{card.name}</strong><p>{set.tagline}</p><small>{CARD_RARITY_DEFINITIONS[card.rarity].label} / {finish === 'silver' ? 'SILVER LINING' : 'BLUE HOUR'}</small></div>
    <div className="character-banner__stickers">{stickers.slice(0, 3).map(id => <CharacterSticker key={id} id={id} />)}</div>
    <div className="character-banner__sheen" aria-hidden="true" />
  </div>;
}
