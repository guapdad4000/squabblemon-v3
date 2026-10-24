import { useEffect, useRef, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { SHOP_OFFERS, planShopPurchase, type ShopReceipt, type ShopRequest } from '@workspace/squabblemon-engine/economy';
import { STYLE_SHARD_TIERS, styleShardRarityForCard } from '@workspace/squabblemon-engine/styleShards';
import { CollectibleCard } from './CollectibleCard';
import { StyleShardCost, StyleShardWallet } from './StyleShardWallet';
import { StreetSelect } from './ui/street-select';
import { CARD_RARITY_DEFINITIONS } from '../data';
import { readShopRequest } from '../lib/shopJournal';
import { shopPurchaseDestination } from '../lib/shopDestination';
import { FINISH_OFFERS, clearConfirmedFinishRequest, finishCounterSelection, isFinishOfferId, reserveFinishPurchase } from '../lib/finishCounter';
import { e2eAuthEnabled } from '../lib/auth';
import { playInteractionSound } from '../lib/interactionAudio';
import '../styles/finish-counter.css';

export function FinishCounter({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap, client = useQueryClient(), search = useSearch();
  const params = new URLSearchParams(search);
  const [selection, setSelection] = useState<{ search: string; item: string; card: string } | null>(null);
  const [pending, setPending] = useState<ShopRequest | null>(() => readShopRequest(sessionStorage, profile.id));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ShopReceipt | null>(null);
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choice = selection?.search === search ? selection : { item: params.get('item'), card: params.get('card') };
  const { offer, choices, cardId, card, variant, owned, quote, unavailable, cost } = finishCounterSelection(profile, choice.item, choice.card, pending);
  const foreignPending = pending && !isFinishOfferId(pending.itemId) ? pending : null;
  const preview = e2eAuthEnabled && profile.id === 'e2e-player';
  const paidRarity = receipt?.shardPayment?.rarity;
  const paidShardLabel = paidRarity ? STYLE_SHARD_TIERS[paidRarity as keyof typeof STYLE_SHARD_TIERS]?.label ?? paidRarity : '';
  const collectionHref = `/game/collection?card=${encodeURIComponent(cardId)}${variant ? '&variant=' + encodeURIComponent(variant.id) : ''}`;
  function select(item: string, nextCard = cardId) {
    setSelection({ search, item, card: nextCard }); setReceipt(null); setError('');
  }
  async function buy() {
    if (lock.current || foreignPending || (!quote && !pending)) return;
    lock.current = true; setBusy(true); setError(''); setReceipt(null);
    let request: ShopRequest | undefined;
    try {
      // Re-read shared storage: another shop surface may have left a request since this view mounted.
      request = reserveFinishPurchase(sessionStorage, profile.id, profile, { itemId: isFinishOfferId(offer.id) ? offer.id : 'tagged-style', cardId }, () => crypto.randomUUID());
      setPending(request);
      if (!isFinishOfferId(request.itemId)) return;
      const result = preview ? (() => {
        const planned = planShopPurchase(profile, request!);
        return { receipt: planned.receipt, bootstrap: { ...bootstrap, profile: { ...profile, ...planned.wallet } } };
      })() : await customFetch<{ receipt: ShopReceipt; bootstrap: PlayerBootstrap }>('/api/player/shop/purchases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
      });
      // A route/account change leaves the journal recoverable instead of applying a stale account response.
      if (!mounted.current) return;
      const key = getGetPlayerBootstrapQueryKey();
      if (client.getQueryData<PlayerBootstrap>(key)?.profile.id && client.getQueryData<PlayerBootstrap>(key)!.profile.id !== profile.id) return;
      await client.cancelQueries({ queryKey: key });
      if (!mounted.current || (client.getQueryData<PlayerBootstrap>(key)?.profile.id && client.getQueryData<PlayerBootstrap>(key)!.profile.id !== profile.id)) return;
      client.setQueryData(key, result.bootstrap);
      clearConfirmedFinishRequest(sessionStorage, profile.id, request);
      setPending(readShopRequest(sessionStorage, profile.id));
      setSelection({ search, item: request.itemId, card: request.cardId ?? '' });
      setReceipt(result.receipt); playInteractionSound('register');
    } catch (reason) {
      if (!mounted.current) return;
      if (reason instanceof ApiError && [400, 409].includes(reason.status)) {
        if (request) clearConfirmedFinishRequest(sessionStorage, profile.id, request);
        setPending(readShopRequest(sessionStorage, profile.id));
        setError((reason.data as { error?: string })?.error ?? reason.message);
        void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      } else if (!request) setError(reason instanceof Error ? reason.message : 'Could not save the purchase reference. No purchase was sent.');
      else if (reason instanceof ApiError && reason.status === 401) setError('Sign back in, then recover this purchase. Your original request is kept.');
      else setError('Purchase not confirmed. Recover the same purchase to check it without paying twice.');
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="finish-counter" aria-labelledby="finish-counter-title" data-testid="finish-counter">
    <header className="finish-counter__heading"><div><p className="style-kicker">THE FINISH COUNTER</p><h2 id="finish-counter-title">Card finishes</h2><p>A new look for your character. Same abilities and strength.</p></div></header>
    <StyleShardWallet wallet={profile} cardRarity={card?.rarity}/>
    {preview && <p className="style-notice">Local preview · Purchases stay in this preview.</p>}
    {foreignPending && <div className="finish-counter__recovery" role="status"><p>Your {SHOP_OFFERS.find(item => item.id === foreignPending.itemId)?.name ?? 'shop'} purchase still needs confirmation.</p><Link className="style-button" href={shopPurchaseDestination(foreignPending)}>Recover that purchase →</Link></div>}
    <div className="finish-counter__layout">
      <div className="finish-counter__preview">
        {card && variant ? <><div className="finish-counter__card"><CollectibleCard card={card} variantId={variant.id} isInspector fillContainer presentationOnly disableLayout/></div><span>{owned ? 'IN YOUR COLLECTION' : 'FINISH PREVIEW'}</span><Link className="style-link" href={collectionHref}>Inspect {card.name} →</Link></> : <p>Choose an owned character to preview a finish.</p>}
      </div>
      <div className="finish-counter__checkout">
        <nav className="finish-counter__offers" aria-label="Card finish">{FINISH_OFFERS.map(item => <button type="button" key={item.id} disabled={busy || !!pending} aria-pressed={offer.id === item.id} onClick={() => select(item.id)}><strong>{item.name}</strong><span>{item.id === 'tagged-style' ? 'Gold-stamped lacquer' : 'Mirror-cut chrome'}</span></button>)}</nav>
        <label htmlFor="finish-card">Choose your character</label>
        <StreetSelect id="finish-card" skin="paper" value={cardId} disabled={busy || !!pending || !choices.length} onValueChange={next => select(offer.id, next)}>{choices.length ? choices.map(item => <option key={item.catalogId} value={item.catalogId}>{item.name} · {CARD_RARITY_DEFINITIONS[item.rarity].label}</option>) : <option value="">No owned characters</option>}</StreetSelect>
        <h3>{card ? `${card.name} · ${offer.name}` : offer.name}</h3>
        <p>{offer.description} Permanent cosmetic; equip it in Collection.</p>
        {card && !owned && <StyleShardCost wallet={profile} rarity={card.rarity} cost={cost}/>}
        {pending && !foreignPending ? <><p role="status">This exact finish and character are reserved until the purchase is confirmed.</p><button type="button" className="style-button style-button--primary" disabled={busy} onClick={() => void buy()}>{busy ? 'Checking purchase…' : 'Recover purchase'}</button></> : owned ? <><p className="finish-counter__owned">Already unlocked</p><Link className="style-button style-button--primary" href={collectionHref}>View & equip in Collection →</Link></> : <button type="button" className="style-button style-button--primary" disabled={busy || !!foreignPending || !quote} onClick={() => void buy()}>{busy ? 'Unlocking…' : `Unlock ${offer.name} · ${cost} ${card ? STYLE_SHARD_TIERS[styleShardRarityForCard(card.rarity)].label + ' ' : ''}shards`}</button>}
        {!choices.length ? <Link className="style-link" href="/game/shop?view=packs">Find your first character →</Link> : !owned && !pending && unavailable && <p className="finish-counter__unavailable">{unavailable}</p>}
        {receipt && <div className="finish-counter__receipt" role="status"><strong>{receipt.summary}</strong>{receipt.shardPayment && <span>Paid {receipt.shardPayment.matching} {paidShardLabel}{receipt.shardPayment.universal ? ` + ${receipt.shardPayment.universal} Universal` : ''} shards.</span>}</div>}
        {error && <p className="finish-counter__error" role="alert">{error}</p>}
      </div>
    </div>
  </section>;
}
