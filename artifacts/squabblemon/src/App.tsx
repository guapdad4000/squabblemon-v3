import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelpCircle, Volume2, VolumeX } from 'lucide-react';
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
  const [sound, setSound] = useState(true); 
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
    <main className="h-[100dvh] game-bg text-white font-sans flex flex-col relative overflow-hidden">
      <div className="noise-overlay" />
      
      {/* Global Topbar */}
      <header className="h-14 md:h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-6 z-40 bg-black/40 backdrop-blur-md shrink-0">
        <div className="font-display font-bold text-lg md:text-xl tracking-wide uppercase">
          Squabble<em className="text-primary not-italic">mon</em>
        </div>
        <div className="hidden sm:block font-mono text-[10px] tracking-[0.2em] text-white/30">
          SBL // HUMAN PLAYTEST 0.4
        </div>
        <div className="flex gap-3 md:gap-4">
          <button data-testid="button-rules" onClick={() => setShowRules(true)} className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-mono tracking-widest text-white/50 hover:text-white transition-colors">
            <HelpCircle size={14} /> <span className="hidden sm:inline">RULES</span>
          </button>
          <button data-testid="button-sound" onClick={() => setSound(!sound)} className="text-white/50 hover:text-white transition-colors">
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </header>

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
