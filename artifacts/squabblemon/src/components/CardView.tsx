import { BattleStatus } from './BattleEffects';
import { DrFadeArt } from './DrFadeArt';
import React from 'react';
import { motion } from 'framer-motion';
import { CardInstance } from '../gameEngine';
import { Shield, Ban, VolumeX, Snowflake, Wind, Flame, TrendingDown, LockKeyhole, Sparkles } from 'lucide-react';
import { CardVariantTreatment, getVariantKind } from './CardVariantTreatment';
import { CardProgress } from './CardProgress';
import type { CardProgress as CardProgressValue } from '@workspace/squabblemon-engine/cardProgression';
import { CardRarityTreatment, getCardRarity, getRarityClass } from './CardRarityTreatment';
import { CardUpgradeCue } from './CardUpgrades';
import { Card, getCardImage, getBuddySquabbleImage } from '../data';
import { canonicalElement, cardEntryAccent } from '@workspace/squabblemon-engine/data';
import { CARD_RARITY_DEFINITIONS } from '../data';
import { cardFinishLabel, cardMotionReduced, getCardWallpaper } from '../lib/cardFinish';
import { CardFoil } from './CardFoil';
import { useCardInspection } from './CardInspection';
import './card-finish.css';
import { useCardScene } from './CosmeticContext';

interface CardViewProps {
  card: Card | CardInstance;
  queued?: boolean;
  squabble?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onInspect?: () => void;
  inspectable?: boolean;
  testId?: string;
  className?: string;
  isBoard?: boolean;
  isEnemy?: boolean;
  effectivePower?: number;
  cost?: number;
  highlighted?: boolean;
  effectRole?: 'source' | 'target';
  effectKind?: 'ability' | 'fire' | 'water' | 'move' | 'blocked' | 'story';
  disableLayout?: boolean;
  inspectionLayout?: string;
  unavailable?: boolean;
  disabledReason?: string;
  variantId?: string;
  progress?: CardProgressValue;
  isInspector?: boolean;
  fillContainer?: boolean;
  presentationOnly?: boolean;
  dragEnabled?: boolean;
  covered?: boolean;
  /** When true, the card is the source of an ability and should burst on entry. */
  entryBurst?: boolean;
  backgroundUrl?: string;
  /** Score position relative to opponent's score in this lane. Used to lean/breath. */
  scoreStance?: 'leading' | 'trailing' | 'tied';
  /** Show the per-card portrait pop animation on first hand-draw render. */
  portraitPop?: boolean;
  /** Current match round, used to show Buddy's temporary form countdown. */
  currentRound?: number;
}

function CardViewComponent({
  card, queued, squabble, onClick, onInspect, inspectable, testId, className = '',
  isBoard, isEnemy, effectivePower, cost, highlighted,
  effectRole, effectKind, disableLayout, unavailable, inspectionLayout,
  disabledReason, variantId, progress, isInspector,
  fillContainer, presentationOnly, dragEnabled = false, covered = false,
  entryBurst, scoreStance, portraitPop, backgroundUrl, currentRound,
}: CardViewProps) {
  const inspection = useCardInspection(card, inspectable ?? (!presentationOnly && !isInspector), onInspect, variantId);
  const equippedScene = useCardScene(card.id);
  const isInstance = 'instanceId' in card;
  const instance = isInstance ? card as CardInstance : null;
  const isBuddyBud = !!instance?.buddyBud || instance?.cardId === 'buddy-bud' || card.id === 'buddy-bud';
  const buddyRockForm = instance?.cardId === 'buddy' && instance.buddyForm === 'squabble-earth';
  const buddyTurnsRemaining = buddyRockForm && instance.buddyEarthExpiresAtRound !== undefined && currentRound !== undefined
    ? Math.max(0, instance.buddyEarthExpiresAtRound - currentRound)
    : null;
  const buddyGrowthTurns = instance?.buddyGrowthAtRound !== undefined && currentRound !== undefined
    ? Math.max(0, instance.buddyGrowthAtRound - currentRound)
    : null;
  const buddyCue = instance?.cardId === 'buddy'
    ? buddyRockForm
      ? `SQUABBLE · EARTH${buddyTurnsRemaining === null ? '' : buddyTurnsRemaining ? ` · ${buddyTurnsRemaining}T` : ' · ENDED'}`
      : `PLANT · −1 MOTION${buddyGrowthTurns === null ? '' : buddyGrowthTurns ? ` · +3 IN ${buddyGrowthTurns}T` : ' · +3 READY'}`
    : '';
  const buddyDescription = buddyCue
    ? buddyRockForm
      ? `Squabble form: enemies lose 1 Hand and friendly Earth cards gain 2 Hands${buddyTurnsRemaining === null ? ' for two turns' : buddyTurnsRemaining ? ` · ${buddyTurnsRemaining} turn${buddyTurnsRemaining === 1 ? '' : 's'} remaining` : ' · the two-turn effect has expired'}.`
      : `Plant form: costs 1 less Motion in this lane. ${buddyGrowthTurns === null ? 'After two rounds Buddy gains 3 Hands and plants two or three Buddy Buds.' : buddyGrowthTurns ? `Buddy gains 3 Hands and the planted Buds sprout in ${buddyGrowthTurns} turn${buddyGrowthTurns === 1 ? '' : 's'}.` : 'Buddy has gained 3 Hands and the planted Buds are sprouting.'} Each sprouted Bud gives +3 Hands to the last eligible friendly card summoned in its district.`
    : '';
  const buddyBudTurns = instance?.buddyBud && currentRound !== undefined
    ? Math.max(0, instance.buddyBud.sproutsAtRound - currentRound)
    : null;
  const buddyBudCue = isBuddyBud
    ? instance?.buddyBud?.sprouted
      ? 'SPROUTED · NO TARGET'
      : `BUD PLANTED${buddyBudTurns === null ? '' : ` · ${buddyBudTurns}T`} · +3 LAST SUMMON`
    : '';
  const buddyBudDescription = isBuddyBud
    ? instance?.buddyBud?.sprouted
      ? 'Buddy Bud sprouted, but no eligible friendly character was available; it granted no Hands.'
      : `Buddy Bud planted in this district${instance?.buddyBud && buddyBudTurns !== null ? `; matures in ${buddyBudTurns} turn${buddyBudTurns === 1 ? '' : 's'} (round ${instance.buddyBud.sproutsAtRound})` : instance?.buddyBud ? `; matures in round ${instance.buddyBud.sproutsAtRound}` : ''}. Gives +3 Hands to the last eligible friendly card summoned here when it sprouts.`
    : '';

  const chargeLabel = instance?.cardId === 'powerhouse' ? 'Overtime ' + (instance.bankedMotion ?? 0) + '/3'
    : instance?.aliceReady ? 'Next play: +3 Hands' : '';
  const fuseRound = instance?.smileBomb?.detonatesAtRound;
  const fuseDescription = isBuddyBud ? ` ${buddyBudDescription}` : card.hazard ? ` Explodes ${fuseRound ? `at the start of round ${fuseRound}` : "next round"}: -1 Hand to one random enemy here. Adds no lane Hands.` : "";
  const displayPower = card.hazard ? 0 : effectivePower ?? card.power;
  const displayCost = cost ?? card.cost;
  const motionLabel = isBuddyBud ? 'Matures' : card.hazard ? 'Explodes' : 'Motion';
  const motionValue = isBuddyBud && instance?.buddyBud
    ? `R${instance.buddyBud.sproutsAtRound}`
    : card.hazard ? fuseRound ? `R${fuseRound}` : 'Next' : displayCost;

  const isFrozen = instance?.statuses?.frozen;
  const isSilenced = instance?.statuses?.silenced;
  const isProtected = instance?.statuses?.protected && !covered;
  const isBlocked = instance?.statuses?.blocked;
  const burnStacks = instance?.statuses?.burnStacks ?? 0;
  const isWeakened = instance?.statuses?.weakened;
  const isLocked = instance?.statuses?.locked;
  const isBoosted = instance?.statuses?.boosted;
  const isMoved = instance?.moved;
  const boardStatusLabel = [
    chargeLabel,
    buddyDescription,
    buddyBudDescription,
    covered ? 'Covered.' : isProtected ? 'Protected.' : '',
    isBlocked ? 'Blocked.' : '',
    isSilenced ? 'Silenced.' : '',
    isFrozen ? 'Frozen.' : '',
    burnStacks > 0 ? `Burning: ${burnStacks} burn stack${burnStacks === 1 ? '' : 's'}.` : '',
    isWeakened ? 'Weakened.' : '',
    isLocked ? 'Locked.' : '',
    isBoosted ? 'Boosted.' : '',
    isMoved ? 'Moved.' : '',
  ].filter(Boolean).join(' ');
  const powerModifier = instance?.powerModifier ?? 0;
  const variantKind = getVariantKind(variantId);
  const rarity = getCardRarity(instance?.cardId ?? card.id, card.kind);
  const entryAccent = cardEntryAccent(card);

  const isLarge = isInspector || (!isBoard && !className.includes('w-[64px]'));
  const MotionElement = presentationOnly ? motion.div : motion.button;

  const aliveClass = isBoard && !isFrozen && !isSilenced && !isBlocked
    ? (isEnemy ? 'is-alive-rival' : 'is-alive-owner')
    : '';
  const stanceClass = isBoard && scoreStance === 'leading' ? 'is-leading' : isBoard && scoreStance === 'trailing' ? 'is-trailing' : '';
  const burstClass = entryBurst ? (isEnemy ? 'entry-burst--rival' : 'entry-burst') : '';
  const popClass = portraitPop ? 'portrait-pop' : '';
  const tactile = !unavailable && (!isBoard || fillContainer || isInspector);
  const moveFoil = (event: React.PointerEvent<HTMLElement>) => {
    if (!tactile || cardMotionReduced() || (event.pointerType === 'touch' && !isInspector)) return;
    const node = event.currentTarget;
    node.dataset.tilting = 'true';
    const rect = node.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    node.style.setProperty('--foil-x', `${x * 100}%`);
    node.style.setProperty('--foil-y', `${y * 100}%`);
    node.style.setProperty('--tilt-x', `${(0.5 - y) * 13}deg`);
    node.style.setProperty('--tilt-y', `${(x - 0.5) * 17}deg`);
  };
  const resetFoil = (event: React.PointerEvent<HTMLElement>) => {
    delete event.currentTarget.dataset.tilting;
    for (const key of ['--foil-x', '--foil-y', '--tilt-x', '--tilt-y']) event.currentTarget.style.removeProperty(key);
  };

  return (
    <><MotionElement
      {...inspection.props}
      layoutId={inspectionLayout ?? (disableLayout ? undefined : instance?.instanceId)}
      layout={!disableLayout}
      transition={{ layout: { type: 'spring', stiffness: 420, damping: 28 }, duration: 0.2 }}
      data-testid={testId ?? `card-${card.id}`}
      data-card-id={card.id}
      data-instance-id={instance?.instanceId}
      data-card-cost={displayCost}
      data-card-power={displayPower}
      data-battle-draggable={dragEnabled && !presentationOnly ? true : undefined}
      data-card-zone={isBoard ? 'board' : 'hand'}
      data-card-variant={variantKind ?? 'base'}
      data-card-rarity={rarity}
      data-card-kind={card.kind ?? 'character'}
      data-buddy-form={buddyCue ? (buddyRockForm ? 'squabble' : 'plant') : undefined}
      data-bomb-round={fuseRound}
      data-frozen={isFrozen ? true : undefined}
      data-card-finish={cardFinishLabel(rarity, variantKind)}
      tabIndex={isInspector ? 0 : undefined}
      onPointerDown={event => {
        inspection.props.onPointerDown?.(event);
        if (isInspector && !cardMotionReduced()) { event.currentTarget.setPointerCapture(event.pointerId); moveFoil(event); }
      }}
      onPointerUp={event => {
        if (isInspector) { resetFoil(event); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }
      }}
      onPointerMove={moveFoil}
      onPointerLeave={resetFoil}
      onPointerCancel={resetFoil}
      aria-label={`${card.name}. ${card.kind === 'token' ? 'Summoned token' : CARD_RARITY_DEFINITIONS[rarity].label + ' rarity'}.${boardStatusLabel ? ` ${boardStatusLabel}` : ''}${fuseDescription}${covered ? ' Covered until the next targeted hostile ability.' : ''}${disabledReason ? ` ${disabledReason}` : ''}`}
      aria-pressed={!isBoard && !isInspector && !presentationOnly ? !!queued : undefined}
      title={disabledReason ?? (card.hazard ? fuseDescription.trim() : undefined)}
      onClick={presentationOnly ? undefined : onClick}
      whileHover={presentationOnly ? undefined : !isBoard && !isInspector ? { y: -12, scale: 1.05, zIndex: 50 } : isBoard ? { scale: 1.05 } : {}}
      whileTap={presentationOnly ? undefined : !isInspector ? { scale: 0.95 } : {}}
      className={`
        collector-card relative shrink-0 flex flex-col justify-end text-left group
        ${tactile ? 'collector-card--tactile' : ''}
        ${isInspector ? 'collector-card--inspector' : ''}
        ${card.name.length > 24 ? 'collector-card--long-name' : ''}
        ${fillContainer ? 'w-full aspect-[63/88]' : isBoard ? `battle-board-card w-[64px] sm:w-[78px] lg:w-[96px] aspect-[63/88] ${aliveClass} ${stanceClass}` : isInspector ? className : 'battle-hand-card w-[100px] md:w-[136px] aspect-[63/88] shadow-xl shadow-black/80'}
        ${queued ? 'scale-105 -translate-y-2 z-50 ring-2 ring-primary ring-offset-2 ring-offset-black' : 'z-10'}
        ${squabble ? 'card-squabble-armed' : ''}
        ${unavailable ? 'opacity-50 grayscale contrast-125' : ''}
        ${highlighted || effectRole === 'source' ? 'effect-source' : ''}
        ${effectRole === 'target' ? 'effect-target' : ''}
        ${effectKind ? `effect-kind-${effectKind}` : ''}
        ${variantKind ? `card-variant card-variant-${variantKind}` : ''}
        ${burstClass}
        ${popClass}
        ${getRarityClass(rarity)}
        ${isInspector || fillContainer ? '' : className}
      `}
      style={{ ['--entry-color' as any]: entryAccent }}
    >
      {isBoard && <BattleStatus frozen={isFrozen} silenced={isSilenced} protected={isProtected || covered} />}
      <div className={`collector-frame absolute inset-0 p-[2px] md:p-[3px] transition-colors duration-300 card-bevel
        ${queued && squabble ? 'bg-accent shadow-[0_0_30px_theme(colors.accent.DEFAULT)]' : queued ? 'bg-primary' : 'bg-zinc-700 group-hover:bg-zinc-400'}
        ${isEnemy && !queued ? 'bg-accent/40 group-hover:bg-accent/70' : ''}
        ${isFrozen ? 'border border-blue-400 ring-2 ring-blue-500/50' : ''}
        ${isInspector ? 'bg-gradient-to-br from-zinc-600 to-zinc-900' : ''}
      `}>
        <div className="relative w-full h-full bg-zinc-950 card-bevel-inner overflow-hidden flex flex-col group/inner">
          <img src={backgroundUrl ?? (!isEnemy && (!instance || instance.owner === 'player') ? equippedScene : undefined) ?? getCardWallpaper(card.type)} alt="" loading="lazy" decoding="async" draggable={false} className="collector-wallpaper" />
          <div className="collector-atmosphere" aria-hidden="true" />
          <div className="absolute inset-0 bg-[image:var(--rarity-pattern)] opacity-20 mix-blend-screen pointer-events-none z-0" />

          <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/5 font-display font-black text-5xl md:text-7xl italic uppercase pointer-events-none z-0 whitespace-nowrap rotate-[-15deg]">
            {canonicalElement(card.type)}
          </div>

          <div className={`absolute inset-0 bg-gradient-to-t from-zinc-900 to-zinc-800/20 ${isEnemy ? 'hue-rotate-180 brightness-50' : ''} ${isFrozen ? 'brightness-150 saturate-50 hue-rotate-180 mix-blend-hard-light' : ''} z-0`} />
          {card.id === 'dr-fade' && (!isBoard || fillContainer || isInspector)
            ? <DrFadeArt className={'collector-portrait ' + (isSilenced ? 'grayscale' : '')} animated={!isSilenced && !isFrozen} />
            : <img
                src={isBuddyBud ? getCardImage('buddy') : buddyRockForm ? getBuddySquabbleImage() : getCardImage(card.id, variantId)}
                alt=""
                 draggable={false}
                className={`collector-portrait absolute inset-x-0 bottom-[10%] w-full h-[85%] object-contain object-bottom transition-transform duration-500 z-10 ${isSilenced ? 'grayscale' : ''} ${!isInspector && 'group-hover/inner:scale-[1.03]'} ${isInspector ? 'collector-portrait--inspector' : ''}`}
              />}

          <div className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-black via-black/80 to-transparent z-10 pointer-events-none" />

          <div className="card-stat-pair absolute top-0 inset-x-0 flex justify-between z-20 pointer-events-none">
            <div className="bg-primary text-black px-1.5 py-1 min-w-[1.5rem] md:min-w-[2.25rem] flex flex-col items-center justify-center shadow-md border-r border-b border-black/30" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}>
              {isLarge && <span className="text-[5px] md:text-[7px] font-mono uppercase tracking-widest leading-none opacity-80 mb-0.5">{motionLabel}</span>}
              <span className={`font-display font-black leading-none ${isBoard ? 'text-sm' : 'text-lg md:text-xl'}`}>{motionValue}</span>
            </div>

            <div className={`px-1.5 py-1 min-w-[1.5rem] md:min-w-[2.25rem] flex flex-col items-center justify-center shadow-md border-l border-b border-black/30 ${powerModifier > 0 ? 'bg-green-400 text-black' : powerModifier < 0 ? 'bg-accent text-white' : 'bg-zinc-200 text-black'}`} style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}>
              {isLarge && <span className="text-[5px] md:text-[7px] font-mono uppercase tracking-widest leading-none opacity-80 mb-0.5">{isBuddyBud ? 'Payoff' : 'Hands'}</span>}
              <span className={`font-display font-black leading-none ${isBoard ? 'text-sm' : 'text-lg md:text-xl'}`}>{isBuddyBud ? '+3' : displayPower}</span>
              {powerModifier !== 0 && isBoard && (
                <span className="text-[5px] font-mono font-bold block -mt-0.5 tracking-tighter">
                  {powerModifier > 0 ? `+${powerModifier}` : powerModifier}
                </span>
              )}
            </div>
          </div>

          {chargeLabel && <span className="absolute top-[24%] inset-x-1 z-20 rounded bg-black/85 px-1 py-0.5 text-center font-mono text-[7px] font-bold text-cyan-100" data-testid="card-charge">{chargeLabel}</span>}
          {(buddyCue || buddyBudCue) && !isInspector && <span
            className={`buddy-form-cue absolute left-1 right-1 top-[25%] z-20 ${buddyRockForm ? 'buddy-form-cue--squabble' : ''} ${isBuddyBud ? 'buddy-form-cue--bud' : ''}`}
            data-testid="buddy-form-cue"
            title={isBuddyBud ? buddyBudDescription : buddyDescription}
          >{isBuddyBud ? buddyBudCue : buddyCue}</span>}
          {isBoard && (
            <div className="card-status-stack absolute top-[28px] right-1 z-20 pointer-events-none" aria-hidden="true">
              {covered && <div data-card-status="covered" title="Covered" className="card-status bg-amber-200 text-black ring-1 ring-amber-500"><Shield size={8} strokeWidth={3} /></div>}
              {isProtected && <div data-card-status="protected" title="Protected this round" className="card-status bg-yellow-400 text-black"><Shield size={8} strokeWidth={3} /></div>}
              {isBlocked && <div data-card-status="blocked" title="Blocked" className="card-status bg-accent text-white"><Ban size={8} strokeWidth={3} /></div>}
              {isSilenced && <div data-card-status="silenced" title="Silenced" className="card-status bg-zinc-600 text-white"><VolumeX size={8} strokeWidth={3} /></div>}
              {isFrozen && <div data-card-status="frozen" title="Frozen" className="card-status bg-blue-400 text-black"><Snowflake size={8} strokeWidth={3} /></div>}
              {burnStacks > 0 && <div data-card-status="burn" title={`Burning: ${burnStacks} burn stack${burnStacks === 1 ? '' : 's'}`} className="card-status bg-orange-500 text-black"><Flame size={8} strokeWidth={3} /><span>{burnStacks}</span></div>}
              {isWeakened && <div data-card-status="weakened" title="Weakened" className="card-status bg-rose-400 text-black"><TrendingDown size={8} strokeWidth={3} /></div>}
              {isLocked && <div data-card-status="locked" title="Locked" className="card-status bg-slate-200 text-black"><LockKeyhole size={8} strokeWidth={3} /></div>}
              {isBoosted && <div data-card-status="boosted" title="Boosted" className="card-status bg-emerald-400 text-black"><Sparkles size={8} strokeWidth={3} /></div>}
              {isMoved && <div data-card-status="moved" title="Moved" className="card-status bg-purple-500 text-white"><Wind size={8} strokeWidth={3} /></div>}
            </div>
          )}

          <div className={`collector-card-copy absolute inset-x-0 bottom-0 p-1.5 md:p-2.5 z-20 flex flex-col justify-end pointer-events-none ${isInspector ? 'collector-card-copy--inspector' : ''}`}>
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <span className={`font-mono uppercase text-[4.5px] md:text-[6px] tracking-widest px-1 py-0.5 bg-black/80 text-white border border-[var(--rarity-color)] leading-none shadow-sm`}>
                <span aria-hidden="true" className="collector-tier-cue">{CARD_RARITY_DEFINITIONS[rarity].cue} </span>{card.kind === 'token' ? 'Summon' : CARD_RARITY_DEFINITIONS[rarity].label}
              </span>
              <span className="font-mono uppercase text-[4.5px] md:text-[6px] tracking-widest text-[var(--rarity-color)] leading-none bg-black/40 px-1 py-0.5">
                {card.kind === 'support' ? `Support · ${canonicalElement(card.type)}` : canonicalElement(card.type)}
              </span>
              {variantKind && (
                <span className="font-mono uppercase text-[4.5px] md:text-[6px] tracking-widest px-1 py-0.5 bg-black/80 text-[var(--rarity-color)] border border-white/20 leading-none shadow-sm ml-auto">
                  {variantKind}
                </span>
              )}
            </div>

            <h4 className={`font-display font-black uppercase italic leading-[0.95] text-white ${isBoard ? 'text-[9px] sm:text-[11px]' : 'text-sm md:text-lg drop-shadow-md'}`}>
              {card.name}
            </h4>

            {(isInspector || (!isBoard && !presentationOnly)) && (
               <div className={`collector-card-ability mt-1 border-t border-white/15 pt-1 ${isInspector ? '' : 'opacity-90'}`}>
                 <div className={`font-mono tracking-widest text-primary mb-0.5 uppercase ${isInspector ? 'text-[7px] md:text-[8px]' : 'text-[5px] md:text-[6px]'}`}>{card.ability}</div>
                 <div className={`text-white/75 leading-tight font-sans ${isInspector ? '' : 'line-clamp-2'} ${isInspector ? 'text-[8px] md:text-[10px]' : 'text-[6px] md:text-[7px]'}`}>{card.effect}</div>
               </div>
            )}

            {progress && (
              <div className="mt-1 md:mt-1.5">
                <CardUpgradeCue card={card as any} progress={progress as any} className="mb-0.5 text-[6px]" />
                <CardProgress progress={progress} compact={!isInspector} className="w-full" />
              </div>
            )}
          </div>

          <CardRarityTreatment rarity={rarity} />
          <span className="collector-art-rim" aria-hidden="true" />
          <span className="collector-engraving" aria-hidden="true" />
          <span className="collector-edition-seal" aria-hidden="true">SM</span>
          <CardVariantTreatment variantId={variantId} />
          <span className="collector-foil" aria-hidden="true" />
          <span className="collector-foil-pattern" aria-hidden="true" />
          <span className="collector-foil-grain" aria-hidden="true" />
          <span className="collector-glare" aria-hidden="true" />
          {isInspector && (rarity !== 'SuperCommon' || variantKind) && <CardFoil tier={CARD_RARITY_DEFINITIONS[rarity].order + 1} />}
        </div>
      </div>
    </MotionElement>{inspection.dialog}</>
  );
}

function cardViewPropsEqual(previous: CardViewProps, next: CardViewProps) {
  return previous.card === next.card
    && previous.onClick === next.onClick
    && previous.onInspect === next.onInspect
    && previous.inspectable === next.inspectable
    && previous.dragEnabled === next.dragEnabled
    && previous.queued === next.queued
    && previous.squabble === next.squabble
    && previous.testId === next.testId
    && previous.className === next.className
    && previous.isBoard === next.isBoard
    && previous.isEnemy === next.isEnemy
    && previous.effectivePower === next.effectivePower
    && previous.cost === next.cost
    && previous.highlighted === next.highlighted
    && previous.effectRole === next.effectRole
    && previous.effectKind === next.effectKind
    && previous.inspectionLayout === next.inspectionLayout
    && previous.disableLayout === next.disableLayout
    && previous.unavailable === next.unavailable
    && previous.disabledReason === next.disabledReason
    && previous.variantId === next.variantId
    && previous.progress === next.progress
    && previous.isInspector === next.isInspector
    && previous.fillContainer === next.fillContainer
    && previous.presentationOnly === next.presentationOnly
    && previous.covered === next.covered
    && previous.backgroundUrl === next.backgroundUrl
    && previous.entryBurst === next.entryBurst
    && previous.scoreStance === next.scoreStance
    && previous.portraitPop === next.portraitPop
    && previous.currentRound === next.currentRound;
}

export const CardView = React.memo(CardViewComponent, cardViewPropsEqual);
