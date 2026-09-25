export * from "@workspace/squabblemon-engine/data";
import { getCardImage as getCatalogCardImage } from "./lib/assets";

export { getAssetUrl } from "./lib/assets";

/** All Buddy portraits use the shared artwork revision manifest. */
export const getCardImage = (cardId: string, variantId?: string | null) => getCatalogCardImage(cardId, variantId);

/** The rock artwork is reserved for a Buddy instance transformed in battle. */
export const getBuddySquabbleImage = () => getCatalogCardImage("buddy-squabble");
export const getBuddyBannerImage = () => getCatalogCardImage("buddy-banner");
