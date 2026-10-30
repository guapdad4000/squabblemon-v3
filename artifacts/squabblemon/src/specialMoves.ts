import { cards, type Card } from './data';
import catalog from './specialMoves.json';
import battleMoves from './lib/battleMoves.json';
import type { EffectLogEntry } from './gameEngine';
import { abilityTookEffect } from './abilityOutcome';
import { getAssetUrl } from './lib/assets';

export type MoveClip = {
  file: string; label: string; move: string; enabled: boolean; revision?: string;
  chroma: 'cyan' | 'green' | 'none';
  startSeconds: number; durationMs: number; playbackRate: number;
  keyProfile?: 'anunaki';
};
export const moveClips = Object.fromEntries(Object.entries(catalog.clips).map(([id, clip]) => {
  const engineId = Object.entries(catalog.assignments).find(([, assigned]) => assigned === id)?.[0];
  return [id, { ...clip, ...(engineId && cards[engineId] ? { move: cards[engineId].ability } : {}) }];
})) as Record<string, MoveClip>;
export const moveAssignments: Record<string, string | null> = {
  // New cards keep a fallback until an explicit catalog assignment is delivered.
  ...Object.fromEntries(Object.keys(cards).map(id => [id, null])),
  ...catalog.assignments,
};
export const MOVE_STORAGE_KEY = 'squabblemon.special-moves.v1';
export type MoveOverrides = Record<string, string | null>;

/** Source-time endpoint of the authored excerpt; speed changes only wall-clock time. */
export function getMoveClipEndSeconds(clip: MoveClip, mediaDuration: number) {
  const start = Math.max(0, Math.min(clip.startSeconds, Math.max(0, mediaDuration - .1)));
  return Math.min(mediaDuration, start + clip.durationMs / 1000 * clip.playbackRate);
}

export function getMoveClipUrl(clip: MoveClip, quality: 'original' | 'battle' = 'original') {
  const derivative = (battleMoves as Record<string, {asset: string; revision: string | null}>)[clip.file];
  if (quality === 'battle' && derivative && (clip.revision ?? null) === derivative.revision) return getAssetUrl(derivative.asset);
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

export function specialMoveForEvent(event: Pick<EffectLogEntry, 'type' | 'cardId'> & Partial<Pick<EffectLogEntry, 'cardInstanceId'>> & Parameters<typeof abilityTookEffect>[0], overrides: MoveOverrides = {}) {
  // A Caucus chain can produce eight unique summoned instances. Keep their
  // damage and summon cues, but do not replay the full movie for every copy.
  const sourceId = event.source?.cardInstanceId ?? event.cardInstanceId;
  if (event.cardId === 'caucus-mountaineer' && sourceId?.startsWith('summon:')) return null;
  return abilityTookEffect(event)
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
export const ANUNAKI_CHROMA_KEY = { threshold: 24, feather: 58, spill: 18, edgeFeather: .035 } as const;
export function keyChromaPixels(data: Uint8ClampedArray, chroma: MoveClip['chroma'], profile?: MoveClip['keyProfile']) {
  if (chroma === 'none') return;
  const key = profile === 'anunaki' ? ANUNAKI_CHROMA_KEY : { threshold: 35, feather: 65, spill: 25 };
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dominance = chroma === 'cyan' ? Math.min(g, b) - r : g - Math.max(r, b);
    const alpha = 1 - Math.max(0, Math.min(1, (dominance - key.threshold) / key.feather));
    data[i + 3] = Math.round(data[i + 3] * alpha);
    if (alpha > 0 && alpha < 1) {
      const spillFloor = profile === 'anunaki' && chroma === 'green' ? Math.max(r, b) : r;
      data[i + 1] = Math.round(g * alpha + Math.min(g, spillFloor + key.spill) * (1 - alpha));
      if (chroma === 'cyan') data[i + 2] = Math.round(b * alpha + Math.min(b, r + key.spill) * (1 - alpha));
    }
  }
}
