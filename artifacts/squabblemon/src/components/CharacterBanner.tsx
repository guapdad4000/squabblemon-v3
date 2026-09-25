import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { styleSetFor, stickerById } from '@workspace/squabblemon-engine/cosmetics';
import { getBuddyBannerImage, catalogCardById, CARD_RARITY_DEFINITIONS } from '../data';
import { getAssetUrl, getCardImage } from '../lib/assets';
import '../styles/character-styles.css';

export function CharacterSticker({ id, decorative = false }: { id: string; decorative?: boolean }) {
  const found = stickerById(id);
  if (!found) return null;
  if (found.sticker.image) return <img className="character-sticker character-sticker--image" src={getAssetUrl(found.sticker.image)} alt={decorative ? '' : found.sticker.name} aria-hidden={decorative || undefined} loading="lazy" decoding="async" width={512} height={512} />;
  if (!found.set.stickerAtlas || found.sticker.cell === undefined) return null;
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
  const bannerArtwork = cardId === 'buddy' ? getBuddyBannerImage() : set.banner ? getAssetUrl(set.banner) : undefined;
  return <div ref={root} className={'character-banner' + (compact ? ' character-banner--compact' : '') + (bannerArtwork ? ' character-banner--artwork' : '')} data-finish={finish} data-long-name={card.name.length > 11} data-animated={animated && running} style={{ '--style-accent': set.accent } as CSSProperties} aria-label={card.name + ' character banner'}>
    {bannerArtwork ? <>
      <img className="character-banner__artwork" src={bannerArtwork} alt={cardId === 'buddy' ? 'Buddy in his plant and rock Earth forms' : card.name + ' signature banner'} decoding="async" />
      {displayName && <span className="character-banner__identity">{displayName}</span>}
    </> : <><img className="character-banner__scene" src={getAssetUrl(set.background)} alt="" decoding="async" />
    <div className="character-banner__shade" />
    <span className="character-banner__print" aria-hidden="true">{set.emblem}</span>
    <img className="character-banner__fighter" src={getCardImage(cardId)} alt="" decoding="async" />
    <div className="character-banner__copy"><span>{displayName ?? 'SQUABBLEMON / SIGNATURE SERIES ' + set.series}</span><strong>{card.name}</strong><p>{set.tagline}</p><small>{CARD_RARITY_DEFINITIONS[card.rarity].label} / {finish === 'silver' ? 'SILVER LINING' : set.sceneName.toUpperCase()}</small></div></>}
    <div className="character-banner__stickers">{stickers.slice(0, 3).map(id => <CharacterSticker key={id} id={id} />)}</div>
    <div className="character-banner__sheen" aria-hidden="true" />
  </div>;
}
