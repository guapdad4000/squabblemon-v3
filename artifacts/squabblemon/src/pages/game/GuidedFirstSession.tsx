import { useEffect, useRef, useState } from 'react';
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
import { loadFeedbackPreferences } from '../../battleFeedback';
import { playVoiceLine, stopSoundEffect } from '../../lib/sfx';

const homeLessons = [
  { target: '.safehouse-room-title', title: 'This is home.', body: 'Your Safehouse is where you return between fights. The objects in this room open the parts of your game.', next: 'Show me the story' },
  { target: '[aria-label="Explore the television"]', title: 'The television opens your story.', body: 'Tap Story. This is your main adventure: dialogue, battles, new cards, and chapter rewards.' },
  { target: '.safehouse-room-detail__body', title: 'One chapter at a time.', body: 'Start with Chapter 1. Follow the highlighted scene, then the next. New chapters open as you clear the story.', next: 'Find my gang' },
  { target: '.room-back', title: 'Back to your room.', body: 'Tap Back to the room. Your cards live right here in the Safehouse too.' },
  { target: '[aria-label="Explore your gang cards"]', title: 'These are your gang cards.', body: 'Tap Gang. Your collection is every card you own. Your deck is the ten cards you take into a battle.' },
  { target: '.safehouse-room-actions', title: 'Let’s build your first deck.', body: 'I have a free starter collection for you, including Alice, Tin Man, Scarecrow, and my Legendary card. We’ll start with ten, make one swap together, and save your gang.' },
];
export function GuidedFirstSession({ bootstrap, onCollect, onComplete }: { bootstrap: PlayerBootstrap; onCollect: () => void; onComplete: () => void }) {
  const [stage, setStage] = useState<'welcome' | 'home' | 'legendary' | 'deck' | 'battle'>(bootstrap.profile.starterDeckId === ROOKIE_FOUNDATION_ID ? 'legendary' : 'welcome');
  const [lesson, setLesson] = useState(0);
  const [playing, setPlaying] = useState<DeckDraft | null>(null);
  const save = useSavePlayerDeck();
  const queryClient = useQueryClient();
  const welcomeVoice = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (stage !== 'welcome') return;
    welcomeVoice.current = playVoiceLine('app-welcome', loadFeedbackPreferences().audioEnabled);
    return () => stopSoundEffect(welcomeVoice.current);
  }, [stage]);
  const saved = bootstrap.profile.savedDecks.find(deck => deck.id === ROOKIE_DECK_ID);
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
        onNext={item.next ? () => setLesson(lesson + 1) : undefined} nextLabel={item.next}
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
