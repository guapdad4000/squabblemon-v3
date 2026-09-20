import { revealProfileRewards } from '../../lib/rewardReceipts';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { PageDecor } from '../../components/venue/PageDecor';
import { useRef, useState } from 'react';
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
import { PropArt } from '../../components/venue/PropArt';
import { clearShopRequest, readShopRequest, saveShopRequest } from '../../lib/shopJournal';
import { e2eAuthEnabled } from '../../lib/auth';

export function Market({ bootstrap, openPacks }: { bootstrap: PlayerBootstrap; openPacks: () => void }) {
  const { profile } = bootstrap;
  const client = useQueryClient();
  const [selectedId, select] = useState<ShopItemId>(() =>
    new URLSearchParams(location.search).get('item') === 'move-training' ? 'move-training' : 'training',
  );
  const [cardId, setCardId] = useState(
    () => new URLSearchParams(location.search).get('card') ?? profile.ownedCardIds[0] ?? '',
  );
  const [pending, setPending] = useState<ShopRequest | null>(() => readShopRequest(sessionStorage, profile.id));
  const [working, setWorking] = useState(false);
  const [receipt, setReceipt] = useState<ShopReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const offer = SHOP_OFFERS.find((item) => item.id === (pending?.itemId ?? selectedId))!;
  const choices = cardCatalog.filter((card) =>
    offer.id === 'common-recruit'
      ? card.rarity === 'Common' && !profile.ownedCardIds.includes(card.id)
      : profile.ownedCardIds.includes(card.id),
  );
  const selectedCardId =
    pending?.cardId ?? (choices.some((card) => card.id === cardId) ? cardId : (choices[0]?.id ?? ''));
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
  const currency = offer.currency === 'softCurrency' ? 'Clout' : 'Style Shards';
  const preview = e2eAuthEnabled && profile.id === 'e2e-player';

  async function buy() {
    if (lock.current || (!quote && !pending)) return;
    lock.current = true;
    setWorking(true);
    setError(null);
    setReceipt(null);
    try {
      const request = pending ?? {
        ...input,
        idempotencyKey: crypto.randomUUID(),
      };
      saveShopRequest(sessionStorage, profile.id, request);
      setPending(request);
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
      client.setQueryData(getGetPlayerBootstrapQueryKey(), result.bootstrap);
      revealProfileRewards(bootstrap, result.bootstrap, request.idempotencyKey, 'Added to your bag');
      clearShopRequest(sessionStorage, profile.id);
      setPending(null);
      setReceipt(result.receipt);
    } catch (reason) {
      if (reason instanceof ApiError && [400, 409].includes(reason.status)) {
        clearShopRequest(sessionStorage, profile.id);
        setPending(null);
        const data = reason.data as { error?: string } | undefined;
        setError(data?.error ?? reason.message);
        void client.invalidateQueries({
          queryKey: getGetPlayerBootstrapQueryKey(),
        });
      } else if (reason instanceof ApiError && reason.status === 401)
        setError('Sign back in, then recover this purchase. Your original request is kept so it cannot charge twice.');
      else setError('Purchase not confirmed. Retry this same purchase to recover it without paying twice.');
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }

  const propFor = (id: string) =>
    id.includes('training')
      ? ('portable-speaker' as const)
      : id === 'ticket'
        ? ('fight-ticket' as const)
        : id === 'common-recruit'
          ? ('collection-box' as const)
          : id.includes('style')
            ? ('style-hanger' as const)
            : ('deck-stack' as const);
  return (
    <div
      className="studio-page market training-studio world-decor-host"
      style={{
        backgroundImage: `linear-gradient(110deg,#101710f5,#101710b8),url('${getAssetUrl('/assets/layered/training-hall.webp')}')`,
      }}
    >
      <PageDecor theme="market" />
      <div className="training-studio__board" aria-hidden="true"><span>OPEN LATE</span><b>01 / PUT IN WORK</b><span>OAKLAND ATHLETIC CLUB</span></div>
      <header className="market-hero">
        <div>
          <span className="studio-eyebrow">DR. FADE’S · TRAINING CLUB</span>
          <h1>
            Earn your
            <br />
            <em>reputation.</em>
          </h1>
          <p>A sharper gang. A fresh recruit. Your next big pull.</p>
        </div>
        <img src={getCardImage('dr-fade')} alt="Dr. Fade" />
        <div className="market-wallet">
          <span>
            <GameGlyph name="cloutBag" />
            <strong>{profile.softCurrency.toLocaleString()}</strong>
            <small>Clout</small>
          </span>
          <span>
            <GameGlyph name="ticket" />
            <strong>{profile.packTickets}</strong>
            <small>Tickets</small>
          </span>
          <span>
            <GameGlyph name="shards" />
            <strong>{profile.styleShards}</strong>
            <small>Style Shards</small>
          </span>
        </div>
      </header>
      {preview && (
        <p className="market-notice market-preview-label">
          LOCAL PREVIEW · Purchases change this preview only; no account is charged.
        </p>
      )}
      <Link href="/game/style" className="market-style-link">Signature collections · Stickers, banners & card scenes →</Link>
      <nav className="market-offers" aria-label="Shop items">
        {SHOP_OFFERS.filter((item) => !item.id.startsWith('character-')).map((item) => (
          <button
            key={item.id}
            disabled={!!pending || working}
            aria-pressed={offer.id === item.id}
            onClick={() => {
              select(item.id);
              setReceipt(null);
              setError(null);
            }}
          >
            <PropArt id={propFor(item.id)} />
            <strong>{item.name}</strong>
            <span>
              {item.id === 'move-training' ? '150–900' : item.price}{' '}
              {item.currency === 'softCurrency' ? 'Clout' : 'Shards'}
            </span>
            <i />
          </button>
        ))}
      </nav>
      <div className="market-layout">
        <div className="market-showcase" aria-hidden="true">
          <div className="market-showcase__light" />
          {offer.needsCard && card ? (
            <img key={card.id} src={getCardImage(card.id)} alt="" />
          ) : (
            <PropArt id={propFor(offer.id)} />
          )}
          <span>{offer.needsCard && card ? card.name : offer.name}</span>
          {offer.needsCard && card && (
            <small>
              {CARD_RARITY_DEFINITIONS[card.rarity].label} · {offer.id === 'common-recruit' ? 'New recruit' : `Level ${progress.level}`}
            </small>
          )}
        </div>
        <section className="market-checkout" aria-labelledby="purchase-title">
          <span className="studio-eyebrow">Make your next move</span>
          <h2 id="purchase-title">{offer.name}</h2>
          <p>{offer.description}</p>
          {offer.needsCard && (
            <>
              <label htmlFor="shop-card">Choose character</label>
              <select
                id="shop-card"
                value={selectedCardId}
                disabled={!!pending || working}
                onChange={(event) => {
                  setCardId(event.target.value);
                  setReceipt(null);
                  setError(null);
                }}
              >
                {!choices.length && (
                  <option value="">
                    {offer.id === 'common-recruit' ? 'All Common cards owned' : 'No characters available'}
                  </option>
                )}
                {choices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {card && offer.id !== 'common-recruit' && (
                <div className="market-character">
                  <span>
                    LV {progress.level}
                    <small> / 10</small>
                  </span>
                  <progress max={100} value={details.progressPercent} aria-label="Character level progress" />
                  <small>
                    {details.isMaxLevel ? 'Maximum XP reached' : `${progress.xp} / ${details.nextLevelXp} XP`}
                  </small>
                  <details>
                    <summary>
                      {progress.moveTier ?? 0} of 3 moves active
                      {nextMove && ' · Next move'}
                    </summary>
                    {nextMove ? (
                      <p>
                        <strong>
                          {nextMove.name} · level {nextMove.unlockLevel}
                        </strong>
                        <br />
                        {nextMove.description}
                      </p>
                    ) : (
                      <p>All moves mastered.</p>
                    )}
                  </details>
                </div>
              )}
            </>
          )}
          {quote && <p className="market-preview">{quote.receipt.summary}</p>}
          {pending && (
            <p role="status" className="market-notice">
              An earlier purchase needs confirmation. Retry it before starting another.
            </p>
          )}
          {unavailable && !pending && <p className="market-notice">{unavailable}</p>}
          <button
            className="studio-action studio-action--gold"
            disabled={working || (!quote && !pending)}
            onClick={() => void buy()}
          >
            {working ? 'Confirming…' : pending ? 'Recover purchase' : `Buy · ${cost} ${currency}`}
            <ArrowRight size={16} />
          </button>
          {error && (
            <p role="alert" className="studio-notice">
              {error}
            </p>
          )}
          {receipt && (
            <div className="market-receipt" role="status">
              <Check size={18} />
              <div>
                <strong>{preview ? 'Preview purchase complete' : 'Purchase complete'}</strong>
                <p>{receipt.summary}</p>
                <small>
                  Spent {receipt.cost} {receipt.currency === 'softCurrency' ? 'Clout' : 'Style Shards'}.
                </small>
                {receipt.itemId === 'ticket' ? (
                  <button className="studio-text-action" onClick={openPacks}>
                    Open your pack
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <Link className="studio-text-action" href="/game/collection">
                    View your collection
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      <footer className="market-footer">
        <nav aria-label="Earn more Clout">
          <Link href="/game/story">
            Earn in story
            <ArrowRight size={13} />
          </Link>
          <Link href="/game/play">
            Play a fade
            <ArrowRight size={13} />
          </Link>
          <Link href="/game/missions">
            Claim bounties
            <ArrowRight size={13} />
          </Link>
        </nav>
        <details className="market-guide">
          <summary>How the Trading Post works</summary>
          <ol>
            <li>
              <b>Play</b>
              <span>Verified wins earn 40 Clout; draws 30; losses 20. Played characters earn 20–30 XP.</span>
            </li>
            <li>
              <b>Train</b>
              <span>Spend Clout on XP. At levels 2, 5, and 8, buy move coaching to activate a new tier.</span>
            </li>
            <li>
              <b>Pull or choose</b>
              <span>Use tickets for Street Packs, or save 400 Clout for a guaranteed Common recruit.</span>
            </li>
            <li>
              <b>Build and return</b>
              <span>
                Add recruits to your ten-card gang. Replay story for XP and Clout; first clears have separate rewards.
              </span>
            </li>
          </ol>
          <p>
            Tickets also come from Rookie Road, weekly bounties, and first perfect story clears. Duplicate pulls become
            Style Shards for cosmetic finishes.
          </p>
          <Link className="studio-text-action" href="/game/decks">
            Build your gang
            <ArrowRight size={14} />
          </Link>
        </details>
      </footer>
    </div>
  );
}
