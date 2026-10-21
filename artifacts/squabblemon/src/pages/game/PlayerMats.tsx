import { useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { ApiError, customFetch } from '@workspace/api-client-react';
import { PLAYER_MATS, equippedPlayerMat, ownsPlayerMat, playerMatById, type PlayerMat } from '@workspace/squabblemon-engine/playerMats';
import { quoteStyleShards, STYLE_SHARD_RARITIES, STYLE_SHARD_TIERS, type StyleShardRarity } from '@workspace/squabblemon-engine/styleShards';
import type { ShopRequest } from '@workspace/squabblemon-engine/economy';
import { catalogCardById } from '../../data';
import { MatPairArtwork, PlayerMatArtwork } from '../../components/PlayerMatArtwork';
import { StyleShardCost, StyleShardWallet } from '../../components/StyleShardWallet';
import { clearShopRequest, readShopRequest, saveShopRequest } from '../../lib/shopJournal';
import '../../styles/player-mat-studio.css';

type Filter = 'all' | 'owned' | 'shop' | 'story' | 'default';
export function PlayerMats({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap, client = useQueryClient();
  const equipped = equippedPlayerMat(profile);
  const [selection, setSelection] = useState(equipped);
  const [rival, setRival] = useState('signature-guap');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState<StyleShardRarity | 'all'>('all');
  const [pending, setPending] = useState<ShopRequest | null>(() => readShopRequest(sessionStorage, profile.id));
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const flight = useRef(false);
  const showcase = useRef<HTMLDivElement>(null);
  const mat = playerMatById(selection)!;
  const card = mat.characterId ? catalogCardById[mat.characterId] : undefined;
  const owned = ownsPlayerMat(profile, mat.id);
  const affordable = mat.source === 'shop' && card ? quoteStyleShards(profile, mat.rarity, mat.price).canAfford : true;
  const visible = PLAYER_MATS.filter(item => (rarity === 'all' || item.rarity === rarity) && (filter === 'all' || (filter === 'owned' ? ownsPlayerMat(profile,item.id) : item.source === filter)) && `${item.name} ${item.characterId ? catalogCardById[item.characterId].name : ''}`.toLowerCase().includes(search.toLowerCase().trim()));
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
      } else setNotice('Purchase not confirmed. Recover the same request below.');
    } finally {flight.current=false;setBusy(false);}
  }
  async function equip() {
    if (flight.current || pending) return;
    flight.current=true;setBusy(true);setNotice('');
    try {
      const result = await customFetch<PlayerBootstrap>('/api/player/cosmetics',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...profile.settings.cosmetics,playerMatId:mat.id})});
      await refresh(result);setNotice(`${mat.name} equipped.`);
    } catch(error) {setNotice(error instanceof ApiError ? (error.data as {error?:string})?.error ?? 'Could not equip. Try again.' : 'Could not equip. Try again.');}
    finally {flight.current=false;setBusy(false);}
  }
  function select(item: PlayerMat) {setSelection(item.id);setNotice('');showcase.current?.scrollIntoView({block:'start',behavior:profile.settings.reducedMotion?'instant':'smooth'});}
  return <main className="mat-studio" data-testid="player-mat-studio">
    <header className="mat-studio__heading"><div><span className="mat-eyebrow">THE STYLIST / PLAYER MATS</span><h1>HOME <em>TURF.</em></h1></div><Link href="/game/style">All styles ↗</Link></header>
    <div className="mat-showcase" ref={showcase}>
      <section className="mat-preview" aria-label={`Your ${mat.name} mat against ${playerMatById(rival)!.name}`}>
        <MatPairArtwork playerId={mat.id} rivalId={rival} eager/>
        <div className="mat-preview__rival"><span className="mat-eyebrow">RIVAL HALF / PREVIEW</span><label><span className="sr-only">Preview rival mat</span><select value={rival} onChange={e=>setRival(e.target.value)}>{PLAYER_MATS.map(m=><option key={m.id} value={m.id}>{m.characterId ? catalogCardById[m.characterId].name+' · ' : ''}{m.name}</option>)}</select></label></div>
        <div className="mat-preview__districts" aria-hidden="true"><i/><span>YOUR HALF. YOUR STYLE.</span><i/></div>
        <div className="mat-preview__yours"><span className="mat-eyebrow">YOUR HALF</span><strong>{card?.name ?? 'SQUABBLEMON'}</strong></div>
      </section>
      <aside className="mat-selection">
        <span className="mat-eyebrow">{mat.source==='default'?'ORIGINAL VENUES':mat.source==='story'?'EARNED IN STORY':'SIGNATURE SERIES / 01'}</span>
        <h2>{mat.name}</h2><p>{card?.name ?? 'Included for everyone'}</p><span className="mat-rarity" data-rarity={mat.rarity}>{STYLE_SHARD_TIERS[mat.rarity].label}</span>
        <p className="mat-selection__rule">Your half in PvP. Full mat in training.</p>
        {owned ? <div className="mat-selection__owned">{mat.source==='default'?'INCLUDED':'IN YOUR COLLECTION'}</div> : mat.source==='story' ? <div className="mat-story-lock"><span>STORY UNLOCK</span><strong>{mat.storyTitle}</strong><Link href="/game/story">Open story ↗</Link></div> : card && <StyleShardCost wallet={profile} rarity={mat.rarity} cost={mat.price}/>}
        {pending ? <><p className="mat-pending">Pending: {pending.itemId==='player-mat' ? catalogCardById[pending.cardId ?? '']?.name+' mat' : pending.itemId}. Recover before another purchase.</p><button className="mat-action" disabled={busy} onClick={()=>void purchase()}>Recover purchase</button></> : owned ? <button className="mat-action" disabled={busy || equipped===mat.id} onClick={()=>void equip()}>{equipped===mat.id?'Equipped':'Equip mat'}</button> : mat.source==='shop' ? <button className="mat-action" disabled={busy || !affordable} onClick={()=>void purchase()}>Unlock · {mat.price} shards</button> : null}
        <p role="status" aria-live="polite" className="mat-notice">{busy?'Saving…':notice}</p>
        <small>Preview any pairing. Your rival brings their equipped mat.</small>
      </aside>
    </div>
    <StyleShardWallet wallet={profile} cardRarity={mat.rarity}/>
    <section className="mat-library" aria-label="Player mat collection">
      <div className="mat-library__heading"><h2>THE COLLECTION <span>{ownCount}/{PLAYER_MATS.length}</span></h2><label><span className="sr-only">Find a player mat</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find your character"/></label><label><span className="sr-only">Mat rarity</span><select value={rarity} onChange={e=>setRarity(e.target.value as StyleShardRarity | 'all')}><option value="all">All rarities</option>{STYLE_SHARD_RARITIES.map(tier=><option key={tier} value={tier}>{STYLE_SHARD_TIERS[tier].label}</option>)}</select></label></div>
      <nav className="mat-filters" aria-label="Filter player mats">{(['all','owned','shop','story','default'] as const).map(value=><button key={value} aria-pressed={value===filter} onClick={()=>setFilter(value)}>{{all:'All',owned:'Owned',shop:'Style Shards',story:'Story',default:'Defaults'}[value]}</button>)}</nav>
      <div className="mat-grid">{visible.map(item=>{
        const isOwned=ownsPlayerMat(profile,item.id), character=item.characterId?catalogCardById[item.characterId]:undefined;
        return <button type="button" key={item.id} className="mat-card" data-testid={`mat-${item.id}`} aria-pressed={selection===item.id} onClick={()=>select(item)}>
          <div className="mat-card__art"><PlayerMatArtwork mat={item} thumbnail/><span>{equipped===item.id?'EQUIPPED':isOwned?'OWNED':item.source==='story'?'STORY':'SIGNATURE'}</span></div>
          <div className="mat-card__caption"><span>{character?.name ?? 'ORIGINAL VENUE'}</span><strong>{item.name}</strong><span className="mat-rarity" data-rarity={item.rarity}>{STYLE_SHARD_TIERS[item.rarity].label}</span><small>{isOwned?'Preview →':item.source==='story'?item.storyTitle:`${item.price} shards`}</small></div>
        </button>;
      })}</div>
      {!visible.length && <p role="status">No mats found. Try another character or filter.</p>}
    </section>
  </main>;
}
