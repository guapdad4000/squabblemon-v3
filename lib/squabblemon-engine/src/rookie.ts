import { DISTRICT_CATALOG, type DistrictSnapshot } from './districts';
import type { StoryEncounterSnapshot } from './gameEngine';

/** A short, transparent training matchup. The same snapshot is replayed by the server. */
export function rookieEncounter(): StoryEncounterSnapshot {
  return {
    id: 'rookie-road-v2', roundLimit: 4,
    enemy: { id: 'fade-training', name: 'Dr. Fade’s training crew', portraitAssetId: 'assets/tutorial/dr-fade-welcome.png', deckId: 'vibes', cardIds: ['cornball', 'scarecrow', 'tinman', 'alice', 'rastamon', 'dorothy', 'watson', 'lion', 'plug', 'drfade'], behaviorProfile: 'support' },
    battlefieldAssetId: 'assets/venues/red-fence-night-court.webp', soundHooks: {},
    passive: { name: 'Training wheels', description: 'Four rounds. No timer. Your rival has a small opening hand and limited Motion while you learn.' },
    modifiers: { startingMotion: { cpu: 1 }, handSize: { cpu: 1 }, roundMotionDeltas: [2, 3, 4].map(round => ({ round, owner: 'cpu' as const, amount: -round })) },
  };
}

export function rookieDistricts(): DistrictSnapshot {
  return { version: 1, locations: ['bodega', 'the-trap', 'vip-section'].map(id => structuredClone(DISTRICT_CATALOG.find(d => d.id === id)!)) as DistrictSnapshot['locations'] };
}
