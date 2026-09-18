import { MusicControls } from './MusicControls';
import { BattleArtPreload, BattleStartArt } from './BattleArt';
import { GameGlyph } from './venue/GameGlyph';
import { DistrictEffects, MotionEnergy } from './BattleEffects';
import { DrFadePortrait } from './DrFade';
import { BattleDragOverlay, useBattleDrag } from './useBattleDrag';
import { previewBattlePlay } from '../battlePreview';
import { RivalTell, BattleRound } from './BattleReadability';
import { BattleCrew } from './BattleCrew';
import { eventIntensity } from '../battleChoreography';
import { BattleAttack } from './BattleAttack';
import React, { useEffect, useRef, useState } from 'react';
import { cards, getAssetUrl } from '../data';
import { CardView } from './CardView';
import { getMatchDistricts, getCardCostExplanation, getDistrictResults, getEffectiveCardPower, getLaneScoreForMatch, getLegalCardCost, getRivalIntent, Match, getStoryLockedLanes, getStoryModifierSummaries, getActiveStoryPhase, type EffectLogEntry, type Lane } from '../gameEngine';
import type { PresentationEffect, PresentationPhase } from './PlayLoop';
import type { FeedbackPreferences } from '../battleFeedback';
import { decisionTimeBucket, trackEvent } from '../lib/analytics';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { getEquippedVariant, getVariantKind } from './CardVariantTreatment';
import { getTurnTimerProgress, getTurnTimerState } from '../turnTimer';
import { getAuthoredCardUpgrades } from './CardUpgrades';
import { resolveBattleVenue } from '../battleVenues';
import { ArrowRight, Check, ChevronsRight, CircleHelp, Flag, History, LockKeyhole, MoreHorizontal, Shield, Swords, Volume2, VolumeX, X } from 'lucide-react';
import './battle-hud.css';
import './battle-locations.css';
import { LocationNode, LocationWallpaper } from './LocationArtwork';

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
  beginSquabbleTransition?: () => boolean;
};

export function createBattleDecisionHandlers(context: BattleDecisionContext) {
  const {
    match, interactive, selectedInstanceId, selectedLane, squabble,
    lockedDistricts, decisionStartedAt, setSelectedInstanceId, setSelectedLane, setSquabble,
    beginSquabbleTransition,
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
          motion: match.playerMotion,
          locked_districts: lockedDistricts,
          reason: lockedDistricts === 3 ? 'all_districts_locked' : 'insufficient_motion',
          decision_time: decisionTime(),
        });
      }
      const deselecting = selectedInstanceId === card.instanceId;
      setSelectedInstanceId(deselecting ? null : card.instanceId);
      if (deselecting) setSelectedLane(null);
      setSquabble(false);
    },
    selectDistrict(lane: number, available: boolean) {
      if (!interactive || !available) return;
      trackEvent('battle_district_selected', {
        round: match.round,
        district: lane + 1,
        changed: selectedLane !== null && selectedLane !== lane,
        decision_time: decisionTime(),
      });
      setSelectedLane(selectedLane === lane ? null : lane);
    },
    toggleSquabble(selectedCard: Match['playerHand'][number] | null) {
      if (match.squabbleUsed || !interactive || !selectedCard) return;
      if (beginSquabbleTransition && !beginSquabbleTransition()) return;
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

export const getRecentBattleActions = (match: Match, authoritativeHistory?: EffectLogEntry[]) =>
  (authoritativeHistory ?? match.effectLog).slice(-6).reverse();

/** Animates a lane score from the previous value to the new one with a quick flash. */
function PowerScore({
  value, side, tone, testId, reducedMotion,
}: {
  value: number;
  side: 'player' | 'cpu';
  tone: 'leading' | 'trailing';
  testId?: string;
  reducedMotion: boolean;
}) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, latest => Math.round(latest).toString());
  const prevRef = useRef(value);
  const [changedKey, setChangedKey] = useState(0);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = to;
    if (from === to) return;
    if (reducedMotion) {
      motionValue.set(to);
      setChangedKey(tick => tick + 1);
      return;
    }
    const controls = animate(motionValue, to, { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] });
    setChangedKey(tick => tick + 1);
    return () => controls.stop();
  }, [value, motionValue, reducedMotion]);
  const colorClass = tone === 'leading'
    ? (side === 'player' ? 'text-primary' : 'text-accent')
    : 'text-white/55';
  return (
    <motion.span
      data-testid={testId}
      key={`${side}-${changedKey}`}
      className={`score-tick score-tick--${side} ${changedKey > 0 ? 'score-tick--changed' : ''} ${colorClass}`}
    >
      <motion.span>{rounded}</motion.span>
    </motion.span>
  );
}

export function Battle({
  match, deck, rivalDeck, tutorialCoach = false,
  selectedInstanceId, setSelectedInstanceId, selectedLane, setSelectedLane,
  commit, onPlayCard, endTurn, skipSequence, presentationPhase, phaseMessage, timerSeconds, timerEnabled, impactLane,
  stagedRival, stagedPlayer, activeEffectId, activeEffectLane, activeEffect,
  squabbleCinematicLane,
  squabble, setSquabble, setInspect, archiveMatch, onShowRules, onExit, presentationScores,
  feedbackPreferences, setFeedbackPreferences, decisionStartedAt, equippedVariants, authoritativeHistory,
  replay, onReplayStep, onExitReplay, onFeedback,
  playedSpecialMoves,
}: any) {
  const squabbleCinematicLaneValue = squabbleCinematicLane as Lane | null | undefined;
  const m = match as Match;
  const districts = getMatchDistricts(m);
  const rivalIntent = getRivalIntent(m);
  const selectedCard = selectedInstanceId ? m.playerHand.find(c => c.instanceId === selectedInstanceId) : null;
  const selectedCost = selectedCard && selectedLane !== null ? getLegalCardCost(m, 'player', selectedCard, selectedLane as Lane) : selectedCard?.cost;
  const selectedCostDetail = selectedCard && selectedLane !== null ? getCardCostExplanation(m, 'player', selectedCard, selectedLane as Lane) : null;
  const districtResults = getDistrictResults(m);
  const playerClaims = districtResults.filter(result => result.winner === 'player').length;
  const cpuClaims = districtResults.filter(result => result.winner === 'cpu').length;
  const phase = presentationPhase as PresentationPhase;
  const reducedMotion = useReducedMotion()
    || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const presentedEffect = activeEffect as PresentationEffect | null;
  const squabbleImpact = !!presentedEffect
    && presentedEffect.type === 'play'
    && presentedEffect.owner === 'player'
    && presentedEffect.note.includes('SQUABBLE');
  const feedback = feedbackPreferences as FeedbackPreferences | undefined;
  const replaying = !!replay;
  const interactive = !replaying && phase === 'player-ready' && m.phase === 'player';
  const canSkip = ['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro', 'round-result'].includes(phase);
  const showCinematic = ['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro', 'match-finish'].includes(phase) && (phase !== 'round-intro' || m.round === 1);
  const blocksFastForward = showCinematic;
  const showStartArt = ['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal'].includes(phase);
  const broadcastArtwork = phase === 'round-intro' && m.round >= 1 && m.round <= 6
    ? `round-${String(m.round).padStart(2, '0')}`
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

  const [crewView, setCrewView] = useState<{ lane: number; owner: 'player' | 'cpu' } | null>(null);
  const [showModifiers, setShowModifiers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStatuses, setShowStatuses] = useState(false);
  const squabbleTransitionRef = React.useRef(false);
  const historyTransitionRef = React.useRef(false);
  React.useEffect(() => { squabbleTransitionRef.current = false; }, [squabble]);
  React.useEffect(() => { historyTransitionRef.current = false; }, [showHistory]);
  const venue = resolveBattleVenue(m);
  const battlefield = getAssetUrl(m.storyEncounter?.battlefieldAssetId ?? venue.assetId);
  const passive = m.storyEncounter?.passive;
  const allVisibleCards = [...m.playerHand, ...m.cpuHand, ...m.boards.flat()];
  const isCovered = (instanceId: string) => m.timedEffects.some(effect => (effect.kind === 'church-protection' || effect.kind === 'salon-protection') && effect.targetInstanceId === instanceId);
  const recentActions = getRecentBattleActions(m, authoritativeHistory);
  const cardName = (instanceId?: string, cardId?: string) =>
    allVisibleCards.find(card => card.instanceId === instanceId)?.name
    ?? cards[cardId ?? '']?.name
    ?? (cardId === 'story' ? 'Encounter' : 'Unknown card');
  const triggeredUpgradeName = (event: any) => {
    if (event.abilityMetadata?.upgradeName) return event.abilityMetadata.upgradeName;
    const identity = event.upgrade ?? event.abilityUpgrade;
    if (typeof identity === 'string') return identity;
    if (identity?.name) return identity.name;
    if (event.upgradeName) return event.upgradeName;
    const source = allVisibleCards.find(card => card.instanceId === (event.source?.cardInstanceId ?? event.cardInstanceId));
    const upgradeId = event.upgradeId ?? event.abilityUpgradeId;
    return getAuthoredCardUpgrades(source as any).find(upgrade => upgrade.id === upgradeId)?.name;
  };
  const participantChange = (participant: any) => {
    const before = participant.before, after = participant.after;
    if (!before && after) return `${cardName(participant.cardInstanceId)} entered district ${(after.lane ?? 0) + 1} at ${after.basePower + after.powerModifier} Hands`;
    if (before && !after) return `${cardName(participant.cardInstanceId)} left play`;
    if (!before || !after) return cardName(participant.cardInstanceId);
    const changes: string[] = [];
    if (before.lane !== after.lane) changes.push(`${before.lane === null ? 'hand' : `district ${before.lane + 1}`} → ${after.lane === null ? 'hand' : `district ${after.lane + 1}`}`);
    const beforePower = before.basePower + before.powerModifier, afterPower = after.basePower + after.powerModifier;
    if (beforePower !== afterPower) changes.push(`Hands ${beforePower} → ${afterPower}`);
    changes.push(...Object.keys(after.statuses).filter(status => before.statuses[status] !== after.statuses[status]).map(status => `${status} ${after.statuses[status] ? 'on' : 'off'}`));
    return `${cardName(participant.cardInstanceId)}${changes.length ? `: ${changes.join(', ')}` : ': unchanged'}`;
  };
  const selectedHasLegalLane = selectedCard
    ? ([0, 1, 2] as Lane[]).some(lane => !lockedLanes.includes(lane) && getLegalCardCost(m, 'player', selectedCard, lane) <= m.playerMotion)
    : false;
  const previouslyInHandRef = React.useRef(new Set(m.playerHand.map(card => card.instanceId)));
  const [drawnIds, setDrawnIds] = useState<Set<string>>(new Set());
  const handIdentity = m.playerHand.map(card => card.instanceId).join('|');
  React.useEffect(() => {
    const hand = handIdentity ? handIdentity.split('|') : [];
    const fresh = hand.filter(id => !previouslyInHandRef.current.has(id));
    previouslyInHandRef.current = new Set(hand);
    setDrawnIds(new Set(fresh));
    if (!fresh.length) return;
    const timer = window.setTimeout(() => setDrawnIds(new Set()), 900);
    return () => window.clearTimeout(timer);
  }, [handIdentity]);
  const isNewlyDrawn = (instanceId: string) => drawnIds.has(instanceId);
  const selectedLaneLocked = selectedLane !== null && lockedLanes.includes(selectedLane as Lane);
  const decisionHandlers = createBattleDecisionHandlers({
    match: m, interactive, selectedInstanceId, selectedLane, squabble,
    lockedDistricts: lockedLanes.length, decisionStartedAt,
    setSelectedInstanceId, setSelectedLane, setSquabble,
    beginSquabbleTransition: () => tryLockInteraction(squabbleTransitionRef),
  });
  const drag = useBattleDrag({
    enabled: interactive && Boolean(onPlayCard), contextKey: `${m.round}:${m.nextEventSequence}:${phase}`,
    hasCard: instanceId => m.playerHand.some(card => card.instanceId === instanceId),
    getChoice: (instanceId, lane) => {
      const card = m.playerHand.find(card => card.instanceId === instanceId);
      const cost = card ? getLegalCardCost(m, 'player', card, lane) : 0;
      const locked = lockedLanes.includes(lane);
      const allowed = Boolean(card) && !locked && cost <= m.playerMotion;
      return { allowed, cost, message: locked ? `${districts[lane].name} is locked.`
        : cost > m.playerMotion ? `${districts[lane].name}: need ${cost - m.playerMotion} more Motion.`
        : `Release to play · ${districts[lane].name} · ${cost} Motion` };
    },
    onStart: instanceId => {
      if (selectedInstanceId !== instanceId) setSquabble(false);
      setSelectedInstanceId(instanceId); setSelectedLane(null); onFeedback?.('select');
    },
    onDrop: (instanceId, lane) => onPlayCard?.(instanceId, lane, selectedInstanceId === instanceId && squabble),
  });
  const timerState = getTurnTimerState(timerSeconds, interactive);
  const timerProgress = getTurnTimerProgress(timerSeconds);
  const decisionPrompt = drag.drag ? drag.drag.choice?.message ?? 'Drag over a district and release to play.' : !interactive
    ? 'Your crew is in action.'
    : !selectedCard && selectedLane === null
      ? 'Drag to play, tap to select, or hold a card for details. Swipe sideways to browse.'
      : !selectedCard
        ? `2. ${districts[selectedLane!].name} selected. Choose a card you can afford there.`
      : !selectedHasLegalLane
        ? `${selectedCard.name} cannot be played now. Choose another card or end your turn.`
      : selectedLane === null
        ? `Choose a lit district for ${selectedCard.name}, then Play card.`
        : selectedLaneLocked
          ? `${districts[selectedLane].name} is locked this round. Choose another district.`
        : (selectedCost ?? 0) > m.playerMotion
          ? `${selectedCard.name} costs ${selectedCost} Motion (${selectedCostDetail}) in ${districts[selectedLane].name}. You have ${m.playerMotion} — ${selectedCost! - m.playerMotion} short.`
          : `${selectedCard.name} → ${districts[selectedLane].name} · ${selectedCost} Motion · Preview includes location effects. You can keep playing afterward.`;

  const getActionState = () => {
    if (drag.drag) return { label: drag.drag.choice?.allowed ? 'Release to play' : 'Choose a valid lane', disabled: true, type: 'secondary', testId: 'button-dragging' };
    if (!interactive) return { label: canSkip ? 'Continue' : 'Resolving...', disabled: !canSkip, onClick: canSkip ? skipSequence : undefined, type: canSkip ? 'secondary' : 'disabled', testId: 'button-resolving' };
    if (m.phase === 'complete') return { label: 'Archive Match', disabled: false, onClick: archiveMatch, type: 'primary', testId: 'button-archive-match' };
    if (selectedCard) {
      if (selectedLane === null) return { label: 'Pick District', disabled: true, type: 'disabled', testId: 'button-pick-district' };
      if (selectedLaneLocked) return { label: 'District Locked', disabled: true, type: 'error', testId: 'button-lock' };
      if ((selectedCost ?? 0) > m.playerMotion) return { label: `Need ${selectedCost} Motion · ${selectedCost! - m.playerMotion} Short`, disabled: true, type: 'error', testId: 'button-lock' };
      return { label: `Play card · ${selectedCost} Motion${squabble ? ' · ×2' : ''}`, disabled: false, onClick: commit, type: 'primary', testId: 'button-lock' };
    }
    return { label: 'End Turn', disabled: false, onClick: endTurn ?? commit, type: 'secondary', testId: 'button-next-round' };
  };
  const action = getActionState();
  const previews = React.useMemo(() => selectedCard && interactive
    ? ([0, 1, 2] as Lane[]).map(lane => previewBattlePlay(m, selectedCard.instanceId, lane, squabble)) : [],
    [m, selectedCard, interactive, squabble]);
  const previewTargets = selectedLane === null ? [] : previews[selectedLane]?.targets ?? [];
  const effectLanded = presentedEffect?.impact ?? (phase === 'player-impact' || phase === 'rival-impact' || (phase === 'effects' && presentationScores === presentedEffect?.scores.after));
  const actor = presentedEffect ? allVisibleCards.find(card => card.instanceId === (presentedEffect.source?.cardInstanceId ?? presentedEffect.cardInstanceId)) ?? cards[presentedEffect.cardId] : null;
  const effectProps = (card: any) => ({
    inspectionLayout: reducedMotion ? undefined : 'battle-inspect-' + card.instanceId,
    className: `${previewTargets.includes(card.instanceId) ? 'preview-target' : ''} ${activeEffectId === card.instanceId && (phase === 'rival-reveal' || phase === 'player-reveal') && presentedEffect?.type === 'play' ? (card.cost >= 4 ? 'card-reveal-flip major-reveal' : 'card-reveal-flip') : ''} ${presentedEffect && (activeEffectId === card.instanceId || presentedEffect.targetIds.includes(card.instanceId)) ? (effectLanded ? 'beat-impact' : 'beat-windup') : ''}`,
    highlighted: activeEffectId === card.instanceId,
    effectRole: activeEffectId === card.instanceId
      ? ('source' as const)
      : presentedEffect?.targetIds.includes(card.instanceId)
        ? ('target' as const)
        : undefined,
    effectKind: presentedEffect && (activeEffectId === card.instanceId || presentedEffect.targetIds.includes(card.instanceId)) ? presentedEffect.kind : undefined,
  });

  return <div {...drag.rootProps} data-testid="battle-arena" data-presentation-phase={phase} data-engine-phase={m.phase} data-impact-strength={effectLanded && presentedEffect ? eventIntensity(presentedEffect) : 'none'} data-reduced-motion={reducedMotion ? 'true' : 'false'} data-venue={venue.id} data-venue-tone={venue.tone} className={`battle-arena battle-hud phase-${phase} ${squabble ? 'is-squabble-armed' : ''} flex flex-col h-full w-full max-w-full mx-auto overflow-hidden relative z-10 bg-[#0d0d0d]`} aria-label={`Battle phase: ${phaseMessage}`}>
    <BattleDragOverlay controller={drag} card={m.playerHand.find(card => card.instanceId === drag.drag?.instanceId)} variantId={getEquippedVariant(equippedVariants, m.playerHand.find(card => card.instanceId === drag.drag?.instanceId)?.id ?? '')} squabble={squabble} />
    <BattleArtPreload />
    <div className="battle-venue absolute inset-0 z-0 pointer-events-none perspective-1000 overflow-hidden">
      <div className="battle-venue__art absolute inset-0" style={{ backgroundImage: `url("${battlefield}")`, backgroundPosition: venue.position }} />
      <LocationWallpaper ids={districts.map(d => d.id)} />
      <div className="battle-venue__contrast absolute inset-0" />
      <div className="battle-venue__atmosphere" aria-hidden="true" />
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

    <AnimatePresence>{!interactive && showCinematic && (canSkip ? <motion.button type="button" onClick={skipSequence} aria-label={`Continue past ${phaseMessage}`} initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="broadcast-overlay absolute inset-0 z-40 grid place-items-center bg-black/20">{showStartArt ? <BattleStartArt phase={phase} player={deck} rival={rivalDeck} /> : broadcastArtwork ? <img data-testid={`broadcast-${broadcastArtwork}`} src={getAssetUrl(phase === 'round-intro' ? `assets/fight-night/${broadcastArtwork}.webp` : `assets/broadcast/${broadcastArtwork}.webp`)} alt="" aria-hidden="true" /> : <span className={`cinematic-callout ${phase === 'squabble' ? 'text-accent' : 'text-white'}`}>{phaseMessage}</span>}</motion.button> : <motion.div role="status" aria-label={phaseMessage} initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="broadcast-overlay absolute inset-0 z-40 grid place-items-center bg-black/20 pointer-events-none">{broadcastArtwork ? <img data-testid={`broadcast-${broadcastArtwork}`} src={getAssetUrl(phase === 'round-intro' ? `assets/fight-night/${broadcastArtwork}.webp` : `assets/broadcast/${broadcastArtwork}.webp`)} alt="" aria-hidden="true" /> : <span className="cinematic-callout text-white">{phaseMessage}</span>}</motion.div>)}</AnimatePresence>
    {presentedEffect?.chain && presentedEffect.chain.total > 1 && actor && <div className="ability-chain-banner" data-testid="ability-chain" key={presentedEffect.chain.id}><span>CHAIN {presentedEffect.chain.index} / {presentedEffect.chain.total}</span><strong>{actor.name} · {presentedEffect.abilityMetadata?.upgradeName ?? actor.ability}</strong><div>{Array.from({ length: presentedEffect.chain.total }, (_, index) => <i key={index} className={index < presentedEffect.chain!.index ? 'is-fired' : ''} />)}</div></div>}
    {presentedEffect && actor && !['player-travel', 'rival-travel'].includes(phase) && ['play', 'ability', 'expiration'].includes(presentedEffect.type) && presentedEffect.kind !== 'story' && <BattleAttack key={presentedEffect.sequence} card={actor} effect={presentedEffect} impact={effectLanded} replaying={replaying} audioEnabled={feedback?.audioEnabled ?? false} playedSpecialMoves={playedSpecialMoves} />}
    {crewView && <BattleCrew name={districts[crewView.lane].name} crew={m.boards[crewView.lane].filter(card => card.owner === crewView.owner)} onClose={() => setCrewView(null)} onInspect={setInspect} />}
    <div className="battle-header relative z-30 shrink-0">
      <div className="battle-rival" title={rivalIntent.tell}><RivalTell hero={rivalDeck.hero} tell={rivalIntent.tell} thinking={phase === 'rival-thinking'} /><div className="battle-rival-mark" aria-hidden="true">VS</div><div className="battle-rival-copy"><div className="text-[9px] font-mono tracking-widest text-accent uppercase truncate">Rival // {rivalIntent.style}</div><div className="font-display font-black text-sm md:text-2xl uppercase leading-none truncate">{rivalDeck.name}</div><div data-testid="rival-intent" className="hidden xl:block max-w-64 truncate text-[8px] text-white/55">{rivalIntent.tell}</div></div></div>
      <div className="battle-round" aria-label={`Round ${m.round} of 6`}><span>Round <b>{String(m.round).padStart(2, '0')}</b><small> / 06</small></span><div className="battle-round__steps" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <i key={index} className={index + 1 < m.round ? 'is-complete' : index + 1 === m.round ? 'is-current' : ''} />)}</div></div>
      <div className="battle-match-meta"><details className="battle-tools" onToggle={event => { if (!event.currentTarget.open) { setShowHistory(false); setShowStatuses(false); setShowModifiers(false); } }} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary aria-label="Battle menu" title="Battle menu"><MoreHorizontal size={22} aria-hidden="true" /></summary><div className="battle-tools__panel">
        {passive && (
          <div className="hidden lg:block border border-purple-500/50 bg-purple-500/10 px-2 py-1 text-right max-w-xs">
            <div className="text-[8px] font-mono text-purple-400 uppercase tracking-widest">Passive: {passive.name}</div>
            <div className="text-[9px] text-purple-200/70 truncate">{passive.description}</div>
          </div>
        )}
        {modifierSummaries.length > 0 && <div className="relative"><button type="button" onClick={() => setShowModifiers(v => !v)} aria-expanded={showModifiers} className="battle-utility">Mods</button>{showModifiers && <div className="battle-popover"><div className="mb-2 flex justify-between font-mono text-[8px] uppercase text-accent"><span>Active rules</span><button type="button" onClick={() => setShowModifiers(false)}>Close</button></div><ul className="space-y-2">{modifierSummaries.map((mod: string) => <li key={mod} className="border-l border-accent/50 pl-2 text-[9px] text-rose-100">{mod}</li>)}</ul></div>}</div>}
        <div className="relative"><button type="button" data-testid="button-battle-history" aria-label="Recent action history" onClick={() => { if (!tryLockInteraction(historyTransitionRef)) return; if (!showHistory) decisionHandlers.openHistory(recentActions.length); setShowHistory(v => !v); }} aria-expanded={showHistory} className="battle-utility"><History size={16} aria-hidden="true" /><span>History</span></button>{showHistory && <div data-testid="battle-history" className="battle-popover w-72"><div className="hud-popover-heading"><span>Recent action</span><button type="button" aria-label="Close history" onClick={() => setShowHistory(false)}><X size={16} aria-hidden="true" /></button></div>{recentActions.length ? <ol className="space-y-2">{recentActions.map(event => { const upgradeName = triggeredUpgradeName(event); return <li key={event.sequence} className="border-l-2 border-white/20 pl-2"><div className="text-[8px] font-mono uppercase text-white/40">Round {event.round} · {event.owner === 'player' ? 'You' : 'Rival'} · {event.type}</div>{upgradeName && <div data-testid={`history-upgrade-${event.sequence}`} className="mt-0.5 font-mono text-[8px] uppercase text-primary">Upgrade triggered · {upgradeName}</div>}<div className="text-[11px] leading-snug text-white/80"><b className="text-white">{cardName(event.source?.cardInstanceId ?? event.cardInstanceId, event.cardId)}</b> — {event.note}</div><button type="button" disabled={phase !== 'player-ready'} onClick={() => { onReplayStep(event, 'before'); setShowHistory(false); }} className="mt-1 font-mono text-[8px] uppercase text-primary disabled:text-white/20">Replay step by step</button></li>; })}</ol> : <p className="text-xs text-white/45">No actions yet.</p>}</div>}</div>
        <div className="relative"><button type="button" data-testid="button-status-key" aria-label="Persistent status explanations" onClick={() => setShowStatuses(v => !v)} aria-expanded={showStatuses} className="battle-utility"><Shield size={16} aria-hidden="true" /><span>Status effects</span></button>{showStatuses && <div data-testid="battle-status-key" className="battle-popover w-64"><div className="hud-popover-heading"><span>Status effects</span><button type="button" aria-label="Close status effects" onClick={() => setShowStatuses(false)}><X size={16} aria-hidden="true" /></button></div><p className="mb-2 text-[11px] text-orange-200">Damage that reduces raw Hands to 0 destroys the card. Freezing alone does not destroy it.</p><dl className="space-y-2 text-[11px]"><div><dt className="font-bold text-blue-300">Frozen</dt><dd className="text-white/60">Adds 0 Hands until cleansed.</dd></div><div><dt className="font-bold text-zinc-300">Silenced</dt><dd className="text-white/60">Keeps Hands; ability cannot fire.</dd></div><div><dt className="font-bold text-yellow-300">Protected</dt><dd className="text-white/60">Wifey blocks one targeted effect in her district this round.</dd></div><div><dt className="font-bold text-amber-200">Covered</dt><dd className="text-white/60">Church Auntie or Nail Salon blocks this card’s next targeted hostile ability, even in a later round.</dd></div><div><dt className="font-bold text-rose-300">Blocked</dt><dd className="text-white/60">Wifey’s round guard has been spent.</dd></div><div><dt className="font-bold text-purple-300">Moved</dt><dd className="text-white/60">An ability changed this card’s district.</dd></div></dl></div>}</div>
        {activePhase && <div className="hidden sm:block border border-accent/50 bg-accent/10 px-2 py-1 text-right"><div className="text-[8px] font-mono text-accent uppercase tracking-widest">Boss Phase</div><div className="font-display font-black text-sm text-rose-200 uppercase">{activePhase.name}</div></div>}
        <button data-testid="button-rules-battle" aria-label="Battle rules" onClick={onShowRules} className="battle-utility"><CircleHelp size={16} aria-hidden="true" /><span>Rules</span></button>
        {onExit && <button type="button" onClick={onExit} className="battle-utility" aria-label="Leave battle">Leave battle</button>}
        {interactive && endTurn && <button type="button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); endTurn(); }} className="battle-utility">End Turn</button>}
        <MusicControls className="battle-utility" />
        {feedback && <button type="button" data-testid="button-audio-toggle" aria-pressed={!feedback.audioEnabled} aria-label={feedback.audioEnabled ? 'Mute battle audio' : 'Unmute battle audio'} onClick={() => setFeedbackPreferences((value: FeedbackPreferences) => ({ ...value, audioEnabled: !value.audioEnabled }))} className="battle-utility"><span aria-hidden="true">{feedback.audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</span><span>{feedback.audioEnabled ? 'Sound on' : 'Sound off'}</span></button>}
        {feedback && typeof navigator !== 'undefined' && 'vibrate' in navigator && <button type="button" data-testid="button-haptics-toggle" aria-pressed={!feedback.hapticsEnabled} aria-label={feedback.hapticsEnabled ? 'Disable battle haptics' : 'Enable battle haptics'} onClick={() => setFeedbackPreferences((value: FeedbackPreferences) => ({ ...value, hapticsEnabled: !value.hapticsEnabled }))} className="battle-utility"><span className="utility-long">{feedback.hapticsEnabled ? 'Haptics' : 'No buzz'}</span><span className="utility-short">≈</span></button>}
        </div></details><div className="battle-rival-energy" aria-label={`Rival Motion: ${m.cpuMotion}`} title="Rival Motion"><GameGlyph name="motion" /><MotionEnergy value={m.cpuMotion} testId="motion-rival" replaying={replaying} /><span className="sr-only">Rival Motion</span></div>
        {timerEnabled && <div data-testid="turn-timer" data-timer-state={timerState} aria-label={interactive ? `${timerSeconds} seconds remaining, ${timerState}` : 'Decision timer paused'} aria-live="off" style={{ '--timer-progress': timerProgress } as React.CSSProperties} className={`turn-timer state-${timerState}`}><div className="turn-timer-copy"><span className="sr-only">Time</span><strong>{interactive ? timerSeconds : '—'}</strong></div><div role="progressbar" aria-label="Turn time remaining" aria-valuemin={0} aria-valuemax={20} aria-valuenow={interactive ? timerSeconds : undefined} aria-valuetext={interactive ? `${timerSeconds} seconds remaining` : 'Paused'} className="turn-timer-track"><span style={{ transform: `scaleX(${timerProgress})` }} /></div>{interactive && (timerSeconds === 10 || timerSeconds === 5) && <span role="status" aria-live={timerSeconds === 5 ? 'assertive' : 'polite'} className="sr-only">{timerSeconds === 5 ? 'Five seconds remaining. Lock in now or your turn will be automatic.' : 'Ten seconds remaining.'}</span>}</div>}
      </div>
    </div>
    <div className={`battle-guidance relative z-30 shrink-0 w-full ${tutorialCoach ? 'battle-guidance--coached' : ''}`}>
      {tutorialCoach && <div className="dr-fade-coach-frame"><DrFadePortrait className="dr-fade-coach" /></div>}
      <div className="min-w-0">
        <div className="battle-guidance-kicker">{tutorialCoach && <span className="dr-fade-coach__name">DR. FADE · </span>}{replaying ? `Replay · ${replay.step === 'before' ? 'Before' : 'After'}` : interactive ? 'Your decision' : presentedEffect ? `${presentedEffect.owner === 'player' ? 'Your' : 'Rival'} ${presentedEffect.type}` : 'Match flow'}</div>
        <div data-testid="battle-guidance" className="battle-guidance-message">{presentedEffect && <span className={`effect-kind-chip kind-${presentedEffect.kind}`}>{presentedEffect.kind}{presentedEffect.durationLabel ? ` · ${presentedEffect.durationLabel}` : ''}</span>} {phase === 'round-result' || (phase === 'round-intro' && m.round > 1) ? <BattleRound match={m} phase={phase} /> : interactive ? decisionPrompt : phaseMessage}</div>
        {presentedEffect && <div data-testid="effect-causality" className={replaying ? "battle-causality" : "sr-only"}>{triggeredUpgradeName(presentedEffect) && <span data-testid="effect-upgrade-trigger" className="mr-1 font-mono text-[9px] uppercase text-primary">Upgrade · {triggeredUpgradeName(presentedEffect)} · </span>}<b>{cardName(presentedEffect.source?.cardInstanceId ?? presentedEffect.cardInstanceId, presentedEffect.cardId)}</b>{presentedEffect.targetIds.length > 0 ? ` affected ${presentedEffect.targetIds.map(id => cardName(id)).join(', ')}` : ` affected district ${presentedEffect.lane + 1}`}. Score: Rival {presentedEffect.scores.before[presentedEffect.lane]?.cpu ?? 0} / You {presentedEffect.scores.before[presentedEffect.lane]?.player ?? 0} → Rival {presentedEffect.scores.after[presentedEffect.lane]?.cpu ?? 0} / You {presentedEffect.scores.after[presentedEffect.lane]?.player ?? 0}.</div>}
        {replaying && <div data-testid="replay-controls" className="mt-2 flex flex-wrap items-center gap-2"><button type="button" disabled={replay.step === 'before'} onClick={() => onReplayStep(replay.event, 'before')} className="battle-utility">Before</button><button type="button" disabled={replay.step === 'after'} onClick={() => onReplayStep(replay.event, 'after')} className="battle-utility">After</button><button type="button" onClick={onExitReplay} className="battle-fast-forward">Return to live battle</button><span className="w-full text-[10px] text-white/60">{[replay.event.source, ...replay.event.targets].filter(Boolean).map(participantChange).join(' · ')}</span></div>}
      </div>
      <span data-testid="claims-live" className="battle-claims" aria-label={`District claims: you ${playerClaims}, rival ${cpuClaims}. Win two districts.`} title="Win two districts"><Flag size={13} aria-hidden="true" /><b className="claims-player">{playerClaims}</b><span className="claims-divider">/</span><b className="claims-rival">{cpuClaims}</b><span className="sr-only"> district claims</span></span>
      {!replaying && !interactive && !blocksFastForward && <button type="button" data-testid="button-fast-forward" onClick={skipSequence} className="battle-fast-forward" aria-label="Fast forward" title="Fast forward"><ChevronsRight size={18} aria-hidden="true" /><span>Skip</span></button>}
    </div>
    <div className="battlefield-grid flex-1 min-h-0 relative z-20">{districts.map((d: any, i: number) => {
      const cpuCards = m.boards[i].filter(c => c.owner === 'cpu'); const playerCards = m.boards[i].filter(c => c.owner === 'player');
      const snapshot = presentationScores?.find((score: { lane: number }) => score.lane === i);
      const pScore = snapshot?.player ?? getLaneScoreForMatch(m, playerCards, i as Lane, 'player'); const cScore = snapshot?.cpu ?? getLaneScoreForMatch(m, cpuCards, i as Lane, 'cpu');
      const lockedLane = lockedLanes.includes(i as Lane); const laneCost = selectedCard ? getLegalCardCost(m, 'player', selectedCard, i as Lane) : null; const affordable = laneCost !== null && laneCost <= m.playerMotion; const legal = !!selectedCard && !lockedLane && affordable; const available = interactive && !lockedLane && (!selectedCard || legal); const selected = selectedLane === i; const winner = pScore === cScore ? 'draw' : pScore > cScore ? 'player' : 'cpu';
      const stagedRivalHere = impactLane === i && stagedRival && phase === 'rival-travel'; const stagedPlayerHere = impactLane === i && stagedPlayer && phase === 'player-travel';
      const impactPhase = phase === 'player-impact' || phase === 'rival-impact' || phase === 'effects';
      return <div key={i} data-testid={`lane-container-${i}`} data-location={d.id} data-drop-lane={i} data-drop-state={drag.laneState(i as Lane)} style={{ '--district-accent': d.accent } as React.CSSProperties} data-control={winner} data-contested={pScore > 0 && cScore > 0 && Math.abs(pScore-cScore) <= 3} data-rival-interest={interactive && rivalIntent.likelyLane === i} data-settled={phase === 'round-result'} data-squabble-impact={impactPhase && squabbleImpact && impactLane === i ? 'true' : 'false'} className={`district-lane district-lane-${i} min-w-0 relative group ${impactPhase && impactLane === i ? 'district-impact' : ''} ${impactPhase && squabbleImpact && impactLane === i ? 'district-squabble-impact' : ''} ${squabbleCinematicLaneValue === i ? 'district-cinematic' : ''} ${phase === 'round-result' || phase === 'match-finish' ? `district-verdict verdict-${winner}` : ''} ${selected ? 'is-selected' : ''} ${selectedCard && interactive ? legal ? 'is-legal' : 'is-illegal' : ''} ${activeEffectLane === i ? 'is-effect-lane' : ''} ${lockedLane ? 'is-locked' : ''}`}>
        <DistrictEffects winner={winner} locked={lockedLane} replaying={replaying} />
        {squabbleCinematicLaneValue === i && <div className={`victory-ring-overlay victory-ring-overlay--${presentedEffect?.owner === 'cpu' ? 'rival' : 'player'}`} aria-hidden="true" data-testid={`victory-ring-${i}`}><span className="squabble-confetti" /><span className="squabble-confetti" /><span className="squabble-confetti" /><span className="squabble-confetti" /><span className="squabble-confetti" /><span className="squabble-confetti" /></div>}
        <div data-testid={`lane-${i}-cpu-zone`} className="battle-side battle-side-rival"><span className="side-mark side-mark-rival">Rival</span>{cpuCards.length >= 3 && <button className="formation-expand" onClick={() => setCrewView({ lane: i, owner: 'cpu' })} aria-label={`Inspect rival crew in ${d.name}`}><Swords size={12} aria-hidden="true" /><span>{cpuCards.length}</span></button>}<div className="battle-card-stack" data-crowded={cpuCards.length > 6} data-count={cpuCards.length + (stagedRivalHere ? 1 : 0)} style={{ '--desktop-rows': Math.max(1, Math.ceil((cpuCards.length + (stagedRivalHere ? 1 : 0)) / 3)), '--mobile-rows': Math.max(1, Math.ceil((cpuCards.length + (stagedRivalHere ? 1 : 0)) / 2)) } as React.CSSProperties}><AnimatePresence>{stagedRivalHere && <motion.div key={`back-${stagedRival.instanceId}`} layoutId={stagedRival.instanceId} data-instance-id={stagedRival.instanceId} data-presentation-copy="staged" initial={{ y: -90, rotate: 12, scale: .7, opacity: 0, filter: 'brightness(1) drop-shadow(0 0 0 transparent)' }} animate={{ y: [ -90, -118, 0 ], rotate: [ 12, 2, -4 ], scale: [ .7, 1.08, 1 ], opacity: [ 0, 1, 1 ], filter: [ 'brightness(1) drop-shadow(0 0 0 transparent)', 'brightness(1.4) drop-shadow(0 8px 24px var(--color-accent))', 'brightness(1) drop-shadow(0 0 0 transparent)' ] }} transition={{ duration: reducedMotion ? 0.05 : 0.48, times: [0, 0.35, 1], ease: [0.2, 0.8, 0.2, 1] }} className="card-back battle-board-card"><span>S</span></motion.div>}{cpuCards.map((c, j) => <CardView key={c.instanceId} card={c} onInspect={() => setInspect(c)} covered={isCovered(c.instanceId)} isBoard isEnemy disableLayout testId={`card-board-rival-${i}-${c.cardId}-${j}`} onClick={(e) => { e.stopPropagation(); setInspect(c); }} effectivePower={getEffectiveCardPower(c)} scoreStance={pScore > cScore ? 'leading' : cScore > pScore ? 'trailing' : 'tied'} entryBurst={activeEffectId === c.instanceId && (phase === 'rival-impact' || phase === 'rival-reveal')} {...effectProps(c)} />)}</AnimatePresence></div></div>
        <button type="button" data-testid={`lane-${i}`} onClick={() => { decisionHandlers.selectDistrict(i, available); if (available) onFeedback?.('select'); }} aria-pressed={selected} aria-disabled={!available} tabIndex={interactive ? 0 : -1} aria-label={selectedCard ? `${legal ? 'Deploy' : lockedLane ? 'Cannot deploy, district locked' : `Cannot deploy, need ${laneCost} Motion`} ${selectedCard.name} to ${d.name}` : `${selected ? 'Selected' : lockedLane ? 'Cannot select, locked' : 'Select'} ${d.name} district first`} title={lockedLane ? 'This district is locked this round.' : selectedCard && !affordable ? `Need ${laneCost} Motion; you have ${m.playerMotion} (${laneCost! - m.playerMotion} short).` : d.rule} className="district-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><LocationNode id={d.id} index={i} /><div className="district-marker"><div className="district-score-row"><span className="district-score-label district-score-label--rival">Rival</span><PowerScore value={cScore} side="cpu" tone={cScore > pScore ? 'leading' : 'trailing'} testId={`score-cpu-${i}`} reducedMotion={reducedMotion} /><span className="score-divider" aria-hidden="true"><Swords size={13} /></span><PowerScore value={pScore} side="player" tone={pScore > cScore ? 'leading' : 'trailing'} testId={`score-player-${i}`} reducedMotion={reducedMotion} /><span className="district-score-label district-score-label--player">You</span></div><div className="district-kicker"><span className="district-control-dot" aria-hidden="true" />{pScore > cScore ? 'You lead' : cScore > pScore ? 'Rival leads' : 'Unclaimed'}</div><h3><span className="district-number" aria-hidden="true">0{i + 1}</span>{d.name}</h3><p className="district-rule">{d.rule}</p>{d.status && <span className="district-rule-status" data-testid={`district-status-${i}`}>{d.status}</span>}{previews[i] && <span className="district-preview" data-testid={`preview-lane-${i}`}><span>After play <b className="preview-rival">{previews[i]!.after[i].cpu}</b><span aria-hidden="true"> / </span><b className="preview-player">{previews[i]!.after[i].player}</b></span><small className="sr-only">Projected rival and player scores on the known board, before rival response. Costs {previews[i]!.cost} Motion.</small></span>}{lockedLane ? <span className="district-prompt is-blocked"><LockKeyhole size={12} aria-hidden="true" />Locked</span> : interactive && (selectedCard || selected) && <span className={`district-prompt ${selected && legal ? 'is-ready' : selected ? 'is-selected' : selectedCard && !affordable ? 'is-blocked' : ''}`}>{selected && legal && <Check size={12} aria-hidden="true" />}{selected && legal ? `Ready · ${laneCost} Motion` : selected ? 'District selected' : selectedCard ? affordable ? `Play · ${laneCost} Motion` : `Need ${laneCost} · ${laneCost! - m.playerMotion} short` : 'Tap to select first'}</span>}</div></button>
        <div data-testid={`lane-${i}-player-zone`} className="battle-side battle-side-player"><span className="side-mark side-mark-player">You</span>{playerCards.length >= 3 && <button className="formation-expand" onClick={() => setCrewView({ lane: i, owner: 'player' })} aria-label={`Inspect your crew in ${d.name}`}><Swords size={12} aria-hidden="true" /><span>{playerCards.length}</span></button>}<div className="battle-card-stack" data-crowded={playerCards.length > 6} data-count={playerCards.length + (stagedPlayerHere ? 1 : 0)} style={{ '--desktop-rows': Math.max(1, Math.ceil((playerCards.length + (stagedPlayerHere ? 1 : 0)) / 3)), '--mobile-rows': Math.max(1, Math.ceil((playerCards.length + (stagedPlayerHere ? 1 : 0)) / 2)) } as React.CSSProperties}><AnimatePresence>{stagedPlayerHere && <motion.div key={`player-back-${stagedPlayer.instanceId}`} data-instance-id={stagedPlayer.instanceId} data-presentation-copy="staged" initial={{ y: 90, rotate: -10, scale: .72, opacity: 0, filter: 'brightness(1) drop-shadow(0 0 0 transparent)' }} animate={{ y: [ 90, 62, 0 ], rotate: [ -10, -2, 3 ], scale: [ .72, 1.08, 1 ], opacity: [ 0, 1, 1 ], filter: [ 'brightness(1) drop-shadow(0 0 0 transparent)', 'brightness(1.4) drop-shadow(0 8px 24px var(--color-primary))', 'brightness(1) drop-shadow(0 0 0 transparent)' ] }} transition={{ duration: reducedMotion ? 0.05 : 0.48, times: [0, 0.35, 1], ease: [0.2, 0.8, 0.2, 1] }} className="card-back battle-board-card"><span>S</span></motion.div>}{playerCards.map((c, j) => <CardView key={c.instanceId} card={c} onInspect={() => setInspect(c)} covered={isCovered(c.instanceId)} variantId={getEquippedVariant(equippedVariants, c.id)} isBoard disableLayout squabble={impactPhase && squabbleImpact && activeEffectId === c.instanceId} testId={`card-board-player-${i}-${c.cardId}-${j}`} onClick={(e) => { e.stopPropagation(); setInspect(c); }} effectivePower={getEffectiveCardPower(c)} scoreStance={pScore > cScore ? 'leading' : cScore > pScore ? 'trailing' : 'tied'} entryBurst={activeEffectId === c.instanceId && (phase === 'player-impact' || phase === 'player-reveal')} {...effectProps(c)} />)}</AnimatePresence></div></div>
      </div>;
    })}</div>
    <div data-testid="battle-command-deck" className="battle-command-deck shrink-0 relative z-40">{timerEnabled && <div data-testid="decision-clock" data-state={timerState} className="decision-clock"><div><span>{interactive ? timerSeconds <= 5 ? 'LOCK IN NOW' : 'YOUR TURN' : 'TIMER PAUSED'}</span><strong>{interactive ? `${timerSeconds}s` : '—'}</strong><small>{interactive ? timerSeconds <= 5 ? 'Auto-play at zero' : 'Choose a card and district' : 'Resolving battle'}</small></div><div className="decision-clock-track" aria-hidden="true"><i style={{ transform: `scaleX(${interactive ? timerProgress : 0})` }} /></div></div>}<div id="hand-tray" data-testid="hand-tray" data-drag-hand className="battle-hand-tray"><div className="battle-hand-row"><AnimatePresence>{m.playerHand.filter(c => c.instanceId !== stagedPlayer?.instanceId).map(c => { const cardCost = selectedLane !== null ? getLegalCardCost(m, 'player', c, selectedLane as Lane) : c.cost; const unlockedLanes = ([0, 1, 2] as Lane[]).filter(lane => !lockedLanes.includes(lane)); const playableSomewhere = unlockedLanes.some(lane => getLegalCardCost(m, 'player', c, lane) <= m.playerMotion); const playableForChoice = selectedLane === null ? playableSomewhere : !lockedLanes.includes(selectedLane as Lane) && cardCost <= m.playerMotion; const cheapestCost = unlockedLanes.length ? Math.min(...unlockedLanes.map(lane => getLegalCardCost(m, 'player', c, lane))) : c.cost; const neededCost = selectedLane !== null ? cardCost : cheapestCost; const reason = lockedLanes.length === districts.length ? 'Cannot play: every district is locked this round.' : !playableForChoice ? `Cannot play: costs ${neededCost} Motion${selectedLane !== null ? ` in ${districts[selectedLane].name}` : ''}; you have ${m.playerMotion} (${Math.max(0, neededCost - m.playerMotion)} short).` : undefined; return <CardView key={c.instanceId} card={c} onInspect={() => setInspect(c)} dragEnabled={interactive && Boolean(onPlayCard)} variantId={getEquippedVariant(equippedVariants, c.id)} queued={selectedInstanceId === c.instanceId} squabble={squabble && selectedInstanceId === c.instanceId} cost={cardCost} unavailable={interactive && !playableForChoice} disabledReason={reason} onClick={(e) => { e.stopPropagation(); decisionHandlers.selectCard(c, playableForChoice); if (interactive && playableForChoice) onFeedback?.('select'); }} className="origin-bottom" portraitPop={isNewlyDrawn(c.instanceId)} />; })}</AnimatePresence></div></div>
      {!drag.drag && selectedCard && selectedLane !== null && interactive && <div className={`target-trajectory target-lane-${selectedLane}`} aria-hidden="true"><span /></div>}
      <div className="battle-actions"><div className="battle-motion" aria-label={`Your Motion: ${m.playerMotion}`}><GameGlyph name="motion" className="battle-motion__icon" /><MotionEnergy value={m.playerMotion} testId="motion-player" replaying={replaying} /><div>Your Motion</div></div><button data-testid="button-squabble" aria-pressed={squabble} aria-label={m.squabbleUsed ? 'Squabble spent' : squabble ? 'Disarm Squabble' : 'Arm Squabble'} title={m.squabbleUsed ? 'SQUABBLE has already been used.' : !selectedCard ? 'Choose a card first.' : 'Double this card’s base Hands once per match.'} className={`battle-squabble ${squabble ? 'is-armed' : ''}`} onClick={() => decisionHandlers.toggleSquabble(selectedCard ?? null)} disabled={m.squabbleUsed || !interactive || !selectedCard}><span className="battle-squabble__sigil" aria-hidden="true"><GameGlyph name="fight" /><b>×2</b></span><span className="battle-squabble__label">{m.squabbleUsed ? 'Spent' : squabble ? 'Armed' : 'Squabble'}</span></button><button data-testid={action.testId} onClick={action.onClick} disabled={action.disabled} className={`battle-primary-action action-${action.type}`}><span>{action.label}</span>{action.type === 'primary' && <ArrowRight size={18} aria-hidden="true" />}</button></div>
    </div>
  </div>;
}
/*
export function Battle({
  match, deck, rivalDeck,
  selectedInstanceId, setSelectedInstanceId, selectedLane, setSelectedLane,
  commit, skipSequence, presentationPhase, phaseMessage, timerSeconds, timerEnabled, impactLane,
  stagedRival, stagedPlayer, activeEffectId, activeEffectLane, activeEffect,
  squabble, setSquabble, setInspect, archiveMatch, onShowRules, presentationScores,
  feedbackPreferences, setFeedbackPreferences, decisionStartedAt, equippedVariants, authoritativeHistory,
  replay, onReplayStep, onExitReplay,
}: any) {
  const m = match as Match;
  const rivalIntent = getRivalIntent(m);
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
  const replaying = !!replay;
  const interactive = !replaying && phase === 'player-ready' && m.phase === 'player';
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
  const venue = resolveBattleVenue(m);
  const battlefield = getAssetUrl(m.storyEncounter?.battlefieldAssetId ?? venue.assetId);
  const passive = m.storyEncounter?.passive;
  const allVisibleCards = [...m.playerHand, ...m.cpuHand, ...m.boards.flat()];
  const recentActions = (authoritativeHistory ?? m.effectLog).slice(-6).reverse();
  const cardName = (instanceId?: string, cardId?: string) =>
    allVisibleCards.find(card => card.instanceId === instanceId)?.name
    ?? cards[cardId ?? '']?.name
    ?? (cardId === 'story' ? 'Encounter' : 'Unknown card');
  const participantChange = (participant: any) => {
    const before = participant.before, after = participant.after;
    if (!before && after) return `${cardName(participant.cardInstanceId)} entered district ${(after.lane ?? 0) + 1} at ${after.basePower + after.powerModifier} Hands`;
    if (before && !after) return `${cardName(participant.cardInstanceId)} left play`;
    if (!before || !after) return cardName(participant.cardInstanceId);
    const changes: string[] = [];
    if (before.lane !== after.lane) changes.push(`${before.lane === null ? 'hand' : `district ${before.lane + 1}`} → ${after.lane === null ? 'hand' : `district ${after.lane + 1}`}`);
    const beforePower = before.basePower + before.powerModifier, afterPower = after.basePower + after.powerModifier;
    if (beforePower !== afterPower) changes.push(`Hands ${beforePower} → ${afterPower}`);
    const statusChanges = Object.keys(after.statuses).filter(status => before.statuses[status] !== after.statuses[status]).map(status => `${status} ${after.statuses[status] ? 'on' : 'off'}`);
    changes.push(...statusChanges);
    return `${cardName(participant.cardInstanceId)}${changes.length ? `: ${changes.join(', ')}` : ': unchanged'}`;
  };
  const selectedHasLegalLane = selectedCard
    ? ([0, 1, 2] as Lane[]).some(lane => !lockedLanes.includes(lane) && getLegalCardCost(m, 'player', selectedCard, lane) <= m.playerMotion)
    : false;
  const decisionHandlers = createBattleDecisionHandlers({
    match: m, interactive, selectedInstanceId, selectedLane, squabble,
    lockedDistricts: lockedLanes.length, decisionStartedAt,
    setSelectedInstanceId, setSelectedLane, setSquabble,
  });
  const decisionPrompt = !interactive
    ? 'Watch the highlighted card and district. Tap Fast Forward to finish the sequence.'
    : !selectedCard
      ? `1. Choose a card or pass to carry 1 Motion. Rival tell: ${rivalIntent.tell}`
      : !selectedHasLegalLane
        ? `${selectedCard.name} cannot be played now: it needs more Motion or every district is locked. Choose another card or pass.`
      : selectedLane === null
        ? `2. Choose a lit district for ${selectedCard.name}. ${selectedCard.effect}`
        : (selectedCost ?? 0) > m.playerMotion
          ? `${districts[selectedLane].name} costs ${selectedCost} Motion. You only have ${m.playerMotion}.`
          : `3. ${districts[selectedLane].name} gives this card +${getDistrictCardBonus(selectedCard, selectedLane)} district Hands. Lock In${m.squabbleUsed ? '.' : squabble ? ' with SQUABBLE to force a swing.' : ' or save SQUABBLE for a close late district.'}`;

  const getActionState = () => {
    if (!interactive) return { label: canSkip ? 'Continue' : 'Resolving...', disabled: !canSkip, onClick: canSkip ? skipSequence : undefined, type: canSkip ? 'secondary' : 'disabled', testId: 'button-resolving' };
    if (m.phase === 'complete') return { label: 'Archive Match', disabled: false, onClick: archiveMatch, type: 'primary', testId: 'button-archive-match' };
    if (selectedCard) {
      if (selectedLane === null) return { label: 'Pick District', disabled: true, type: 'disabled', testId: 'button-pick-district' };
      if ((selectedCost ?? 0) > m.playerMotion) return { label: `Need ${selectedCost} Motion`, disabled: true, type: 'error', testId: 'button-lock' };
      return { label: `Lock In · ${selectedCard.name} → ${districts[selectedLane].name} · ${selectedCost} Motion${squabble ? ' · SQUABBLE' : ''}`, disabled: false, onClick: commit, type: 'primary', testId: 'button-lock' };
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

  return <div data-venue={venue.id} data-venue-tone={venue.tone} className={`battle-arena phase-${phase} flex flex-col h-full w-full max-w-full mx-auto overflow-hidden relative z-10 bg-[#0d0d0d]`} aria-live="polite" aria-label={`Battle phase: ${phaseMessage}`}>
    <div className="battle-venue absolute inset-0 z-0 pointer-events-none perspective-1000 overflow-hidden">
      <div className="battle-venue__art absolute inset-0" style={{ backgroundImage: `url("${battlefield}")`, backgroundPosition: venue.position }} />
      <div className="battle-venue__contrast absolute inset-0" />
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
        <div className="relative"><button type="button" data-testid="button-battle-history" aria-label="Recent action history" onClick={() => { if (!showHistory) decisionHandlers.openHistory(recentActions.length); setShowHistory(v => !v); }} aria-expanded={showHistory} className="battle-utility"><span className="utility-long">History</span><span className="utility-short">Log</span></button>{showHistory && <div data-testid="battle-history" className="battle-popover w-72"><div className="mb-2 font-mono text-[9px] uppercase text-primary">Recent action</div>{recentActions.length ? <ol className="space-y-2">{recentActions.map(event => <li key={event.sequence} className="border-l-2 border-white/20 pl-2"><div className="text-[8px] font-mono uppercase text-white/40">Round {event.round} · {event.owner === 'player' ? 'You' : 'Rival'} · {event.type}</div><div className="text-[11px] leading-snug text-white/80"><b className="text-white">{cardName(event.source?.cardInstanceId ?? event.cardInstanceId, event.cardId)}</b> — {event.note}</div><button type="button" disabled={phase !== 'player-ready'} onClick={() => { onReplayStep(event, 'before'); setShowHistory(false); }} className="mt-1 font-mono text-[8px] uppercase text-primary disabled:text-white/20">Replay step by step</button></li>)}</ol> : <p className="text-xs text-white/45">No actions yet.</p>}</div>}</div>
        <div className="relative"><button type="button" data-testid="button-status-key" aria-label="Persistent status explanations" onClick={() => setShowStatuses(v => !v)} aria-expanded={showStatuses} className="battle-utility"><span className="utility-long">Status</span><span className="utility-short">FX</span></button>{showStatuses && <div data-testid="battle-status-key" className="battle-popover w-64"><div className="mb-2 font-mono text-[9px] uppercase text-primary">Persistent status key</div><dl className="space-y-2 text-[11px]"><div><dt className="font-bold text-blue-300">Frozen</dt><dd className="text-white/60">Adds 0 Hands until cleansed.</dd></div><div><dt className="font-bold text-zinc-300">Silenced</dt><dd className="text-white/60">Keeps Hands; ability cannot fire.</dd></div><div><dt className="font-bold text-yellow-300">Protected</dt><dd className="text-white/60">Blocks one targeted effect this round.</dd></div><div><dt className="font-bold text-rose-300">Blocked</dt><dd className="text-white/60">Protection has been spent this round.</dd></div><div><dt className="font-bold text-purple-300">Moved</dt><dd className="text-white/60">An ability changed this card’s district.</dd></div></dl></div>}</div>
        {activePhase && <div className="hidden sm:block border border-accent/50 bg-accent/10 px-2 py-1 text-right"><div className="text-[8px] font-mono text-accent uppercase tracking-widest">Boss Phase</div><div className="font-display font-black text-sm text-rose-200 uppercase">{activePhase.name}</div></div>}
        <button data-testid="button-rules-battle" aria-label="Battle rules" onClick={onShowRules} className="battle-utility"><span className="utility-long">Rules</span><span className="utility-short">?</span></button>
        {feedback && <button type="button" data-testid="button-audio-toggle" aria-pressed={!feedback.audioEnabled} aria-label={feedback.audioEnabled ? 'Mute battle audio' : 'Unmute battle audio'} onClick={() => setFeedbackPreferences((value: FeedbackPreferences) => ({ ...value, audioEnabled: !value.audioEnabled }))} className="battle-utility"><span className="utility-long">{feedback.audioEnabled ? 'Sound' : 'Muted'}</span><span className="utility-short">{feedback.audioEnabled ? '♪' : '×'}</span></button>}
        {feedback && typeof navigator !== 'undefined' && 'vibrate' in navigator && <button type="button" data-testid="button-haptics-toggle" aria-pressed={!feedback.hapticsEnabled} aria-label={feedback.hapticsEnabled ? 'Disable battle haptics' : 'Enable battle haptics'} onClick={() => setFeedbackPreferences((value: FeedbackPreferences) => ({ ...value, hapticsEnabled: !value.hapticsEnabled }))} className="battle-utility"><span className="utility-long">{feedback.hapticsEnabled ? 'Haptics' : 'No buzz'}</span><span className="utility-short">≈</span></button>}
        <div className="hidden sm:block text-right"><div className="text-[8px] font-mono text-white/40 uppercase">Claims</div><div className="font-display font-black text-sm"><span className="text-primary">{playerClaims}</span>–<span className="text-accent">{cpuClaims}</span></div></div><div className="text-right"><div className="text-[9px] font-mono text-accent uppercase">Motion</div><div className="font-display font-black text-xl">{m.cpuMotion}</div></div><div className="border border-white/15 bg-black/60 px-3 py-1 text-right"><div className="font-mono text-[9px] text-white/40 uppercase">Round</div><div className="font-display font-black text-base">{m.round}<span className="text-white/30">/6</span></div></div>
        {timerEnabled && <div data-testid="turn-timer" aria-label={interactive ? `${timerSeconds} seconds remaining` : 'Decision timer paused'} className="w-12 text-center border px-1 py-1"><div className="font-mono text-[7px] uppercase">Time</div><div className="font-display font-black text-lg">{interactive ? timerSeconds : '—'}</div></div>}
      </div>
    </div>
    <div className="battle-guidance relative z-30 shrink-0 w-full">
      <div className="min-w-0">
        <div className="battle-guidance-kicker">{replaying ? `Replay · ${replay.step === 'before' ? 'Before' : 'After'}` : interactive ? 'Your decision' : presentedEffect ? `${presentedEffect.owner === 'player' ? 'Your' : 'Rival'} ${presentedEffect.type}` : 'Match flow'}</div>
        <div data-testid="battle-guidance" className="battle-guidance-message">{presentedEffect && <span className={`effect-kind-chip kind-${presentedEffect.kind}`}>{presentedEffect.kind}{presentedEffect.durationLabel ? ` · ${presentedEffect.durationLabel}` : ''}</span>} {interactive ? decisionPrompt : phaseMessage}</div>
        {presentedEffect && <div data-testid="effect-causality" className="battle-causality"><b>{cardName(presentedEffect.source?.cardInstanceId ?? presentedEffect.cardInstanceId, presentedEffect.cardId)}</b>{presentedEffect.targetIds.length > 0 ? ` affected ${presentedEffect.targetIds.map(id => cardName(id)).join(', ')}` : ` affected district ${presentedEffect.lane + 1}`}. Score: Rival {presentedEffect.scores.before[presentedEffect.lane]?.cpu ?? 0} / You {presentedEffect.scores.before[presentedEffect.lane]?.player ?? 0} → Rival {presentedEffect.scores.after[presentedEffect.lane]?.cpu ?? 0} / You {presentedEffect.scores.after[presentedEffect.lane]?.player ?? 0}.</div>}
        {replaying && <div data-testid="replay-controls" className="mt-2 flex flex-wrap items-center gap-2"><button type="button" disabled={replay.step === 'before'} onClick={() => onReplayStep(replay.event, 'before')} className="battle-utility">Before</button><button type="button" disabled={replay.step === 'after'} onClick={() => onReplayStep(replay.event, 'after')} className="battle-utility">After</button><button type="button" onClick={onExitReplay} className="battle-fast-forward">Return to live battle</button><span className="w-full text-[10px] text-white/60">{[replay.event.source, ...replay.event.targets].filter(Boolean).map(participantChange).join(' · ')}</span></div>}
      </div>
      <span data-testid="claims-live" className="battle-claims">Claims <b className="text-primary">{playerClaims}</b>–<b className="text-accent">{cpuClaims}</b></span>
      {!replaying && !interactive && !blocksFastForward && <button type="button" data-testid="button-fast-forward" onClick={skipSequence} className="battle-fast-forward">Fast forward</button>}
    </div>
    <div className="battlefield-grid flex-1 min-h-0 relative z-20">{districts.map((d: any, i: number) => {
      const cpuCards = m.boards[i].filter(c => c.owner === 'cpu'); const playerCards = m.boards[i].filter(c => c.owner === 'player');
      const snapshot = presentationScores?.find((score: { lane: number }) => score.lane === i);
      const pScore = snapshot?.player ?? getLaneScoreForMatch(m, playerCards, i as Lane, 'player'); const cScore = snapshot?.cpu ?? getLaneScoreForMatch(m, cpuCards, i as Lane, 'cpu');
      const lockedLane = lockedLanes.includes(i as Lane); const laneCost = selectedCard ? getLegalCardCost(m, 'player', selectedCard, i as Lane) : null; const affordable = laneCost !== null && laneCost <= m.playerMotion; const legal = !!selectedCard && !lockedLane && affordable; const selected = selectedLane === i; const winner = pScore === cScore ? 'draw' : pScore > cScore ? 'player' : 'cpu';
      const stagedRivalHere = impactLane === i && stagedRival && phase === 'rival-travel'; const stagedPlayerHere = impactLane === i && stagedPlayer && phase === 'player-travel';
      return <div key={i} data-testid={`lane-container-${i}`} className={`district-lane district-lane-${i} min-w-0 relative group ${impactLane === i ? 'district-impact' : ''} ${phase === 'round-result' || phase === 'match-finish' ? `district-verdict verdict-${winner}` : ''} ${selected ? 'is-selected' : ''} ${selectedCard && interactive ? legal ? 'is-legal' : 'is-illegal' : ''} ${activeEffectLane === i ? 'is-effect-lane' : ''} ${lockedLane ? 'is-locked' : ''}`}>
        {activeEffectLane === i && <div className="effect-connection" aria-hidden="true"><span /></div>}
        <div data-testid={`lane-${i}-cpu-zone`} className="battle-side battle-side-rival"><span className="side-mark side-mark-rival">Rival</span><div className="battle-card-stack"><AnimatePresence>{stagedRivalHere && <motion.div key={`back-${stagedRival.instanceId}`} layoutId={stagedRival.instanceId} data-instance-id={stagedRival.instanceId} data-presentation-copy="staged" initial={{ y: -90, rotate: 12, scale: .7, opacity: 0 }} animate={{ y: 0, rotate: -4, scale: 1, opacity: 1 }} className="card-back battle-board-card"><span>S</span></motion.div>}{cpuCards.map((c, j) => <CardView key={c.instanceId} card={c} onInspect={() => setInspect(c)} isBoard isEnemy disableLayout testId={`card-board-rival-${i}-${c.cardId}-${j}`} onClick={(e) => { e.stopPropagation(); setInspect(c); }} effectivePower={getEffectiveCardPower(c)} {...effectProps(c)} />)}</AnimatePresence></div></div>
        <button type="button" data-testid={`lane-${i}`} onClick={() => decisionHandlers.selectDistrict(i, legal)} aria-disabled={!interactive || !selectedCard || !legal} tabIndex={interactive && selectedCard ? 0 : -1} aria-label={selectedCard ? `${legal ? 'Deploy' : lockedLane ? 'Cannot deploy, district locked' : `Cannot deploy, need ${laneCost} Motion`} ${selectedCard.name} to ${d.name}` : `${d.name} district`} title={lockedLane ? 'This district is locked this round.' : selectedCard && !affordable ? `Need ${laneCost} Motion; you have ${m.playerMotion}.` : undefined} className="district-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><div className="district-marker"><div className="district-score-row"><motion.span key={`cpu-${cScore}`} initial={{ scale: 1.45 }} animate={{ scale: 1 }} data-testid={`score-cpu-${i}`} className={cScore > pScore ? 'text-accent' : 'text-white/55'}>{cScore}</motion.span><span className="score-divider">:</span><motion.span key={`player-${pScore}`} initial={{ scale: 1.45 }} animate={{ scale: 1 }} data-testid={`score-player-${i}`} className={pScore > cScore ? 'text-primary' : 'text-white/55'}>{pScore}</motion.span></div><div className="district-kicker">0{i + 1} · {pScore > cScore ? 'You lead' : cScore > pScore ? 'Rival leads' : 'Tied'}</div><h3>{d.name}</h3><p>{d.rule}</p>{lockedLane ? <span className="district-prompt is-blocked">Locked this round</span> : selectedCard && interactive && <span className={`district-prompt ${selected ? 'is-ready' : affordable ? '' : 'is-blocked'}`}>{selected ? `Ready · ${laneCost} Motion` : affordable ? `Play · ${laneCost} Motion` : `Need ${laneCost} Motion`}</span>}</div></button>
        <div data-testid={`lane-${i}-player-zone`} className="battle-side battle-side-player"><span className="side-mark side-mark-player">You</span><div className="battle-card-stack"><AnimatePresence>{stagedPlayerHere && <motion.div key={`player-back-${stagedPlayer.instanceId}`} data-instance-id={stagedPlayer.instanceId} data-presentation-copy="staged" initial={{ y: 90, rotate: -10, scale: .72, opacity: 0 }} animate={{ y: 0, rotate: 3, scale: 1, opacity: 1 }} className="card-back battle-board-card"><span>S</span></motion.div>}{playerCards.map((c, j) => <CardView key={c.instanceId} card={c} onInspect={() => setInspect(c)} variantId={getEquippedVariant(equippedVariants, c.id)} isBoard disableLayout testId={`card-board-player-${i}-${c.cardId}-${j}`} onClick={(e) => { e.stopPropagation(); setInspect(c); }} effectivePower={getEffectiveCardPower(c)} {...effectProps(c)} />)}</AnimatePresence></div></div>
      </div>;
    })}</div>
    <div inert={!interactive} className="battle-command-deck shrink-0 relative z-40"><div id="hand-tray" data-testid="hand-tray" className="battle-hand-tray"><div className="battle-hand-row"><AnimatePresence>{m.playerHand.filter(c => c.instanceId !== stagedPlayer?.instanceId).map(c => { const playableSomewhere = ([0, 1, 2] as Lane[]).some(lane => !lockedLanes.includes(lane) && getLegalCardCost(m, 'player', c, lane) <= m.playerMotion); const reason = !playableSomewhere ? `Cannot play now. Need more Motion or an unlocked district.` : undefined; return <CardView key={c.instanceId} card={c} onInspect={() => setInspect(c)} variantId={getEquippedVariant(equippedVariants, c.id)} queued={selectedInstanceId === c.instanceId} squabble={squabble && selectedInstanceId === c.instanceId} cost={selectedLane !== null ? getLegalCardCost(m, 'player', c, selectedLane as Lane) : c.cost} unavailable={interactive && !playableSomewhere} disabledReason={reason} onClick={(e) => { e.stopPropagation(); decisionHandlers.selectCard(c, playableSomewhere); }} className="origin-bottom" />; })}</AnimatePresence></div></div>
      {selectedCard && selectedLane !== null && interactive && <div className={`target-trajectory target-lane-${selectedLane}`} aria-hidden="true"><span /></div>}
      <div className="battle-actions"><div className="battle-motion"><div>Motion</div><MotionEnergy value={m.playerMotion} testId="motion-player" replaying={replaying} /></div><button data-testid="button-squabble" title={m.squabbleUsed ? 'SQUABBLE has already been used.' : !selectedCard ? 'Choose a card first.' : 'Double this card’s base Hands once per match.'} className={`battle-squabble ${squabble ? 'is-armed' : ''}`} onClick={() => decisionHandlers.toggleSquabble(selectedCard ?? null)} disabled={m.squabbleUsed || !interactive || !selectedCard}>{m.squabbleUsed ? 'Squabble spent' : squabble ? 'Squabble armed' : 'Arm Squabble'}</button><button data-testid={action.testId} onClick={action.onClick} disabled={action.disabled} className={`battle-primary-action action-${action.type}`}>{action.label}</button></div>
    </div>
  </div>;
}
*/

export function tryLockInteraction(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}
