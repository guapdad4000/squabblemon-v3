import React from 'react';
import { motion } from 'framer-motion';
import { Card, getAssetUrl, getCardImage } from '../data';
import { CardInstance } from '../gameEngine';
import { Shield, Ban, VolumeX, Snowflake, Wind } from 'lucide-react';
import { CardVariantTreatment, getVariantKind } from './CardVariantTreatment';
import { CardProgress } from './CardProgress';
import type { CardProgress as CardProgressValue } from '@workspace/squabblemon-engine/cardProgression';
import { CardRarityTreatment, getCardRarity, getRarityClass } from './CardRarityTreatment';

const CARD_CLIP_STYLE = { clipPath: 'polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)' };

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
}

function CardViewComponent({ card, queued, squabble, onClick, testId, className = '', isBoard, isEnemy, effectivePower, cost, highlighted, effectRole, effectKind, disableLayout, unavailable, disabledReason, variantId, progress }: CardViewProps) {
  const isInstance = 'instanceId' in card;
  const instance = isInstance ? card as CardInstance : null;

  const displayPower = effectivePower ?? card.power;
  const displayCost = cost ?? card.cost;

  const isFrozen = instance?.statuses?.frozen;
  const isSilenced = instance?.statuses?.silenced;
  const isProtected = instance?.statuses?.protected;
  const isBlocked = instance?.statuses?.blocked;
  const isMoved = instance?.moved;
  const powerModifier = instance?.powerModifier ?? 0;
  const variantKind = getVariantKind(variantId);
  const rarity = getCardRarity(card.id);

  return (
    <motion.button
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
      aria-label={`${card.name}. ${rarity} rarity.${disabledReason ? ` ${disabledReason}` : ''}`}
      title={disabledReason}
      onClick={onClick}
      whileHover={!isBoard ? { y: -12, scale: 1.05, zIndex: 50 } : { scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        relative shrink-0 flex flex-col justify-end text-left group
        ${isBoard ? 'battle-board-card w-[64px] h-[90px] sm:w-[78px] sm:h-[109px] lg:w-[96px] lg:h-[134px]' : 'battle-hand-card w-[100px] h-[140px] md:w-[136px] md:h-[190px] shadow-xl shadow-black/80'}
        ${queued ? 'scale-105 -translate-y-2 z-50 ring-2 ring-primary' : 'z-10'}
        ${squabble ? 'card-squabble-armed' : ''}
        ${unavailable ? 'opacity-45 grayscale' : ''}
        ${highlighted || effectRole === 'source' ? 'effect-source' : ''}
        ${effectRole === 'target' ? 'effect-target' : ''}
        ${effectKind ? `effect-kind-${effectKind}` : ''}
        ${variantKind ? `card-variant card-variant-${variantKind}` : ''}
        ${getRarityClass(rarity)}
        ${className}
      `}
    >
       {/* Card Frame */}
       <div
        className={`absolute inset-0 p-[2px] transition-colors duration-300
          ${queued && squabble ? 'bg-accent shadow-[0_0_30px_theme(colors.accent.DEFAULT)]' : queued ? 'bg-primary' : 'bg-zinc-700 group-hover:bg-zinc-400'}
          ${isEnemy && !queued ? 'bg-accent/40 group-hover:bg-accent/70' : ''}
          ${isFrozen ? 'border border-blue-400 ring-2 ring-blue-500/50' : ''}
        `}
         style={CARD_CLIP_STYLE}
      >
        {/* Inner Content */}
         <div className="relative w-full h-full bg-zinc-950 overflow-hidden" style={CARD_CLIP_STYLE}>
           <div className={`absolute inset-0 bg-gradient-to-b from-zinc-800 to-black ${isEnemy ? 'hue-rotate-180 brightness-50' : ''} ${isFrozen ? 'brightness-150 saturate-50 hue-rotate-180 mix-blend-hard-light' : ''}`}>
              <img src={getCardImage(card.id)} alt={card.name} className={`absolute inset-x-0 top-0 w-full h-[84%] object-contain object-top opacity-95 ${isSilenced ? 'grayscale' : ''}`} />
           </div>

           <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col justify-end p-1.5 z-10">
             <div className={`uppercase tracking-widest text-primary font-mono opacity-90 ${isBoard ? 'text-[5px] mb-0' : 'text-[7px] mb-0.5'}`}>
               {card.type}
             </div>
             <h4 className={`font-display font-black leading-tight text-white ${isBoard ? 'text-[8px] md:text-[10px]' : 'text-xs md:text-sm'}`}>
               {card.name}
             </h4>
           </div>
        </div>
      </div>

      {/* Badges */}
      {!isBoard && (
        <div className="absolute -top-2 -left-2 z-20 flex items-center justify-center font-display font-black w-6 h-6 md:w-8 md:h-8 text-xs md:text-sm bg-primary text-black" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
          {displayCost}
        </div>
      )}

      <div className={`absolute -top-2 -right-2 z-20 flex flex-col items-center`}>
        <div className={`flex items-center justify-center font-display font-black ${isBoard ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 md:w-8 md:h-8 text-xs md:text-sm'} ${powerModifier > 0 ? 'bg-green-400 text-black' : powerModifier < 0 ? 'bg-accent text-white' : 'bg-white text-black'}`} style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
          {displayPower}
        </div>
        {powerModifier !== 0 && isBoard && (
          <div className="text-[7px] font-mono font-bold bg-black px-1 rounded-sm border border-white/20 -mt-1 z-30">
            {powerModifier > 0 ? `+${powerModifier}` : powerModifier}
          </div>
        )}
      </div>

      {/* Status Icons overlay */}
       {isBoard && (
         <div className="card-status-rail absolute top-1 left-1 flex flex-col gap-0.5 z-20 pointer-events-none">
           {isProtected && <div className="card-status bg-yellow-400 text-black" title="Protected for this round" aria-label="Protected for this round"><Shield size={9} /><span>R</span></div>}
           {isBlocked && <div className="card-status bg-accent text-white" title="Block spent; resets next round" aria-label="Block spent; resets next round"><Ban size={9} /><span>R</span></div>}
           {isSilenced && <div className="card-status bg-zinc-600 text-white" title="Silenced until cleansed" aria-label="Silenced until cleansed"><VolumeX size={9} /><span>∞</span></div>}
           {isFrozen && <div className="card-status bg-blue-400 text-black" title="Frozen until cleansed" aria-label="Frozen until cleansed"><Snowflake size={9} /><span>∞</span></div>}
           {isMoved && <div className="card-status bg-purple-500 text-white" title="Moved by an effect" aria-label="Moved by an effect"><Wind size={9} /></div>}
        </div>
      )}
      <CardRarityTreatment rarity={rarity} compact={Boolean(isBoard)} />
      <CardVariantTreatment variantId={variantId} />
      {!isBoard && progress && (
        <CardProgress progress={progress} compact className="absolute inset-x-2 bottom-1 z-20" />
      )}

    </motion.button>
  );
}

function cardViewPropsEqual(previous: CardViewProps, next: CardViewProps) {
  return previous.card === next.card
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
    && previous.progress === next.progress;
}

export const CardView = React.memo(CardViewComponent, cardViewPropsEqual);
