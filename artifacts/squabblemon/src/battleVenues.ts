import type { Match } from './gameEngine';

export type BattleVenue = {
  id: 'corner-store' | 'harbor-skyline' | 'civic-hill' | 'red-fence-night' | 'crown-rooftop';
  assetId: string;
  portraitAssetId: string;
  tone: 'gold' | 'harbor' | 'civic' | 'hostile' | 'championship';
  position: string;
};

export const BATTLE_VENUES: Record<BattleVenue['id'], BattleVenue> = {
  'corner-store': { id: 'corner-store', assetId: 'assets/layered/corner-store.webp', portraitAssetId: 'assets/venues/corner-store-court.webp', tone: 'gold', position: '50% 50%' },
  'harbor-skyline': { id: 'harbor-skyline', assetId: 'assets/layered/moon-rooftop.webp', portraitAssetId: 'assets/venues/harbor-skyline-court.webp', tone: 'harbor', position: '50% 47%' },
  'civic-hill': { id: 'civic-hill', assetId: 'assets/layered/civic-summit.webp', portraitAssetId: 'assets/venues/civic-hill-climb.webp', tone: 'civic', position: '50% 52%' },
  'red-fence-night': { id: 'red-fence-night', assetId: 'assets/layered/red-court.webp', portraitAssetId: 'assets/venues/red-fence-night-court.webp', tone: 'hostile', position: '50% 50%' },
  'crown-rooftop': { id: 'crown-rooftop', assetId: 'assets/layered/crown-court.webp', portraitAssetId: 'assets/venues/crown-rooftop-court.webp', tone: 'championship', position: '50% 49%' },
};

const STORY_VENUES: Record<string, BattleVenue['id']> = {
  'welcome-to-the-block': 'corner-store',
  'blue-side-pressure': 'harbor-skyline',
  'receipts-on-camera': 'red-fence-night',
  'red-side-retaliation': 'red-fence-night',
  'side-alley-challenge': 'corner-store',
  'snitch-at-the-corner': 'civic-hill',
  'cracked-head-takes-the-block': 'crown-rooftop',
};

const TRAINING_VENUES: Record<string, BattleVenue['id']> = {
  block: 'corner-store',
  slide: 'harbor-skyline',
  crashout: 'red-fence-night',
  receipts: 'red-fence-night',
  combo: 'civic-hill',
  vibes: 'crown-rooftop',
  compound: 'crown-rooftop',
};

/** Resolves only from immutable match identity, so replay frames never change venues. */
export function resolveBattleVenue(match: Pick<Match, 'cpuDeck' | 'storyEncounter'>): BattleVenue {
  const id = match.storyEncounter
    ? STORY_VENUES[match.storyEncounter.id] ?? 'civic-hill'
    // Unknown external/custom rivals stay on the neighborhood training court.
    : TRAINING_VENUES[match.cpuDeck] ?? 'corner-store';
  return BATTLE_VENUES[id];
}

/** Pair the issued venue artwork by asset identity, including activity snapshots
 * whose encounter id is outside the story venue map. Custom story art stays intact. */
export function resolveBattleArtwork(match: Pick<Match, 'cpuDeck' | 'storyEncounter'>): { landscapeAssetId: string; portraitAssetId: string } {
  const venue = resolveBattleVenue(match);
  const issuedAsset = match.storyEncounter?.battlefieldAssetId;
  const pair = issuedAsset
    ? Object.values(BATTLE_VENUES).find(candidate => candidate.assetId === issuedAsset || candidate.portraitAssetId === issuedAsset)
    : venue;
  return {
    landscapeAssetId: pair?.assetId ?? issuedAsset ?? venue.assetId,
    portraitAssetId: pair?.portraitAssetId ?? venue.portraitAssetId,
  };
}
