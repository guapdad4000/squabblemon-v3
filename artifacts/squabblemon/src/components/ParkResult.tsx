import { RankUpReward } from './RankUpReward';
import { RANKED_SEASON } from '@workspace/squabblemon-engine/ranked';
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { RankedResult } from '@workspace/squabblemon-engine/multiplayer';
import { isRankTierPromotion } from '../lib/rankPromotion';
import { getAssetUrl } from '../lib/assets';
import { AnimatedNumber } from './AnimatedNumber';
import { RankTrophy, RPToken } from './RankArtwork';
import { DialogClose, DialogContent, DialogPortal, DialogDescription, DialogTitle } from './ui/dialog';
import { setBattleMusicMode } from '../musicStore';
import '../styles/park-result-legible.css';
function unseenPromotion(key: string): string {
  if (!key) return '';
  try { return sessionStorage.getItem(key) === 'seen' ? '' : key; } catch { return key; }
}

export function ParkResult({ outcome, ranked, rank, resultKey, description, title, subtitle, boardNote, claimed, rivalClaimed, series, opponent, reducedMotion = false, children }: {
  outcome: 'win' | 'loss' | 'draw'; ranked: boolean; rank?: RankedResult; description: string;
  title?: string; subtitle?: string; boardNote?: string; resultKey?: string;
  claimed: number; rivalClaimed: number; series?: ReactNode; opponent?: ReactNode; reducedMotion?: boolean; children: ReactNode;
}) {
  const promoted = ranked && isRankTierPromotion(rank);
  const promotionKey = promoted && rank ? `park-promotion:${RANKED_SEASON}:${resultKey ?? `${rank.before}:${rank.after}`}` : '';
  const [openPromotionKey, setOpenPromotionKey] = useState(() => unseenPromotion(promotionKey));
  const checkedPromotionKey = useRef<string | null>(null);
  useEffect(() => {
    // Consume automatic presentation, not a reward: reconnecting cannot replay it.
    // Strict Mode's effect replay must not dismiss a promotion that just opened.
    if (checkedPromotionKey.current === promotionKey) return;
    checkedPromotionKey.current = promotionKey;
    const next = unseenPromotion(promotionKey);
    setOpenPromotionKey(next);
    try { if (next) sessionStorage.setItem(next, 'seen'); } catch {}
  }, [promotionKey]);
  function closePromotion() { try { if (promotionKey) sessionStorage.setItem(promotionKey, 'seen'); } catch {} setOpenPromotionKey(open => open === promotionKey ? '' : open); }
  const rewards = rank?.rewards ?? [];
  const systemReduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = reducedMotion || systemReduced || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const win = outcome === 'win';
  const hero = outcome === 'draw' ? 'assets/results/draw-mascot.webp' : `assets/pvp/dr-fade-${win ? 'win' : 'loss'}.webp`;
  const mark = outcome === 'draw' ? 'assets/results/draw-tie.webp' : `assets/results/${win ? 'win-w' : 'loss-l'}.gif`;
  useEffect(() => {
    if (outcome === 'draw') return;
    setBattleMusicMode(win ? 'victory' : 'defeat');
    return () => setBattleMusicMode(null);
  }, [outcome, win]);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.scrollTop = 0;
    panel.scrollLeft = 0;
  }, []);
  const weather = !reduced && outcome !== 'draw' && <DialogPortal>{
    <div className={'park-weather park-weather--' + outcome} aria-hidden="true" data-testid="park-weather">
      {win
        ? Array.from({ length: 36 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37 + 7) % 100}%`, '--delay': `${-i * .45}s`, '--duration': `${4 + i % 5}s`, '--spin': `${i * 31}deg` } as CSSProperties} />)
        : Array.from({ length: 60 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37 + 3) % 100}%`, '--delay': `${-i * .13}s`, '--duration': `${.7 + (i % 7) * .1}s` } as CSSProperties} />)}
    </div>}</DialogPortal>;
  if (promotionKey && openPromotionKey === promotionKey && rank) return <DialogContent className="park-result" data-testid="rank-promotion-dialog" onCloseAutoFocus={event => {
    // Development effect replay leaves the open dialog connected. Only a real
    // close/unmount should dismiss it; an old result must not close a newer one.
    const target = event.target;
    if (target instanceof HTMLElement && target.isConnected && target.getAttribute('data-state') === 'open') return;
    closePromotion();
  }}><RankUpReward rank={rank} reduced={Boolean(reduced)} onDone={closePromotion} /></DialogContent>;
  return <>{weather}<DialogContent ref={panelRef} className={'park-result park-result--illustrated outcome-' + outcome} aria-describedby="park-result-description" data-testid="park-result-dialog">
    <DialogClose className="park-result-close" aria-label="Close result" data-park-result-close><span aria-hidden="true">×</span></DialogClose>
    <div className="park-result-scene" style={{ backgroundImage: `linear-gradient(0deg,#18251f00,#09161455),url("${getAssetUrl('assets/fade-park/park.png')}")` }} aria-hidden="true"><div className="park-result-sun" /><motion.img draggable={false} src={getAssetUrl(hero)}
      initial={reduced ? false : { y: 45, scale: .85, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 16, delay: .1 }} />
      <img draggable={false} className="park-result-outcome-mark" src={getAssetUrl(mark)} alt="" />
    </div>
    <header className="park-result-sign" style={{ position: 'relative' }}>{!reduced && outcome === 'loss' && <div className="park-result-splashes" aria-hidden="true">{[8, 22, 39, 57, 73, 90].map((x, i) => <i key={i} style={{ left: `${x}%`, '--delay': `${-i * .41}s`, '--d': `${1.4 + i % 3 * .3}s` } as CSSProperties} />)}</div>}<span>{ranked ? 'FADE PARK · RANKED' : 'FRIEND FADE'}</span><DialogTitle>{title ?? (win ? ranked ? 'YOU OWN THE PARK.' : 'YOU WON THE FADE.' : outcome === 'draw' ? 'DEAD HEAT.' : 'RUN IT BACK.')}</DialogTitle><p>{subtitle ?? (win ? 'Make some noise. This one is yours.' : outcome === 'draw' ? 'Nobody folds. Meet in the middle.' : 'Take a breath. The next fade is yours.')}</p></header>
    <div className="park-result-receipt">
      <DialogDescription id="park-result-description">{description}</DialogDescription>
      <div className="park-result-score"><span>YOUR DISTRICTS <b><AnimatedNumber reducedMotion={Boolean(reduced)} value={claimed} delay={.2} /></b></span><i>—</i><span>RIVAL DISTRICTS <b><AnimatedNumber reducedMotion={Boolean(reduced)} value={rivalClaimed} delay={.4} /></b></span></div>
      {boardNote && <p className="park-result-board-note" data-testid="timeout-board-note">{boardNote}</p>}
      {series}
      {rank && <div className="park-result-award" data-testid="ranked-result"><motion.div initial={reduced ? false : { y: -30, rotate: -12, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={{ type: 'spring', damping: 12, delay: .3 }}><RankTrophy tier={rank.tier} /></motion.div><div><span className="park-award-label">{promoted ? 'RANK UP!' : 'PRESEASON RANK'}</span><h3>{rank.tier}</h3><div className="park-rp-change"><RPToken /><strong><AnimatedNumber reducedMotion={Boolean(reduced)} value={rank.delta} prefix={rank.delta >= 0 ? '+' : ''} delay={.5} /> RP</strong></div><small><AnimatedNumber reducedMotion={Boolean(reduced)} value={rank.after} from={rank.before} delay={.5} /> total RP{rank.bot ? ' · Park Bot' : ''}</small></div></div>}
      {!promoted && rewards.length > 0 && <p className="park-result-board-note" data-testid="saved-rank-rewards">Milestone rewards saved: +{rewards.reduce((total, reward) => total + reward.softCurrency, 0)} Clout · +{rewards.reduce((total, reward) => total + reward.packTickets, 0)} tickets · +{rewards.reduce((total, reward) => total + reward.styleShards, 0)} shards.</p>}
      {promoted && <button className="park-rank-review" onClick={() => setOpenPromotionKey(promotionKey)}>{rewards.length ? 'View saved promotion rewards →' : 'View promotion →'}</button>}
       {opponent}
      <nav className="park-result-actions" aria-label="After the fade">{children}</nav>
    </div>
  </DialogContent></>;
}
