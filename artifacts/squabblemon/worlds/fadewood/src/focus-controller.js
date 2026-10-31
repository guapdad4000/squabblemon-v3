import { Vector3 } from 'three';
import { characterCameraShot } from './character-interactions.js';
import { portalCameraShot } from './world-portal-interactions.js';
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const vector = value => value?.isVector3 ? value.clone() : new Vector3(...value);
/** Authored shots, without mounting the audition's conversation UI. */
export function createFocusController({ getCharacters = () => [], getPortals = () => [], getViewport = () => ({}), onComplete = () => {}, onCancelled = () => {} } = {}) {
  let current = null;
  function shot(sourceId, elapsed) {
    const character = getCharacters().find(record => record.id === sourceId);
    if (character) return characterCameraShot(character, elapsed, getViewport());
    const portal = getPortals().find(record => record.id === sourceId);
    if (!portal) return null;
    const authored = portalCameraShot(portal, elapsed, getViewport());
    if (authored) return authored;
    if (!portal.camera?.position || !portal.camera?.target) return null;
    return { position: vector(portal.camera.position), target: vector(portal.camera.target), fov: portal.camera.fov ?? 56, roll: portal.camera.roll ?? 0, portalId: sourceId };
  }
  function cancel(reason = 'cancelled', requestId) {
    if (!current || (requestId && requestId !== current.requestId)) return false;
    const previous = current; current = null;
    if (!previous.complete) onCancelled({ requestId: previous.requestId, sourceId: previous.sourceId, reason });
    return true;
  }
  return {
    get active() { return current !== null; }, get complete() { return current?.complete ?? false; }, get sourceId() { return current?.sourceId ?? null; },
    start({ requestId, sourceId, now, from, reducedMotion = false }) {
      if (current?.requestId === requestId && current.sourceId === sourceId) return true;
      cancel();
      if (!shot(sourceId, 1)) { onCancelled({ requestId, sourceId, reason: 'unavailable' }); return false; }
      current = { requestId, sourceId, startedAt: now, duration: reducedMotion ? 0 : .85, complete: false,
        from: { position: vector(from.position), target: vector(from.target), fov: from.fov, roll: from.roll ?? 0 } };
      return true;
    },
    sample(now) {
      if (!current) return null;
      const elapsed = Math.max(0, (now - current.startedAt) / 1000);
      const target = shot(current.sourceId, current.duration === 0 ? 1 : elapsed);
      if (!target) { cancel('unavailable'); return null; }
      const t = current.duration === 0 ? 1 : smooth(elapsed / current.duration);
      const result = { ...target, position: t === 1 ? target.position.clone() : current.from.position.clone().lerp(target.position, t), target: t === 1 ? target.target.clone() : current.from.target.clone().lerp(target.target, t),
        fov: current.from.fov + (target.fov - current.from.fov) * t, roll: current.from.roll + (target.roll - current.from.roll) * t };
      if (t === 1 && !current.complete) { current.complete = true; onComplete({ requestId: current.requestId, sourceId: current.sourceId }); }
      return result;
    },
    cancel, dispose() { current = null; },
  };
}
