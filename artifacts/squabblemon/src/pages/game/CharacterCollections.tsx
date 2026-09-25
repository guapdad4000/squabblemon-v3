import { useViewMemory } from '../../lib/navigationMemory';
import { Link } from 'wouter';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { CHARACTER_STYLE_SETS, CHARACTER_STYLE_OFFERS, ownsStyle } from '@workspace/squabblemon-engine/cosmetics';
import { catalogCardById, CARD_RARITY_DEFINITIONS } from '../../data';
import { CharacterSticker } from '../../components/CharacterBanner';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { getAssetUrl, getCardImage } from '../../lib/assets';
import '../../styles/character-styles.css';

export function CharacterCollections({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap;
  const [query, setQuery] = useViewMemory(`styles-search:${profile.id}`, '');
  const [filter, setFilter] = useViewMemory<'all' | 'owned' | 'Mythical' | 'Legendary' | 'Epic'>(`styles-filter:${profile.id}`, 'all');
  const sets = Object.values(CHARACTER_STYLE_SETS).sort((a,b) => a.series.localeCompare(b.series));
  const visible = sets.filter(set => {
    const card = catalogCardById[set.cardId];
    return card.name.toLowerCase().includes(query.toLowerCase().trim()) && (filter === 'all' || (filter === 'owned' ? profile.ownedCardIds.includes(set.cardId) : card.rarity === filter));
  });
  return <main className="character-styles style-library" data-testid="character-collections">
    <header className="character-styles__header"><div><p className="style-kicker">SQUABBLEMON / SIGNATURE SERIES</p><h1>Your favorites.<i>Your signature.</i></h1><p className="style-library__intro">Character stickers, banners and card scenes. Collect a look. Make it yours.</p></div><div className="style-wallet"><GameGlyph name="shards"/><strong>{profile.styleShards.toLocaleString()}</strong><span>Style Shards</span></div></header>
    <div className="style-library__tools"><label><span>Find a character</span><input type="search" aria-label="Search signature collections" placeholder="Search collections…" value={query} onChange={event => setQuery(event.target.value)}/></label><nav aria-label="Filter collections">{(['all','owned','Mythical','Legendary','Epic'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All packs' : value === 'owned' ? 'My characters' : value === 'Legendary' ? 'Legendaries' : value === 'Epic' ? CARD_RARITY_DEFINITIONS.Epic.label : 'Mythicals'}</button>)}</nav></div>
    <p className="style-kicker">{visible.length} COLLECTION{visible.length === 1 ? '' : 'S'} / BANNERS, STICKERS & DECK COVERS</p>
    <section className="style-library__grid" aria-label="Signature collections">
      {visible.map(set => {const card=catalogCardById[set.cardId],owned=profile.ownedCardIds.includes(set.cardId),count=CHARACTER_STYLE_OFFERS.filter(offer=>ownsStyle(profile,set.cardId,offer.id)).length;return <Link key={set.cardId} href={'/game/style/'+set.cardId} className="style-library__card" aria-label={'Open '+card.name+' collection'}>
        <div className={"style-library__portrait" + (set.banner ? " style-library__portrait--banner" : "")}>{set.banner ? <img className="style-library__banner" src={getAssetUrl(set.banner)} alt={card.name + " banner"} loading="lazy" decoding="async"/> : <><img className="style-library__scene" src={getAssetUrl(set.background)} alt="" loading="lazy"/><img className="style-library__fighter" src={getCardImage(set.cardId)} alt="" loading="lazy"/></>}<span>{set.series} / {CARD_RARITY_DEFINITIONS[card.rarity].label}</span></div>
        <div className="style-library__caption"><h2>{card.name}</h2><p>{set.tagline}</p><div className="style-library__stickers">{set.stickers.slice(0, 4).map(sticker=><CharacterSticker key={sticker.id} id={sticker.id} decorative/>)}</div><small>{set.stickers.length} STICKERS · {owned ? count === 3 ? 'COMPLETE COLLECTION' : count+' / 3 UNLOCKS · BANNER INCLUDED' : 'PREVIEW · CHARACTER REQUIRED'}<span aria-hidden="true">↗</span></small></div>
      </Link>})}
    </section>
    {visible.length === 0 && <p role="status" className="style-notice">No collections match this filter. Try another character or show all packs.</p>}
    <p className="style-library__footnote">Every sticker pack includes all designs shown in its collection. Mix up to three owned stickers on any character banner.</p>
  </main>;
}
