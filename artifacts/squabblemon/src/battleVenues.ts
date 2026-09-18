import type { Match } from './gameEngine';

export type BattleVenue = {
  id: 'corner-store' | 'harbor-skyline' | 'civic-hill' | 'red-fence-night' | 'crown-rooftop';
  assetId: string;
  tone: 'gold' | 'harbor' | 'civic' | 'hostile' | 'championship';
  position: string;
};

export const BATTLE_VENUES: Record<BattleVenue['id'], BattleVenue> = {
  'corner-store': { id: 'corner-store', assetId: 'assets/layered/corner-store.webp', tone: 'gold', position: '50% 50%' },
  'harbor-skyline': { id: 'harbor-skyline', assetId: 'assets/layered/moon-rooftop.webp', tone: 'harbor', position: '50% 47%' },
  'civic-hill': { id: 'civic-hill', assetId: 'assets/layered/civic-summit.webp', tone: 'civic', position: '50% 52%' },
  'red-fence-night': { id: 'red-fence-night', assetId: 'assets/layered/red-court.webp', tone: 'hostile', position: '50% 50%' },
  'crown-rooftop': { id: 'crown-rooftop', assetId: 'assets/layered/crown-court.webp', tone: 'championship', position: '50% 49%' },
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
