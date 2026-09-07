import { motion } from 'framer-motion';
import { decks, getCardImage } from '../data';
import { HelpCircle } from 'lucide-react';

export function Lobby({ onStart, deckId, setDeckId, rival, setRival, onShowRules }: any) {
  const selectedDeck = decks.find(d => d.id === deckId)!;
  
  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row h-full w-full overflow-hidden relative bg-[#0a0a0a]">
      
      {/* Background World Art (The chosen character dominating the screen) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.img 
          key={selectedDeck.id}
          initial={{ opacity: 0, x: -20, scale: 1.05 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          src={getCardImage(selectedDeck.hero)} 
          alt=""
          aria-hidden="true"
          className="absolute right-[-12%] top-[-4%] w-[72%] h-[46%] md:left-0 md:right-auto md:top-auto md:bottom-0 md:w-[60%] md:h-[90%] object-contain object-bottom opacity-45 md:opacity-70 filter drop-shadow-[0_0_30px_rgba(0,0,0,1)]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black/90 md:to-black" />
      </div>
      
      {/* Left side: Identity / Title */}
      <div className="z-10 h-[180px] shrink-0 w-full md:h-auto md:w-1/2 p-6 md:p-12 flex flex-col justify-start pointer-events-none">
        <div className="mt-8 md:mt-0">
          <h1 className="font-display font-black italic text-5xl md:text-[100px] leading-[0.8] text-white drop-shadow-2xl tracking-tighter uppercase mb-2">
            Squabble<br/><span className="text-primary">Mon</span>
          </h1>
          <div className="font-mono text-primary text-[10px] md:text-sm tracking-[0.3em] uppercase">SBL // Human Playtest 0.4</div>
        </div>

        <motion.div 
          key={`text-${selectedDeck.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-auto hidden md:block pb-12"
        >
          <h2 className="font-display font-black text-6xl text-white uppercase leading-none drop-shadow-lg">{selectedDeck.name}</h2>
          <div className="flex items-center gap-3 mt-4">
            <span className="bg-primary text-black font-bold font-mono px-3 py-1 text-sm rounded-sm uppercase tracking-widest">{selectedDeck.accent}</span>
            <span className="text-white/60 font-sans text-sm max-w-sm">{selectedDeck.plan}</span>
          </div>
        </motion.div>
      </div>

      {/* Right side: Loadouts & Action Panel */}
      <div className="z-20 flex-1 min-h-0 w-full md:w-1/2 flex flex-col bg-black/60 md:bg-black/80 backdrop-blur-xl border-l border-white/10 relative md:h-full">
        <div className="p-4 md:p-8 pb-0">
          <div className="flex justify-between items-end mb-4 md:mb-6">
            <div className="font-mono text-white/50 text-[10px] md:text-xs tracking-widest uppercase">Select Crew Dossier</div>
            <div className="font-mono text-primary text-[10px] md:text-xs tracking-widest uppercase text-right">7 Active Rosters</div>
          </div>
        </div>
         
        {/* Crew List */}
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 md:px-8 space-y-2 md:space-y-3 pb-[168px] md:pb-[200px]">
          {decks.map(d => {
            const isSelected = d.id === deckId;
            return (
              <button 
                key={d.id}
                data-testid={`deck-${d.id}`}
                onClick={() => {
                  setDeckId(d.id);
                  if (rival === d.id) {
                    setRival(decks.find(candidate => candidate.id !== d.id)!.id);
                  }
                }}
                className={`w-full flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-xl border transition-all text-left group
                  ${isSelected ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(250,204,21,0.15)]' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30'}
                `}
              >
                <div className={`relative w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-lg overflow-hidden border ${isSelected ? 'border-primary' : 'border-white/20'}`}>
                  <div className="absolute inset-0 bg-zinc-900" />
                  <img src={getCardImage(d.hero)} alt="" aria-hidden="true" className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-[150%] h-[120%] max-w-none object-cover object-top transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`} />
                  {isSelected && <div className="absolute inset-0 bg-primary/20 mix-blend-overlay" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`font-mono text-[8px] md:text-[9px] uppercase tracking-widest ${isSelected ? 'text-primary' : 'text-white/40'}`}>[{d.accent}]</span>
                  </div>
                  <h3 className={`font-display font-bold text-lg md:text-xl uppercase leading-tight truncate ${isSelected ? 'text-white drop-shadow-md' : 'text-white/80'}`}>{d.name}</h3>
                  <p className="font-sans text-[9px] md:text-xs text-white/50 truncate mt-0.5">{d.archetype}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Fixed Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-black via-black/95 to-transparent pt-12 border-t border-white/5">
          <div className="flex gap-2 md:gap-3 mb-3 md:mb-4">
            <div className="flex-1 relative">
              <label className="absolute -top-2 left-3 bg-black px-1 font-mono text-[8px] text-white/50 uppercase tracking-widest">Select Rival</label>
              <select 
                data-testid="select-rival" 
                className="w-full bg-white/5 border border-white/20 text-white p-3 md:p-3.5 rounded-lg font-display uppercase text-sm md:text-base outline-none appearance-none cursor-pointer focus:border-primary"
                value={rival}
                onChange={e => setRival(e.target.value)}
              >
                {decks.filter(d => d.id !== deckId).map(d => (
                  <option value={d.id} key={d.id} className="bg-zinc-900">VS // {d.name}</option>
                ))}
              </select>
            </div>
            <button 
              data-testid="button-rules-lobby" 
              onClick={onShowRules} 
              className="shrink-0 px-4 bg-white/5 hover:bg-white/10 border border-white/20 text-white rounded-lg flex items-center justify-center transition-colors"
              title="How to Play"
            >
              <HelpCircle size={20} className="text-white/70" />
            </button>
          </div>
          
          <button 
            data-testid="button-start" 
            onClick={onStart}
            className="w-full py-4 md:py-5 bg-primary hover:bg-yellow-400 text-black font-display font-black text-xl md:text-3xl italic uppercase rounded-xl shadow-[0_6px_0_#854d0e] active:translate-y-1.5 active:shadow-[0_0px_0_#854d0e] transition-all flex items-center justify-center gap-3"
          >
            Enter The Streets
          </button>
        </div>
      </div>
    </div>
  );
}
