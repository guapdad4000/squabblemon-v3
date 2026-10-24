import { StyleShardWallet } from '../../components/StyleShardWallet';
import { ItemDot, useNotifications } from '../../components/Notifications';
import { useViewMemory } from '../../lib/navigationMemory';
import { useExtrasNotificationsSeen } from '../../lib/useExtrasNotificationsSeen';
import { Link, useSearch } from 'wouter';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { LockKeyhole, ArrowUpRight, Scissors, Search } from 'lucide-react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { CHARACTER_STYLE_SETS, CHARACTER_STYLE_OFFERS, hasCharacterStickers, ownsStyle } from '@workspace/squabblemon-engine/cosmetics';
import { catalogCardById, CARD_RARITY_DEFINITIONS } from '../../data';
import { PlayerMatImage } from '../../components/PlayerMatImage';
import { CharacterSticker } from '../../components/CharacterBanner';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { getAssetUrl, getCardImage } from '../../lib/assets';
import '../../styles/character-styles.css';
import '../../styles/extras-studio.css';
import '../../styles/style-hub.css';
const PlayerMats = lazy(() => import('./PlayerMats').then(module => ({default: module.PlayerMats})));
const FinishCounter = lazy(() => import('../../components/FinishCounter').then(module => ({default: module.FinishCounter})));

export function CharacterCollections({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const requestedView = new URLSearchParams(useSearch()).get('view');
  const view = requestedView === 'characters' || requestedView === 'finishes' ? requestedView : 'mats';
  useExtrasNotificationsSeen(undefined, view === 'characters');
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
  const visible = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    return sets.filter(set => {
      const card = catalogCardById[set.cardId];
      return card.name.toLowerCase().includes(normalizedQuery)
        && (filter === 'all' || (filter === 'owned' ? ownedCardSet.has(set.cardId) : card.rarity === filter));
    });
  }, [sets, query, filter, ownedCardSet]);
  return <main className="character-styles extras-studio style-hub" data-testid="character-collections" data-reduced-motion={profile.settings.reducedMotion}>
    <header className="extras-hero style-hub__hero">
      <img className="extras-hero__art" src={getAssetUrl('assets/extras/stylist-studio.webp')} alt="" />
      <div className="extras-hero__copy"><p className="extras-eyebrow"><Scissors size={14}/> THE STYLIST</p><h1>YOUR <em>STYLE.</em></h1></div>
      {view !== 'finishes' && <details className="style-hub__wallet"><summary><GameGlyph name="shards"/><span><strong>{profile.styleShards.toLocaleString()}</strong> Universal</span><span aria-hidden="true">⌄</span></summary><StyleShardWallet wallet={profile}/></details>}
    </header>
    <nav className="style-categories" aria-label="Style categories">
      <Link href="/game/style?view=mats" className="style-category" aria-current={view==='mats'?'page':undefined}><PlayerMatImage src="assets/player-mats/v4/guap-illustration.webp" thumbnail eager/><span><strong>Player mats</strong><small>Battle backgrounds</small></span><span className="style-category__arrow" aria-hidden="true">↗</span></Link>
      <Link href="/game/style?view=characters" className="style-category" aria-current={view==='characters'?'page':undefined}><img src={getAssetUrl(sets[0]?.banner ?? 'assets/extras/stylist-studio.webp')} alt=""/><span><strong>Character styles</strong><small>Banners · decks · stickers</small></span><span className="style-category__arrow" aria-hidden="true">↗</span></Link>
      <Link href="/game/style?view=finishes" className="style-category" aria-current={view==='finishes'?'page':undefined}><img src={getAssetUrl('assets/training/inmate-chrome-icon.webp')} alt=""/><span><strong>Card finishes</strong><small>Tagged · Chrome · Style Shards</small></span><span className="style-category__arrow" aria-hidden="true">↗</span></Link>
    </nav>
    {view === 'finishes' ? <Suspense fallback={<p className="style-hub__loading" role="status">Loading card finishes…</p>}><FinishCounter key={profile.id} bootstrap={bootstrap}/></Suspense> : view === 'mats' ? <Suspense fallback={<p className="style-hub__loading" role="status">Loading player mats…</p>}><PlayerMats bootstrap={bootstrap}/></Suspense> : <>
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
    </>}
  </main>;
}
