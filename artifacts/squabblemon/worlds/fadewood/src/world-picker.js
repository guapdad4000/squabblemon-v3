import { Raycaster, Vector2 } from 'three';
import { sourceAtVisibleHit, sourceCanBePicked } from './world-sources.js';
const visible = object => { for (let node = object; node; node = node.parent) if (!node.visible) return false; return true; };
/** One visible-scene raycast per short tap. Look drags and control taps never pick. */
export function createWorldPicker({ canvas, camera, scene, getRecords, getPlayer, enabled, onInspect } = {}) {
  const raycaster = new Raycaster(), point = new Vector2();
  let press = null;
  const down = event => { if (!enabled() || event.button > 0) return; press = { id: event.pointerId, x: event.clientX, y: event.clientY, max: 0, at: event.timeStamp }; };
  const move = event => { if (press?.id === event.pointerId) press.max = Math.max(press.max, Math.hypot(event.clientX - press.x, event.clientY - press.y)); };
  const cancel = () => { press = null; };
  const up = event => {
    const start = press; press = null;
    if (!start || start.id !== event.pointerId || start.max > 8 || event.timeStamp - start.at > 550 || !enabled()) return;
    const bounds = canvas.getBoundingClientRect();
    point.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    raycaster.setFromCamera(point, camera); raycaster.far = 14;
    const hit = raycaster.intersectObjects(scene.children, true).find(hit => visible(hit.object) && (hit.object.material?.opacity ?? 1) > .3);
    if (!hit) return;
    const id = sourceAtVisibleHit(hit);
    if (id && sourceCanBePicked(id, getRecords(), getPlayer())) onInspect(id);
  };
  for (const [name, handler] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', cancel]]) canvas.addEventListener(name, handler);
  return { dispose() { cancel(); for (const [name, handler] of [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', cancel]]) canvas.removeEventListener(name, handler); } };
}
