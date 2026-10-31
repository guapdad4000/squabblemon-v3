/** Same-origin presentation bridge. The account app alone owns routes and saves. */
export const CHANNEL = 'squabblemon-fadewood';
export const VERSION = 1;
const modes = new Set(['exploring', 'paused', 'overlay', 'suspended']);
export function validCheckpoint(value) {
  return Boolean(value && Array.isArray(value.position) && value.position.length === 3 && value.position.every(Number.isFinite) &&
    Math.abs(value.position[0]) <= 29 && value.position[1] >= -1 && value.position[1] <= 15 && value.position[2] >= -49 && value.position[2] <= 43 &&
    Number.isFinite(value.yaw) && Math.abs(value.yaw) <= 1000 &&
    (value.arrivalId === undefined || (typeof value.arrivalId === 'string' && value.arrivalId.length <= 80)));
}
export function createHostBridge({ window: win = globalThis.window, onCommand = () => {} } = {}) {
  const enabled = Boolean(win && win.parent !== win && new URL(win.location.href).searchParams.get('host') === '1');
  let instanceId = null, disposed = false;
  const origin = win?.location.origin;
  function post(type, payload = {}) {
    if (!enabled || !instanceId || disposed) return false;
    win.parent.postMessage({ ...payload, channel: CHANNEL, version: VERSION, instanceId, type }, origin);
    return true;
  }
  function receive(event) {
    if (!enabled || disposed || event.origin !== origin || event.source !== win.parent) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.version !== VERSION || typeof data.instanceId !== 'string' || data.instanceId.length < 1 || data.instanceId.length > 160) return;
    if (data.type === 'init') {
      if (instanceId && data.instanceId !== instanceId) return;
      if (typeof data.reducedMotion !== 'boolean' || (data.night !== undefined && typeof data.night !== 'boolean') || (data.checkpoint !== undefined && !validCheckpoint(data.checkpoint))) return;
      const first = !instanceId;
      instanceId = data.instanceId;
      onCommand({ type: 'init', first, reducedMotion: data.reducedMotion, night: data.night, checkpoint: data.checkpoint });
      return;
    }
    if (!instanceId || data.instanceId !== instanceId) return;
    if (data.type === 'lighting' && typeof data.night === 'boolean') onCommand({ type: 'lighting', night: data.night });
    else if (data.type === 'mode' && modes.has(data.mode)) onCommand({ type: 'mode', mode: data.mode });
    else if (data.type === 'travel' && typeof data.requestId === 'string' && data.requestId.length > 0 && data.requestId.length <= 160 && typeof data.destinationId === 'string' && data.destinationId.length < 96) onCommand({ type: 'travel', requestId: data.requestId, destinationId: data.destinationId });
    else if (data.type === 'cancelTravel' && (data.requestId === undefined || (typeof data.requestId === 'string' && data.requestId.length <= 160))) onCommand({ type: 'cancelTravel', requestId: data.requestId });
    else if (data.type === 'focus' && typeof data.requestId === 'string' && data.requestId.length > 0 && data.requestId.length <= 160 && typeof data.sourceId === 'string' && data.sourceId.length > 0 && data.sourceId.length <= 96) onCommand({ type: 'focus', requestId: data.requestId, sourceId: data.sourceId });
    else if (data.type === 'releaseFocus' && (data.requestId === undefined || (typeof data.requestId === 'string' && data.requestId.length <= 160))) onCommand({ type: 'releaseFocus', requestId: data.requestId });
    else if (data.type === 'restore' && validCheckpoint(data.checkpoint)) onCommand({ type: 'restore', checkpoint: data.checkpoint });
    else if (data.type === 'presentation' && Array.isArray(data.storyTargets) && data.storyTargets.length <= 24 && data.storyTargets.every(target => target && typeof target.arcId === 'string' && target.arcId.length <= 96 && typeof target.sourceId === 'string' && target.sourceId.length <= 96 && typeof target.label === 'string' && target.label.length <= 160) && (data.mail === undefined || (Number.isInteger(data.mail?.unread) && data.mail.unread >= 0 && data.mail.unread <= 9999 && Number.isInteger(data.mail?.gifts) && data.mail.gifts >= 0 && data.mail.gifts <= 9999 && (data.mail.attentionId === undefined || (typeof data.mail.attentionId === 'string' && data.mail.attentionId.length <= 240)) && (data.mail.opened === undefined || typeof data.mail.opened === 'boolean')))) onCommand({ type: 'presentation', storyTargets: data.storyTargets.map(({ arcId, sourceId, label }) => ({ arcId, sourceId, label })), mail: data.mail });
    else if (data.type === 'dispose') onCommand({ type: 'dispose' });
  }
  if (enabled) win.addEventListener('message', receive);
  return { enabled, post, get initialized() { return instanceId !== null; }, dispose() { disposed = true; win?.removeEventListener('message', receive); } };
}
