import { motion, AnimatePresence } from 'framer-motion';
import { Card, districts, getCardImage, getLaneScore } from '../data';
import { CardView } from './CardView';

export function Battle({ 
  deck, rivalDeck, round, hype, hand, boards,
  selected, setSelected, selectedLane, setSelectedLane, 
  commit, nextRound, message, squabble, setSquabble, squabbleUsed, setInspect, archiveMatch, isResolving
}: any) {
  
  return (
    <div className="flex flex-col h-full w-full max-w-full mx-auto overflow-hidden relative z-10 bg-[#0d0d0d]">
      
      {/* 3D Physical Street Environment Background */}
      <div className="absolute inset-0 z-0 pointer-events-none perspective-1000 overflow-hidden">
        {/* Illustrated arena deck supplied with the Squabblemon art handoff */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: 'url("/assets/e71f5189-861e-418d-8237-fa20713b9122.png")' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(103,72,25,0.08),rgba(0,0,0,0.72)_74%)]" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

        {/* The crews occupy the arena even before the first card is committed. */}
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
        
        {/* Arena Depth Lines */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 border-r border-dashed border-white/10" />
          <div className="flex-1 border-r border-dashed border-white/10" />
          <div className="flex-1" />
        </div>
        
        {/* Horizontal dividing lines (Net) */}
        <div className="absolute inset-x-0 top-1/2 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent shadow-[0_0_15px_rgba(250,204,21,0.4)]" />
      </div>

      {/* Top HUD (Rival) */}
      <header className="relative z-30 shrink-0 bg-gradient-to-b from-black via-black/80 to-transparent p-2 md:p-4 flex justify-between items-center border-b border-red-900/30">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-lg bg-zinc-900 border-2 border-red-900/50 overflow-hidden shadow-lg">
            <img src={getCardImage(rivalDeck.hero)} alt="" aria-hidden="true" className="absolute -top-2 left-1/2 -translate-x-1/2 w-[150%] h-[120%] object-cover object-top hue-rotate-180 brightness-75" />
          </div>
          <div>
            <div className="text-[9px] md:text-xs font-mono tracking-widest text-red-500 uppercase">Rival // {rivalDeck.archetype}</div>
            <div className="font-display font-black text-xl md:text-2xl uppercase leading-none text-white">{rivalDeck.name}</div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="inline-block bg-black/60 border border-white/10 px-3 py-1 md:px-4 md:py-2 rounded-lg backdrop-blur-md">
            <span className="font-mono text-[9px] md:text-xs tracking-widest text-white/50 uppercase mr-2">Round</span>
            <span className="font-display font-bold text-lg md:text-xl text-white">{round}/6</span>
          </div>
        </div>
      </header>

      {/* Cinematic Message Banner */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={message}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="absolute top-[80px] md:top-[100px] left-1/2 -translate-x-1/2 z-50 pointer-events-none w-[90%] md:w-auto text-center"
        >
          <div className="bg-black/80 backdrop-blur-xl border-y-2 border-primary px-4 md:px-8 py-2 md:py-3 shadow-2xl shadow-primary/20 inline-flex items-center justify-center gap-3 w-full">
            <span className="font-display font-black text-xs md:text-lg tracking-widest text-white uppercase italic">{message}</span>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Board (3 Physical Lanes) */}
      <div className="flex-1 flex px-1 md:px-4 gap-1 md:gap-4 relative z-20 min-h-0 py-2">
        {districts.map((d: any, i: number) => (
          <div key={i} className="flex-1 flex flex-col relative group">
            
            {/* CPU Side Zone */}
            <div className="flex-1 flex flex-wrap gap-1 md:gap-2 p-1 content-end justify-center relative">
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
            <div className="h-16 md:h-24 bg-zinc-900 border-y-4 border-zinc-800 flex flex-col items-center justify-center relative z-20 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] my-1 md:my-2 overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'1.5\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E')] opacity-10 mix-blend-overlay" />
              
              <div className="text-[7px] md:text-[9px] font-mono tracking-[0.2em] text-white/40 mb-0.5 z-10 uppercase">District 0{i+1}</div>
              <h3 className="font-display font-black text-[10px] md:text-lg text-center leading-tight px-1 z-10 uppercase text-white/90">{d.name}</h3>
              <p className="hidden lg:block max-w-[70%] mt-1 text-center text-[8px] leading-tight text-white/40 z-10">{d.rule}</p>
              
              <div data-testid={`score-cpu-${i}`} className="absolute left-1 md:left-3 top-1/2 -translate-y-1/2 text-red-500 font-display font-black text-sm md:text-2xl z-10 drop-shadow-md">
                {getLaneScore(boards[i].filter((c: Card) => c.owner === 'cpu'), i)}
              </div>
              <div data-testid={`score-player-${i}`} className="absolute right-1 md:right-3 top-1/2 -translate-y-1/2 text-primary font-display font-black text-sm md:text-2xl z-10 drop-shadow-md">
                {getLaneScore(boards[i].filter((c: Card) => c.owner === 'player'), i)}
              </div>
            </div>
            
            {/* Player Side Zone */}
            <div className="flex-1 flex flex-wrap gap-1 md:gap-2 p-1 content-start justify-center relative">
              {boards[i].filter((c: Card) => c.owner === 'player').map((c: Card, j: number) => (
                 <CardView
                   key={`player-${j}`}
                   card={c}
                   isBoard
                   testId={`card-board-player-${i}-${c.id}-${j}`}
                   onClick={() => setInspect(c)}
                 />
              ))}
              
              {/* Target Overlay */}
              {selected && (
                <button 
                  data-testid={`lane-${i}`}
                  onClick={() => setSelectedLane(i)}
                  className={`absolute inset-0 z-30 flex items-center justify-center transition-all ${selectedLane === i ? 'bg-primary/20 backdrop-blur-sm' : 'bg-black/40 hover:bg-black/20 backdrop-blur-[2px]'}`}
                >
                  <div className={`px-2 py-1 md:px-4 md:py-2 border-2 shadow-2xl font-display font-black text-[10px] md:text-lg uppercase transform ${selectedLane === i ? 'bg-primary text-black border-black scale-110 rotate-[-2deg]' : 'bg-black text-white border-white/30'}`}>
                    {selectedLane === i ? 'Targeted' : 'Deploy'}
                  </div>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom HUD (Hand & Massive Action Controls) */}
      <div className="relative z-40 shrink-0 mt-[-20px] md:mt-[-40px]">
        {/* Hand Fan */}
        <div className="flex justify-center items-end gap-[-20px] md:gap-[-10px] h-[100px] md:h-[160px] pointer-events-none relative z-10 px-4">
          {hand.map((c: Card, i: number) => {
            const isSelected = selected?.id === c.id;
            // Arc calculations
            const angle = (i - (hand.length-1)/2) * 8;
            const yOffset = Math.abs(i - (hand.length-1)/2) * 12;
            return (
              <div 
                key={c.id} 
                className="relative pointer-events-auto origin-bottom -ml-8 md:-ml-4 first:ml-0"
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

        {/* Dashboard Frame */}
        <div className="bg-[#111] border-t-4 border-[#222] shadow-[0_-10px_30px_rgba(0,0,0,0.8)] relative z-20">
          <div className="max-w-6xl mx-auto p-2 md:p-4 flex items-center justify-between gap-2 md:gap-4">
            
            {/* Player Avatar & Hype (Left) */}
            <div className="flex items-center gap-2 md:gap-4 flex-1">
              <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-lg bg-zinc-900 border-2 border-primary/50 overflow-hidden shadow-lg hidden sm:block">
                <img src={getCardImage(deck.hero)} alt="" aria-hidden="true" className="absolute -top-2 left-1/2 -translate-x-1/2 w-[150%] h-[120%] object-cover object-top" />
              </div>
              
              {/* Dynamic Hype Orb */}
              <div className="relative flex items-center gap-2 bg-black/50 p-1 md:p-2 rounded-xl border border-white/10 shrink-0">
                <div className="relative w-10 h-10 md:w-14 md:h-14 rounded-full bg-black border-2 border-primary shadow-[0_0_20px_rgba(250,204,21,0.4)] flex items-center justify-center overflow-hidden shrink-0">
                  <img src="/assets/guapdad4k_AN_ORB_OF_YELLOW_LIQUD_PLAIN_WHITE_BACKGROUND_FIHGT_fdce4b3c-ed84-4761-853f-a87581f4b64e_0.gif" alt="Hype" className="absolute inset-0 w-[150%] h-[150%] max-w-none object-cover mix-blend-screen opacity-90" />
                  <span className="relative z-10 font-display font-black text-xl md:text-3xl text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">{hype}</span>
                </div>
                <div className="hidden md:block pr-2">
                  <div className="text-[10px] font-mono tracking-widest text-primary uppercase">Hype Bank</div>
                  <div className="text-[10px] text-white/50 font-sans leading-tight">Commitment budget.</div>
                </div>
              </div>
            </div>

            {/* Core Actions (Right) */}
            <div className="flex items-stretch gap-2 shrink-0 h-[48px] md:h-[64px]">
              {/* Squabble Button (Hue Rotated Orb to look like fire) */}
              <button 
                data-testid="button-squabble"
                className={`relative px-3 md:px-5 rounded-xl border-2 overflow-hidden flex items-center justify-center gap-2 transition-all group ${squabble ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : squabbleUsed ? 'border-zinc-800 opacity-45' : 'border-zinc-700 hover:border-red-500/50'}`}
                onClick={() => !squabbleUsed && setSquabble(!squabble)}
                disabled={squabbleUsed}
              >
                <div className={`absolute inset-0 bg-black transition-opacity ${squabble ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                  <img src="/assets/guapdad4k_AN_ORB_OF_FIRE_PLAIN_WHITE_BACKGROUND_FIHGTING_GAME_070bfd20-91c4-4f46-8cec-dc40b553d84b_0.gif" alt="" aria-hidden="true" className="w-full h-full object-cover mix-blend-screen opacity-70 contrast-150" />
                </div>
                <span className={`relative z-10 font-display font-black text-[10px] md:text-sm uppercase tracking-wider ${squabble ? 'text-white' : 'text-zinc-400'}`}>
                  {squabbleUsed ? 'Spent' : <><span className="hidden sm:inline">Call </span>Squabble</>}
                </span>
              </button>
              
              {/* Primary Action */}
              {isResolving ? (
                <button
                  data-testid="button-resolving"
                  disabled
                  className="bg-zinc-800 text-primary/70 border border-primary/30 px-4 md:px-8 rounded-xl font-display font-black italic text-xs md:text-sm uppercase whitespace-nowrap"
                >
                  Revealing…
                </button>
              ) : round > 6 ? (
                <button 
                   data-testid="button-archive-match"
                  onClick={archiveMatch}
                  className="bg-primary text-black px-6 md:px-8 rounded-xl font-display font-black text-sm md:text-xl italic uppercase hover:bg-yellow-400 shadow-[0_4px_0_#854d0e] active:translate-y-1 active:shadow-none transition-all whitespace-nowrap"
                >
                  Archive
                </button>
              ) : (
                selected && selectedLane !== null ? (
                  <button 
                    data-testid="button-lock"
                    onClick={commit}
                    disabled={selected.cost > hype}
                    className={`px-6 md:px-10 rounded-xl font-display font-black text-sm md:text-xl italic uppercase transition-all whitespace-nowrap shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none
                      ${selected.cost > hype ? 'bg-zinc-800 text-zinc-500 shadow-[0_4px_0_#000]' : 'bg-primary text-black hover:bg-yellow-400 shadow-[0_4px_0_#854d0e]'}
                    `}
                  >
                    {selected.cost > hype ? 'Broke' : 'Lock In'}
                  </button>
                ) : (
                  <button 
                    data-testid="button-next-round"
                    onClick={nextRound}
                    className="bg-zinc-800 text-white/80 border border-white/10 px-4 md:px-8 rounded-xl font-display font-bold text-xs md:text-sm uppercase hover:bg-zinc-700 transition-colors whitespace-nowrap shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none"
                  >
                    End Round
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
