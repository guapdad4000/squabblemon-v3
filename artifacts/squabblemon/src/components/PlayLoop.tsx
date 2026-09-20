import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useStartPlayerMatch, useCompletePlayerMatch, getGetPlayerBootstrapQueryKey, getGetPlayerStoryQueryKey, MatchReward, type MatchMove, type StoryMatchMetadata } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGroup, AnimatePresence } from 'framer-motion';
import { cards, decks, Card, Deck } from '../data';
import { Lobby } from './Lobby';
import { Battle, tryLockInteraction } from './Battle';
import { ResultScreen } from './ResultScreen';
import { CardInspector } from './CardInspector';
import { RulesModal } from './RulesModal';
import { StoryCinematic } from './StoryCinematic';
import { PresentationTimeline } from '../presentationTimeline';
import { readMoveOverrides, specialMoveForEvent, planSpecialMoveBeat, markSpecialMovePlayed } from '../specialMoves';
import { broadcastDelay, changedDistrictControl, isReducedMotionRequested, type DistrictOwner } from '../broadcastPresentation';
import { BattleFeedback } from '../battleFeedback';
import { createDistrictSnapshot, validateDistrictSnapshot, getMatchDistricts, type DistrictSnapshot, canAffordSelection, chooseCpuPlay, createMatch, createMatchFromEngineCards, createMatchFromCatalog, createStoryMatch, getDistrictResults, Match, playCard, pass, nextRound, CardInstance, type AbilityUpgradeSnapshot, type EffectLogEntry, type Lane, type ScoreState, type StoryEncounterSnapshot } from '../gameEngine';
import { decisionTimeBucket, trackEvent } from '../lib/analytics';
import { getEquippedVariant, type EquippedVariantMap } from './CardVariantTreatment';
import { settleHiddenBattlePresentation } from '../battleVisibility';
import { TURN_SECONDS } from '../turnTimer';
import type { CardProgressionMap } from '@workspace/squabblemon-engine/cardProgression';
import { selectTrainingRival } from '@workspace/squabblemon-engine/training';
import { isActivityId } from '@workspace/squabblemon-engine/activities';
import { createLocalPracticeMatch } from '../lib/localPracticeMatch';
import { playTurnCard, revealCpuTurn } from '../gameEngine';

export type PresentationPhase = 'versus' | 'countdown-3' | 'countdown-2' | 'countdown-1' | 'squabble' | 'deal' | 'round-intro' | 'lock-in' | 'player-ready' | 'player-travel' | 'player-reveal' | 'player-focus' | 'player-slam' | 'player-impact' | 'effects' | 'player-pass' | 'rival-thinking' | 'rival-travel' | 'rival-reveal' | 'rival-focus' | 'rival-slam' | 'rival-impact' | 'rival-pass' | 'district-flipped' | 'round-result' | 'match-finish';
export type PresentationEffect = EffectLogEntry & { targetIds: string[]; durationLabel?: string; impact?: boolean; chain?: { id: string; index: number; total: number; fromId: string | null } };

export const EFFECT_PRESENTATION_TIMING = {
  standard: { beforeMs: 450, afterMs: 650 },
  reduced: { beforeMs: 70, afterMs: 90 },
} as const;

export function trackBattleTurnCommitted(match: Match, action: 'lock_in' | 'pass', automatic: boolean, squabble: boolean, decisionStartedAt: number, lane: Lane | null) {
  trackEvent('battle_turn_committed', {
    round: match.round, action, automatic, squabble,
    decision_time: decisionTimeBucket(decisionStartedAt),
    ...(action === 'lock_in' && lane !== null ? { district: lane + 1 } : {}),
  });
}
const allCards = (match: Match) => [...match.playerHand, ...match.cpuHand, ...match.boards.flat()];
const cardById = (match: Match, id: string) => allCards(match).find(card => card.instanceId === id);
/** Rebuild only participants from the authoritative before/after event snapshots. */
/** Use the complete event snapshot: participant-only patches omit summons and lane-wide effects. */
export const applyEventState = (_visual: Match, authoritative: Match, event: EffectLogEntry, key: 'before' | 'after'): Match =>
  buildReplayFrame(authoritative, event, key);

/** Apply the engine-captured complete visual state for one historical step. */
export const buildReplayFrame = (live: Match, selected: EffectLogEntry, key: 'before' | 'after'): Match => ({
  ...live,
  ...JSON.parse(JSON.stringify(selected.replay[key])),
});

/** Authenticated games must use the immutable, server-issued upgrade snapshot. */
export function createCanonicalMatch(
  mode: 'practice' | 'tutorial' | 'story',
  playerDeckId: string,
  rivalDeckId: string,
  abilityUpgradeSnapshot: AbilityUpgradeSnapshot,
  encounterSnapshot?: StoryEncounterSnapshot | null,
  districtSnapshot?: DistrictSnapshot,
) {
  if (mode === 'story' || encounterSnapshot) {
    if (!encounterSnapshot) throw new Error('The server did not issue a story encounter.');
    return createStoryMatch(encounterSnapshot, abilityUpgradeSnapshot.player.map(card => card.cardId), playerDeckId, abilityUpgradeSnapshot, districtSnapshot);
  }
  return createMatchFromEngineCards(playerDeckId, abilityUpgradeSnapshot.player.map(card => card.cardId), rivalDeckId, abilityUpgradeSnapshot.cpu.map(card => card.cardId), undefined, undefined, abilityUpgradeSnapshot, districtSnapshot);
}

export function PlayLoop({ mode = 'practice', onExit, onTutorialComplete, onVerifiedComplete, initialDeckId = 'block', initialRivalId = 'combo', hideLobby = false, turnTimerEnabled = true, customPlayerDeck, availableDeckIds, storyNodeId, equippedVariants, cardProgression = {}, activity, draftWeek, draftPicks }: { activity?: string; draftWeek?: string; draftPicks?: string[]; mode?: 'guest' | 'practice' | 'tutorial' | 'story'; onExit: () => void; onTutorialComplete?: () => void; onVerifiedComplete?: (match: Match) => void; initialDeckId?: string; initialRivalId?: string; hideLobby?: boolean; turnTimerEnabled?: boolean; customPlayerDeck?: Deck; availableDeckIds?: string[]; storyNodeId?: string; equippedVariants?: EquippedVariantMap; cardProgression?: CardProgressionMap }) {
  const [screen, setScreen] = useState<'lobby' | 'battle' | 'result'>(hideLobby ? 'battle' : 'lobby');
  const [deckId, setDeckId] = useState(customPlayerDeck?.id ?? (availableDeckIds?.includes(initialDeckId) ? initialDeckId : availableDeckIds?.[0] ?? initialDeckId));
  const [rival, setRival] = useState(initialRivalId);
  const [match, setMatch] = useState<Match | null>(null), [visualMatch, setVisualMatch] = useState<Match | null>(null);
  const districts = getMatchDistricts(match);
  const visualMatchRef = useRef<Match | null>(null);
  const [presentationScores, setPresentationScores] = useState<ScoreState[] | null>(null);
  const [serverMatchId, setServerMatchId] = useState<string | null>(null), [serverReward, setServerReward] = useState<MatchReward | null>(null), [serverRewardError, setServerRewardError] = useState(false);
  const [isUnsavedTraining, setIsUnsavedTraining] = useState(mode === 'guest');
  const [storyMetadata, setStoryMetadata] = useState<StoryMatchMetadata | null>(null), [startError, setStartError] = useState<string | null>(null);
  const startPlayerMatch = useStartPlayerMatch(), completePlayerMatch = useCompletePlayerMatch(), queryClient = useQueryClient();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null), [selectedLane, setSelectedLane] = useState<number | null>(null), [squabble, setSquabble] = useState(false);
  const timeline = useRef(new PresentationTimeline()), autoStartRef = useRef(false), playerMovesRef = useRef<MatchMove[]>([]), locked = useRef(false), fastForwardRef = useRef(false), skipTransitionRef = useRef(false);
  const decisionStartedAtRef = useRef(Date.now());
  const districtOwnersRef = useRef<DistrictOwner[]>(['draw', 'draw', 'draw']);
  /** Each fighter+move pair plays its chroma video once per match; repeat triggers get the standard beat. */
  const playedSpecialMovesRef = useRef<Set<string>>(new Set());
  const [presentationPhase, setPresentationPhase] = useState<PresentationPhase>('versus'), [phaseMessage, setPhaseMessage] = useState('');
  const [impactLane, setImpactLane] = useState<Lane | null>(null), [timerSeconds, setTimerSeconds] = useState(20), [tabHidden, setTabHidden] = useState(document.hidden);
  const [stagedRival, setStagedRival] = useState<CardInstance | null>(null), [stagedPlayer, setStagedPlayer] = useState<CardInstance | null>(null);
  const [activeEffectId, setActiveEffectId] = useState<string | null>(null), [activeEffectLane, setActiveEffectLane] = useState<Lane | null>(null), [activeEffect, setActiveEffect] = useState<PresentationEffect | null>(null);
  const [squabbleCinematicLane, setSquabbleCinematicLane] = useState<Lane | null>(null);
  const [replay, setReplay] = useState<{ event: EffectLogEntry; step: 'before' | 'after' } | null>(null);
  const replayLiveFrame = useRef<Match | null>(null);
  const replayLiveTimer = useRef<number | null>(null);
  const [showRules, setShowRules] = useState(false), [inspect, setInspect] = useState<CardInstance | Card | null>(null);
  const [encounterCinematic, setEncounterCinematic] = useState<{ source: string, poster: string, title: string, eyebrow: string } | null>(null);
  const [feedbackPreferences, setFeedbackPreferences] = useFeedbackPreferences();
  const feedback = useRef(new BattleFeedback(feedbackPreferences));

  // Exiting cinematic buttons can retain an older React event handler. Read the
  // current phase through a ref so a late click cannot restart a committed turn.
  const livePresentation = useRef({ match, presentationPhase });
  livePresentation.current = { match, presentationPhase };
  const deck = customPlayerDeck || decks.find(d => d.id === deckId) || decks[0];
  const rivalDeck: Deck = match?.storyEncounter ? { id: match.storyEncounter.enemy.deckId, name: match.storyEncounter.enemy.name, archetype: match.storyEncounter.enemy.behaviorProfile, accent: 'STORY', plan: 'A server-issued story encounter.', cards: [...match.storyEncounter.enemy.cardIds], hero: cards[match.storyEncounter.enemy.cardIds[0]]?.id ?? decks[0].hero } : decks.find(d => d.id === rival) || decks[0];
  const cancelTimers = useCallback(() => { feedback.current.reset(); timeline.current.cancelAll(); }, []);
  const wait = useCallback((ms: number, id: number) => timeline.current.wait(ms, id), []);
  const waitForBeat = useCallback((normalMs: number, reducedMs: number, id: number, fast = false) =>
    wait(broadcastDelay(normalMs, reducedMs, isReducedMotionRequested(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      document.documentElement.dataset.reduceMotion === 'true',
    ), fast || fastForwardRef.current), id), [wait]);
  const setVisualFrame = useCallback((next: Match | null) => { visualMatchRef.current = next; setVisualMatch(next); }, []);
  const resetPresentation = useCallback(() => { setSelectedInstanceId(null); setSelectedLane(null); setSquabble(false); setShowRules(false); setInspect(null); setStagedRival(null); setStagedPlayer(null); setActiveEffectId(null); setActiveEffectLane(null); setActiveEffect(null); setPresentationScores(null); setReplay(null); replayLiveFrame.current = null; replayLiveTimer.current = null; }, []);
  useEffect(() => {
    return () => {
      cancelTimers();
    };
  }, [cancelTimers]);
  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.hidden;
      setTabHidden(hidden);
      if (hidden) settleHiddenBattlePresentation(presentationPhase, feedback.current, timeline.current, () => { fastForwardRef.current = true; });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [presentationPhase]);
  useEffect(() => {
    feedback.current.setPreferences(feedbackPreferences);
  }, [feedbackPreferences]);
  useEffect(() => { skipTransitionRef.current = false; }, [presentationPhase]);

  const enterPlayerTurn = useCallback(async (round: number, immediate = false, resetClock = true) => { const id = timeline.current.id; setPresentationPhase('round-intro'); setPhaseMessage(`ROUND ${round} · DECISION IN 1`); if (!immediate && !await waitForBeat(1100, 90, id)) return; decisionStartedAtRef.current = Date.now(); setPresentationPhase('player-ready'); setPhaseMessage(`ROUND ${round} // YOUR MOVE`); if (resetClock) setTimerSeconds(TURN_SECONDS); locked.current = false; fastForwardRef.current = false; setSquabbleCinematicLane(null); }, [waitForBeat]);
  const runIntro = useCallback(async () => { cancelTimers(); const id = timeline.current.id; const beats: Array<[PresentationPhase, string, number]> = [['versus', 'YOU  VS  RIVAL', 1100], ['countdown-3', '3', 700], ['countdown-2', '2', 700], ['countdown-1', '1', 700], ['squabble', 'SQUABBLE!', 900], ['deal', 'GANG UP', 850]]; for (const [phase, message, duration] of beats) { if (id !== timeline.current.id) return; setPresentationPhase(phase); setPhaseMessage(message); if (!await waitForBeat(duration, 90, id)) return; } if (id === timeline.current.id) void enterPlayerTurn(1); }, [cancelTimers, enterPlayerTurn, waitForBeat]);
  const beginMatch = useCallback((initial: Match) => {
    cancelTimers(); setServerReward(null); setServerRewardError(false); setStoryMetadata(null); playerMovesRef.current = []; districtOwnersRef.current = getDistrictResults(initial).map(result => result.winner); playedSpecialMovesRef.current.clear(); setMatch(initial); setVisualFrame(initial); resetPresentation(); setScreen('battle'); locked.current = true;
    // Chapter dialogue is presented on the 2D stage before this real match.
    void runIntro();
  }, [cancelTimers, resetPresentation, runIntro, setVisualFrame]);

  const handleCinematicDone = useCallback(() => {
    setEncounterCinematic(null);
    void runIntro();
  }, [runIntro]);

  const startLocalMatch = useCallback((rivalDeckId?: string) => {
    if (activity && isActivityId(activity) && customPlayerDeck) {
      const localMatch = createLocalPracticeMatch({
        deckId: customPlayerDeck.id,
        catalogCardIds: customPlayerDeck.cards,
        activity,
        progression: cardProgression,
        week: draftWeek,
        draftPicks,
      });
      setRival(localMatch.cpuDeck);
      beginMatch(localMatch);
      return;
    }
    const localRival = rivalDeckId ?? (customPlayerDeck
      ? rival
      : selectTrainingRival(deckId, deck.cards, cardProgression));
    setRival(localRival);
    beginMatch(customPlayerDeck
      ? createMatchFromCatalog(customPlayerDeck.id, customPlayerDeck.cards, localRival, undefined, createDistrictSnapshot(crypto.randomUUID()))
      : createMatch(deckId, localRival, undefined, undefined, createDistrictSnapshot(crypto.randomUUID())));
  }, [activity, beginMatch, cardProgression, customPlayerDeck, deck.cards, deckId, draftPicks, draftWeek, rival]);
  const start = useCallback(async () => {
    feedback.current.unlockAudio();
    setServerMatchId(null); setStartError(null); setIsUnsavedTraining(mode === 'guest');
    if (mode !== 'guest') try {
      const res = await startPlayerMatch.mutateAsync({ data: { mode: mode === 'tutorial' ? 'tutorial' : mode === 'story' ? 'story' : 'practice', playerDeckId: deckId, rivalDeckId: rival, storyNodeId, activity, draftWeek, draftPicks } });
      setServerMatchId(res.id);
      setRival(res.rivalDeckId);
      beginMatch(createCanonicalMatch(
        mode === 'tutorial' ? 'tutorial' : mode === 'story' ? 'story' : 'practice',
        deckId,
        res.rivalDeckId,
        res.abilityUpgradeSnapshot,
        res.encounterSnapshot as unknown as StoryEncounterSnapshot | null,
        validateDistrictSnapshot(res.districtSnapshot),
      ));
      return;
    } catch (error) {
      if (mode === 'story' || mode === 'tutorial' || customPlayerDeck) { setServerMatchId(null); setStartError(error instanceof Error ? error.message : 'The encounter could not be started.'); return; }
      if (!window.confirm('Failed to reach server. Play local Training with no saved rewards?')) return;
      setIsUnsavedTraining(true);
    }
    try {
      startLocalMatch();
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'The practice fade could not be started.');
    }
  }, [beginMatch, customPlayerDeck, deckId, mode, rival, startLocalMatch, startPlayerMatch, storyNodeId, activity, draftWeek, draftPicks]);
  useEffect(() => { if (hideLobby && !match && !autoStartRef.current) { autoStartRef.current = true; void start(); } }, [hideLobby, match, start]);

  const finishMatchSession = useCallback(async (_finalMatch: Match) => {
    if (mode !== 'guest' && serverMatchId) try {
      const res = await completePlayerMatch.mutateAsync({ matchId: serverMatchId, data: { moves: playerMovesRef.current } });
      if (mode !== 'tutorial') queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), (old: any) => old ? { ...old, profile: res.profile, missions: res.missions, nextAction: res.nextAction } : old);
      if (res.campaign) queryClient.setQueryData(getGetPlayerStoryQueryKey(), res.campaign);
      else if (mode === 'story') void queryClient.invalidateQueries({ queryKey: getGetPlayerStoryQueryKey() });
      setServerReward(res.reward); setStoryMetadata(res.story); setServerRewardError(false); onVerifiedComplete?.(_finalMatch);
    } catch { setServerRewardError(true); }
    else if (mode === 'guest') localStorage.setItem('squabblemon_guest_tutorial_complete', 'true');
    setScreen('result');
  }, [completePlayerMatch, mode, queryClient, serverMatchId, onVerifiedComplete]);
  /** Build the play-once key for a fighter's special move from the active effect. */
  const buildMoveKey = (effect: EffectLogEntry, move: { id: string }) => ({ owner: effect.owner, sourceInstanceId: effect.source?.cardInstanceId ?? effect.cardInstanceId, moveId: move.id });
  const presentEvents = useCallback(async (resolved: Match, fromSequence: number, id: number, fast = false) => {
    let frame = visualMatchRef.current ?? resolved;
    const events = resolved.effectLog.filter(e => e.sequence >= fromSequence).sort((a, b) => a.sequence - b.sequence);
    const chainTotal = events.filter(event => event.type === 'ability').length;
    let chainIndex = 0;
    let previousSource: string | null = null;
    for (const effect of events) {
      const sourceId = effect.source?.cardInstanceId ?? effect.cardInstanceId, targetIds = effect.targets.map(t => t.cardInstanceId);
      const lane = effect.source?.after?.lane ?? effect.source?.before?.lane ?? effect.targets[0]?.after?.lane ?? effect.targets[0]?.before?.lane ?? effect.lane;
      const chain = effect.type === 'ability' ? { id: `${id}:${fromSequence}`, index: ++chainIndex, total: chainTotal, fromId: previousSource } : undefined;
      if (chain) previousSource = sourceId;
      const isPlay = effect.type === 'play', phase: PresentationPhase = isPlay ? effect.owner === 'player' ? 'player-travel' : 'rival-travel' : effect.type === 'reveal' ? effect.owner === 'player' ? 'player-reveal' : 'rival-reveal' : effect.type === 'pass' ? effect.owner === 'player' ? 'player-pass' : 'rival-pass' : 'effects';
      const staged = isPlay ? cardById(resolved, sourceId) ?? cardById(frame, sourceId) ?? null : null;
      if (effect.owner === 'player') setStagedPlayer(staged); else setStagedRival(staged);
      frame = applyEventState(frame, resolved, effect, 'before'); setVisualFrame(frame); setPresentationScores(effect.scores.before); setPresentationPhase(phase); setActiveEffectId(effect.source ? sourceId : null); setActiveEffectLane(lane); setImpactLane(lane); setActiveEffect({ ...effect, chain, cardInstanceId: sourceId, lane, targetIds, durationLabel: effect.duration ? `Through round ${effect.duration.expiresAtRound - 1}` : undefined }); setPhaseMessage(effect.note);
      if (!await waitForBeat(isPlay ? 320 : effect.type === 'reveal' ? 90 : EFFECT_PRESENTATION_TIMING.standard.beforeMs, isPlay ? 55 : EFFECT_PRESENTATION_TIMING.reduced.beforeMs, id, fast)) return false;
      frame = applyEventState(frame, resolved, effect, 'after'); setVisualFrame(frame); if (!isPlay) setPresentationScores(effect.scores.after);
      if (isPlay) {
        setPresentationPhase(effect.owner === 'player' ? 'player-reveal' : 'rival-reveal');
        setPhaseMessage(`${cardById(resolved, sourceId)?.name ?? 'CARD'} REVEALED`);
        if (!await waitForBeat((staged?.cost ?? 0) >= 4 ? 650 : 400, 60, id, fast)) return false;
        setPresentationScores(effect.scores.after);
        setPresentationPhase(effect.owner === 'player' ? 'player-impact' : 'rival-impact');
        const isSquabble = effect.note.includes('SQUABBLE');
        setPhaseMessage(isSquabble ? `SQUABBLE · DISTRICT ${lane + 1}` : `LANDED · DISTRICT ${lane + 1}`);
        if (isSquabble && !fast && !fastForwardRef.current) {
          setSquabbleCinematicLane(lane);

        }
      } else {
        setPresentationPhase(phase);
      }
      setActiveEffect(previous => previous ? { ...previous, impact: true } : null);
      if (!fast && !fastForwardRef.current) {
        feedback.current.emit(effect, id, isReducedMotionRequested(
          window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          document.documentElement.dataset.reduceMotion === 'true',
        ));
      }
      if (!await waitForBeat(effect.type === 'reveal' ? 120 : effect.note.includes('SQUABBLE') ? 1000 : isPlay ? 450 : (() => {
        const move = specialMoveForEvent(effect, readMoveOverrides());
        const key = move ? buildMoveKey(effect, move) : null;
        const plan = key
          ? planSpecialMoveBeat(move, key, playedSpecialMovesRef.current, EFFECT_PRESENTATION_TIMING.standard.afterMs)
          : { durationMs: EFFECT_PRESENTATION_TIMING.standard.afterMs };
        if (move && key && !isReducedMotionRequested(
          window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          document.documentElement.dataset.reduceMotion === 'true',
        )) markSpecialMovePlayed(playedSpecialMovesRef.current, key);
        return plan.durationMs;
      })(), EFFECT_PRESENTATION_TIMING.reduced.afterMs, id, fast)) return false;
      setSquabbleCinematicLane(null);
      setStagedPlayer(null); setStagedRival(null);
    }
    setActiveEffectId(null); setActiveEffectLane(null); setActiveEffect(null); setImpactLane(null); return true;
  }, [setVisualFrame, waitForBeat]);
  const advanceRoundBoundary = useCallback(async (resolved: Match, id: number, fast = false) => { const next = nextRound(resolved); setMatch(next); if (!await presentEvents(next, resolved.nextEventSequence, id, fast)) return; if (next.phase === 'complete') { setPresentationPhase('match-finish'); setPhaseMessage('FINAL DISTRICTS'); if (!await waitForBeat(1500, 120, id, fast)) return; void finishMatchSession(next); return; } setPresentationScores(null); void enterPlayerTurn(next.round, fast); }, [enterPlayerTurn, finishMatchSession, presentEvents, waitForBeat]);
  const finishRound = useCallback(async (resolved: Match, id: number) => {
    const owners = getDistrictResults(resolved).map(result => result.winner);
    const changedLanes = changedDistrictControl(districtOwnersRef.current, owners);
    districtOwnersRef.current = owners;
    if (changedLanes.length > 0) {
      setPresentationPhase('district-flipped');
      const changes = changedLanes.map(lane => {
        const result = getDistrictResults(resolved)[lane];
        const owner = result.winner === 'player' ? 'YOU TOOK' : result.winner === 'cpu' ? 'RIVAL TOOK' : 'TIED';
        return `${owner} ${getMatchDistricts(resolved)[lane].name} ${result.player}–${result.cpu}`;
      });
      setPhaseMessage(changes.join(' · '));
      if (!await waitForBeat(850, 80, id)) return;
    }
    const claims = getDistrictResults(resolved).map(result => `${getMatchDistricts(resolved)[result.lane].name} ${result.player}–${result.cpu}`).join(' · ');
    setPresentationPhase('round-result'); setPhaseMessage(`ROUND ${resolved.round}: ${claims}`);
    if (await waitForBeat(changedLanes.length > 0 ? 1300 : 1700, 120, id)) await advanceRoundBoundary(resolved, id, fastForwardRef.current);
  }, [advanceRoundBoundary, waitForBeat]);
  const runRival = useCallback(async (afterPlayer: Match, id: number) => {
    setPresentationPhase('rival-thinking'); setPhaseMessage('RIVAL THINKING');
    if (!await waitForBeat(1100, 90, id)) return;
    const resolved = revealCpuTurn(afterPlayer);
    setMatch(resolved);
    if (await presentEvents(resolved, afterPlayer.nextEventSequence, id, fastForwardRef.current)) await finishRound(resolved, id);
  }, [finishRound, presentEvents, waitForBeat]);

  const commit = useCallback(async (endTurn = false, automatic = false, drop?: { instanceId: string; lane: Lane; squabble: boolean }) => {
    if (!match || match.phase !== 'player' || presentationPhase !== 'player-ready' || locked.current) return;
    const cardId = drop?.instanceId ?? selectedInstanceId, targetLane = drop?.lane ?? selectedLane, armed = drop?.squabble ?? squabble;
    const selectedIsLegal = cardId !== null && targetLane !== null
      && canAffordSelection(match, 'player', cardId, targetLane as Lane);
    if (!endTurn && cardId && !selectedIsLegal && !automatic) return;
    const playsCard = !endTurn && selectedIsLegal;
    feedback.current.unlockAudio(); locked.current = true; cancelTimers();
    const id = timeline.current.id;
    if (playsCard) feedback.current.cue('lock', false);
    let next: Match;
    try {
      next = playsCard
        ? playTurnCard(match, 'player', cardId!, targetLane as Lane, armed)
        : pass(match, 'player');
      playerMovesRef.current.push(playsCard
        ? { cardInstanceId: cardId, lane: targetLane as Lane, squabble: armed, endTurn: false }
        : { cardInstanceId: null, lane: null, squabble: false, endTurn: true });
      trackBattleTurnCommitted(match, playsCard ? 'lock_in' : 'pass', automatic, playsCard && armed, decisionStartedAtRef.current, playsCard ? targetLane as Lane : null);
      setMatch(next);
      if (playsCard || automatic) {
        setPresentationPhase('lock-in');
        setPhaseMessage(playsCard
          ? `${automatic ? 'TIME EXPIRED · AUTO-PLAYED' : `${cardById(match, cardId!)?.name ?? 'CARD'} PLAYED`} · ${getMatchDistricts(match)[targetLane as Lane].name}`
          : 'TIME EXPIRED · TURN ENDED');
        if (!await waitForBeat(automatic ? 900 : 520, 90, id)) return;
      }
      if (!await presentEvents(next, match.nextEventSequence, id)) return;
      if (automatic && playsCard) {
        const afterPlay = next;
        next = pass(afterPlay, 'player');
        playerMovesRef.current.push({ cardInstanceId: null, lane: null, squabble: false, endTurn: true });
        setMatch(next);
        if (!await presentEvents(next, afterPlay.nextEventSequence, id)) return;
      }
    } catch {
      setStagedPlayer(null); setImpactLane(null); locked.current = false;
      setPresentationPhase('player-ready');
      return;
    }
    setSquabble(false); setSelectedInstanceId(null); setSelectedLane(null);
    setVisualFrame(next); setPresentationScores(null);
    if (next.phase === 'player') void enterPlayerTurn(next.round, true, false);
    else await runRival(next, id);
  }, [cancelTimers, enterPlayerTurn, match, presentationPhase, presentEvents, runRival, selectedInstanceId, selectedLane, setVisualFrame, squabble, waitForBeat]);
  const showReplayFrame = useCallback((event: EffectLogEntry, step: 'before' | 'after') => {
    if (!match || presentationPhase !== 'player-ready') return;
    if (!replayLiveFrame.current) { replayLiveFrame.current = visualMatchRef.current; replayLiveTimer.current = timerSeconds; }
    const live = replayLiveFrame.current;
    if (!live) return;
    cancelTimers();
    const sourceId = event.source?.cardInstanceId ?? event.cardInstanceId;
    const lane = event.source?.after?.lane ?? event.source?.before?.lane ?? event.targets[0]?.after?.lane ?? event.targets[0]?.before?.lane ?? event.lane;
    setVisualFrame(buildReplayFrame(live, event, step)); setPresentationScores(event.scores[step]); setActiveEffectId(event.source ? sourceId : null); setActiveEffectLane(lane); setImpactLane(lane);
    setActiveEffect({ ...event, cardInstanceId: sourceId, lane, targetIds: event.targets.map(target => target.cardInstanceId), durationLabel: event.duration ? `Through round ${event.duration.expiresAtRound - 1}` : undefined });
    setPhaseMessage(event.note); setReplay({ event, step });
  }, [cancelTimers, match, presentationPhase, setVisualFrame, timerSeconds]);
  const exitReplay = useCallback(() => {
    if (replayLiveFrame.current) setVisualFrame(replayLiveFrame.current);
    replayLiveFrame.current = null;
    if (replayLiveTimer.current !== null) setTimerSeconds(replayLiveTimer.current);
    replayLiveTimer.current = null;
    setReplay(null); setPresentationScores(null); setActiveEffectId(null); setActiveEffectLane(null); setActiveEffect(null); setImpactLane(null);
    if (match) { setPhaseMessage(`ROUND ${match.round} // YOUR MOVE`); locked.current = false; }
  }, [match, setVisualFrame]);
  useEffect(() => { if (!turnTimerEnabled || screen !== 'battle' || presentationPhase !== 'player-ready' || replay || showRules || inspect || tabHidden) return; const interval = setInterval(() => setTimerSeconds(v => Math.max(0, v - 1)), 1000); return () => clearInterval(interval); }, [inspect, presentationPhase, replay, screen, showRules, tabHidden, turnTimerEnabled]);
  useEffect(() => { if (turnTimerEnabled && timerSeconds === 0 && presentationPhase === 'player-ready' && !replay && match) void commit(false, true); }, [commit, match, presentationPhase, replay, timerSeconds, turnTimerEnabled]);
  const skipSequence = () => {
    const { match, presentationPhase } = livePresentation.current;
    if (!match) return;
    if (!tryLockInteraction(skipTransitionRef)) return;
    if (['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro'].includes(presentationPhase)) {
      if (match.phase !== 'player') { fastForwardRef.current = true; timeline.current.completeAll(); return; }
      trackBattleFastForwarded(match, presentationPhase);
      cancelTimers(); void enterPlayerTurn(match.round, true);
    } else if (presentationPhase === 'round-result') {
      trackBattleFastForwarded(match, presentationPhase);
      cancelTimers(); void advanceRoundBoundary(match, timeline.current.id, true);
    } else if (presentationPhase !== 'player-ready' && presentationPhase !== 'match-finish') {
      trackBattleFastForwarded(match, presentationPhase);
      fastForwardRef.current = true;
      timeline.current.completeAll();
    } else {
      skipTransitionRef.current = false;
    }
  };
  const handleRestart = () => { autoStartRef.current = false; setStartError(null); setIsUnsavedTraining(mode === 'guest'); setMatch(null); setVisualFrame(null); setScreen(hideLobby ? 'battle' : 'lobby'); };
  return <div className="h-[100dvh] bg-black text-white font-sans flex flex-col relative overflow-hidden game-bg"><div className="noise-overlay" />
    {e2eAuthEnabled && mode === 'tutorial' && match && (
      <button
        type="button"
        className="absolute right-2 top-2 z-[80] border border-primary bg-black px-3 py-2 font-mono text-[9px] uppercase text-primary"
        onClick={() => void finishMatchSession(match)}
      >
        Complete guided test fade
      </button>
    )}
    {mode === 'guest' && (
      <div className={screen === 'battle' ? "absolute left-2 bottom-[54px] z-[70] pointer-events-none text-[8px] text-white/50" : "absolute left-1/2 top-2 z-[70] -translate-x-1/2 border border-primary/40 bg-black/90 px-3 py-2 text-center font-mono text-[9px] uppercase tracking-widest text-primary"}>
        Offline training — rewards are unsaved
      </div>
    )}
    {startError && !match && <div className="relative z-20 grid h-full place-items-center p-6 text-center"><div className="max-w-sm border border-accent/40 bg-zinc-950 p-6"><div className="font-mono text-[9px] uppercase tracking-[.22em] text-accent">Encounter unavailable</div><h1 className="mt-2 font-display text-3xl font-black italic uppercase">Could not start the fade</h1><p role="alert" className="mt-3 text-sm text-white/55">{startError}</p><div className="mt-6 flex gap-2"><button type="button" onClick={onExit} className="flex-1 border border-white/20 px-4 py-3 hover:bg-white/5">Back</button><button type="button" onClick={() => void start()} disabled={startPlayerMatch.isPending} className="flex-1 bg-primary px-4 py-3 text-black hover:bg-yellow-400">{startPlayerMatch.isPending ? 'Retrying' : 'Retry'}</button></div></div></div>}
    {screen === 'lobby' && !hideLobby && <Lobby onStart={start} deckId={deckId} setDeckId={setDeckId} rival={rival} setRival={setRival} availableDeckIds={availableDeckIds} onShowRules={() => setShowRules(true)} onInspect={setInspect} isLoading={startPlayerMatch.isPending} onExit={onExit} equippedVariants={equippedVariants} cardProgression={cardProgression} />}
    {encounterCinematic && (
      <StoryCinematic
        source={encounterCinematic.source}
        poster={encounterCinematic.poster}
        title={encounterCinematic.title}
        eyebrow={encounterCinematic.eyebrow}
        onComplete={handleCinematicDone}
        onSkip={handleCinematicDone}
        duration={5200}
      />
    )}
    {screen === 'battle' && visualMatch && <LayoutGroup><Battle tutorialCoach={mode === 'tutorial'} match={visualMatch} deck={deck} rivalDeck={rivalDeck} playedSpecialMoves={playedSpecialMovesRef.current} selectedInstanceId={selectedInstanceId} setSelectedInstanceId={setSelectedInstanceId} selectedLane={selectedLane} setSelectedLane={setSelectedLane} commit={() => void commit()} onPlayCard={(instanceId: string, lane: Lane, squabble: boolean) => void commit(false, false, { instanceId, lane, squabble })} endTurn={() => void commit(true)} skipSequence={skipSequence} presentationPhase={presentationPhase} phaseMessage={phaseMessage} timerSeconds={timerSeconds} timerEnabled={turnTimerEnabled} impactLane={impactLane} presentationScores={presentationScores} stagedRival={stagedRival} stagedPlayer={stagedPlayer} activeEffectId={activeEffectId} activeEffectLane={activeEffectLane} activeEffect={activeEffect} squabbleCinematicLane={squabbleCinematicLane} squabble={squabble} setSquabble={setSquabble} setInspect={setInspect} archiveMatch={() => { if (match) void finishMatchSession(match); }} onShowRules={() => setShowRules(true)} onExit={onExit} feedbackPreferences={feedbackPreferences} setFeedbackPreferences={setFeedbackPreferences} decisionStartedAt={decisionStartedAtRef.current} onFeedback={(cue: 'select' | 'lock') => feedback.current.cue(cue, isReducedMotionRequested(window.matchMedia('(prefers-reduced-motion: reduce)').matches, document.documentElement.dataset.reduceMotion === 'true'))} equippedVariants={equippedVariants} authoritativeHistory={match?.effectLog} replay={replay} onReplayStep={showReplayFrame} onExitReplay={exitReplay} /></LayoutGroup>}
    <AnimatePresence>{inspect && <CardInspector card={inspect} variantId={getEquippedVariant(equippedVariants, inspect.id)} onClose={() => setInspect(null)} match={visualMatch ?? match} />}{showRules && <RulesModal onClose={() => setShowRules(false)} />}{screen === 'result' && match && <ResultScreen onRestart={handleRestart} onChangeDeck={() => hideLobby ? onExit() : setScreen('lobby')} onGoHome={onExit} onTutorialComplete={mode === 'tutorial' ? onTutorialComplete : undefined} match={match} districts={districts} deckId={deckId} rivalDeck={rivalDeck} reward={serverReward} rewardError={serverRewardError} rewardPending={completePlayerMatch.isPending} onRetryReward={() => void finishMatchSession(match)} isGuest={isUnsavedTraining} customPlayerDeck={customPlayerDeck} storyMetadata={storyMetadata} equippedVariants={equippedVariants} />}</AnimatePresence>
  </div>;
}
/*
export function PlayLoop({ mode = 'practice', onExit, initialDeckId = 'block', initialRivalId = 'combo', hideLobby = false, turnTimerEnabled = true, customPlayerDeck, availableDeckIds, storyNodeId, equippedVariants }: { mode?: 'guest' | 'practice' | 'tutorial' | 'story'; onExit: () => void; initialDeckId?: string; initialRivalId?: string; hideLobby?: boolean; turnTimerEnabled?: boolean; customPlayerDeck?: Deck; availableDeckIds?: string[]; storyNodeId?: string; equippedVariants?: EquippedVariantMap }) {
  const [screen, setScreen] = useState<'lobby' | 'battle' | 'result'>(hideLobby ? 'battle' : 'lobby');
  const [deckId, setDeckId] = useState(availableDeckIds?.includes(initialDeckId) ? initialDeckId : availableDeckIds?.[0] ?? initialDeckId);
  const [rival, setRival] = useState(initialRivalId);
  const [match, setMatch] = useState<Match | null>(null), [visualMatch, setVisualMatch] = useState<Match | null>(null);
  const visualMatchRef = useRef<Match | null>(null);
  const [presentationScores, setPresentationScores] = useState<ScoreState[] | null>(null);
  const [serverMatchId, setServerMatchId] = useState<string | null>(null), [serverReward, setServerReward] = useState<MatchReward | null>(null), [serverRewardError, setServerRewardError] = useState(false);
  const [storyMetadata, setStoryMetadata] = useState<StoryMatchMetadata | null>(null), [startError, setStartError] = useState<string | null>(null);
  const startPlayerMatch = useStartPlayerMatch(), completePlayerMatch = useCompletePlayerMatch(), queryClient = useQueryClient();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null), [selectedLane, setSelectedLane] = useState<number | null>(null), [squabble, setSquabble] = useState(false);
  const timeline = useRef(new PresentationTimeline()), autoStartRef = useRef(false), playerMovesRef = useRef<MatchMove[]>([]), locked = useRef(false), fastForwardRef = useRef(false);
  const decisionStartedAtRef = useRef(Date.now());
  const districtOwnersRef = useRef<DistrictOwner[]>(['draw', 'draw', 'draw']);
  const [presentationPhase, setPresentationPhase] = useState<PresentationPhase>('versus'), [phaseMessage, setPhaseMessage] = useState('');
  const [impactLane, setImpactLane] = useState<Lane | null>(null), [timerSeconds, setTimerSeconds] = useState(20), [tabHidden, setTabHidden] = useState(document.hidden);
  const [stagedRival, setStagedRival] = useState<CardInstance | null>(null), [stagedPlayer, setStagedPlayer] = useState<CardInstance | null>(null);
  const [activeEffectId, setActiveEffectId] = useState<string | null>(null), [activeEffectLane, setActiveEffectLane] = useState<Lane | null>(null), [activeEffect, setActiveEffect] = useState<PresentationEffect | null>(null);
  const [squabbleCinematicLane, setSquabbleCinematicLane] = useState<Lane | null>(null);
  const [replay, setReplay] = useState<{ event: EffectLogEntry; step: 'before' | 'after' } | null>(null);
  const replayLiveFrame = useRef<Match | null>(null);
  const replayLiveTimer = useRef<number | null>(null);
  const [showRules, setShowRules] = useState(false), [inspect, setInspect] = useState<CardInstance | Card | null>(null);
  const [encounterCinematic, setEncounterCinematic] = useState<{ source: string, poster: string, title: string, eyebrow: string } | null>(null);
  const [feedbackPreferences, setFeedbackPreferences] = useState<FeedbackPreferences>(loadFeedbackPreferences);
  const feedback = useRef(new BattleFeedback(feedbackPreferences));

  const deck = customPlayerDeck || decks.find(d => d.id === deckId) || decks[0];
  const rivalDeck: Deck = match?.storyEncounter ? { id: match.storyEncounter.enemy.deckId, name: match.storyEncounter.enemy.name, archetype: match.storyEncounter.enemy.behaviorProfile, accent: 'STORY', plan: 'A server-issued story encounter.', cards: [...match.storyEncounter.enemy.cardIds], hero: cards[match.storyEncounter.enemy.cardIds[0]]?.id ?? decks[0].hero } : decks.find(d => d.id === rival) || decks[0];
  const cancelTimers = useCallback(() => { feedback.current.reset(); timeline.current.cancelAll(); }, []);
  const wait = useCallback((ms: number, id: number) => timeline.current.wait(ms, id), []);
  const waitForBeat = useCallback((normalMs: number, reducedMs: number, id: number, fast = false) =>
    wait(broadcastDelay(normalMs, reducedMs, isReducedMotionRequested(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      document.documentElement.dataset.reduceMotion === 'true',
    ), fast || fastForwardRef.current), id), [wait]);
  const setVisualFrame = useCallback((next: Match | null) => { visualMatchRef.current = next; setVisualMatch(next); }, []);
  const resetPresentation = useCallback(() => { setSelectedInstanceId(null); setSelectedLane(null); setSquabble(false); setShowRules(false); setInspect(null); setStagedRival(null); setStagedPlayer(null); setActiveEffectId(null); setActiveEffectLane(null); setActiveEffect(null); setPresentationScores(null); setReplay(null); replayLiveFrame.current = null; replayLiveTimer.current = null; }, []);
  useEffect(() => {
    return () => {
      cancelTimers();
    };
  }, [cancelTimers]);
  useEffect(() => { const onVisibility = () => setTabHidden(document.hidden); document.addEventListener('visibilitychange', onVisibility); return () => document.removeEventListener('visibilitychange', onVisibility); }, []);
  useEffect(() => {
    feedback.current.setPreferences(feedbackPreferences);
    saveFeedbackPreferences(feedbackPreferences);
  }, [feedbackPreferences]);

  const enterPlayerTurn = useCallback(async (round: number, immediate = false) => { const id = timeline.current.id; setPresentationPhase('round-intro'); setPhaseMessage(`ROUND ${round}`); if (!immediate && !await waitForBeat(650, 90, id)) return; decisionStartedAtRef.current = Date.now(); setPresentationPhase('player-ready'); setPhaseMessage(`ROUND ${round} // YOUR MOVE`); setTimerSeconds(20); locked.current = false; fastForwardRef.current = false; }, [waitForBeat]);
  const runIntro = useCallback(async () => { cancelTimers(); const id = timeline.current.id; const beats: Array<[PresentationPhase, string, number]> = [['versus', 'YOU  VS  RIVAL', 850], ['countdown-3', '3', 550], ['countdown-2', '2', 550], ['countdown-1', '1', 550], ['squabble', 'SQUABBLE!', 700], ['deal', 'CREW UP', 650]]; for (const [phase, message, duration] of beats) { setPresentationPhase(phase); setPhaseMessage(message); if (!await waitForBeat(duration, 90, id)) return; } void enterPlayerTurn(1); }, [cancelTimers, enterPlayerTurn, waitForBeat]);
  const beginMatch = useCallback((initial: Match) => {
    cancelTimers(); setServerReward(null); setServerRewardError(false); setStoryMetadata(null); playerMovesRef.current = []; districtOwnersRef.current = getDistrictResults(initial).map(result => result.winner); setMatch(initial); setVisualFrame(initial); resetPresentation(); setScreen('battle'); locked.current = true;
    if (initial.storyEncounter?.cinematic) {
      const skipRepeatedOpening =
        initial.storyEncounter.id === 'welcome-to-the-block' &&
        sessionStorage.getItem('block_party_opening_seen') === 'true';
      if (skipRepeatedOpening) {
        void runIntro();
        return;
      }
      setEncounterCinematic({
        source: initial.storyEncounter.cinematic.videoAssetId,
        poster: initial.storyEncounter.cinematic.posterAssetId,
        title: initial.storyEncounter.enemy.name,
        eyebrow: "Target",
      });
    } else {
      void runIntro();
    }
  }, [cancelTimers, resetPresentation, runIntro, setVisualFrame]);

  const handleCinematicDone = useCallback(() => {
    setEncounterCinematic(null);
    void runIntro();
  }, [runIntro]);

  const startLocalMatch = useCallback(() => beginMatch(customPlayerDeck ? createMatchFromCatalog(customPlayerDeck.id, customPlayerDeck.cards, rival) : createMatch(deckId, rival)), [beginMatch, customPlayerDeck, deckId, rival]);
  const start = useCallback(async () => {
    setServerMatchId(null); setStartError(null);
    if (mode !== 'guest' && !customPlayerDeck) try {
      const res = await startPlayerMatch.mutateAsync({ data: { mode: mode === 'tutorial' ? 'tutorial' : mode === 'story' ? 'story' : 'practice', playerDeckId: deckId, rivalDeckId: rival, storyNodeId } });
      setServerMatchId(res.id);
      if (mode === 'story') { if (!res.encounterSnapshot) throw new Error('The server did not issue a story encounter.'); beginMatch(createStoryMatch(res.encounterSnapshot as unknown as StoryEncounterSnapshot, deckId)); return; }
    } catch (error) {
      if (mode === 'story') { setServerMatchId(null); setStartError(error instanceof Error ? error.message : 'The encounter could not be started.'); return; }
      if (!window.confirm('Failed to reach server. Play local practice match with no rewards?')) return;
    }
    if (mode !== 'story') startLocalMatch();
  }, [beginMatch, customPlayerDeck, deckId, mode, rival, startLocalMatch, startPlayerMatch, storyNodeId]);
  useEffect(() => { if (hideLobby && !match && !autoStartRef.current) { autoStartRef.current = true; void start(); } }, [hideLobby, match, start]);

  const finishMatchSession = useCallback(async (_finalMatch: Match) => {
    if (mode !== 'guest' && serverMatchId) try {
      const res = await completePlayerMatch.mutateAsync({ matchId: serverMatchId, data: { moves: playerMovesRef.current } });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), (old: any) => old ? { ...old, profile: res.profile, missions: res.missions, nextAction: res.nextAction } : old);
      if (res.campaign) queryClient.setQueryData(getGetPlayerStoryQueryKey(), res.campaign);
      else if (mode === 'story') void queryClient.invalidateQueries({ queryKey: getGetPlayerStoryQueryKey() });
      setServerReward(res.reward); setStoryMetadata(res.story); setServerRewardError(false);
    } catch { setServerRewardError(true); }
    else if (mode === 'guest') localStorage.setItem('squabblemon_guest_tutorial_complete', 'true');
    setScreen('result');
  }, [completePlayerMatch, mode, queryClient, serverMatchId]);
  const presentEvents = useCallback(async (resolved: Match, fromSequence: number, id: number, fast = false) => {
    let frame = visualMatchRef.current ?? resolved;
    for (const effect of resolved.effectLog.filter(e => e.sequence >= fromSequence).sort((a, b) => a.sequence - b.sequence)) {
      const sourceId = effect.source?.cardInstanceId ?? effect.cardInstanceId, targetIds = effect.targets.map(t => t.cardInstanceId);
      const lane = effect.source?.after?.lane ?? effect.source?.before?.lane ?? effect.targets[0]?.after?.lane ?? effect.targets[0]?.before?.lane ?? effect.lane;
      const isPlay = effect.type === 'play', phase: PresentationPhase = isPlay ? effect.owner === 'player' ? 'player-travel' : 'rival-travel' : effect.type === 'reveal' ? effect.owner === 'player' ? 'player-reveal' : 'rival-reveal' : effect.type === 'pass' ? effect.owner === 'player' ? 'player-pass' : 'rival-pass' : 'effects';
      const staged = isPlay ? cardById(resolved, sourceId) ?? cardById(frame, sourceId) ?? null : null;
      if (effect.owner === 'player') setStagedPlayer(staged); else setStagedRival(staged);
      frame = applyEventState(frame, resolved, effect, 'before'); setVisualFrame(frame); setPresentationScores(effect.scores.before); setPresentationPhase(phase); setActiveEffectId(effect.source ? sourceId : null); setActiveEffectLane(lane); setImpactLane(lane); setActiveEffect({ ...effect, cardInstanceId: sourceId, lane, targetIds, durationLabel: effect.duration ? `Through round ${effect.duration.expiresAtRound - 1}` : undefined }); setPhaseMessage(effect.note);
      if (!fast && !fastForwardRef.current) {
        feedback.current.emit(effect, id, isReducedMotionRequested(
          window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          document.documentElement.dataset.reduceMotion === 'true',
        ));
      }
      if (!await waitForBeat(190, 70, id, fast)) return false;
      if (isPlay) {
        setPresentationPhase(effect.owner === 'player' ? 'player-reveal' : 'rival-reveal');
        if (!await waitForBeat(160, 40, id, fast)) return false;
      }
      frame = applyEventState(frame, resolved, effect, 'after'); setVisualFrame(frame); setPresentationScores(effect.scores.after); setPresentationPhase(isPlay ? effect.owner === 'player' ? 'player-impact' : 'rival-impact' : phase);
      if (!await waitForBeat(specialMoveForEvent(effect, readMoveOverrides())?.durationMs ?? 380, 90, id, fast)) return false;
      setStagedPlayer(null); setStagedRival(null);
    }
    setActiveEffectId(null); setActiveEffectLane(null); setActiveEffect(null); setImpactLane(null); return true;
  }, [setVisualFrame, waitForBeat]);
  const advanceRoundBoundary = useCallback(async (resolved: Match, id: number, fast = false) => { const next = nextRound(resolved); setMatch(next); if (!await presentEvents(next, resolved.nextEventSequence, id, fast)) return; if (next.phase === 'complete') { setPresentationPhase('match-finish'); setPhaseMessage('FINAL DISTRICTS'); if (!await waitForBeat(900, 120, id, fast)) return; void finishMatchSession(next); return; } setPresentationScores(null); void enterPlayerTurn(next.round, fast); }, [enterPlayerTurn, finishMatchSession, presentEvents, waitForBeat]);
  const finishRound = useCallback(async (resolved: Match, id: number) => {
    const owners = getDistrictResults(resolved).map(result => result.winner);
    const changedLanes = changedDistrictControl(districtOwnersRef.current, owners);
    districtOwnersRef.current = owners;
    if (changedLanes.length > 0) {
      setPresentationPhase('district-flipped');
      setPhaseMessage(`${changedLanes.length === 1 ? districts[changedLanes[0]].name : `${changedLanes.length} DISTRICTS`} FLIPPED`);
      if (!await waitForBeat(450, 80, id)) return;
    }
    setPresentationPhase('round-result'); setPhaseMessage(`ROUND ${resolved.round} COMPLETE`);
    if (await waitForBeat(changedLanes.length > 0 ? 750 : 1200, 120, id)) await advanceRoundBoundary(resolved, id, fastForwardRef.current);
  }, [advanceRoundBoundary, waitForBeat]);
  const runRival = useCallback(async (afterPlayer: Match, id: number) => { setPresentationPhase('rival-thinking'); setPhaseMessage('RIVAL THINKING'); if (!await waitForBeat(700, 90, id)) return; const choice = chooseCpuPlay(afterPlayer); const resolved = choice ? playCard(afterPlayer, 'cpu', choice.instanceId, choice.lane) : pass(afterPlayer, 'cpu'); setMatch(resolved); if (await presentEvents(resolved, afterPlayer.nextEventSequence, id, fastForwardRef.current)) await finishRound(resolved, id); }, [finishRound, presentEvents, waitForBeat]);
  const commit = useCallback(async (autoPass = false) => { if (!match || match.phase !== 'player' || presentationPhase !== 'player-ready' || locked.current || (!autoPass && selectedInstanceId && selectedLane === null)) return; locked.current = true; cancelTimers(); const id = timeline.current.id; let next: Match; try { const isLockIn = !!selectedInstanceId && !autoPass; next = isLockIn ? playCard(match, 'player', selectedInstanceId, selectedLane as Lane, squabble) : pass(match, 'player'); playerMovesRef.current.push(isLockIn ? { cardInstanceId: selectedInstanceId, lane: selectedLane as Lane, squabble } : { cardInstanceId: null, lane: null, squabble: false }); trackBattleTurnCommitted(match, isLockIn ? 'lock_in' : 'pass', autoPass, isLockIn && squabble, decisionStartedAtRef.current, isLockIn ? selectedLane as Lane : null); setMatch(next); if (isLockIn) { setPresentationPhase('lock-in'); setPhaseMessage('LOCK IN'); if (!await waitForBeat(260, 70, id)) return; } if (!await presentEvents(next, match.nextEventSequence, id)) return; } catch { setStagedPlayer(null); setImpactLane(null); locked.current = false; return; } setSquabble(false); setSelectedInstanceId(null); setSelectedLane(null); await runRival(next, id); }, [cancelTimers, match, presentationPhase, presentEvents, runRival, selectedInstanceId, selectedLane, squabble, waitForBeat]);
  const showReplayFrame = useCallback((event: EffectLogEntry, step: 'before' | 'after') => {
    if (!match || presentationPhase !== 'player-ready') return;
    if (!replayLiveFrame.current) {
      replayLiveFrame.current = visualMatchRef.current;
      replayLiveTimer.current = timerSeconds;
    }
    const live = replayLiveFrame.current;
    if (!live) return;
    cancelTimers();
    const sourceId = event.source?.cardInstanceId ?? event.cardInstanceId;
    const lane = event.source?.after?.lane ?? event.source?.before?.lane ?? event.targets[0]?.after?.lane ?? event.targets[0]?.before?.lane ?? event.lane;
    setVisualFrame(buildReplayFrame(live, event, step));
    setPresentationScores(event.scores[step]);
    setActiveEffectId(event.source ? sourceId : null);
    setActiveEffectLane(lane);
    setImpactLane(lane);
    setActiveEffect({ ...event, cardInstanceId: sourceId, lane, targetIds: event.targets.map(target => target.cardInstanceId), durationLabel: event.duration ? `Through round ${event.duration.expiresAtRound - 1}` : undefined });
    setPhaseMessage(event.note);
    setReplay({ event, step });
  }, [cancelTimers, match, presentationPhase, setVisualFrame, timerSeconds]);
  const exitReplay = useCallback(() => {
    if (replayLiveFrame.current) setVisualFrame(replayLiveFrame.current);
    replayLiveFrame.current = null;
    if (replayLiveTimer.current !== null) setTimerSeconds(replayLiveTimer.current);
    replayLiveTimer.current = null;
    setReplay(null);
    setPresentationScores(null);
    setActiveEffectId(null);
    setActiveEffectLane(null);
    setActiveEffect(null);
    setImpactLane(null);
    if (match) {
      setPhaseMessage(`ROUND ${match.round} // YOUR MOVE`);
      locked.current = false;
    }
  }, [match, setVisualFrame]);
  useEffect(() => { if (!turnTimerEnabled || screen !== 'battle' || presentationPhase !== 'player-ready' || replay || showRules || inspect || tabHidden) return; const interval = setInterval(() => setTimerSeconds(v => Math.max(0, v - 1)), 1000); return () => clearInterval(interval); }, [inspect, presentationPhase, replay, screen, showRules, tabHidden, turnTimerEnabled]);
  useEffect(() => { if (timerSeconds === 0 && presentationPhase === 'player-ready' && !replay && match) void commit(!(selectedInstanceId !== null && selectedLane !== null && canAffordSelection(match, 'player', selectedInstanceId, selectedLane as Lane))); }, [commit, match, presentationPhase, replay, selectedInstanceId, selectedLane, timerSeconds]);
  const skipSequence = () => {
    if (!match) return;
    if (['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro'].includes(presentationPhase)) {
      trackBattleFastForwarded(match, presentationPhase);
      cancelTimers(); void enterPlayerTurn(match.round, true);
    } else if (presentationPhase === 'round-result') {
      trackBattleFastForwarded(match, presentationPhase);
      cancelTimers(); void advanceRoundBoundary(match, timeline.current.id, true);
    } else if (presentationPhase !== 'player-ready' && presentationPhase !== 'match-finish') {
      trackBattleFastForwarded(match, presentationPhase);
      fastForwardRef.current = true;
      timeline.current.completeAll();
    }
  };
  const handleRestart = () => { autoStartRef.current = false; setStartError(null); setMatch(null); setVisualFrame(null); setScreen(hideLobby ? 'battle' : 'lobby'); };
  return <div className="h-[100dvh] bg-black text-white font-sans flex flex-col relative overflow-hidden game-bg"><div className="noise-overlay" />
    {startError && !match && <div className="relative z-20 grid h-full place-items-center p-6 text-center"><div className="max-w-sm border border-accent/40 bg-zinc-950 p-6"><div className="font-mono text-[9px] uppercase tracking-[.22em] text-accent">Encounter unavailable</div><h1 className="mt-2 font-display text-3xl font-black italic uppercase">Could not start the story battle</h1><p role="alert" className="mt-3 text-sm text-white/55">{startError}</p><div className="mt-6 flex gap-2"><button type="button" onClick={onExit} className="flex-1 border border-white/20 px-4 py-3 hover:bg-white/5">Back</button><button type="button" onClick={() => void start()} disabled={startPlayerMatch.isPending} className="flex-1 bg-primary px-4 py-3 text-black hover:bg-yellow-400">{startPlayerMatch.isPending ? 'Retrying' : 'Retry'}</button></div></div></div>}
    {screen === 'lobby' && !hideLobby && <Lobby onStart={start} deckId={deckId} setDeckId={setDeckId} rival={rival} setRival={setRival} availableDeckIds={availableDeckIds} onShowRules={() => setShowRules(true)} onInspect={setInspect} isLoading={startPlayerMatch.isPending} onExit={onExit} equippedVariants={equippedVariants} />}
    {encounterCinematic && (
      <StoryCinematic
        source={encounterCinematic.source}
        poster={encounterCinematic.poster}
        title={encounterCinematic.title}
        eyebrow={encounterCinematic.eyebrow}
        onComplete={handleCinematicDone}
        onSkip={handleCinematicDone}
        duration={5200}
      />
    )}
    {screen === 'battle' && visualMatch && <LayoutGroup><Battle match={visualMatch} authoritativeHistory={match?.effectLog} deck={deck} rivalDeck={rivalDeck} selectedInstanceId={selectedInstanceId} setSelectedInstanceId={setSelectedInstanceId} selectedLane={selectedLane} setSelectedLane={setSelectedLane} commit={() => void commit()} skipSequence={skipSequence} presentationPhase={presentationPhase} phaseMessage={phaseMessage} timerSeconds={timerSeconds} timerEnabled={turnTimerEnabled} impactLane={impactLane} presentationScores={presentationScores} stagedRival={stagedRival} stagedPlayer={stagedPlayer} activeEffectId={activeEffectId} activeEffectLane={activeEffectLane} activeEffect={activeEffect} squabbleCinematicLane={squabbleCinematicLane} squabble={squabble} setSquabble={setSquabble} setInspect={setInspect} archiveMatch={() => { if (match) void finishMatchSession(match); }} onShowRules={() => setShowRules(true)} feedbackPreferences={feedbackPreferences} setFeedbackPreferences={setFeedbackPreferences} decisionStartedAt={decisionStartedAtRef.current} equippedVariants={equippedVariants} replay={replay} onReplayStep={showReplayFrame} onExitReplay={exitReplay} /></LayoutGroup>}
    <AnimatePresence>{inspect && <CardInspector card={inspect} variantId={getEquippedVariant(equippedVariants, inspect.id)} onClose={() => setInspect(null)} match={match} />}{showRules && <RulesModal onClose={() => setShowRules(false)} />}{screen === 'result' && match && <ResultScreen onRestart={handleRestart} onChangeDeck={() => hideLobby ? onExit() : setScreen('lobby')} onGoHome={onExit} match={match} districts={districts} deckId={deckId} rivalDeck={rivalDeck} reward={serverReward} rewardError={serverRewardError} rewardPending={completePlayerMatch.isPending} onRetryReward={() => void finishMatchSession(match)} isGuest={mode === 'guest' || !!customPlayerDeck} customPlayerDeck={customPlayerDeck} storyMetadata={storyMetadata} equippedVariants={equippedVariants} />}</AnimatePresence>
  </div>;
}
/*
export function PlayLoop({ mode = 'practice', onExit, initialDeckId = 'block', initialRivalId = 'combo', hideLobby = false, turnTimerEnabled = true, customPlayerDeck, availableDeckIds, storyNodeId, equippedVariants }: { mode?: 'guest' | 'practice' | 'tutorial' | 'story'; onExit: () => void; initialDeckId?: string; initialRivalId?: string; hideLobby?: boolean; turnTimerEnabled?: boolean; customPlayerDeck?: Deck; availableDeckIds?: string[]; storyNodeId?: string; equippedVariants?: EquippedVariantMap }) {
  const [screen, setScreen] = useState<'lobby' | 'battle' | 'result'>(hideLobby ? 'battle' : 'lobby');
  const [deckId, setDeckId] = useState(availableDeckIds?.includes(initialDeckId) ? initialDeckId : availableDeckIds?.[0] ?? initialDeckId);
  const [rival, setRival] = useState(initialRivalId);
  const [match, setMatch] = useState<Match | null>(null), [visualMatch, setVisualMatch] = useState<Match | null>(null);
  const visualMatchRef = useRef<Match | null>(null);
  const [presentationScores, setPresentationScores] = useState<ScoreState[] | null>(null);
  const [serverMatchId, setServerMatchId] = useState<string | null>(null), [serverReward, setServerReward] = useState<MatchReward | null>(null), [serverRewardError, setServerRewardError] = useState(false);
  const [storyMetadata, setStoryMetadata] = useState<StoryMatchMetadata | null>(null), [startError, setStartError] = useState<string | null>(null);
  const startPlayerMatch = useStartPlayerMatch(), completePlayerMatch = useCompletePlayerMatch(), queryClient = useQueryClient();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null), [selectedLane, setSelectedLane] = useState<number | null>(null), [squabble, setSquabble] = useState(false);
  const timeline = useRef(new PresentationTimeline()), autoStartRef = useRef(false), playerMovesRef = useRef<MatchMove[]>([]), locked = useRef(false), fastForwardRef = useRef(false);
  const decisionStartedAtRef = useRef(Date.now());
  const districtOwnersRef = useRef<DistrictOwner[]>(['draw', 'draw', 'draw']);
  const [presentationPhase, setPresentationPhase] = useState<PresentationPhase>('versus'), [phaseMessage, setPhaseMessage] = useState('');
  const [impactLane, setImpactLane] = useState<Lane | null>(null), [timerSeconds, setTimerSeconds] = useState(20), [tabHidden, setTabHidden] = useState(document.hidden);
  const [stagedRival, setStagedRival] = useState<CardInstance | null>(null), [stagedPlayer, setStagedPlayer] = useState<CardInstance | null>(null);
  const [activeEffectId, setActiveEffectId] = useState<string | null>(null), [activeEffectLane, setActiveEffectLane] = useState<Lane | null>(null), [activeEffect, setActiveEffect] = useState<PresentationEffect | null>(null);
  const [squabbleCinematicLane, setSquabbleCinematicLane] = useState<Lane | null>(null);
  const [replay, setReplay] = useState<{ event: EffectLogEntry; step: 'before' | 'after' } | null>(null);
  const replayLiveFrame = useRef<Match | null>(null);
  const replayLiveTimer = useRef<number | null>(null);
  const [showRules, setShowRules] = useState(false), [inspect, setInspect] = useState<CardInstance | Card | null>(null);
  const [encounterCinematic, setEncounterCinematic] = useState<{ source: string, poster: string, title: string, eyebrow: string } | null>(null);
  const [feedbackPreferences, setFeedbackPreferences] = useState<FeedbackPreferences>(loadFeedbackPreferences);
  const feedback = useRef(new BattleFeedback(feedbackPreferences));

  const deck = customPlayerDeck || decks.find(d => d.id === deckId) || decks[0];
  const rivalDeck: Deck = match?.storyEncounter ? { id: match.storyEncounter.enemy.deckId, name: match.storyEncounter.enemy.name, archetype: match.storyEncounter.enemy.behaviorProfile, accent: 'STORY', plan: 'A server-issued story encounter.', cards: [...match.storyEncounter.enemy.cardIds], hero: cards[match.storyEncounter.enemy.cardIds[0]]?.id ?? decks[0].hero } : decks.find(d => d.id === rival) || decks[0];
  const cancelTimers = useCallback(() => { feedback.current.reset(); timeline.current.cancelAll(); }, []);
  const wait = useCallback((ms: number, id: number) => timeline.current.wait(ms, id), []);
  const waitForBeat = useCallback((normalMs: number, reducedMs: number, id: number, fast = false) =>
    wait(broadcastDelay(normalMs, reducedMs, isReducedMotionRequested(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      document.documentElement.dataset.reduceMotion === 'true',
    ), fast || fastForwardRef.current), id), [wait]);
  const setVisualFrame = useCallback((next: Match | null) => { visualMatchRef.current = next; setVisualMatch(next); }, []);
  const resetPresentation = useCallback(() => { setSelectedInstanceId(null); setSelectedLane(null); setSquabble(false); setShowRules(false); setInspect(null); setStagedRival(null); setStagedPlayer(null); setActiveEffectId(null); setActiveEffectLane(null); setActiveEffect(null); setPresentationScores(null); setReplay(null); replayLiveFrame.current = null; replayLiveTimer.current = null; }, []);
  useEffect(() => {
    return () => {
      cancelTimers();
    };
  }, [cancelTimers]);
  useEffect(() => { const onVisibility = () => setTabHidden(document.hidden); document.addEventListener('visibilitychange', onVisibility); return () => document.removeEventListener('visibilitychange', onVisibility); }, []);
  useEffect(() => {
    feedback.current.setPreferences(feedbackPreferences);
    saveFeedbackPreferences(feedbackPreferences);
  }, [feedbackPreferences]);

  const enterPlayerTurn = useCallback(async (round: number, immediate = false) => { const id = timeline.current.id; setPresentationPhase('round-intro'); setPhaseMessage(`ROUND ${round}`); if (!immediate && !await waitForBeat(650, 90, id)) return; decisionStartedAtRef.current = Date.now(); setPresentationPhase('player-ready'); setPhaseMessage(`ROUND ${round} // YOUR MOVE`); setTimerSeconds(20); locked.current = false; fastForwardRef.current = false; }, [waitForBeat]);
  const runIntro = useCallback(async () => { cancelTimers(); const id = timeline.current.id; const beats: Array<[PresentationPhase, string, number]> = [['versus', 'YOU  VS  RIVAL', 850], ['countdown-3', '3', 550], ['countdown-2', '2', 550], ['countdown-1', '1', 550], ['squabble', 'SQUABBLE!', 700], ['deal', 'CREW UP', 650]]; for (const [phase, message, duration] of beats) { setPresentationPhase(phase); setPhaseMessage(message); if (!await waitForBeat(duration, 90, id)) return; } void enterPlayerTurn(1); }, [cancelTimers, enterPlayerTurn, waitForBeat]);
  const beginMatch = useCallback((initial: Match) => {
    cancelTimers(); setServerReward(null); setServerRewardError(false); setStoryMetadata(null); playerMovesRef.current = []; districtOwnersRef.current = getDistrictResults(initial).map(result => result.winner); setMatch(initial); setVisualFrame(initial); resetPresentation(); setScreen('battle'); locked.current = true;
    if (initial.storyEncounter?.cinematic) {
      const skipRepeatedOpening =
        initial.storyEncounter.id === 'welcome-to-the-block' &&
        sessionStorage.getItem('block_party_opening_seen') === 'true';
      if (skipRepeatedOpening) {
        void runIntro();
        return;
      }
      setEncounterCinematic({
        source: initial.storyEncounter.cinematic.videoAssetId,
        poster: initial.storyEncounter.cinematic.posterAssetId,
        title: initial.storyEncounter.enemy.name,
        eyebrow: "Target",
      });
    } else {
      void runIntro();
    }
  }, [cancelTimers, resetPresentation, runIntro, setVisualFrame]);

  const handleCinematicDone = useCallback(() => {
    setEncounterCinematic(null);
    void runIntro();
  }, [runIntro]);

  const startLocalMatch = useCallback(() => beginMatch(customPlayerDeck ? createMatchFromCatalog(customPlayerDeck.id, customPlayerDeck.cards, rival) : createMatch(deckId, rival)), [beginMatch, customPlayerDeck, deckId, rival]);
  const start = useCallback(async () => {
    setServerMatchId(null); setStartError(null);
    if (mode !== 'guest' && !customPlayerDeck) try {
      const res = await startPlayerMatch.mutateAsync({ data: { mode: mode === 'tutorial' ? 'tutorial' : mode === 'story' ? 'story' : 'practice', playerDeckId: deckId, rivalDeckId: rival, storyNodeId } });
      setServerMatchId(res.id);
      if (mode === 'story') { if (!res.encounterSnapshot) throw new Error('The server did not issue a story encounter.'); beginMatch(createStoryMatch(res.encounterSnapshot as unknown as StoryEncounterSnapshot, deckId)); return; }
    } catch (error) {
      if (mode === 'story') { setServerMatchId(null); setStartError(error instanceof Error ? error.message : 'The encounter could not be started.'); return; }
      if (!window.confirm('Failed to reach server. Play local practice match with no rewards?')) return;
    }
    if (mode !== 'story') startLocalMatch();
  }, [beginMatch, customPlayerDeck, deckId, mode, rival, startLocalMatch, startPlayerMatch, storyNodeId]);
  useEffect(() => { if (hideLobby && !match && !autoStartRef.current) { autoStartRef.current = true; void start(); } }, [hideLobby, match, start]);

  const finishMatchSession = useCallback(async (_finalMatch: Match) => {
    if (mode !== 'guest' && serverMatchId) try {
      const res = await completePlayerMatch.mutateAsync({ matchId: serverMatchId, data: { moves: playerMovesRef.current } });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), (old: any) => old ? { ...old, profile: res.profile, missions: res.missions, nextAction: res.nextAction } : old);
      if (res.campaign) queryClient.setQueryData(getGetPlayerStoryQueryKey(), res.campaign);
      else if (mode === 'story') void queryClient.invalidateQueries({ queryKey: getGetPlayerStoryQueryKey() });
      setServerReward(res.reward); setStoryMetadata(res.story); setServerRewardError(false);
    } catch { setServerRewardError(true); }
    else if (mode === 'guest') localStorage.setItem('squabblemon_guest_tutorial_complete', 'true');
    setScreen('result');
  }, [completePlayerMatch, mode, queryClient, serverMatchId]);
  const presentEvents = useCallback(async (resolved: Match, fromSequence: number, id: number, fast = false) => {
    let frame = visualMatchRef.current ?? resolved;
    for (const effect of resolved.effectLog.filter(e => e.sequence >= fromSequence).sort((a, b) => a.sequence - b.sequence)) {
      const sourceId = effect.source?.cardInstanceId ?? effect.cardInstanceId, targetIds = effect.targets.map(t => t.cardInstanceId);
      const lane = effect.source?.after?.lane ?? effect.source?.before?.lane ?? effect.targets[0]?.after?.lane ?? effect.targets[0]?.before?.lane ?? effect.lane;
      const isPlay = effect.type === 'play', phase: PresentationPhase = isPlay ? effect.owner === 'player' ? 'player-travel' : 'rival-travel' : effect.type === 'reveal' ? effect.owner === 'player' ? 'player-reveal' : 'rival-reveal' : effect.type === 'pass' ? effect.owner === 'player' ? 'player-pass' : 'rival-pass' : 'effects';
      const staged = isPlay ? cardById(resolved, sourceId) ?? cardById(frame, sourceId) ?? null : null;
      if (effect.owner === 'player') setStagedPlayer(staged); else setStagedRival(staged);
      frame = applyEventState(frame, resolved, effect, 'before'); setVisualFrame(frame); setPresentationScores(effect.scores.before); setPresentationPhase(phase); setActiveEffectId(effect.source ? sourceId : null); setActiveEffectLane(lane); setImpactLane(lane); setActiveEffect({ ...effect, cardInstanceId: sourceId, lane, targetIds, durationLabel: effect.duration ? `Through round ${effect.duration.expiresAtRound - 1}` : undefined }); setPhaseMessage(effect.note);
      if (!fast && !fastForwardRef.current) {
        feedback.current.emit(effect, id, isReducedMotionRequested(
          window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          document.documentElement.dataset.reduceMotion === 'true',
        ));
      }
      if (!await waitForBeat(190, 70, id, fast)) return false;
      frame = applyEventState(frame, resolved, effect, 'after'); setVisualFrame(frame); setPresentationScores(effect.scores.after); setPresentationPhase(isPlay ? effect.owner === 'player' ? 'player-impact' : 'rival-impact' : phase);
      if (!await waitForBeat(specialMoveForEvent(effect, readMoveOverrides())?.durationMs ?? 380, 90, id, fast)) return false;
      setStagedPlayer(null); setStagedRival(null);
    }
    setActiveEffectId(null); setActiveEffectLane(null); setActiveEffect(null); setImpactLane(null); return true;
  }, [setVisualFrame, waitForBeat]);
  const advanceRoundBoundary = useCallback(async (resolved: Match, id: number, fast = false) => { const next = nextRound(resolved); setMatch(next); if (!await presentEvents(next, resolved.nextEventSequence, id, fast)) return; if (next.phase === 'complete') { setPresentationPhase('match-finish'); setPhaseMessage('FINAL DISTRICTS'); if (!await waitForBeat(900, 120, id, fast)) return; void finishMatchSession(next); return; } setPresentationScores(null); void enterPlayerTurn(next.round, fast); }, [enterPlayerTurn, finishMatchSession, presentEvents, waitForBeat]);
  const finishRound = useCallback(async (resolved: Match, id: number) => {
    const owners = getDistrictResults(resolved).map(result => result.winner);
    const changedLanes = changedDistrictControl(districtOwnersRef.current, owners);
    districtOwnersRef.current = owners;
    if (changedLanes.length > 0) {
      setPresentationPhase('district-flipped');
      setPhaseMessage(`${changedLanes.length === 1 ? districts[changedLanes[0]].name : `${changedLanes.length} DISTRICTS`} FLIPPED`);
      if (!await waitForBeat(450, 80, id)) return;
    }
    setPresentationPhase('round-result'); setPhaseMessage(`ROUND ${resolved.round} COMPLETE`);
    if (await waitForBeat(changedLanes.length > 0 ? 750 : 1200, 120, id)) await advanceRoundBoundary(resolved, id, fastForwardRef.current);
  }, [advanceRoundBoundary, waitForBeat]);
  const runRival = useCallback(async (afterPlayer: Match, id: number) => { setPresentationPhase('rival-thinking'); setPhaseMessage('RIVAL THINKING'); if (!await waitForBeat(700, 90, id)) return; const choice = chooseCpuPlay(afterPlayer); const resolved = choice ? playCard(afterPlayer, 'cpu', choice.instanceId, choice.lane) : pass(afterPlayer, 'cpu'); setMatch(resolved); if (await presentEvents(resolved, afterPlayer.nextEventSequence, id, fastForwardRef.current)) await finishRound(resolved, id); }, [finishRound, presentEvents, waitForBeat]);
  const commit = useCallback(async (autoPass = false) => { if (!match || match.phase !== 'player' || presentationPhase !== 'player-ready' || locked.current || (!autoPass && selectedInstanceId && selectedLane === null)) return; locked.current = true; cancelTimers(); const id = timeline.current.id; let next: Match; try { const isLockIn = !!selectedInstanceId && !autoPass; next = isLockIn ? playCard(match, 'player', selectedInstanceId, selectedLane as Lane, squabble) : pass(match, 'player'); playerMovesRef.current.push(isLockIn ? { cardInstanceId: selectedInstanceId, lane: selectedLane as Lane, squabble } : { cardInstanceId: null, lane: null, squabble: false }); trackEvent('battle_turn_committed', { round: match.round, action: isLockIn ? 'lock_in' : 'pass', automatic: autoPass, squabble: isLockIn && squabble, decision_time: decisionTimeBucket(decisionStartedAtRef.current), ...(isLockIn ? { district: (selectedLane as Lane) + 1 } : {}) }); setMatch(next); if (isLockIn) { setPresentationPhase('lock-in'); setPhaseMessage('LOCK IN'); if (!await waitForBeat(260, 70, id)) return; } if (!await presentEvents(next, match.nextEventSequence, id)) return; } catch { setStagedPlayer(null); setImpactLane(null); locked.current = false; return; } setSquabble(false); setSelectedInstanceId(null); setSelectedLane(null); await runRival(next, id); }, [cancelTimers, match, presentationPhase, presentEvents, runRival, selectedInstanceId, selectedLane, squabble, waitForBeat]);
  const showReplayFrame = useCallback((event: EffectLogEntry, step: 'before' | 'after') => {
    if (!match || presentationPhase !== 'player-ready') return;
    if (!replayLiveFrame.current) {
      replayLiveFrame.current = visualMatchRef.current;
      replayLiveTimer.current = timerSeconds;
    }
    const live = replayLiveFrame.current;
    if (!live) return;
    cancelTimers();
    const sourceId = event.source?.cardInstanceId ?? event.cardInstanceId;
    const lane = event.source?.after?.lane ?? event.source?.before?.lane ?? event.targets[0]?.after?.lane ?? event.targets[0]?.before?.lane ?? event.lane;
    setVisualFrame(buildReplayFrame(live, event, step));
    setPresentationScores(event.scores[step]);
    setActiveEffectId(event.source ? sourceId : null);
    setActiveEffectLane(lane);
    setImpactLane(lane);
    setActiveEffect({ ...event, cardInstanceId: sourceId, lane, targetIds: event.targets.map(target => target.cardInstanceId), durationLabel: event.duration ? `Through round ${event.duration.expiresAtRound - 1}` : undefined });
    setPhaseMessage(event.note);
    setReplay({ event, step });
  }, [cancelTimers, match, presentationPhase, setVisualFrame, timerSeconds]);
  const exitReplay = useCallback(() => {
    if (replayLiveFrame.current) setVisualFrame(replayLiveFrame.current);
    replayLiveFrame.current = null;
    if (replayLiveTimer.current !== null) setTimerSeconds(replayLiveTimer.current);
    replayLiveTimer.current = null;
    setReplay(null);
    setPresentationScores(null);
    setActiveEffectId(null);
    setActiveEffectLane(null);
    setActiveEffect(null);
    setImpactLane(null);
    if (match) {
      setPhaseMessage(`ROUND ${match.round} // YOUR MOVE`);
      locked.current = false;
    }
  }, [match, setVisualFrame]);
  useEffect(() => { if (!turnTimerEnabled || screen !== 'battle' || presentationPhase !== 'player-ready' || replay || showRules || inspect || tabHidden) return; const interval = setInterval(() => setTimerSeconds(v => Math.max(0, v - 1)), 1000); return () => clearInterval(interval); }, [inspect, presentationPhase, replay, screen, showRules, tabHidden, turnTimerEnabled]);
  useEffect(() => { if (timerSeconds === 0 && presentationPhase === 'player-ready' && !replay && match) void commit(!(selectedInstanceId !== null && selectedLane !== null && canAffordSelection(match, 'player', selectedInstanceId, selectedLane as Lane))); }, [commit, match, presentationPhase, replay, selectedInstanceId, selectedLane, timerSeconds]);
  const skipSequence = () => {
    if (!match) return;
    if (['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro'].includes(presentationPhase)) {
      trackEvent('battle_fast_forwarded', { round: match.round, phase: presentationPhase });
      cancelTimers(); void enterPlayerTurn(match.round, true);
    } else if (presentationPhase === 'round-result') {
      trackEvent('battle_fast_forwarded', { round: match.round, phase: presentationPhase });
      cancelTimers(); void advanceRoundBoundary(match, timeline.current.id, true);
    } else if (presentationPhase !== 'player-ready' && presentationPhase !== 'match-finish') {
      trackEvent('battle_fast_forwarded', { round: match.round, phase: presentationPhase });
      fastForwardRef.current = true;
      timeline.current.completeAll();
    }
  };
  const handleRestart = () => { autoStartRef.current = false; setStartError(null); setMatch(null); setVisualFrame(null); setScreen(hideLobby ? 'battle' : 'lobby'); };
  return <div className="h-[100dvh] bg-black text-white font-sans flex flex-col relative overflow-hidden game-bg"><div className="noise-overlay" />
    {startError && !match && <div className="relative z-20 grid h-full place-items-center p-6 text-center"><div className="max-w-sm border border-accent/40 bg-zinc-950 p-6"><div className="font-mono text-[9px] uppercase tracking-[.22em] text-accent">Encounter unavailable</div><h1 className="mt-2 font-display text-3xl font-black italic uppercase">Could not start the story battle</h1><p role="alert" className="mt-3 text-sm text-white/55">{startError}</p><div className="mt-6 flex gap-2"><button type="button" onClick={onExit} className="flex-1 border border-white/20 px-4 py-3 hover:bg-white/5">Back</button><button type="button" onClick={() => void start()} disabled={startPlayerMatch.isPending} className="flex-1 bg-primary px-4 py-3 text-black hover:bg-yellow-400">{startPlayerMatch.isPending ? 'Retrying' : 'Retry'}</button></div></div></div>}
    {screen === 'lobby' && !hideLobby && <Lobby onStart={start} deckId={deckId} setDeckId={setDeckId} rival={rival} setRival={setRival} availableDeckIds={availableDeckIds} onShowRules={() => setShowRules(true)} onInspect={setInspect} isLoading={startPlayerMatch.isPending} onExit={onExit} equippedVariants={equippedVariants} />}
    {encounterCinematic && (
      <StoryCinematic
        source={encounterCinematic.source}
        poster={encounterCinematic.poster}
        title={encounterCinematic.title}
        eyebrow={encounterCinematic.eyebrow}
        onComplete={handleCinematicDone}
        onSkip={handleCinematicDone}
        duration={5200}
      />
    )}
    {screen === 'battle' && visualMatch && <LayoutGroup><Battle match={visualMatch} deck={deck} rivalDeck={rivalDeck} selectedInstanceId={selectedInstanceId} setSelectedInstanceId={setSelectedInstanceId} selectedLane={selectedLane} setSelectedLane={setSelectedLane} commit={() => void commit()} skipSequence={skipSequence} presentationPhase={presentationPhase} phaseMessage={phaseMessage} timerSeconds={timerSeconds} timerEnabled={turnTimerEnabled} impactLane={impactLane} presentationScores={presentationScores} stagedRival={stagedRival} stagedPlayer={stagedPlayer} activeEffectId={activeEffectId} activeEffectLane={activeEffectLane} activeEffect={activeEffect} squabbleCinematicLane={squabbleCinematicLane} squabble={squabble} setSquabble={setSquabble} setInspect={setInspect} archiveMatch={() => { if (match) void finishMatchSession(match); }} onShowRules={() => setShowRules(true)} feedbackPreferences={feedbackPreferences} setFeedbackPreferences={setFeedbackPreferences} decisionStartedAt={decisionStartedAtRef.current} equippedVariants={equippedVariants} replay={replay} onReplayStep={showReplayFrame} onExitReplay={exitReplay} /></LayoutGroup>}
    <AnimatePresence>{inspect && <CardInspector card={inspect} variantId={getEquippedVariant(equippedVariants, inspect.id)} onClose={() => setInspect(null)} match={match} />}{showRules && <RulesModal onClose={() => setShowRules(false)} />}{screen === 'result' && match && <ResultScreen onRestart={handleRestart} onChangeDeck={() => hideLobby ? onExit() : setScreen('lobby')} onGoHome={onExit} match={match} districts={districts} deckId={deckId} rivalDeck={rivalDeck} reward={serverReward} rewardError={serverRewardError} rewardPending={completePlayerMatch.isPending} onRetryReward={() => void finishMatchSession(match)} isGuest={mode === 'guest' || !!customPlayerDeck} customPlayerDeck={customPlayerDeck} storyMetadata={storyMetadata} equippedVariants={equippedVariants} />}</AnimatePresence>
  </div>;
}
*/

export function trackBattleFastForwarded(match: Match, phase: PresentationPhase) {
  trackEvent('battle_fast_forwarded', { round: match.round, phase });
}

const e2eAuthEnabled = Boolean((import.meta as ImportMeta).env?.DEV && (import.meta as ImportMeta).env?.VITE_E2E_AUTH === 'true');
