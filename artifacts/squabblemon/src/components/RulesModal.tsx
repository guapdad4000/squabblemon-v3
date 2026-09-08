import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export function RulesModal({ onClose }: any) {
  const rules = [
    "Choose one affordable card, tap a district, then Lock In. You may Pass when saving a card is smarter.",
    "Both crews get Motion equal to the round number and pay the real card cost. Plug can discount your next card in another district.",
    "Your exact card travels from the hand to Your Zone. The Rival then pays for and reveals one card into the Rival Zone.",
    "Abilities resolve immediately. Power changes, movement, freeze, silence, protection, and blocked effects stay visible on the affected cards.",
    "Frozen cards add 0 Power until Rastamon cleanses them. Silenced cards keep their Power but cannot fire their ability.",
    "District rules add bonus Power. The current leader and live total are shown in the middle of every mat.",
    "After round six, claim at least two of three districts to win. A 1–1–1 split or no two-district claim is a draw.",
    "SQUABBLE can be armed once per match after selecting a card. It doubles that card's Base Power when you Lock In."
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 md:p-6 overflow-y-auto" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-3xl bg-[#0a0a0a]/95 border border-primary/35 p-6 md:p-10 shadow-2xl overflow-hidden"
        style={{ clipPath: 'polygon(0 0, calc(100% - 38px) 0, 100% 38px, 100% 100%, 38px 100%, 0 calc(100% - 38px))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
        <div className="flex justify-between items-center mb-5 md:mb-8">
          <div className="font-mono text-primary text-[10px] md:text-xs tracking-widest uppercase">Field Manual // 01</div>
          <button data-testid="button-rules-modal" onClick={onClose} className="w-9 h-9 border border-white/15 text-white/50 hover:text-black hover:bg-primary hover:border-primary transition-colors grid place-items-center">
            <X size={24} />
          </button>
        </div>
        
        <h2 className="font-display font-black italic text-4xl md:text-6xl uppercase leading-none mb-2">Know the streets.</h2>
        <p className="text-white/40 text-xs md:text-sm mb-6 md:mb-8">Six rounds. Three districts. One reputation.</p>
        
        <ul className="grid sm:grid-cols-2 gap-2 md:gap-3 mb-7 md:mb-9">
          {rules.map((rule, i) => (
            <li key={i} className="flex gap-3 md:gap-4 items-start bg-black/60 border border-white/10 p-3 md:p-4">
              <div className="shrink-0 w-6 h-6 md:w-7 md:h-7 bg-primary text-black flex items-center justify-center font-display font-black text-xs mt-0.5" style={{ clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)' }}>
                {i+1}
              </div>
              <p className="text-white/70 font-sans text-xs md:text-base leading-relaxed">{rule}</p>
            </li>
          ))}
        </ul>
        
        <button data-testid="button-close-rules" onClick={onClose} className="w-full bg-primary text-black font-display font-black italic text-lg md:text-xl uppercase py-4 md:py-5 hover:bg-yellow-400 transition-colors shadow-[0_5px_0_#854d0e] active:translate-y-1 active:shadow-none">
          Take the room
        </button>
      </motion.div>
    </div>
  );
}