import { createContext, useContext, type ReactNode } from 'react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { ownsStyle, styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import { getAssetUrl } from '../lib/assets';
const CosmeticContext = createContext<PlayerBootstrap['profile'] | null>(null);
export function CosmeticProvider({ profile, children }: { profile: PlayerBootstrap['profile']; children: ReactNode }) {
  return <CosmeticContext.Provider value={profile}>{children}</CosmeticContext.Provider>;
}
export function useCardScene(cardId: string) {
  const profile = useContext(CosmeticContext);
  return profile ? cardSceneFor(profile, cardId) : undefined;
}
export function cardSceneFor(profile: PlayerBootstrap['profile'], cardId: string) {
  const set = styleSetFor(cardId);
  return set && profile.settings?.cosmetics?.cardBackgrounds?.[cardId] === 'blue-hour' && ownsStyle(profile, cardId, 'character-backdrop') ? getAssetUrl(set.background) : undefined;
}
