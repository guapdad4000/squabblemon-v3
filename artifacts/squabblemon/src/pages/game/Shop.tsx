import { useState, useEffect, useRef } from 'react';
import { PlayerBootstrap, useOpenPlayerPack, PackReward } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { getCardImage } from '../../data';
import { motion, AnimatePresence } from 'framer-motion';
import { CardVariantTreatment, getVariantKind } from '../../components/CardVariantTreatment';

export function Shop({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const queryClient = useQueryClient();
  const openPack = useOpenPlayerPack();

  const [opening, setOpening] = useState(false);
  const [rewards, setRewards] = useState<PackReward[] | null>(null);
  const [revealIndex, setRevealIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const canAffordSoft = bootstrap.profile.softCurrency >= bootstrap.packConfig.softCurrencyCost;
  const canAffordTicket = bootstrap.profile.packTickets >= bootstrap.packConfig.ticketCost;
  const isReducedMotion = bootstrap.profile.settings.reducedMotion;

  const handleOpen = async (method: 'softCurrency' | 'ticket') => {
    if (opening) return;
    setOpening(true);
    setRewards(null);
    setRevealIndex(0);
    setError(null);

    try {
      const idempotencyKey = sessionStorage.getItem('squabblemon_pack_key') || crypto.randomUUID();
      sessionStorage.setItem('squabblemon_pack_key', idempotencyKey);

      const res = await openPack.mutateAsync({
        data: { idempotencyKey, paymentMethod: method }
      });

      sessionStorage.removeItem('squabblemon_pack_key');
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res.bootstrap);

      if (isReducedMotion) {
        setRewards(res.opening.rewards);
        setRevealIndex(res.opening.rewards.length); // skip directly to summary
      } else {
        timeoutRef.current = window.setTimeout(() => {
          setRewards(res.opening.rewards);
        }, 1500);
      }
    } catch (e) {
      console.error(e);
      setError("Failed to open pack. If you were charged, your rewards are safe. Try again.");
      setOpening(false);
    }
  };

  const skipReveal = () => {
    if (rewards) setRevealIndex(rewards.length);
  };

  const nextReveal = () => {
    if (rewards && revealIndex < rewards.length) {
      setRevealIndex(r => r + 1);
    } else {
      setOpening(false);
      setRewards(null);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 h-full flex flex-col relative overflow-y-auto hide-scrollbar">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="font-display font-black italic text-3xl uppercase leading-none mb-1">Street Shop</h1>
          <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest">
            {bootstrap.profile.packPity} / {bootstrap.packConfig.pityLimit} Pity
          </p>
        </div>
        <div className="text-right flex flex-col gap-1">
          <div className="font-mono text-[10px] uppercase text-primary bg-primary/10 px-2 py-0.5 border border-primary/20">Tickets: {bootstrap.profile.packTickets}</div>
          <div className="font-mono text-[10px] uppercase text-white/70 bg-white/5 px-2 py-0.5 border border-white/10">Clout: {bootstrap.profile.softCurrency}</div>
          <button onClick={() => setShowHistory(!showHistory)} className="font-mono text-[9px] uppercase tracking-widest text-white/40 hover:text-white mt-1">
            {showHistory ? 'Hide History' : 'View History'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-8">
        <div className="max-w-sm w-full bg-zinc-900 border border-white/10 p-6 flex flex-col items-center flex-none relative">
          <div className="w-32 h-48 bg-gradient-to-b from-primary to-rose-600 mb-6 relative overflow-hidden transform -rotate-6 shadow-[0_10px_30px_rgba(250,204,21,0.2)] border border-primary/50">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display font-black italic text-4xl text-black -rotate-12 uppercase drop-shadow-md">Pack</span>
            </div>
          </div>

          <h2 className="font-display font-black italic text-xl uppercase mb-1">Standard Street Pack</h2>
          <p className="text-white/50 text-[10px] font-mono mb-4 text-center">Contains {bootstrap.packConfig.rewardsPerPack} items. Duplicates auto-convert to Style Shards.</p>

          <div className="flex gap-2 w-full">
            <button
              onClick={() => handleOpen('ticket')}
              disabled={opening || !canAffordTicket}
              className="flex-1 bg-primary text-black font-display font-black italic uppercase text-xs py-3 disabled:opacity-50 hover:bg-yellow-400"
            >
              1 Ticket
            </button>
            <button
              onClick={() => handleOpen('softCurrency')}
              disabled={opening || !canAffordSoft}
              className="flex-1 bg-white/10 border border-white/20 text-white font-display font-black italic uppercase text-xs py-3 disabled:opacity-50 hover:bg-white/20"
            >
              {bootstrap.packConfig.softCurrencyCost} Clout
            </button>
          </div>

          {error && (
            <div className="absolute top-[100%] mt-4 inset-x-0 border border-rose-500/50 bg-rose-500/10 p-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-widest text-rose-400">{error}</p>
            </div>
          )}
        </div>

        <div className="max-w-sm w-full flex-none">
          <h3 className="font-mono text-[9px] uppercase tracking-widest text-white/50 mb-3 border-b border-white/10 pb-2">Drop Rates (v{bootstrap.packConfig.oddsVersion})</h3>
          <ul className="space-y-2">
            {bootstrap.packConfig.odds.map((odd, i) => (
              <li key={i} className="flex justify-between items-center bg-white/5 border border-white/5 px-3 py-2">
                <div>
                  <div className="font-display font-black italic uppercase text-sm">{odd.label}</div>
                  <div className="font-mono text-[9px] text-white/40">{odd.detail}</div>
                </div>
                <div className="font-mono text-primary text-xs">{odd.chance}%</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showHistory && (
        <div className="mt-8">
          <h3 className="font-mono text-xs uppercase tracking-widest text-white/50 mb-4 border-b border-white/10 pb-2">Opening History</h3>
          {bootstrap.profile.packHistory.length === 0 ? (
            <div className="text-center p-4 border border-white/5 text-white/30 font-mono text-[10px] uppercase">No history available</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto hide-scrollbar">
              {bootstrap.profile.packHistory.map((history, idx) => (
                <div key={history.id} className="border border-white/10 bg-zinc-950 p-3 flex justify-between items-center">
                  <div>
                    <div className="font-mono text-[8px] text-white/40 mb-1">{new Date(history.createdAt).toLocaleString()}</div>
                    <div className="font-mono text-[10px] uppercase">Paid with {history.paymentMethod}</div>
                  </div>
                  <div className="flex gap-2">
                    {history.rewards.map((r, i) => (
                      <span key={i} className="text-[9px] font-mono border border-white/20 px-1.5 py-0.5 bg-white/5">
                        {r.kind === 'card' ? `Card (${r.rarity})` : r.kind === 'variant' ? `Variant` : `${r.amount} ${r.kind}`}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {opening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            {!rewards ? (
              <motion.div
                animate={{ rotate: [-2, 2, -2, 2, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="w-48 h-72 bg-gradient-to-b from-primary to-rose-600 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-50" />
              </motion.div>
            ) : (
              <div className="w-full max-w-3xl p-6 flex flex-col items-center">
                {revealIndex < rewards.length ? (
                  <div className="flex flex-col items-center text-center w-full" onClick={nextReveal}>
                    <motion.div
                      key={revealIndex}
                      initial={{ scale: 0.5, opacity: 0, y: 50 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      className={`relative w-64 aspect-[3/4] bg-zinc-900 border-2 border-primary overflow-hidden mb-8 ${getVariantKind(rewards[revealIndex].variantId ?? (rewards[revealIndex].cardId ? bootstrap.profile.equippedVariants[rewards[revealIndex].cardId!] : undefined)) ? `card-variant card-variant-${getVariantKind(rewards[revealIndex].variantId ?? (rewards[revealIndex].cardId ? bootstrap.profile.equippedVariants[rewards[revealIndex].cardId!] : undefined))}` : ''}`}
                    >
                      {(rewards[revealIndex].kind === 'card' || rewards[revealIndex].kind === 'variant') && rewards[revealIndex].cardId ? (
                        <>
                          <img src={getCardImage(rewards[revealIndex].cardId!)} alt="" className="w-full h-full object-cover object-top" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 p-4">
                            <div className="font-display font-black italic uppercase text-2xl mb-1 text-white">{rewards[revealIndex].name}</div>
                            <div className="font-mono text-xs text-primary uppercase">{rewards[revealIndex].kind === 'variant' ? 'Variant' : rewards[revealIndex].rarity}</div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-4">
                          <div className="font-display font-black text-5xl mb-4 text-accent">{rewards[revealIndex].kind === 'styleShards' ? 'S' : 'C'}</div>
                          <div className="font-display font-black italic uppercase text-3xl mb-2 text-white">+{rewards[revealIndex].amount}</div>
                          <div className="font-mono text-sm text-primary uppercase">{rewards[revealIndex].kind}</div>
                        </div>
                      )}

                      {rewards[revealIndex].isNew && (
                        <div className="absolute top-4 right-4 bg-accent text-white font-display font-black italic uppercase px-2 py-1 rotate-12 shadow-lg">
                          NEW
                        </div>
                      )}
                      {!rewards[revealIndex].isNew && rewards[revealIndex].kind === 'card' && (
                        <div className="absolute top-4 right-4 bg-zinc-700 text-white font-display font-black italic uppercase px-2 py-1 rotate-12 shadow-lg">
                          DUPE
                        </div>
                      )}
                       <CardVariantTreatment variantId={rewards[revealIndex].variantId ?? (rewards[revealIndex].cardId ? bootstrap.profile.equippedVariants[rewards[revealIndex].cardId!] : undefined)} />
                    </motion.div>
                    <p className="font-mono text-xs text-white/50 uppercase tracking-widest mb-8">Tap to continue</p>
                    <button onClick={(e) => { e.stopPropagation(); skipReveal(); }} className="border border-white/20 px-6 py-2 font-mono text-[10px] uppercase hover:bg-white/10">Skip All</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full">
                    <h2 className="font-display font-black italic text-3xl uppercase mb-8">Pack Summary</h2>
                    <div className="flex flex-wrap justify-center gap-4 mb-8">
                      {rewards.map((r, i) => (
                        <div key={i} className={`w-32 aspect-[3/4] relative bg-zinc-900 border border-white/20 overflow-hidden ${getVariantKind(r.variantId ?? (r.cardId ? bootstrap.profile.equippedVariants[r.cardId] : undefined)) ? `card-variant card-variant-${getVariantKind(r.variantId ?? (r.cardId ? bootstrap.profile.equippedVariants[r.cardId] : undefined))}` : ''}`}>
                          {(r.kind === 'card' || r.kind === 'variant') && r.cardId ? (
                            <>
                              <img src={getCardImage(r.cardId)} alt="" className="w-full h-full object-cover object-top opacity-80" />
                              {!r.isNew && r.kind === 'card' && (
                                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm">
                                  <span className="font-mono text-[8px] text-white/70 uppercase">Duplicate</span>
                                  <span className="font-display font-black italic text-accent">+Shards</span>
                                </div>
                              )}
                              {r.kind === 'variant' && (
                                <div className="absolute top-1 right-1 bg-accent/80 text-white text-[8px] font-mono px-1">Variant</div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full">
                              <span className="font-display font-black text-xl text-accent">{r.kind === 'styleShards' ? 'S' : 'C'}</span>
                              <span className="font-display font-black text-xl">+{r.amount}</span>
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-black/80 p-2 text-center border-t border-white/10">
                            <div className="font-display font-black uppercase text-[10px] truncate text-white">{r.name || r.kind}</div>
                          </div>
                           <CardVariantTreatment variantId={r.variantId ?? (r.cardId ? bootstrap.profile.equippedVariants[r.cardId] : undefined)} />
                        </div>
                      ))}
                    </div>
                    <button onClick={nextReveal} className="bg-primary text-black font-display font-black italic uppercase px-8 py-3 hover:bg-yellow-400">Done</button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
