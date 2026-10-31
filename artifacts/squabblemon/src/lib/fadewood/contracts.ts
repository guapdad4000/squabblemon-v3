export const WORLD_CHANNEL = 'squabblemon-fadewood' as const;
export const WORLD_VERSION = 1 as const;
export type RuntimeMode = 'exploring' | 'paused' | 'overlay' | 'suspended';
export type WorldCheckpoint = { position: [number, number, number]; yaw: number; arrivalId?: string };
type Envelope = { channel: typeof WORLD_CHANNEL; version: 1; instanceId: string };
export type WorldEvent = Envelope & (
  | { type: 'ready' }
  | { type: 'progress'; progress: number; label: string }
  | { type: 'state'; playing: boolean; travel: boolean; locationId?: string; checkpoint: WorldCheckpoint; nearest?: { id: string; name: string; kind: 'character' | 'portal' }; markers?: {arcId:string;sourceId:string;label:string;x:number;y:number;visible:boolean}[] }
  | { type: 'inspect'; sourceId: string }
  | { type: 'intent'; sourceId: string; screenId: string }
  | { type: 'travelComplete'; requestId: string; destinationId: string; checkpoint?: WorldCheckpoint }
  | { type: 'travelCancelled'; requestId: string }
  | { type: 'focusComplete'; requestId: string; sourceId: string }
  | { type: 'focusCancelled'; requestId: string; sourceId: string; reason?: 'unavailable' | 'cancelled' }
  | { type: 'lighting'; night: boolean; requestedNight: boolean; status: 'loading' | 'ready' | 'error'; message?: string }
  | { type: 'error'; message: string }
);
export function validateWorldCheckpoint(value: unknown): value is WorldCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<WorldCheckpoint>;
  return Array.isArray(c.position) && c.position.length === 3 && c.position.every(Number.isFinite)
    && Math.abs(c.position[0]) <= 29 && c.position[1] >= -1 && c.position[1] <= 15
    && c.position[2] >= -49 && c.position[2] <= 43 && typeof c.yaw === 'number' && Number.isFinite(c.yaw)
    && Math.abs(c.yaw) <= 1000 && (c.arrivalId === undefined || (typeof c.arrivalId === 'string' && c.arrivalId.length <= 80));
}
const short = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 160;
export function isWorldEvent(value: unknown, instanceId: string): value is WorldEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  if (e.channel !== WORLD_CHANNEL || e.version !== WORLD_VERSION || e.instanceId !== instanceId) return false;
  switch (e.type) {
    case 'ready': return true;
    case 'progress': return typeof e.progress === 'number' && Number.isFinite(e.progress) && e.progress >= 0 && e.progress <= 100 && typeof e.label === 'string' && e.label.length <= 240;
    case 'state': return typeof e.playing === 'boolean' && typeof e.travel === 'boolean' && validateWorldCheckpoint(e.checkpoint)
      && (e.markers === undefined || (Array.isArray(e.markers) && e.markers.length <= 32 && e.markers.every(m => m && short(m.arcId) && short(m.sourceId) && short(m.label) && Number.isFinite(m.x) && Number.isFinite(m.y) && m.x >= 0 && m.x <= 100 && m.y >= 0 && m.y <= 100 && typeof m.visible === 'boolean')))
      && (e.locationId === undefined || short(e.locationId)) && (e.nearest === undefined || (!!e.nearest && typeof e.nearest === 'object' && short((e.nearest as Record<string, unknown>).id) && short((e.nearest as Record<string, unknown>).name) && ['character', 'portal'].includes(String((e.nearest as Record<string, unknown>).kind))));
    case 'inspect': return short(e.sourceId);
    case 'intent': return short(e.sourceId) && short(e.screenId);
    case 'travelComplete': return short(e.requestId) && short(e.destinationId) && (e.checkpoint === undefined || validateWorldCheckpoint(e.checkpoint));
    case 'travelCancelled': return short(e.requestId);
    case 'focusComplete': return short(e.requestId) && short(e.sourceId);
    case 'focusCancelled': return short(e.requestId) && short(e.sourceId) && (e.reason === undefined || e.reason === 'unavailable' || e.reason === 'cancelled');
    case 'lighting': return typeof e.night === 'boolean' && typeof e.requestedNight === 'boolean' && ['loading', 'ready', 'error'].includes(String(e.status)) && (e.message === undefined || (typeof e.message === 'string' && e.message.length <= 240));
    case 'error': return typeof e.message === 'string' && e.message.length <= 500;
    default: return false;
  }
}
