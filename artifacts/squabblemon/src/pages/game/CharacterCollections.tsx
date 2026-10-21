import { StyleShardWallet } from '../../components/StyleShardWallet';
import { ItemDot, useNotifications } from '../../components/Notifications';
import { useViewMemory } from '../../lib/navigationMemory';
import { useExtrasNotificationsSeen } from '../../lib/useExtrasNotificationsSeen';
import { Link } from 'wouter';
import { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, ArrowUpRight, Scissors, Search, Sparkles } from 'lucide-react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { CHARACTER_STYLE_SETS, CHARACTER_STYLE_OFFERS, hasCharacterStickers, ownsStyle } from '@workspace/squabblemon-engine/cosmetics';
import { catalogCardById, CARD_RARITY_DEFINITIONS } from '../../data';
import { CharacterSticker } from '../../components/CharacterBanner';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { getAssetUrl, getCardImage } from '../../lib/assets';
import '../../styles/character-styles.css';
import '../../styles/extras-studio.css';

export function CharacterCollections({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  useExtrasNotificationsSeen();
  const { notices } = useNotifications();
  const { profile } = bootstrap;
  const [query, setQuery] = useViewMemory(`styles-search:${profile.id}`, '');
  const [filter, setFilter] = useViewMemory<'all' | 'owned' | 'Mythical' | 'Legendary' | 'Epic'>(`styles-filter:${profile.id}`, 'all');
  const [shown, setShown] = useState(12);
  useEffect(() => setShown(12), [query, filter]);
  const ownedCardSet = useMemo(() => new Set(profile.ownedCardIds), [profile.ownedCardIds]);
  const sets = useMemo(
    () => Object.values(CHARACTER_STYLE_SETS).sort(
      (a, b) => Number(ownedCardSet.has(b.cardId)) - Number(ownedCardSet.has(a.cardId)) || a.series.localeCompare(b.series),
    ),
    [ownedCardSet],
  );
  const ownedCount = useMemo(() => sets.filter(set => ownedCardSet.has(set.cardId)).length, [sets, ownedCardSet]);
  const visible = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    return sets.filter(set => {
      const card = catalogCardById[set.cardId];
      return card.name.toLowerCase().includes(normalizedQuery)
        && (filter === 'all' || (filter === 'owned' ? ownedCardSet.has(set.cardId) : card.rarity === filter));
    });
  }, [sets, query, filter, ownedCardSet]);
  return <main className="character-styles extras-studio" data-testid="character-collections" data-reduced-motion={profile.settings.reducedMotion}>
    <header className="extras-hero">
      <img className="extras-hero__art" src={getAssetUrl('assets/extras/stylist-studio.webp')} alt="The Stylist at her customization workbench" />
      <div className="extras-hero__copy"><p className="extras-eyebrow"><Scissors size={14}/> SIGNATURE COLLECTIONS · {ownedCount}/{sets.length} OPEN</p><h1>THE<br/><em>EXTRAS.</em></h1></div>
    </header>
    <Link href="/game/mats" className="extras-ticket" style={{display:"flex",justifyContent:"space-between",margin:"18px 0",padding:"18px"}}>PLAYER MATS <span>Build your home turf ↗</span></Link>
    <StyleShardWallet wallet={profile}/>
    <section id="extras-collections" className="extras-collections" aria-label="Signature collections">
      <div className="extras-section-heading"><div><p className="extras-eyebrow">{String(visible.length).padStart(2,'0')} SERIES</p><h2>Signature <em>Collections</em></h2></div></div>
      <div className="style-library__tools extras-tools"><label><span>Find your character</span><div className="extras-search"><Search size={17}/><input type="search" aria-label="Search signature collections" placeholder="Who are you repping?" value={query} onChange={event => setQuery(event.target.value)}/></div></label><nav aria-label="Filter collections">{(['all','owned','Mythical','Legendary','Epic'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All collections' : value === 'owned' ? 'My characters' : value === 'Legendary' ? 'Legendaries' : value === 'Epic' ? CARD_RARITY_DEFINITIONS.Epic.label : 'Mythicals'}</button>)}</nav></div>
      <div className="extras-grid">
        {visible.slice(0,shown).map((set,index) => {
          const card=catalogCardById[set.cardId], owned=ownedCardSet.has(set.cardId), offers=CHARACTER_STYLE_OFFERS.filter(offer=>offer.id !== 'character-stickers' || hasCharacterStickers(set)), count=offers.filter(offer=>ownsStyle(profile,set.cardId,offer.id)).length;
          const complete = owned && count === offers.length;
          const contents=<><div className="extras-pack__top"><span>VOL. {set.series}</span><span>{owned ? 'YOUR COLLECTION' : <><LockKeyhole size={11}/> LOCKED</>}</span></div><div className="extras-pack__portrait">{set.banner ? <img src={getAssetUrl(set.banner)} alt="" loading="lazy" decoding="async"/> : <img className="extras-pack__fighter" src={getCardImage(set.cardId)} alt="" loading="lazy"/>}</div><div className="extras-pack__body"><p className="extras-pack__rarity">{CARD_RARITY_DEFINITIONS[card.rarity].label} / SIGNATURE SERIES</p><h3>{card.name}{owned && notices.filter(n => n.id.startsWith(`style:style:${set.cardId}:`) || n.id === `banner:${set.cardId}`).map(n=><ItemDot key={n.id} id={n.id}/>)}</h3><p className="extras-pack__tagline">{set.tagline}</p><div className="extras-pack__stickers">{set.stickers.slice(0,4).map(sticker=><CharacterSticker key={sticker.id} id={sticker.id} decorative/>)}</div><div className="extras-pack__bottom"><span>{owned ? complete ? 'COMPLETE COLLECTION' : `${count} / ${offers.length} STYLES${set.stickers.length ? ` · ${set.stickers.length} STICKERS` : ' · DECK COVER INCLUDED'}` : 'UNLOCK CHARACTER TO OPEN'}</span>{owned ? <ArrowUpRight size={22}/> : <LockKeyhole size={17}/>}</div></div></>;
          return owned ? <Link key={set.cardId} href={'/game/style/'+set.cardId} className="extras-pack" data-complete={complete ? 'true' : undefined} style={{animationDelay:`${Math.min(index,8)*45}ms`}} aria-label={'Open '+card.name+' collection'}>{contents}</Link> : <article key={set.cardId} className="extras-pack extras-pack--locked" aria-label={card.name+' collection — character locked'} aria-disabled="true">{contents}</article>;
        })}
      </div>
      {shown < visible.length && <div className="extras-more"><p>{Math.min(shown,visible.length)} of {visible.length} collections on the wall</p><button className="extras-ticket" type="button" onClick={()=>setShown(count=>count+12)}>Show more collections <ArrowUpRight size={18}/></button></div>}
      {visible.length === 0 && <div role="status" className="extras-empty"><Scissors size={30}/><h3>No looks on this rack.</h3><p>Try another character or reset your filters.</p><button className="extras-ticket" onClick={()=>{setQuery('');setFilter('all');}}>Show all collections</button></div>}
    </section>
    <footer className="extras-footer"><Scissors size={22}/><p>Made for your gang. Styled by you.<span>Every sticker pack includes all its designs. Mix up to three owned stickers on your banner.</span></p><strong>THE EXTRAS.</strong></footer>
  </main>;
}
