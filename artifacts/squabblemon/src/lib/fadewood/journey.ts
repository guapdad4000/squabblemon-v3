import { validateWorldCheckpoint, type WorldCheckpoint } from './contracts';
export { validateWorldCheckpoint } from './contracts';
const PREFIX = 'squabblemon:fadewood:v1:';
export type StoryResume = { nodeId: string; arcId: string; updatedAt: number };
function read<T>(accountId: string, part: string): T | null {
  if (typeof sessionStorage === 'undefined') return null;
  try { const key = `${PREFIX}${encodeURIComponent(accountId)}:${part}`;
    return JSON.parse((part === 'story' && typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null) ?? sessionStorage.getItem(key) ?? 'null') as T | null; } catch { return null; }
}
function write(accountId: string, part: string, value: unknown) {
  if (typeof sessionStorage === 'undefined') return;
  try { const key = `${PREFIX}${encodeURIComponent(accountId)}:${part}`;
    sessionStorage.setItem(key, JSON.stringify(value));
    if (part === 'story' && typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage restrictions do not block play. */ }
}
export function readWorldCheckpoint(accountId: string): WorldCheckpoint | null {
  const value = read<unknown>(accountId, 'checkpoint');
  return validateWorldCheckpoint(value) ? value : null;
}
export function saveWorldCheckpoint(accountId: string, checkpoint: WorldCheckpoint) {
  if (validateWorldCheckpoint(checkpoint)) write(accountId, 'checkpoint', checkpoint);
}
export function readStoryResume(accountId: string): StoryResume | null {
  const value = read<Partial<StoryResume>>(accountId, 'story');
  return value && typeof value.nodeId === 'string' && value.nodeId.length <= 160 && typeof value.arcId === 'string' && value.arcId.length <= 100 && typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
    ? value as StoryResume : null;
}
export function saveStoryResume(accountId: string, nodeId: string, arcId: string) {
  if (nodeId.length <= 160 && arcId.length <= 100) write(accountId, 'story', { nodeId, arcId, updatedAt: Date.now() });
}
export function forgetStoryResume(accountId: string) {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.removeItem(`${PREFIX}${encodeURIComponent(accountId)}:story`);
    if (typeof localStorage !== 'undefined') localStorage.removeItem(`${PREFIX}${encodeURIComponent(accountId)}:story`); } catch { /* Optional view memory. */ }
}
