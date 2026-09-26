import { DrFadeReferee } from './DrFadeReferee';
import { BattlePowerBreakdown } from './BattlePowerBreakdown';
import React from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'wouter';
import { motion, useReducedMotion } from 'framer-motion';
import { CardView } from './CardView';
import { PageDecor } from './venue/PageDecor';
import { X } from 'lucide-react';
import { CardInstance, getEffectiveCardPower } from '../gameEngine';
import { PlayerBootstrap, useCraftPlayerVariant, useEquipPlayerVariant } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { CardProgress } from './CardProgress';
import { getVariantKind } from './CardVariantTreatment';
import { canonicalElement, catalogCardByEngineId, catalogCardById, CARD_RARITY_DEFINITIONS } from '../data';
import { CardRarityTreatment, getRarityClass } from './CardRarityTreatment';
import { CardUpgrades } from './CardUpgrades';
import { snapshotUpgradesForCard } from '@workspace/squabblemon-engine/abilityUpgrades';
import { CARD_FINISH, cardMotionReduced, cardFinishLabel, VARIANT_FINISH, getCardWallpaper } from '../lib/cardFinish';
import { getAssetUrl } from '../lib/assets';
import '../styles/collection-inspector.css';
import '../styles/fighter-resume.css';

/**
 * A short handwritten scout-note line for the card, derived from its ability.
 * We keep it in-world ("Squad rules of the block") and flavor-aware based on
 * the card's type so each class feels distinct.
 */
function scoutNote(card: any): string {
  const type = String(card.type ?? '').toLowerCase();
  const ability = String(card.ability ?? '').toUpperCase();
  if (type === 'fire') return `${ability} hits like a thrown bottle at 2am. Don't blink.`;
  if (type === 'ice') return `${ability} — slow your roll, then end it. Patience pays.`;
  if (type === 'electric') return `${ability} runs the whole block's grid. Stay conductive.`;
  if (type === 'water') return `${ability} flows around corners. Watch the tide.`;
  if (type === 'plant') return `${ability} roots in deep. Cut it before it spreads.`;
  if (type === 'psychic') return `${ability} reads the room before the room reads you.`;
  if (type === 'dark') return `${ability} — they'll owe you before they know it.`;
  if (type === 'fighting') return `${ability} brawls back. Bring a mouthpiece.`;
  if (type === 'air') return `${ability} moves the whole district in one breath.`;
  return `${ability} — note for the next squad run.`;
}

export function CardInspector({ card, onClose, bootstrap, variantId, initialPreviewVariant, match, useCachedProfile = false }: any) {
  const reduceMotion = useReducedMotion() || (typeof window !== 'undefined' && cardMotionReduced());
  card = match?.boards?.flat().find((current: CardInstance) => current.instanceId === card.instanceId) ?? card;
  const isInstance = 'instanceId' in card;
  const panel = React.useRef<HTMLDivElement>(null);
  // Escape transformed route containers while staying inside a native dialog's top layer.
  const [portalHost] = React.useState(() => typeof document === 'undefined' ? null
    : document.activeElement?.closest<HTMLDialogElement>('dialog[open]') ?? document.body);
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('[data-testid=button-close-inspector]')?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
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
  const [preview, setPreview] = React.useState<{ cardId: string; variant: string | null } | null>(initialPreviewVariant ? { cardId: card.id, variant: initialPreviewVariant } : null);
  const displayedVariant = preview && preview.cardId === card.id ? preview.variant : equippedVariant;
  const previewKind = getVariantKind(displayedVariant);
  const isPreview = (displayedVariant ?? null) !== (equippedVariant ?? null);
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

  const effectivePower = instance ? getEffectiveCardPower(instance) : card.power;
  const rarityLabel = catalogCard ? CARD_RARITY_DEFINITIONS[catalogCard.rarity].label : 'Standard';
  const finishLabel = catalogCard ? cardFinishLabel(catalogCard.rarity, previewKind) : 'Collector edition';
  const faction = catalogCard?.faction ?? 'Independent';
  const crewTags = catalogCard?.crewTags ?? [];
  const usedDecks = catalogCard
    ? bootstrap?.profile?.savedDecks?.filter((d: any) => d.cardIds.includes(catalogCard.catalogId)) ?? []
    : [];
  const isBattleMode = Boolean(match);
  const variantSlots = catalogCard?.variantSlots ?? [];

  const inspector = (
    <div ref={panel} data-notification-id={initialPreviewVariant ? `style:${initialPreviewVariant}` : undefined} role="dialog" aria-modal="true" aria-label={card.name + (match ? ' battle details' : ' card details')} className={'card-inspector-shell bg-black/95 backdrop-blur-xl ' + (match ? 'battle-inspector' : 'collection-inspector fighter-resume world-decor-host')} onClick={onClose} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const elements = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]') ?? [])].filter(element => element.getClientRects().length > 0);
        const first = elements[0], last = elements[elements.length-1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      {!match && <PageDecor theme={catalogCard?.rarity === 'Mythical' ? 'mythic' : 'profile'} compact />}
      <div className="collector-inspector-backdrop" style={{ backgroundImage: `url("${getCardWallpaper(card.type)}")` }} aria-hidden="true" />
      <button type="button" className="card-inspector-close" data-testid="button-close-inspector" aria-label="Close card details" onClick={event => { event.stopPropagation(); onClose(); }}><X size={22} aria-hidden="true" /><span>{match ? 'Back to battle' : 'Close details'}</span></button>
      <div className="card-inspector-scroll">
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : -20 }}
        className="card-inspector-layout relative my-auto w-full max-w-5xl flex items-start"
        onClick={e => e.stopPropagation()}
      >
        {/* ============================================================
            LEFT — Polaroid portrait
            ============================================================ */}
        <div className="collector-display-stack">
        <div className="polaroid mx-auto md:mx-0">
          <div className="polaroid__tape" aria-hidden="true" />
          <div className="polaroid__photo">
            <CardView
              card={card}
              covered={isCovered}
              variantId={displayedVariant ?? undefined}
              progress={progression}
              testId="card-inspector"
              inspectionLayout={instance && match && !reduceMotion ? 'battle-inspect-' + instance.instanceId : undefined}
              effectivePower={instance ? getEffectiveCardPower(instance) : undefined}
              isInspector
              presentationOnly
              className={`w-full h-full ${!match && bootstrap && !isCardOwned && catalogCard ? 'grayscale opacity-75' : ''}`}
            />
          </div>
          <div className="polaroid__caption">
            {card.name}
            <em>{finishLabel} · {rarityLabel}</em>
          </div>
          <p className="card-touch-hint">Drag the card to catch the light</p>
          <div className="collector-display-caption sr-only">
            <span>{catalogCard ? CARD_FINISH[catalogCard.rarity] : 'Collector edition'}</span>
            <small>Move across the card to catch the light</small>
          </div>
        </div>

          {variantSlots.length > 0 && <div className="collector-finish-controls">
            <div className="collector-finish-controls__label" aria-live="polite">{isPreview ? 'Finish preview' : 'Your finish'} · {finishLabel}</div>
            <nav aria-label="Preview card finish">
              <button type="button" aria-pressed={!displayedVariant} onClick={() => setPreview({cardId: card.id, variant: null})}>Original</button>
              {variantSlots.map((slot: any) => <button type="button" key={slot.id} data-finish={getVariantKind(slot.id)} aria-pressed={displayedVariant === slot.id} onClick={() => setPreview({cardId: card.id, variant: slot.id})}>{slot.name}</button>)}
            </nav>
            <small>Touch or hover to catch the light. Arrow keys work too.</small>
          </div>}
        </div>

        {/* ============================================================
            RIGHT — Paper dossier (the resume)
            ============================================================ */}
        <div className={`dossier-paper referee-clipboard relative w-full ${catalogCard ? getRarityClass(catalogCard.rarity) : ''}`}>
          <DrFadeReferee />
          <img
            className="dossier-brand"
            src={getAssetUrl('brand/prismatic/logos/squabblemon-wordmark-standard-gold.webp')}
            alt="Squabblemon"
            width={1440}
            height={469}
            draggable={false}
            decoding="async"
          />
          <span className="dossier-stripe" aria-hidden="true" />
          <span className="dossier-mark" aria-hidden="true" />

          {/* Top dossier banner */}
          <header className="dossier-banner">
            <span className="dossier-banner__tape">
              <span>Fighter Resume</span>
              <span>·</span>
              <span>File #{String(card.id || '').padEnd(4, '0').slice(0, 4)}</span>
            </span>
            <span className="dossier-banner__stamp" aria-hidden="true" />
            <span className="dossier-banner__meta">
              {canonicalElement(card.type)} class · {card.cost} motion · {rarityLabel}
            </span>
          </header>

          {/* Title plate */}
          <div>
            <div className="dossier-eyebrow">
              {isBattleMode ? 'Combat dossier' : 'Fighter dossier'} · {faction} faction
            </div>
            <h3 className="dossier-name">{card.name}</h3>
            <div className="dossier-handle">"#{String(card.id || '').slice(0, 6)} — filed by Dr. Fade's scout team"</div>
          </div>

          {/* Signature ability + stats row (moved UP from below the XP) */}
          <div className="dossier-ability-stats">
            {/* Sticky-note signature ability — moved up so it's the first thing the eye lands on */}
            <div className="dossier-sticky">
              <div className="dossier-sticky__label">Signature Ability</div>
              <div className="dossier-sticky__title">{card.ability}</div>
              <p className="dossier-sticky__copy">{card.effect}</p>
            </div>

            {/* Stat strip */}
            <div className="dossier-stats" role="list" aria-label="Fighter stats">
              <div className="dossier-stat" role="listitem">
                <span className="dossier-stat__pin" aria-hidden="true" />
                <div className="dossier-stat__label">Class</div>
                <div className="dossier-stat__value">{canonicalElement(card.type)}</div>
                <div className="dossier-stat__sub">Energy type</div>
              </div>
              <div className="dossier-stat" role="listitem">
                <span className="dossier-stat__pin" aria-hidden="true" />
                <div className="dossier-stat__label">Motion</div>
                <div className="dossier-stat__value">{card.cost}</div>
                <div className="dossier-stat__sub">Cost to play</div>
              </div>
              <div className="dossier-stat" role="listitem">
                <span className="dossier-stat__pin" aria-hidden="true" />
                <div className="dossier-stat__label">Hands</div>
                <div className="dossier-stat__value">{card.power}</div>
                <div className="dossier-stat__sub">Base power</div>
              </div>
              <div className="dossier-stat" role="listitem">
                <span className="dossier-stat__pin" aria-hidden="true" />
                <div className="dossier-stat__label">Rarity</div>
                <div className="dossier-stat__value" style={{ color: 'var(--rarity-color)' }}>{rarityLabel}</div>
                <div className="dossier-stat__sub">{finishLabel}</div>
              </div>
            </div>
          </div>

          {/* Battle vitals (instance mode only) */}
          {isBattleMode && instance && (
            <div className="dossier-vitals" style={{ '--rarity-color': 'var(--color-accent, #f43f5e)' } as React.CSSProperties}>
              <div className="dossier-vital">
                <div className="dossier-vital__label">Base</div>
                <div className="dossier-vital__value">{instance.basePower}</div>
              </div>
              <div className="dossier-vital">
                <div className="dossier-vital__label">Modifier</div>
                <div className="dossier-vital__value">{instance.powerModifier > 0 ? `+${instance.powerModifier}` : instance.powerModifier}</div>
              </div>
              <div className="dossier-vital">
                <div className="dossier-vital__label">Effective</div>
                <div className="dossier-vital__value">{effectivePower}</div>
              </div>
              <div className="dossier-vital">
                <div className="dossier-vital__label">Status</div>
                <div className="dossier-vital__value">
                  {instance.statuses.frozen ? 'FZN'
                    : instance.statuses.silenced ? 'SIL'
                    : isCovered ? 'COV'
                    : instance.statuses.protected ? 'PRT'
                    : instance.statuses.blocked ? 'BLK'
                    : 'OK'}
                </div>
              </div>
            </div>
          )}
          {instance && match && <BattlePowerBreakdown card={instance} match={match} />}

          {/* Tags row */}
          {catalogCard && (
            <div className="flex flex-wrap gap-2 mb-3">
              {(catalogCard.kind === 'support' || catalogCard.kind === 'blockbuster') && (
                <span className="font-mono text-[9px] uppercase tracking-widest border px-2 py-1 bg-white/70" style={{ borderColor: 'var(--resume-ink-soft)', color: 'var(--resume-ink)' }}>
                  {catalogCard.kind === 'blockbuster' ? 'Blockbuster · Lane Event' : 'Support card'}
                </span>
              )}
              {crewTags.map((tag: string) => (
                <span
                  key={tag}
                  className="font-mono text-[9px] uppercase tracking-widest border px-2 py-1 bg-white/55"
                  style={{ borderColor: 'var(--resume-ink-soft)', color: 'var(--resume-ink-soft)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* XP progress (collection only) */}
          {isCardOwned && progression && !isBattleMode && (
            <div className="mb-5 border border-black/15 bg-white/55 p-3">
              <CardProgress progress={progression} />
            </div>
          )}

          {/* Scout's notes */}
          <div className="dossier-notes">
            <div className="dossier-notes__head">Scout's Notes</div>
            {scoutNote(card)}
          </div>

          {/* Ability Upgrades as a "Fight record" */}
          {catalogCard && (
            <section className="dossier-section">
              <div className="dossier-section__head">
                <h4>Ability Upgrades</h4>
                <em>learned moves from Dr. Fade's gym</em>
              </div>
              <div className="border border-black/15 bg-white/45 p-2">
                <CardUpgrades card={catalogCard} progress={progression} activeUpgradeIds={matchUpgradeIds} />
              </div>
              {isCardOwned && !match && (
                <Link
                  href={`/game/shop?card=${catalogCard.catalogId}`}
                  onClick={onClose}
                  className="mt-3 inline-block font-marker text-sm uppercase tracking-wider"
                  style={{ color: 'var(--resume-red)' }}
                >
                  Train XP & learn moves at Dr. Fade's →
                </Link>
              )}
            </section>
          )}

          {/* Acquisition + Used-in-decks */}
          {bootstrap && catalogCard && (
            <section className="dossier-section">
              <div className="dossier-section__head">
                <h4>Fight Record</h4>
                <em>where to find them & where they fight</em>
              </div>
              <div className="dossier-table">
                {(catalogCard.acquisitionSources ?? []).map((source: string, i: number) => (
                  <div key={`src-${i}`} className="dossier-table__row">
                    <div>
                      <b>{source}</b>
                    </div>
                    <small>Scouted</small>
                  </div>
                ))}
                {usedDecks.length > 0 ? (
                  usedDecks.map((deck: any) => (
                    <div key={`deck-${deck.id}`} className="dossier-table__row">
                      <div>
                        <b>{deck.name}</b>
                        <small style={{ marginLeft: 8 }}>active deck</small>
                      </div>
                      <small>In rotation</small>
                    </div>
                  ))
                ) : (
                  <div className="dossier-table__row" style={{ gridTemplateColumns: '1fr' }}>
                    <small style={{ color: 'var(--resume-ink-soft)' }}>Not on any saved decks yet — pull 'em into a gang.</small>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Variants */}
          {variantSlots.length > 0 && (
            <section className="dossier-section">
              <div className="dossier-section__head">
                <h4>Variants & Crafting</h4>
                <em>collector finishes · crafted with Style Shards</em>
              </div>
              <div className="dossier-variants">
                {variantSlots.map((slot: any) => {
                  const isOwned = bootstrap?.profile?.ownedVariants?.includes(slot.id);
                  const canAfford = (bootstrap?.profile?.styleShards ?? 0) >= slot.shardCost;
                  return (
                    <article key={slot.id} className="dossier-variant" data-finish={getVariantKind(slot.id)}>
                      <button type="button" className="dossier-variant__preview" aria-label={`Preview ${slot.name} finish`} aria-pressed={displayedVariant === slot.id} onClick={() => setPreview({cardId: card.id, variant: slot.id})}>
                        <CardView card={card} variantId={slot.id} fillContainer presentationOnly disableLayout />
                        <span>Preview finish</span>
                      </button>
                      <div className="dossier-variant__cost">
                        {isOwned ? (equippedVariant === slot.id ? 'Equipped' : 'Unlocked') : `${slot.shardCost} Shards`}
                      </div>
                      <h5>{slot.name}</h5>
                      <p>{VARIANT_FINISH[getVariantKind(slot.id) ?? 'tagged'].description}</p>
                      {bootstrap && catalogCard && (
                        isOwned ? (
                          <button
                            onClick={() => handleEquip(equippedVariant === slot.id ? null : slot.id)}
                            disabled={equipVariant.isPending}
                            className={equippedVariant === slot.id ? 'is-equipped' : ''}
                          >
                            {equipVariant.isPending ? 'Saving…' : equippedVariant === slot.id ? 'Equipped · Tap to remove' : `Equip ${slot.name}`}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCraft(slot.id)}
                            disabled={!canAfford || craftVariant.isPending || !isCardOwned}
                          >
                            {!isCardOwned ? 'Unlock card first' : craftVariant.isPending ? 'Crafting…' : canAfford ? 'Craft Variant' : 'Not enough shards'}
                          </button>
                        )
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {catalogCard && <CardRarityTreatment rarity={catalogCard.rarity} />}
        </div>
      </motion.div>
      </div>
    </div>
  );
  return portalHost ? createPortal(inspector, portalHost) : inspector;
}
