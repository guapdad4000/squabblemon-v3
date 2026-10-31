import { Vector3 } from 'three';
import { PORTAL_DESTINATIONS, STORY_SCREENS, createPortalNavigation, resolveStoryUrl } from './story-destinations.js';

const coordinates = (point) => {
  const value = point?.position ?? point;
  if (!value) return null;
  const xyz = [value.x ?? value[0], value.y ?? value[1], value.z ?? value[2]];
  return xyz.every(Number.isFinite) ? xyz : null;
};
const knownPortal = (id) => Object.hasOwn(PORTAL_DESTINATIONS, id ?? '');

/** Re-evaluate live positions each frame: the Hatter is a moving destination. */
export function nearestWorldPortal(player, portals = [], radius = 4.2) {
  const point = coordinates(player);
  if (!point || !Number.isFinite(radius) || radius <= 0) return null;
  let nearest = null, distance = Infinity;
  for (const portal of portals) {
    if (!knownPortal(portal.id) || portal.enabled === false) continue;
    const position = coordinates(portal.interactionPosition ?? portal.position);
    const reach = Number.isFinite(portal.radius) && portal.radius > 0 ? portal.radius : radius;
    if (!position || Math.abs(position[1] - point[1]) > 2.8) continue;
    const next = Math.hypot(position[0] - point[0], position[2] - point[2]);
    if (next < reach && next < distance) { nearest = portal; distance = next; }
  }
  return nearest;
}

/** A prop may author its framing, but only the destination registry authors routes. */
export function portalCameraShot(portal, elapsed = 1, viewport = {}) {
  if (!knownPortal(portal?.id)) return null;
  const anchor = coordinates(portal.interactionPosition ?? portal.position);
  const aim = coordinates(portal.aimPoint) ?? (anchor && [anchor[0], anchor[1] + 1.2, anchor[2]]);
  if (!anchor || !aim) return null;
  const authored = portal.camera ?? portal.arrival?.camera ?? portal.arrival;
  const authoredPosition = coordinates(authored?.position);
  const authoredTarget = coordinates(authored?.target) ?? aim;
  const portrait = (viewport.width ?? 1200) < 760 && (viewport.height ?? 800) > (viewport.width ?? 1200);
  const settle = Math.max(0, 1 - Math.min(1, Math.max(0, elapsed) / .85));
  const angle = (portal.yaw ?? 0) + settle * settle * .075;
  const position = authoredPosition ? new Vector3(...authoredPosition) : new Vector3(anchor[0] + Math.sin(angle) * 5.2, anchor[1] + 1.55, anchor[2] + Math.cos(angle) * 5.2);
  const target = new Vector3(...authoredTarget);
  return { position, target, fov: portrait ? Math.max(53, authored?.fov ?? 47) : (authored?.fov ?? 47), roll: authored?.roll ?? -.012, portalId: portal.id };
}

/**
 * Parent owns movement/pause and arbitration with character prompts. A host may
 * accept the cancelable same-page navigation event; without one this remains a
 * street audition and can only offer an explicitly configured account-app link.
 */
export function createWorldPortalInteractions({ parent = document.body, portals = [], getPortals = () => portals, onOpen = () => {}, onClose = () => {}, onNavigate = () => false, appBaseUrl = null } = {}) {
  const doc = parent.ownerDocument ?? document, win = doc.defaultView ?? window;
  const button = doc.createElement('button');
  button.type = 'button'; button.className = 'character-prompt world-portal-prompt'; button.hidden = true;
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', 'world-portal-conversation');
  const overlay = doc.createElement('section');
  overlay.id = 'world-portal-conversation'; overlay.className = 'character-conversation world-portal-conversation'; overlay.hidden = true;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'world-portal-name');
  const card = doc.createElement('article'); card.className = 'character-card';
  const closeButton = doc.createElement('button'); closeButton.type = 'button'; closeButton.className = 'character-close'; closeButton.textContent = '×'; closeButton.setAttribute('aria-label', 'Back to the street');
  const kicker = doc.createElement('div'); kicker.className = 'character-kicker';
  const name = doc.createElement('h2'); name.id = 'world-portal-name';
  const role = doc.createElement('p'); role.className = 'character-role';
  const destination = doc.createElement('div'); destination.className = 'character-destination';
  const footer = doc.createElement('div'); footer.className = 'character-footer'; footer.textContent = 'FADEWOOD · STORY MODE V3';
  card.append(closeButton, kicker, name, role, destination, footer); overlay.append(card); parent.append(button, overlay);
  let nearby = null, current = null, enabled = false, elapsed = 0, previousFocus = null, selectedScreen = null;
  const records = () => getPortals() ?? [];
  const liveCurrent = () => records().find(({ id }) => id === current?.id) ?? current;
  const detail = () => current ? { portal: liveCurrent(), portalId: current.id, screenId: selectedScreen, view: 'destination' } : null;

  function navigate(screenId = PORTAL_DESTINATIONS[current?.id]?.screenId) {
    const navigation = createPortalNavigation(current?.id, screenId);
    if (!navigation) return false;
    selectedScreen = screenId;
    const info = PORTAL_DESTINATIONS[current.id], screen = STORY_SCREENS[screenId];
    overlay.dataset.portal = current.id; overlay.dataset.screen = screenId; overlay.dataset.view = 'destination';
    overlay.style.setProperty('--character-accent', info.color);
    kicker.textContent = 'BEYOND THE BLOCK'; name.textContent = info.title;
    role.textContent = current.label ?? screen.title;
    destination.replaceChildren();
    const eyebrow = doc.createElement('span'); eyebrow.className = 'character-destination-kicker'; eyebrow.textContent = 'YOUR NEXT STOP';
    const heading = doc.createElement('h3'); heading.textContent = screen.title;
    const copy = doc.createElement('p'); copy.textContent = screen.description;
    const features = doc.createElement('ul'); features.className = 'character-features';
    for (const feature of screen.features) { const item = doc.createElement('li'); item.textContent = feature; features.append(item); }
    destination.append(eyebrow, heading, copy, features);
    const event = new win.CustomEvent('squabblemon:story-navigate', { detail: navigation, bubbles: true, cancelable: true });
    const unhandled = parent.dispatchEvent(event);
    const accepted = onNavigate(navigation) === true || !unhandled;
    overlay.dataset.handled = String(accepted);
    const href = resolveStoryUrl(appBaseUrl, screen.route);
    if (href) {
      const launch = doc.createElement('a'); launch.className = 'character-launch'; launch.href = href; launch.target = '_blank'; launch.rel = 'noopener'; launch.textContent = `Open ${screen.title} ↗`; destination.append(launch);
    } else if (!accepted) {
      const note = doc.createElement('p'); note.className = 'character-preview-note'; note.textContent = 'Street audition preview. Enter through Squabblemon to use your account and saved progress.'; destination.append(note);
    }
    const back = doc.createElement('button'); back.type = 'button'; back.className = 'character-back'; back.textContent = '← Back to the street'; back.addEventListener('click', close); destination.append(back);
    return true;
  }
  function open(id = nearby?.id) {
    const next = records().find((portal) => portal.id === id && portal.enabled !== false);
    if (current || !next || !knownPortal(id)) return false;
    current = next; elapsed = 0; previousFocus = doc.activeElement; button.hidden = true; overlay.hidden = false;
    selectedScreen = PORTAL_DESTINATIONS[id].screenId;
    onOpen(detail()); navigate(); closeButton.focus({ preventScroll: true });
    return true;
  }
  function close() {
    if (!current) return false;
    const previous = detail(); current = null; selectedScreen = null; overlay.hidden = true;
    delete overlay.dataset.portal; delete overlay.dataset.screen; delete overlay.dataset.handled; overlay.dataset.view = 'street';
    onClose(previous);
    if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
    return true;
  }
  function keydown(event) {
    if (current) {
      if (event.code === 'Escape' || event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
      if (event.key === 'Tab') {
        const focusable = [...card.querySelectorAll('button, a[href]')].filter((element) => !element.disabled && !element.closest('[hidden]'));
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && (doc.activeElement === first || !card.contains(doc.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (doc.activeElement === last || !card.contains(doc.activeElement))) { event.preventDefault(); first?.focus(); }
      }
      if (/^(Key[WASDEF]|Arrow|Space|Shift)/.test(event.code ?? '')) event.stopImmediatePropagation();
    } else if (enabled && nearby && !event.repeat && (event.code === 'KeyE' || event.key?.toLowerCase() === 'e')) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable) return;
      event.preventDefault(); event.stopImmediatePropagation(); open();
    }
  }
  button.addEventListener('click', () => { if (enabled) open(); }); closeButton.addEventListener('click', close); win.addEventListener('keydown', keydown, true);
  return {
    get active() { return current !== null; },
    get nearby() { return nearby?.id ?? null; },
    get state() { return { view: current ? 'destination' : 'street', portalId: current?.id ?? null, nearby: nearby?.id ?? null, screenId: selectedScreen }; },
    update(player, dt = 0, options = {}) {
      enabled = options.enabled ?? true;
      if (current) elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0);
      nearby = nearestWorldPortal(player, records(), options.radius ?? 4.2);
      button.hidden = !enabled || current !== null || nearby === null;
      if (!button.hidden && button.dataset.portal !== nearby.id) {
        const key = doc.createElement('kbd'); key.textContent = 'E';
        const copy = doc.createElement('span'); copy.textContent = PORTAL_DESTINATIONS[nearby.id].prompt;
        const arrow = doc.createElement('span'); arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true');
        button.replaceChildren(key, copy, arrow); button.dataset.portal = nearby.id;
      }
      return this.state;
    },
    sampleCamera(dt = 0) {
      if (!current) return null;
      elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0);
      return portalCameraShot(liveCurrent(), elapsed, { width: win.innerWidth, height: win.innerHeight });
    },
    open, close, navigate,
    dispose() { close(); win.removeEventListener('keydown', keydown, true); button.remove(); overlay.remove(); },
  };
}
