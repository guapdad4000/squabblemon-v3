import { motion } from 'framer-motion';
import { CardView } from './CardView';
import { X } from 'lucide-react';
import { CardInstance, getEffectiveCardPower } from '../gameEngine';
import { PlayerBootstrap, useCraftPlayerVariant, useEquipPlayerVariant } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { CardProgress } from './CardProgress';
import { catalogCardByEngineId, catalogCardById } from '../data';
import { CardRarityTreatment, getRarityClass } from './CardRarityTreatment';

export function CardInspector({ card, onClose, bootstrap, variantId }: any) {
  const isInstance = 'instanceId' in card;
  const instance = isInstance ? card as CardInstance : null;
  const catalogCard = catalogCardById[card.catalogId || card.id] ?? catalogCardByEngineId[card.id];

  const craftVariant = useCraftPlayerVariant();
  const equipVariant = useEquipPlayerVariant();
  const queryClient = useQueryClient();

  const isCardOwned = bootstrap && catalogCard && bootstrap.profile.ownedCardIds.includes(catalogCard.catalogId);
  const equippedVariant = catalogCard ? bootstrap?.profile.equippedVariants[catalogCard.catalogId] : variantId;
  const progression = catalogCard ? bootstrap?.profile.cardProgression[catalogCard.catalogId] : undefined;

  const handleCraft = async (variantId: string) => {
    if (!bootstrap || !catalogCard || !isCardOwned) return;
    try {
      const res = await craftVariant.mutateAsync({
        data: { cardId: catalogCard.catalogId, variantId }
      });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res.bootstrap);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEquip = async (variantId: string | null) => {
    if (!bootstrap || !catalogCard || !isCardOwned) return;
    try {
      const res = await equipVariant.mutateAsync({
        data: { cardId: catalogCard.catalogId, variantId },
      });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 overflow-y-auto" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="relative w-full max-w-4xl flex flex-col md:flex-row items-center gap-5 md:gap-10"
        onClick={e => e.stopPropagation()}
      >
        <CardView
          card={card}
          variantId={equippedVariant}
          progress={progression}
          testId="card-inspector"
          className={`w-[180px] h-[252px] md:w-[280px] md:h-[392px] shadow-2xl shadow-primary/20 pointer-events-none ${!isCardOwned && catalogCard ? 'grayscale opacity-75' : ''}`}
        />

        <div
          className={`relative w-full bg-[#111]/95 border p-6 md:p-10 shadow-2xl overflow-hidden max-h-[80vh] overflow-y-auto hide-scrollbar ${catalogCard ? getRarityClass(catalogCard.rarity) : 'border-primary/30'}`}
          style={{ clipPath: 'polygon(0 0, calc(100% - 34px) 0, 100% 34px, 100% 100%, 34px 100%, 0 calc(100% - 34px))' }}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-white to-primary" />
          <div className="flex justify-between items-center mb-5">
            <span className="font-mono text-[10px] md:text-xs text-primary uppercase tracking-[0.22em]">{card.type} class // {card.cost} Motion</span>
            <button data-testid="button-close-inspector" onClick={onClose} className="w-9 h-9 border border-white/20 flex items-center justify-center text-white/50 hover:bg-primary hover:text-black hover:border-primary transition-colors flex-shrink-0">
              <X size={16} />
            </button>
          </div>

          <div className="font-mono text-[9px] text-white/30 tracking-[0.25em] uppercase mb-2">Combat dossier</div>
          <h3 className="font-display font-black italic text-4xl md:text-6xl uppercase leading-[0.9] mb-3">{card.name}</h3>

          {catalogCard && (
            <div className="flex flex-wrap gap-2 mb-6">
               <span className="font-mono text-[9px] uppercase tracking-widest text-white border px-2 py-1 bg-black" style={{ borderColor: 'var(--rarity-color)' }}>{catalogCard.rarity} rarity</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/70 border border-white/20 px-2 py-1 bg-white/5">{catalogCard.faction} Faction</span>
              {catalogCard.crewTags.map((tag: string) => (
                <span key={tag} className="font-mono text-[9px] uppercase tracking-widest text-white/50 border border-white/10 px-2 py-1 bg-black">{tag}</span>
              ))}
            </div>
          )}
          {isCardOwned && progression && (
            <div className="mb-6 border border-primary/20 bg-primary/5 p-3">
              <CardProgress progress={progression} />
            </div>
          )}

          <div className="relative bg-black/70 border-l-4 border-primary p-4 md:p-5 mb-6">
            <div className="text-[9px] md:text-[10px] font-mono tracking-widest text-white/40 mb-1">SIGNATURE ABILITY</div>
            <div className="font-display font-black italic uppercase text-lg md:text-2xl text-primary">{card.ability}</div>
            <p className="text-white/65 font-sans mt-3 text-xs md:text-sm leading-relaxed max-w-lg">{card.effect}</p>
          </div>

          {instance && (
            <div className="grid grid-cols-2 gap-4 mt-6 border-t border-white/10 pt-6">
              <div>
                <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase mb-1">Status</div>
                <div className="flex flex-wrap gap-2">
                  {instance.statuses.frozen && <span className="bg-blue-500/20 text-blue-300 border border-blue-500/50 px-2 py-1 text-[10px] font-mono uppercase">Frozen</span>}
                  {instance.statuses.silenced && <span className="bg-zinc-500/20 text-zinc-300 border border-zinc-500/50 px-2 py-1 text-[10px] font-mono uppercase">Silenced</span>}
                  {instance.statuses.protected && <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 px-2 py-1 text-[10px] font-mono uppercase">Protected</span>}
                  {instance.statuses.blocked && <span className="bg-red-500/20 text-red-300 border border-red-500/50 px-2 py-1 text-[10px] font-mono uppercase">Blocked</span>}
                  {!instance.statuses.frozen && !instance.statuses.silenced && !instance.statuses.protected && !instance.statuses.blocked && <span className="text-white/30 text-[10px] font-mono uppercase">Normal</span>}
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase mb-1">Modifiers</div>
                <div className="text-sm font-mono text-white">
                  Base Power: {instance.basePower} <br/>
                  Modifier: {instance.powerModifier > 0 ? `+${instance.powerModifier}` : instance.powerModifier} <br/>
                  Effective Power: {getEffectiveCardPower(instance)} <br/>
                  {instance.moved && <span className="text-purple-300">Moved districts<br/></span>}
                  <span className="text-primary/70 text-[9px] mt-1 block">{instance.lastEffectNote}</span>
                </div>
              </div>
            </div>
          )}

          {bootstrap && catalogCard && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 border-t border-white/10 pt-6">
              <div>
                <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase mb-2">Acquisition Sources</div>
                <ul className="list-disc list-inside text-xs text-white/80 space-y-1 ml-2">
                  {catalogCard.acquisitionSources.map((source: string, i: number) => <li key={i}>{source}</li>)}
                </ul>

                <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase mt-4 mb-2">Used In Decks</div>
                {bootstrap.profile.savedDecks.filter((d: any) => d.cardIds.includes(catalogCard.catalogId)).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {bootstrap.profile.savedDecks.filter((d: any) => d.cardIds.includes(catalogCard.catalogId)).map((deck: any) => (
                      <span key={deck.id} className="border border-white/20 px-2 py-1 text-[10px] font-mono uppercase bg-white/5">{deck.name}</span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-white/30 italic">Not used in any saved decks.</div>
                )}
              </div>

              <div>
                <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase mb-2">Variants & Crafting</div>
                <div className="space-y-3">
                  {catalogCard.variantSlots.map((slot: any) => {
                    const isOwned = bootstrap.profile.ownedVariants.includes(slot.id);
                    const canAfford = bootstrap.profile.styleShards >= slot.shardCost;
                    return (
                      <div key={slot.id} className="border border-white/10 p-3 bg-black/40">
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-display font-black italic uppercase text-sm">{slot.name}</div>
                          {isOwned ? (
                            <span className="text-[10px] text-primary font-mono uppercase tracking-widest">{equippedVariant === slot.id ? 'Equipped' : 'Unlocked'}</span>
                          ) : (
                            <span className="text-[10px] text-accent font-mono uppercase tracking-widest">{slot.shardCost} Shards</span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/60 mb-2">{slot.description}</p>
                        {!isOwned && (
                          <button
                            onClick={() => handleCraft(slot.id)}
                            disabled={!canAfford || craftVariant.isPending || !isCardOwned}
                            className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-[10px] font-mono uppercase py-1 border border-white/20 transition-colors"
                          >
                            {!isCardOwned ? 'Unlock card first' : craftVariant.isPending ? 'Crafting...' : canAfford ? 'Craft Variant' : 'Not Enough Shards'}
                          </button>
                        )}
                        {isOwned && (
                          <button
                            onClick={() => handleEquip(equippedVariant === slot.id ? null : slot.id)}
                            disabled={equipVariant.isPending}
                            className={`w-full text-[10px] font-mono uppercase py-1 border transition-colors disabled:opacity-50 ${equippedVariant === slot.id ? 'border-primary bg-primary text-black' : 'border-white/20 bg-white/10 hover:bg-white/20'}`}
                          >
                            {equipVariant.isPending ? 'Saving...' : equippedVariant === slot.id ? 'Equipped · Tap to remove' : `Equip ${slot.name}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {catalogCard && <CardRarityTreatment rarity={catalogCard.rarity} />}
        </div>
      </motion.div>
    </div>
  );
}
