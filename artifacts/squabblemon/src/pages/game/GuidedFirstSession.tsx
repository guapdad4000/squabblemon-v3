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
import { rookieRoadCues, tutorialScript } from '../../lib/tutorialVoice';
import { useTutorialVoice } from '../../lib/useTutorialVoice';
import homeLessons from '../../lib/safehouseTour.json';

export function RookieHandoff({ onReview, onComplete }: { onReview: () => void; onComplete: () => void }) {
  useTutorialVoice('Rookie Road handoff', true, rookieRoadCues('handoff'));
  return <section className="rookie-review" data-testid="rookie-post-fight-handoff">
    <div>
      <img src={getAssetUrl('scenes/safehouse/concept.png')} alt="" />
      <span className="venue-kicker">ROOKIE ROAD / FIRST FADE COMPLETE</span>
      <h1>You took your first fight.</h1>
      <p>Your ten-card gang and chosen cover are saved. You can come back to your deck lesson and lineup before another fade.</p>
      <p>Next up: review your welcome reward, run a no-pressure practice fade, or head into Chapter One.</p>
      <nav><button className="venue-button" onClick={onReview}>Review my gang</button><button className="venue-button venue-button--gold" onClick={onComplete}>See reward & next steps</button></nav>
    </div>
  </section>;
}

export function GuidedFirstSession({ bootstrap, onCollect, onComplete }: { bootstrap: PlayerBootstrap; onCollect: () => void; onComplete: () => void }) {
  const [stage, setStage] = useState<'welcome' | 'home' | 'legendary' | 'deck' | 'fight-brief' | 'battle' | 'handoff'>(bootstrap.profile.starterDeckId === ROOKIE_FOUNDATION_ID ? 'legendary' : 'welcome');
  const [lesson, setLesson] = useState(0);
  const [playing, setPlaying] = useState<DeckDraft | null>(null);
  const save = useSavePlayerDeck();
  const queryClient = useQueryClient();
  const saved = bootstrap.profile.savedDecks.find(deck => deck.id === ROOKIE_DECK_ID);
  useTutorialVoice(stage === 'welcome' && !saved ? tutorialScript('welcome', 'welcome-reassurance') : null);
  useTutorialVoice(stage === 'fight-brief' ? stage : null,
    stage === 'fight-brief', rookieRoadCues(stage));
  const persist = async (draft: DeckDraft) => {
    const res = await save.mutateAsync({ deckId: ROOKIE_DECK_ID, data: draft });
    queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
  };
  if (stage === 'battle' && playing) return <PlayLoop mode="tutorial" hideLobby turnTimerEnabled={false}
    initialDeckId={ROOKIE_DECK_ID} initialRivalId="vibes" equippedVariants={bootstrap.profile.equippedVariants}
    customPlayerDeck={{ id: ROOKIE_DECK_ID, name: playing.name, cards: playing.cardIds, hero: playing.heroCardId, archetype: 'Your first gang', accent: 'ROOKIE', plan: 'Follow Dr. Fade’s highlighted moves.' }}
    onExit={() => setStage('deck')} onTutorialComplete={() => setStage('handoff')} />;
  if (stage === 'fight-brief' && playing) return <section className="rookie-review" data-testid="rookie-fight-brief">
    <div>
      <img src={getAssetUrl('scenes/safehouse/concept.png')} alt="" />
      <span className="venue-kicker">ROOKIE ROAD / BEFORE THE FADE</span>
      <h1>Your first fight goal.</h1>
      <p>Finish ahead in at least two of the three districts to win; a tied district belongs to neither side. The rival plays at the top of the board, your gang at the bottom. Each district shows Rival and You scores. Total Hands across all three districts alone cannot win the match.</p>
      <p>Dr. Fade will guide each move in this four-round fight with no timer and a limited rival. Most normal fights last six rounds, allow multiple affordable cards per turn and may have different rules or a clock.</p>
      <p>Your saved ten-card gang and cover go into this fight. The first five cards are your opening hand; later cards draw at the start of each new round while cards remain. Inspect cards without playing them.</p>
      <nav><button className="venue-button" onClick={() => { setPlaying(null); setStage('deck'); }}>Back to my gang</button><button data-testid="button-start-guided-fight" className="venue-button venue-button--gold" onClick={() => setStage('battle')}>Start guided fight</button></nav>
    </div>
  </section>;
  if (stage === 'handoff') return <RookieHandoff onReview={() => setStage('deck')} onComplete={onComplete} />;
  if (saved && stage !== 'deck' && saved.cardIds.includes('dr-fade')) return <DrFadeWelcome onContinue={() => setStage('deck')} />;
  if (saved && (stage === 'deck' || stage === 'home' || stage === 'legendary')) return <div className="rookie-workshop">
    <DeckWorkbench initial={saved} ownedCardIds={bootstrap.profile.ownedCardIds} equippedVariants={bootstrap.profile.equippedVariants}
      lesson onSave={persist} onTest={async draft => { await persist(draft); setPlaying(draft); setStage('fight-brief'); }} />
  </div>;
  if (stage === 'home') {
    const item = homeLessons[lesson];
    return <div className="rookie-home-tour">
      <Home bootstrap={bootstrap} onGuideComplete={onCollect} />
       <CoachSpotlight target={item.target} title={item.title} step={'HOME ' + (lesson + 1) + ' / ' + homeLessons.length}
         voiceIds={item.id === 'home-5' ? rookieRoadCues(item.id) : undefined}
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
