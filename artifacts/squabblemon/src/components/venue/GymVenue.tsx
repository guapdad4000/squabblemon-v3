import { getAssetUrl } from '../../lib/assets';
import './GymVenue.css';

const GYM_BACKDROP = getAssetUrl('brand/gacha/rarity-flight-v1/default-gym.webp');
export const GYM_BAG_POSTER = getAssetUrl('brand/gacha/rarity-flight-v1/bag-render.webp');

/** The room is a still plate; SceneFrame owns the live bag, chains and gloves. */
export function GymVenue() {
  return <div className="gym-venue" aria-hidden="true">
    <img className="gym-venue__plate" src={GYM_BACKDROP} alt="" width={1672} height={941} decoding="async" draggable={false} />
  </div>;
}
