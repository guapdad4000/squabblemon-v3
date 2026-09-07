import { motion } from 'framer-motion';
import { CardView } from './CardView';
import { X } from 'lucide-react';
import { CardInstance, getEffectiveCardPower } from '../gameEngine';

export function CardInspector({ card, onClose }: any) {
  const isInstance = 'instanceId' in card;
  const instance = isInstance ? card as CardInstance : null;

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
          testId="card-inspector"
          className="w-[180px] h-[252px] md:w-[280px] md:h-[392px] shadow-2xl shadow-primary/20 pointer-events-none"
        />

        <div
          className="relative w-full bg-[#111]/95 border border-primary/30 p-6 md:p-10 shadow-2xl overflow-hidden"
          style={{ clipPath: 'polygon(0 0, calc(100% - 34px) 0, 100% 34px, 100% 100%, 34px 100%, 0 calc(100% - 34px))' }}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-white to-primary" />
          <div className="flex justify-between items-center mb-5">
            <span className="font-mono text-[10px] md:text-xs text-primary uppercase tracking-[0.22em]">{card.type} class // {card.cost} Hype</span>
            <button data-testid="button-close-inspector" onClick={onClose} className="w-9 h-9 border border-white/20 flex items-center justify-center text-white/50 hover:bg-primary hover:text-black hover:border-primary transition-colors">
              <X size={16} />
            </button>
          </div>
          
          <div className="font-mono text-[9px] text-white/30 tracking-[0.25em] uppercase mb-2">Combat dossier</div>
          <h3 className="font-display font-black italic text-4xl md:text-6xl uppercase leading-[0.9] mb-5">{card.name}</h3>
          
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
        </div>
      </motion.div>
    </div>
  );
}