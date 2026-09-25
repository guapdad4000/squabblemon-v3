import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { rankProgress, type RankedResult } from '@workspace/squabblemon-engine/multiplayer';
import { getAssetUrl } from '../lib/assets';
import { AnimatedNumber } from './AnimatedNumber';
import { RankTrophy, RPToken } from './RankArtwork';
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { setBattleMusicMode } from '../musicStore';
export function ParkResult({ outcome, ranked, rank, description, claimed, rivalClaimed, reducedMotion = false, timeoutResult = false, children }: {
  outcome: 'win' | 'loss' | 'draw'; ranked: boolean; rank?: RankedResult; description: string;
  claimed: number; rivalClaimed: number; reducedMotion?: boolean; timeoutResult?: boolean; children: ReactNode;
}) {
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
  const promoted = rank && rank.after > rank.before && rankProgress(rank.before).tier !== rank.tier;
  return <DialogContent ref={panelRef} className={'park-result park-result--illustrated outcome-' + outcome} aria-describedby="park-result-description" data-testid="park-result-dialog">
    <DialogClose className="park-result-close" aria-label="Close result" data-park-result-close><span aria-hidden="true">×</span></DialogClose>
    <div className="park-result-scene" style={{ backgroundImage: `linear-gradient(0deg,#18251f00,#09161455),url("${getAssetUrl('assets/fade-park/park.png')}")` }} aria-hidden="true"><div className="park-result-sun" /><motion.img draggable={false} src={getAssetUrl(hero)}
      initial={reduced ? false : { y: 45, scale: .85, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 16, delay: .1 }} />
      <img draggable={false} className="park-result-outcome-mark" src={getAssetUrl(mark)} alt="" />
    </div>
    <header className="park-result-sign"><span>{ranked ? 'FADE PARK · RANKED' : 'FRIEND FADE'}</span><DialogTitle>{win ? ranked ? 'YOU OWN THE PARK.' : 'YOU WON THE FADE.' : outcome === 'draw' ? 'DEAD HEAT.' : 'RUN IT BACK.'}</DialogTitle><p>{win ? 'Make some noise. This one is yours.' : outcome === 'draw' ? 'Nobody folds. Meet in the middle.' : 'Take a breath. The next fade is yours.'}</p></header>
    <div className="park-result-receipt">
      <DialogDescription id="park-result-description" className={timeoutResult ? 'park-result-reason' : undefined} data-testid={timeoutResult ? 'timeout-result-reason' : undefined}>{description}</DialogDescription>
      <div className="park-result-score"><span>YOUR DISTRICTS <b><AnimatedNumber reducedMotion={Boolean(reduced)} value={claimed} delay={.2} /></b></span><i>—</i><span>RIVAL DISTRICTS <b><AnimatedNumber reducedMotion={Boolean(reduced)} value={rivalClaimed} delay={.4} /></b></span></div>
      {timeoutResult && <p className="park-result-score-context" data-testid="timeout-score-context">District totals show the final board; the timeout decided the winner.</p>}
      {rank && <div className="park-result-award" data-testid="ranked-result"><motion.div initial={reduced ? false : { y: -30, rotate: -12, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={{ type: 'spring', damping: 12, delay: .3 }}><RankTrophy tier={rank.tier} /></motion.div><div><span className="park-award-label">{promoted ? 'RANK UP!' : 'PRESEASON RANK'}</span><h3>{rank.tier}</h3><div className="park-rp-change"><RPToken /><strong><AnimatedNumber reducedMotion={Boolean(reduced)} value={rank.delta} prefix={rank.delta >= 0 ? '+' : ''} delay={.5} /> RP</strong></div><small><AnimatedNumber reducedMotion={Boolean(reduced)} value={rank.after} from={rank.before} delay={.5} /> total RP{rank.bot ? ' · Park Bot' : ''}</small></div></div>}
      <nav className="park-result-actions" aria-label="After the fade">{children}</nav>
    </div>
  </DialogContent>;
}
