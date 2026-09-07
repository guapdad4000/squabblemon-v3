import { useState, useCallback, useRef, useEffect } from 'react';
import { useStartPlayerMatch, useCompletePlayerMatch, getGetPlayerBootstrapQueryKey, MatchReward, type MatchMove } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGroup, AnimatePresence } from 'framer-motion';

import { decks, districts, Card } from '../data';
import { Lobby } from './Lobby';
import { Battle } from './Battle';
import { ResultScreen } from './ResultScreen';
import { CardInspector } from './CardInspector';
import { RulesModal } from './RulesModal';
import { PresentationTimeline } from '../presentationTimeline';

import { canAffordSelection, chooseCpuPlay, createMatch, Match, playCard, pass, nextRound, CardInstance, type Lane } from '../gameEngine';
export type PresentationPhase =
  | 'versus' | 'countdown-3' | 'countdown-2' | 'countdown-1' | 'squabble'
  | 'deal' | 'round-intro' | 'player-ready' | 'player-slam' | 'effects'
  | 'player-pass'
  | 'rival-thinking' | 'rival-travel' | 'rival-reveal' | 'rival-slam'
  | 'rival-pass' | 'round-result' | 'match-finish';

export function PlayLoop({ 
  mode = 'practice',
  onExit,
  initialDeckId = 'block',
  initialRivalId = 'combo',
  hideLobby = false,
  turnTimerEnabled = true,
}: { 
  mode?: 'guest' | 'practice' | 'tutorial',
  onExit: () => void,
  initialDeckId?: string,
  initialRivalId?: string,
  hideLobby?: boolean,
  turnTimerEnabled?: boolean,
}) {
  const [screen, setScreen] = useState<'lobby' | 'battle' | 'result'>(hideLobby ? 'battle' : 'lobby');
  const [deckId, setDeckId] = useState(initialDeckId);
  const [rival, setRival] = useState(initialRivalId);

  const [match, setMatch] = useState<Match | null>(null);
  const [serverMatchId, setServerMatchId] = useState<string | null>(null);
  const [serverReward, setServerReward] = useState<MatchReward | null>(null);
  const [serverRewardError, setServerRewardError] = useState(false);

  const startPlayerMatch = useStartPlayerMatch();
  const completePlayerMatch = useCompletePlayerMatch();
  const queryClient = useQueryClient();

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState<number | null>(null);
  const [squabble, setSquabble] = useState(false);

  const timeline = useRef(new PresentationTimeline());
  const autoStartRef = useRef(false);
  const playerMovesRef = useRef<MatchMove[]>([]);
  const locked = useRef(false);
  const [presentationPhase, setPresentationPhase] = useState<PresentationPhase>('versus');
  const [phaseMessage, setPhaseMessage] = useState('');
  const [impactLane, setImpactLane] = useState<Lane | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(20);
  const [tabHidden, setTabHidden] = useState(document.hidden);
  const [stagedRival, setStagedRival] = useState<CardInstance | null>(null);
  const [activeEffectId, setActiveEffectId] = useState<string | null>(null);
  const [activeEffectLane, setActiveEffectLane] = useState<Lane | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [inspect, setInspect] = useState<CardInstance | Card | null>(null);

  const deck = decks.find(d => d.id === deckId)!;
  const rivalDeck = decks.find(d => d.id === rival)!;

  const cancelTimers = useCallback(() => {
    timeline.current.cancelAll();
  }, []);

  const wait = useCallback((ms: number, id: number) => timeline.current.wait(ms, id), []);

  useEffect(() => () => cancelTimers(), [cancelTimers]);
  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const enterPlayerTurn = useCallback(async (round: number, immediate = false) => {
    const id = timeline.current.id;
    setPresentationPhase('round-intro');
    setPhaseMessage(`ROUND ${round}`);
    if (!immediate && !await wait(650, id)) return;
    setPresentationPhase('player-ready');
    setPhaseMessage(`ROUND ${round} // YOUR MOVE`);
    setTimerSeconds(20);
    locked.current = false;
  }, [wait]);

  const runIntro = useCallback(async () => {
    cancelTimers();
    const id = timeline.current.id;
    const beats: Array<[PresentationPhase, string, number]> = [
      ['versus', 'YOU  VS  RIVAL', 850], ['countdown-3', '3', 550],
      ['countdown-2', '2', 550], ['countdown-1', '1', 550],
      ['squabble', 'SQUABBLE!', 700], ['deal', 'CREW UP', 650],
    ];
    for (const [phase, message, duration] of beats) {
      setPresentationPhase(phase); setPhaseMessage(message);
      if (!await wait(duration, id)) return;
    }
    enterPlayerTurn(1);
  }, [cancelTimers, enterPlayerTurn, wait]);

  const startLocalMatch = useCallback(() => {
    cancelTimers();
    setServerReward(null);
    setServerRewardError(false);
    playerMovesRef.current = [];
    setMatch(createMatch(deckId, rival));
    setSelectedInstanceId(null);
    setSelectedLane(null);
    setSquabble(false);
    setShowRules(false);
    setInspect(null);
    setStagedRival(null);
    setActiveEffectId(null);
    setActiveEffectLane(null);
    setScreen('battle');
    locked.current = true;
    void runIntro();
  }, [cancelTimers, deckId, rival, runIntro]);

  const start = useCallback(async () => {
    setServerMatchId(null);
    if (mode !== 'guest') {
      try {
        const res = await startPlayerMatch.mutateAsync({
          data: { mode: mode === 'tutorial' ? 'tutorial' : 'practice', playerDeckId: deckId, rivalDeckId: rival }
        });
        setServerMatchId(res.id);
      } catch (e) {
        const proceed = window.confirm("Failed to reach server. Play local practice match with no rewards?");
        if (!proceed) return;
        setServerMatchId(null);
      }
    }
    startLocalMatch();
  }, [deckId, mode, rival, startLocalMatch, startPlayerMatch]);

  useEffect(() => {
    if (hideLobby && !autoStartRef.current && !match && screen === 'battle') {
      autoStartRef.current = true;
      void start();
    }
  }, [hideLobby, match, screen, start]);

  const finishMatchSession = useCallback(async (finalMatch: Match) => {
    if (mode !== 'guest' && serverMatchId) {
      try {
        const res = await completePlayerMatch.mutateAsync({
          matchId: serverMatchId,
          data: { moves: playerMovesRef.current }
        });
        
        queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), {
           profile: res.profile,
           missions: res.missions,
           nextAction: res.nextAction
        });
        setServerReward(res.reward);
        setServerRewardError(false);
      } catch (e) {
        console.error(e);
        setServerRewardError(true);
      }
    } else if (mode === 'guest') {
      localStorage.setItem('squabblemon_guest_tutorial_complete', 'true');
    }
    setScreen('result');
  }, [completePlayerMatch, mode, queryClient, serverMatchId]);

  const finishRound = useCallback(async (resolved: Match, id: number) => {
    setPresentationPhase('effects');
    for (const effect of resolved.effectLog.slice(-3)) {
      setActiveEffectId(effect.cardInstanceId);
      setActiveEffectLane(effect.lane);
      setPhaseMessage(effect.note);
      if (!await wait(360, id)) return;
    }
    setActiveEffectId(null);
    setActiveEffectLane(null);
    setPresentationPhase('round-result');
    setPhaseMessage(`ROUND ${resolved.round} COMPLETE`);
    if (!await wait(1200, id)) return;
    
    if (resolved.round >= 6) {
      const complete = nextRound(resolved);
      setMatch(complete);
      setPresentationPhase('match-finish');
      setPhaseMessage('FINAL DISTRICTS');
      if (!await wait(1500, id)) return;
      void finishMatchSession(complete);
      return;
    }
    const next = nextRound(resolved);
    setMatch(next);
    void enterPlayerTurn(next.round);
  }, [enterPlayerTurn, finishMatchSession, wait]);

  const runRival = useCallback(async (afterPlayer: Match, id: number) => {
    setPresentationPhase('rival-thinking'); setPhaseMessage('RIVAL THINKING');
    if (!await wait(700, id)) return;
    const choice = chooseCpuPlay(afterPlayer);
    if (!choice) {
      setPresentationPhase('rival-pass'); setPhaseMessage('RIVAL PASSES');
      if (!await wait(600, id)) return;
      const resolved = pass(afterPlayer, 'cpu');
      setMatch(resolved);
      return finishRound(resolved, id);
    }
    const cpuCard = afterPlayer.cpuHand.find(card => card.instanceId === choice.instanceId);
    setStagedRival(cpuCard ?? null);
    setImpactLane(choice.lane);
    setPresentationPhase('rival-travel'); setPhaseMessage('INCOMING');
    if (!await wait(350, id)) return;
    setPresentationPhase('rival-reveal');
    setPhaseMessage(cpuCard?.name ?? 'RIVAL REVEAL');
    if (!await wait(350, id)) return;
    setPresentationPhase('rival-slam'); setPhaseMessage('RIVAL SLAM');
    if (!await wait(180, id)) return;
    const resolved = playCard(afterPlayer, 'cpu', choice.instanceId, choice.lane);
    setMatch(resolved);
    setStagedRival(null);
    if (!await wait(320, id)) return;
    setImpactLane(null);
    return finishRound(resolved, id);
  }, [finishRound, wait]);

  const commit = useCallback(async (autoPass = false) => {
    if (!match || match.phase !== 'player' || presentationPhase !== 'player-ready' || locked.current) return;
    if (!autoPass && selectedInstanceId && selectedLane === null) return;
    locked.current = true;
    cancelTimers();
    const id = timeline.current.id;
    let nextMatch: Match;
    if (selectedInstanceId && !autoPass) {
      try {
        setImpactLane(selectedLane as Lane);
        setPresentationPhase('player-slam');
        setPhaseMessage(squabble ? 'SQUABBLE ARMED!' : 'LOCKED IN');
        if (!await wait(squabble ? 500 : 280, id)) return;
        nextMatch = playCard(match, 'player', selectedInstanceId, selectedLane as Lane, squabble);
        playerMovesRef.current.push({
          cardInstanceId: selectedInstanceId,
          lane: selectedLane as Lane,
          squabble,
        });
        setMatch(nextMatch);
        setPhaseMessage(squabble ? 'DOUBLE POWER!' : 'IMPACT!');
        if (!await wait(380, id)) return;
      } catch (e) {
        console.error(e); locked.current = false; return;
      }
    } else {
      setPresentationPhase('player-pass');
      setPhaseMessage('YOU PASS');
      nextMatch = pass(match, 'player');
      playerMovesRef.current.push({
        cardInstanceId: null,
        lane: null,
        squabble: false,
      });
      setMatch(nextMatch);
      if (!await wait(350, id)) return;
    }
    setSquabble(false);
    setSelectedInstanceId(null);
    setSelectedLane(null);
    setImpactLane(null);
    await runRival(nextMatch, id);
  }, [cancelTimers, match, presentationPhase, runRival, selectedInstanceId, selectedLane, squabble, wait]);

  useEffect(() => {
    if (!turnTimerEnabled || screen !== 'battle' || presentationPhase !== 'player-ready' || showRules || inspect || tabHidden) return;
    const interval = setInterval(() => setTimerSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(interval);
  }, [screen, presentationPhase, showRules, inspect, tabHidden, turnTimerEnabled]);
  useEffect(() => {
    if (timerSeconds !== 0 || presentationPhase !== 'player-ready' || !match) return;
    const exactChoiceReady = selectedInstanceId !== null
      && selectedLane !== null
      && canAffordSelection(match, 'player', selectedInstanceId, selectedLane as Lane);
    void commit(!exactChoiceReady);
  }, [commit, match, presentationPhase, selectedInstanceId, selectedLane, timerSeconds]);

  const skipSequence = () => {
    if (!match) return;
    if (['versus','countdown-3','countdown-2','countdown-1','squabble','deal','round-intro'].includes(presentationPhase)) {
      cancelTimers(); void enterPlayerTurn(match.round, true);
    } else if (presentationPhase === 'round-result') {
      cancelTimers();
      if (match.round >= 6) { 
        const complete = nextRound(match); 
        setMatch(complete); 
        void finishMatchSession(complete);
      }
      else { const next = nextRound(match); setMatch(next); void enterPlayerTurn(next.round, true); }
    }
  };

  return (
    <div className="h-[100dvh] bg-black text-white font-sans flex flex-col relative overflow-hidden game-bg">
      <div className="noise-overlay" />

      {screen === 'lobby' && (
        <Lobby
          onStart={start}
          deckId={deckId} setDeckId={setDeckId}
          rival={rival} setRival={setRival}
          onShowRules={() => setShowRules(true)}
          isLoading={startPlayerMatch.isPending}
          onExit={onExit}
        />
      )}

      {screen === 'battle' && match && (
        <LayoutGroup>
          <Battle
            match={match}
            deck={deck} rivalDeck={rivalDeck}
            selectedInstanceId={selectedInstanceId} setSelectedInstanceId={setSelectedInstanceId}
            selectedLane={selectedLane} setSelectedLane={setSelectedLane}
            commit={() => void commit()} skipSequence={skipSequence}
            presentationPhase={presentationPhase} phaseMessage={phaseMessage}
            timerSeconds={timerSeconds} timerEnabled={turnTimerEnabled} impactLane={impactLane}
            stagedRival={stagedRival} activeEffectId={activeEffectId} activeEffectLane={activeEffectLane}
            squabble={squabble} setSquabble={setSquabble}
            setInspect={setInspect} archiveMatch={() => finishMatchSession(match)}
            onShowRules={() => setShowRules(true)}
          />
        </LayoutGroup>
      )}

      <AnimatePresence>
        {inspect && <CardInspector card={inspect} onClose={() => setInspect(null)} match={match} />}
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        {screen === 'result' && match && (
          <ResultScreen 
            onRestart={() => setScreen('lobby')} 
            onChangeDeck={() => setScreen('lobby')} 
            onGoHome={onExit}
            match={match}
            districts={districts} deckId={deckId} rivalDeck={rivalDeck}
            reward={serverReward}
            rewardError={serverRewardError}
            rewardPending={completePlayerMatch.isPending}
            onRetryReward={() => void finishMatchSession(match)}
            isGuest={mode === 'guest'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}