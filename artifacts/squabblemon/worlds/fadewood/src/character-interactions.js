import { Vector3 } from 'three';
import { CHARACTER_INTERACTIONS, STORY_SCREENS, createStoryNavigation, resolveStoryUrl } from './story-destinations.js';
import { portraitCharacterLayout } from './view-layout.js';

export function nearestCharacter(player, characters, radius = 4.7) {
  const point = player?.position ?? player;
  if (!point) return null;
  const x = point.x ?? point[0], y = point.y ?? point[1], z = point.z ?? point[2];
  if (![x, y, z].every(Number.isFinite)) return null;
  let nearest = null, distance = radius;
  for (const character of characters) {
    if (!CHARACTER_INTERACTIONS[character.id]) continue;
    const feet = character.feet ?? character.position;
    if (!feet || Math.abs(feet[1] - y) > 2.4) continue;
    const next = Math.hypot(feet[0] - x, feet[2] - z);
    if (next < distance) { nearest = character; distance = next; }
  }
  return nearest;
}

export function characterCameraShot(character, elapsed = 1, viewport = {}) {
  const config = CHARACTER_INTERACTIONS[character?.id]?.shot;
  if (!config) return null;
  const feet = character.feet ?? character.position;
  const settle = Math.max(0, 1 - Math.min(1, elapsed / .8));
  const arc = settle * settle * .085;
  const portrait = portraitCharacterLayout(viewport);
  const angle = (character.yaw ?? 0) + config.angle + arc;
  const forward = new Vector3(Math.sin(angle), 0, Math.cos(angle));
  const right = new Vector3(Math.cos(angle), 0, -Math.sin(angle));
  const reclining = Boolean(character.pose);
  const position = new Vector3(...feet).addScaledVector(forward, config.distance + (portrait && reclining ? .5 : 0) + settle * .22);
  position.y += config.eye;
  const target = new Vector3(...feet).addScaledVector(right, portrait ? 0 : .66);
  target.y += config.aim;
  return { position, target, fov: portrait ? (reclining ? 58 : 50) : 43, roll: config.roll, characterId: character.id };
}

/**
 * The caller owns locomotion and pointer lock. onOpen/onClose arbitrate those
 * with the pause/travel UI. Camera samples reuse the real, animated world NPC.
 * onNavigate may return true when a host mounted the requested existing screen.
 */
export function createCharacterInteractions({ parent = document.body, characters = [], onOpen = () => {}, onClose = () => {}, onNavigate = () => false, appBaseUrl = null } = {}) {
  const doc = parent.ownerDocument ?? document;
  const win = doc.defaultView ?? window;
  const button = doc.createElement('button');
  button.type = 'button'; button.className = 'character-prompt'; button.hidden = true;
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', 'character-conversation');
  const overlay = doc.createElement('section');
  overlay.id = 'character-conversation'; overlay.className = 'character-conversation'; overlay.hidden = true;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'character-name');
  const card = doc.createElement('article'); card.className = 'character-card'; overlay.append(card);
  const closeButton = doc.createElement('button'); closeButton.type = 'button'; closeButton.className = 'character-close';
  closeButton.setAttribute('aria-label', 'Back to the street'); closeButton.textContent = '×';
  const kicker = doc.createElement('div'); kicker.className = 'character-kicker';
  const name = doc.createElement('h2'); name.id = 'character-name';
  const role = doc.createElement('p'); role.className = 'character-role';
  const line = doc.createElement('p'); line.className = 'character-line';
  const choices = doc.createElement('div'); choices.className = 'character-choices';
  const destination = doc.createElement('div'); destination.className = 'character-destination'; destination.hidden = true;
  const footer = doc.createElement('div'); footer.className = 'character-footer';
  footer.textContent = 'FADEWOOD · STORY MODE V3';
  card.append(closeButton, kicker, name, role, line, choices, destination, footer);
  parent.append(button, overlay);
  let nearby = null, current = null, enabled = false, elapsed = 0, previousFocus = null, page = 'street', selectedScreen = null;

  function detail() { return current ? { character: current, characterId: current.id, view: page, screenId: selectedScreen } : null; }
  function renderConversation() {
    const info = CHARACTER_INTERACTIONS[current.id];
    page = 'character'; selectedScreen = null;
    overlay.dataset.view = page; overlay.dataset.character = current.id; delete overlay.dataset.screen;
    overlay.style.setProperty('--character-accent', info.color);
    kicker.textContent = current.locationId?.replaceAll('-', ' ').toUpperCase() ?? 'THE BLOCK';
    name.textContent = current.name ?? current.id; role.textContent = info.title;
    line.textContent = `“${info.line}”`; line.hidden = false;
    choices.replaceChildren(); choices.hidden = false; destination.hidden = true;
    for (const [index, id] of info.screens.entries()) {
      const screen = STORY_SCREENS[id];
      const choice = doc.createElement('button'); choice.type = 'button'; choice.className = 'character-choice';
      const number = doc.createElement('span'); number.className = 'character-choice-number'; number.textContent = `0${index + 1}`;
      const label = doc.createElement('span'); label.textContent = screen.title;
      const arrow = doc.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗';
      choice.append(number, label, arrow); choice.dataset.screen = id;
      choice.addEventListener('click', () => navigate(id)); choices.append(choice);
    }
    const back = doc.createElement('button'); back.type = 'button'; back.className = 'character-back'; back.textContent = 'Back to the street';
    back.addEventListener('click', close); choices.append(back);
  }
  function navigate(screenId) {
    const navigation = createStoryNavigation(current?.id, screenId);
    if (!navigation) return false;
    const screen = STORY_SCREENS[screenId];
    page = 'destination'; selectedScreen = screenId;
    overlay.dataset.view = page; overlay.dataset.screen = screenId;
    line.hidden = true; choices.hidden = true; destination.hidden = false; destination.replaceChildren();
    const eyebrow = doc.createElement('span'); eyebrow.className = 'character-destination-kicker'; eyebrow.textContent = 'YOUR NEXT STOP';
    const heading = doc.createElement('h3'); heading.textContent = screen.title;
    const copy = doc.createElement('p'); copy.textContent = screen.description;
    const features = doc.createElement('ul'); features.className = 'character-features';
    for (const feature of screen.features) { const item = doc.createElement('li'); item.textContent = feature; features.append(item); }
    destination.append(eyebrow, heading, copy, features);
    // The event is cancelable so an embedded host may mount a component and
    // prevent the local audition notice. No wildcard cross-origin messaging.
    const event = new win.CustomEvent('squabblemon:story-navigate', { detail: navigation, bubbles: true, cancelable: true });
    const unhandled = parent.dispatchEvent(event);
    const accepted = onNavigate(navigation) === true || !unhandled;
    const href = resolveStoryUrl(appBaseUrl, screen.route);
    if (href) {
      const launch = doc.createElement('a'); launch.className = 'character-launch'; launch.href = href; launch.target = '_blank'; launch.rel = 'noopener';
      launch.textContent = `Open ${screen.title} ↗`; destination.append(launch);
    } else if (!accepted) {
      const notice = doc.createElement('p'); notice.className = 'character-preview-note';
      notice.textContent = 'Street audition preview. Enter through Squabblemon to use your account and saved progress.'; destination.append(notice);
    }
    const back = doc.createElement('button'); back.type = 'button'; back.className = 'character-back'; back.textContent = `← Back to ${current.name ?? current.id}`;
    back.addEventListener('click', () => { renderConversation(); choices.querySelector('button')?.focus(); }); destination.append(back);
    (destination.querySelector('a') ?? back).focus({ preventScroll: true });
    return true;
  }
  function open(id = nearby?.id) {
    const next = characters.find((character) => character.id === id);
    if (!next || !CHARACTER_INTERACTIONS[id] || current) return false;
    current = next; elapsed = 0; previousFocus = doc.activeElement;
    button.hidden = true; renderConversation(); overlay.hidden = false;
    onOpen(detail()); closeButton.focus({ preventScroll: true });
    return true;
  }
  function close() {
    if (!current) return false;
    const previous = detail(); current = null; page = 'street'; selectedScreen = null; overlay.hidden = true;
    delete overlay.dataset.character; delete overlay.dataset.screen; overlay.dataset.view = page;
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
      // Do not let held movement/travel hotkeys escape into the walking state.
      if (/^(Key[WASDEF]|Arrow|Space|Shift)/.test(event.code ?? '')) event.stopImmediatePropagation();
    } else if (enabled && nearby && !event.repeat && (event.code === 'KeyE' || event.key?.toLowerCase() === 'e')) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable) return;
      event.preventDefault(); event.stopImmediatePropagation(); open();
    }
  }
  button.addEventListener('click', () => open()); closeButton.addEventListener('click', close);
  win.addEventListener('keydown', keydown, true);
  return {
    get active() { return current !== null; },
    get nearby() { return nearby?.id ?? null; },
    get state() { return { view: page, characterId: current?.id ?? null, nearby: nearby?.id ?? null, screenId: selectedScreen }; },
    update(player, dt = 0, options = {}) {
      enabled = options.enabled ?? true;
      if (current) elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0);
      nearby = nearestCharacter(player, characters);
      button.hidden = !enabled || current !== null || nearby === null;
      if (!button.hidden && button.dataset.character !== nearby.id) {
        button.replaceChildren();
        const key = doc.createElement('kbd'); key.textContent = 'E';
        const copy = doc.createElement('span'); copy.textContent = `Talk to ${nearby.name ?? nearby.id}`;
        const arrow = doc.createElement('span'); arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true');
        button.append(key, copy, arrow); button.dataset.character = nearby.id;
      }
      return this.state;
    },
    sampleCamera(dt = 0) {
      if (!current) return null;
      elapsed += Math.max(0, Number.isFinite(dt) ? dt : 0);
      return characterCameraShot(current, elapsed, { width: win.innerWidth, height: win.innerHeight });
    },
    open, close, navigate,
    dispose() { close(); win.removeEventListener('keydown', keydown, true); button.remove(); overlay.remove(); },
  };
}
