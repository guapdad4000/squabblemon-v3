import { motion, AnimatePresence } from 'framer-motion';
import { districts, getCardImage } from '../data';
import { CardView } from './CardView';
import { getDistrictResults, getEffectiveCardPower, getLaneScore, getLegalCardCost, Match } from '../gameEngine';
import type { PresentationPhase } from './PlayLoop';

export function Battle({
  match, deck, rivalDeck,
  selectedInstanceId, setSelectedInstanceId, selectedLane, setSelectedLane,
  commit, skipSequence, presentationPhase, phaseMessage, timerSeconds, timerEnabled, impactLane,
  stagedRival, activeEffectId, activeEffectLane,
  squabble, setSquabble, setInspect, archiveMatch, onShowRules
}: any) {

  const m = match as Match;

  const selectedCard = selectedInstanceId ? m.playerHand.find(c => c.instanceId === selectedInstanceId) : null;
  const selectedCost = selectedCard && selectedLane !== null ? getLegalCardCost(m, 'player', selectedCard, selectedLane as 0|1|2) : selectedCard?.cost;
  const districtResults = getDistrictResults(m);
  const playerClaims = districtResults.filter(result => result.winner === 'player').length;
  const cpuClaims = districtResults.filter(result => result.winner === 'cpu').length;
  const phase = presentationPhase as PresentationPhase;
  const interactive = phase === 'player-ready' && m.phase === 'player';
  const canSkip = ['versus','countdown-3','countdown-2','countdown-1','squabble','deal','round-intro','round-result'].includes(phase);

  const getActionState = () => {
    if (!interactive) return { label: canSkip ? 'Continue' : 'Resolving...', disabled: !canSkip, onClick: canSkip ? skipSequence : undefined, type: canSkip ? 'secondary' : 'disabled', testId: 'button-resolving' };
    if (m.phase === 'cpu-reveal') return { label: 'Revealing...', disabled: true, type: 'disabled', testId: 'button-resolving' };
    if (m.phase === 'complete') return { label: 'Archive Match', disabled: false, onClick: archiveMatch, type: 'primary', testId: 'button-archive-match' };

    if (selectedCard) {
       if (selectedLane === null) return { label: 'Pick District', disabled: true, type: 'disabled', testId: 'button-pick-district' };
       if ((selectedCost ?? 0) > m.playerHype) return { label: `Need ${selectedCost} Hype`, disabled: true, type: 'error', testId: 'button-lock' };
       return { label: 'Lock In', disabled: false, onClick: commit, type: 'primary', testId: 'button-lock' };
    }
    return { label: 'Pass Turn', disabled: false, onClick: commit, type: 'secondary', testId: 'button-next-round' };
  };

  const action = getActionState();

  const renderLog = () => {
    return <span className={`mx-3 opacity-90 ${phase.startsWith('rival') ? 'text-accent' : phase === 'round-result' ? 'text-green-400' : ''}`}>{phaseMessage}</span>;
  };

  return (
    <div className={`battle-arena phase-${phase} flex flex-col h-full w-full max-w-full mx-auto overflow-hidden relative z-10 bg-[#0d0d0d]`} aria-live="polite" aria-label={`Battle phase: ${phaseMessage}`}>
      
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
      </div>

      <AnimatePresence>
        {!interactive && phase !== 'effects' && (
          canSkip ? (
            <motion.button
              type="button"
              onClick={skipSequence}
              aria-label={`Continue past ${phaseMessage}`}
              initial={{ opacity: 0, scale: 1.25 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 grid place-items-center bg-black/20"
            >
              <span className={`cinematic-callout ${phase === 'squabble' ? 'text-accent' : 'text-white'}`}>{phaseMessage}</span>
            </motion.button>
          ) : (
            <motion.div
              role="status"
              aria-label={phaseMessage}
              initial={{ opacity: 0, scale: 1.25 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 grid place-items-center bg-black/20 pointer-events-none"
            >
              <span className="cinematic-callout text-white">{phaseMessage}</span>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* In-game rival HUD */}
      <div inert={!interactive} className="relative z-30 shrink-0 bg-gradient-to-b from-black via-black/85 to-transparent px-3 py-2 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="relative w-10 h-10 md:w-16 md:h-16 bg-zinc-900 border-2 border-accent/50 overflow-hidden shadow-lg shrink-0">
            <img src={getCardImage(rivalDeck.hero)} alt="" aria-hidden="true" className="absolute -top-2 left-1/2 -translate-x-1/2 w-[150%] h-[120%] object-cover object-top hue-rotate-180 brightness-75" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] md:text-xs font-mono tracking-widest text-accent uppercase truncate">Rival // {rivalDeck.archetype}</div>
            <div className="font-display font-black text-sm md:text-2xl uppercase leading-none text-white truncate">{rivalDeck.name}</div>
          </div>
        </div>
         <div className="flex items-center gap-2 md:gap-4">
            <button
              data-testid="button-rules-battle"
              onClick={onShowRules}
              className="min-h-10 px-2 border border-white/15 bg-black/60 font-mono text-[8px] uppercase tracking-wider text-white/60 hover:text-primary hover:border-primary"
            >
              Rules
            </button>
            <div className="hidden sm:block text-right">
              <div className="text-[8px] font-mono tracking-widest text-white/40 uppercase">Claims</div>
              <div className="font-display font-black text-sm"><span className="text-primary">{playerClaims}</span><span className="text-white/30">–</span><span className="text-accent">{cpuClaims}</span> <span className="text-white/35 text-[9px]">First to 2</span></div>
            </div>
           <div className="text-right">
             <div className="text-[9px] font-mono tracking-widest text-accent uppercase">Hype</div>
             <div className="font-display font-black text-xl text-white">{m.cpuHype}</div>
           </div>
           <div className="shrink-0 border border-white/15 bg-black/60 px-3 py-1 text-right">
             <div className="font-mono text-[9px] text-white/40 uppercase">Round</div>
             <div className="font-display font-black text-base md:text-xl leading-none">{m.round}<span className="text-white/30">/6</span></div>
           </div>
            {timerEnabled && (
              <div data-testid="turn-timer" aria-label={interactive ? `${timerSeconds} seconds remaining` : 'Decision timer paused'} className={`w-12 text-center border px-1 py-1 ${!interactive ? 'border-white/10 text-white/25' : timerSeconds <= 5 ? 'border-accent text-accent animate-pulse' : 'border-primary/40 text-primary'}`}>
                <div className="font-mono text-[7px] uppercase">Time</div>
                <div className="font-display font-black text-lg">{interactive ? timerSeconds : '—'}</div>
              </div>
            )}
        </div>
      </div>

      {/* Cinematic Message Banner */}
      <div className="relative z-30 shrink-0 w-full bg-black/80 border-y border-primary/30 flex overflow-x-auto hide-scrollbar py-1.5 md:py-2 items-center text-primary font-mono font-bold tracking-wider uppercase">
         <div className="flex px-4 min-w-full justify-center items-center gap-3">
            {renderLog()}
             <span data-testid="claims-live" className="shrink-0 text-[8px] text-white/50 border-l border-white/15 pl-3">
               Claims <b className="text-primary">{playerClaims}</b>–<b className="text-accent">{cpuClaims}</b>
             </span>
         </div>
      </div>

      {/* Board */}
      <div inert={!interactive} className="flex-1 min-h-0 flex flex-col md:flex-row justify-start md:justify-center px-2 md:px-4 gap-2 md:gap-4 relative z-20 overflow-y-auto overflow-x-hidden md:overflow-hidden hide-scrollbar py-2">
        {districts.map((d: any, i: number) => {
          const cpuCards = m.boards[i].filter(c => c.owner === 'cpu');
          const playerCards = m.boards[i].filter(c => c.owner === 'player');
            const pScore = getLaneScore(playerCards, i);
            const cScore = getLaneScore(cpuCards, i);
          const isSelectedLane = selectedLane === i;
            const roundWinner = pScore === cScore ? 'draw' : pScore > cScore ? 'player' : 'cpu';

          return (
            <div
              key={i}
              data-testid={`lane-container-${i}`}
              className={`district-lane district-lane-${i} flex-none h-[150px] md:h-auto md:flex-1 min-w-0 w-full md:w-auto grid grid-cols-[30%_40%_30%] md:flex md:flex-col relative group overflow-visible transition-all duration-300 ${impactLane === i ? 'district-impact' : ''} ${phase === 'round-result' || phase === 'match-finish' ? `district-verdict verdict-${roundWinner}` : ''} ${isSelectedLane ? 'ring-4 ring-primary bg-primary/8' : 'ring-1 ring-white/15 bg-black/72'}`}
            >
              {activeEffectLane === i && (
                <div className="effect-connection" aria-hidden="true">
                  <span />
                </div>
              )}
              <div className="absolute inset-0 pointer-events-none z-0">
                {isSelectedLane && <div className="absolute inset-0 border-2 border-primary animate-pulse" />}
              </div>
              
              {/* CPU Side Zone */}
              <div data-testid={`lane-${i}-cpu-zone`} className="h-full md:h-auto md:flex-1 w-full max-w-full flex items-center justify-start gap-1 md:gap-2 p-2 relative min-w-0 overflow-x-auto overflow-y-hidden hide-scrollbar">
                <span className="absolute top-1 left-1.5 font-mono text-[7px] text-accent/80 uppercase z-0">Rival</span>
                <AnimatePresence>
                   {impactLane === i && stagedRival && ['rival-travel', 'rival-reveal', 'rival-slam'].includes(phase) && (
                     phase === 'rival-travel' ? (
                       <motion.div
                         key={`back-${stagedRival.instanceId}`}
                         layoutId={stagedRival.instanceId}
                         initial={{ y: -90, rotate: 12, scale: .7, opacity: 0 }}
                         animate={{ y: 0, rotate: -4, scale: 1, opacity: 1 }}
                         className="card-back shrink-0 w-[58px] h-[82px] md:w-[96px] md:h-[134px]"
                       >
                         <span>S</span>
                       </motion.div>
                     ) : (
                       <CardView key={`staged-${stagedRival.instanceId}`} card={stagedRival} isBoard isEnemy effectivePower={stagedRival.power} />
                     )
                   )}
                  {cpuCards.map((c, j) => (
                    <CardView
                      key={c.instanceId}
                      card={c}
                      isBoard
                      isEnemy
                      testId={`card-board-rival-${i}-${c.cardId}-${j}`}
                      onClick={(e) => { e.stopPropagation(); setInspect(c); }}
                      effectivePower={getEffectiveCardPower(c)}
                       highlighted={activeEffectId === c.instanceId}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* District Control Slab */}
              <button
                type="button"
                data-testid={`lane-${i}`}
                onClick={() => {
                  if (interactive && selectedCard) setSelectedLane(i);
                }}
                disabled={!interactive || !selectedCard}
                aria-label={selectedCard ? `Deploy ${selectedCard.name} to ${d.name}` : `${d.name} district`}
                className="h-full md:h-auto md:w-full shrink-0 bg-zinc-950/95 border-x-2 md:border-x-0 md:border-y-2 border-zinc-800 flex items-center justify-between px-2 md:px-3 py-2 shadow-inner relative z-10 disabled:cursor-default enabled:hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <motion.div key={`cpu-${cScore}`} initial={{ scale: 1.5 }} animate={{ scale: 1 }} data-testid={`score-cpu-${i}`} className={`font-display font-black text-xl md:text-3xl ${cScore > pScore ? 'text-accent' : 'text-zinc-500'}`}>
                  {cScore}
                </motion.div>

                <div className="flex-1 px-2 flex flex-col items-center justify-center text-center">
                   <div className="text-[8px] md:text-[10px] font-mono tracking-widest text-white/40 mb-0.5 uppercase">District 0{i+1}</div>
                   <h3 className="font-display font-black text-xs md:text-lg uppercase text-white/90 leading-tight">{d.name}</h3>
                   <p className="text-[7px] md:text-[9px] text-primary/70 leading-tight line-clamp-2 mt-0.5">{d.rule}</p>
                   <div className={`mt-1 font-mono text-[7px] md:text-[8px] uppercase tracking-wide ${pScore > cScore ? 'text-primary' : cScore > pScore ? 'text-accent' : 'text-white/35'}`}>
                     {pScore > cScore ? 'You lead' : cScore > pScore ? 'Rival leads' : 'Tied'}
                   </div>
                    {selectedCard && interactive && (
                     <div className={`mt-1 px-1.5 py-0.5 border font-mono text-[6px] md:text-[8px] uppercase ${isSelectedLane ? 'border-primary bg-primary text-black' : 'border-primary/50 text-primary'}`}>
                       {isSelectedLane ? 'Ready to lock' : 'Tap to deploy'}
                     </div>
                   )}
                </div>

                <motion.div key={`player-${pScore}`} initial={{ scale: 1.5 }} animate={{ scale: 1 }} data-testid={`score-player-${i}`} className={`font-display font-black text-xl md:text-3xl ${pScore > cScore ? 'text-primary' : 'text-zinc-500'}`}>
                  {pScore}
                </motion.div>
              </button>

              {/* Player Side Zone */}
              <div data-testid={`lane-${i}-player-zone`} className="h-full md:h-auto md:flex-1 w-full max-w-full flex items-center justify-start gap-1 md:gap-2 p-2 relative min-w-0 overflow-x-auto overflow-y-hidden hide-scrollbar">
                <span className="absolute bottom-1 right-1.5 font-mono text-[7px] text-primary/80 uppercase z-0">You</span>
                <AnimatePresence>
                  {playerCards.map((c, j) => (
                    <CardView
                      key={c.instanceId}
                      card={c}
                      isBoard
                      testId={`card-board-player-${i}-${c.cardId}-${j}`}
                      onClick={(e) => { e.stopPropagation(); setInspect(c); }}
                      effectivePower={getEffectiveCardPower(c)}
                       highlighted={activeEffectId === c.instanceId}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom game HUD */}
      <div inert={!interactive} className="shrink-0 relative z-40 bg-[#0b0b0b] border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {/* Unclipped Hand Container */}
        <div data-testid="hand-tray" className="relative h-[140px] md:h-[190px] w-full overflow-x-auto overflow-y-hidden hide-scrollbar px-3 pt-4 md:pt-6">
          <div className="min-w-max h-full flex justify-start md:justify-center items-center gap-2 md:gap-4 mx-auto px-2">
            <AnimatePresence>
              {m.playerHand.map((c) => {
              const isSelected = selectedInstanceId === c.instanceId;
              const cost = selectedLane !== null ? getLegalCardCost(m, 'player', c, selectedLane as 0|1|2) : c.cost;
              return (
                <CardView
                  key={c.instanceId}
                  card={c}
                  queued={isSelected}
                  squabble={squabble && isSelected}
                  cost={cost}
                  onClick={(e) => {
                    e.stopPropagation();
                     if (!interactive) return;
                    if (isSelected) setSelectedInstanceId(null);
                    else setSelectedInstanceId(c.instanceId);
                  }}
                  className="origin-bottom"
                />
              )
              })}
            </AnimatePresence>
          </div>
        </div>
        {selectedCard && selectedLane !== null && interactive && (
          <div className={`target-trajectory target-lane-${selectedLane}`} aria-hidden="true"><span /></div>
        )}

        <div className="max-w-6xl mx-auto px-2 md:p-4 flex items-stretch gap-2 relative z-20">

          <div className="w-[80px] md:w-auto flex flex-col justify-center items-center bg-black/60 px-2 py-1 border border-white/10 shrink-0">
             <div className="text-[10px] font-mono tracking-widest text-primary uppercase leading-tight mb-1">Hype</div>
             <div data-testid="hype-player" className="font-display font-black text-3xl md:text-4xl text-white leading-none">{m.playerHype}</div>
          </div>

          <button
            data-testid="button-squabble"
            className={`relative min-h-12 px-3 md:px-5 border-2 flex-1 md:flex-none flex flex-col items-center justify-center transition-all ${squabble ? 'border-accent bg-accent/20 text-white shadow-[0_0_20px_rgba(225,29,72,0.28)]' : m.squabbleUsed || !selectedCard ? 'border-zinc-800 text-zinc-600 opacity-50' : 'border-zinc-700 hover:border-primary/50 text-white'}`}
            onClick={() => !m.squabbleUsed && interactive && setSquabble(!squabble)}
            disabled={m.squabbleUsed || !interactive || !selectedCard}
          >
            <span className="font-display font-black text-xs md:text-sm uppercase tracking-wider leading-none mb-0.5">
              {m.squabbleUsed ? 'Spent' : squabble ? 'Armed' : 'Squabble'}
            </span>
            <span className="text-[8px] md:text-[10px] font-mono uppercase opacity-70">
              {selectedCard ? 'Double selected' : 'Select a card'}
            </span>
          </button>

          <button
            data-testid={action.testId}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`min-h-12 flex-[2] md:flex-none md:min-w-[200px] px-2 md:px-8 font-display font-black text-sm md:text-xl italic uppercase transition-all
              ${action.type === 'primary' ? 'bg-primary text-black hover:bg-yellow-400 active:translate-y-1 shadow-[0_4px_0_#854d0e] active:shadow-none' : ''}
              ${action.type === 'secondary' ? 'bg-zinc-800 text-white hover:bg-zinc-700 active:translate-y-1 shadow-[0_4px_0_#000] active:shadow-none' : ''}
              ${action.type === 'disabled' ? 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed' : ''}
              ${action.type === 'error' ? 'bg-red-950 text-accent border border-accent cursor-not-allowed' : ''}
            `}
          >
            {action.label}
          </button>
        </div>
      </div>
    </div>
  );
}