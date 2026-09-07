import { motion } from 'framer-motion';
import { Card, getCardImage } from '../data';
import { CardInstance } from '../gameEngine';
import { Shield, Ban, VolumeX, Snowflake, Wind } from 'lucide-react';

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
}

export function CardView({ card, queued, squabble, onClick, testId, className = '', isBoard, isEnemy, effectivePower, cost, highlighted }: CardViewProps) {
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

  const clipStyle = { clipPath: 'polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)' };
  
  return (
    <motion.button
      layoutId={instance?.instanceId}
      layout
      transition={{ layout: { type: 'spring', stiffness: 420, damping: 28 }, duration: 0.2 }}
      data-testid={testId ?? `card-${card.id}`}
      data-card-id={card.id}
      data-instance-id={instance?.instanceId}
      data-card-cost={displayCost}
      data-card-power={displayPower}
      data-card-zone={isBoard ? 'board' : 'hand'}
      onClick={onClick}
      whileHover={!isBoard ? { y: -12, scale: 1.05, zIndex: 50 } : { scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        relative shrink-0 flex flex-col justify-end text-left group
        ${isBoard ? 'w-[58px] h-[82px] md:w-[96px] md:h-[134px]' : 'w-[86px] h-[120px] md:w-[128px] md:h-[178px] shadow-xl shadow-black/80'}
        ${queued ? 'scale-105 -translate-y-2 z-50 ring-2 ring-primary' : 'z-10'}
        ${highlighted ? 'effect-source' : ''}
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
        style={clipStyle}
      >
        {/* Inner Content */}
        <div className="relative w-full h-full bg-zinc-950 overflow-hidden" style={clipStyle}>
           <div className={`absolute inset-0 bg-gradient-to-b from-zinc-800 to-black ${isEnemy ? 'hue-rotate-180 brightness-50' : ''} ${isFrozen ? 'brightness-150 saturate-50 hue-rotate-180 mix-blend-hard-light' : ''}`}>
              <img src={getCardImage(card.id)} alt={card.name} className={`absolute inset-x-0 top-0 w-full h-[84%] object-contain object-top opacity-95 ${isSilenced ? 'grayscale' : ''}`} />
           </div>

           {card.type === 'Fire' && (
              <div className="absolute inset-0 z-[5] pointer-events-none mix-blend-screen opacity-45 motion-reduce:hidden">
                <img src="/assets/guapdad4k_AN_ORB_OF_FIRE_PLAIN_WHITE_BACKGROUND_FIHGTING_GAME_070bfd20-91c4-4f46-8cec-dc40b553d84b_0.gif" className="w-full h-[78%] object-cover" alt="" aria-hidden="true" />
              </div>
           )}
           {card.type === 'Water' && (
              <div className="absolute inset-0 z-[5] pointer-events-none mix-blend-screen opacity-45 motion-reduce:hidden hue-rotate-30">
                <img src="/assets/guapdad4k_AN_ORB_OF_YELLOW_LIQUD_PLAIN_WHITE_BACKGROUND_FIHGT_fdce4b3c-ed84-4761-853f-a87581f4b64e_0.gif" className="w-full h-[78%] object-cover" alt="" aria-hidden="true" />
              </div>
           )}

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
        <div className="absolute top-1 left-1 flex flex-col gap-1 z-20 pointer-events-none">
          {isProtected && <div className="w-4 h-4 bg-yellow-400 text-black border border-black rounded-full flex items-center justify-center" title="Protected"><Shield size={10} /></div>}
          {isBlocked && <div className="w-4 h-4 bg-accent text-white border border-black rounded-full flex items-center justify-center" title="Blocked"><Ban size={10} /></div>}
          {isSilenced && <div className="w-4 h-4 bg-zinc-600 text-white border border-black rounded-full flex items-center justify-center" title="Silenced"><VolumeX size={10} /></div>}
          {isFrozen && <div className="w-4 h-4 bg-blue-400 text-black border border-black rounded-full flex items-center justify-center" title="Frozen"><Snowflake size={10} /></div>}
          {isMoved && <div className="w-4 h-4 bg-purple-500 text-white border border-black rounded-full flex items-center justify-center" title="Moved"><Wind size={10} /></div>}
        </div>
      )}

    </motion.button>
  );
}