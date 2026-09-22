import { RANK_TIERS } from '@workspace/squabblemon-engine/multiplayer';
import { getAssetUrl } from '../lib/assets';
import '../styles/pvp-art.css';
export const rankArtwork = (tier: string) => getAssetUrl('assets/pvp/trophies/' + tier.toLowerCase().replaceAll(' ', '-') + '.webp');
export function RankTrophy({ tier, className = '' }: { tier: string; className?: string }) {
  return <img className={'rank-trophy ' + className} src={rankArtwork(tier)} alt={tier + ' trophy'} />;
}
export function RPToken() { return <img className="rp-token" src={getAssetUrl('assets/pvp/rp-token.webp')} alt="" />; }
export function RankLadder() { return <details className="rank-ladder"><summary>The seven ranks</summary><ol>{RANK_TIERS.map(tier => <li key={tier.name}><RankTrophy tier={tier.name} /><strong>{tier.name}</strong><span>{tier.floor.toLocaleString()} RP</span></li>)}</ol></details>; }
