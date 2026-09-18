import { cards, type Card } from './data';
import catalog from './specialMoves.json';
import type { EffectLogEntry } from './gameEngine';
import { getAssetUrl } from './lib/assets';

export type MoveClip = {
  file: string; label: string; move: string; enabled: boolean; revision?: string;
  chroma: 'cyan' | 'green' | 'none';
  startSeconds: number; durationMs: number; playbackRate: number;
};
export const moveClips = catalog.clips as Record<string, MoveClip>;
export const moveAssignments: Record<string, string | null> = catalog.assignments;
export const MOVE_STORAGE_KEY = 'squabblemon.special-moves.v1';
export type MoveOverrides = Record<string, string | null>;

export function getMoveClipUrl(clip: MoveClip) {
  const url = getAssetUrl(`assets/special-moves/${clip.file}`);
  return clip.revision ? `${url}?v=${encodeURIComponent(clip.revision)}` : url;
}

export function readMoveOverrides(): MoveOverrides {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(MOVE_STORAGE_KEY) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, clip]) =>
      Object.hasOwn(cards, key) && (clip === null || (typeof clip === 'string' && Object.hasOwn(moveClips, clip)))));
  } catch { return {}; }
}

/** Accept engine IDs and artwork IDs; new cards always retain the procedural effect. */
export function resolveSpecialMove(card: Card | string, overrides: MoveOverrides = {}) {
  const id = typeof card === 'string' ? card : card.id;
  const engineId = Object.hasOwn(cards, id) ? id : Object.keys(cards).find(key => cards[key].id === id) ?? id;
  const clipId = Object.hasOwn(overrides, engineId) ? overrides[engineId] : moveAssignments[engineId];
  const clip = clipId && Object.hasOwn(moveClips, clipId) ? moveClips[clipId] : undefined;
  return clip?.enabled ? { id: clipId!, ...clip } : null;
}

export function specialMoveForEvent(event: Pick<EffectLogEntry, 'type' | 'kind' | 'cardId'>, overrides: MoveOverrides = {}) {
  return event.type === 'ability' && !['blocked', 'fizzle', 'story'].includes(event.kind)
    ? resolveSpecialMove(event.cardId, overrides) : null;
}

/**
 * Stable key used to gate "play once per match" for special moves. A fighter's
 * leveling up can emit multiple ability events; the gate suppresses repeat
 * video playback and the long beat that comes with it.
 */
export type MovePlayKeyParams = { owner: 'player' | 'cpu' | null; sourceInstanceId: string | null | undefined; moveId: string };
export function getMovePlayKey({ owner, sourceInstanceId, moveId }: MovePlayKeyParams) {
  return `${owner ?? '?'}:${sourceInstanceId ?? '?'}:${moveId}`;
}

/** Pure: returns null when this fighter+move pair already played this match. */
export function gateSpecialMoveReplay(clip: MoveClip & { id: string } | null, params: MovePlayKeyParams, playedSet: Set<string> | null) {
  if (!clip || !playedSet) return clip;
  return playedSet.has(getMovePlayKey(params)) ? null : clip;
}

/** Plan the per-event beat: full move duration the first time, standard afterMs on every replay. */
export function planSpecialMoveBeat(
  clip: MoveClip & { id: string } | null,
  params: MovePlayKeyParams,
  playedSet: Set<string> | null,
  fallbackMs: number,
): { durationMs: number; playKey: string | null } {
  if (!clip) return { durationMs: fallbackMs, playKey: null };
  const playKey = getMovePlayKey(params);
  const alreadyPlayed = playedSet?.has(playKey) ?? false;
  return { durationMs: alreadyPlayed ? fallbackMs : clip.durationMs, playKey };
}

export function markSpecialMovePlayed(playedSet: Set<string> | null, params: MovePlayKeyParams) {
  if (!playedSet) return;
  playedSet.add(getMovePlayKey(params));
}

/** Feather the backing color, retaining white highlights and dark outlines. */
export function keyChromaPixels(data: Uint8ClampedArray, chroma: MoveClip['chroma']) {
  if (chroma === 'none') return;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dominance = chroma === 'cyan' ? Math.min(g, b) - r : g - Math.max(r, b);
    const alpha = 1 - Math.max(0, Math.min(1, (dominance - 35) / 65));
    data[i + 3] = Math.round(data[i + 3] * alpha);
    if (alpha > 0 && alpha < 1) {
      data[i + 1] = Math.round(g * alpha + Math.min(g, r + 25) * (1 - alpha));
      if (chroma === 'cyan') data[i + 2] = Math.round(b * alpha + Math.min(b, r + 25) * (1 - alpha));
    }
  }
}
