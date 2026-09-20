import { DECK_SIZE, completeEngineCrew, cards, decks, catalogCardByEngineId } from './data';
import type { StoryEncounterSnapshot } from './gameEngine';

export const activities = [
  { id: 'auto', name: 'Open training', description: 'Meet a rotating rival with your own card upgrades.', normalized: false },
  { id: 'pressure', name: 'Pressure test', description: 'Face an aggressive mixed gang that contests early districts.', normalized: false },
  { id: 'control', name: 'Control test', description: 'Practice timing against silence and protection.', normalized: false },
  { id: 'movement', name: 'Movement test', description: 'Track a rival that shifts Hands between districts.', normalized: false },
  { id: 'support', name: 'Support test', description: 'Break up a rival’s buffs and protection.', normalized: false },
  { id: 'freeze', name: 'Beat the freeze', description: 'Practice recovery against Snow. Bring a cleanser.', normalized: false },
  { id: 'cheap', name: 'Break the chain', description: 'Face Gamer and a gang of cheap arrivals.', normalized: false },
  { id: 'fair', name: 'Equal footing', description: 'Competitive practice: both gangs use base move tiers. No ranked ladder yet.', normalized: true },
  { id: 'neighborhood', name: 'Neighborhood night', description: 'Weekly rotating district rules; both gangs use base move tiers.', normalized: true },
  { id: 'draft', name: 'Street draft', description: 'Pick one of three cards ten times. Borrowed cards are for this event only; equal move tiers.', normalized: true },
  { id: 'boss', name: 'After-hours boss', description: 'A tougher three-phase rival. Equal move tiers; earn a clear badge.', normalized: true },
] as const;
export type ActivityId = typeof activities[number]['id'];
export const isActivityId = (id: string): id is ActivityId => activities.some(a => a.id === id);
export function stableHash(text: string): number { let n = 2166136261; for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; }
export function eventWeek(now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
const pools: Record<string, string[]> = {
  pressure: ['youngbull', 'tayaty', 'transplant', 'edgar', 'hooper', 'roaster', 'manman', 'baby', 'oink'],
  control: ['honestthot', 'snow', 'nerd', 'wifey', 'roaster', 'tayaty', 'nail', 'landlord', 'cornball'],
  movement: ['nguyen', 'transplant', 'bikelife', 'delivery', 'carmeet', 'vibe', 'cornball', 'plug', 'youngbull'],
  support: ['earthy', 'edgar', 'pinaynurse', 'church', 'nail', 'abuela', 'icecream', 'wifey', 'rastamon'],
  freeze: ['snow', 'honestthot', 'wifey', 'cornball', 'roaster', 'youngbull', 'nail'],
  cheap: ['gamer', 'streamer', 'earthy', 'tayaty', 'edgar', 'nguyen', 'plug'],
};
export function draftOffers(week: string): string[][] {
  const pool = Object.keys(cards).sort((a, b) => stableHash(`${week}:${a}`) - stableHash(`${week}:${b}`) || a.localeCompare(b));
  // First offer guarantees an affordable opener, without prescribing the crew.
  const cheap = pool.filter(id => cards[id].cost <= 2).slice(0, 3);
  const rest = pool.filter(id => !cheap.includes(id));
  return [cheap, ...Array.from({ length: DECK_SIZE - 1 }, (_, i) => rest.slice(i * 3, i * 3 + 3))];
}
export function validateDraft(week: string, picks: readonly string[]): boolean {
  const offers = draftOffers(week);
  return picks.length === DECK_SIZE && new Set(picks).size === DECK_SIZE && picks.every((id, i) => offers[i].includes(id));
}
export function makeActivityEncounter(kind: ActivityId, seed: string, fallback: string, week: string, previousCardIds?: string[]): StoryEncounterSnapshot {
  const style = kind === 'auto' || kind === 'fair' || kind === 'neighborhood' || kind === 'draft' || kind === 'boss'
    ? ['pressure', 'control', 'movement', 'support'][stableHash(seed) % 4] : kind;
  const pool = pools[style] ?? pools.pressure;
  let roster = [...pool].sort((a, b) => stableHash(`${seed}:${a}`) - stableHash(`${seed}:${b}`) || a.localeCompare(b)).slice(0, DECK_SIZE);
  // Mix cards while keeping an affordable opening and the challenge's core identity.
  if (kind === 'freeze') roster = pools.freeze;
  if (kind === 'cheap') roster = pools.cheap;
  if (kind === 'auto') roster = [...(decks.find(d => d.id === fallback)?.cards ?? roster)];
  roster = completeEngineCrew(roster).sort((a, b) => cards[a].cost - cards[b].cost);
  const rule = stableHash(week) % 3;
  const title = activities.find(a => a.id === kind)!;
  const description = kind === 'neighborhood' ? [
    'Street festival: both gangs gain +2 district Hands in The Town.',
    'Server maintenance: neither gang can summon in Server Room in round 3.',
    'Open mic: both gangs gain +2 district Hands in Group Chat.',
  ][rule] : kind === 'boss' ? 'Round 1: +1 rival Motion. Round 4: +2 rival Hands in Group Chat. Round 5: Snow joins the rival hand.' : title.description;
  return {
    id: `activity:${kind}:${week}`, activity: { kind, seed, normalized: title.normalized, previousCardIds },
    enemy: { id: `rival:${seed}`, name: kind === 'boss' ? 'After-hours Gang' : `${style[0].toUpperCase()}${style.slice(1)} Rival`, portraitAssetId: `assets/characters/${catalogCardByEngineId[roster[0]].catalogId}.webp`, deckId: `rival-${style}`, cardIds: roster, behaviorProfile: style },
    battlefieldAssetId: 'assets/venues/red-fence-night-court.webp', soundHooks: {},
    passive: { name: title.name, description },
    ...(kind === 'neighborhood' ? { modifiers: rule === 1 ? { laneLocks: [{ round: 3, owner: 'both', lanes: [2] }] } : { lanePowerBonuses: [{ owner: 'both', lane: rule === 0 ? 0 : 1, amount: 2 }] } } : {}),
    ...(kind === 'boss' ? { phases: [
      { id: 'opening', name: 'First on the block', trigger: { kind: 'round', atLeast: 1 }, onEnter: [{ kind: 'motion', owner: 'cpu', amount: 1 }] },
      { id: 'pressure', name: 'Crowd pressure', trigger: { kind: 'round', atLeast: 4 }, onEnter: [{ kind: 'lane-power', owner: 'cpu', lane: 1, amount: 2 }] },
      { id: 'backup', name: 'Cold backup', trigger: { kind: 'round', atLeast: 5 }, onEnter: [{ kind: 'reinforcement', owner: 'cpu', cardId: 'snow' }] },
    ] } : {}),
  };
}
