import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingProgressInput, PlayerBootstrap, PlayerProfileOnboardingStep } from '@workspace/api-client-react';
import { useAdvancePlayerOnboarding } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { decks, getCardImage } from '../../data';
import { CardRarityTreatment, getCardRarity, getRarityClass } from '../../components/CardRarityTreatment';
import { PlayLoop } from '../../components/PlayLoop';
import { Link, useLocation } from 'wouter';

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
      if (payload.action === 'claim-reward') setLocation('/game/story');
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
      <TutorialStep
        turnTimerEnabled={bootstrap.profile.settings.turnTimerEnabled}
        equippedVariants={bootstrap.profile.equippedVariants}
        onComplete={() => void handleAdvance({ action: 'complete-tutorial' })}
      />,
    );
  }

  if (step === PlayerProfileOnboardingStep.crew) {
    return withStatus(<CrewStep onComplete={(deckId) => void handleAdvance({ action: 'choose-starter', starterDeckId: deckId })} />);
  }

  if (step === PlayerProfileOnboardingStep.reward) {
    return withStatus(<RewardStep onComplete={() => void handleAdvance({ action: 'claim-reward' })} />);
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

function TutorialStep({ turnTimerEnabled, equippedVariants, onComplete }: { turnTimerEnabled: boolean; equippedVariants: Record<string, string>; onComplete: () => void }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return <PlayLoop mode="tutorial" onExit={() => setPlaying(false)} onTutorialComplete={onComplete} hideLobby initialDeckId="vibes" initialRivalId="combo" turnTimerEnabled={turnTimerEnabled} equippedVariants={equippedVariants} />;
  }

  return (
    <div className="min-h-[100dvh] bg-[#070707] flex flex-col p-6 items-center justify-center relative text-center">
      <div className="noise-overlay" />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 max-w-sm w-full">
        <h1 className="font-display font-black italic text-5xl uppercase mb-4">The Setup</h1>
        <p className="text-white/60 text-sm mb-8">Before you hit the real streets, you need to know how the room works. Run a practice block to get familiar.</p>
        
        <button onClick={() => setPlaying(true)} className="w-full min-h-14 bg-primary text-black font-display font-black text-xl italic uppercase shadow-[0_4px_0_#854d0e] active:translate-y-1 active:shadow-none mb-4" style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}>
          Start Tutorial
        </button>

      </motion.div>
    </div>
  );
}

function CrewStep({ onComplete }: { onComplete: (id: string) => void }) {
  const [selected, setSelected] = useState(decks[0].id);
  const deck = decks.find(d => d.id === selected)!;

  return (
    <div className="min-h-[100dvh] bg-[#070707] flex flex-col relative overflow-hidden text-white font-sans">
      <div className="noise-overlay" />
      <div className="flex-1 overflow-y-auto pb-[120px] p-4 md:p-8 relative z-10">
        <div className="mb-6">
          <h1 className="font-display font-black italic text-4xl uppercase leading-none">Pick Your Crew</h1>
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest mt-2">This will be your starting deck</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {decks.map(d => {
            const rarity = getCardRarity(d.hero);
            return <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              aria-label={`${d.name}. Hero card is ${rarity} rarity`}
              className={`relative overflow-hidden border transition-all ${getRarityClass(rarity)} ${selected === d.id ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
              style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))', aspectRatio: '3/4' }}
            >
              <img src={getCardImage(d.hero)} alt="" className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity ${selected === d.id ? 'opacity-100' : 'opacity-40 grayscale'}`} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-2 pt-10 text-left">
                <div className={`font-mono text-[7px] uppercase tracking-wider ${selected === d.id ? 'text-primary' : 'text-white/50'}`}>{d.archetype}</div>
                <div className="font-display font-black text-sm uppercase leading-tight">{d.name}</div>
              </div>
              <CardRarityTreatment rarity={rarity} compact />
            </button>
          })}
        </div>

        <div className="bg-black/50 border border-white/10 p-5 relative">
          <div className="font-display font-black italic text-3xl uppercase mb-2">{deck.name}</div>
          <p className="text-white/70 text-sm mb-4">{deck.plan}</p>
          <div className="flex flex-wrap gap-2">
             {deck.cards.map(cId => (
               <span key={cId} className="px-2 py-1 bg-white/5 border border-white/10 font-mono text-[9px] uppercase tracking-widest text-white/50">{cId}</span>
             ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent z-20">
        <button 
          onClick={() => onComplete(selected)}
          className="w-full min-h-16 bg-primary text-black font-display font-black text-2xl italic uppercase shadow-[0_5px_0_#854d0e] active:translate-y-1 active:shadow-none"
          style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}
        >
          Claim {deck.name}
        </button>
      </div>
    </div>
  );
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
        <p className="text-white/60 mb-5">Your starter crew is locked in. This guaranteed drop is saved once, then Rookie Road is complete.</p>
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