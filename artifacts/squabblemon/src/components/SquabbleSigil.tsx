import { getAssetUrl } from '../lib/assets';
import { BattleFxImage } from './BattleFxImage';
import './squabble-sigil.css';

/** The button owns interaction and rules; this art only reflects its state. */
export function SquabbleSigil({ spent = false }: { spent?: boolean }) {
  return <span className="battle-squabble__sigil squabble-sigil" aria-hidden="true">
    {spent ? <span className="squabble-sigil__spent" data-squabble-art="spent" style={{ backgroundImage: `url("${getAssetUrl('assets/combat/supplied/squabble-spent-atlas.webp')}")` }} /> : <>
      <img className="squabble-sigil__idle" data-squabble-art="idle" src={getAssetUrl('assets/combat/supplied/squabble-idle.png')} alt="" width={111} height={160} decoding="async" draggable={false} />
      <BattleFxImage kind="squabble-ready" className="squabble-sigil__flame" />
    </>}
  </span>;
}
