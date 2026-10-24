import type { PackReward } from '@workspace/api-client-react';
import { STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';
import { catalogCardById, getAssetUrl, getCardImage } from '../data';
import drFadeLayers from '../drFadeLayers.json';
import { getCardArtworkId } from './assets';
import { warmImages } from './imageWarmup';
import { collectiblePrintArtworkSources } from './collectiblePrintAssets';

/** Only issued receipt art, with the same portrait and print URLs as the renderer. */
export function packRewardArtworkSources(rewards: readonly PackReward[]): string[] {
  const sources = new Set<string>();
  // A saved receipt can be restored from storage. Bound speculative work to the
  // largest supported opening even if that local value is malformed or oversized.
  const issued = rewards.slice(0, STREET_PACK_RULES.ten.rewards);
  const addPortrait = (reward: PackReward) => {
    const card = reward.cardId ? catalogCardById[reward.cardId] : undefined;
    if (!card) return;
    if (card.id === 'dr-fade') {
      for (const layer of drFadeLayers.layers) sources.add(getAssetUrl(layer.asset));
    } else sources.add(getCardImage(getCardArtworkId(card), reward.variantId));
  };
  // The ten-pull may move one rarest reward to the end. Preparing at most the
  // first two printed cards covers either first face without copying that order
  // decision or warming every element in a haul. Give these assets queue priority.
  let prints = 0;
  for (const reward of issued) {
    const card = reward.cardId ? catalogCardById[reward.cardId] : undefined;
    if (!card || !['card', 'variant', 'styleShards'].includes(reward.kind)) continue;
    addPortrait(reward);
    for (const source of collectiblePrintArtworkSources(card)) sources.add(source);
    if (++prints === 2) break;
  }
  for (const reward of issued) addPortrait(reward);
  return [...sources];
}

/** Start during the paid opening, without delaying its receipt or reveal. The
 * shared queue bounds network/decode work and retries failures on a later call. */
export function warmPackRewardArtwork(rewards: readonly PackReward[]): Promise<boolean[]> {
  return warmImages(packRewardArtworkSources(rewards));
}
