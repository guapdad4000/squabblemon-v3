import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, useSavePlayerDeck, type PlayerBootstrap } from '@workspace/api-client-react';
import { ROOKIE_DECK_ID, ROOKIE_CORE_IDS, getCardImage } from '../../data';
import { DeckWorkbench } from '../../components/DeckWorkbench';
import { PlayLoop } from '../../components/PlayLoop';
import { summarizeDeckTest, type DeckDraft } from '../../lib/deckWorkshop';
import type { Match } from '../../gameEngine';
import { trackEvent } from '../../lib/analytics';

export function FirstDeckWorkshop({ bootstrap, onComplete }: { bootstrap: PlayerBootstrap; onComplete: () => void }) {
  const save = useSavePlayerDeck();
  const queryClient = useQueryClient();
  const saved = bootstrap.profile.savedDecks.find(deck => deck.id === ROOKIE_DECK_ID);
  const [playing, setPlaying] = useState<DeckDraft | null>(null);
  const [focus, setFocus] = useState(saved?.cardIds.find((id, index) => id !== ROOKIE_CORE_IDS[index]) ?? 'hooper');
  const [result, setResult] = useState<Match | null>(null);
  const [review, setReview] = useState(bootstrap.nextAction.id === 'rookie-tested');
  const tested = !!result || bootstrap.nextAction.id === 'rookie-tested';
  async function persist(draft: DeckDraft) {
    const res = await save.mutateAsync({ deckId: ROOKIE_DECK_ID, data: draft });
    queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
  }
  if (playing) return <PlayLoop mode="practice" hideLobby turnTimerEnabled={false} initialDeckId={ROOKIE_DECK_ID}
    customPlayerDeck={{ id: ROOKIE_DECK_ID, name: playing.name, cards: playing.cardIds, hero: playing.heroCardId, archetype: 'Your gang', accent: 'TEST', plan: 'Try your idea. There is no win requirement.' }}
    equippedVariants={bootstrap.profile.equippedVariants} onVerifiedComplete={match => { setResult(match); trackEvent('rookie_test_completed', { rounds: match.round }); }}
    onExit={() => { setPlaying(null); setReview(tested); }} />;
  if (review && tested) return <section className="rookie-review"><div>
    <img src={getCardImage(saved?.heroCardId || 'hooper')} alt="Your gang cover" />
    <span className="venue-kicker">ROOKIE ROAD / YOUR FIRST TEST</span><h1>You built this gang.</h1>
    <p>{result ? summarizeDeckTest(result, focus) : 'Your first practice fade is saved. You can keep this gang or revisit the card table before entering the story.'}</p>
    <p>Keep what worked. Change what didn’t. Every card in your collection can be part of your next idea.</p>
    <p>Welcome reward: 100 XP · 250 Clout · 1 pack ticket</p>
    <nav><button className="venue-button" onClick={() => setReview(false)}>Back to my deck</button><button className="venue-button venue-button--gold" onClick={onComplete}>Claim reward & enter Chapter One</button></nav>
  </div></section>;
  return <div className="rookie-workshop">
    {tested && <div className="p-4 bg-black text-white"><button className="venue-button" onClick={() => setReview(true)}>Continue from your saved practice fade</button></div>}
    <DeckWorkbench key={ROOKIE_DECK_ID} initial={saved ?? { name: 'My First Gang', cardIds: [...ROOKIE_CORE_IDS], heroCardId: 'hooper', recipeId: null }}
      ownedCardIds={bootstrap.profile.ownedCardIds} equippedVariants={bootstrap.profile.equippedVariants} lesson
      onSave={persist} onTest={async (draft, cardId) => { await persist(draft); setFocus(cardId); setResult(null); setPlaying(draft); }} />
  </div>;
}
