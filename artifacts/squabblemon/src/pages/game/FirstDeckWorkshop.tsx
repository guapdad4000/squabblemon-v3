import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, useSavePlayerDeck, type PlayerBootstrap } from '@workspace/api-client-react';
import { ROOKIE_DECK_ID, ROOKIE_CORE_IDS, catalogCardById, getCardImage } from '../../data';
import { DeckWorkbench } from '../../components/DeckWorkbench';
import { PlayLoop } from '../../components/PlayLoop';
import { summarizeDeckTest, type DeckDraft } from '../../lib/deckWorkshop';
import type { Match } from '../../gameEngine';
import { trackEvent } from '../../lib/analytics';
import { WELCOME_REWARD } from '@workspace/squabblemon-engine/economy';
import { rookieRoadCues } from '../../lib/tutorialVoice';
import { useTutorialVoice } from '../../lib/useTutorialVoice';
import { Link } from 'wouter';

export function FirstDeckWorkshop({ bootstrap, onComplete }: { bootstrap: PlayerBootstrap; onComplete: () => void }) {
  const save = useSavePlayerDeck();
  const queryClient = useQueryClient();
  const saved = bootstrap.profile.savedDecks.find(deck => deck.id === ROOKIE_DECK_ID);
  const [latestDraft, setLatestDraft] = useState<DeckDraft>(() => saved
    ? { name: saved.name, cardIds: [...saved.cardIds], heroCardId: saved.heroCardId, recipeId: saved.recipeId }
    : { name: 'My First Gang', cardIds: [...ROOKIE_CORE_IDS], heroCardId: 'hooper', recipeId: null });
  const [playing, setPlaying] = useState<DeckDraft | null>(null);
  const [fightBrief, setFightBrief] = useState(false);
  const [focus, setFocus] = useState(saved?.cardIds.find((id, index) => id !== ROOKIE_CORE_IDS[index]) ?? 'hooper');
  const [result, setResult] = useState<Match | null>(null);
  const [review, setReview] = useState(bootstrap.nextAction.id === 'rookie-tested');
  const [primer, setPrimer] = useState(bootstrap.nextAction.id !== 'rookie-tested');
  const tested = !!result || bootstrap.nextAction.id === 'rookie-tested';
  useTutorialVoice('Rookie Road practice review', !playing && review && tested, rookieRoadCues('practice-review'));
  useTutorialVoice('Rookie Road welcome reward', !playing && primer && !tested, rookieRoadCues('reward-primer'));
  const progressionPrimer = <details className="rookie-progression-primer">
    <summary>What do my rewards do?</summary>
    <ul>
      <li><b>Clout</b> pays for eligible cards, packs and character coaching. It is not a combat stat.</li>
      <li><b>Profile XP</b> grows your account level; <b>Street Rep</b> records separate account progress.</li>
      <li><b>Character XP</b> belongs to an individual card; level milestones unlock coaching options, not automatic Base Hands or cost increases.</li>
      <li><b>Pack tickets</b> open packs. Check the Field Guide or pack screen for current odds before spending.</li>
      <li><b>Style Shards</b> unlock cosmetic card styles, not extra Hands or Motion.</li>
    </ul>
    <Link href="/how-to-play">Read the full Field Guide</Link>
  </details>;
  async function persist(draft: DeckDraft) {
    const res = await save.mutateAsync({ deckId: ROOKIE_DECK_ID, data: draft });
    queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
  }
  if (playing && fightBrief) return <section className="rookie-review" data-testid="rookie-practice-brief"><div>
    <img src={getCardImage(playing.heroCardId)} alt={`${playing.name} cover`} />
    <span className="venue-kicker">ROOKIE ROAD / PRACTICE GOAL</span>
    <h1>Try your idea.</h1>
    <p>Practice goal: see whether {catalogCardById[focus]?.name ?? 'your selected card'}’s ability helps your plan. No win is required, and this practice does not claim the welcome reward.</p>
    <p>The first five cards open your hand; the remaining five draw in rounds two through six. Your saved ten-card lineup and cover are ready.</p>
    <nav><button className="venue-button" onClick={() => { setPlaying(null); setFightBrief(false); }}>Back to setup lesson</button>{!tested && <button className="venue-button" onClick={() => { setPlaying(null); setFightBrief(false); setPrimer(true); }}>Back to reward choices</button>}<button className="venue-button venue-button--gold" data-testid="button-start-practice-fade" onClick={() => setFightBrief(false)}>Start practice fade</button></nav>
  </div></section>;
  if (playing) return <PlayLoop mode="practice" hideLobby turnTimerEnabled={false} initialDeckId={ROOKIE_DECK_ID}
    customPlayerDeck={{ id: ROOKIE_DECK_ID, name: playing.name, cards: playing.cardIds, hero: playing.heroCardId, archetype: 'Your gang', accent: 'TEST', plan: 'Try your idea. There is no win requirement.' }}
    equippedVariants={bootstrap.profile.equippedVariants} onVerifiedComplete={match => { setResult(match); trackEvent('rookie_test_completed', { rounds: match.round }); }}
     onExit={() => { setPlaying(null); setFightBrief(false); setReview(tested); setPrimer(!tested); }} />;
  if (review && tested) return <section className="rookie-review"><div>
     <img src={getCardImage(saved?.heroCardId || 'hooper')} alt={`${saved?.name ?? 'Your gang'} cover`} />
    <span className="venue-kicker">ROOKIE ROAD / LESSON COMPLETE</span><h1>You built this gang.</h1>
     <p>{result ? summarizeDeckTest(result, focus) : 'Your first practice fade is saved. Review what happened, adjust your lineup, or head to Chapter One when you’re ready.'}</p>
     <p>Keep what worked. Change what didn’t. Your setup lesson is here whenever you want to revisit draw order, card details, cover art, or a planned swap.</p>
     <p data-testid="text-rookie-reward">Welcome reward primer — claim it when you’re ready: {WELCOME_REWARD.accountXp} account XP · {WELCOME_REWARD.softCurrency} Clout · {WELCOME_REWARD.packTickets} Street Pack ticket. Your {ROOKIE_CORE_IDS.length}-card starter gang is already yours; practice does not claim this reward.</p>
     {progressionPrimer}
     <nav><button className="venue-button" data-testid="button-review-setup-lesson" onClick={() => setReview(false)}>Review setup lesson</button><button className="venue-button" data-testid="button-practice-another-fade" onClick={() => { setReview(false); setResult(null); setPlaying(latestDraft); setFightBrief(true); }}>Practice another fade</button><button className="venue-button venue-button--gold" data-testid="button-claim-reward-enter-story" onClick={onComplete}>Claim reward & enter Chapter One</button></nav>
  </div></section>;
  if (primer && !tested) return <section className="rookie-review" data-testid="rookie-reward-primer"><div>
    <img src={getCardImage(latestDraft.heroCardId)} alt={`${latestDraft.name} cover`} />
    <span className="venue-kicker">ROOKIE ROAD / YOUR WELCOME REWARD</span>
    <h1>Your first haul is ready.</h1>
    <p data-testid="text-rookie-reward">Welcome reward: {WELCOME_REWARD.accountXp} account XP · {WELCOME_REWARD.softCurrency} Clout · {WELCOME_REWARD.packTickets} Street Pack ticket. It is not claimed until you choose Chapter One.</p>
    <p>Your ten-card starter gang is already yours. Review the setup lesson or take your saved gang into a no-pressure practice fade first. Practice does not claim this reward.</p>
    {progressionPrimer}
    <nav><button className="venue-button" data-testid="button-review-setup-lesson" onClick={() => setPrimer(false)}>Review setup lesson</button><button className="venue-button" data-testid="button-practice-another-fade" onClick={() => { setPlaying(latestDraft); setFightBrief(true); setPrimer(false); }}>Practice a fade</button><button className="venue-button venue-button--gold" data-testid="button-claim-reward-enter-story" onClick={onComplete}>Claim reward & enter Chapter One</button></nav>
  </div></section>;
  return <div className="rookie-workshop">
    {tested && <div className="p-4 bg-black text-white"><button className="venue-button" onClick={() => setReview(true)}>Continue from your saved practice fade</button></div>}
    <DeckWorkbench key={ROOKIE_DECK_ID} initial={saved ?? { name: 'My First Gang', cardIds: [...ROOKIE_CORE_IDS], heroCardId: 'hooper', recipeId: null }}
      ownedCardIds={bootstrap.profile.ownedCardIds} equippedVariants={bootstrap.profile.equippedVariants} lesson
       onSave={persist} onTest={async (draft, cardId) => { await persist(draft); setLatestDraft({ ...draft, cardIds: [...draft.cardIds] }); setFocus(cardId); setResult(null); setPlaying(draft); setFightBrief(true); }} />
  </div>;
}
