import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import { getCardImage, getAssetUrl } from '../data';
import { getMatchDistricts, getDistrictResults, type Match } from '../gameEngine';

export function RivalTell({ hero, tell, thinking }: { hero?: string; tell: string; thinking: boolean }) {
  return <div className={`rival-presence ${thinking ? 'is-thinking' : ''}`} title={tell}>
    {hero && <img src={getCardImage(hero)} alt="" />}<span className="rival-presence__hand" aria-hidden="true"><i/><i/><i/></span>
    <span className="sr-only">Rival tell: {tell}. This is a hint, not a committed move.</span>
  </div>;
}

export function BattleRound({ match, phase }: { match: Match; phase: string }) {
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  return <div className="round-recap" data-testid="round-recap">
    {phase === 'round-intro' ? <>{match.round <= 6 && <img data-testid={`broadcast-round-${String(match.round).padStart(2,'0')}`} src={getAssetUrl(`assets/fight-night/round-${String(match.round).padStart(2,'0')}.webp`)} alt=""/>}<span>Round {match.round} <small>Fresh card · Your move next</small></span></> : <><span>Round {match.round} settled</span>{getDistrictResults(match).map(result => <motion.span key={`${match.round}:${result.lane}`} className={`recap-${result.winner}`} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : result.lane * .18 }}><small>{getMatchDistricts(match)[result.lane].name}</small><b><AnimatedNumber value={result.player} delay={result.lane * .18} /> : <AnimatedNumber value={result.cpu} delay={result.lane * .18} /></b><small>{result.winner === 'player' ? 'You lead' : result.winner === 'cpu' ? 'Rival leads' : 'Tied'}</small></motion.span>)}</>}
  </div>;
}
