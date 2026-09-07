import { motion } from 'framer-motion';
import { CardView } from './CardView';
import { X } from 'lucide-react';

export function CardInspector({ card, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 overflow-y-auto" onClick={onClose}>
      <div
        className="fixed inset-0 opacity-25 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: 'url("/assets/e71f5189-861e-418d-8237-fa20713b9122.png")' }}
      />
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
          className="w-56 h-[308px] md:w-80 md:h-[450px] shadow-2xl shadow-primary/20 pointer-events-none" 
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
          <p className="text-white/65 font-sans mb-6 text-xs md:text-base leading-relaxed max-w-lg">{card.effect}</p>
          
          <div className="relative bg-black/70 border-l-4 border-primary p-4 md:p-5">
            <div className="text-[9px] md:text-[10px] font-mono tracking-widest text-white/40 mb-1">SIGNATURE ABILITY</div>
            <div className="font-display font-black italic uppercase text-xl md:text-2xl text-primary">{card.ability}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
