import {
  createMatchFromEngineCards, createAbilityUpgradeSnapshot, createDistrictSnapshot,
  type Lane, type Owner,
} from '@workspace/squabblemon-engine/gameEngine';
import { seededDeckRotation } from '@workspace/squabblemon-engine/balanceLab';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, type OnlineRoom, type OnlineMember } from '@workspace/squabblemon-engine/multiplayer';

export const rivalryRecipes = {
  blue: ['triple-og-blue', 'look-out', 'blueside1', 'ganger-blue', 'blue-nose-pit', 'initiation', 'waterboy', 'alchy', 'cognac', 'bustdown'],
  red: ['triple-og-red', 'block-spinner', 'redside1', 'ganger-red', 'cane-corso-red', 'initiation', 'redneck-evil', 'redside5', 'cognac', 'bustdown'],
};
export type RivalrySettings = { first: 'blue' | 'red'; tier: number; seed: string; openingSeat?: Owner; recipes?: { blue: readonly string[]; red: readonly string[] } };
export type RivalryCommand = { kind: 'play'; owner: Owner; id: string; lane: Lane; squabble: boolean } | { kind: 'pass'; owner: Owner };
/** In-memory local fixture only. No room is published or network request made. */
export function createRivalryRoom(settings: RivalrySettings): OnlineRoom {
  const other = settings.first === 'blue' ? 'red' : 'blue';
  const order = (side: 'blue' | 'red') => seededDeckRotation((settings.recipes ?? rivalryRecipes)[side], `${settings.seed}:${side}`, 0);
  const p = order(settings.first), c = order(other);
  if ([...p, ...c].some(id => ['guap', 'folks'].includes(id))) throw new Error('GUAP and FOLKS are excluded');
  const member = (side: 'blue' | 'red', cards: string[]): OnlineMember => ({ userId: side, name: side,
    ready: false, deck: { id: side, name: side, hero: cards[0], cards } });
  let room = createOnlineRoom(member(settings.first, p), settings.openingSeat ?? 'player', 0);
  room = joinOnlineRoom(room, member(other, c), 0);
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, 0);
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, 0);
  const progress = (ids: string[]) => Object.fromEntries(ids.map(id => [id, { xp: settings.tier ? 4500 : 0, level: settings.tier ? 10 : 1, moveTier: settings.tier }]));
  const snapshot = createAbilityUpgradeSnapshot(p, c, { player: progress(p), cpu: progress(c) });
  const match = createMatchFromEngineCards(settings.first, p, other, c, undefined, undefined, snapshot, createDistrictSnapshot(settings.seed));
  return { ...room, match: { ...match, squabbleByOwner: { player: false, cpu: false }, phase: room.openingSeat === 'player' ? 'player' : 'cpu-reveal' } };
}
export function applyRivalryCommand(room: OnlineRoom, command: RivalryCommand): OnlineRoom {
  return applyOnlineCommand(room, command.owner, command.kind === 'play'
    ? { type: 'play', instanceId: command.id, lane: command.lane, squabble: command.squabble }
    : { type: 'end-turn' }, 0);
}
