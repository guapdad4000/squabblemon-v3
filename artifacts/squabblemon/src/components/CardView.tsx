import React from 'react';
import { motion } from 'framer-motion';
import { CardInstance } from '../gameEngine';
import { Shield, Ban, VolumeX, Snowflake, Wind } from 'lucide-react';
import { CardVariantTreatment, getVariantKind } from './CardVariantTreatment';
import { CardProgress } from './CardProgress';
import type { CardProgress as CardProgressValue } from '@workspace/squabblemon-engine/cardProgression';
import { CardRarityTreatment, getCardRarity, getRarityClass } from './CardRarityTreatment';
import { CardUpgradeCue } from './CardUpgrades';
import { Card, getCardImage } from '../data';

interface CardViewProps {
  card: Card | CardInstance;
  queued?: boolean;
  squabble?: boolean;
  onClick?: (e: React.MouseEvent) => void;
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
  unavailable?: boolean;
  disabledReason?: string;
  variantId?: string;
  progress?: CardProgressValue;
  isInspector?: boolean;
  fillContainer?: boolean;
  presentationOnly?: boolean;
  covered?: boolean;
}

function CardViewComponent({
  card, queued, squabble, onClick, testId, className = '',
  isBoard, isEnemy, effectivePower, cost, highlighted,
  effectRole, effectKind, disableLayout, unavailable,
  disabledReason, variantId, progress, isInspector,
  fillContainer, presentationOnly, covered = false,
}: CardViewProps) {
  const isInstance = 'instanceId' in card;
  const instance = isInstance ? card as CardInstance : null;

  const displayPower = effectivePower ?? card.power;
  const displayCost = cost ?? card.cost;

  const isFrozen = instance?.statuses?.frozen;
  const isSilenced = instance?.statuses?.silenced;
  const isProtected = instance?.statuses?.protected && !covered;
  const isBlocked = instance?.statuses?.blocked;
  const isMoved = instance?.moved;
  const powerModifier = instance?.powerModifier ?? 0;
  const variantKind = getVariantKind(variantId);
  const rarity = getCardRarity(card.id);

  const isLarge = isInspector || (!isBoard && !className.includes('w-[64px]'));
  const MotionElement = presentationOnly ? motion.div : motion.button;

  return (
    <MotionElement
      layoutId={disableLayout ? undefined : instance?.instanceId}
      layout={!disableLayout}
      transition={{ layout: { type: 'spring', stiffness: 420, damping: 28 }, duration: 0.2 }}
      data-testid={testId ?? `card-${card.id}`}
      data-card-id={card.id}
      data-instance-id={instance?.instanceId}
      data-card-cost={displayCost}
      data-card-power={displayPower}
      data-card-zone={isBoard ? 'board' : 'hand'}
      data-card-variant={variantKind ?? 'base'}
      data-card-rarity={rarity}
      aria-label={`${card.name}. ${rarity} rarity.${covered ? ' Covered until the next targeted hostile ability.' : ''}${disabledReason ? ` ${disabledReason}` : ''}`}
      title={disabledReason}
      onClick={presentationOnly ? undefined : onClick}
      whileHover={presentationOnly ? undefined : !isBoard && !isInspector ? { y: -12, scale: 1.05, zIndex: 50 } : isBoard ? { scale: 1.05 } : {}}
      whileTap={presentationOnly ? undefined : !isInspector ? { scale: 0.95 } : {}}
      className={`
        relative shrink-0 flex flex-col justify-end text-left group
        ${fillContainer ? 'w-full aspect-[63/88]' : isBoard ? 'battle-board-card w-[64px] sm:w-[78px] lg:w-[96px] aspect-[63/88]' : isInspector ? className : 'battle-hand-card w-[100px] md:w-[136px] aspect-[63/88] shadow-xl shadow-black/80'}
        ${queued ? 'scale-105 -translate-y-2 z-50 ring-2 ring-primary ring-offset-2 ring-offset-black' : 'z-10'}
        ${squabble ? 'card-squabble-armed' : ''}
        ${unavailable ? 'opacity-50 grayscale contrast-125' : ''}
        ${highlighted || effectRole === 'source' ? 'effect-source' : ''}
        ${effectRole === 'target' ? 'effect-target' : ''}
        ${effectKind ? `effect-kind-${effectKind}` : ''}
        ${variantKind ? `card-variant card-variant-${variantKind}` : ''}
        ${getRarityClass(rarity)}
        ${isInspector || fillContainer ? '' : className}
      `}
    >
      <div className={`absolute inset-0 p-[2px] md:p-[3px] transition-colors duration-300 card-bevel
        ${queued && squabble ? 'bg-accent shadow-[0_0_30px_theme(colors.accent.DEFAULT)]' : queued ? 'bg-primary' : 'bg-zinc-700 group-hover:bg-zinc-400'}
        ${isEnemy && !queued ? 'bg-accent/40 group-hover:bg-accent/70' : ''}
        ${isFrozen ? 'border border-blue-400 ring-2 ring-blue-500/50' : ''}
        ${isInspector ? 'bg-gradient-to-br from-zinc-600 to-zinc-900' : ''}
      `}>
        <div className="relative w-full h-full bg-zinc-950 card-bevel-inner overflow-hidden flex flex-col group/inner">
          <div className="absolute inset-0 bg-[image:var(--rarity-pattern)] opacity-20 mix-blend-screen pointer-events-none z-0" />

          <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/5 font-display font-black text-5xl md:text-7xl italic uppercase pointer-events-none z-0 whitespace-nowrap rotate-[-15deg]">
            {card.type}
          </div>

          <div className={`absolute inset-0 bg-gradient-to-t from-zinc-900 to-zinc-800/20 ${isEnemy ? 'hue-rotate-180 brightness-50' : ''} ${isFrozen ? 'brightness-150 saturate-50 hue-rotate-180 mix-blend-hard-light' : ''} z-0`} />
          <img
            src={getCardImage(card.id)}
            alt=""
            className={`absolute inset-x-0 bottom-[10%] w-full h-[85%] object-contain object-bottom transition-transform duration-500 z-10 ${isSilenced ? 'grayscale' : ''} ${!isInspector && 'group-hover/inner:scale-[1.03]'} ${isInspector ? 'scale-[1.05]' : ''}`}
          />

          <div className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-black via-black/80 to-transparent z-10 pointer-events-none" />

          <div className="absolute top-0 inset-x-0 flex justify-between z-20 pointer-events-none">
            <div className="bg-primary text-black px-1.5 py-1 min-w-[1.5rem] md:min-w-[2.25rem] flex flex-col items-center justify-center shadow-md border-r border-b border-black/30" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}>
              {isLarge && <span className="text-[5px] md:text-[7px] font-mono uppercase tracking-widest leading-none opacity-80 mb-0.5">Hype</span>}
              <span className={`font-display font-black leading-none ${isBoard ? 'text-sm' : 'text-lg md:text-xl'}`}>{displayCost}</span>
            </div>

            <div className={`px-1.5 py-1 min-w-[1.5rem] md:min-w-[2.25rem] flex flex-col items-center justify-center shadow-md border-l border-b border-black/30 ${powerModifier > 0 ? 'bg-green-400 text-black' : powerModifier < 0 ? 'bg-accent text-white' : 'bg-zinc-200 text-black'}`} style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}>
              {isLarge && <span className="text-[5px] md:text-[7px] font-mono uppercase tracking-widest leading-none opacity-80 mb-0.5">Pwr</span>}
              <span className={`font-display font-black leading-none ${isBoard ? 'text-sm' : 'text-lg md:text-xl'}`}>{displayPower}</span>
              {powerModifier !== 0 && isBoard && (
                <span className="text-[5px] font-mono font-bold block -mt-0.5 tracking-tighter">
                  {powerModifier > 0 ? `+${powerModifier}` : powerModifier}
                </span>
              )}
            </div>
          </div>

          {isBoard && (
            <div className="absolute top-[28px] right-1 flex flex-col gap-0.5 z-20 pointer-events-none">
              {covered && <div data-card-status="covered" title="Covered" className="card-status bg-amber-200 text-black ring-1 ring-amber-500"><Shield size={8} strokeWidth={3} /></div>}
              {isProtected && <div data-card-status="protected" title="Protected this round" className="card-status bg-yellow-400 text-black"><Shield size={8} strokeWidth={3} /></div>}
              {isBlocked && <div className="card-status bg-accent text-white"><Ban size={8} strokeWidth={3} /></div>}
              {isSilenced && <div className="card-status bg-zinc-600 text-white"><VolumeX size={8} strokeWidth={3} /></div>}
              {isFrozen && <div className="card-status bg-blue-400 text-black"><Snowflake size={8} strokeWidth={3} /></div>}
              {isMoved && <div className="card-status bg-purple-500 text-white"><Wind size={8} strokeWidth={3} /></div>}
            </div>
          )}

          <div className="absolute bottom-0 inset-x-0 p-1.5 md:p-2.5 z-20 flex flex-col justify-end pointer-events-none">
            <div className="flex flex-wrap items-center gap-1 mb-1">
              <span className={`font-mono uppercase text-[4.5px] md:text-[6px] tracking-widest px-1 py-0.5 bg-black/80 text-white border border-[var(--rarity-color)] leading-none shadow-sm`}>
                {rarity}
              </span>
              <span className="font-mono uppercase text-[4.5px] md:text-[6px] tracking-widest text-[var(--rarity-color)] leading-none bg-black/40 px-1 py-0.5">
                {card.type}
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

            {isInspector && (
               <div className="mt-1.5 border-t border-white/20 pt-1.5">
                 <div className="text-[7px] md:text-[8px] font-mono tracking-widest text-primary mb-0.5 uppercase">{card.ability}</div>
                 <div className="text-[8px] md:text-[10px] text-white/70 leading-tight font-sans line-clamp-3">{card.effect}</div>
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
          <CardVariantTreatment variantId={variantId} />
        </div>
      </div>
    </MotionElement>
  );
}

function cardViewPropsEqual(previous: CardViewProps, next: CardViewProps) {
  return previous.card === next.card
    && previous.onClick === next.onClick
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
    && previous.disableLayout === next.disableLayout
    && previous.unavailable === next.unavailable
    && previous.disabledReason === next.disabledReason
    && previous.variantId === next.variantId
    && previous.progress === next.progress
    && previous.isInspector === next.isInspector
    && previous.fillContainer === next.fillContainer
    && previous.presentationOnly === next.presentationOnly
    && previous.covered === next.covered;
}

export const CardView = React.memo(CardViewComponent, cardViewPropsEqual);
