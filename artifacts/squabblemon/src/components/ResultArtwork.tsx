import { useState, type ReactNode, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import '../styles/ui-polish.css';
import type { MatchReward } from '@workspace/api-client-react';
import { getAssetUrl } from '../lib/assets';
import { GameGlyph } from './venue/GameGlyph';

type DistrictResult = { player: number; cpu: number; winner: string };
/** Panel coordinates follow the supplied artwork; the image is never cropped. */
export function ResultArtwork({ victory, draw, results, districts, reward, isGuest, rewardError, rewardPending, actions, onRegroup, onTrain, onRebuild }: {
  actions?: ReactNode; onRegroup?: () => void; onTrain?: () => void; onRebuild?: () => void;
  victory: boolean; draw: boolean; results: DistrictResult[]; districts: { name: string }[];
  reward?: MatchReward; isGuest?: boolean; rewardError?: unknown; rewardPending?: boolean;
}) {
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const [scene, setScene] = useState(false);
  const outcome = victory ? 'win' : 'loss';
  const cinematic = scene || draw;
  const asset = (name: string) => getAssetUrl(`assets/results/${name}.webp`);
  const savedReward = !isGuest && !rewardError && !rewardPending ? reward : undefined;
  const stateLabel = isGuest ? 'Offline training · no saved rewards' : rewardError ? 'Rewards not saved · retry below' : rewardPending || !reward ? 'Saving battle earnings…' : 'Battle earnings';
  return <section className={`result-art result-art--${draw ? 'draw' : outcome} ${cinematic ? 'result-art--cinematic' : ''}`} style={{ '--result-backdrop': `url("${asset(`${draw ? 'win' : outcome}-scene-wide`)}")` } as CSSProperties} aria-label="Battle outcome artwork">
    <div className="result-art__canvas">
    <picture>
      <source media="(max-aspect-ratio: 1/1), (max-width: 639px)" srcSet={asset(`${draw ? 'win' : outcome}${cinematic ? '-scene' : ''}-portrait`)} />
      {!cinematic && <source media="(max-width: 1100px)" srcSet={asset(victory ? 'win-wide-centered' : 'loss-wide-harbor')} />}
      <img className="result-art__image" src={asset(`${draw ? 'win' : outcome}${cinematic ? '-scene' : ''}-wide`)} alt="" width={1672} height={941} fetchPriority="high" />
    </picture>
    {!draw && !scene && <img className="result-art__outcome-mark" src={getAssetUrl(`assets/results/${outcome === 'win' ? 'win-w' : 'loss-l'}.gif`)} alt="" aria-hidden="true" />}
    {!draw && <button className="result-art__toggle" onClick={() => setScene(value => !value)} aria-pressed={scene}>{scene ? 'Show results' : 'View scene'}</button>}
    {!scene && <>
      <div className="result-art__plaque" role="status">
        <span className="result-art__caption">{stateLabel}</span>
        {savedReward && <div className="result-art__rewards">
          <div><GameGlyph name="cloutStack" /><strong><AnimatedNumber value={savedReward.softCurrency} prefix="+" delay={.2} /></strong><span>Clout</span></div>
          <div><GameGlyph name="xp" /><strong><AnimatedNumber value={savedReward.xp} prefix="+" delay={.2} /></strong><span>Profile XP</span></div>
          <div><GameGlyph name="rep" /><strong><AnimatedNumber value={savedReward.streetRep} prefix="+" delay={.2} /></strong><span>Street Rep</span></div>
        </div>}
      </div>
      <div className="result-art__scores" aria-label="Final district scores">
        {results.map((result, i) => <motion.div key={i} data-winner={result.winner} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .22 }}>
          <span>{districts[i]?.name ?? `District ${i + 1}`}</span>
          <strong><AnimatedNumber value={result.player} delay={i * .22} /><small> : </small><AnimatedNumber value={result.cpu} delay={i * .22} /></strong>
          <em>{result.winner === 'player' ? 'Secured' : result.winner === 'draw' ? 'Dead heat' : 'Lost'}</em>
        </motion.div>)}
      </div>
      {!victory && !draw && <nav className="result-art__loss-notes" aria-label="Plan your comeback"><button onClick={onRegroup}>Regroup</button><button onClick={onTrain}>Train</button><button onClick={onRebuild}>Rebuild</button><button onClick={onTrain}>Run it back</button></nav>}
    </>}
    </div>
    <div className="result-art__actions">{actions}</div>
  </section>;
}
