import { BattlePowerBreakdown } from './BattlePowerBreakdown';
import React from 'react';
import { Link } from 'wouter';
import { motion, useReducedMotion } from 'framer-motion';
import { CardView } from './CardView';
import { X } from 'lucide-react';
import { CardInstance, getEffectiveCardPower } from '../gameEngine';
import { PlayerBootstrap, useCraftPlayerVariant, useEquipPlayerVariant } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { CardProgress } from './CardProgress';
import { catalogCardByEngineId, catalogCardById, getCardImage, getAssetUrl, CARD_RARITY_DEFINITIONS } from '../data';
import { CardRarityTreatment, getRarityClass } from './CardRarityTreatment';
import { CardUpgrades } from './CardUpgrades';
import { snapshotUpgradesForCard } from '@workspace/squabblemon-engine/abilityUpgrades';
import { cards as engineCards } from '@workspace/squabblemon-engine/data';
import { CARD_FINISH, getCardWallpaper } from '../lib/cardFinish';
import '../styles/collection-inspector.css';

export function CardInspector({ card, onClose, bootstrap, variantId, match, useCachedProfile = false }: any) {
  const reduceMotion = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  card = match?.boards?.flat().find((current: CardInstance) => current.instanceId === card.instanceId) ?? card;
  const isInstance = 'instanceId' in card;
  const panel = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('[data-testid=button-close-inspector]')?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, []);
  const instance = isInstance ? card as CardInstance : null;
  const isCovered = Boolean(instance && match?.timedEffects?.some((effect: any) => (effect.kind === 'church-protection' || effect.kind === 'salon-protection') && effect.targetInstanceId === instance.instanceId));
  const catalogCard = catalogCardById[card.catalogId || card.id] ?? catalogCardByEngineId[card.cardId || card.id] ?? null;

  const craftVariant = useCraftPlayerVariant();
  const equipVariant = useEquipPlayerVariant();
  const queryClient = useQueryClient();
  bootstrap ??= useCachedProfile ? queryClient.getQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey()) : undefined;

  const isCardOwned = bootstrap && catalogCard && bootstrap.profile.ownedCardIds.includes(catalogCard.catalogId);
  const equippedVariant = (catalogCard ? bootstrap?.profile.equippedVariants[catalogCard.catalogId] : undefined) ?? variantId;
  const progression = catalogCard ? bootstrap?.profile.cardProgression[catalogCard.catalogId] : undefined;
  const matchUpgradeIds = instance && match?.abilityUpgradeSnapshot
    ? snapshotUpgradesForCard(match.abilityUpgradeSnapshot, instance.owner, instance.cardId).map((upgrade: { id: string }) => upgrade.id)
    : undefined;

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
    <div ref={panel} role="dialog" aria-modal="true" aria-label={card.name + (match ? ' battle details' : ' card details')} className={'fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-start md:items-center justify-center p-4 md:p-8 overflow-y-auto ' + (match ? 'battle-inspector' : 'collection-inspector')} onClick={onClose} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const elements = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]') ?? [])];
        const first = elements[0], last = elements[elements.length-1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <div className="collector-inspector-backdrop" style={{ backgroundImage: `url("${getCardWallpaper(card.type)}")` }} aria-hidden="true" />
      {!match && <button type="button" className="collection-inspector__close" data-testid="button-close-inspector" aria-label="Close card details" onClick={event => { event.stopPropagation(); onClose(); }}><X size={22} /><span>Close</span></button>}
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : -20 }}
        className="relative my-auto w-full max-w-4xl flex flex-col md:flex-row items-center gap-5 md:gap-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="collector-display">
        <CardView
          card={card}
          covered={isCovered}
          variantId={equippedVariant}
          progress={progression}
          testId="card-inspector"
          inspectionLayout={instance && match && !reduceMotion ? 'battle-inspect-' + instance.instanceId : undefined}
          effectivePower={instance ? getEffectiveCardPower(instance) : undefined}
          isInspector
          presentationOnly
          className={`w-[200px] md:w-[300px] aspect-[63/88] shadow-2xl shadow-primary/20 ${!match && bootstrap && !isCardOwned && catalogCard ? 'grayscale opacity-75' : ''}`}
        />
        <div className="collector-display-caption">
          <span>{catalogCard ? CARD_FINISH[catalogCard.rarity] : 'Collector edition'}</span>
          <small>Move across the card to catch the light</small>
        </div>
        </div>

        <div
          className={`collector-dossier relative w-full bg-zinc-950/95 border-2 p-6 md:p-10 shadow-2xl overflow-hidden max-h-[80vh] overflow-y-auto hide-scrollbar flex flex-col card-bevel ${catalogCard ? getRarityClass(catalogCard.rarity) : 'border-primary/30'}`}
        >
          <div className="collection-inspector__ornament absolute inset-0 bg-[image:var(--rarity-pattern)] opacity-5 pointer-events-none mix-blend-screen" />
          <div className="collection-inspector__ornament absolute inset-x-0 top-0 h-1.5 bg-[var(--rarity-color,theme(colors.primary.DEFAULT))] shadow-[0_0_15px_var(--rarity-color,theme(colors.primary.DEFAULT))]" />
          <div className="flex justify-between items-center mb-5 relative z-10">
            <span className="font-mono text-[10px] md:text-xs text-primary uppercase tracking-[0.22em]">{card.type} class // {card.cost} Motion</span>
            {match && <button data-testid="button-close-inspector" aria-label="Close card details" onClick={onClose} className="w-9 h-9 border border-white/20 flex items-center justify-center text-white/50 hover:bg-primary hover:text-black hover:border-primary transition-colors flex-shrink-0">
              <X size={16} />
            </button>}
          </div>

          <div className="font-mono text-[9px] text-white/30 tracking-[0.25em] uppercase mb-2">Combat dossier</div>
          <h3 className="font-display font-black italic text-4xl md:text-6xl uppercase leading-[0.9] mb-3">{card.name}</h3>
          {instance && match && <BattlePowerBreakdown card={instance} match={match} />}

          {catalogCard && (
            <div className="collection-inspector__tags flex flex-wrap gap-2 mb-6">
              {catalogCard.kind === 'support' && <span className="font-mono text-[9px] uppercase tracking-widest text-white border border-white/30 px-2 py-1 bg-black">Support card</span>}
               <span className="font-mono text-[9px] uppercase tracking-widest text-white border px-2 py-1 bg-black" style={{ borderColor: 'var(--rarity-color)' }}>{CARD_RARITY_DEFINITIONS[catalogCard.rarity].label} rarity</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/70 border border-white/20 px-2 py-1 bg-white/5">{catalogCard.faction} Faction</span>
              {catalogCard.crewTags.map((tag: string) => (
                <span key={tag} className="font-mono text-[9px] uppercase tracking-widest text-white/50 border border-white/10 px-2 py-1 bg-black">{tag}</span>
              ))}
            </div>
          )}
          {isCardOwned && progression && (
            <div className="collection-inspector__progress mb-6 border border-primary/20 bg-primary/5 p-3">
              <CardProgress progress={progression} />
            </div>
          )}

          {(engineCards[card.id]?.immersiveAssetId) && (
            <div className="mb-6">
              <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase mb-2">Immersive preview · tap and hold</div>
              <div className="immersive-scene" data-testid="immersive-scene">
                <div className="immersive-scene__bg" style={{ backgroundImage: `url("${engineCards[card.id]?.immersiveAssetId?.backgroundAssetId ? getAssetUrl(engineCards[card.id]!.immersiveAssetId!.backgroundAssetId) : getCardImage(card.id)}")` }} />
                {engineCards[card.id]?.immersiveAssetId?.midgroundAssetId && (
                  <div className="immersive-scene__mid" style={{ backgroundImage: `url("${getAssetUrl(engineCards[card.id]!.immersiveAssetId!.midgroundAssetId!)}")` }} />
                )}
                <div className="immersive-scene__particles" />
                <div className="immersive-scene__fg" style={{ backgroundImage: `url("${engineCards[card.id]?.immersiveAssetId?.foregroundAssetId ? getAssetUrl(engineCards[card.id]!.immersiveAssetId!.foregroundAssetId) : getCardImage(card.id)}")` }} />
                <div className="immersive-scene__badge">Signature scene</div>
              </div>
            </div>
          )}

          <div className="collection-inspector__ability relative bg-black/70 border-l-4 border-primary p-4 md:p-5 mb-6">
            <div className="text-[9px] md:text-[10px] font-mono tracking-widest text-white/40 mb-1">SIGNATURE ABILITY</div>
            <div className="font-display font-black italic uppercase text-lg md:text-2xl text-primary">{card.ability}</div>
            <p className="text-white/65 font-sans mt-3 text-xs md:text-sm leading-relaxed max-w-lg">{card.effect}</p>
          </div>
          {catalogCard && (
            <div className="collection-inspector__upgrades mb-6 border border-white/10 bg-black/40 p-3">
              <CardUpgrades card={catalogCard} progress={progression} activeUpgradeIds={matchUpgradeIds} />
              {isCardOwned && !match && <Link href={`/game/shop?card=${catalogCard.catalogId}`} onClick={onClose} className="mt-3 block text-xs font-bold text-primary">Train XP & learn moves at Dr. Fade’s →</Link>}
            </div>
          )}


          {instance && (
            <div className="grid grid-cols-2 gap-4 mt-6 border-t border-white/10 pt-6">
              <div>
                <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase mb-1">Status</div>
                <div className="flex flex-wrap gap-2">
                  {instance.statuses.frozen && <span className="bg-blue-500/20 text-blue-300 border border-blue-500/50 px-2 py-1 text-[10px] font-mono uppercase">Frozen</span>}
                  {instance.statuses.silenced && <span className="bg-zinc-500/20 text-zinc-300 border border-zinc-500/50 px-2 py-1 text-[10px] font-mono uppercase">Silenced</span>}
                  {isCovered && <span className="bg-amber-200/20 text-amber-200 border border-amber-300/50 px-2 py-1 text-[10px] font-mono uppercase" title="Blocks this card’s next targeted hostile ability, even in a later round">Covered</span>}
                  {instance.statuses.protected && !isCovered && <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 px-2 py-1 text-[10px] font-mono uppercase">Protected this round</span>}
                  {instance.statuses.blocked && <span className="bg-red-500/20 text-red-300 border border-red-500/50 px-2 py-1 text-[10px] font-mono uppercase">Blocked</span>}
                  {!instance.statuses.frozen && !instance.statuses.silenced && !instance.statuses.protected && !instance.statuses.blocked && <span className="text-white/30 text-[10px] font-mono uppercase">Normal</span>}
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase mb-1">Modifiers</div>
                <div className="text-sm font-mono text-white">
                  Base Hands: {instance.basePower} <br/>
                  Modifier: {instance.powerModifier > 0 ? `+${instance.powerModifier}` : instance.powerModifier} <br/>
                  Effective Hands: {getEffectiveCardPower(instance)} <br/>
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
                      <div key={slot.id} className="collection-inspector__variant border border-white/10 p-3 bg-black/40">
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
