import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, LayoutGroup } from 'framer-motion';

import { decks, districts, Card } from './data';
import { Lobby } from './components/Lobby';
import { Battle } from './components/Battle';
import { ResultScreen } from './components/ResultScreen';
import { CardInspector } from './components/CardInspector';
import { RulesModal } from './components/RulesModal';

import { createMatch, Match, playCard, pass, revealCpu, nextRound, CardInstance } from './gameEngine';

function AppGame() {
  const [screen, setScreen] = useState<'lobby' | 'battle' | 'result'>('lobby');
  const [deckId, setDeckId] = useState('vibes');
  const [rival, setRival] = useState('combo');

  const [match, setMatch] = useState<Match | null>(null);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState<number | null>(null);
  const [squabble, setSquabble] = useState(false);

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [inspect, setInspect] = useState<CardInstance | Card | null>(null);

  const deck = decks.find(d => d.id === deckId)!;
  const rivalDeck = decks.find(d => d.id === rival)!;

  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  const start = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    setMatch(createMatch(deckId, rival));
    setSelectedInstanceId(null);
    setSelectedLane(null);
    setSquabble(false);
    setShowRules(false);
    setScreen('battle');
  };

  const commit = () => {
    if (!match || match.phase !== 'player') return;
    let nextMatch: Match;

    if (selectedInstanceId) {
      if (selectedLane === null) return;
      try {
        nextMatch = playCard(match, 'player', selectedInstanceId, selectedLane as 0|1|2, squabble);
      } catch (e) {
        console.error(e);
        return;
      }
    } else {
      nextMatch = pass(match, 'player');
    }

    setMatch(nextMatch);
    setSquabble(false);
    setSelectedInstanceId(null);
    setSelectedLane(null);
    
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      setMatch(current => current ? revealCpu(current) : null);
    }, 1500);
  };

  const handleNextRound = () => {
    if (!match || match.phase !== 'resolved') return;
    const next = nextRound(match);
    setMatch(next);
    if (next.phase === 'complete') {
      setScreen('result');
    }
  };

  return (
    <main className="h-[100dvh] bg-black text-white font-sans flex flex-col relative overflow-hidden game-bg">
      <div className="noise-overlay" />

      {screen === 'lobby' && (
        <Lobby
          onStart={start}
          deckId={deckId} setDeckId={setDeckId}
          rival={rival} setRival={setRival}
          onShowRules={() => setShowRules(true)}
        />
      )}

      {screen === 'battle' && match && (
        <LayoutGroup>
          <Battle
            match={match}
            deck={deck} rivalDeck={rivalDeck}
            selectedInstanceId={selectedInstanceId} setSelectedInstanceId={setSelectedInstanceId}
            selectedLane={selectedLane} setSelectedLane={setSelectedLane}
            commit={commit} handleNextRound={handleNextRound}
            squabble={squabble} setSquabble={setSquabble}
            setInspect={setInspect} archiveMatch={() => setScreen('result')}
            onShowRules={() => setShowRules(true)}
          />
        </LayoutGroup>
      )}

      <AnimatePresence>
        {inspect && <CardInspector card={inspect} onClose={() => setInspect(null)} match={match} />}
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        {screen === 'result' && match && (
          <ResultScreen 
            onRestart={start} 
            onChangeDeck={() => setScreen('lobby')} 
            match={match}
            districts={districts} deckId={deckId} rivalDeck={rivalDeck}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppGame />
    </QueryClientProvider>
  );
}