import type { Card } from './data';
export const CREW_MATCHUP_PATCH: Readonly<Record<string, Partial<Pick<Card, 'cost' | 'power'>>>> = {
  // v51: direct-matchup crew bodies; GUAP and approved route kits stay unchanged.
  'calisthenics-yn': { power: 6 }, 'gym-spotter-yn': { power: 5 },
  'jump-rope-menace': { power: 7 }, 'og-calisthenics': { power: 9 },
  'studio-couch-yn': { power: 3 }, 'one-man-band': { power: 7 },
  'fitness-girl': { power: 5 }, 'fitness-bro': { cost: 2, power: 6 },
  'personal-trainer': { power: 6 }, 'demon-trainer': { power: 9 },
  'lash-tech': { power: 5 }, 'apartment-maintenance-sage': { power: 5 },
  sportsprodigy: { power: 7 },
  'the-opening-act': { power: 3 }, 'the-dj': { power: 4 },
  'the-hype-man': { power: 4 }, 'the-manager-nice': { power: 4 },
  'the-rapper': { power: 4 }, 'the-janky-promoter': { power: 6 },
  'the-local-celebrity': { power: 7 }, 'the-battle-rapper': { power: 7 },
  'the-manager-evil': { power: 8 }, 'the-og-rap-legend': { cost: 4, power: 9 },
  failedathlete: { power: 6 },
  // Full-deck follow-up: keep existing ability caps and immunity rules.
  'triple-og-blue': { power: 8 }, 'look-out': { power: 3 },
  blueside1: { power: 3 }, blueside2: { power: 3 }, blueside3: { power: 5 },
  blueside4: { cost: 2, power: 5 }, blueside5: { cost: 2, power: 5 },
  'ganger-blue': { power: 5 }, 'blue-nose-pit': { power: 4 },
  'inmate-crafty': { power: 5 }, 'inmate-boyfriend': { cost: 2, power: 5 },
  'inmate-informant': { cost: 2, power: 5 }, 'inmate-contraband': { power: 5 },
  'inmate-kingpin': { power: 3 }, 'lebron-james': { cost: 3, power: 7 },
  homelessyn: { cost: 1, power: 3 }, homelessguy: { cost: 2, power: 5 },
  homelesslegend: { cost: 3, power: 7 }, 'homeless-wiseman': { cost: 3, power: 6 },
  'community-cook': { power: 5 },
  alice: { cost: 1 }, cheshire: { power: 4 }, mrrabbit: { cost: 1, power: 3 },
  queenofhearts: { power: 6 }, madhatter: { power: 4 },
};
export function applyCrewMatchupBalance(cards: Record<string, Card>): void {
  for (const [id, patch] of Object.entries(CREW_MATCHUP_PATCH)) {
    if (!cards[id] || id === 'guap') throw new Error('Invalid crew matchup patch: ' + id);
    Object.assign(cards[id], patch);
  }
}
