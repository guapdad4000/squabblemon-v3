import { eventWeek, makeActivityEncounter, validateDraft, type ActivityId } from '@workspace/squabblemon-engine/activities';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import type { CardProgressionMap } from '@workspace/squabblemon-engine/cardProgression';
import { cards, catalogIdsToEngineIds } from '@workspace/squabblemon-engine/data';
import { createDistrictSnapshot, createStoryMatch } from '@workspace/squabblemon-engine/gameEngine';
import { selectTrainingRival } from '@workspace/squabblemon-engine/training';

/** Unsaved practice for the local preview account; no API or reward writes. */
export function createLocalPracticeMatch({
  deckId, catalogCardIds, activity, progression = {}, draftPicks,
  week = eventWeek(), seed = crypto.randomUUID(),
}: {
  deckId: string;
  catalogCardIds: string[];
  activity: ActivityId;
  progression?: CardProgressionMap;
  draftPicks?: string[];
  week?: string;
  seed?: string;
}) {
  if (activity === 'draft' && (!draftPicks || !validateDraft(week, draftPicks))) {
    throw new Error('Choose one card from each of the ten draft offers.');
  }
  const playerCards = activity === 'draft' ? [...draftPicks!] : catalogIdsToEngineIds(catalogCardIds);
  const rivalId = selectTrainingRival(deckId, playerCards, progression, seed);
  const generated = makeActivityEncounter(activity, seed, rivalId, week);
  const encounter = { ...generated, enemy: { ...generated.enemy, deckId: rivalId } };
  const playerProgression: CardProgressionMap = {};
  if (!encounter.activity?.normalized) {
    for (const cardId of playerCards) {
      const progress = progression[cards[cardId].id];
      if (progress) playerProgression[cardId] = progress;
    }
  }
  const upgrades = createAbilityUpgradeSnapshot(playerCards, encounter.enemy.cardIds, { player: playerProgression });
  return createStoryMatch(encounter, playerCards, deckId, upgrades, createDistrictSnapshot(seed));
}
