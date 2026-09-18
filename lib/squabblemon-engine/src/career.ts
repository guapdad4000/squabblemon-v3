import { catalogCardByEngineId } from './data';
import { battleAchievements } from './insights';
import { getMatchWinner, type Match } from './gameEngine';
export type CareerProgress = { cleansed: boolean; movementWin: boolean; changedCrew: boolean; choices: string[]; wins: Record<string, number> };
export function readCareer(value: unknown): CareerProgress {
  const raw = value && typeof value === 'object' ? value as Partial<CareerProgress> : {};
  return { cleansed: raw.cleansed === true, movementWin: raw.movementWin === true, changedCrew: raw.changedCrew === true,
    choices: Array.isArray(raw.choices) ? raw.choices.filter(id => typeof id === 'string') : [],
    wins: raw.wins && typeof raw.wins === 'object' ? Object.fromEntries(Object.entries(raw.wins).filter(([id,n]) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) : {} };
}
export function availableCareerChoices(value: unknown) { const p = readCareer(value); return Math.max(0, Number(p.cleansed) + Number(p.movementWin) + Number(p.changedCrew) - p.choices.length); }
export function advanceCareer(value: unknown, match: Match, owned: readonly string[], cosmetics: readonly string[]) {
  const previous = readCareer(value), facts = battleAchievements(match);
  const progress = { ...previous, wins: { ...previous.wins }, cleansed: previous.cleansed || facts.cleansed, movementWin: previous.movementWin || facts.movementWin,
    changedCrew: previous.changedCrew || (match.storyEncounter?.activity?.kind !== 'draft' && facts.changedCrew) };
  const unlocked = new Set(cosmetics);
  if (getMatchWinner(match) === 'player') {
    for (const id of facts.playedIds) {
      const catalogId = catalogCardByEngineId[id]?.catalogId;
      if (!catalogId || !owned.includes(catalogId)) continue;
      progress.wins[catalogId] = Math.min(5, (progress.wins[catalogId] ?? 0) + 1);
      if (progress.wins[catalogId] === 5) unlocked.add(`mastery:${catalogId}`);
    }
    if (match.storyEncounter?.activity?.kind === 'boss') unlocked.add('badge:after-hours');
    if (match.storyEncounter?.activity?.kind === 'draft') unlocked.add('badge:street-draft');
    if (match.storyEncounter?.activity?.kind === 'neighborhood') unlocked.add('badge:neighborhood');
  }
  return { progress, cosmetics: [...unlocked] };
}
