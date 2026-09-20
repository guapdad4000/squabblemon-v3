import { revealProfileRewards } from '../../lib/rewardReceipts';
import { useState } from 'react';
import { GuidedFirstSession } from './GuidedFirstSession';
import { motion } from 'framer-motion';
import { OnboardingProgressInput, PlayerBootstrap, PlayerProfileOnboardingStep } from '@workspace/api-client-react';
import { useAdvancePlayerOnboarding } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { ROOKIE_FOUNDATION_ID, getCardImage } from '../../data';
import { FirstDeckWorkshop } from './FirstDeckWorkshop';
import { PlayLoop } from '../../components/PlayLoop';
import { Link, useLocation } from 'wouter';
import { DrFadePortrait, DR_FADE_LESSONS } from '../../components/DrFade';

export function Onboarding({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const step = bootstrap.profile.onboardingStep;
  const advance = useAdvancePlayerOnboarding();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  const handleAdvance = async (payload: OnboardingProgressInput) => {
    setError(null);
    try {
      const res = await advance.mutateAsync({ data: payload });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
      if (payload.action === 'claim-reward') { revealProfileRewards(bootstrap, res, 'onboarding', 'Your first haul'); setLocation('/game/story'); }
    } catch (e) {
      console.error(e);
      setError('The block could not save that step. Check your connection and try again.');
    }
  };

  const withStatus = (content: React.ReactNode) => (
    <>
      {content}
      {advance.isPending && (
        <div className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm grid place-items-center">
          <div className="font-mono text-[10px] text-primary uppercase tracking-[.25em]">Saving progress</div>
        </div>
      )}
      {error && (
        <div role="alert" className="fixed left-4 right-4 bottom-4 z-[95] max-w-lg mx-auto bg-accent text-white border border-rose-300 px-4 py-3 font-mono text-[10px] uppercase tracking-wider shadow-2xl">
          {error}
        </div>
      )}
    </>
  );

  if (step === PlayerProfileOnboardingStep.profile) {
    return withStatus(<ProfileStep onComplete={(data) => void handleAdvance({ action: 'accept-terms', ...data })} />);
  }

  if (step === PlayerProfileOnboardingStep.tutorial) {
    return withStatus(
      <GuidedFirstSession bootstrap={bootstrap} onCollect={() => void handleAdvance({ action: 'choose-starter', starterDeckId: ROOKIE_FOUNDATION_ID })} onComplete={() => void handleAdvance({ action: 'complete-tutorial' })} />,
    );
  }

  if (step === PlayerProfileOnboardingStep.crew) {
    return withStatus(<CrewStep onComplete={(deckId) => void handleAdvance({ action: 'choose-starter', starterDeckId: deckId })} />);
  }

  if (step === PlayerProfileOnboardingStep.reward) {
    return withStatus(bootstrap.profile.starterDeckId === ROOKIE_FOUNDATION_ID ? <FirstDeckWorkshop bootstrap={bootstrap} onComplete={() => void handleAdvance({ action: 'claim-reward' })} /> : <RewardStep onComplete={() => void handleAdvance({ action: 'claim-reward' })} />);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-black text-white">
      <Link href="/game/story" className="bg-primary text-black px-6 py-3 font-display font-black italic uppercase">Enter Chapter One</Link>
    </div>
  );
}

function ProfileStep({ onComplete }: { onComplete: (data: any) => void }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-[#070707] flex flex-col p-6 items-center justify-center relative">
      <div className="noise-overlay" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm relative z-10">
        <h1 className="font-display font-black italic text-4xl uppercase mb-2">Create Profile</h1>
        <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest mb-8">What should the streets call you?</p>

        <label className="block mb-6">
          <span className="font-mono text-[9px] text-white/60 uppercase tracking-wider mb-2 block">Display Name</span>
          <input 
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-zinc-900 border border-white/20 text-white p-3 font-display font-bold uppercase focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            placeholder="e.g. THA_TRUTH"
            maxLength={24}
          />
        </label>

        <div className="space-y-4 mb-8">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={age} onChange={e => setAge(e.target.checked)} className="w-5 h-5 accent-primary bg-zinc-900 border-white/20" />
            <span className="font-sans text-sm text-white/80">I am at least 13 years old.</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="w-5 h-5 accent-primary bg-zinc-900 border-white/20" />
            <span className="font-sans text-sm text-white/80">I accept the Terms of Service.</span>
          </label>
        </div>

        <button 
          onClick={() => onComplete({ displayName: name, ageConfirmed: age, termsAccepted: terms })}
          disabled={name.trim().length < 2 || !age || !terms}
          className="w-full min-h-14 bg-primary text-black font-display font-black text-xl italic uppercase shadow-[0_4px_0_#854d0e] active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#854d0e]"
          style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}
        >
          Confirm
        </button>
      </motion.div>
    </div>
  );
}

export function TutorialStep({ turnTimerEnabled, equippedVariants, onComplete }: { turnTimerEnabled: boolean; equippedVariants: Record<string, string>; onComplete: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [lesson, setLesson] = useState(0);
  const currentLesson = DR_FADE_LESSONS[lesson];

  if (playing) {
    return <PlayLoop mode="tutorial" onExit={() => setPlaying(false)} onTutorialComplete={onComplete} hideLobby initialDeckId="vibes" initialRivalId="combo" turnTimerEnabled={turnTimerEnabled} equippedVariants={equippedVariants} />;
  }

  return (
    <div className="dr-fade-intro" data-testid="dr-fade-intro">
      <div className="dr-fade-intro__figure"><DrFadePortrait /><span>DR. FADE</span></div>
      <section className="dr-fade-intro__lesson" aria-label="Dr. Fade’s tutorial">
        <span className="venue-kicker">ROOKIE ROAD / YOUR FIRST LESSON</span>
        <p className="dr-fade-intro__byline">Dr. Fade · Your coach</p>
        <div aria-live="polite" aria-atomic="true"><h1>{currentLesson.title}</h1><p>{currentLesson.text}</p></div>
        <nav className="dr-fade-intro__steps" aria-label="Tutorial lessons">
          {DR_FADE_LESSONS.map((item, index) => <button key={item.title} onClick={() => setLesson(index)} aria-label={`Lesson ${index + 1}: ${item.title}`} aria-current={lesson === index ? 'step' : undefined}>{index + 1}</button>)}
        </nav>
        <div className="dr-fade-intro__actions">
          {lesson > 0 && <button className="venue-button" onClick={() => setLesson(lesson - 1)}>Back</button>}
          {lesson < DR_FADE_LESSONS.length - 1 ? <button className="venue-button venue-button--gold" onClick={() => setLesson(lesson + 1)}>Next lesson</button> : <button className="venue-button venue-button--gold" onClick={() => setPlaying(true)}>Start Tutorial</button>}
        </div>
        {lesson < DR_FADE_LESSONS.length - 1 && <button className="venue-text-button" onClick={() => setPlaying(true)}>Start Tutorial</button>}
      </section>
    </div>
  );
}

function CrewStep({ onComplete }: { onComplete: (id: string) => void }) {
  return <section className="rookie-review"><div>
    <img src={getCardImage('dr-fade')} alt="Dr. Fade" />
    <span className="venue-kicker">ROOKIE ROAD / YOUR COLLECTION</span>
    <h1>Make it your gang.</h1>
    <p>You’ve learned the fade. Now choose who you bring. Your first collection includes 21 cards, including Legendary Dr. Fade, to mix, match, and make your own.</p>
    <p>We’ll put ten on the table to get you started. Every slot is editable, and your cover character is your choice.</p>
    <nav><button className="venue-button venue-button--gold" onClick={() => onComplete(ROOKIE_FOUNDATION_ID)}>Open my card collection</button></nav>
  </div></section>;
}

function RewardStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-[#070707] flex flex-col p-6 items-center justify-center relative text-center">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.15),transparent_60%)]" />
      
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 w-full max-w-sm">
        <div className="w-24 h-24 mx-auto bg-primary/20 border-2 border-primary rotate-12 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(250,204,21,0.3)]">
          <span className="font-display font-black italic text-5xl text-primary -rotate-12">XP</span>
        </div>
        
        <h1 className="font-display font-black italic text-4xl uppercase mb-3">Welcome to the Streets</h1>
        <p className="text-white/60 mb-5">Your cards are yours to mix and match. This guaranteed drop is saved once, then Rookie Road is complete.</p>
        <div className="grid grid-cols-3 gap-2 mb-8">
          {[
            ['+100', 'XP'],
            ['+250', 'Clout'],
            ['+1', 'Pack ticket'],
          ].map(([amount, label]) => (
            <div key={label} className="bg-black/55 border border-white/10 px-2 py-3">
              <div className="font-display font-black text-xl text-primary">{amount}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-white/50">{label}</div>
            </div>
          ))}
        </div>

        <button 
          onClick={onComplete}
          className="w-full min-h-14 bg-primary text-black font-display font-black text-xl italic uppercase shadow-[0_4px_0_#854d0e] active:translate-y-1 active:shadow-none"
          style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}
        >
          Claim Rewards
        </button>
      </motion.div>
    </div>
  );
}
