import { Check, HandFist, LockKeyhole } from 'lucide-react';
import { Link } from 'wouter';
import type { CSSProperties } from 'react';
import type { KumiteProgression } from '../../lib/kumite';
import { KumitePortrait } from './KumiteWinnerCard';
import { catalogPortrait } from '../profile/FighterPortrait';
import { getAssetUrl } from '../../lib/assets';

/** Reward receipts and progress come only from the authenticated server profile. */
export function KumiteRewards({ progression }: { progression?: KumiteProgression | null }) {
  if (!progression) return null;
  const rewards = progression.rewards;
  // Each server milestone sits on a branch of the illustrated road. Receipt order
  // stays stable; ownership alone never marks a Kumite milestone complete.
  return <section className="kumite-rewards kumite-roadmap" aria-label="Your Kumite fighter rewards">
    <header><HandFist size={21} aria-hidden="true" /><h2>Kumite unlocks</h2><span>{progression.completedMatches} FIGHTS · {progression.matchWins} WINS · {progression.championships} TITLES</span></header>
    <div className="kumite-roadmap__map">
      <img className="kumite-roadmap__art" src={getAssetUrl('assets/kumite/unlock-roadmap.webp')} alt="" draggable={false} loading="lazy" />
      <div className="kumite-rewards__cards kumite-roadmap__nodes">{rewards.map((reward, index) => <article key={reward.id} className="kumite-roadmap__node" data-earned={reward.claimed} data-side={index % 2 === 0 ? 'left' : 'right'} style={{ '--node-x': `${index % 2 === 0 ? 25 : 75}%`, '--node-y': `${14.7 + index * 9.8}%` } as CSSProperties}>
        <div className="kumite-roadmap__rarity">{reward.rarity ?? catalogPortrait(reward.cardId)?.rarity ?? 'CARD'}</div>
        <Link href={`/game/collection?card=${encodeURIComponent(reward.cardId)}`} aria-label={`View ${reward.name}`}><KumitePortrait hero={reward.cardId} name={reward.name} /></Link>
        <div className="kumite-roadmap__node-copy"><h3>{reward.name}</h3><p>{reward.requirement}</p><div className="kumite-rewards__meter" role="progressbar" aria-label={`${reward.name} reward progress`} aria-valuemin={0} aria-valuemax={reward.required} aria-valuenow={Math.min(reward.required, reward.progress)}><i style={{ width: `${Math.min(100, reward.progress / Math.max(1, reward.required) * 100)}%` }} /></div><small>{reward.claimed ? <><Check size={12} aria-hidden="true" />Unlocked</> : <><LockKeyhole size={11} aria-hidden="true" />{Math.min(reward.required, reward.progress)} / {reward.required}{reward.owned ? ' · Owned' : ''}</>}</small></div>
      </article>)}</div>
    </div>
  </section>;
}
