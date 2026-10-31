import { catalogIdsToEngineIds } from './data';
import { BOSS_DISTRICT_SNAPSHOT } from './bossDistricts';
import type { DistrictSnapshot } from './districts';
import { createMatchFromEngineCards, chooseCpuPlay, getLaneScoreForMatch, nextRound, pass, playTurnCard, suppressMatchPresentationEvents, type Lane, type Match } from './gameEngine';

export const ANUNAKI_RAID_LOANER = ['nabu', 'enki', 'utu', 'ninhursag', 'inanna', 'yakub', 'enlil', 'ereshkigal', 'caucus-mountaineer', 'anu'] as const;
export type AnunakiRaidDifficulty = 'training' | 'standard' | 'ascended';
export type AnunakiRaidAction = { type: 'play'; instanceId: string; lane: Lane; squabble?: boolean; investment?: number } | { type: 'blast' } | { type: 'retire' };
export type AnunakiRaidPhase = 'descent' | 'redirect' | 'heaven';
export type AnunakiRaid = { id: string; revision: number; difficulty: AnunakiRaidDifficulty; status: 'active' | 'won' | 'lost' | 'retired';
  match: Match; hp: number; maxHp: number; phase: AnunakiRaidPhase; targetLane: Lane; charge: number; protection: boolean; log: string[];
  reward?: { firstClear: boolean; weekly: boolean; packTickets: number; softCurrency: number; styleShards: number; unlocks: string[] };
  lastBlast: null | { round: number; damage: number; attack: number; reduced: boolean; interrupted: boolean; phase: AnunakiRaidPhase; hpBefore: number; hpAfter: number } };
export class AnunakiRaidRuleError extends Error {}
export const ANUNAKI_RAID_DISTRICTS = [
  { name: 'Tablet Archive', rule: 'Play here to create a temporary raid Tablet.', objective: 'A Tablet interrupts protection and the final charge.' },
  { name: 'Arrival Gate', rule: '6 Hands here break Anu’s protection.', objective: 'Meet this threshold with an Archive Tablet to interrupt.' },
  { name: 'Celestial Conduit', rule: '6 Hands here reduce the announced attack.', objective: 'Maintain 6 Hands to reduce the incoming strike.' },
] as const;
const maxHp = (difficulty: AnunakiRaidDifficulty) => difficulty === 'training' ? 70 : difficulty === 'standard' ? 100 : 160;
const phaseForHp = (hp: number, maximum: number): AnunakiRaidPhase => hp * 100 <= maximum * 35 ? 'heaven' : hp * 100 <= maximum * 70 ? 'redirect' : 'descent';
const playerHands = (match: Match, lane: Lane) => getLaneScoreForMatch(match, match.boards[lane].filter(card => card.owner === 'player'), lane, 'player');
const archiveTablet = (match: Match) => (match.ancientTablets ?? []).some(t => t.owner === 'player' && t.lane === 0);
const addLog = (raid: AnunakiRaid, text: string) => { raid.log = [...raid.log, text].slice(-12); };
/** Engine-only symbol flags stay inside a turn, never in a saved/API result. */
const savedRaid = (raid: AnunakiRaid): AnunakiRaid => ({ ...raid, match: structuredClone(raid.match) });
export function createAnunakiRaid(id: string, difficulty: AnunakiRaidDifficulty, catalogIds: readonly string[]): AnunakiRaid {
  const ids = catalogIdsToEngineIds([...catalogIds]);
  const opponent = catalogIdsToEngineIds([...ANUNAKI_RAID_LOANER]);
  const hp = maxHp(difficulty);
  const districts: DistrictSnapshot = { version: 1, locations: BOSS_DISTRICT_SNAPSHOT.locations.map((location, index) => ({ ...location, name: ANUNAKI_RAID_DISTRICTS[index].name, rule: ANUNAKI_RAID_DISTRICTS[index].rule, strategy: ANUNAKI_RAID_DISTRICTS[index].objective })) as DistrictSnapshot['locations'] };
  return savedRaid({ id, difficulty, revision: 0, status: 'active', match: suppressMatchPresentationEvents(createMatchFromEngineCards('anunaki-raid-player', ids, 'anunaki-raid-boss', opponent, undefined, undefined, undefined, districts)),
    hp, maxHp: hp, phase: 'descent', targetLane: 1, charge: 0, protection: false, log: ['Descent: Anu announces a strike on Arrival Gate next round.'], lastBlast: null });
}
export function applyAnunakiRaidAction(current: AnunakiRaid, action: AnunakiRaidAction): AnunakiRaid {
  if (current.status !== 'active') throw new AnunakiRaidRuleError('This raid has ended.');
  // Raid presentation uses the live field and lastBlast, never engine film snapshots.
  // Restore this non-serialized flag on every request and discard legacy film history
  // before cloning so saved actions and exact retry receipts stay bounded.
  const raid: AnunakiRaid = structuredClone({ ...current, match: { ...current.match, effectLog: [] } });
  raid.match = suppressMatchPresentationEvents(raid.match);
  raid.revision++;
  if (action.type === 'retire') { raid.status = 'retired'; addLog(raid, 'Raid retired.'); return savedRaid(raid); }
  if (action.type === 'play') {
    if (![0, 1, 2].includes(action.lane)) throw new AnunakiRaidRuleError('Choose a valid district.');
    try { raid.match = playTurnCard(raid.match, 'player', action.instanceId, action.lane, action.squabble ?? false, action.investment ?? 0); }
    catch (error) { throw new AnunakiRaidRuleError(error instanceof Error ? error.message : 'Illegal play.'); }
    if (action.lane === 0 && !archiveTablet(raid.match)) {
      raid.match.ancientTablets = [...(raid.match.ancientTablets ?? []), { owner: 'player', lane: 0 }];
      addLog(raid, 'Tablet Archive created a temporary raid Tablet.');
    }
    return savedRaid(raid);
  }
  const round = raid.match.round;
  const startingPhase = raid.phase;
  raid.match = pass(raid.match, 'player');
  for (let i = 0; i < 10; i++) {
    const choice = chooseCpuPlay(raid.match, false);
    if (!choice) break;
    raid.match = playTurnCard(raid.match, 'cpu', choice.instanceId, choice.lane, choice.squabble, choice.investment);
  }
  raid.match = pass(raid.match, 'cpu');
  const gate = playerHands(raid.match, 1), conduit = playerHands(raid.match, 2), hasTablet = archiveTablet(raid.match);
  const interrupted = startingPhase !== 'descent' && hasTablet && gate >= 6;
  const reduced = conduit >= 6;
  if (interrupted) {
    raid.match.ancientTablets = (raid.match.ancientTablets ?? []).filter(t => t.owner !== 'player' || t.lane !== 0);
    raid.protection = false; raid.charge = 0;
    addLog(raid, 'The Archive Tablet and Arrival Gate interrupted Anu.');
  }
  const attack = Math.max(0, (raid.difficulty === 'ascended' ? 4 : 3) - (reduced ? 2 : 0));
  const target = raid.targetLane;
  raid.match.boards[target] = raid.match.boards[target].map(card => card.owner === 'player' && !card.hazard && !card.statuses.protected && !card.statuses.uncounterable
    ? { ...card, powerModifier: card.powerModifier - attack, lastEffectNote: `Anu's announced strike: −${attack} Hands.` } : card);
  if (startingPhase === 'heaven' && !interrupted) raid.charge++;
  const hpBefore = raid.hp;
  raid.match = nextRound({ ...raid.match, phase: 'resolved' }, settled => {
    const raw = ([0,1,2] as const).reduce((sum, lane) => sum + Math.max(0, playerHands(settled, lane)), 0) * 2;
    const damage = Math.min(raid.hp, raid.protection ? Math.floor(raw / 2) : raw);
    raid.hp -= damage;
    raid.lastBlast = { round, damage, attack, reduced, interrupted, phase: startingPhase, hpBefore, hpAfter: raid.hp };
    return settled;
  });
  if (raid.hp <= 0) { raid.status = 'won'; raid.match.phase = 'complete'; addLog(raid, 'Anu defeated.'); return savedRaid(raid); }
  if (startingPhase === 'heaven' && raid.charge >= 3) { raid.status = 'lost'; raid.match.phase = 'complete'; addLog(raid, 'Heaven Comes Down finished charging.'); return savedRaid(raid); }
  if (round >= 6) { raid.status = 'lost'; raid.match.phase = 'complete'; addLog(raid, 'Anu held the arrival for six rounds.'); return savedRaid(raid); }
  const nextPhase = phaseForHp(raid.hp, raid.maxHp);
  if (nextPhase !== startingPhase) {
    raid.phase = nextPhase; raid.charge = 0; raid.protection = nextPhase !== 'descent';
    addLog(raid, nextPhase === 'heaven' ? 'Heaven Comes Down: interrupt the visible three-round charge.' : 'Redirect: Anu is protected; use the Archive Tablet and Arrival Gate.');
  } else if (nextPhase === 'redirect' && !interrupted) raid.protection = true;
  raid.targetLane = ((raid.targetLane + 1) % 3) as Lane;
  addLog(raid, `Next round: Anu targets ${ANUNAKI_RAID_DISTRICTS[raid.targetLane].name}. ${reduced ? 'Conduit reduced this strike.' : 'Hold 6 Hands at the Conduit to reduce it.'}`);
  return savedRaid(raid);
}
