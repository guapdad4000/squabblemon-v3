import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { SHOP_OFFERS, planShopPurchase, type ShopReceipt, type ShopRequest } from '@workspace/squabblemon-engine/economy';
import { isKumiteExclusiveCard } from '@workspace/squabblemon-engine/data';
import { cardCatalog, catalogCardById, getAssetUrl } from '../data';
import { clearShopRequest, readShopRequest, saveShopRequest } from '../lib/shopJournal';
import { shopPurchaseDestination } from '../lib/shopDestination';
import { revealProfileRewards } from '../lib/rewardReceipts';
import { e2eAuthEnabled } from '../lib/auth';
import { playInteractionSound } from '../lib/interactionAudio';
import { CollectibleCard } from './CollectibleCard';
import { StreetSelect } from './ui/street-select';
import { RewardFileAction } from './ui/game-popup';
import { GameGlyph } from './venue/GameGlyph';
import { ArrowRight, Check } from 'lucide-react';
import '../styles/neighborhood-recruit.css';

export function neighborhoodRecruitChoices(ownedCardIds: readonly string[]) {
  const owned = new Set(ownedCardIds);
  return cardCatalog.filter(card => card.rarity === 'Common' && !owned.has(card.catalogId) && !isKumiteExclusiveCard(card.catalogId));
}

/** A permanent, choose-your-character offer. Its existing shop receipt owns the unlock. */
export function NeighborhoodRecruit({ bootstrap, onBusyChange }: { bootstrap: PlayerBootstrap; onBusyChange?: (busy: boolean) => void }) {
  const { profile } = bootstrap;
  const client = useQueryClient();
  const [pending, setPending] = useState(() => readShopRequest(sessionStorage, profile.id));
  const [selected, setSelected] = useState(() => new URLSearchParams(location.search).get('card') ?? '');
  const [working, setWorking] = useState(false);
  const [receipt, setReceipt] = useState<ShopReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const ownedPending = pending?.itemId === 'common-recruit' ? pending : null;
  const foreign = pending && !ownedPending ? pending : null;
  useEffect(() => { onBusyChange?.(working || Boolean(ownedPending)); }, [working, ownedPending, onBusyChange]);
  const choices = neighborhoodRecruitChoices(profile.ownedCardIds);
  const cardId = ownedPending?.cardId ?? (choices.some(card => card.catalogId === selected) ? selected : choices[0]?.catalogId ?? '');
  const card = catalogCardById[cardId];
  const offer = SHOP_OFFERS.find(item => item.id === 'common-recruit')!;
  let quote: ReturnType<typeof planShopPurchase> | null = null;
  let unavailable: string | null = null;
  try { quote = planShopPurchase(profile, { itemId: 'common-recruit', cardId }); }
  catch (reason) { unavailable = choices.length ? (reason as Error).message : 'Every neighborhood Common is in your gang.'; }
  async function recruit() {
    if (lock.current || foreign || (!quote && !ownedPending)) return;
    const stored = readShopRequest(sessionStorage, profile.id);
    if (stored && stored.itemId !== 'common-recruit') { setPending(stored); return; }
    const request: ShopRequest = stored ?? { itemId: 'common-recruit', cardId, idempotencyKey: crypto.randomUUID() };
    lock.current = true; setWorking(true); setError(null); setReceipt(null);
    try {
      saveShopRequest(sessionStorage, profile.id, request); setPending(request);
      let result: { receipt: ShopReceipt; bootstrap: PlayerBootstrap };
      if (e2eAuthEnabled && profile.id === 'e2e-player') {
        const planned = planShopPurchase(profile, request);
        result = { receipt: planned.receipt, bootstrap: { ...bootstrap, profile: { ...profile, ...planned.wallet } } };
      } else result = await customFetch('/api/player/shop/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      if (result.bootstrap.profile.id !== profile.id) throw new Error('Purchase response belongs to a different account.');
      const key = getGetPlayerBootstrapQueryKey();
      const currentAccount = () => client.getQueryData<PlayerBootstrap>(key)?.profile.id;
      if (!mounted.current || (currentAccount() && currentAccount() !== profile.id)) return;
      await client.cancelQueries({ queryKey: key });
      if (!mounted.current || (currentAccount() && currentAccount() !== profile.id)) return;
      // If another counter owns a newer intent, reconcile from the server rather
      // than replacing its wallet with this earlier response.
      const storedNow = readShopRequest(sessionStorage, profile.id);
      if (storedNow && storedNow.idempotencyKey !== request.idempotencyKey) {
        setPending(storedNow); void client.invalidateQueries({ queryKey: key }); return;
      }
      client.setQueryData(key, result.bootstrap);
      revealProfileRewards(bootstrap, result.bootstrap, request.idempotencyKey, 'New recruit', 'shop');
      if (readShopRequest(sessionStorage, profile.id)?.idempotencyKey === request.idempotencyKey) clearShopRequest(sessionStorage, profile.id);
      playInteractionSound('register');
      if (mounted.current) { setPending(readShopRequest(sessionStorage, profile.id)); setReceipt(result.receipt); }
    } catch (reason) {
      if (!mounted.current || (client.getQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey())?.profile.id && client.getQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey())!.profile.id !== profile.id)) return;
      if (reason instanceof ApiError && [400, 409].includes(reason.status)) {
        if (readShopRequest(sessionStorage, profile.id)?.idempotencyKey === request.idempotencyKey) clearShopRequest(sessionStorage, profile.id);
        setPending(readShopRequest(sessionStorage, profile.id));
        void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      }
      if (mounted.current) setError(reason instanceof ApiError && [400, 409].includes(reason.status)
        ? (reason.data as { error?: string } | undefined)?.error ?? reason.message
        : 'Not confirmed. Recover this recruit with the same purchase.');
    } finally { lock.current = false; if (mounted.current) setWorking(false); }
  }
  return <section className="pull-feature__composition neighborhood-recruit" aria-labelledby="neighborhood-recruit-title">
    <img className="pull-feature__poster-art" src={getAssetUrl('assets/gacha-banners/standard-v1.webp')} alt="" aria-hidden="true" />
    <header className="pull-feature__billing">
      <p className="pull-feature__edition">PERMANENT · CHOOSE YOUR COMMON</p>
      <h2 className="pull-feature__title" id="neighborhood-recruit-title">NEIGHBORHOOD RECRUIT</h2>
    </header>
    <div className="neighborhood-recruit__print">
      {card ? <CollectibleCard key={cardId} card={card} fillContainer presentationOnly inspectable disableLayout />
        : <img src={getAssetUrl('assets/training/inmate-recruit-icon.webp')} alt="" />}
    </div>
    <div className="pull-feature__offer neighborhood-recruit__offer">
      <label htmlFor="neighborhood-character">Your next homie</label>
      <StreetSelect skin="paper" id="neighborhood-character" value={cardId} disabled={working || Boolean(pending) || !choices.length} onValueChange={value => { setSelected(value); setError(null); setReceipt(null); }}>
        {ownedPending && card && !choices.some(item => item.catalogId === cardId) && <option value={cardId}>{card.name}</option>}
        {!choices.length && !ownedPending && <option value="">All neighborhood Commons owned</option>}
        {choices.map(item => <option key={item.catalogId} value={item.catalogId}>{item.name}</option>)}
      </StreetSelect>
      <p className="neighborhood-recruit__guarantee">One guaranteed character · Your choice</p>
      {foreign ? <Link className="neighborhood-recruit__recover" href={shopPurchaseDestination(foreign)}>Finish pending purchase <ArrowRight size={16}/></Link>
        : <RewardFileAction className="neighborhood-recruit__buy" disabled={working || (!quote && !ownedPending)} onClick={() => void recruit()}>
          <GameGlyph name="clout"/>{working ? 'Confirming…' : ownedPending ? 'Recover recruit' : `Recruit · ${offer.price} Clout`}<ArrowRight size={18}/>
        </RewardFileAction>}
      {error && <p className="neighborhood-recruit__notice" role="alert">{error}</p>}
      {!error && unavailable && !ownedPending && !foreign && <p className="neighborhood-recruit__notice" role="status">{unavailable}</p>}
      {receipt && <p className="neighborhood-recruit__receipt" role="status"><Check size={16}/>{receipt.summary}</p>}
    </div>
  </section>;
}
