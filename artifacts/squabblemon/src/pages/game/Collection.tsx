import { ItemDot, useNotifications } from '../../components/Notifications';
import { useViewMemory } from '../../lib/navigationMemory';
import { Link, useSearch } from 'wouter';
import { revealProfileRewards } from '../../lib/rewardReceipts';
import { ArsenalScreen } from '../../components/venue/ArsenalScreen';
import { useEffect, useRef, useState } from 'react';
import { Check, LockKeyhole } from 'lucide-react';
import { PlayerBootstrap, useClaimCollectionRoadMilestone, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { CardPressTarget } from '../../components/CardInspection';
import { CardInspector } from '../../components/CardInspector';
import { cardCatalog, CARD_RARITY_DEFINITIONS } from '../../data';
import { CardView } from '../../components/CardView';
import { useCollectionCardDiscovery } from '../../lib/useCollectionCardDiscovery';
import sunsetBg from '../../assets/collection-sunset-standoff.png';
import '../../styles/collection-discovery.css';
import '../../styles/collection.css';

export function Collection({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { seen: markNoticeSeen } = useNotifications();
  const queryClient = useQueryClient();
  const claimMilestone = useClaimCollectionRoadMilestone();
  const discoveryRootRef = useRef<HTMLElement>(null);
  const collectionScrollRef = useRef<HTMLDivElement>(null);
  const collectionGridRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useViewMemory<'cards' | 'road'>(`collection-tab:${bootstrap.profile.id}`, 'cards');
  const search = useSearch();
  const requestedCard = new URLSearchParams(search).get('card');
  useEffect(() => { if (requestedCard) setTab('cards'); }, [search]);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const variantParam = new URLSearchParams(search).get('variant');
  const requestedVariant = variantParam && bootstrap.profile.ownedVariants.includes(variantParam) && cardCatalog.find(c => c.catalogId === requestedCard)?.variantSlots.some(v => v.id === variantParam) ? variantParam : null;
  useEffect(() => { if (requestedCard && requestedVariant) setInspectId(requestedCard); }, [search, requestedCard, requestedVariant]);
  const [claimError, setClaimError] = useState('');

  const owned = new Set(bootstrap.profile.ownedCardIds);
  const discovered = new Set(bootstrap.profile.discoveredCardIds);

  const discovery = useCollectionCardDiscovery({
    playerId: bootstrap.profile.id,
    ownedCardIds: bootstrap.profile.ownedCardIds,
    packHistory: bootstrap.profile.packHistory,
    rootRef: discoveryRootRef,
    scrollRef: collectionScrollRef,
    gridRef: collectionGridRef,
    disabled: tab !== 'cards' || !!requestedCard,
    reducedMotion: bootstrap.profile.settings.reducedMotion,
  });

  const newCardIds = new Set(discovery.newCardIds);
  const discoveryOrder = new Map(discovery.newCardIds.map((id, index) => [id, index]));

  const orderedCatalog = cardCatalog
    .map((card, index) => ({ card, index }))
    .sort((left, right) => {
      const leftOrder = discoveryOrder.get(left.card.catalogId);
      const rightOrder = discoveryOrder.get(right.card.catalogId);
      if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
      if (leftOrder !== undefined) return -1;
      if (rightOrder !== undefined) return 1;
      return left.index - right.index;
    })
    .map(({ card }) => card);

  async function handleClaim(milestoneId: string) {
    setClaimError('');
    try {
      const res = await claimMilestone.mutateAsync({ milestoneId });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res.bootstrap);
      revealProfileRewards(bootstrap, res.bootstrap, milestoneId, 'Collection Road reward');
    } catch { setClaimError('Could not claim this reward. Please try again.'); }
  }

  const inspectedCard = inspectId ? cardCatalog.find(card => card.catalogId === inspectId) : null;
  const progressPercent = Math.min(100, (bootstrap.profile.collectionProgress / (bootstrap.collectionRoad.at(-1)?.threshold || 1)) * 100);

  return (
    <ArsenalScreen rootRef={discoveryRootRef} className="collection-stage world-decor-host" label="Card collection">
      <div className="collection-stage__hero" style={{ backgroundImage: `url(${sunsetBg})` }}>
        <div className="collection-stage__hero-overlay" aria-hidden="true" />
        <div className="collection-stage__header">
          <nav className="collection-tabs" aria-label="Collection views">
            <button data-testid="button-view-catalog" type="button" aria-pressed={tab === 'cards'} onClick={() => setTab('cards')}>Catalog</button>
            <button data-testid="button-view-collection-road" type="button" aria-pressed={tab === 'road'} onClick={() => setTab('road')}>Collection Road</button>
            <Link data-testid="link-signature-collections" href="/game/style">The Extras</Link>
          </nav>
          <div className="collection-hero__top">
            <div className="collection-hero__titles">
              <span className="collection-hero__eyebrow">THE ARSENAL / CARD ARCHIVE</span>
              <h1 className="collection-hero__title">The collection.</h1>
            </div>
          </div>
          <div className="collection-hero__bottom">
            <div className="collection-hero__stats">
              <span data-testid="text-collection-owned" className="collection-hero__stat-value">{owned.size} / {cardCatalog.length}</span>
              <span className="collection-hero__stat-label">CARDS OWNED</span>
            </div>
          </div>
        </div>
      </div>

      <div ref={collectionScrollRef} className="collection-stage__body">
        {tab === 'cards' && (
          <div ref={collectionGridRef} data-testid="collection-card-grid" className="collection-card-grid">
            {orderedCatalog.map(card => {
               const isOwned = owned.has(card.catalogId);
               const show = isOwned || discovered.has(card.catalogId);
               const isNew = newCardIds.has(card.catalogId);
               const isActive = discovery.activeCardId === card.catalogId;
               return (
                 <CardPressTarget
                   card={card}
                   onInspect={() => { setInspectId(card.catalogId); }}
                   key={card.catalogId}
                   data-testid="collection-card-control"
                   data-collection-card-state={!show ? 'undiscovered' : isOwned ? 'owned' : 'locked'}
                   data-collection-discovery-card-id={card.catalogId}
                   data-notification-id={isOwned ? `card:${card.catalogId}` : undefined}
                   data-collection-discovery-new={isNew ? 'true' : undefined}
                   data-collection-discovery-active={isActive ? 'true' : undefined}
                   disabled={!show}
                   onClick={() => { setInspectId(card.catalogId); }}
                   aria-label={show ? `${card.name}. ${CARD_RARITY_DEFINITIONS[card.rarity].label} rarity${isOwned ? '' : '. Locked'}${isNew ? '. New card' : ''}` : 'Undiscovered card'}
                 >
                   {show ? (
                     <>
                       <CardView card={card} variantId={bootstrap.profile.equippedVariants[card.catalogId]} progress={bootstrap.profile.cardProgression[card.catalogId]} unavailable={!isOwned} isBoard fillContainer presentationOnly disableLayout />
                       <ItemDot id={`card:${card.catalogId}`} />
                       {isNew && <span className="collection-discovery__badge" aria-hidden="true">New</span>}
                       {!isOwned && <LockKeyhole className="collection-card-grid__lock" size={20} aria-hidden="true" />}
                     </>
                   ) : (
                     <span className="collection-card-grid__unknown">
                       <LockKeyhole size={24} aria-hidden="true" />
                       <span>Undiscovered</span>
                     </span>
                   )}
                 </CardPressTarget>
               );
            })}
          </div>
        )}

        {tab === 'road' && (
          <div className="collection-road">
            <div className="collection-road__intro">
              <span className="venue-kicker">EVERY CARD TAKES YOU FURTHER</span>
              <h2>Rookie Road</h2>
              <p>Collection level {bootstrap.profile.collectionProgress}</p>
              <div className="collection-road__progress" role="progressbar" aria-label="Collection progress" aria-valuemin={0} aria-valuemax={bootstrap.collectionRoad.at(-1)?.threshold || 1} aria-valuenow={Math.min(bootstrap.profile.collectionProgress, bootstrap.collectionRoad.at(-1)?.threshold || 1)}>
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            {claimError && <p className="arsenal-error" role="alert">{claimError}</p>}
            {bootstrap.collectionRoad.length === 0 && <p className="arsenal-empty">Your collection rewards will appear here.</p>}
            {bootstrap.collectionRoad.map(milestone => (
              <div key={milestone.id} className={`collection-milestone is-${milestone.status}`}>
                <div className="collection-milestone__level">{milestone.threshold}</div>
                <div className="collection-milestone__copy">
                  <h3>{milestone.title}</h3>
                  <p>{milestone.description}</p>
                  <small>{milestone.rewardLabel}</small>
                </div>
                {milestone.status === 'claimable' ? (
                  <button data-testid={`button-claim-${milestone.id}`} type="button" className="arsenal-action" onClick={() => void handleClaim(milestone.id)} disabled={claimMilestone.isPending}>Claim</button>
                ) : (
                  <span className="collection-milestone__state">
                    {milestone.status === 'claimed' ? <><Check size={14} />Claimed</> : <><LockKeyhole size={14} /><span className="sr-only">Locked</span></>}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {inspectedCard && <CardInspector key={inspectId + (requestedVariant ?? '')} initialPreviewVariant={inspectId === requestedCard ? requestedVariant : undefined} card={inspectedCard} onClose={() => { if (inspectId) markNoticeSeen(`card:${inspectId}`); setInspectId(null); }} match={null} bootstrap={bootstrap} />}
    </ArsenalScreen>
  );
}
