import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export function RulesModal({ onClose }: any) {
  const rules = [
    "Choose a card from your hand, then tap a district to commit it face-down.",
    "Spend Hype to play cards. Hype climbs from 1 to 6 across the match.",
    "Lock In to reveal both sides. District modifiers apply to the visible Power totals.",
    "Win two of three districts after six rounds to take the room.",
    "Call SQUABBLE once per match to double the Power of your next committed card."
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 md:p-6 overflow-y-auto" onClick={onClose}>
      <div
        className="fixed inset-0 opacity-30 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: 'url("/assets/0b511f5c-5ecb-467c-96b4-771a90bec889.png")' }}
      />
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
            <li key={i} className={`flex gap-3 md:gap-4 items-start bg-black/60 border border-white/10 p-3 md:p-4 ${i === rules.length - 1 ? 'sm:col-span-2' : ''}`}>
              <div className="shrink-0 w-6 h-6 md:w-7 md:h-7 bg-primary text-black flex items-center justify-center font-display font-black text-xs mt-0.5" style={{ clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)' }}>
                {i+1}
              </div>
              <p className="text-white/70 font-sans text-xs md:text-base leading-relaxed">{rule}</p>
            </li>
          ))}
        </ul>

        <div className="mb-6 border-l-2 border-white/20 pl-3 text-left font-mono text-[8px] md:text-[10px] leading-relaxed tracking-wider text-white/35 uppercase">
          Visual playtest ruleset: printed Power, district modifiers, and SQUABBLE affect lane totals. Ability copy previews the expanded ruleset.
        </div>
        
        <button data-testid="button-close-rules" onClick={onClose} className="w-full bg-primary text-black font-display font-black italic text-lg md:text-xl uppercase py-4 md:py-5 hover:bg-yellow-400 transition-colors shadow-[0_5px_0_#854d0e] active:translate-y-1 active:shadow-none">
          Take the room
        </button>
      </motion.div>
    </div>
  );
}
