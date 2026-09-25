import { useState } from 'react';
import { DrFadeWelcome } from '../../components/DrFadeWelcome';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, useSavePlayerDeck, type PlayerBootstrap } from '@workspace/api-client-react';
import { ROOKIE_DECK_ID, ROOKIE_FOUNDATION_ID } from '../../data';
import { Home } from './Home';
import { getAssetUrl } from '../../lib/assets';
import { DrFadePortrait } from '../../components/DrFade';
import { CoachSpotlight } from '../../components/CoachSpotlight';
import { DeckWorkbench } from '../../components/DeckWorkbench';
import { PlayLoop } from '../../components/PlayLoop';
import type { DeckDraft } from '../../lib/deckWorkshop';
import { tutorialScript } from '../../lib/tutorialVoice';
import { useTutorialVoice } from '../../lib/useTutorialVoice';
import homeLessons from '../../lib/safehouseTour.json';

export function GuidedFirstSession({ bootstrap, onCollect, onComplete }: { bootstrap: PlayerBootstrap; onCollect: () => void; onComplete: () => void }) {
  const [stage, setStage] = useState<'welcome' | 'home' | 'legendary' | 'deck' | 'battle'>(bootstrap.profile.starterDeckId === ROOKIE_FOUNDATION_ID ? 'legendary' : 'welcome');
  const [lesson, setLesson] = useState(0);
  const [playing, setPlaying] = useState<DeckDraft | null>(null);
  const save = useSavePlayerDeck();
  const queryClient = useQueryClient();
  const saved = bootstrap.profile.savedDecks.find(deck => deck.id === ROOKIE_DECK_ID);
  useTutorialVoice(stage === 'welcome' && !saved ? tutorialScript('welcome', 'welcome-reassurance') : null);
  const persist = async (draft: DeckDraft) => {
    const res = await save.mutateAsync({ deckId: ROOKIE_DECK_ID, data: draft });
    queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
  };
  if (stage === 'battle' && playing) return <PlayLoop mode="tutorial" hideLobby turnTimerEnabled={false}
    initialDeckId={ROOKIE_DECK_ID} initialRivalId="vibes" equippedVariants={bootstrap.profile.equippedVariants}
    customPlayerDeck={{ id: ROOKIE_DECK_ID, name: playing.name, cards: playing.cardIds, hero: playing.heroCardId, archetype: 'Your first gang', accent: 'ROOKIE', plan: 'Follow Dr. Fade’s highlighted moves.' }}
    onExit={() => setStage('deck')} onTutorialComplete={onComplete} />;
  if (saved && stage !== 'deck' && saved.cardIds.includes('dr-fade')) return <DrFadeWelcome onContinue={() => setStage('deck')} />;
  if (saved && (stage === 'deck' || stage === 'home' || stage === 'legendary')) return <div className="rookie-workshop">
    <DeckWorkbench initial={saved} ownedCardIds={bootstrap.profile.ownedCardIds} equippedVariants={bootstrap.profile.equippedVariants}
      lesson onSave={persist} onTest={async draft => { await persist(draft); setPlaying(draft); setStage('battle'); }} />
  </div>;
  if (stage === 'home') {
    const item = homeLessons[lesson];
    return <div className="rookie-home-tour">
      <Home bootstrap={bootstrap} onGuideComplete={onCollect} />
      <CoachSpotlight target={item.target} title={item.title} step={'HOME ' + (lesson + 1) + ' / ' + homeLessons.length}
        onNext={item.next ? () => setLesson(lesson + 1) : undefined} nextLabel={item.next ?? undefined}
        onTarget={!item.next && lesson < homeLessons.length - 1 ? () => setLesson(lesson + 1) : undefined}>{item.body}</CoachSpotlight>
    </div>;
  }
  return <main className="rookie-tour" style={{ backgroundImage: 'linear-gradient(90deg,#07100eef,#07100e90),url("' + getAssetUrl('scenes/safehouse/concept.png') + '")', backgroundSize: 'cover', backgroundPosition: 'center' }} data-testid="rookie-welcome"><div className="rookie-tour__welcome">
    <section><span className="fade-eyebrow">ROOKIE ROAD / WELCOME TO THE BLOCK</span><h1>You belong<br />on this block.</h1>
      <p>I’m Dr. Fade. I’ll show you around, help you build your first gang, and stay beside you through your first win. One move at a time.</p>
      <div className="rookie-tour__steps"><span>01 · Find your feet</span><span>02 · Build your gang</span><span>03 · First battle</span></div>
      <button className="venue-button venue-button--gold" onClick={() => setStage('home')}>Show me around</button>
      <p className="text-sm">No timer. No purchases. We’ll learn by playing.</p>
    </section><DrFadePortrait />
  </div></main>;
}
