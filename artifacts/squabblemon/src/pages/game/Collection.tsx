import { useState } from 'react';
import { PlayerBootstrap, useClaimCollectionRoadMilestone } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { CardInspector } from '../../components/CardInspector';
import { CardUpgradeCue } from '../../components/CardUpgrades';
import { cardCatalog } from '../../data';
import { CardView } from '../../components/CardView';

export function Collection({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const queryClient = useQueryClient();
  const claimMilestone = useClaimCollectionRoadMilestone();

  const [tab, setTab] = useState<'cards' | 'road'>('cards');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterCrew, setFilterCrew] = useState<string | null>(null);
  const [filterCost, setFilterCost] = useState<number | null>(null);
  const [filterPower, setFilterPower] = useState<number | null>(null);
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState<string>('');

  const [inspectId, setInspectId] = useState<string | null>(null);

  const owned = new Set(bootstrap.profile.ownedCardIds);
  const discovered = new Set(bootstrap.profile.discoveredCardIds);

  const filteredCatalog = cardCatalog.filter(c => {
    if (filterType && c.type !== filterType) return false;
    if (filterCrew && !c.crewTags.includes(filterCrew) && c.faction !== filterCrew) return false;
    if (filterCost !== null && c.cost !== filterCost) return false;
    if (filterPower !== null && c.power !== filterPower) return false;
    if (filterRarity && c.rarity !== filterRarity) return false;
    if (filterSearch && !c.ability.toLowerCase().includes(filterSearch.toLowerCase()) && !c.effect.toLowerCase().includes(filterSearch.toLowerCase()) && !c.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const handleClaim = async (milestoneId: string) => {
    try {
      const res = await claimMilestone.mutateAsync({ milestoneId });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res.bootstrap);
    } catch (e) {
      console.error(e);
    }
  };

  const inspectedCard = inspectId ? cardCatalog.find(c => c.catalogId === inspectId) : null;

  return (
    <div className="flex flex-col h-full bg-black relative">
      <div className="fixed inset-y-0 left-0 w-8 border-r border-white/5 bg-[repeating-linear-gradient(0deg,transparent,transparent_40px,rgba(255,255,255,0.05)_40px,rgba(255,255,255,0.05)_42px)] z-0 pointer-events-none opacity-50" />

      <div className="flex-none p-4 md:p-6 pb-0 relative z-10 pl-12 md:pl-14">
        <h1 className="font-display font-black italic text-3xl uppercase leading-none mb-1 text-white drop-shadow-md">Collection</h1>
        <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest mb-4 bg-black/50 px-2 py-0.5 inline-block">Cards Owned: {owned.size} / {cardCatalog.length}</p>

        <div className="flex border-b border-white/10 bg-black/50">
          <button
            onClick={() => setTab('cards')}
            className={`px-4 py-2 font-display font-black italic uppercase text-sm border-b-2 ${tab === 'cards' ? 'border-primary text-primary' : 'border-transparent text-white/50 hover:text-white'}`}
          >
            Catalog
          </button>
          <button
            onClick={() => setTab('road')}
            className={`px-4 py-2 font-display font-black italic uppercase text-sm border-b-2 ${tab === 'road' ? 'border-primary text-primary' : 'border-transparent text-white/50 hover:text-white'}`}
          >
            Collection Road
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 md:p-6 pb-24 relative z-10 pl-12 md:pl-14">
        {tab === 'cards' && (
          <>
            <div className="flex flex-col gap-3 mb-6">
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {['Common', 'Uncommon', 'Rare', 'Epic'].map(rarity => (
                  <button key={rarity} onClick={() => setFilterRarity(filterRarity === rarity ? null : rarity)} className={`flex-none font-mono text-[9px] uppercase px-3 py-1 border ${filterRarity === rarity ? 'border-white text-white bg-white/15' : 'border-white/20 text-white/60 bg-black'}`}>
                    {rarity}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {['Normal', 'Fire', 'Water', 'Electric', 'Plant', 'Air', 'Dark'].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(filterType === t ? null : t)}
                    className={`flex-none font-mono text-[9px] uppercase px-3 py-1 border transition-colors ${filterType === t ? 'border-primary text-black bg-primary' : 'border-white/20 text-white hover:border-white/50 bg-white/5'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {Array.from(new Set(cardCatalog.map(c => c.faction))).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterCrew(filterCrew === f ? null : f)}
                    className={`flex-none font-mono text-[9px] uppercase px-3 py-1 border transition-colors ${filterCrew === f ? 'border-accent text-white bg-accent' : 'border-white/20 text-white/70 hover:border-white/50 bg-black'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="text"
                  placeholder="Search abilities..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="bg-zinc-900 border border-white/20 text-white px-3 py-1 font-mono text-[10px] w-full max-w-[200px] uppercase placeholder:text-white/30"
                />
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(cost => (
                    <button key={cost} onClick={() => setFilterCost(filterCost === cost ? null : cost)} className={`font-mono text-[9px] px-2 py-1 border ${filterCost === cost ? 'border-primary text-primary' : 'border-white/20 text-white/50'}`}>{cost}H</button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {[1,2,3,4,5,6].map(power => (
                    <button key={power} onClick={() => setFilterPower(filterPower === power ? null : power)} className={`font-mono text-[9px] px-2 py-1 border ${filterPower === power ? 'border-accent text-accent' : 'border-white/20 text-white/50'}`}>{power}P</button>
                  ))}
                </div>
                {(filterType || filterCrew || filterRarity || filterCost !== null || filterPower !== null || filterSearch) && (
                  <button onClick={() => { setFilterType(null); setFilterCrew(null); setFilterRarity(null); setFilterCost(null); setFilterPower(null); setFilterSearch(''); }} className="font-mono text-[9px] uppercase tracking-widest text-rose-400 border border-rose-500/30 px-3 py-1 ml-auto hover:bg-rose-500/10">Clear</button>
                )}
              </div>
            </div>

            {filteredCatalog.length === 0 ? (
              <div className="text-center p-12 border border-white/10 bg-white/5">
                <div className="font-display font-black italic text-xl uppercase mb-2">No matching cards</div>
                <div className="font-mono text-[10px] uppercase text-white/50">Try clearing some filters</div>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-4">
                {filteredCatalog.map(c => {
                  const isOwned = owned.has(c.catalogId);
                  const isDiscovered = discovered.has(c.catalogId);
                  const show = isOwned || isDiscovered;
                  const variantId = bootstrap.profile.equippedVariants[c.catalogId];

                  return (
                    <button
                      key={c.catalogId}
                      onClick={() => { if (show) setInspectId(c.catalogId); }}
                      className={`relative text-left card-bevel group transition-transform ${show ? 'hover:scale-105 active:scale-95' : 'opacity-20 cursor-default'}`}
                      aria-label={`${c.name}. ${c.rarity} rarity`}
                    >
                      {show ? (
                        <div className="relative">
                           <CardView
                             card={c}
                             variantId={variantId}
                             progress={bootstrap.profile.cardProgression[c.catalogId]}
                             unavailable={!isOwned}
                             isBoard
                             fillContainer
                             presentationOnly
                           />
                          {!isOwned && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                              <span className="font-display font-black italic uppercase text-white/80 text-xs tracking-widest border border-white/30 bg-black/80 px-2 py-1 backdrop-blur-sm -rotate-12 card-bevel shadow-xl">Locked</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-[63/88] bg-zinc-950 border-2 border-white/5 flex flex-col items-center justify-center p-2 card-bevel">
                          <div className="w-8 h-8 md:w-12 md:h-12 border-2 border-white/20 flex items-center justify-center mb-2 card-bevel opacity-50">
                            <span className="font-display font-black text-xl text-white/50">?</span>
                          </div>
                          <div className="font-mono text-[6px] md:text-[8px] uppercase text-center tracking-widest text-white/30">Undiscovered</div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'road' && (
          <div className="max-w-xl mx-auto flex flex-col gap-4">
            <div className="bg-white/5 border border-white/10 p-4 mb-4">
              <h2 className="font-display font-black italic uppercase text-lg mb-1">Rookie Road</h2>
              <p className="font-mono text-[9px] text-white/50 uppercase tracking-widest mb-3">
                Current Level: {bootstrap.profile.collectionProgress}
              </p>
              <div className="h-1 bg-white/10 w-full relative">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-primary transition-all"
                  style={{ width: `${Math.min(100, (bootstrap.profile.collectionProgress / (bootstrap.collectionRoad[bootstrap.collectionRoad.length - 1]?.threshold || 1)) * 100)}%` }}
                />
              </div>
            </div>

            {bootstrap.collectionRoad.map(milestone => (
              <div
                key={milestone.id}
                className={`relative flex items-center p-4 border ${
                  milestone.status === 'claimable' ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(250,204,21,0.15)]' :
                  milestone.status === 'claimed' ? 'border-white/10 bg-white/5 opacity-60' :
                  'border-white/5 bg-transparent'
                }`}
              >
                <div className={`w-12 h-12 flex-none flex items-center justify-center font-display font-black italic text-xl ${
                  milestone.status === 'claimed' ? 'text-white/40' :
                  milestone.status === 'claimable' ? 'text-primary border border-primary/50 bg-black' :
                  'text-white/20 border border-white/10'
                }`}>
                  {milestone.threshold}
                </div>

                <div className="flex-1 ml-4">
                  <div className="font-display font-black italic uppercase text-sm mb-1">{milestone.title}</div>
                  <div className="font-mono text-[9px] text-white/60">{milestone.description}</div>
                  <div className="font-mono text-[9px] text-primary uppercase mt-2">{milestone.rewardLabel}</div>
                </div>

                <div className="flex-none ml-4">
                  {milestone.status === 'claimable' && (
                    <button
                      onClick={() => handleClaim(milestone.id)}
                      disabled={claimMilestone.isPending}
                      className="bg-primary text-black font-display font-black italic uppercase text-xs px-4 py-2 hover:bg-yellow-400"
                    >
                      Claim
                    </button>
                  )}
                  {milestone.status === 'claimed' && (
                    <span className="font-display font-black italic uppercase text-white/30 text-xs">Claimed</span>
                  )}
                  {milestone.status === 'locked' && (
                    <span className="font-mono text-[10px] text-white/20 uppercase tracking-widest border border-white/10 px-3 py-1">Locked</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inspectedCard && (
        <CardInspector card={inspectedCard as any} onClose={() => setInspectId(null)} match={null} bootstrap={bootstrap} />
      )}
    </div>
  );
}
