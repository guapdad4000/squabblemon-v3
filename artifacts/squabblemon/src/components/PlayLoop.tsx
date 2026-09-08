import { useState, useCallback, useRef, useEffect } from 'react';
import { useStartPlayerMatch, useCompletePlayerMatch, getGetPlayerBootstrapQueryKey, getGetPlayerStoryQueryKey, MatchReward, type MatchMove, type StoryMatchMetadata } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGroup, AnimatePresence } from 'framer-motion';
import { cards, decks, districts, Card, Deck } from '../data';
import { Lobby } from './Lobby';
import { Battle } from './Battle';
import { ResultScreen } from './ResultScreen';
import { CardInspector } from './CardInspector';
import { RulesModal } from './RulesModal';
import { StoryCinematic } from './StoryCinematic';
import { PresentationTimeline } from '../presentationTimeline';
import { BattleFeedback, loadFeedbackPreferences, saveFeedbackPreferences, type FeedbackPreferences } from '../battleFeedback';
import { canAffordSelection, chooseCpuPlay, createMatch, createMatchFromCatalog, createStoryMatch, Match, playCard, pass, nextRound, CardInstance, type EffectLogEntry, type Lane, type ScoreState, type StoryEncounterSnapshot } from '../gameEngine';

export type PresentationPhase = 'versus' | 'countdown-3' | 'countdown-2' | 'countdown-1' | 'squabble' | 'deal' | 'round-intro' | 'player-ready' | 'player-travel' | 'player-reveal' | 'player-focus' | 'player-slam' | 'player-impact' | 'effects' | 'player-pass' | 'rival-thinking' | 'rival-travel' | 'rival-reveal' | 'rival-focus' | 'rival-slam' | 'rival-impact' | 'rival-pass' | 'round-result' | 'match-finish';
export type PresentationEffect = EffectLogEntry & { targetIds: string[]; durationLabel?: string };

const allCards = (match: Match) => [...match.playerHand, ...match.cpuHand, ...match.boards.flat()];
const cardById = (match: Match, id: string) => allCards(match).find(card => card.instanceId === id);
/** Rebuild only participants from the authoritative before/after event snapshots. */
const applyEventState = (visual: Match, authoritative: Match, event: EffectLogEntry, key: 'before' | 'after'): Match => {
  let playerHand = [...visual.playerHand], cpuHand = [...visual.cpuHand];
  const boards = visual.boards.map(lane => [...lane]) as Match['boards'];
  for (const participant of [event.source, ...event.targets]) {
    if (!participant) continue;
    const state = participant[key], id = participant.cardInstanceId;
    playerHand = playerHand.filter(card => card.instanceId !== id); cpuHand = cpuHand.filter(card => card.instanceId !== id);
    for (let lane = 0; lane < boards.length; lane += 1) boards[lane] = boards[lane].filter(card => card.instanceId !== id);
    if (!state) continue;
    const template = cardById(visual, id) ?? cardById(authoritative, id);
    if (!template) continue;
    const card = { ...template, lane: state.lane, basePower: state.basePower, powerModifier: state.powerModifier, moved: state.moved, statuses: state.statuses, lastEffectNote: state.lastEffectNote };
    if (state.lane === null) (state.owner === 'player' ? playerHand : cpuHand).push(card); else boards[state.lane].push(card);
  }
  return { ...visual, playerHand, cpuHand, boards, playerHype: event.resources[key].playerHype, cpuHype: event.resources[key].cpuHype, round: event.state[key].round, phase: event.state[key].phase, playerDrawIndex: event.state[key].playerDrawIndex, cpuDrawIndex: event.state[key].cpuDrawIndex, squabbleUsed: event.state[key].squabbleUsed, plugDiscountLane: event.state[key].plugDiscountLane, cheapBuffsUsed: event.state[key].cheapBuffsUsed };
};

export function PlayLoop({ mode = 'practice', onExit, initialDeckId = 'block', initialRivalId = 'combo', hideLobby = false, turnTimerEnabled = true, customPlayerDeck, availableDeckIds, storyNodeId }: { mode?: 'guest' | 'practice' | 'tutorial' | 'story'; onExit: () => void; initialDeckId?: string; initialRivalId?: string; hideLobby?: boolean; turnTimerEnabled?: boolean; customPlayerDeck?: Deck; availableDeckIds?: string[]; storyNodeId?: string }) {
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
  const [presentationPhase, setPresentationPhase] = useState<PresentationPhase>('versus'), [phaseMessage, setPhaseMessage] = useState('');
  const [impactLane, setImpactLane] = useState<Lane | null>(null), [timerSeconds, setTimerSeconds] = useState(20), [tabHidden, setTabHidden] = useState(document.hidden);
  const [stagedRival, setStagedRival] = useState<CardInstance | null>(null), [stagedPlayer, setStagedPlayer] = useState<CardInstance | null>(null);
  const [activeEffectId, setActiveEffectId] = useState<string | null>(null), [activeEffectLane, setActiveEffectLane] = useState<Lane | null>(null), [activeEffect, setActiveEffect] = useState<PresentationEffect | null>(null);
  const [showRules, setShowRules] = useState(false), [inspect, setInspect] = useState<CardInstance | Card | null>(null);
  const [encounterCinematic, setEncounterCinematic] = useState<{ source: string, poster: string, title: string, eyebrow: string } | null>(null);
  const [feedbackPreferences, setFeedbackPreferences] = useState<FeedbackPreferences>(loadFeedbackPreferences);
  const feedback = useRef(new BattleFeedback(feedbackPreferences));

  const deck = customPlayerDeck || decks.find(d => d.id === deckId) || decks[0];
  const rivalDeck: Deck = match?.storyEncounter ? { id: match.storyEncounter.enemy.deckId, name: match.storyEncounter.enemy.name, archetype: match.storyEncounter.enemy.behaviorProfile, accent: 'STORY', plan: 'A server-issued story encounter.', cards: [...match.storyEncounter.enemy.cardIds], hero: cards[match.storyEncounter.enemy.cardIds[0]]?.id ?? decks[0].hero } : decks.find(d => d.id === rival) || decks[0];
  const cancelTimers = useCallback(() => { feedback.current.reset(); timeline.current.cancelAll(); }, []);
  const wait = useCallback((ms: number, id: number) => timeline.current.wait(ms, id), []);
  const setVisualFrame = useCallback((next: Match | null) => { visualMatchRef.current = next; setVisualMatch(next); }, []);
  const resetPresentation = useCallback(() => { setSelectedInstanceId(null); setSelectedLane(null); setSquabble(false); setShowRules(false); setInspect(null); setStagedRival(null); setStagedPlayer(null); setActiveEffectId(null); setActiveEffectLane(null); setActiveEffect(null); setPresentationScores(null); }, []);
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

  const enterPlayerTurn = useCallback(async (round: number, immediate = false) => { const id = timeline.current.id; setPresentationPhase('round-intro'); setPhaseMessage(`ROUND ${round}`); if (!immediate && !fastForwardRef.current && !await wait(650, id)) return; setPresentationPhase('player-ready'); setPhaseMessage(`ROUND ${round} // YOUR MOVE`); setTimerSeconds(20); locked.current = false; fastForwardRef.current = false; }, [wait]);
  const runIntro = useCallback(async () => { cancelTimers(); const id = timeline.current.id; const beats: Array<[PresentationPhase, string, number]> = [['versus', 'YOU  VS  RIVAL', 850], ['countdown-3', '3', 550], ['countdown-2', '2', 550], ['countdown-1', '1', 550], ['squabble', 'SQUABBLE!', 700], ['deal', 'CREW UP', 650]]; for (const [phase, message, duration] of beats) { setPresentationPhase(phase); setPhaseMessage(message); if (!await wait(duration, id)) return; } void enterPlayerTurn(1); }, [cancelTimers, enterPlayerTurn, wait]);
  const beginMatch = useCallback((initial: Match) => {
    cancelTimers(); setServerReward(null); setServerRewardError(false); setStoryMetadata(null); playerMovesRef.current = []; setMatch(initial); setVisualFrame(initial); resetPresentation(); setScreen('battle'); locked.current = true;
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
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!fast && !fastForwardRef.current) feedback.current.emit(effect, id, reduced || document.documentElement.dataset.reduceMotion === 'true');
      if (!await wait(fast || fastForwardRef.current ? 0 : reduced ? 70 : 190, id)) return false;
      frame = applyEventState(frame, resolved, effect, 'after'); setVisualFrame(frame); setPresentationScores(effect.scores.after); setPresentationPhase(isPlay ? effect.owner === 'player' ? 'player-impact' : 'rival-impact' : phase);
      if (!await wait(fast || fastForwardRef.current ? 0 : reduced ? 90 : 380, id)) return false;
      setStagedPlayer(null); setStagedRival(null);
    }
    setActiveEffectId(null); setActiveEffectLane(null); setActiveEffect(null); setImpactLane(null); return true;
  }, [setVisualFrame, wait]);
  const advanceRoundBoundary = useCallback(async (resolved: Match, id: number, fast = false) => { const next = nextRound(resolved); setMatch(next); if (!await presentEvents(next, resolved.nextEventSequence, id, fast)) return; if (next.phase === 'complete') { setPresentationPhase('match-finish'); setPhaseMessage('FINAL DISTRICTS'); if (!fast && !await wait(900, id)) return; void finishMatchSession(next); return; } setPresentationScores(null); void enterPlayerTurn(next.round, fast); }, [enterPlayerTurn, finishMatchSession, presentEvents, wait]);
  const finishRound = useCallback(async (resolved: Match, id: number) => { setPresentationPhase('round-result'); setPhaseMessage(`ROUND ${resolved.round} COMPLETE`); if (fastForwardRef.current || await wait(1200, id)) await advanceRoundBoundary(resolved, id, fastForwardRef.current); }, [advanceRoundBoundary, wait]);
  const runRival = useCallback(async (afterPlayer: Match, id: number) => { setPresentationPhase('rival-thinking'); setPhaseMessage('RIVAL THINKING'); if (!fastForwardRef.current && !await wait(700, id)) return; const choice = chooseCpuPlay(afterPlayer); const resolved = choice ? playCard(afterPlayer, 'cpu', choice.instanceId, choice.lane) : pass(afterPlayer, 'cpu'); setMatch(resolved); if (await presentEvents(resolved, afterPlayer.nextEventSequence, id, fastForwardRef.current)) await finishRound(resolved, id); }, [finishRound, presentEvents, wait]);
  const commit = useCallback(async (autoPass = false) => { if (!match || match.phase !== 'player' || presentationPhase !== 'player-ready' || locked.current || (!autoPass && selectedInstanceId && selectedLane === null)) return; locked.current = true; cancelTimers(); const id = timeline.current.id; let next: Match; try { next = selectedInstanceId && !autoPass ? playCard(match, 'player', selectedInstanceId, selectedLane as Lane, squabble) : pass(match, 'player'); playerMovesRef.current.push(selectedInstanceId && !autoPass ? { cardInstanceId: selectedInstanceId, lane: selectedLane as Lane, squabble } : { cardInstanceId: null, lane: null, squabble: false }); setMatch(next); if (!await presentEvents(next, match.nextEventSequence, id)) return; } catch { setStagedPlayer(null); setImpactLane(null); locked.current = false; return; } setSquabble(false); setSelectedInstanceId(null); setSelectedLane(null); await runRival(next, id); }, [cancelTimers, match, presentationPhase, presentEvents, runRival, selectedInstanceId, selectedLane, squabble]);
  useEffect(() => { if (!turnTimerEnabled || screen !== 'battle' || presentationPhase !== 'player-ready' || showRules || inspect || tabHidden) return; const interval = setInterval(() => setTimerSeconds(v => Math.max(0, v - 1)), 1000); return () => clearInterval(interval); }, [inspect, presentationPhase, screen, showRules, tabHidden, turnTimerEnabled]);
  useEffect(() => { if (timerSeconds === 0 && presentationPhase === 'player-ready' && match) void commit(!(selectedInstanceId !== null && selectedLane !== null && canAffordSelection(match, 'player', selectedInstanceId, selectedLane as Lane))); }, [commit, match, presentationPhase, selectedInstanceId, selectedLane, timerSeconds]);
  const skipSequence = () => {
    if (!match) return;
    if (['versus', 'countdown-3', 'countdown-2', 'countdown-1', 'squabble', 'deal', 'round-intro'].includes(presentationPhase)) {
      cancelTimers(); void enterPlayerTurn(match.round, true);
    } else if (presentationPhase === 'round-result') {
      cancelTimers(); void advanceRoundBoundary(match, timeline.current.id, true);
    } else if (presentationPhase !== 'player-ready' && presentationPhase !== 'match-finish') {
      fastForwardRef.current = true;
      timeline.current.completeAll();
    }
  };
  const handleRestart = () => { autoStartRef.current = false; setStartError(null); setMatch(null); setVisualFrame(null); setScreen(hideLobby ? 'battle' : 'lobby'); };
  return <div className="h-[100dvh] bg-black text-white font-sans flex flex-col relative overflow-hidden game-bg"><div className="noise-overlay" />
    {startError && !match && <div className="relative z-20 grid h-full place-items-center p-6 text-center"><div className="max-w-sm border border-accent/40 bg-zinc-950 p-6"><div className="font-mono text-[9px] uppercase tracking-[.22em] text-accent">Encounter unavailable</div><h1 className="mt-2 font-display text-3xl font-black italic uppercase">Could not start the story battle</h1><p role="alert" className="mt-3 text-sm text-white/55">{startError}</p><div className="mt-6 flex gap-2"><button type="button" onClick={onExit} className="flex-1 border border-white/20 px-4 py-3 hover:bg-white/5">Back</button><button type="button" onClick={() => void start()} disabled={startPlayerMatch.isPending} className="flex-1 bg-primary px-4 py-3 text-black hover:bg-yellow-400">{startPlayerMatch.isPending ? 'Retrying' : 'Retry'}</button></div></div></div>}
    {screen === 'lobby' && !hideLobby && <Lobby onStart={start} deckId={deckId} setDeckId={setDeckId} rival={rival} setRival={setRival} availableDeckIds={availableDeckIds} onShowRules={() => setShowRules(true)} onInspect={setInspect} isLoading={startPlayerMatch.isPending} onExit={onExit} />}
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
    {screen === 'battle' && visualMatch && <LayoutGroup><Battle match={visualMatch} deck={deck} rivalDeck={rivalDeck} selectedInstanceId={selectedInstanceId} setSelectedInstanceId={setSelectedInstanceId} selectedLane={selectedLane} setSelectedLane={setSelectedLane} commit={() => void commit()} skipSequence={skipSequence} presentationPhase={presentationPhase} phaseMessage={phaseMessage} timerSeconds={timerSeconds} timerEnabled={turnTimerEnabled} impactLane={impactLane} presentationScores={presentationScores} stagedRival={stagedRival} stagedPlayer={stagedPlayer} activeEffectId={activeEffectId} activeEffectLane={activeEffectLane} activeEffect={activeEffect} squabble={squabble} setSquabble={setSquabble} setInspect={setInspect} archiveMatch={() => { if (match) void finishMatchSession(match); }} onShowRules={() => setShowRules(true)} feedbackPreferences={feedbackPreferences} setFeedbackPreferences={setFeedbackPreferences} /></LayoutGroup>}
    <AnimatePresence>{inspect && <CardInspector card={inspect} onClose={() => setInspect(null)} match={match} />}{showRules && <RulesModal onClose={() => setShowRules(false)} />}{screen === 'result' && match && <ResultScreen onRestart={handleRestart} onChangeDeck={() => hideLobby ? onExit() : setScreen('lobby')} onGoHome={onExit} match={match} districts={districts} deckId={deckId} rivalDeck={rivalDeck} reward={serverReward} rewardError={serverRewardError} rewardPending={completePlayerMatch.isPending} onRetryReward={() => void finishMatchSession(match)} isGuest={mode === 'guest' || !!customPlayerDeck} customPlayerDeck={customPlayerDeck} storyMetadata={storyMetadata} />}</AnimatePresence>
  </div>;
}
