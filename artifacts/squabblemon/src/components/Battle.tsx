import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { districts, getAssetUrl, getCardImage } from '../data';
import { CardView } from './CardView';
import { getDistrictResults, getEffectiveCardPower, getLaneScoreForMatch, getLegalCardCost, Match, getStoryLockedLanes, getStoryModifierSummaries, getActiveStoryPhase, type Lane } from '../gameEngine';
import type { PresentationEffect, PresentationPhase } from './PlayLoop';

export function Battle({
  match, deck, rivalDeck,
  selectedInstanceId, setSelectedInstanceId, selectedLane, setSelectedLane,
  commit, skipSequence, presentationPhase, phaseMessage, timerSeconds, timerEnabled, impactLane,
  stagedRival, stagedPlayer, activeEffectId, activeEffectLane, activeEffect,
  squabble, setSquabble, setInspect, archiveMatch, onShowRules, presentationScores
}: any) {
  const m = match as Match;
  const selectedCard = selectedInstanceId ? m.playerHand.find(c => c.instanceId === selectedInstanceId) : null;
  const selectedCost = selectedCard && selectedLane !== null ? getLegalCardCost(m, 'player', selectedCard, selectedLane as Lane) : selectedCard?.cost;
  const districtResults = getDistrictResults(m);
  const playerClaims = districtResults.filter(result => result.winner === 'player').length;
  const cpuClaims = districtResults.filter(result => result.winner === 'cpu').length;
  const phase = presentationPhase as PresentationPhase;
  const presentedEffect = activeEffect as PresentationEffect | null;
  const interactive = phase === 'player-ready' && m.phase === 'player';
  const canSkip = ['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro', 'round-result'].includes(phase);
  const showCinematic = ['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro', 'round-result', 'match-finish'].includes(phase);
  const lockedLanes = m.storyEncounter ? getStoryLockedLanes(m, 'player') : [];
  const modifierSummaries = m.storyEncounter ? getStoryModifierSummaries(m) : [];
  const activePhase = getActiveStoryPhase(m);
  const [showModifiers, setShowModifiers] = useState(false);
  const rivalPortrait = m.storyEncounter ? getAssetUrl(m.storyEncounter.enemy.portraitAssetId) : getCardImage(rivalDeck.hero);
  const battlefield = getAssetUrl(m.storyEncounter?.battlefieldAssetId ?? 'assets/e71f5189-861e-418d-8237-fa20713b9122.png');

  const getActionState = () => {
    if (!interactive) return { label: canSkip ? 'Continue' : 'Resolving...', disabled: !canSkip, onClick: canSkip ? skipSequence : undefined, type: canSkip ? 'secondary' : 'disabled', testId: 'button-resolving' };
    if (m.phase === 'complete') return { label: 'Archive Match', disabled: false, onClick: archiveMatch, type: 'primary', testId: 'button-archive-match' };
    if (selectedCard) {
      if (selectedLane === null) return { label: 'Pick District', disabled: true, type: 'disabled', testId: 'button-pick-district' };
      if ((selectedCost ?? 0) > m.playerHype) return { label: `Need ${selectedCost} Hype`, disabled: true, type: 'error', testId: 'button-lock' };
      return { label: 'Lock In', disabled: false, onClick: commit, type: 'primary', testId: 'button-lock' };
    }
    return { label: 'Pass Turn', disabled: false, onClick: commit, type: 'secondary', testId: 'button-next-round' };
  };
  const action = getActionState();
  const effectProps = (card: any) => ({
    highlighted: activeEffectId === card.instanceId,
    effectRole: activeEffectId === card.instanceId
      ? ('source' as const)
      : presentedEffect?.targetIds.includes(card.instanceId)
        ? ('target' as const)
        : undefined,
    effectKind: presentedEffect && (activeEffectId === card.instanceId || presentedEffect.targetIds.includes(card.instanceId)) ? presentedEffect.kind : undefined,
  });

  return <div className={`battle-arena phase-${phase} flex flex-col h-full w-full max-w-full mx-auto overflow-hidden relative z-10 bg-[#0d0d0d]`} aria-live="polite" aria-label={`Battle phase: ${phaseMessage}`}>
    <div className="absolute inset-0 z-0 pointer-events-none perspective-1000 overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center opacity-80" style={{ backgroundImage: `url("${battlefield}")` }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(103,72,25,0.08),rgba(0,0,0,0.72)_74%)]" />
      <motion.img key={`rival-stage-${rivalDeck.hero}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: .24, x: 0 }} src={rivalPortrait} alt="" aria-hidden="true" className="absolute right-[2%] top-[5%] h-[42%] w-[30%] object-contain object-right-top grayscale brightness-75 drop-shadow-[0_18px_24px_rgba(0,0,0,0.9)]" />
      <motion.img key={`player-stage-${deck.hero}`} initial={{ opacity: 0, x: -24 }} animate={{ opacity: .22, x: 0 }} src={getCardImage(deck.hero)} alt="" aria-hidden="true" className="absolute left-[2%] bottom-[12%] h-[42%] w-[30%] object-contain object-left-bottom brightness-75 drop-shadow-[0_18px_24px_rgba(0,0,0,0.9)]" />
    </div>
    <AnimatePresence>{!interactive && showCinematic && (canSkip ? <motion.button type="button" onClick={skipSequence} aria-label={`Continue past ${phaseMessage}`} initial={{ opacity: 0, scale: 1.25 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 grid place-items-center bg-black/20"><span className={`cinematic-callout ${phase === 'squabble' ? 'text-accent' : 'text-white'}`}>{phaseMessage}</span></motion.button> : <motion.div role="status" aria-label={phaseMessage} initial={{ opacity: 0, scale: 1.25 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 grid place-items-center bg-black/20 pointer-events-none"><span className="cinematic-callout text-white">{phaseMessage}</span></motion.div>)}</AnimatePresence>
    <div inert={!interactive} className="relative z-30 shrink-0 bg-gradient-to-b from-black via-black/85 to-transparent px-3 py-2 flex justify-between items-center border-b border-white/5">
      <div className="flex items-center gap-2 min-w-0"><div className="relative w-10 h-10 md:w-16 md:h-16 bg-zinc-900 border-2 border-accent/50 overflow-hidden"><img src={rivalPortrait} alt="" aria-hidden="true" className="absolute -top-2 left-1/2 -translate-x-1/2 w-[150%] h-[120%] object-cover object-top hue-rotate-180 brightness-75" /></div><div className="min-w-0"><div className="text-[9px] font-mono tracking-widest text-accent uppercase truncate">Rival // {rivalDeck.archetype}</div><div className="font-display font-black text-sm md:text-2xl uppercase leading-none truncate">{rivalDeck.name}</div></div></div>
      <div className="flex items-center gap-2 md:gap-4">
        {modifierSummaries.length > 0 && <div className="relative"><button type="button" onClick={() => setShowModifiers(v => !v)} aria-expanded={showModifiers} className="min-h-10 px-2 border border-accent/30 bg-accent/10 font-mono text-[8px] uppercase text-rose-200">Mods</button>{showModifiers && <div className="absolute top-full right-0 mt-2 w-56 bg-black border border-accent p-3 z-50 text-left shadow-2xl"><div className="mb-2 flex justify-between font-mono text-[8px] uppercase text-accent"><span>Active rules</span><button type="button" onClick={() => setShowModifiers(false)}>Close</button></div><ul className="space-y-2">{modifierSummaries.map((mod: string) => <li key={mod} className="border-l border-accent/50 pl-2 text-[9px] text-rose-100">{mod}</li>)}</ul></div>}</div>}
        {activePhase && <div className="hidden sm:block border border-accent/50 bg-accent/10 px-2 py-1 text-right"><div className="text-[8px] font-mono text-accent uppercase">Boss Phase</div><div className="font-display font-black text-sm text-rose-200 uppercase">{activePhase.name}</div></div>}
        <button data-testid="button-rules-battle" onClick={onShowRules} className="min-h-10 px-2 border border-white/15 bg-black/60 font-mono text-[8px] uppercase text-white/60">Rules</button>
        <div className="hidden sm:block text-right"><div className="text-[8px] font-mono text-white/40 uppercase">Claims</div><div className="font-display font-black text-sm"><span className="text-primary">{playerClaims}</span>–<span className="text-accent">{cpuClaims}</span></div></div><div className="text-right"><div className="text-[9px] font-mono text-accent uppercase">Hype</div><div className="font-display font-black text-xl">{m.cpuHype}</div></div><div className="border border-white/15 bg-black/60 px-3 py-1 text-right"><div className="font-mono text-[9px] text-white/40 uppercase">Round</div><div className="font-display font-black text-base">{m.round}<span className="text-white/30">/6</span></div></div>
        {timerEnabled && <div data-testid="turn-timer" aria-label={interactive ? `${timerSeconds} seconds remaining` : 'Decision timer paused'} className="w-12 text-center border px-1 py-1"><div className="font-mono text-[7px] uppercase">Time</div><div className="font-display font-black text-lg">{interactive ? timerSeconds : '—'}</div></div>}
      </div>
    </div>
    <div className="relative z-30 shrink-0 w-full bg-black/80 border-y border-primary/30 flex py-2 items-center text-primary font-mono font-bold tracking-wider uppercase"><div className="flex px-4 min-w-full justify-center items-center gap-3">{presentedEffect && <span className={`effect-kind-chip kind-${presentedEffect.kind}`}>{presentedEffect.kind}{presentedEffect.durationLabel ? ` · ${presentedEffect.durationLabel}` : ''}</span>}<span className={`mx-3 opacity-90 ${phase.startsWith('rival') ? 'text-accent' : phase === 'round-result' ? 'text-green-400' : ''}`}>{phaseMessage}</span><span data-testid="claims-live" className="text-[8px] text-white/50 border-l border-white/15 pl-3">Claims <b className="text-primary">{playerClaims}</b>–<b className="text-accent">{cpuClaims}</b></span></div></div>
    <div inert={!interactive} className="battlefield-grid flex-1 min-h-0 relative z-20">{districts.map((d: any, i: number) => {
      const cpuCards = m.boards[i].filter(c => c.owner === 'cpu'); const playerCards = m.boards[i].filter(c => c.owner === 'player');
      const snapshot = presentationScores?.find((score: { lane: number }) => score.lane === i);
      const pScore = snapshot?.player ?? getLaneScoreForMatch(m, playerCards, i as Lane, 'player'); const cScore = snapshot?.cpu ?? getLaneScoreForMatch(m, cpuCards, i as Lane, 'cpu');
      const lockedLane = lockedLanes.includes(i as Lane); const selected = selectedLane === i; const winner = pScore === cScore ? 'draw' : pScore > cScore ? 'player' : 'cpu';
      const stagedRivalHere = impactLane === i && stagedRival && phase === 'rival-travel'; const stagedPlayerHere = impactLane === i && stagedPlayer && phase === 'player-travel';
      return <div key={i} data-testid={`lane-container-${i}`} className={`district-lane district-lane-${i} min-w-0 relative group ${impactLane === i ? 'district-impact' : ''} ${phase === 'round-result' || phase === 'match-finish' ? `district-verdict verdict-${winner}` : ''} ${selected ? 'is-selected' : ''} ${activeEffectLane === i ? 'is-effect-lane' : ''} ${lockedLane ? 'is-locked opacity-75' : ''}`}>
        {activeEffectLane === i && <div className="effect-connection" aria-hidden="true"><span /></div>}
        <div data-testid={`lane-${i}-cpu-zone`} className="battle-side battle-side-rival"><span className="side-mark side-mark-rival">Rival</span><div className="battle-card-stack"><AnimatePresence>{stagedRivalHere && <motion.div key={`back-${stagedRival.instanceId}`} layoutId={stagedRival.instanceId} data-instance-id={stagedRival.instanceId} data-presentation-copy="staged" initial={{ y: -90, rotate: 12, scale: .7, opacity: 0 }} animate={{ y: 0, rotate: -4, scale: 1, opacity: 1 }} className="card-back battle-board-card"><span>S</span></motion.div>}{cpuCards.map((c, j) => <CardView key={c.instanceId} card={c} isBoard isEnemy testId={`card-board-rival-${i}-${c.cardId}-${j}`} onClick={(e) => { e.stopPropagation(); setInspect(c); }} effectivePower={getEffectiveCardPower(c)} {...effectProps(c)} />)}</AnimatePresence></div></div>
        <button type="button" data-testid={`lane-${i}`} onClick={() => { if (interactive && selectedCard && !lockedLane) setSelectedLane(i); }} disabled={!interactive || !selectedCard || lockedLane} aria-label={selectedCard ? `Deploy ${selectedCard.name} to ${d.name}` : `${d.name} district`} className="district-target disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><div className="district-marker"><div className="district-score-row"><motion.span key={`cpu-${cScore}`} initial={{ scale: 1.45 }} animate={{ scale: 1 }} data-testid={`score-cpu-${i}`} className={cScore > pScore ? 'text-accent' : 'text-white/55'}>{cScore}</motion.span><span className="score-divider">:</span><motion.span key={`player-${pScore}`} initial={{ scale: 1.45 }} animate={{ scale: 1 }} data-testid={`score-player-${i}`} className={pScore > cScore ? 'text-primary' : 'text-white/55'}>{pScore}</motion.span></div><div className="district-kicker">0{i + 1} · {pScore > cScore ? 'You lead' : cScore > pScore ? 'Rival leads' : 'Tied'}</div><h3>{d.name}</h3><p>{d.rule}</p>{lockedLane ? <span className="district-prompt">Locked</span> : selectedCard && interactive && <span className={`district-prompt ${selected ? 'is-ready' : ''}`}>{selected ? 'Ready' : 'Deploy'}</span>}</div></button>
        <div data-testid={`lane-${i}-player-zone`} className="battle-side battle-side-player"><span className="side-mark side-mark-player">You</span><div className="battle-card-stack"><AnimatePresence>{stagedPlayerHere && <motion.div key={`player-back-${stagedPlayer.instanceId}`} data-instance-id={stagedPlayer.instanceId} data-presentation-copy="staged" initial={{ y: 90, rotate: -10, scale: .72, opacity: 0 }} animate={{ y: 0, rotate: 3, scale: 1, opacity: 1 }} className="card-back battle-board-card"><span>S</span></motion.div>}{playerCards.map((c, j) => <CardView key={c.instanceId} card={c} isBoard testId={`card-board-player-${i}-${c.cardId}-${j}`} onClick={(e) => { e.stopPropagation(); setInspect(c); }} effectivePower={getEffectiveCardPower(c)} {...effectProps(c)} />)}</AnimatePresence></div></div>
      </div>;
    })}</div>
    <div inert={!interactive} className="shrink-0 relative z-40 bg-[#0b0b0b] border-t border-white/10 pb-[max(0.5rem,env(safe-area-inset-bottom))]"><div id="hand-tray" data-testid="hand-tray" className="relative h-[140px] md:h-[190px] w-full overflow-x-auto overflow-y-hidden px-3 pt-4"><div className="min-w-max h-full flex justify-start md:justify-center items-center gap-2 md:gap-4 mx-auto px-2"><AnimatePresence>{m.playerHand.filter(c => c.instanceId !== stagedPlayer?.instanceId).map(c => <CardView key={c.instanceId} card={c} queued={selectedInstanceId === c.instanceId} squabble={squabble && selectedInstanceId === c.instanceId} cost={selectedLane !== null ? getLegalCardCost(m, 'player', c, selectedLane as Lane) : c.cost} onClick={(e) => { e.stopPropagation(); if (interactive) setSelectedInstanceId(selectedInstanceId === c.instanceId ? null : c.instanceId); }} className="origin-bottom" />)}</AnimatePresence></div></div>
      {selectedCard && selectedLane !== null && interactive && <div className={`target-trajectory target-lane-${selectedLane}`} aria-hidden="true"><span /></div>}
      <div className="max-w-6xl mx-auto px-2 md:p-4 flex items-stretch gap-2 relative z-20"><div className="w-[80px] flex flex-col justify-center items-center bg-black/60 px-2 py-1 border border-white/10"><div className="text-[10px] font-mono text-primary uppercase">Hype</div><div data-testid="hype-player" className="font-display font-black text-3xl">{m.playerHype}</div></div><button data-testid="button-squabble" className="min-h-12 px-3 border-2 flex-1" onClick={() => !m.squabbleUsed && interactive && setSquabble(!squabble)} disabled={m.squabbleUsed || !interactive || !selectedCard}>{m.squabbleUsed ? 'Spent' : squabble ? 'Armed' : 'Squabble'}</button><button data-testid={action.testId} onClick={action.onClick} disabled={action.disabled} className={`min-h-12 flex-[2] px-2 md:px-8 font-display font-black text-sm md:text-xl italic uppercase ${action.type === 'primary' ? 'bg-primary text-black' : action.type === 'secondary' ? 'bg-zinc-800 text-white' : action.type === 'error' ? 'bg-red-950 text-accent' : 'bg-zinc-900 text-zinc-500'}`}>{action.label}</button></div>
    </div>
  </div>;
}
