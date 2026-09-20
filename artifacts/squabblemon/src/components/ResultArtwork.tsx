import { useState } from 'react';
import type { MatchReward } from '@workspace/api-client-react';
import { getAssetUrl } from '../lib/assets';
import { GameGlyph } from './venue/GameGlyph';

type DistrictResult = { player: number; cpu: number; winner: string };
/** Panel coordinates follow the supplied artwork; the image is never cropped. */
export function ResultArtwork({ victory, draw, results, districts, reward, isGuest, rewardError, rewardPending }: {
  victory: boolean; draw: boolean; results: DistrictResult[]; districts: { name: string }[];
  reward?: MatchReward; isGuest?: boolean; rewardError?: unknown; rewardPending?: boolean;
}) {
  const [scene, setScene] = useState(false);
  const outcome = victory ? 'win' : 'loss';
  const cinematic = scene || draw;
  const asset = (name: string) => getAssetUrl(`assets/results/${name}.webp`);
  const savedReward = !isGuest && !rewardError && !rewardPending ? reward : undefined;
  const stateLabel = isGuest ? 'Offline training · no saved rewards' : rewardError ? 'Rewards not saved · retry below' : rewardPending || !reward ? 'Saving battle earnings…' : 'Battle earnings';
  return <section className={`result-art result-art--${draw ? 'draw' : outcome} ${cinematic ? 'result-art--cinematic' : ''}`} aria-label="Battle outcome artwork">
    <picture>
      <source media="(max-width: 639px)" srcSet={asset(`${draw ? 'win' : outcome}${cinematic ? '-scene' : ''}-portrait`)} />
      {!cinematic && <source media="(max-width: 1100px)" srcSet={asset(victory ? 'win-wide-centered' : 'loss-wide-harbor')} />}
      <img className="result-art__image" src={asset(`${draw ? 'win' : outcome}${cinematic ? '-scene' : ''}-wide`)} alt="" width={1672} height={941} fetchPriority="high" />
    </picture>
    {!draw && <button className="result-art__toggle" onClick={() => setScene(value => !value)} aria-pressed={scene}>{scene ? 'Show results' : 'View scene'}</button>}
    {!scene && <>
      <div className="result-art__plaque" role="status">
        <span className="result-art__caption">{stateLabel}</span>
        {savedReward && <div className="result-art__rewards">
          <div><GameGlyph name="cloutStack" /><strong>+{savedReward.softCurrency}</strong><span>Clout</span></div>
          <div><GameGlyph name="xp" /><strong>+{savedReward.xp}</strong><span>Profile XP</span></div>
          <div><GameGlyph name="rep" /><strong>+{savedReward.streetRep}</strong><span>Street Rep</span></div>
        </div>}
      </div>
      <div className="result-art__scores" aria-label="Final district scores">
        {results.map((result, i) => <div key={i} data-winner={result.winner}>
          <span>{districts[i]?.name ?? `District ${i + 1}`}</span>
          <strong>{result.player}<small> : </small>{result.cpu}</strong>
          <em>{result.winner === 'player' ? 'Secured' : result.winner === 'draw' ? 'Dead heat' : 'Lost'}</em>
        </div>)}
      </div>
      {!victory && !draw && <div className="result-art__loss-notes" aria-hidden="true"><span>Regroup</span><span>Train</span><span>Rebuild</span><span>Run it back</span></div>}
    </>}
  </section>;
}
