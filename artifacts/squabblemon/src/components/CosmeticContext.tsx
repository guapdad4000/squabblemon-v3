import type { PlayerBootstrap } from '@workspace/api-client-react';
import { equippedPlayerMat } from '@workspace/squabblemon-engine/playerMats';
import { ownsStyle, styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import { getAssetUrl } from '../lib/assets';
export { CosmeticProvider } from './cosmeticState';
import { useCosmeticProfile } from './cosmeticState';
export function useCardScene(cardId: string) {
  const profile = useCosmeticProfile();
  return profile ? cardSceneFor(profile, cardId) : undefined;
}
export function cardSceneFor(profile: PlayerBootstrap['profile'], cardId: string) {
  const set = styleSetFor(cardId);
  return set && profile.settings?.cosmetics?.cardBackgrounds?.[cardId] === 'blue-hour' && ownsStyle(profile, cardId, 'character-backdrop') ? getAssetUrl(set.background) : undefined;
}

export function useEquippedPlayerMat() {
  const profile = useCosmeticProfile();
  return profile ? equippedPlayerMat(profile) : undefined;
}
