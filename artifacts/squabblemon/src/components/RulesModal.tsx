import { DrFadeReferee } from './DrFadeReferee';
import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { MECHANIC_LESSONS, MECHANIC_LESSON_IDS } from './tutorialGuidance';

export function RulesModal({ onClose }: any) {
  const panel = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('[data-testid=button-rules-modal]')?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, []);

  const rules = [
    "Drag a card from your hand into a district to play it immediately. Swipe sideways to browse your hand. You can also tap a card, choose a district, and press Play card. Keep playing while you have Motion, then End Turn.",
    "Both gangs start with 2 Motion. Each new round refills to its round number plus up to 1 unspent Motion, capped at 9. Plug can discount your next card in another district.",
    "Each card resolves immediately and stays on the board. After you end your turn, the Rival can also play multiple cards with its remaining Motion.",
    "Abilities resolve immediately. Hands changes, movement, freeze, silence, protection, and blocked effects stay visible on the affected cards.",
    "Frozen cards add 0 Hands until cleansed. Silenced cards keep their Hands but cannot fire their ability.",
    "Each fade draws three of sixteen locations. Rules can help or hurt: Dive Bar lowers costs and Hands; Corrupt Church charges extra Motion for a buff. Location penalties cannot lower a card below 0 Hands. Read each mat before playing.",
    "When the final round ends, claim at least two of three districts to win. A 1–1–1 split or no two-district claim is a draw.",
    "SQUABBLE can be armed once per fade after selecting a card. It doubles that card's Base Hands: save it to steal a close district or force the rival to answer, but do not wait past the final round."
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 md:p-6 overflow-y-auto" onClick={onClose}>
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-modal-title"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="referee-clipboard relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto bg-[#0a0a0a]/95 border border-primary/35 p-6 md:p-10 shadow-2xl"
        style={{ clipPath: 'polygon(0 0, calc(100% - 38px) 0, 100% 38px, 100% 100%, 38px 100%, 0 calc(100% - 38px))' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
          if (event.key === 'Tab') {
            const elements = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]') ?? [])];
            const first = elements[0], last = elements[elements.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}
      >
        <DrFadeReferee />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
        <div className="flex justify-between items-center mb-5 md:mb-8">
          <div className="font-mono text-primary text-[10px] md:text-xs tracking-widest uppercase">Field Manual // 01</div>
          <button type="button" aria-label="Close field manual" data-testid="button-rules-modal" onClick={onClose} className="w-9 h-9 border border-white/15 text-white/50 hover:text-black hover:bg-primary hover:border-primary transition-colors grid place-items-center">
            <X size={24} />
          </button>
        </div>
        
        <h2 id="rules-modal-title" className="font-display font-black italic text-4xl md:text-6xl uppercase leading-none mb-2">Know the streets.</h2>
        <p className="text-white/40 text-xs md:text-sm mb-6 md:mb-8">Three districts. One reputation. Check the match length.</p>
        
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
        
        <section aria-labelledby="mechanic-reference-title" className="mb-7 border-t border-white/10 pt-6">
          <div className="mb-4">
            <div className="font-mono text-[9px] uppercase tracking-[.2em] text-primary">Field Manual // Mechanics</div>
            <h3 id="mechanic-reference-title" className="mt-1 font-display text-2xl font-black italic uppercase">Read every effect.</h3>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2" data-testid="mechanic-reference">
            {MECHANIC_LESSON_IDS.map(id => {
              const lesson = MECHANIC_LESSONS[id];
              return (
                <div key={id} data-mechanic={id} className="border border-white/10 bg-black/55 p-3">
                  <dt className="font-display text-sm font-black uppercase text-primary">{lesson.name}</dt>
                  <dd className="mt-1 text-xs leading-relaxed text-white/65">{lesson.summary}</dd>
                </div>
              );
            })}
          </dl>
        </section>

        <button type="button" data-testid="button-close-rules" onClick={onClose} className="w-full bg-primary text-black font-display font-black italic text-lg md:text-xl uppercase py-4 md:py-5 hover:bg-yellow-400 transition-colors shadow-[0_5px_0_#854d0e] active:translate-y-1 active:shadow-none">
          Take the room
        </button>
      </motion.div>
    </div>
  );
}
