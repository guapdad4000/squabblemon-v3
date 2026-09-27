import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { REACTIONS, REACTION_PACKS, ownedReactions } from '@workspace/squabblemon-engine/reactions';
import { type ShopRequest } from '@workspace/squabblemon-engine/economy';
import { clearShopRequest, readShopRequest, saveShopRequest } from '../lib/shopJournal';
import { ReactionArt } from './ReactionArt';
import '../styles/battle-reactions.css';


export function ReactionShop({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap;
  const client = useQueryClient();
  const reduced = useReducedMotion();
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { if (!preview) return; const timer = window.setTimeout(() => setPreview(null), 4000); return () => clearTimeout(timer); }, [preview]);
  const [pending, setPending] = useState<ShopRequest | null>(() => readShopRequest(sessionStorage, profile.id));
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [message, setMessage] = useState('');
  const owned = ownedReactions(profile.unlockedCosmeticIds);

  const otherPending = pending && !REACTION_PACKS.some(pack => pack.id === pending.itemId);
  async function buy(pack: typeof REACTION_PACKS[number]) {
    if (inFlight.current || otherPending || (profile.unlockedCosmeticIds.includes(pack.unlock) && !pending)) return;
    inFlight.current = true; setBusy(true); setMessage('');
    try {
      const request = pending ?? { itemId: pack.id, idempotencyKey: crypto.randomUUID() };
      saveShopRequest(sessionStorage, profile.id, request); setPending(request);
      const result = await customFetch<{ bootstrap: PlayerBootstrap }>('/api/player/shop/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      client.setQueryData(getGetPlayerBootstrapQueryKey(), result.bootstrap);
      void client.invalidateQueries({ queryKey: ['battle-reactions'] });
      clearShopRequest(sessionStorage, profile.id); setPending(null);
      setMessage(pack.name + ' unlocked! Your new reactions are ready in PvP.');
    } catch (error) {
      if (error instanceof ApiError && [400, 409].includes(error.status)) {
        clearShopRequest(sessionStorage, profile.id); setPending(null);
        setMessage((error.data as { error?: string })?.error ?? 'This pack could not be purchased.');
        void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      } else setMessage('Purchase not confirmed. Retry to recover the same purchase without paying twice.');
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="reaction-shop" aria-labelledby="reaction-shop-title">
    <header><small>COLLECT YOUR COMEBACKS</small><h1 id="reaction-shop-title">Block Talk</h1><p>Animated reactions for your next PvP fade. Open the speech bubble in battle to send one.</p><span>{owned.length} / {REACTIONS.length} collected · {profile.softCurrency.toLocaleString()} Clout</span></header>
    <div className="reaction-shop-grid">{REACTIONS.filter(reaction => reaction.starter).map(reaction => <article key={reaction.id}>
      <button type="button" aria-label={`Preview ${reaction.name}`} onClick={() => setPreview(preview === reaction.id ? null : reaction.id)}><ReactionArt id={reaction.id} still={!!reduced || profile.settings.reducedMotion || preview !== reaction.id} /></button>
      <h2>{reaction.name}</h2><span>Starter · Yours free</span>
    </article>)}</div>
    {REACTION_PACKS.map(pack => {
      const hasPack = profile.unlockedCosmeticIds.includes(pack.unlock);
      const recovering = pending?.itemId === pack.id;
      return <section className="reaction-shop-pack" key={pack.id} aria-label={pack.name}>
        <div className="reaction-shop-offer"><div><small>PERMANENT REACTION COLLECTION</small><h2>{pack.name}</h2><p>{pack.reactionIds.length} animated reactions · Cosmetic only</p></div>
        <button type="button" onClick={() => void buy(pack)} disabled={busy || (!!pending && !recovering) || (!recovering && (hasPack || profile.softCurrency < pack.price))}>{busy && recovering ? 'Confirming…' : recovering ? 'Recover purchase' : hasPack ? 'Collected' : `Unlock ${pack.name} · ${pack.price} Clout`}</button></div>
        <div className="reaction-shop-grid">{REACTIONS.filter(reaction => reaction.packId === pack.id).map(reaction => <article key={reaction.id}>
          <button type="button" aria-label={`Preview ${reaction.name}`} aria-pressed={preview === reaction.id} onClick={() => setPreview(preview === reaction.id ? null : reaction.id)}><ReactionArt id={reaction.id} still={!!reduced || profile.settings.reducedMotion || preview !== reaction.id} /></button>
          <h2>{reaction.name}</h2><span>{hasPack ? 'Owned' : 'Pack unlock'}</span>
        </article>)}</div>
      </section>;
    })}
    {otherPending && <p>Another purchase needs confirmation. <Link href="/game/shop?view=training">Recover it in Training</Link> first.</p>}
    <p role="status">{message}</p>
  </section>;
}
