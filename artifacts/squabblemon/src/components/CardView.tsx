import { motion } from 'framer-motion';
import { Card, getCardImage } from '../data';

interface CardViewProps {
  card: Card;
  queued?: boolean;
  onClick?: () => void;
  testId?: string;
  className?: string;
  isBoard?: boolean;
  isEnemy?: boolean;
}

export function CardView({ card, queued, onClick, testId, className = '', isBoard, isEnemy }: CardViewProps) {
  // Using an angled clip-path for a crafted collectible feel
  const clipStyle = { clipPath: 'polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)' };
  
  return (
    <motion.button 
      data-testid={testId ?? `card-${card.id}`}
      onClick={onClick}
      whileHover={!isBoard ? { y: -16, scale: 1.08, zIndex: 50 } : { scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        relative shrink-0 flex flex-col justify-end text-left group
        ${isBoard ? 'w-[56px] h-[78px] md:w-[90px] md:h-[126px]' : 'w-[84px] h-[117px] md:w-[140px] md:h-[196px] shadow-2xl shadow-black/80'}
        ${queued ? 'scale-110 -translate-y-6 z-50' : 'z-10'}
        ${className}
      `}
    >
      {/* Outer Metallic / Glowing Frame */}
      <div 
        className={`absolute inset-0 p-[2px] md:p-[3px] transition-colors duration-300
          ${queued ? 'bg-gradient-to-br from-primary via-yellow-200 to-yellow-600' : 'bg-gradient-to-br from-zinc-400 via-zinc-700 to-zinc-900 group-hover:from-zinc-300 group-hover:to-zinc-600'}
        `}
        style={clipStyle}
      >
        {/* Inner Card Background */}
        <div className="relative w-full h-full bg-zinc-950 overflow-hidden" style={clipStyle}>
          
          {/* Character Art */}
          <div className={`absolute inset-0 bg-gradient-to-b from-zinc-800 to-black ${isEnemy ? 'hue-rotate-180 brightness-50' : ''}`}>
            <img 
              src={getCardImage(card.id)} 
              alt={card.name}
              className="absolute -top-2 left-1/2 -translate-x-1/2 w-[140%] h-[80%] max-w-none object-cover object-top opacity-90 filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect width="100%" height="100%" fill="%23111"/><text x="50%" y="50%" fill="%23444" font-family="monospace" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${card.name.substring(0, 2).toUpperCase()}</text></svg>`;
              }}
            />
            {/* Energy / Magic Glow behind art */}
            <div className={`absolute inset-0 bg-gradient-to-t ${isEnemy ? 'from-red-900/50' : 'from-yellow-900/50'} via-transparent to-transparent mix-blend-overlay`} />
          </div>

          {/* Bottom Data Panel */}
          <div className="absolute bottom-0 inset-x-0 h-[45%] bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col justify-end p-1.5 md:p-2">
            <div className={`uppercase tracking-widest text-primary font-mono opacity-90 ${isBoard ? 'text-[4px] md:text-[5px] mb-0' : 'text-[7px] md:text-[9px] mb-0.5'}`}>
              {card.type}
            </div>
            <h4 className={`font-display font-black leading-tight text-white ${isBoard ? 'text-[7px] md:text-[10px]' : 'text-xs md:text-sm'} shadow-black drop-shadow-md`}>
              {card.name}
            </h4>
            {!isBoard && (
              <p className="text-[7px] md:text-[9px] text-white/70 leading-tight mt-0.5 line-clamp-2 font-sans font-medium">
                {card.ability}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Badges Overhanging the Frame */}
      {/* Cost Badge */}
      <div className={`
        absolute -top-1.5 -left-1.5 md:-top-2 md:-left-2 z-20 
        flex items-center justify-center font-display font-black
        ${isBoard ? 'w-4 h-4 md:w-5 md:h-5 text-[8px] md:text-[9px]' : 'w-7 h-7 md:w-8 md:h-8 text-xs md:text-sm'}
        bg-primary text-black border-2 border-black
      `} style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
        {card.cost}
      </div>

      {/* Power Badge */}
      <div className={`
        absolute -top-1.5 -right-1.5 md:-top-2 md:-right-2 z-20 
        flex items-center justify-center font-display font-black
        ${isBoard ? 'w-4 h-4 md:w-5 md:h-5 text-[8px] md:text-[9px]' : 'w-7 h-7 md:w-8 md:h-8 text-xs md:text-sm'}
        bg-white text-black border-2 border-black
      `} style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
        {card.power}
      </div>

    </motion.button>
  );
}
