import { motion } from 'framer-motion';
import { decks, getCardImage, getLaneScore } from '../data';

export function ResultScreen({ onRestart, onChangeDeck, districts, boards, deckId, rivalDeck }: any) {
  const results = districts.map((d: any, i: number) => {
    const pScore = getLaneScore(boards[i].filter((c:any) => c.owner === 'player'), i);
    const cScore = getLaneScore(boards[i].filter((c:any) => c.owner === 'cpu'), i);
    return { name: d.name, player: pScore, cpu: cScore, won: pScore > cScore, tied: pScore === cScore }; 
  });
  
  const playerWins = results.filter((r: any) => r.won).length;
  const isVictory = playerWins >= 2;
  const rivalWins = results.filter((r: any) => !r.won && !r.tied).length;
  const isDraw = playerWins < 2 && rivalWins < 2;
  const playerDeck = decks.find(deck => deck.id === deckId)!;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-5 md:p-8 text-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-45"
        style={{ backgroundImage: 'url("/assets/0b511f5c-5ecb-467c-96b4-771a90bec889.png")' }}
      />
      <div className={`absolute inset-0 ${isVictory ? 'bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.28),rgba(0,0,0,0.93)_72%)]' : 'bg-[radial-gradient(circle_at_center,rgba(190,18,60,0.24),rgba(0,0,0,0.94)_72%)]'}`} />
      <div className="absolute inset-x-[-20%] top-1/2 h-24 -rotate-6 bg-gradient-to-r from-transparent via-primary/15 to-transparent blur-xl" />

      <motion.img
        initial={{ opacity: 0, x: -80 }}
        animate={{ opacity: 0.42, x: 0 }}
        transition={{ duration: 0.75 }}
        src={getCardImage(playerDeck.hero)}
        alt=""
        aria-hidden="true"
        className="absolute -left-[8%] md:left-[1%] bottom-[-8%] h-[70%] md:h-[88%] w-[48%] object-contain object-left-bottom drop-shadow-[0_20px_30px_rgba(0,0,0,0.9)]"
      />
      <motion.img
        initial={{ opacity: 0, x: 80 }}
        animate={{ opacity: 0.25, x: 0 }}
        transition={{ duration: 0.75 }}
        src={getCardImage(rivalDeck.hero)}
        alt=""
        aria-hidden="true"
        className="absolute -right-[8%] md:right-[1%] bottom-[-8%] h-[70%] md:h-[88%] w-[48%] object-contain object-right-bottom grayscale brightness-75 drop-shadow-[0_20px_30px_rgba(0,0,0,0.9)]"
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 max-w-3xl w-full py-6 md:py-10"
      >
        <div className="font-mono text-primary text-[9px] md:text-xs tracking-[0.32em] uppercase mb-4 md:mb-6">Match Archive // Complete</div>
        
        <motion.div
          initial={{ rotate: -18, scale: 0 }}
          animate={{ rotate: -4, scale: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 15, delay: 0.12 }}
          className={`mx-auto w-24 h-24 md:w-36 md:h-36 grid place-items-center border-4 md:border-[6px] text-[76px] md:text-[118px] font-display font-black italic leading-none mb-5 shadow-[0_0_60px_rgba(0,0,0,0.8)] ${isVictory ? 'text-black bg-primary border-white' : isDraw ? 'text-white bg-zinc-700 border-zinc-300' : 'text-white bg-rose-700 border-rose-300'}`}
          style={{ clipPath: 'polygon(50% 0, 88% 12%, 100% 50%, 88% 88%, 50% 100%, 12% 88%, 0 50%, 12% 12%)' }}
        >
          {isVictory ? 'W' : isDraw ? 'D' : 'L'}
        </motion.div>
        
        <h2 data-testid="status-match-result" className="text-4xl md:text-7xl font-display font-black italic uppercase leading-none mb-3 drop-shadow-[0_5px_0_rgba(0,0,0,0.85)]">
          {isVictory ? 'You Won The Room' : isDraw ? 'Nobody Owns The Room' : 'You Got Cleared'}
        </h2>
        
        <p className="text-white/60 font-sans text-xs md:text-base max-w-md mx-auto mb-6 md:mb-9">
          {isVictory
            ? 'Six rounds of commitments. The receipts are clean. The clout is yours.'
            : isDraw
              ? 'The districts are split. No clean claim, no easy clout. Run it back.'
              : 'Six rounds of misplays. Your credibility is in the gutter. Run it back.'}
        </p>
        
        <div className="grid grid-cols-3 gap-1.5 md:gap-4 mb-7 md:mb-10">
          {results.map((r: any, i: number) => (
            <div key={i} className={`p-2.5 md:p-4 border backdrop-blur-md ${r.won ? 'border-primary bg-primary/15' : 'border-white/15 bg-black/70'}`} style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}>
              <div className="text-[7px] md:text-[10px] font-mono tracking-widest text-white/50 mb-1 md:mb-2 truncate">{r.name}</div>
              <div className="font-display font-black text-xl md:text-3xl mb-1">{r.player} <span className="text-white/30 text-sm md:text-lg mx-0.5 md:mx-1">-</span> {r.cpu}</div>
               <div className={`text-[7px] md:text-[10px] font-bold uppercase tracking-widest ${r.won ? 'text-primary' : 'text-white/40'}`}>
                 {r.won ? 'Secured' : r.tied ? 'Dead Heat' : 'Lost'}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex gap-2 md:gap-4 justify-center">
          <button data-testid="button-restart-match" onClick={onRestart} className="bg-primary text-black px-5 md:px-9 py-3.5 md:py-4 font-display font-black italic text-sm md:text-xl uppercase hover:bg-yellow-400 transition-transform active:translate-y-1 shadow-[0_5px_0_#854d0e] active:shadow-none">
            Run It Back
          </button>
          <button data-testid="button-change-deck" onClick={onChangeDeck} className="bg-black/70 border border-white/20 text-white px-5 md:px-9 py-3.5 md:py-4 font-display font-black italic text-sm md:text-xl uppercase hover:bg-white/15 transition-transform active:translate-y-1">
            Change Deck
          </button>
        </div>
      </motion.div>
    </div>
  );
}
