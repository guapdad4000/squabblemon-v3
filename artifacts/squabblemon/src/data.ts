import { BOSS_NPCS, type BossNpcId } from "@workspace/squabblemon-engine/bossNpcCards";
export * from "@workspace/squabblemon-engine/data";
import { getAssetUrl, getCardImage as getCatalogCardImage } from "./lib/assets";

export { getAssetUrl } from "./lib/assets";

/** All Buddy portraits use the shared artwork revision manifest. */
export const getCardImage = (cardId: string, variantId?: string | null) => Object.hasOwn(BOSS_NPCS, cardId)
  ? getAssetUrl(`assets/boss-raid/${BOSS_NPCS[cardId as BossNpcId].art}.webp`)
  : getCatalogCardImage(cardId, variantId);

/** The rock artwork is reserved for a Buddy instance transformed in battle. */
export const getBuddySquabbleImage = () => getCatalogCardImage("buddy-squabble");
export const getBuddyBannerImage = () => getCatalogCardImage("buddy-banner");
