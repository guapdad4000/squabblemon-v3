import { PageHeading } from '../../components/venue/PageHeading';
import { ArsenalScreen, FocusViewButton } from '../../components/venue/ArsenalScreen';
import { useState } from 'react';
import { Check, Circle, Droplets, Flame, Leaf, LockKeyhole, Moon, Search, SlidersHorizontal, Wind, X, Zap } from 'lucide-react';
import { PlayerBootstrap, useClaimCollectionRoadMilestone, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { CardPressTarget } from '../../components/CardInspection';
import { CardInspector } from '../../components/CardInspector';
import { cardCatalog, CARD_RARITY_DEFINITIONS } from '../../data';
import { CardView } from '../../components/CardView';

const types = [...new Set(cardCatalog.map(card => card.type))];
const factions = [...new Set(cardCatalog.map(card => card.faction))];
const costs = [...new Set(cardCatalog.map(card => card.cost))].sort((a, b) => a - b);
const powers = [...new Set(cardCatalog.map(card => card.power))].sort((a, b) => a - b);
const typeIcons: Record<string, typeof Circle> = { Normal: Circle, Fire: Flame, Water: Droplets, Electric: Zap, Plant: Leaf, Air: Wind, Dark: Moon };

export function Collection({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const queryClient = useQueryClient();
  const claimMilestone = useClaimCollectionRoadMilestone();
  const [tab, setTab] = useState<'cards' | 'road'>('cards');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterCrew, setFilterCrew] = useState<string | null>(null);
  const [filterCost, setFilterCost] = useState<number | null>(null);
  const [filterPower, setFilterPower] = useState<number | null>(null);
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<'character' | 'support' | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState('');
  const owned = new Set(bootstrap.profile.ownedCardIds);
  const discovered = new Set(bootstrap.profile.discoveredCardIds);
  const activeFilters = [filterType, filterCrew, filterCost, filterPower, filterRarity, filterKind].filter(value => value !== null).length;
  const query = filterSearch.trim().toLowerCase();
  const filteredCatalog = cardCatalog.filter(card =>
    (!filterType || card.type === filterType) &&
    (!filterCrew || card.crewTags.includes(filterCrew) || card.faction === filterCrew) &&
    (filterCost === null || card.cost === filterCost) &&
    (filterPower === null || card.power === filterPower) &&
    (!filterRarity || card.rarity === filterRarity) &&
    (!filterKind || (card.kind ?? 'character') === filterKind) &&
    (!query || `${card.name} ${card.ability} ${card.effect}`.toLowerCase().includes(query))
  );
  function clearFilters() { setFilterType(null); setFilterCrew(null); setFilterRarity(null); setFilterKind(null); setFilterCost(null); setFilterPower(null); setFilterSearch(''); }
  async function handleClaim(milestoneId: string) {
    setClaimError('');
    try {
      const res = await claimMilestone.mutateAsync({ milestoneId });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res.bootstrap);
    } catch { setClaimError('Could not claim this reward. Please try again.'); }
  }
  const inspectedCard = inspectId ? cardCatalog.find(card => card.catalogId === inspectId) : null;
  return <ArsenalScreen className="collection-stage" label="Card collection">
    <div className="collection-stage__header">
      <div className="arsenal-heading-row"><PageHeading art="collection-box" eyebrow="THE ARSENAL / CARD ARCHIVE" title="The collection.">{owned.size} / {cardCatalog.length} cards owned. Every card has a story.</PageHeading><FocusViewButton /></div>
      <nav className="collection-tabs" aria-label="Collection views">
        <button type="button" aria-pressed={tab === 'cards'} onClick={() => setTab('cards')}>Catalog</button>
        <button type="button" aria-pressed={tab === 'road'} onClick={() => setTab('road')}>Collection Road</button>
      </nav>
    </div>
    <div className="collection-stage__body">
      {tab === 'cards' && <>
        <div className="collection-toolbar">
          <label className="arsenal-search"><Search aria-hidden="true" /><span className="sr-only">Search collection</span><input type="search" placeholder="Find a card or ability…" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} /></label>
          <button type="button" className="arsenal-link" aria-expanded={filtersOpen} aria-controls="collection-filters" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={16} aria-hidden="true" />Filters{activeFilters > 0 && ` · ${activeFilters}`}</button>
          {(activeFilters > 0 || filterSearch) && <button type="button" className="arsenal-icon" title="Clear filters" aria-label="Clear filters" onClick={clearFilters}><X size={16} /></button>}
          <span className="collection-toolbar__count" role="status">{filteredCatalog.length} cards in view</span>
        </div>
        {filtersOpen && <div id="collection-filters" className="collection-filters">
          <div className="collection-filter-row" aria-label="Filter by card category"><span>Category</span>
            <button type="button" aria-pressed={filterKind === 'character'} onClick={() => setFilterKind(filterKind === 'character' ? null : 'character')}>Characters</button>
            <button type="button" aria-pressed={filterKind === 'support'} onClick={() => setFilterKind(filterKind === 'support' ? null : 'support')}>Support cards</button>
          </div>
          <div className="collection-filter-row" aria-label="Filter by card tier"><span>Rarity</span>
            {Object.values(CARD_RARITY_DEFINITIONS).map(({ name: rarity, cue, label }) => <button type="button" key={rarity} aria-pressed={filterRarity === rarity} onClick={() => setFilterRarity(filterRarity === rarity ? null : rarity)}><span aria-hidden="true">{cue}</span>{label}<small>{cardCatalog.filter(card => card.rarity === rarity && owned.has(card.catalogId)).length}</small></button>)}
          </div>
          <div className="collection-filter-row" aria-label="Filter by type"><span>Type</span>{types.map(type => {
            const Icon = typeIcons[type] ?? Circle;
            return <button type="button" key={type} aria-pressed={filterType === type} onClick={() => setFilterType(filterType === type ? null : type)}><Icon size={13} aria-hidden="true" />{type}</button>;
          })}</div>
          <div className="collection-filter-row" aria-label="Filter by crew"><span>Crew</span>{factions.map(faction => <button type="button" key={faction} aria-pressed={filterCrew === faction} onClick={() => setFilterCrew(filterCrew === faction ? null : faction)}>{faction}</button>)}</div>
          <div className="collection-filter-row">
            <label>Motion<select aria-label="Filter by Motion cost" value={filterCost ?? ''} onChange={e => setFilterCost(e.target.value === '' ? null : Number(e.target.value))}><option value="">Any cost</option>{costs.map(cost => <option key={cost} value={cost}>{cost} Motion</option>)}</select></label>
            <label>Hands<select aria-label="Filter by Hands" value={filterPower ?? ''} onChange={e => setFilterPower(e.target.value === '' ? null : Number(e.target.value))}><option value="">Any Hands</option>{powers.map(power => <option key={power} value={power}>{power} Hands</option>)}</select></label>
          </div>
        </div>}
        {filteredCatalog.length === 0 ? <div className="arsenal-empty"><Search size={28} /><h2>No matching cards.</h2><p>Open up your search to find your next recruit.</p><button type="button" className="arsenal-link" onClick={clearFilters}>Clear filters</button></div>
          : <div data-testid="collection-card-grid" className="collection-card-grid">{filteredCatalog.map(card => {
            const isOwned = owned.has(card.catalogId);
            const show = isOwned || discovered.has(card.catalogId);
            return <CardPressTarget card={card} onInspect={() => setInspectId(card.catalogId)} key={card.catalogId} data-testid="collection-card-control" disabled={!show} onClick={() => setInspectId(card.catalogId)}
              aria-label={show ? `${card.name}. ${CARD_RARITY_DEFINITIONS[card.rarity].label} rarity${isOwned ? '' : '. Locked'}` : 'Undiscovered card'}>
              {show ? <><CardView card={card} variantId={bootstrap.profile.equippedVariants[card.catalogId]} progress={bootstrap.profile.cardProgression[card.catalogId]} unavailable={!isOwned} isBoard fillContainer presentationOnly disableLayout />
                {!isOwned && <LockKeyhole className="collection-card-grid__lock" size={20} aria-hidden="true" />}</>
                : <span className="collection-card-grid__unknown"><LockKeyhole size={24} aria-hidden="true" /><span>Undiscovered</span></span>}
            </CardPressTarget>;
          })}</div>}
      </>}
      {tab === 'road' && <div className="collection-road">
        <div className="collection-road__intro"><span className="venue-kicker">EVERY CARD TAKES YOU FURTHER</span><h2>Rookie Road</h2><p>Collection level {bootstrap.profile.collectionProgress}</p>
          <div className="collection-road__progress" role="progressbar" aria-label="Collection progress" aria-valuemin={0} aria-valuemax={bootstrap.collectionRoad.at(-1)?.threshold || 1} aria-valuenow={Math.min(bootstrap.profile.collectionProgress, bootstrap.collectionRoad.at(-1)?.threshold || 1)}><span style={{ width: `${Math.min(100, (bootstrap.profile.collectionProgress / (bootstrap.collectionRoad.at(-1)?.threshold || 1)) * 100)}%` }} /></div>
        </div>
        {claimError && <p className="arsenal-error" role="alert">{claimError}</p>}
        {bootstrap.collectionRoad.length === 0 && <p className="arsenal-empty">Your collection rewards will appear here.</p>}
        {bootstrap.collectionRoad.map(milestone => <div key={milestone.id} className={`collection-milestone is-${milestone.status}`}>
          <div className="collection-milestone__level">{milestone.threshold}</div>
          <div className="collection-milestone__copy"><h3>{milestone.title}</h3><p>{milestone.description}</p><small>{milestone.rewardLabel}</small></div>
          {milestone.status === 'claimable' ? <button type="button" className="arsenal-action" onClick={() => void handleClaim(milestone.id)} disabled={claimMilestone.isPending}>Claim</button>
            : <span className="collection-milestone__state">{milestone.status === 'claimed' ? <><Check size={14} />Claimed</> : <><LockKeyhole size={14} /><span className="sr-only">Locked</span></>}</span>}
        </div>)}
      </div>}
    </div>
    {inspectedCard && <CardInspector card={inspectedCard} onClose={() => setInspectId(null)} match={null} bootstrap={bootstrap} />}
  </ArsenalScreen>;
}
