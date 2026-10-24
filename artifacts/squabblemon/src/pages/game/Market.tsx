import { playInteractionSound } from '../../lib/interactionAudio';
import { StreetSelect } from '../../components/ui/street-select';
import { revealProfileRewards } from '../../lib/rewardReceipts';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  customFetch,
  ApiError,
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from '@workspace/api-client-react';
import {
  SHOP_OFFERS,
  MOVE_TRAINING_COSTS,
  planShopPurchase,
  type ShopItemId,
  type ShopReceipt,
  type ShopRequest,
} from '@workspace/squabblemon-engine/economy';
import { normalizeCardProgress, cardProgressDetails } from '@workspace/squabblemon-engine/cardProgression';
import { cardCatalog, catalogCardById, getCardImage, getAssetUrl, CARD_RARITY_DEFINITIONS } from '../../data';
import { ArrowRight, Check } from 'lucide-react';
import '../../styles/studio.css';
import { LayeredVenue } from '../../components/venue/LayeredVenue';
import { clearShopRequest, readShopRequest, saveShopRequest } from '../../lib/shopJournal';
import { shopPurchaseDestination } from '../../lib/shopDestination';
import { e2eAuthEnabled } from '../../lib/auth';
import { loadFeedbackPreferences } from '../../battleFeedback';
import { playVoiceLine } from '../../lib/sfx';
import { useEventVoice } from '../../lib/useEventVoice';
import '../../styles/training-studio.css';

const trainingNames: Partial<Record<ShopItemId, string>> = {
  training: 'Quick Training',
  'training-intensive': 'Intensive Training',
  'move-training': 'Move Training',
};

const TRAINING_IDS = ['training', 'training-intensive', 'move-training'] as const;
const isTraining = (id: ShopItemId) => (TRAINING_IDS as readonly string[]).includes(id);
const trainingOffers = SHOP_OFFERS.filter(item => isTraining(item.id));
const categoryArt: Partial<Record<ShopItemId, string>> = {
  training: 'assets/training/inmate-quick-poster.webp',
  'training-intensive': 'assets/training/inmate-intensive-poster.webp',
  'move-training': 'assets/training/inmate-moves-poster.webp',
};

export function Market({ bootstrap }: { bootstrap: PlayerBootstrap; openPacks?: () => void }) {
  useEventVoice('training-welcome');
  const { profile } = bootstrap;
  const client = useQueryClient();
  const [selectedId, select] = useState<ShopItemId>(() => {
    const requested = new URLSearchParams(location.search).get('item');
    return trainingOffers.find(item => item.id === requested)?.id ?? 'training';
  });
  const [cardId, setCardId] = useState(
    () => new URLSearchParams(location.search).get('card') ?? profile.ownedCardIds[0] ?? '',
  );
  const [pending, setPending] = useState<ShopRequest | null>(() => readShopRequest(sessionStorage, profile.id));
  const [working, setWorking] = useState(false);
  const [receipt, setReceipt] = useState<ShopReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ move: boolean; character: string; reducedMotion: boolean } | null>(null);
  const lock = useRef(false);
  const lifetime = useRef({ active: false, playerId: profile.id });
  useLayoutEffect(() => {
    const previous = lifetime.current;
    const current = { active: true, playerId: profile.id };
    lifetime.current = current;
    if (previous.playerId !== profile.id) {
      lock.current = false;
      setPending(readShopRequest(sessionStorage, profile.id));
      setWorking(false); setSession(null); setReceipt(null); setError(null);
    }
    return () => { current.active = false; };
  }, [profile.id]);
  function isCurrentPurchase(owner: typeof lifetime.current) {
    const cachedPlayer = client.getQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey())?.profile.id;
    return owner.active && lifetime.current === owner && (!cachedPlayer || cachedPlayer === owner.playerId);
  }
  useEffect(() => {
    for (const mode of ['quick', 'moves']) {
      const image = new Image();
      image.src = getAssetUrl(`assets/training/inmate-${mode}-sheet.webp`);
    }
  }, []);
  const trainingPending = pending && isTraining(pending.itemId) ? pending : null;
  const foreignPending = pending && !isTraining(pending.itemId) ? pending : null;
  const offer = trainingOffers.find(item => item.id === (trainingPending?.itemId ?? selectedId))!;
  const choices = cardCatalog.filter(card => profile.ownedCardIds.includes(card.id));
  const selectedCardId = trainingPending?.cardId ?? (choices.some(card => card.id === cardId) ? cardId : (choices[0]?.id ?? ''));
  const recoveryHref = foreignPending ? shopPurchaseDestination(foreignPending) : '';
  const card = catalogCardById[selectedCardId];
  const progress = normalizeCardProgress(profile.cardProgression[selectedCardId]);
  const details = cardProgressDetails(progress);
  const nextMove = card?.abilityUpgrades[progress.moveTier ?? 0];
  const input = {
    itemId: offer.id,
    ...(offer.needsCard ? { cardId: selectedCardId } : {}),
  };
  let quote: ReturnType<typeof planShopPurchase> | null = null;
  let unavailable: string | null = null;
  try {
    quote = planShopPurchase(profile, input);
  } catch (reason) {
    unavailable = (reason as Error).message;
  }
  const cost =
    quote?.receipt.cost ??
    (offer.id === 'move-training' ? (MOVE_TRAINING_COSTS[progress.moveTier ?? 0] ?? 0) : offer.price);
  const quotedProgress = quote ? normalizeCardProgress(quote.wallet.cardProgression[selectedCardId]) : null;
  const xpGain = quotedProgress ? quotedProgress.xp - progress.xp : 0;
  const preview = e2eAuthEnabled && profile.id === 'e2e-player';

  async function buy() {
    const owner = lifetime.current;
    if (lock.current || !isCurrentPurchase(owner)) return;
    // A purchase left by another counter after mount remains its original intent.
    const currentPending = readShopRequest(sessionStorage, profile.id);
    setPending(currentPending);
    if ((currentPending && !isTraining(currentPending.itemId)) || (!quote && !currentPending)) return;
    lock.current = true;
    setWorking(true);
    setError(null);
    setReceipt(null);
    const startedAt = performance.now();
    const reducedMotion = profile.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let request: ShopRequest | undefined;
    const clearMatchingRequest = () => {
      if (request && readShopRequest(sessionStorage, owner.playerId)?.idempotencyKey === request.idempotencyKey) {
        clearShopRequest(sessionStorage, owner.playerId);
      }
    };
    try {
      request = currentPending ?? {
        ...input,
        idempotencyKey: crypto.randomUUID(),
      };
      saveShopRequest(sessionStorage, profile.id, request);
      setPending(request);
      const training = isTraining(request.itemId);
      const purchasedCard = request.cardId ? catalogCardById[request.cardId] : undefined;
      if (training) setSession({ move: request.itemId === 'move-training', character: purchasedCard?.name ?? 'Your character', reducedMotion });
      let result: { receipt: ShopReceipt; bootstrap: PlayerBootstrap };
      if (preview) {
        const planned = planShopPurchase(profile, request);
        result = {
          receipt: planned.receipt,
          bootstrap: {
            ...bootstrap,
            profile: { ...profile, ...planned.wallet },
          },
        };
      } else
        result = await customFetch('/api/player/shop/purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
      // Leaving this account/view retains the exact journal request for recovery.
      if (!isCurrentPurchase(owner)) return;
      // The request starts immediately; a confirmed rep gets a short visual payoff.
      // Errors bypass the presentation delay and retries keep the original request key.
      if (training && !reducedMotion) {
        const remaining = Math.max(0, 2400 - (performance.now() - startedAt));
        if (remaining) await new Promise(resolve => window.setTimeout(resolve, remaining));
      }
      if (!isCurrentPurchase(owner)) return;
      if (result.bootstrap.profile.id !== owner.playerId) throw new Error('Purchase response belongs to a different account.');
      const bootstrapKey = getGetPlayerBootstrapQueryKey();
      await client.cancelQueries({ queryKey: bootstrapKey });
      if (!isCurrentPurchase(owner)) return;
      const latestRequest = readShopRequest(sessionStorage, owner.playerId);
      if (latestRequest && latestRequest.idempotencyKey !== request.idempotencyKey) {
        setPending(latestRequest);
        void client.invalidateQueries({ queryKey: bootstrapKey });
        return;
      }
      client.setQueryData(bootstrapKey, result.bootstrap);
      const purchaseTake = request.idempotencyKey.charCodeAt(0) % 2 ? 'purchase-a' : 'purchase-b';
      playVoiceLine(purchaseTake, loadFeedbackPreferences().audioEnabled);
      revealProfileRewards(bootstrap, result.bootstrap, request.idempotencyKey, 'Added to your bag', undefined);
      clearMatchingRequest();
      setPending(readShopRequest(sessionStorage, owner.playerId));
      setReceipt(result.receipt);
      playInteractionSound('register');
    } catch (reason) {
      if (!isCurrentPurchase(owner)) return;
      if (reason instanceof ApiError && [400, 409].includes(reason.status)) {
        clearMatchingRequest();
        setPending(readShopRequest(sessionStorage, owner.playerId));
        const data = reason.data as { error?: string } | undefined;
        setError(data?.error ?? reason.message);
        void client.invalidateQueries({
          queryKey: getGetPlayerBootstrapQueryKey(),
        });
      } else if (reason instanceof ApiError && reason.status === 401)
        setError('Sign back in, then recover this purchase. Your original request is kept so it cannot charge twice.');
      else setError('Purchase not confirmed. Retry this same purchase to recover it without paying twice.');
    } finally {
      if (isCurrentPurchase(owner)) {
        lock.current = false;
        setWorking(false);
        setSession(null);
      }
    }
  }

  return (
    <div className="studio-page market training-studio world-decor-host">
      <div className="training-studio__venue" aria-hidden="true"><LayeredVenue scene="training-club" /></div>
      <header className="training-club__heading">
        <div><span className="training-club__label">DR. FADE'S</span><h1>Training Club</h1></div>
        <img className="training-club__coach" src={getAssetUrl('assets/training/dr-fade-coach.webp')} alt="Dr. Fade" draggable={false} />
        <div className="training-club__wallet" aria-label={`${profile.softCurrency.toLocaleString()} Clout available`}>
          <GameGlyph name="cloutBag" /><span><strong>{profile.softCurrency.toLocaleString()}</strong><small>Clout</small></span>
        </div>
      </header>
      <nav className="training-club__passes" aria-label="Training sessions">
        {trainingOffers.map((item, index) => <button key={item.id} data-training-offer={item.id}
          disabled={!!pending || working} aria-pressed={offer.id === item.id}
          onClick={() => { select(item.id); setReceipt(null); setError(null); }}>
          <span className="training-club__pass-number" aria-hidden="true">0{index + 1}</span>
          <img src={getAssetUrl(categoryArt[item.id]!)} alt="" draggable={false} />
          <span className="training-club__pass-copy"><strong>{trainingNames[item.id]}</strong>
            <span>{item.id === 'move-training' ? 'Next move tier' : item.id === 'training' ? 'Up to +100 XP' : 'Up to +250 XP'}</span>
            <small>{item.id === 'move-training' ? `${MOVE_TRAINING_COSTS[0]}–${MOVE_TRAINING_COSTS.at(-1)}` : item.price} Clout</small>
          </span>
          <span className="training-club__pass-stamp" aria-hidden="true">{offer.id === item.id ? <><Check size={13} /> Selected</> : 'Session pass'}</span>
        </button>)}
      </nav>
      <div className="training-club__counter">
        <figure className="training-club__fighter">
          {card && <img key={card.id} src={getCardImage(card.id)} alt={card.name} draggable={false} />}
          <figcaption><span className="training-club__label">IN YOUR CORNER</span>
            <h2>{card?.name ?? 'Choose a fighter'}</h2>
            {card && <span>{CARD_RARITY_DEFINITIONS[card.rarity].label} · Level {progress.level}</span>}
          </figcaption>
        </figure>
        <section className="training-club__ticket" aria-labelledby="purchase-title" aria-busy={working}>
          <div className="training-club__ticket-heading"><span className="training-club__label">COACHING TICKET</span><h2 id="purchase-title">{trainingNames[offer.id]}</h2></div>
          <label className="training-club__label" htmlFor="shop-card">Your fighter</label>
          <StreetSelect skin="paper" id="shop-card" value={selectedCardId} disabled={!!pending || working}
            onValueChange={value => { setCardId(value); setReceipt(null); setError(null); }}>
            {!choices.length && <option value="">No fighters available</option>}
            {choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </StreetSelect>
          {card && <div className="training-club__progress">
            <strong>LV {progress.level}<small> / 10</small></strong>
            <progress max={100} value={details.progressPercent} aria-label="Character level progress" />
            <span>{details.isMaxLevel ? 'Maximum level' : `${progress.xp} / ${details.nextLevelXp} XP`}</span>
          </div>}
          {offer.id === 'move-training' ? <div className="training-club__lesson">
            <span className="training-club__label">{nextMove ? `MOVE ${(progress.moveTier ?? 0) + 1} · LEVEL ${nextMove.unlockLevel}` : 'MOVES MASTERED'}</span>
            <strong>{nextMove?.name ?? 'All three moves learned'}</strong>
            {nextMove && <p>{nextMove.description}</p>}
          </div> : <div className="training-club__lesson training-club__lesson--xp">
            <span className="training-club__label">THIS SESSION</span>
            <strong>{quote ? `+${xpGain} XP` : offer.id === 'training' ? 'Up to +100 XP' : 'Up to +250 XP'}</strong>
            {quote && quotedProgress && <span>{quotedProgress.level > progress.level ? `Level ${progress.level} → ${quotedProgress.level}` : `Level ${progress.level} progress`}</span>}
            {nextMove && <small>Next move: {nextMove.name} · Level {nextMove.unlockLevel}</small>}
          </div>}
          {foreignPending && <p role="status" className="training-club__notice">Finish your pending purchase first. <Link href={recoveryHref}>Recover purchase <ArrowRight size={13} /></Link></p>}
          {trainingPending && !working && <p role="status" className="training-club__notice">This session needs confirmation. Recover it without paying twice.</p>}
          {unavailable && !pending && <p className="training-club__notice">{unavailable}</p>}
          <button className="training-club__purchase" data-training-purchase disabled={working || !!foreignPending || (!quote && !trainingPending)} onClick={() => void buy()}>
            <span>{working ? 'Training…' : trainingPending ? 'Recover session' : 'Train'}<small>{working || trainingPending ? 'Confirming your session' : `${cost.toLocaleString()} Clout`}</small></span><ArrowRight size={24} />
          </button>
          {error && <p role="alert" className="training-club__notice training-club__notice--error">{error}</p>}
          {receipt && <div className="training-club__receipt" role="status"><Check size={24} /><div>
            <strong>{receipt.itemId === 'move-training' ? 'Move learned' : 'Reps complete'}</strong>
            <p>{receipt.summary}</p><small>Spent {receipt.cost} Clout</small>
          </div></div>}
          {session && <div className="training-session" role="status" data-reduced-motion={session.reducedMotion}>
            <span className="training-club__label">{session.move ? 'MOVE TRAINING' : 'GETTING THE REPS IN'}</span>
            <div className={`training-session__sprite training-session__sprite--${session.move ? 'moves' : 'quick'}`}
              style={{ backgroundImage: `url(${getAssetUrl(`assets/training/inmate-${session.move ? 'moves' : 'quick'}-sheet.webp`)})` }} aria-hidden="true" />
            <strong>{session.character} is training…</strong>
            <span className="training-session__meter" aria-hidden="true"><i /></span>
            <small>Confirming your progress</small>
          </div>}
        </section>
      </div>
    </div>
  );
}
