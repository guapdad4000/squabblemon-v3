import { DrFadeReferee } from './DrFadeReferee';
import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { MECHANIC_LESSONS, MECHANIC_LESSON_IDS } from './tutorialGuidance';

export function RulesModal({ onClose }: any) {
  const panel = React.useRef<HTMLDivElement>(null);
  const [fieldGuideOpen, setFieldGuideOpen] = React.useState(false);
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('[data-testid=button-rules-modal]')?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, []);

  const rules = [
    "Each gang has ten unique cards. A standard fade starts with five in hand and draws one at the start of each new round while cards remain; encounter rules may change the opening hand.",
    "A standard fade lasts six rounds. After Party can extend it to round seven once. Story and special encounters may set a different length.",
    "You start with 2 Motion. Each later round gives Motion equal to its round number plus up to 1 unspent Motion carried forward, capped at 9. Spend it to play cards, then end your turn.",
    "The higher Hands total claims each district. Claim at least two of the three to win; tied districts belong to neither player. If neither side claims two at the finish, the match is a draw.",
    "You can use SQUABBLE once per fade: it adds the selected card's base Hands to its score, doubling that base value. Other effects resolve separately.",
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
            const elements = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary,[tabindex="0"]') ?? [])];
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
        <p className="text-white/40 text-xs md:text-sm mb-6 md:mb-8">The core rules at a glance. Encounter briefings and district mats show any match-specific twists.</p>
        
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

        <section aria-labelledby="field-guide-entry-title" className="mb-7 border-t border-white/10 pt-5">
          <h3 id="field-guide-entry-title" className="font-display text-lg font-black italic uppercase">Need a little more?</h3>
          <p className="mt-1 mb-3 text-xs leading-relaxed text-white/55">Open the quick Field Guide here without leaving your match.</p>
          <button
            type="button"
            aria-expanded={fieldGuideOpen}
            aria-controls="in-match-field-guide"
            onClick={() => setFieldGuideOpen(open => !open)}
            className="border border-primary/50 px-4 py-2 font-display text-sm font-black uppercase text-primary hover:bg-primary hover:text-black transition-colors"
          >
            {fieldGuideOpen ? 'Close quick Field Guide' : 'Open quick Field Guide'}
          </button>
          {fieldGuideOpen && (
            <div id="in-match-field-guide" className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="in-match-field-guide">
              <article className="border border-white/10 bg-black/55 p-3">
                <h4 className="font-display text-sm font-black uppercase text-primary">Play the turn</h4>
                <p className="mt-1 text-xs leading-relaxed text-white/65">Play cards into districts while you can afford them. Drag or tap to select and place; inspect a card before committing. The rival takes its turn after you end yours.</p>
              </article>
              <article className="border border-white/10 bg-black/55 p-3">
                <h4 className="font-display text-sm font-black uppercase text-primary">Check the battlefield</h4>
                <p className="mt-1 text-xs leading-relaxed text-white/65">District rules and encounter modifiers can change card value, Motion, or match length. Read each district mat and any story briefing before choosing a lane.</p>
              </article>
              <details className="border border-white/10 bg-black/55 p-3 sm:col-span-2">
                <summary className="cursor-pointer font-display text-sm font-black uppercase text-primary">Events, statuses & timing</summary>
                <ul className="mt-2 space-y-2 text-xs leading-relaxed text-white/65">
                  <li><b className="text-white/85">Blockbusters</b> use slots in the same ten-card deck. Choose a lane; the event resolves and leaves play without adding Hands. Concert chooses +1 or −1 Hands for each character in its lane. Dice Game wagers 1–3 Motion per side and compares the best two of three D6; a tie refunds both wagers. Blockbusters cannot use SQUABBLE.</li>
                  <li><b className="text-white/85">Frozen</b> cards contribute 0 Hands until cleansed. <b className="text-white/85">Silenced</b> cards keep their Hands but cannot use abilities. Other statuses and protections are shown on the card.</li>
                  <li><b className="text-white/85">Online turn clocks</b> are separate for each player. End your turn before your clock expires; running out forfeits the match even if you lead.</li>
                </ul>
              </details>
            </div>
          )}
        </section>
        
        <section aria-labelledby="mechanic-reference-title" className="mb-7 border-t border-white/10 pt-6">
          <details>
            <summary className="cursor-pointer">
              <span className="font-mono text-[9px] uppercase tracking-[.2em] text-primary">Field Manual // Mechanics</span>
              <span id="mechanic-reference-title" className="mt-1 block font-display text-2xl font-black italic uppercase">Read every effect.</span>
            </summary>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="mechanic-reference">
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
          </details>
        </section>

        <button type="button" data-testid="button-close-rules" onClick={onClose} className="w-full bg-primary text-black font-display font-black italic text-lg md:text-xl uppercase py-4 md:py-5 hover:bg-yellow-400 transition-colors shadow-[0_5px_0_#854d0e] active:translate-y-1 active:shadow-none">
          Take the room
        </button>
      </motion.div>
    </div>
  );
}
