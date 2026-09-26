import { useState, type ReactNode, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import '../styles/ui-polish.css';
import '../styles/result-immersive.css';
import type { MatchReward } from '@workspace/api-client-react';
import { getAssetUrl } from '../lib/assets';
import { GameGlyph } from './venue/GameGlyph';
import { Star } from 'lucide-react';

type DistrictResult = { player: number; cpu: number; winner: string };
/** Scene art and live result panels scale independently across viewport shapes. */
export function ResultArtwork({ victory, draw, results, districts, reward, isGuest, rewardError, rewardPending, storyStars, actions, heading, children, onRegroup, onTrain, onRebuild }: {
  actions?: ReactNode; heading?: ReactNode; children?: ReactNode; onRegroup?: () => void; onTrain?: () => void; onRebuild?: () => void;
  victory: boolean; draw: boolean; results: DistrictResult[]; districts: { name: string }[];
  reward?: MatchReward; isGuest?: boolean; rewardError?: unknown; rewardPending?: boolean;
  storyStars?: number;
}) {
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const [scene, setScene] = useState(false);
  const outcome = victory ? 'win' : draw ? 'draw' : 'loss';
  const asset = (name: string) => getAssetUrl(`assets/results/${name}.webp`);
  const variant = scene ? 2 : 1;
  const background = draw ? 'draw-scene' : `v3/${outcome}-${variant}`;
  const savedReward = !isGuest && !rewardError && !rewardPending ? reward : undefined;
  const stateLabel = isGuest ? 'Offline training · no saved rewards' : rewardError ? 'Rewards not saved · retry below' : rewardPending || !reward ? 'Saving battle earnings…' : 'Battle earnings';
  return <section className={`result-immersive result-immersive--${outcome}`} data-result-outcome={outcome} style={{ "--result-panel": `url("${asset("v3/panel")}")` } as CSSProperties} aria-label={`${draw ? 'Tied' : victory ? 'Winning' : 'Losing'} battle outcome artwork`}>
    <picture className="result-immersive__background">
      <source media="(max-aspect-ratio: 1/1)" srcSet={asset(`${background}-portrait`)} />
      <img draggable={false} src={asset(`${background}-wide`)} alt="" fetchPriority="high" />
    </picture>
    <div className="result-immersive__particles" aria-hidden="true">{victory && !reduced && Array.from({length: 22}, (_, i) => <i key={i} style={{'--x': `${(i * 37 + 7) % 100}%`, '--delay': `${-i * .7}s`, '--duration': `${7 + i % 5}s`, '--spin': `${i * 31}deg`} as CSSProperties} />)}</div>
    {!victory && !draw && !reduced && <div className="result-immersive__rain" aria-hidden="true">{Array.from({length: 48}, (_, i) => <i key={i} style={{ '--x': `${(i * 37 + 3) % 100}%`, '--delay': `${-i * .17}s`, '--duration': `${.8 + (i % 7) * .12}s` } as CSSProperties} />)}</div>}
    <img className="result-immersive__brand" src={asset('v3/wordmark')} alt="Squabblemon" />
    {!draw && <button className="result-immersive__toggle" onClick={() => setScene(value => !value)} aria-pressed={scene}>Scene {variant} / 2 <span aria-hidden="true">↔</span></button>}
    <div className="result-immersive__results">
      <div className="result-immersive__title">
        {!draw && <img draggable={false} className="result-immersive__mark" src={getAssetUrl(`assets/results/${victory ? 'win-w' : 'loss-l'}.gif`)} alt={victory ? 'Victory' : 'Defeat'} />}
        {heading || <h2>{draw ? 'Dead heat' : victory ? 'You won the room' : 'Make your comeback'}</h2>}
        {storyStars !== undefined && <div className="result-immersive__stars" aria-label={`${storyStars} of 3 story stars earned`}>{[1,2,3].map(n => <Star key={n} fill={n <= storyStars ? 'currentColor' : 'none'} aria-hidden="true" />)}</div>}
      </div>
      <div className="result-immersive__plaque" role="status">
        <svg className="result-immersive__frame" viewBox="0 40 2172 590" preserveAspectRatio="none" aria-hidden="true"><image href={asset("v3/panel")} width="2172" height="724" /></svg>
        <img className="result-immersive__gloves" src={asset("v3/gloves")} alt="" aria-hidden="true" />
        <span className="result-immersive__caption">{stateLabel}</span>
        {savedReward && <div className="result-immersive__rewards">
          <div><GameGlyph name="cloutStack" /><strong><AnimatedNumber value={savedReward.softCurrency} prefix="+" delay={.2} /></strong><span>Clout</span></div>
          <div><GameGlyph name="xp" /><strong><AnimatedNumber value={savedReward.xp} prefix="+" delay={.2} /></strong><span>Profile XP</span></div>
          <div><GameGlyph name="rep" /><strong><AnimatedNumber value={savedReward.streetRep} prefix="+" delay={.2} /></strong><span>Street Rep</span></div>
        </div>}
      </div>
      <div className="result-immersive__scores" aria-label="Final district scores">
        {results.map((result, i) => <motion.div key={i} data-winner={result.winner} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .22 }}>
          <span>{districts[i]?.name ?? `District ${i + 1}`}</span>
          <strong><AnimatedNumber value={result.player} delay={i * .22} /><small> : </small><AnimatedNumber value={result.cpu} delay={i * .22} /></strong>
          <em>{result.winner === 'player' ? 'Secured' : result.winner === 'draw' ? 'Dead heat' : 'Lost'}</em>
        </motion.div>)}
      </div>
      {!victory && !draw && (onRegroup || onTrain || onRebuild) && <nav className="result-immersive__loss-notes" aria-label="Plan your comeback"><button onClick={onRegroup}>Regroup</button><button onClick={onTrain}>Train</button><button onClick={onRebuild}>Rebuild</button><button onClick={onTrain}>Run it back</button></nav>}
    <div className="result-immersive__actions">{actions}</div>
    <div className="result-immersive__details">{children}</div>
    </div>
  </section>;
}
