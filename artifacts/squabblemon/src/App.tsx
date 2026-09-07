import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';

import { cards, decks, districts, Card } from './data';
import { Lobby } from './components/Lobby';
import { Battle } from './components/Battle';
import { ResultScreen } from './components/ResultScreen';
import { CardInspector } from './components/CardInspector';
import { RulesModal } from './components/RulesModal';

function AppGame() {
  const [screen, setScreen] = useState<'lobby' | 'battle' | 'result'>('lobby');
  const [deckId, setDeckId] = useState('vibes'); 
  const [rival, setRival] = useState('combo'); 
  
  const [round, setRound] = useState(1); 
  const [hype, setHype] = useState(1);
  const [hand, setHand] = useState<Card[]>([]); 
  const [boards, setBoards] = useState<Card[][]>([[], [], []]); 
  
  const [selected, setSelected] = useState<Card | null>(null); 
  const [selectedLane, setSelectedLane] = useState<number | null>(null); 
  
  const [squabble, setSquabble] = useState(false);
  const [squabbleUsed, setSquabbleUsed] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [showRules, setShowRules] = useState(false); 
  const [message, setMessage] = useState('SELECT A CARD, THEN TAP A DISTRICT');
  
  const [inspect, setInspect] = useState<Card | null>(null);
  
  const deck = decks.find(d => d.id === deckId)!; 
  const rivalDeck = decks.find(d => d.id === rival)!;

  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  const start = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    setRound(1);
    setHype(1);
    setBoards([[], [], []]);
    setSelected(null);
    setSelectedLane(null);
    setSquabble(false);
    setSquabbleUsed(false);
    setIsResolving(false);
    setMessage('SELECT A CARD, THEN TAP A DISTRICT');
    setHand(deck.cards.slice(0, 5).map(id => ({ ...cards[id], deck: deckId, owner: 'player' })));
    setScreen('battle');
  };

  const commit = () => {
    if (!selected || selectedLane === null || selected.cost > hype) return;
    
    const next = [...boards];
    const committedCard = {
      ...selected,
      power: squabble ? selected.power * 2 : selected.power,
      owner: 'player' as const
    };
    next[selectedLane] = [...next[selectedLane], committedCard];
    setBoards(next);
    setHand(hand.filter(c => c.id !== selected.id));
    setHype(0);
    setIsResolving(true);
    setMessage(squabble ? 'SQUABBLE COMMITTED. POWER DOUBLED // RIVAL REVEALING.' : 'COMMITTED. CPU IS REVEALING THEIR PLAY.');
    if (squabble) {
      setSquabble(false);
      setSquabbleUsed(true);
    }
    setSelected(null);
    setSelectedLane(null);
    
    revealTimer.current = setTimeout(() => {
      const cpuCard = { ...cards[rivalDeck.cards[(round + 1) % rivalDeck.cards.length]], deck: rivalDeck.id, owner: 'cpu' as const };
      const cpuLane = (round + 1) % 3;
      const updated = [...next];
      updated[cpuLane] = [...updated[cpuLane], cpuCard];
      setBoards(updated);
      setIsResolving(false);
      setMessage(`ROUND ${round} RESOLVED // DISTRICT POWER UPDATED`);
    }, 1200);
  };

  const nextRound = () => {
    if (isResolving) return;
    if (round >= 6) {
      setScreen('result');
      return;
    }
    setRound(round + 1);
    setHype(round + 1);
    
    const usedCardIds = new Set([
      ...boards.flat().filter(c => c.owner === 'player').map(c => c.id),
      ...hand.map(c => c.id)
    ]);
    const drawPool = deck.cards.filter(cardKey => !usedCardIds.has(cards[cardKey].id));
    
    setHand([
      ...hand,
      ...drawPool.slice(0, 1).map(id => ({ ...cards[id], deck: deckId, owner: 'player' as const }))
    ]);
    
    setMessage('NEW ROUND. HYPE RECHARGED.');
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

      {screen === 'battle' && (
        <Battle 
          deck={deck} rivalDeck={rivalDeck} round={round} hype={hype} hand={hand} boards={boards}
          selected={selected} setSelected={setSelected} selectedLane={selectedLane} setSelectedLane={setSelectedLane}
          commit={commit} nextRound={nextRound} message={message} squabble={squabble} setSquabble={setSquabble} squabbleUsed={squabbleUsed} isResolving={isResolving}
          setInspect={setInspect} archiveMatch={() => setScreen('result')}
        />
      )}

      <AnimatePresence>
        {inspect && <CardInspector card={inspect} onClose={() => setInspect(null)} />}
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        {screen === 'result' && (
          <ResultScreen 
            onRestart={start} 
            onChangeDeck={() => setScreen('lobby')} 
            districts={districts} boards={boards} deckId={deckId} rivalDeck={rivalDeck}
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
