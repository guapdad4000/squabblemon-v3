import { motion, AnimatePresence } from 'framer-motion';
import { Card, districts, getCardImage, getLaneScore } from '../data';
import { CardView } from './CardView';

export function Battle({ 
  deck, rivalDeck, round, hype, hand, boards,
  selected, setSelected, selectedLane, setSelectedLane, 
  commit, nextRound, message, squabble, setSquabble, squabbleUsed, setInspect, archiveMatch, isResolving
}: any) {
  
  const getActionState = () => {
    if (isResolving) return { label: 'Revealing...', disabled: true, type: 'disabled', testId: 'button-resolving' };
    if (round > 6) return { label: 'Archive Match', disabled: false, onClick: archiveMatch, type: 'primary', testId: 'button-archive-match' };
    if (selected) {
       if (selectedLane === null) return { label: 'Pick District', disabled: true, type: 'disabled', testId: 'button-pick-district' };
       if (selected.cost > hype) return { label: `Need ${selected.cost} Hype`, disabled: true, type: 'error', testId: 'button-lock' };
       return { label: 'Lock In', disabled: false, onClick: commit, type: 'primary', testId: 'button-lock' };
    }
    return { label: 'End Round', disabled: false, onClick: nextRound, type: 'secondary', testId: 'button-next-round' };
  };

  const action = getActionState();

  return (
    <div className="flex flex-col h-full w-full max-w-full mx-auto overflow-hidden relative z-10 bg-[#0d0d0d]">
      
      {/* 3D Physical Street Environment Background */}
      <div className="absolute inset-0 z-0 pointer-events-none perspective-1000 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: 'url("/assets/e71f5189-861e-418d-8237-fa20713b9122.png")' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(103,72,25,0.08),rgba(0,0,0,0.72)_74%)]" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

        <motion.img
          key={`rival-stage-${rivalDeck.hero}`}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 0.24, x: 0 }}
          src={getCardImage(rivalDeck.hero)}
          alt=""
          aria-hidden="true"
          className="absolute right-[2%] top-[5%] h-[42%] w-[30%] object-contain object-right-top grayscale brightness-75 drop-shadow-[0_18px_24px_rgba(0,0,0,0.9)]"
        />
        <motion.img
          key={`player-stage-${deck.hero}`}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 0.22, x: 0 }}
          src={getCardImage(deck.hero)}
          alt=""
          aria-hidden="true"
          className="absolute left-[2%] bottom-[12%] h-[42%] w-[30%] object-contain object-left-bottom brightness-75 drop-shadow-[0_18px_24px_rgba(0,0,0,0.9)]"
        />
        
        <div className="absolute inset-0 flex">
          <div className="flex-1 border-r border-dashed border-white/10" />
          <div className="flex-1 border-r border-dashed border-white/10" />
          <div className="flex-1" />
        </div>
        
        <div className="absolute inset-x-0 top-1/2 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent shadow-[0_0_15px_rgba(250,204,21,0.4)]" />
      </div>

      {/* In-game rival HUD */}
      <div className="relative z-30 shrink-0 min-h-14 bg-gradient-to-b from-black via-black/85 to-transparent px-3 py-2 md:p-4 flex justify-between items-center">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="relative w-10 h-10 md:w-16 md:h-16 bg-zinc-900 border-2 border-red-900/50 overflow-hidden shadow-lg shrink-0">
            <img src={getCardImage(rivalDeck.hero)} alt="" aria-hidden="true" className="absolute -top-2 left-1/2 -translate-x-1/2 w-[150%] h-[120%] object-cover object-top hue-rotate-180 brightness-75" />
          </div>
          <div className="min-w-0">
            <div className="text-[7px] md:text-xs font-mono tracking-widest text-red-500 uppercase truncate">Rival // {rivalDeck.archetype}</div>
            <div className="font-display font-black text-sm md:text-2xl uppercase leading-none text-white truncate">{rivalDeck.name}</div>
          </div>
        </div>
        <div className="shrink-0 border border-white/15 bg-black/60 px-3 py-1 text-right">
          <div className="font-mono text-[7px] text-white/40 uppercase">Round</div>
          <div className="font-display font-black text-base md:text-xl leading-none">{round}<span className="text-white/30">/6</span></div>
        </div>
      </div>

      {/* Cinematic Message Banner */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={message}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative z-30 shrink-0 pointer-events-none w-full text-center px-2"
        >
          <div className="min-h-7 bg-black/75 border-y border-primary/60 px-3 md:px-8 py-1 md:py-2 inline-flex items-center justify-center w-full">
            <span className="font-mono font-bold text-[8px] md:text-xs tracking-[0.14em] text-white/75 uppercase">{message}</span>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Board (3 Physical Lanes) - Stacked horizontally on mobile, vertically on desktop */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row justify-center px-2 md:px-4 gap-1.5 md:gap-4 relative z-20 overflow-y-auto md:overflow-hidden hide-scrollbar py-1.5 md:py-2">
        {districts.map((d: any, i: number) => (
          <div key={i} className={`flex-none h-[104px] md:h-auto md:flex-1 w-full md:w-auto flex flex-row md:flex-col relative group bg-black/65 md:bg-transparent border md:border-none overflow-hidden ${selectedLane === i ? 'border-primary shadow-[inset_0_0_18px_rgba(250,204,21,0.16)]' : 'border-white/10'}`}>
            
            {/* CPU Side Zone */}
            <div className="w-[29%] md:w-auto md:flex-1 flex items-center md:items-end justify-center gap-0.5 md:gap-2 p-1 md:p-2 relative min-h-0 overflow-hidden">
              <span className="absolute top-1 left-1 font-mono text-[6px] text-red-400/70 uppercase md:hidden">Rival</span>
              {boards[i].filter((c: Card) => c.owner === 'cpu').map((c: Card, j: number) => (
                 <CardView
                   key={`cpu-${j}`}
                   card={c}
                   isBoard
                   isEnemy
                   testId={`card-board-rival-${i}-${c.id}-${j}`}
                   onClick={() => setInspect(c)}
                 />
              ))}
            </div>

            {/* District Control Slab */}
            <div className="w-[42%] md:w-full h-auto md:h-24 bg-zinc-900 border-x-2 md:border-x-0 md:border-y-4 border-zinc-800 flex flex-col items-center justify-center relative z-20 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] px-1 py-2 my-0 md:my-2 overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'1.5\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E')] opacity-10 mix-blend-overlay" />
              
              <div className="text-[7px] md:text-[9px] font-mono tracking-[0.2em] text-white/40 mb-0.5 z-10 uppercase text-center">District 0{i+1}</div>
              <h3 className="font-display font-black text-[10px] md:text-lg text-center leading-tight z-10 uppercase text-white/90">{d.name}</h3>
              <p className="max-w-[90%] mt-1 text-center text-[6px] md:text-[8px] leading-tight text-white/40 z-10 line-clamp-2">{d.rule}</p>
              
              <div className="w-full flex justify-between px-2 mt-2 md:absolute md:inset-x-0 md:top-1/2 md:-translate-y-1/2 md:mt-0 z-10">
                <div data-testid={`score-cpu-${i}`} className="text-red-500 font-display font-black text-sm md:text-2xl drop-shadow-md md:pl-3">
                  {getLaneScore(boards[i].filter((c: Card) => c.owner === 'cpu'), i)}
                </div>
                <div data-testid={`score-player-${i}`} className="text-primary font-display font-black text-sm md:text-2xl drop-shadow-md md:pr-3">
                  {getLaneScore(boards[i].filter((c: Card) => c.owner === 'player'), i)}
                </div>
              </div>
            </div>
            
            {/* Player Side Zone */}
            <div className="w-[29%] md:w-auto md:flex-1 flex items-center md:items-start justify-center gap-0.5 md:gap-2 p-1 md:p-2 relative min-h-0 overflow-hidden">
              <span className="absolute top-1 right-1 font-mono text-[6px] text-primary/70 uppercase md:hidden">You</span>
              {boards[i].filter((c: Card) => c.owner === 'player').map((c: Card, j: number) => (
                 <CardView
                   key={`player-${j}`}
                   card={c}
                   isBoard
                   testId={`card-board-player-${i}-${c.id}-${j}`}
                   onClick={() => setInspect(c)}
                 />
              ))}
            </div>

            {selected && (
              <button
                data-testid={`lane-${i}`}
                onClick={() => setSelectedLane(i)}
                aria-pressed={selectedLane === i}
                className={`absolute inset-0 z-30 min-h-11 flex items-center justify-center transition-all ${selectedLane === i ? 'bg-primary/15' : 'bg-black/25 hover:bg-black/10'}`}
              >
                <div className={`px-3 py-1.5 border-2 shadow-2xl font-display font-black text-[9px] md:text-lg uppercase ${selectedLane === i ? 'bg-primary text-black border-black rotate-[-2deg]' : 'bg-black/90 text-white border-white/40'}`}>
                  {selectedLane === i ? 'District locked' : `Deploy to ${d.name}`}
                </div>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Bottom game HUD */}
      <div className="shrink-0 relative z-40 bg-[#0b0b0b] border-t-2 border-[#333] shadow-[0_-10px_30px_rgba(0,0,0,0.8)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="h-[132px] md:h-[168px] overflow-hidden flex justify-center items-end bg-gradient-to-b from-transparent to-black/65 pointer-events-none">
          <div className="flex justify-center items-end px-2 pb-1">
            {hand.map((c: Card, i: number) => {
              const isSelected = selected?.id === c.id;
              const angle = (i - (hand.length-1)/2) * 8;
               const yOffset = Math.abs(i - (hand.length-1)/2) * 5;
              return (
                <div
                  key={c.id}
                  className="relative pointer-events-auto origin-bottom -ml-[22px] md:-ml-4 first:ml-0"
                  style={{
                    transform: `rotate(${angle}deg) translateY(${yOffset}px)`,
                    zIndex: isSelected ? 50 : i
                  }}
                >
                  <CardView
                    card={c}
                    queued={isSelected}
                    onClick={() => {
                      if (isSelected) setSelected(null);
                      else setSelected(c);
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-2 pt-2 md:p-4 flex items-stretch gap-2 relative z-20">
          <div className="hidden md:block">
            <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-lg bg-zinc-900 border-2 border-primary/50 overflow-hidden shadow-lg hidden md:block">
              <img src={getCardImage(deck.hero)} alt="" aria-hidden="true" className="absolute -top-2 left-1/2 -translate-x-1/2 w-[150%] h-[120%] object-cover object-top" />
            </div>
          </div>

          <div className="w-[72px] md:w-auto flex items-center gap-1.5 bg-black/60 px-1.5 md:px-2 border border-white/10 shrink-0">
              <div className="relative w-10 h-10 md:w-14 md:h-14 rounded-full bg-black border-2 border-primary shadow-[0_0_20px_rgba(250,204,21,0.4)] flex items-center justify-center overflow-hidden shrink-0">
                <img src="/assets/guapdad4k_AN_ORB_OF_YELLOW_LIQUD_PLAIN_WHITE_BACKGROUND_FIHGT_fdce4b3c-ed84-4761-853f-a87581f4b64e_0.gif" alt="Hype" className="absolute inset-0 w-[150%] h-[150%] max-w-none object-cover mix-blend-screen opacity-90" />
                <span className="relative z-10 font-display font-black text-xl md:text-3xl text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">{hype}</span>
              </div>
              <div className="hidden sm:block pr-2">
                <div className="text-[9px] font-mono tracking-widest text-primary uppercase leading-tight">Hype</div>
                <div className="text-[9px] font-mono text-white/45 uppercase">Round {round}</div>
              </div>
          </div>

          <button
            data-testid="button-squabble"
            className={`relative min-h-12 px-2 md:px-5 border-2 overflow-hidden flex-1 md:flex-none flex items-center justify-center transition-all group ${squabble ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : squabbleUsed ? 'border-zinc-800 opacity-45' : 'border-zinc-700 hover:border-red-500/50'}`}
            onClick={() => !squabbleUsed && setSquabble(!squabble)}
            disabled={squabbleUsed}
          >
            <div className={`absolute inset-0 bg-black transition-opacity ${squabble ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
              <img src="/assets/guapdad4k_AN_ORB_OF_FIRE_PLAIN_WHITE_BACKGROUND_FIHGTING_GAME_070bfd20-91c4-4f46-8cec-dc40b553d84b_0.gif" alt="" aria-hidden="true" className="w-full h-full object-cover mix-blend-screen opacity-70 contrast-150" />
            </div>
            <span className={`relative z-10 font-display font-black text-[9px] md:text-sm uppercase tracking-wider ${squabble ? 'text-white' : 'text-zinc-400'}`}>
              {squabbleUsed ? 'Spent' : <><span className="hidden sm:inline">Call </span>Squabble</>}
            </span>
          </button>

          <button
            data-testid={action.testId}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`min-h-12 flex-[1.35] md:flex-none md:min-w-[180px] px-2 md:px-8 font-display font-black text-[11px] md:text-lg italic uppercase transition-all active:translate-y-1 active:shadow-none
              ${action.type === 'primary' ? 'bg-primary text-black hover:bg-yellow-400 shadow-[0_4px_0_#854d0e]' : ''}
              ${action.type === 'secondary' ? 'bg-zinc-800 text-white/80 border border-white/10 hover:bg-zinc-700 shadow-[0_4px_0_#000]' : ''}
              ${action.type === 'disabled' ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 shadow-[0_4px_0_#000]' : ''}
              ${action.type === 'error' ? 'bg-red-950/50 text-red-500 border border-red-900/50 shadow-[0_4px_0_#000]' : ''}
            `}
          >
            {action.label}
          </button>
        </div>
      </div>
    </div>
  );
}
