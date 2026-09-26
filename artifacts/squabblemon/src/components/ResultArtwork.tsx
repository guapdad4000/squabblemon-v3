import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import '../styles/ui-polish.css';
import type { MatchReward } from '@workspace/api-client-react';
import { getAssetUrl } from '../lib/assets';
import { GameGlyph } from './venue/GameGlyph';
import { Star } from 'lucide-react';

type DistrictResult = { player: number; cpu: number; winner: string };
const asset = (name: string) => getAssetUrl(`assets/results/${name}.webp`);

/** Reuse the illustrated paper independently of the scene so its text can reflow. */
function ResultPaper({ victory, score = false }: { victory: boolean; score?: boolean }) {
  const crop = victory
    ? score ? '88 1186 246 207' : '119 909 703 242'
    : score ? '57 1200 271 173' : '61 982 824 198';
  return <svg className="result-art__paper" viewBox={crop} preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <image href={asset(`${victory ? 'win' : 'loss'}-portrait`)} width="941" height="1672" />
  </svg>;
}

export function ResultArtwork({ victory, draw, results, districts, reward, isGuest, rewardError, rewardPending, storyStars, actions, heading, children }: {
  actions?: ReactNode; heading?: ReactNode; children?: ReactNode;
  victory: boolean; draw: boolean; results: DistrictResult[]; districts: { name: string }[];
  reward?: MatchReward; isGuest?: boolean; rewardError?: unknown; rewardPending?: boolean;
  storyStars?: number;
}) {
  const reduced = useReducedMotion() || (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true');
  const [scene, setScene] = useState(false);
  const outcome = victory ? 'win' : draw ? 'draw' : 'loss';
  const savedReward = !isGuest && !rewardError && !rewardPending ? reward : undefined;
  const stateLabel = isGuest ? 'Offline training · no saved rewards' : rewardError ? 'Rewards not saved · retry below' : rewardPending || !reward ? 'Saving battle earnings…' : 'Battle earnings';
  return <section className={`result-art result-art--${outcome} ${scene ? 'result-art--cinematic' : ''}`} data-result-outcome={outcome} aria-label={`${draw ? 'Tied' : victory ? 'Winning' : 'Losing'} battle outcome artwork`}>
    <div className="result-art__canvas" aria-hidden="true">
      {scene || draw ? <picture>
        <source media="(max-aspect-ratio: 1/1)" srcSet={asset(`${outcome}-scene-portrait`)} />
        <img draggable={false} className="result-art__image" src={asset(`${outcome}-scene-wide`)} alt="" />
      </picture> : <>
        {/* The scene fills the viewport without stretching the character or baking UI into its dimensions. */}
        <svg className="result-art__image result-art__image--portrait" viewBox={`0 0 941 ${victory ? 894 : 974}`} preserveAspectRatio="xMidYMin slice" focusable="false">
          <image href={asset(`${outcome}-portrait`)} width="941" height="1672" />
        </svg>
        <svg className="result-art__image result-art__image--wide" viewBox={victory ? '0 0 1000 941' : '0 0 1672 596'} preserveAspectRatio="xMidYMin slice" focusable="false">
          <image href={asset(`${outcome}-wide`)} width="1672" height="941" />
        </svg>
      </>}
    </div>
    {!draw && <button className="result-art__toggle" onClick={() => setScene(value => !value)} aria-pressed={scene}>{scene ? 'Show results' : 'View scene'}</button>}
    <div className="result-art__interface">
      {heading}
      {!scene && <>
        <div className="result-art__outcome">
          {storyStars !== undefined && <div className="result-art__story-stars" aria-label={`${storyStars} of 3 story stars earned`}>
            {[1, 2, 3].map(n => <Star key={n} fill={n <= storyStars ? 'currentColor' : 'none'} aria-hidden="true" />)}
          </div>}
          {draw ? <div className="result-art__draw-mark" aria-label="Tie">Tie</div> : <img draggable={false} className="result-art__outcome-mark" src={getAssetUrl(`assets/results/${victory ? 'win-w' : 'loss-l'}.gif`)} alt="" aria-hidden="true" />}
        </div>
        <div className="result-art__plaque" role="status">
          <ResultPaper victory={victory || draw} />
          <span className="result-art__caption">{stateLabel}</span>
          {savedReward && <div className="result-art__rewards">
            <div><GameGlyph name="cloutStack" /><strong><AnimatedNumber value={savedReward.softCurrency} prefix="+" delay={.2} /></strong><span>Clout</span></div>
            <div><GameGlyph name="xp" /><strong><AnimatedNumber value={savedReward.xp} prefix="+" delay={.2} /></strong><span>Profile XP</span></div>
            <div><GameGlyph name="rep" /><strong><AnimatedNumber value={savedReward.streetRep} prefix="+" delay={.2} /></strong><span>Street Rep</span></div>
          </div>}
        </div>
        <div className="result-art__scores" aria-label="Final district scores">
          {results.map((result, i) => <motion.div key={i} data-winner={result.winner} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .22 }}>
            <ResultPaper victory={victory || draw} score />
            <span>{districts[i]?.name ?? `District ${i + 1}`}</span>
            <strong><AnimatedNumber value={result.player} delay={i * .22} /><small> : </small><AnimatedNumber value={result.cpu} delay={i * .22} /></strong>
            <em>{result.winner === 'player' ? 'Secured' : result.winner === 'draw' ? 'Dead heat' : 'Lost'}</em>
          </motion.div>)}
        </div>
      </>}
      <div className="result-art__actions">{actions}</div>
      <div className="result-art__details">{children}</div>
    </div>
  </section>;
}
