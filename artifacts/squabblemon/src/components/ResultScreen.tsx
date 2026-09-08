import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cards, decks, getAssetUrl, getCardImage } from '../data';
import { Match, getDistrictResults, getMatchWinner } from '../gameEngine';
import { StoryCinematic } from './StoryCinematic';
import { getEquippedVariant, getVariantKind } from './CardVariantTreatment';

export function ResultScreen({ onRestart, onChangeDeck, onGoHome, onRetryReward, match, districts, reward, rewardError, rewardPending, isGuest, customPlayerDeck, storyMetadata, equippedVariants }: any) {
  const m = match as Match;
  const results = getDistrictResults(m);
  const winner = getMatchWinner(m);

  const isVictory = winner === 'player';
  const isDraw = winner === 'draw';

  const isStory = !!m.storyEncounter;
  const isBoss = m.storyEncounter?.id === 'cracked-head-takes-the-block';

  const [victoryCinematicFinished, setVictoryCinematicFinished] = useState(false);
  const showVictoryCinematic = isStory && isBoss && isVictory && !victoryCinematicFinished;

  const playerDeck = customPlayerDeck || decks.find(deck => deck.id === m.playerDeck) || decks[0];
  const cpuDeck = decks.find(deck => deck.id === m.cpuDeck) ?? {
    ...decks[0],
    id: m.cpuDeck,
    name: m.storyEncounter?.enemy.name ?? 'Story Rival',
    hero: cards[m.cpuCardIds[0]]?.id ?? decks[0].hero,
  };
  const cpuPortrait = m.storyEncounter
    ? getAssetUrl(m.storyEncounter.enemy.portraitAssetId)
    : getCardImage(cpuDeck.hero);
  const earnedStars = isVictory
    ? 1 + (results.every((result) => result.winner === 'player') ? 1 : 0) + (m.squabbleUsed ? 0 : 1)
    : 0;

  if (showVictoryCinematic) {
    return (
      <StoryCinematic
        source="assets/story/chapter-one/media/cracked-head-finale.mp4"
        poster="assets/story/chapter-one/media/cracked-head-finale.webp"
        title="Area Secured"
        eyebrow="Victory"
        onComplete={() => setVictoryCinematicFinished(true)}
        onSkip={() => setVictoryCinematicFinished(true)}
        duration={6200}
      />
    );
  }

  const environmentBg = isStory && m.storyEncounter?.cinematic?.environmentAssetId
    ? getAssetUrl(m.storyEncounter.cinematic.environmentAssetId)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-5 md:p-8 text-center overflow-x-hidden overflow-y-auto hide-scrollbar">
      <div className={`absolute inset-0 ${isVictory ? 'bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.28),rgba(0,0,0,0.93)_72%)]' : isDraw ? 'bg-[radial-gradient(circle_at_center,rgba(113,113,122,0.24),rgba(0,0,0,0.94)_72%)]' : 'bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.24),rgba(0,0,0,0.94)_72%)]'}`} />
      {environmentBg && (
        <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay" style={{ backgroundImage: `url("${environmentBg}")` }} />
      )}
      <div className="absolute inset-x-[-20%] top-1/2 h-24 -rotate-6 bg-gradient-to-r from-transparent via-primary/15 to-transparent blur-xl pointer-events-none" />

      <motion.img
        initial={{ opacity: 0, x: -80 }}
        animate={{ opacity: 0.42, x: 0 }}
        transition={{ duration: 0.75 }}
        src={getCardImage(playerDeck.hero)}
        alt=""
        aria-hidden="true"
        className={`fixed -left-[8%] md:left-[1%] bottom-[-8%] h-[70%] md:h-[88%] w-[48%] object-contain object-left-bottom drop-shadow-[0_20px_30px_rgba(0,0,0,0.9)] pointer-events-none z-0 variant-portrait-${getVariantKind(getEquippedVariant(equippedVariants, playerDeck.hero)) ?? 'base'}`}
      />
      <motion.img
        initial={{ opacity: 0, x: 80 }}
        animate={{ opacity: 0.25, x: 0 }}
        transition={{ duration: 0.75 }}
        src={cpuPortrait}
        alt=""
        aria-hidden="true"
        className="fixed -right-[8%] md:right-[1%] bottom-[-8%] h-[70%] md:h-[88%] w-[48%] object-contain object-right-bottom grayscale brightness-75 drop-shadow-[0_20px_30px_rgba(0,0,0,0.9)] pointer-events-none z-0"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 max-w-2xl w-full py-6 md:py-10"
      >
        <div className="font-mono text-primary text-[9px] md:text-xs tracking-[0.32em] uppercase mb-4 md:mb-6">Match Archive // Complete</div>

        <motion.div
          initial={{ rotate: -18, scale: 0 }}
          animate={{ rotate: -4, scale: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 15, delay: 0.12 }}
          className={`mx-auto w-20 h-20 md:w-36 md:h-36 grid place-items-center border-4 md:border-[6px] text-[64px] md:text-[118px] font-display font-black italic leading-none mb-5 shadow-[0_0_60px_rgba(0,0,0,0.8)] ${isVictory ? 'text-black bg-primary border-white' : isDraw ? 'text-white bg-zinc-700 border-zinc-300' : 'text-white bg-accent border-rose-300'}`}
          style={{ clipPath: 'polygon(50% 0, 88% 12%, 100% 50%, 88% 88%, 50% 100%, 12% 88%, 0 50%, 12% 12%)' }}
        >
          {isVictory ? 'W' : isDraw ? 'D' : 'L'}
        </motion.div>

        <h2 data-testid="status-match-result" className="text-3xl md:text-6xl font-display font-black italic uppercase leading-none mb-3 drop-shadow-[0_5px_0_rgba(0,0,0,0.85)]">
          {isVictory ? 'You Won The Room' : isDraw ? 'Nobody Owns The Room' : 'You Got Cleared'}
        </h2>

        <div className="grid grid-cols-3 gap-1.5 md:gap-4 mb-7 md:mb-10">
          {results.map((r, i) => (
            <div key={i} className={`p-2.5 md:p-4 border backdrop-blur-md ${r.winner === 'player' ? 'border-primary bg-primary/15' : 'border-white/15 bg-black/70'}`} style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}>
              <div className="text-[7px] md:text-[10px] font-mono tracking-widest text-white/50 mb-1 md:mb-2 truncate">{districts[i].name}</div>
              <div className="font-display font-black text-xl md:text-3xl mb-1">{r.player} <span className="text-white/30 text-sm md:text-lg mx-0.5 md:mx-1">-</span> {r.cpu}</div>
               <div className={`text-[7px] md:text-[10px] font-bold uppercase tracking-widest ${r.winner === 'player' ? 'text-primary' : 'text-white/40'}`}>
                 {r.winner === 'player' ? 'Secured' : r.winner === 'draw' ? 'Dead Heat' : 'Lost'}
              </div>
            </div>
          ))}
        </div>

        {isStory ? (
          <div className="mb-8 border border-white/10 bg-black/60 p-4">
            <h3 className="font-mono text-[9px] uppercase tracking-widest text-white/50 mb-3">Story Outcome</h3>
            {storyMetadata ? (
               <>
                 <div className="font-display font-black text-2xl md:text-3xl uppercase mb-2">
                   {storyMetadata.outcome === 'win' ? 'Encounter Cleared' : 'Defeated'}
                 </div>
                  {storyMetadata.outcome === 'win' && (
                    <div className="text-primary font-mono uppercase text-sm mb-4">
                      {storyMetadata.firstClear
                        ? `Earned this run: ${earnedStars} / 3`
                        : `This run: ${earnedStars} / 3 · Best record: ${storyMetadata.stars} / 3`}
                    </div>
                  )}
                 {storyMetadata.outcome !== 'win' && (
                   <div className="text-white/70 text-sm mb-4">
                     Try adjusting your lane commitments and saving your Squabble for the crucial final rounds!
                   </div>
                 )}
               </>
            ) : rewardError ? (
               <div>
                 <div className="text-accent text-sm font-bold uppercase mb-3">Failed to save outcome.</div>
                 <button onClick={onRetryReward} disabled={rewardPending} className="border border-accent px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-rose-200 hover:bg-accent/15 disabled:opacity-50">
                   {rewardPending ? 'Retrying' : 'Retry Save'}
                 </button>
               </div>
            ) : (
               <div className="text-white/50 text-sm animate-pulse mb-4">Syncing with server...</div>
            )}

            {reward?.storyRewards && reward.storyRewards.length > 0 && (
               <div className="mt-2 border-t border-white/10 pt-4">
                 <div className="font-mono text-[9px] uppercase tracking-widest text-accent mb-2">One-Time Rewards</div>
                 {reward.storyRewards.map((r: any) => (
                     <div key={r.rewardKey} className="mt-2 border-l border-accent/50 pl-3 text-left text-sm text-white/90">{r.description}</div>
                 ))}
               </div>
            )}
          </div>
        ) : isGuest ? (
          <div className="mb-8 border border-primary/30 bg-black/60 p-4 font-mono text-[10px] uppercase tracking-widest text-primary">
            Practice result only — rewards are unsaved.
          </div>
        ) : (
          <div className="mb-8 border border-white/10 bg-black/60 p-4">
            <h3 className="font-mono text-[9px] uppercase tracking-widest text-white/50 mb-3">Post-Match Rewards</h3>
            {rewardError ? (
               <div>
                 <div className="text-accent text-sm font-bold uppercase mb-3">Reward was not saved. Your local result still counts as practice.</div>
                 <button onClick={onRetryReward} disabled={rewardPending} className="border border-accent px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-rose-200 hover:bg-accent/15 disabled:opacity-50">
                   {rewardPending ? 'Retrying' : 'Retry Save'}
                 </button>
               </div>
            ) : reward ? (
               <div className="flex justify-center gap-4">
                 <div className="text-center">
                   <div className="font-display font-black text-2xl text-primary">+{reward.xp}</div>
                   <div className="font-mono text-[8px] uppercase">XP</div>
                 </div>
                 {reward.streetRep > 0 && (
                   <div className="text-center">
                     <div className="font-display font-black text-2xl text-primary">+{reward.streetRep}</div>
                     <div className="font-mono text-[8px] uppercase">Rep</div>
                   </div>
                 )}
                 {reward.softCurrency > 0 && (
                   <div className="text-center">
                     <div className="font-display font-black text-2xl text-primary">+{reward.softCurrency}</div>
                     <div className="font-mono text-[8px] uppercase">Soft</div>
                   </div>
                 )}
               </div>
            ) : (
               <div className="text-white/50 text-sm animate-pulse">Syncing with server...</div>
            )}
          </div>
        )}
        {isGuest && (
          <div className="mb-7 border border-primary/35 bg-primary/5 p-3 font-mono text-[9px] uppercase tracking-wider text-white/60">
            {customPlayerDeck ? "Deck tests do not grant rewards." : "Guest practice does not save rewards. Return home to create an account and keep your next run."}
          </div>
        )}

        <div className="flex flex-wrap gap-2 md:gap-4 justify-center">
          {isStory ? (
            <>
              {storyMetadata?.outcome !== 'win' && (
                <button data-testid="button-restart-match" onClick={onRestart} className="bg-primary text-black px-5 md:px-9 py-3.5 md:py-4 font-display font-black italic text-sm md:text-xl uppercase hover:bg-yellow-400 transition-transform active:translate-y-1 shadow-[0_5px_0_#854d0e] active:shadow-none">
                  Retry Encounter
                </button>
              )}
              <button onClick={onGoHome} className="bg-black/70 border border-white/20 text-white px-5 md:px-9 py-3.5 md:py-4 font-display font-black italic text-sm md:text-xl uppercase hover:bg-white/15 transition-transform active:translate-y-1">
                Continue Chapter
              </button>
            </>
          ) : (
            <>
              <button data-testid="button-restart-match" onClick={onRestart} className="bg-primary text-black px-5 md:px-9 py-3.5 md:py-4 font-display font-black italic text-sm md:text-xl uppercase hover:bg-yellow-400 transition-transform active:translate-y-1 shadow-[0_5px_0_#854d0e] active:shadow-none">
                Run It Back
              </button>
              <button data-testid="button-change-deck" onClick={onChangeDeck} className="bg-black/70 border border-white/20 text-white px-5 md:px-9 py-3.5 md:py-4 font-display font-black italic text-sm md:text-xl uppercase hover:bg-white/15 transition-transform active:translate-y-1">
                Change Deck
              </button>
              <button onClick={onGoHome} className="bg-zinc-900 border border-white/10 text-white px-5 md:px-9 py-3.5 md:py-4 font-display font-black italic text-sm md:text-xl uppercase hover:bg-white/10 transition-transform active:translate-y-1">
                Home
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
