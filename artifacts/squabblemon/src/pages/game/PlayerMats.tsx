import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap, ApiError, customFetch } from '@workspace/api-client-react';
import { PLAYER_MATS, equippedPlayerMat, ownsPlayerMat, playerMatById, type PlayerMat } from '@workspace/squabblemon-engine/playerMats';
import { quoteStyleShards, STYLE_SHARD_RARITIES, STYLE_SHARD_TIERS, type StyleShardRarity } from '@workspace/squabblemon-engine/styleShards';
import type { ShopRequest } from '@workspace/squabblemon-engine/economy';
import { catalogCardById } from '../../data';
import { MatPairArtwork, PlayerMatArtwork } from '../../components/PlayerMatArtwork';
import { StyleShardCost } from '../../components/StyleShardWallet';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { useViewMemory } from '../../lib/navigationMemory';
import { clearShopRequest, readShopRequest, saveShopRequest } from '../../lib/shopJournal';
import '../../styles/player-mat-studio.css';

type Filter = 'all' | 'owned' | 'shop' | 'story';
const filters = { all: 'All mats', shop: 'Shop', owned: 'Owned', story: 'Story' } as const;
const catalog = [...PLAYER_MATS].sort((a, b) => Number(a.source === 'default') - Number(b.source === 'default'));
export function PlayerMats({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap, client = useQueryClient();
  const equipped = equippedPlayerMat(profile);
  const [selection, setSelection] = useState<string | null>(null);
  const [rival, setRival] = useState('signature-guap');
  const [preview, setPreview] = useState<'full' | 'pvp'>('full');
  const [filter, setFilter] = useViewMemory<Filter>('mat-filter:' + profile.id, 'all');
  const [search, setSearch] = useViewMemory('mat-search:' + profile.id, '');
  const [rarity, setRarity] = useViewMemory<StyleShardRarity | 'all'>('mat-rarity:' + profile.id, 'all');
  const [showFilters, setShowFilters] = useState(rarity !== 'all');
  const [pending, setPending] = useState<ShopRequest | null>(() => readShopRequest(sessionStorage, profile.id));
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const flight = useRef(false), trigger = useRef<HTMLButtonElement | null>(null);
  const mat = playerMatById(selection ?? equipped)!;
  const card = mat.characterId ? catalogCardById[mat.characterId] : undefined;
  const owned = ownsPlayerMat(profile, mat.id);
  const affordable = mat.source !== 'shop' || quoteStyleShards(profile, mat.rarity, mat.price).canAfford;
  const visible = catalog.filter(item => (rarity === 'all' || item.rarity === rarity) && (filter === 'all' || (filter === 'owned' ? ownsPlayerMat(profile,item.id) : item.source === filter)) && (item.name + ' ' + (item.characterId ? catalogCardById[item.characterId].name : 'Included')).toLowerCase().includes(search.toLowerCase().trim()));
  const ownCount = PLAYER_MATS.filter(item => ownsPlayerMat(profile,item.id)).length;
  async function refresh(next: PlayerBootstrap) {
    await client.cancelQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
    client.setQueryData(getGetPlayerBootstrapQueryKey(), next);
  }
  async function purchase() {
    if (flight.current) return;
    flight.current = true; setBusy(true); setNotice('');
    try {
      const request = pending ?? { idempotencyKey: crypto.randomUUID(), itemId: 'player-mat' as const, cardId: mat.characterId };
      saveShopRequest(sessionStorage, profile.id, request); setPending(request);
      const result = await customFetch<{bootstrap: PlayerBootstrap; receipt: {summary: string}}>('/api/player/shop/purchases', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(request) });
      await refresh(result.bootstrap);
      clearShopRequest(sessionStorage, profile.id); setPending(null); setNotice(result.receipt.summary);
    } catch (error) {
      if (error instanceof ApiError && [400,409].includes(error.status)) {
        clearShopRequest(sessionStorage,profile.id); setPending(null);
        setNotice((error.data as {error?: string})?.error ?? 'Purchase unavailable.');
        void client.invalidateQueries({queryKey:getGetPlayerBootstrapQueryKey()});
      } else setNotice('Purchase not confirmed. Recover the same request to check it.');
    } finally {flight.current=false;setBusy(false);}
  }
  async function equip() {
    if (flight.current || pending) return;
    flight.current=true;setBusy(true);setNotice('');
    try {
      const result = await customFetch<PlayerBootstrap>('/api/player/cosmetics',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...profile.settings.cosmetics,playerMatId:mat.id})});
      await refresh(result);setNotice(mat.name + ' equipped.');
    } catch(error) {setNotice(error instanceof ApiError ? (error.data as {error?:string})?.error ?? 'Could not equip. Try again.' : 'Could not equip. Try again.');}
    finally {flight.current=false;setBusy(false);}
  }
  function select(item: PlayerMat, button: HTMLButtonElement) {trigger.current=button;setSelection(item.id);setNotice('');}
  function reset() {setSearch('');setFilter('all');setRarity('all');}
  return <section className="mat-studio" data-testid="player-mat-studio" aria-label="Player mats">
    <div className="mat-library__heading"><div><h2>Player mats <span>{ownCount}/{PLAYER_MATS.length} owned</span></h2><p>Your half in PvP. Full scene in training.</p></div><button className="mat-equipped" onClick={e=>select(playerMatById(equipped)!,e.currentTarget)}><Check size={14}/><span>Equipped <strong>{playerMatById(equipped)!.name}</strong></span><span aria-hidden="true">↗</span></button></div>
    {pending && <div className="mat-recovery"><p>One purchase needs confirmation.</p><button disabled={busy} onClick={()=>void purchase()}>Recover purchase</button></div>}
    {!selection && notice && <p role="status" className="mat-notice">{notice}</p>}
    <div className="mat-browse-tools">
      <nav className="mat-filters" aria-label="Filter player mats">{(Object.keys(filters) as Filter[]).map(value=><button key={value} aria-pressed={value===filter} onClick={()=>setFilter(value)}>{filters[value]}</button>)}</nav>
      <div className="mat-search-row"><label className="mat-search"><Search size={17}/><input type="search" aria-label="Find a player mat" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a character or mat"/></label><button className="mat-filter-toggle" aria-expanded={showFilters} aria-controls="mat-rarity-filter" aria-label="Filter by rarity" onClick={()=>setShowFilters(value=>!value)}><SlidersHorizontal size={18}/>{rarity !== 'all' && <span className="mat-filter-dot"/>}</button></div>
      {showFilters && <label id="mat-rarity-filter" className="mat-rarity-filter">Rarity<select aria-label="Mat rarity" value={rarity} onChange={e=>setRarity(e.target.value as StyleShardRarity | 'all')}><option value="all">All rarities</option>{STYLE_SHARD_RARITIES.map(tier=><option key={tier} value={tier}>{STYLE_SHARD_TIERS[tier].label}</option>)}</select></label>}
    </div>
    <section className="mat-library" aria-label="Player mat collection">
      <div className="mat-grid">{visible.map(item=>{
        const isOwned=ownsPlayerMat(profile,item.id), character=item.characterId?catalogCardById[item.characterId]:undefined;
        return <button type="button" key={item.id} className="mat-card" data-testid={'mat-'+item.id} aria-haspopup="dialog" aria-label={item.name + ' · ' + (character?.name ?? 'Included venue') + ' · ' + (equipped===item.id?'Equipped':isOwned?'Owned':item.source==='story'?'Story reward':item.price+' '+STYLE_SHARD_TIERS[item.rarity].label+' shards')} onClick={e=>select(item,e.currentTarget)}>
          <div className="mat-card__art"><PlayerMatArtwork mat={item} thumbnail/>{(isOwned || item.source==='story') && <span>{equipped===item.id?<><Check size={11}/> EQUIPPED</>:isOwned?'OWNED':'STORY REWARD'}</span>}</div>
          <div className="mat-card__caption"><span>{character?.name ?? 'INCLUDED VENUE'}</span><strong>{item.name}</strong><span className="mat-rarity" data-rarity={item.rarity}>{STYLE_SHARD_TIERS[item.rarity].label}</span><div className="mat-card__price">{isOwned?<span>Preview & equip</span>:item.source==='story'?<span>Earn in story</span>:<><GameGlyph name="shards" shardRarity={item.rarity}/><b>{item.price}</b><span>shards</span></>}<span className="mat-card__arrow" aria-hidden="true">↗</span></div></div>
        </button>;
      })}</div>
      {!visible.length && <div className="mat-empty" role="status"><h3>No mats found</h3><button onClick={reset}>Clear filters</button></div>}
    </section>
    <Dialog.Root open={selection !== null} onOpenChange={open=>{if(!open)setSelection(null);}}>
      <Dialog.Portal><Dialog.Overlay className="mat-dialog-overlay"/><Dialog.Content className="mat-dialog" onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus({preventScroll:true});}}>
        <header className="mat-dialog__header"><div><span className="mat-eyebrow">{card?.name ?? 'INCLUDED VENUE'}</span><Dialog.Title>{mat.name}</Dialog.Title></div><Dialog.Close className="mat-dialog__close" aria-label="Close mat preview"><X size={22}/></Dialog.Close></header>
        <div className="mat-dialog__body">
          <div className="mat-preview-group"><nav className="mat-preview-modes" aria-label="Mat preview mode"><button aria-pressed={preview==='full'} onClick={()=>setPreview('full')}>Full mat</button><button aria-pressed={preview==='pvp'} onClick={()=>setPreview('pvp')}>PvP split</button></nav><section className="mat-preview" aria-label={preview==='full'?mat.name+' full mat':mat.name+' against '+playerMatById(rival)!.name}><MatPairArtwork playerId={mat.id} rivalId={rival} full={preview==='full'} eager/>{preview==='pvp' && <><span className="mat-preview__label mat-preview__label--rival">RIVAL</span><span className="mat-preview__label mat-preview__label--you">YOU</span><div className="mat-preview__seam"/></>}</section>{preview==='pvp' && <label className="mat-rival-choice">Rival mat<select aria-label="Preview rival mat" value={rival} onChange={e=>setRival(e.target.value)}>{PLAYER_MATS.map(m=><option key={m.id} value={m.id}>{m.characterId ? catalogCardById[m.characterId].name+' · ' : ''}{m.name}</option>)}</select></label>}</div>
          <aside className="mat-selection"><span className="mat-rarity" data-rarity={mat.rarity}>{STYLE_SHARD_TIERS[mat.rarity].label}</span><Dialog.Description>Your half in PvP. Full scene in training.</Dialog.Description>
            {owned ? <p className="mat-selection__owned"><Check size={16}/>{mat.source==='default'?'Included':'In your collection'}</p> : mat.source==='story' ? <div className="mat-story-lock"><span>STORY REWARD</span><strong>{mat.storyTitle}</strong></div> : <><StyleShardCost wallet={profile} rarity={mat.rarity} cost={mat.price}/>{card && !profile.ownedCardIds.includes(card.catalogId) && <p className="mat-no-fighter">No character unlock needed.</p>}</>}
            <p role="status" aria-live="polite" className="mat-notice">{busy?'Saving…':notice}</p>
          </aside>
        </div>
        <footer className="mat-dialog__actions">{pending ? <button className="mat-action" disabled={busy} onClick={()=>void purchase()}>Recover purchase</button> : owned ? <button className="mat-action" disabled={busy || equipped===mat.id} onClick={()=>void equip()}>{equipped===mat.id?'Equipped':'Equip mat'}</button> : mat.source==='shop' ? <button className="mat-action" disabled={busy || !affordable} onClick={()=>void purchase()}>{affordable?'Unlock · '+mat.price+' shards':'Not enough shards'}</button> : <Dialog.Close asChild><Link className="mat-action" href="/game/story">Open story ↗</Link></Dialog.Close>}</footer>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </section>;
}
