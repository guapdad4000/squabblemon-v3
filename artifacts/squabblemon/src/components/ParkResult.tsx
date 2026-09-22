import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { rankProgress, type RankedResult } from '@workspace/squabblemon-engine/multiplayer';
import { getAssetUrl } from '../lib/assets';
import { AnimatedNumber } from './AnimatedNumber';
import { RankTrophy, RPToken } from './RankArtwork';
import { DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
export function ParkResult({ outcome, ranked, rank, description, claimed, rivalClaimed, reducedMotion = false, children }: {
  outcome: 'win' | 'loss' | 'draw'; ranked: boolean; rank?: RankedResult; description: string;
  claimed: number; rivalClaimed: number; reducedMotion?: boolean; children: ReactNode;
}) {
  const systemReduced = useReducedMotion();
  const reduced = reducedMotion || systemReduced || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const win = outcome === 'win';
  const promoted = rank && rank.after > rank.before && rankProgress(rank.before).tier !== rank.tier;
  return <DialogContent className={'park-result park-result--illustrated outcome-' + outcome} aria-describedby="park-result-description">
    <div className="park-result-scene" style={{ backgroundImage: `linear-gradient(0deg,#18251f00,#09161455),url("${getAssetUrl('assets/fade-park/park.png')}")` }} aria-hidden="true"><div className="park-result-sun" /><motion.img src={getAssetUrl('assets/pvp/dr-fade-' + (win ? 'win' : 'loss') + '.webp')}
      initial={reduced ? false : { y: 45, scale: .85, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 16, delay: .1 }} /></div>
    <header className="park-result-sign"><span>{ranked ? 'FADE PARK · RANKED' : 'FRIEND FADE'}</span><DialogTitle>{win ? ranked ? 'YOU OWN THE PARK.' : 'YOU WON THE FADE.' : outcome === 'draw' ? 'DEAD HEAT.' : 'RUN IT BACK.'}</DialogTitle><p>{win ? 'Make some noise. This one is yours.' : outcome === 'draw' ? 'Nobody folds. Meet in the middle.' : 'Take a breath. The next fade is yours.'}</p></header>
    <div className="park-result-receipt">
      <DialogDescription id="park-result-description">{description}</DialogDescription>
      <div className="park-result-score"><span>YOUR DISTRICTS <b><AnimatedNumber reducedMotion={Boolean(reduced)} value={claimed} delay={.2} /></b></span><i>—</i><span>RIVAL DISTRICTS <b><AnimatedNumber reducedMotion={Boolean(reduced)} value={rivalClaimed} delay={.4} /></b></span></div>
      {rank && <div className="park-result-award" data-testid="ranked-result"><motion.div initial={reduced ? false : { y: -30, rotate: -12, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={{ type: 'spring', damping: 12, delay: .3 }}><RankTrophy tier={rank.tier} /></motion.div><div><span className="park-award-label">{promoted ? 'RANK UP!' : 'PRESEASON RANK'}</span><h3>{rank.tier}</h3><div className="park-rp-change"><RPToken /><strong><AnimatedNumber reducedMotion={Boolean(reduced)} value={rank.delta} prefix={rank.delta >= 0 ? '+' : ''} delay={.5} /> RP</strong></div><small><AnimatedNumber reducedMotion={Boolean(reduced)} value={rank.after} from={rank.before} delay={.5} /> total RP{rank.bot ? ' · Park Bot' : ''}</small></div></div>}
      <nav className="park-result-actions" aria-label="After the fade">{children}</nav>
    </div>
  </DialogContent>;
}
