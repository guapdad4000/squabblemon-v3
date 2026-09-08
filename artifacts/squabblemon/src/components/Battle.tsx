import React, { useState } from 'react';
import { cards, districts, getAssetUrl, getCardImage } from '../data';
import { CardView } from './CardView';
import { getDistrictResults, getEffectiveCardPower, getLaneScoreForMatch, getLegalCardCost, Match, getStoryLockedLanes, getStoryModifierSummaries, getActiveStoryPhase, type Lane } from '../gameEngine';
import type { PresentationEffect, PresentationPhase } from './PlayLoop';
import type { FeedbackPreferences } from '../battleFeedback';
import { decisionTimeBucket, trackEvent } from '../lib/analytics';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getEquippedVariant, getVariantKind } from './CardVariantTreatment';

type BattleDecisionContext = {
  match: Match;
  interactive: boolean;
  selectedInstanceId: string | null;
  selectedLane: number | null;
  squabble: boolean;
  lockedDistricts: number;
  decisionStartedAt?: number;
  setSelectedInstanceId: (value: string | null) => void;
  setSelectedLane: (value: number | null) => void;
  setSquabble: (value: boolean) => void;
};

export function createBattleDecisionHandlers(context: BattleDecisionContext) {
  const {
    match, interactive, selectedInstanceId, selectedLane, squabble,
    lockedDistricts, decisionStartedAt, setSelectedInstanceId, setSelectedLane, setSquabble,
  } = context;
  const decisionTime = () => decisionTimeBucket(decisionStartedAt ?? Date.now());

  return {
    selectCard(card: Match['playerHand'][number], playableSomewhere: boolean) {
      if (!interactive) return;
      if (selectedInstanceId) {
        trackEvent('battle_card_selection_backed_out', {
          round: match.round,
          action: selectedInstanceId === card.instanceId ? 'deselect' : 'replace',
          had_district: selectedLane !== null,
          squabble_armed: squabble,
          decision_time: decisionTime(),
        });
      }
      if (!playableSomewhere) {
        trackEvent('battle_unavailable_card_selected', {
          round: match.round,
          hype: match.playerHype,
          locked_districts: lockedDistricts,
          reason: lockedDistricts === districts.length ? 'all_districts_locked' : 'insufficient_hype',
          decision_time: decisionTime(),
        });
      }
      setSelectedInstanceId(selectedInstanceId === card.instanceId ? null : card.instanceId);
      setSelectedLane(null);
      setSquabble(false);
    },
    selectDistrict(lane: number, legal: boolean) {
      if (!interactive || !legal) return;
      trackEvent('battle_district_selected', {
        round: match.round,
        district: lane + 1,
        changed: selectedLane !== null && selectedLane !== lane,
        decision_time: decisionTime(),
      });
      setSelectedLane(lane);
    },
    toggleSquabble(selectedCard: Match['playerHand'][number] | null) {
      if (match.squabbleUsed || !interactive || !selectedCard) return;
      trackEvent('battle_squabble_toggled', {
        round: match.round,
        action: squabble ? 'cancel' : 'arm',
        decision_time: decisionTime(),
      });
      setSquabble(!squabble);
    },
    openHistory(entries: number) {
      trackEvent('battle_history_opened', {
        round: match.round,
        entries,
        decision_time: decisionTime(),
      });
    },
  };
}

export function Battle({
  match, deck, rivalDeck,
  selectedInstanceId, setSelectedInstanceId, selectedLane, setSelectedLane,
  commit, skipSequence, presentationPhase, phaseMessage, timerSeconds, timerEnabled, impactLane,
  stagedRival, stagedPlayer, activeEffectId, activeEffectLane, activeEffect,
  squabble, setSquabble, setInspect, archiveMatch, onShowRules, presentationScores,
  feedbackPreferences, setFeedbackPreferences, decisionStartedAt, equippedVariants,
}: any) {
  const m = match as Match;
  const selectedCard = selectedInstanceId ? m.playerHand.find(c => c.instanceId === selectedInstanceId) : null;
  const selectedCost = selectedCard && selectedLane !== null ? getLegalCardCost(m, 'player', selectedCard, selectedLane as Lane) : selectedCard?.cost;
  const districtResults = getDistrictResults(m);
  const playerClaims = districtResults.filter(result => result.winner === 'player').length;
  const cpuClaims = districtResults.filter(result => result.winner === 'cpu').length;
  const phase = presentationPhase as PresentationPhase;
  const reducedMotion = useReducedMotion()
    || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const presentedEffect = activeEffect as PresentationEffect | null;
  const feedback = feedbackPreferences as FeedbackPreferences | undefined;
  const interactive = phase === 'player-ready' && m.phase === 'player';
  const canSkip = ['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro', 'round-result'].includes(phase);
  const showCinematic = ['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro', 'lock-in', 'player-reveal', 'rival-reveal', 'district-flipped', 'round-result', 'match-finish'].includes(phase);
  const blocksFastForward = ['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro', 'round-result', 'match-finish'].includes(phase);
  const broadcastArtwork = phase === 'round-intro' && m.round === 1
    ? 'round-01'
    : phase === 'lock-in'
      ? 'lock-in'
      : phase === 'player-reveal' || phase === 'rival-reveal'
        ? 'reveal'
        : phase === 'district-flipped'
          ? 'district-flipped'
          : null;
  const lockedLanes = m.storyEncounter ? getStoryLockedLanes(m, 'player') : [];
  const modifierSummaries = m.storyEncounter ? getStoryModifierSummaries(m) : [];
  const activePhase = getActiveStoryPhase(m);
  const activePhaseIndex = m.storyRuntime?.activePhaseIndex ?? -1;
  const prevPhaseIndexRef = React.useRef(-1);
  const [phaseBanner, setPhaseBanner] = useState<string | null>(null);

  React.useEffect(() => {
    let timer: number | undefined;
    if (activePhaseIndex > prevPhaseIndexRef.current) {
      const phase = getActiveStoryPhase(m);
      if (phase) {
        setPhaseBanner(`Phase ${activePhaseIndex + 1}: ${phase.name}`);
        timer = window.setTimeout(() => setPhaseBanner(null), 3000);
        prevPhaseIndexRef.current = activePhaseIndex;
      }
      prevPhaseIndexRef.current = activePhaseIndex;
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activePhaseIndex, m]);

  const [showModifiers, setShowModifiers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStatuses, setShowStatuses] = useState(false);
  const rivalPortrait = m.storyEncounter ? getAssetUrl(m.storyEncounter.enemy.portraitAssetId) : getCardImage(rivalDeck.hero);
  const battlefield = getAssetUrl(m.storyEncounter?.battlefieldAssetId ?? 'assets/e71f5189-861e-418d-8237-fa20713b9122.png');
  const passive = m.storyEncounter?.passive;
  const allVisibleCards = [...m.playerHand, ...m.cpuHand, ...m.boards.flat()];
  const recentActions = m.effectLog.slice(-6).reverse();
  const cardName = (instanceId?: string, cardId?: string) =>
    allVisibleCards.find(card => card.instanceId === instanceId)?.name
    ?? cards[cardId ?? '']?.name
    ?? (cardId === 'story' ? 'Encounter' : 'Unknown card');
  const selectedHasLegalLane = selectedCard
    ? ([0, 1, 2] as Lane[]).some(lane => !lockedLanes.includes(lane) && getLegalCardCost(m, 'player', selectedCard, lane) <= m.playerHype)
    : false;
  const decisionHandlers = createBattleDecisionHandlers({
    match: m, interactive, selectedInstanceId, selectedLane, squabble,
    lockedDistricts: lockedLanes.length, decisionStartedAt,
    setSelectedInstanceId, setSelectedLane, setSquabble,
  });
  const decisionPrompt = !interactive
    ? 'Watch the highlighted card and district. Tap Fast Forward to finish the sequence.'
    : !selectedCard
      ? '1. Choose a card from your hand, or pass to save Hype.'
      : !selectedHasLegalLane
        ? `${selectedCard.name} cannot be played now: it needs more Hype or every district is locked. Choose another card or pass.`
      : selectedLane === null
        ? `2. Choose a lit district for ${selectedCard.name}. Its ability: ${selectedCard.effect}`
        : (selectedCost ?? 0) > m.playerHype
          ? `${districts[selectedLane].name} costs ${selectedCost} Hype. You only have ${m.playerHype}.`
          : `3. Review ${selectedCard.name} → ${districts[selectedLane].name}, then Lock In${m.squabbleUsed ? '.' : ' or arm SQUABBLE.'}`;

  const getActionState = () => {
    if (!interactive) return { label: canSkip ? 'Continue' : 'Resolving...', disabled: !canSkip, onClick: canSkip ? skipSequence : undefined, type: canSkip ? 'secondary' : 'disabled', testId: 'button-resolving' };
    if (m.phase === 'complete') return { label: 'Archive Match', disabled: false, onClick: archiveMatch, type: 'primary', testId: 'button-archive-match' };
    if (selectedCard) {
      if (selectedLane === null) return { label: 'Pick District', disabled: true, type: 'disabled', testId: 'button-pick-district' };
      if ((selectedCost ?? 0) > m.playerHype) return { label: `Need ${selectedCost} Hype`, disabled: true, type: 'error', testId: 'button-lock' };
      return { label: `Lock In · ${selectedCard.name} → ${districts[selectedLane].name} · ${selectedCost} Hype${squabble ? ' · SQUABBLE' : ''}`, disabled: false, onClick: commit, type: 'primary', testId: 'button-lock' };
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
      <motion.img key={`player-stage-${deck.hero}`} initial={{ opacity: 0, x: -24 }} animate={{ opacity: .22, x: 0 }} src={getCardImage(deck.hero)} alt="" aria-hidden="true" className={`absolute left-[2%] bottom-[12%] h-[42%] w-[30%] object-contain object-left-bottom brightness-75 drop-shadow-[0_18px_24px_rgba(0,0,0,0.9)] variant-portrait-${getVariantKind(getEquippedVariant(equippedVariants, deck.hero)) ?? 'base'}`} />
    </div>

    <AnimatePresence>
      {phaseBanner && (
        <motion.div initial={{ opacity: 0, scale: 0.9, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.1 }} className="absolute inset-0 z-50 pointer-events-none grid place-items-center bg-black/70 backdrop-blur-md border-y-2 border-accent">
          <div className="text-center p-8 bg-black/50 border border-accent/20 w-full max-w-2xl mx-auto shadow-[0_0_80px_rgba(225,29,72,0.3)]">
            <div className="font-mono text-accent text-[12px] uppercase tracking-[0.4em] mb-2 font-bold">{phaseBanner.split(':')[0]}</div>
            <div className="font-display font-black italic text-5xl md:text-7xl uppercase text-white drop-shadow-[0_4px_24px_rgba(225,29,72,0.8)]">{phaseBanner.split(':')[1]}</div>
            {activePhase?.description && <div className="mt-4 mx-auto max-w-lg text-rose-200 text-sm md:text-base border-t border-accent/30 pt-4">{activePhase.description}</div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>{!interactive && showCinematic && (canSkip ? <motion.button type="button" onClick={skipSequence} aria-label={`Continue past ${phaseMessage}`} initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.16 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="broadcast-overlay absolute inset-0 z-40 grid place-items-center bg-black/20">{broadcastArtwork ? <img data-testid={`broadcast-${broadcastArtwork}`} src={getAssetUrl(`assets/broadcast/${broadcastArtwork}.webp`)} alt="" aria-hidden="true" /> : <span className={`cinematic-callout ${phase === 'squabble' ? 'text-accent' : 'text-white'}`}>{phaseMessage}</span>}</motion.button> : <motion.div role="status" aria-label={phaseMessage} initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.16 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="broadcast-overlay absolute inset-0 z-40 grid place-items-center bg-black/20 pointer-events-none">{broadcastArtwork ? <img data-testid={`broadcast-${broadcastArtwork}`} src={getAssetUrl(`assets/broadcast/${broadcastArtwork}.webp`)} alt="" aria-hidden="true" /> : <span className="cinematic-callout text-white">{phaseMessage}</span>}</motion.div>)}</AnimatePresence>
    <div className="battle-header relative z-30 shrink-0">
      <div className="battle-rival"><div className="battle-rival-portrait"><img src={rivalPortrait} alt="" aria-hidden="true" className="absolute -top-2 left-1/2 -translate-x-1/2 w-[150%] h-[120%] object-cover object-top hue-rotate-180 brightness-75" /></div><div className="battle-rival-copy"><div className="text-[9px] font-mono tracking-widest text-accent uppercase truncate">Rival // {rivalDeck.archetype}</div><div className="font-display font-black text-sm md:text-2xl uppercase leading-none truncate">{rivalDeck.name}</div></div></div>
      <div className="battle-match-meta">
        {passive && (
          <div className="hidden lg:block border border-purple-500/50 bg-purple-500/10 px-2 py-1 text-right max-w-xs">
            <div className="text-[8px] font-mono text-purple-400 uppercase tracking-widest">Passive: {passive.name}</div>
            <div className="text-[9px] text-purple-200/70 truncate">{passive.description}</div>
          </div>
        )}
        {modifierSummaries.length > 0 && <div className="relative"><button type="button" onClick={() => setShowModifiers(v => !v)} aria-expanded={showModifiers} className="battle-utility">Mods</button>{showModifiers && <div className="battle-popover"><div className="mb-2 flex justify-between font-mono text-[8px] uppercase text-accent"><span>Active rules</span><button type="button" onClick={() => setShowModifiers(false)}>Close</button></div><ul className="space-y-2">{modifierSummaries.map((mod: string) => <li key={mod} className="border-l border-accent/50 pl-2 text-[9px] text-rose-100">{mod}</li>)}</ul></div>}</div>}
        <div className="relative"><button type="button" data-testid="button-battle-history" aria-label="Recent action history" onClick={() => { if (!showHistory) decisionHandlers.openHistory(recentActions.length); setShowHistory(v => !v); }} aria-expanded={showHistory} className="battle-utility"><span className="utility-long">History</span><span className="utility-short">Log</span></button>{showHistory && <div data-testid="battle-history" className="battle-popover w-72"><div className="mb-2 font-mono text-[9px] uppercase text-primary">Recent action</div>{recentActions.length ? <ol className="space-y-2">{recentActions.map(event => <li key={event.sequence} className="border-l-2 border-white/20 pl-2"><div className="text-[8px] font-mono uppercase text-white/40">Round {event.round} · {event.owner === 'player' ? 'You' : 'Rival'} · {event.type}</div><div className="text-[11px] leading-snug text-white/80"><b className="text-white">{cardName(event.source?.cardInstanceId ?? event.cardInstanceId, event.cardId)}</b> — {event.note}</div></li>)}</ol> : <p className="text-xs text-white/45">No actions yet.</p>}</div>}</div>
        <div className="relative"><button type="button" data-testid="button-status-key" aria-label="Persistent status explanations" onClick={() => setShowStatuses(v => !v)} aria-expanded={showStatuses} className="battle-utility"><span className="utility-long">Status</span><span className="utility-short">FX</span></button>{showStatuses && <div data-testid="battle-status-key" className="battle-popover w-64"><div className="mb-2 font-mono text-[9px] uppercase text-primary">Persistent status key</div><dl className="space-y-2 text-[11px]"><div><dt className="font-bold text-blue-300">Frozen</dt><dd className="text-white/60">Adds 0 Power until cleansed.</dd></div><div><dt className="font-bold text-zinc-300">Silenced</dt><dd className="text-white/60">Keeps Power; ability cannot fire.</dd></div><div><dt className="font-bold text-yellow-300">Protected</dt><dd className="text-white/60">Blocks one targeted effect this round.</dd></div><div><dt className="font-bold text-rose-300">Blocked</dt><dd className="text-white/60">Protection has been spent this round.</dd></div><div><dt className="font-bold text-purple-300">Moved</dt><dd className="text-white/60">An ability changed this card’s district.</dd></div></dl></div>}</div>
        {activePhase && <div className="hidden sm:block border border-accent/50 bg-accent/10 px-2 py-1 text-right"><div className="text-[8px] font-mono text-accent uppercase tracking-widest">Boss Phase</div><div className="font-display font-black text-sm text-rose-200 uppercase">{activePhase.name}</div></div>}
        <button data-testid="button-rules-battle" aria-label="Battle rules" onClick={onShowRules} className="battle-utility"><span className="utility-long">Rules</span><span className="utility-short">?</span></button>
        {feedback && <button type="button" data-testid="button-audio-toggle" aria-pressed={!feedback.audioEnabled} aria-label={feedback.audioEnabled ? 'Mute battle audio' : 'Unmute battle audio'} onClick={() => setFeedbackPreferences((value: FeedbackPreferences) => ({ ...value, audioEnabled: !value.audioEnabled }))} className="battle-utility"><span className="utility-long">{feedback.audioEnabled ? 'Sound' : 'Muted'}</span><span className="utility-short">{feedback.audioEnabled ? '♪' : '×'}</span></button>}
        {feedback && typeof navigator !== 'undefined' && 'vibrate' in navigator && <button type="button" data-testid="button-haptics-toggle" aria-pressed={!feedback.hapticsEnabled} aria-label={feedback.hapticsEnabled ? 'Disable battle haptics' : 'Enable battle haptics'} onClick={() => setFeedbackPreferences((value: FeedbackPreferences) => ({ ...value, hapticsEnabled: !value.hapticsEnabled }))} className="battle-utility"><span className="utility-long">{feedback.hapticsEnabled ? 'Haptics' : 'No buzz'}</span><span className="utility-short">≈</span></button>}
        <div className="hidden sm:block text-right"><div className="text-[8px] font-mono text-white/40 uppercase">Claims</div><div className="font-display font-black text-sm"><span className="text-primary">{playerClaims}</span>–<span className="text-accent">{cpuClaims}</span></div></div><div className="text-right"><div className="text-[9px] font-mono text-accent uppercase">Hype</div><div className="font-display font-black text-xl">{m.cpuHype}</div></div><div className="border border-white/15 bg-black/60 px-3 py-1 text-right"><div className="font-mono text-[9px] text-white/40 uppercase">Round</div><div className="font-display font-black text-base">{m.round}<span className="text-white/30">/6</span></div></div>
        {timerEnabled && <div data-testid="turn-timer" aria-label={interactive ? `${timerSeconds} seconds remaining` : 'Decision timer paused'} className="w-12 text-center border px-1 py-1"><div className="font-mono text-[7px] uppercase">Time</div><div className="font-display font-black text-lg">{interactive ? timerSeconds : '—'}</div></div>}
      </div>
    </div>
    <div className="battle-guidance relative z-30 shrink-0 w-full">
      <div className="min-w-0">
        <div className="battle-guidance-kicker">{interactive ? 'Your decision' : presentedEffect ? `${presentedEffect.owner === 'player' ? 'Your' : 'Rival'} ${presentedEffect.type}` : 'Match flow'}</div>
        <div data-testid="battle-guidance" className="battle-guidance-message">{presentedEffect && <span className={`effect-kind-chip kind-${presentedEffect.kind}`}>{presentedEffect.kind}{presentedEffect.durationLabel ? ` · ${presentedEffect.durationLabel}` : ''}</span>} {interactive ? decisionPrompt : phaseMessage}</div>
        {presentedEffect && <div data-testid="effect-causality" className="battle-causality"><b>{cardName(presentedEffect.source?.cardInstanceId ?? presentedEffect.cardInstanceId, presentedEffect.cardId)}</b>{presentedEffect.targetIds.length > 0 ? ` affected ${presentedEffect.targetIds.map(id => cardName(id)).join(', ')}` : ` affected district ${presentedEffect.lane + 1}`}. Score: Rival {presentedEffect.scores.before[presentedEffect.lane]?.cpu ?? 0} / You {presentedEffect.scores.before[presentedEffect.lane]?.player ?? 0} → Rival {presentedEffect.scores.after[presentedEffect.lane]?.cpu ?? 0} / You {presentedEffect.scores.after[presentedEffect.lane]?.player ?? 0}.</div>}
      </div>
      <span data-testid="claims-live" className="battle-claims">Claims <b className="text-primary">{playerClaims}</b>–<b className="text-accent">{cpuClaims}</b></span>
      {!interactive && !blocksFastForward && <button type="button" data-testid="button-fast-forward" onClick={skipSequence} className="battle-fast-forward">Fast forward</button>}
    </div>
    <div className="battlefield-grid flex-1 min-h-0 relative z-20">{districts.map((d: any, i: number) => {
      const cpuCards = m.boards[i].filter(c => c.owner === 'cpu'); const playerCards = m.boards[i].filter(c => c.owner === 'player');
      const snapshot = presentationScores?.find((score: { lane: number }) => score.lane === i);
      const pScore = snapshot?.player ?? getLaneScoreForMatch(m, playerCards, i as Lane, 'player'); const cScore = snapshot?.cpu ?? getLaneScoreForMatch(m, cpuCards, i as Lane, 'cpu');
      const lockedLane = lockedLanes.includes(i as Lane); const laneCost = selectedCard ? getLegalCardCost(m, 'player', selectedCard, i as Lane) : null; const affordable = laneCost !== null && laneCost <= m.playerHype; const legal = !!selectedCard && !lockedLane && affordable; const selected = selectedLane === i; const winner = pScore === cScore ? 'draw' : pScore > cScore ? 'player' : 'cpu';
      const stagedRivalHere = impactLane === i && stagedRival && phase === 'rival-travel'; const stagedPlayerHere = impactLane === i && stagedPlayer && phase === 'player-travel';
      return <div key={i} data-testid={`lane-container-${i}`} className={`district-lane district-lane-${i} min-w-0 relative group ${impactLane === i ? 'district-impact' : ''} ${phase === 'round-result' || phase === 'match-finish' ? `district-verdict verdict-${winner}` : ''} ${selected ? 'is-selected' : ''} ${selectedCard && interactive ? legal ? 'is-legal' : 'is-illegal' : ''} ${activeEffectLane === i ? 'is-effect-lane' : ''} ${lockedLane ? 'is-locked' : ''}`}>
        {activeEffectLane === i && <div className="effect-connection" aria-hidden="true"><span /></div>}
        <div data-testid={`lane-${i}-cpu-zone`} className="battle-side battle-side-rival"><span className="side-mark side-mark-rival">Rival</span><div className="battle-card-stack"><AnimatePresence>{stagedRivalHere && <motion.div key={`back-${stagedRival.instanceId}`} layoutId={stagedRival.instanceId} data-instance-id={stagedRival.instanceId} data-presentation-copy="staged" initial={{ y: -90, rotate: 12, scale: .7, opacity: 0 }} animate={{ y: 0, rotate: -4, scale: 1, opacity: 1 }} className="card-back battle-board-card"><span>S</span></motion.div>}{cpuCards.map((c, j) => <CardView key={c.instanceId} card={c} isBoard isEnemy disableLayout testId={`card-board-rival-${i}-${c.cardId}-${j}`} onClick={(e) => { e.stopPropagation(); setInspect(c); }} effectivePower={getEffectiveCardPower(c)} {...effectProps(c)} />)}</AnimatePresence></div></div>
        <button type="button" data-testid={`lane-${i}`} onClick={() => decisionHandlers.selectDistrict(i, legal)} aria-disabled={!interactive || !selectedCard || !legal} tabIndex={interactive && selectedCard ? 0 : -1} aria-label={selectedCard ? `${legal ? 'Deploy' : lockedLane ? 'Cannot deploy, district locked' : `Cannot deploy, need ${laneCost} Hype`} ${selectedCard.name} to ${d.name}` : `${d.name} district`} title={lockedLane ? 'This district is locked this round.' : selectedCard && !affordable ? `Need ${laneCost} Hype; you have ${m.playerHype}.` : undefined} className="district-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><div className="district-marker"><div className="district-score-row"><motion.span key={`cpu-${cScore}`} initial={{ scale: 1.45 }} animate={{ scale: 1 }} data-testid={`score-cpu-${i}`} className={cScore > pScore ? 'text-accent' : 'text-white/55'}>{cScore}</motion.span><span className="score-divider">:</span><motion.span key={`player-${pScore}`} initial={{ scale: 1.45 }} animate={{ scale: 1 }} data-testid={`score-player-${i}`} className={pScore > cScore ? 'text-primary' : 'text-white/55'}>{pScore}</motion.span></div><div className="district-kicker">0{i + 1} · {pScore > cScore ? 'You lead' : cScore > pScore ? 'Rival leads' : 'Tied'}</div><h3>{d.name}</h3><p>{d.rule}</p>{lockedLane ? <span className="district-prompt is-blocked">Locked this round</span> : selectedCard && interactive && <span className={`district-prompt ${selected ? 'is-ready' : affordable ? '' : 'is-blocked'}`}>{selected ? `Ready · ${laneCost} Hype` : affordable ? `Play · ${laneCost} Hype` : `Need ${laneCost} Hype`}</span>}</div></button>
        <div data-testid={`lane-${i}-player-zone`} className="battle-side battle-side-player"><span className="side-mark side-mark-player">You</span><div className="battle-card-stack"><AnimatePresence>{stagedPlayerHere && <motion.div key={`player-back-${stagedPlayer.instanceId}`} data-instance-id={stagedPlayer.instanceId} data-presentation-copy="staged" initial={{ y: 90, rotate: -10, scale: .72, opacity: 0 }} animate={{ y: 0, rotate: 3, scale: 1, opacity: 1 }} className="card-back battle-board-card"><span>S</span></motion.div>}{playerCards.map((c, j) => <CardView key={c.instanceId} card={c} variantId={getEquippedVariant(equippedVariants, c.id)} isBoard disableLayout testId={`card-board-player-${i}-${c.cardId}-${j}`} onClick={(e) => { e.stopPropagation(); setInspect(c); }} effectivePower={getEffectiveCardPower(c)} {...effectProps(c)} />)}</AnimatePresence></div></div>
      </div>;
    })}</div>
    <div inert={!interactive} className="battle-command-deck shrink-0 relative z-40"><div id="hand-tray" data-testid="hand-tray" className="battle-hand-tray"><div className="battle-hand-row"><AnimatePresence>{m.playerHand.filter(c => c.instanceId !== stagedPlayer?.instanceId).map(c => { const playableSomewhere = ([0, 1, 2] as Lane[]).some(lane => !lockedLanes.includes(lane) && getLegalCardCost(m, 'player', c, lane) <= m.playerHype); const reason = !playableSomewhere ? `Cannot play now. Need more Hype or an unlocked district.` : undefined; return <CardView key={c.instanceId} card={c} variantId={getEquippedVariant(equippedVariants, c.id)} queued={selectedInstanceId === c.instanceId} squabble={squabble && selectedInstanceId === c.instanceId} cost={selectedLane !== null ? getLegalCardCost(m, 'player', c, selectedLane as Lane) : c.cost} unavailable={interactive && !playableSomewhere} disabledReason={reason} onClick={(e) => { e.stopPropagation(); decisionHandlers.selectCard(c, playableSomewhere); }} className="origin-bottom" />; })}</AnimatePresence></div></div>
      {selectedCard && selectedLane !== null && interactive && <div className={`target-trajectory target-lane-${selectedLane}`} aria-hidden="true"><span /></div>}
      <div className="battle-actions"><div className="battle-hype"><div>Hype</div><strong data-testid="hype-player">{m.playerHype}</strong></div><button data-testid="button-squabble" title={m.squabbleUsed ? 'SQUABBLE has already been used.' : !selectedCard ? 'Choose a card first.' : 'Double this card’s base Power once per match.'} className={`battle-squabble ${squabble ? 'is-armed' : ''}`} onClick={() => decisionHandlers.toggleSquabble(selectedCard ?? null)} disabled={m.squabbleUsed || !interactive || !selectedCard}>{m.squabbleUsed ? 'Squabble spent' : squabble ? 'Squabble armed' : 'Arm Squabble'}</button><button data-testid={action.testId} onClick={action.onClick} disabled={action.disabled} className={`battle-primary-action action-${action.type}`}>{action.label}</button></div>
    </div>
  </div>;
}
