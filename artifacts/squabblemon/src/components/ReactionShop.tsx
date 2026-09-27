import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { REACTIONS, REACTION_PACKS, ownedReactions, type ReactionId } from '@workspace/squabblemon-engine/reactions';
import { type ShopRequest } from '@workspace/squabblemon-engine/economy';
import { clearShopRequest, readShopRequest, saveShopRequest } from '../lib/shopJournal';
import { getAssetUrl } from '../lib/assets';
import { ReactionArt } from './ReactionArt';
import '../styles/battle-reactions.css';
import '../styles/reaction-shop.css';


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
  const [justBought, setJustBought] = useState<string | null>(null);
  const owned = ownedReactions(profile.unlockedCosmeticIds);
  const motionOff = !!reduced || profile.settings.reducedMotion;

  function stickerTray(ids: readonly ReactionId[], isOwned: boolean, starter = false) {
    return <div className={`reaction-shop__tray${starter ? ' reaction-shop__tray--starter' : ''}`} aria-label={starter ? 'Starter stickers' : 'Complete pack sticker sheet'}>
      {ids.map(id => {
        const reaction = REACTIONS.find(item => item.id === id)!;
        const active = preview === id;
        return <div className="reaction-shop__sticker" key={id}>
          <button type="button" data-testid={`button-preview-reaction-${id}`} aria-label={`${active ? 'Stop previewing' : 'Preview'} ${reaction.name}`} aria-pressed={active}
            onClick={() => setPreview(active ? null : id)}>
            <ReactionArt id={id} still={motionOff || !active} />
          </button>
          <div className="reaction-shop__sticker-name" data-testid={`text-reaction-${id}`}>
            {reaction.name.split(' — ').at(-1)}
            <small>{active ? (motionOff ? 'Still preview · motion off' : 'Playing preview') : isOwned ? 'YOURS · TAP TO PREVIEW' : 'TAP TO PREVIEW'}</small>
          </div>
        </div>;
      })}
    </div>;
  }

  const otherPending = pending && !REACTION_PACKS.some(pack => pack.id === pending.itemId);
  async function buy(pack: typeof REACTION_PACKS[number]) {
    if (inFlight.current || otherPending || (profile.unlockedCosmeticIds.includes(pack.unlock) && !pending)) return;
    inFlight.current = true; setBusy(true); setMessage(''); setJustBought(null);
    try {
      const request = pending ?? { itemId: pack.id, idempotencyKey: crypto.randomUUID() };
      saveShopRequest(sessionStorage, profile.id, request); setPending(request);
      const result = await customFetch<{ bootstrap: PlayerBootstrap }>('/api/player/shop/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      client.setQueryData(getGetPlayerBootstrapQueryKey(), result.bootstrap);
      void client.invalidateQueries({ queryKey: ['battle-reactions'] });
      clearShopRequest(sessionStorage, profile.id); setPending(null);
      setJustBought(pack.id);
      setMessage(pack.name + ' unlocked and added to your collection. Pick which ones ride in your battle tray on your Fighter ID.');
    } catch (error) {
      if (error instanceof ApiError && [400, 409].includes(error.status)) {
        clearShopRequest(sessionStorage, profile.id); setPending(null);
        setMessage((error.data as { error?: string })?.error ?? 'This pack could not be purchased.');
        void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      } else setMessage('Purchase not confirmed. Retry to recover the same purchase without paying twice.');
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="reaction-shop" aria-labelledby="reaction-shop-title">
    <header className="reaction-shop__masthead">
      <div><small>FADE MARKET / REACTIONS SHELF</small><h2 id="reaction-shop-title">Block Talk.</h2><p>Pick a sticker. Bring the attitude to your next PvP fade.</p></div>
      <div className="reaction-shop__count" data-testid="text-reaction-collection"><strong>{owned.length} / {REACTIONS.length}</strong>STICKERS COLLECTED</div>
    </header>
    <div className="reaction-shop__chapter reaction-shop__chapter--first"><h3>On the house</h3><small>TWO STARTERS · ALWAYS YOURS</small></div>
    <div className="reaction-shop__shelf" data-owned="true" data-testid="shelf-reaction-starters">
      <div className="reaction-shop__ticket">
        <img className="reaction-shop__ticket-mark" src={getAssetUrl('assets/market/fade-market-ascii-logo.svg')} alt="" />
        <div className="reaction-shop__ticket-top"><span>FADE MARKET</span><span>SHELF / 00</span></div>
        <span className="reaction-shop__ticket-type">YOUR FIRST TWO · PvP REACTIONS</span>
        <h4>Starter stickers</h4>
        <p>Already in your pocket. Tap the art to preview; send them from the speech bubble during a battle.</p>
        <div className="reaction-shop__ticket-bottom"><span className="reaction-shop__ticket-state">COLLECTED · NO CLOUT NEEDED</span><span className="reaction-shop__price">Free</span></div>
        <span className="reaction-shop__barcode" aria-hidden="true" />
      </div>
      {stickerTray(REACTIONS.filter(reaction => reaction.starter).map(reaction => reaction.id), true, true)}
    </div>
    <div className="reaction-shop__chapter"><h3>The rest of the wall</h3><small>{REACTION_PACKS.length} PACKS · ALL STICKERS ON DISPLAY</small></div>
    <div className="reaction-shop__wall">{REACTION_PACKS.map((pack, index) => {
      const hasPack = profile.unlockedCosmeticIds.includes(pack.unlock);
      const recovering = pending?.itemId === pack.id;
      const canAfford = profile.softCurrency >= pack.price;
      const blockedByPending = !!pending && !recovering;
      return <section className="reaction-shop__shelf" data-owned={hasPack} data-testid={`shelf-reaction-${pack.id}`} key={pack.id} aria-label={`${pack.name}, ${pack.reactionIds.length} stickers`}>
        <div className="reaction-shop__ticket">
          <img className="reaction-shop__ticket-mark" src={getAssetUrl('assets/market/fade-market-ascii-logo.svg')} alt="" />
          <div className="reaction-shop__ticket-top"><span>FADE MARKET</span><span>SHELF / {String(index + 1).padStart(2, '0')}</span></div>
          <span className="reaction-shop__ticket-type">{index === 0 ? 'ORIGINAL BLOCK TALK' : 'CHARACTER REACTION PACK'} · PvP ONLY</span>
          <h4>{pack.name}</h4>
          <p>{pack.reactionIds.length} reactions. Every sticker shown here is in the pack. Yours to keep once unlocked.</p>
          <div className="reaction-shop__ticket-bottom">
            <span className="reaction-shop__ticket-state" data-state={!hasPack && !canAfford && !recovering ? 'unavailable' : 'available'}>
              {recovering ? 'PURCHASE NEEDS CONFIRMATION' : hasPack ? 'COLLECTED · EQUIP IN FIGHTER ID' : blockedByPending ? 'FINISH PENDING PURCHASE FIRST' : canAfford ? 'AVAILABLE NOW · PERMANENT UNLOCK' : 'NOT ENOUGH CLOUT YET'}
            </span>
            <span className="reaction-shop__price" data-testid={`text-reaction-price-${pack.id}`}><img src={getAssetUrl('assets/rewards/clout-token.webp')} alt="" />{pack.price}<small>CLOUT</small></span>
            <button className="reaction-shop__buy" type="button" data-testid={`button-buy-reaction-${pack.id}`}
              onClick={() => void buy(pack)} disabled={busy || blockedByPending || (!recovering && (hasPack || !canAfford))}>
              {busy && recovering ? 'Confirming…' : recovering ? 'Recover purchase · no double charge' : hasPack ? 'Already collected' : !canAfford ? `Need ${(pack.price - profile.softCurrency).toLocaleString()} more Clout` : `Pick up pack · ${pack.price} Clout`}
            </button>
            {hasPack && <Link className="reaction-shop__equip" data-testid={`link-equip-reaction-${pack.id}`} href="/game/settings#reactions">{justBought === pack.id ? 'Equip new reactions →' : 'Set battle tray →'}</Link>}
          </div>
          <span className="reaction-shop__barcode" aria-hidden="true" />
        </div>
        {stickerTray(pack.reactionIds, hasPack)}
      </section>;
    })}</div>
    {otherPending && <p className="reaction-shop__message">Another purchase needs confirmation. <Link data-testid="link-recover-training-purchase" href="/game/shop?view=training">Recover it in Training</Link> first.</p>}
    <p className="reaction-shop__message" role="status" data-testid="status-reaction-purchase">{message}</p>
  </section>;
}
