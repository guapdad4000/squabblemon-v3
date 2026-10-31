/** Integrated mode leaves all visible prompts/dialogs to the Squabblemon host. */
export function createHostInteractions({ getRecords, kind, onInspect, window: win = globalThis.window } = {}) {
  let nearby = null, enabled = false;
  const point = value => Array.isArray(value) ? value : value && [value.x, value.y, value.z];
  function inspect() { if (enabled && nearby) onInspect(nearby.id); }
  function keydown(event) {
    if (enabled && nearby && !event.repeat && event.code === 'KeyE' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault(); event.stopImmediatePropagation(); inspect();
    }
  }
  win.addEventListener('keydown', keydown, true);
  return {
    get active() { return false; }, get nearby() { return enabled ? nearby?.id ?? null : null; },
    get nearest() { return enabled && nearby ? { id: nearby.id, name: nearby.name ?? nearby.label ?? nearby.id, kind } : undefined; },
    get state() { return { view: 'street', nearby: nearby?.id ?? null, characterId: null }; },
    update(player, _dt, options = {}) {
      enabled = options.enabled ?? true; nearby = null;
      const position = point(player?.position ?? player);
      if (!enabled || !position) return;
      let closest = kind === 'portal' ? 4.2 : 4.7;
      for (const record of getRecords() ?? []) {
        const feet = point(record.interactionPosition ?? record.feet ?? record.position);
        if (record.enabled === false || !feet || Math.abs(feet[1] - position[1]) > 2.8) continue;
        const distance = Math.hypot(feet[0] - position[0], feet[2] - position[2]);
        if (distance < Math.min(closest, record.radius ?? closest)) { nearby = record; closest = distance; }
      }
    },
    open: inspect, sampleCamera() { return null; }, dispose() { win.removeEventListener('keydown', keydown, true); enabled = false; nearby = null; },
  };
}
