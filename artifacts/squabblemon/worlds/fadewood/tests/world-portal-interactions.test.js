import test from 'node:test';
import assert from 'node:assert/strict';
import { PORTAL_DESTINATIONS, STORY_SCREENS, createPortalNavigation, resolveStoryUrl } from '../src/story-destinations.js';
import { createWorldPortalInteractions, nearestWorldPortal, portalCameraShot } from '../src/world-portal-interactions.js';

test('world entrances use real Safehouse, Alice-season, Kumite and Story archive routes', () => {
  const routes = {
    'safehouse-door': ['/game', 'Home'],
    'alice-hat': ['/game/story?season=special-alice', 'Story / StoryTheater'],
    'underground-arena': ['/game/kumite?view=arena', 'Kumite'],
    'anunaki-ufo': ['/game/story', 'Story / StoryTheater'],
  };
  assert.deepEqual(Object.keys(PORTAL_DESTINATIONS).sort(), Object.keys(routes).sort());
  for (const [id, [route, component]] of Object.entries(routes)) {
    const intent = createPortalNavigation(id);
    assert.equal(intent.type, 'squabblemon:story-navigate');
    assert.equal(intent.portalId, id);
    assert.equal(intent.route, route);
    assert.equal(intent.component, component);
    assert.equal(resolveStoryUrl('https://game.example/squabblemon', route), `https://game.example/squabblemon${route}`);
  }
  assert.equal(createPortalNavigation('anunaki-ufo').connection, 'chapter-pending', 'the UFO does not invent a playable Anunaki season');
  assert.equal(createPortalNavigation('alice-hat', 'safehouse'), null);
  assert.equal(createPortalNavigation('alice-hat', '//evil.example'), null);
  assert.equal(createPortalNavigation('__proto__'), null);
  assert.equal(resolveStoryUrl('https://game.example', '/game/story?season=special-anunaki'), null);
});

test('proximity follows a moving hat and distinguishes elevated UFO art from its ground trigger', () => {
  const hat = { id: 'alice-hat', position: [0, 1.2, 0], radius: 3 };
  const ufo = { id: 'anunaki-ufo', position: [20.4, 10.4, -42.5], interactionPosition: [25.7, .271, -38.1], radius: 2.5 };
  const home = { id: 'safehouse-door', position: [19.35, .381, -36.95], radius: 2 };
  assert.equal(nearestWorldPortal([0, 0, 1], [hat]).id, 'alice-hat');
  hat.position = [12, 1.2, 6];
  assert.equal(nearestWorldPortal([0, 0, 1], [hat]), null);
  assert.equal(nearestWorldPortal([12, 0, 5], [hat]).id, 'alice-hat');
  assert.equal(nearestWorldPortal([25.7, .271, -38.1], [ufo, home]).id, 'anunaki-ufo');
  assert.equal(nearestWorldPortal([19.35, .381, -36.95], [ufo, home]).id, 'safehouse-door');
  assert.equal(nearestWorldPortal([0, 0, 0], [{ id: 'alice-hat', position: [0, 7, 0] }]), null);
  assert.equal(nearestWorldPortal([0, 0, 0], [{ id: 'fake', position: [0, 0, 0] }]), null);
  assert.equal(nearestWorldPortal([0, 0, 0], [{ id: 'alice-hat', position: [0, 0, 0], enabled: false }]), null);
  assert.equal(nearestWorldPortal([NaN, 0, 0], [hat]), null);
});

test('authored portal views frame the real prop while mobile lenses widen safely', () => {
  const ufo = { id: 'anunaki-ufo', position: [20.4, 10.4, -42.5], interactionPosition: [25.7, .271, -38.1], aimPoint: [20.4, 10.2, -42.5], camera: { position: [26.8, 2.1, -33.8], target: [20.4, 7.9, -42.5], fov: 56, roll: -.018 } };
  const shot = portalCameraShot(ufo, 2);
  assert.deepEqual(shot.position.toArray(), ufo.camera.position);
  assert.deepEqual(shot.target.toArray(), ufo.camera.target);
  assert.equal(shot.fov, 56);
  const hat = { id: 'alice-hat', position: [2, 1, -5], aimPoint: [2, 1.4, -5] };
  const mobile = portalCameraShot(hat, 2, { width: 390, height: 844 });
  assert.equal(mobile.fov, 53);
  hat.position = [2, 1, 4]; hat.aimPoint = [2, 1.4, 4];
  assert.equal(portalCameraShot(hat, 2).target.z, 4);
  assert.equal(portalCameraShot({ id: 'missing', position: [0, 0, 0] }), null);
});

// A small DOM surface exercises modal state and real event handling without a
// browser dependency or a second implementation of the interaction logic.
function fixture() {
  const listeners = new Map();
  const win = { innerWidth: 390, innerHeight: 844,
    CustomEvent: class { constructor(type, options) { Object.assign(this, options); this.type = type; this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } },
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); },
  };
  const doc = { defaultView: win, activeElement: null, createElement(tag) { return new Element(tag); } };
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.dataset = {}; this.style = { setProperty() {} }; this.hidden = false; this.handlers = new Map(); this.isConnected = true; this.attributes = {}; }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
    replaceChildren(...items) { this.children = []; this.append(...items); }
    addEventListener(type, fn) { this.handlers.set(type, fn); }
    dispatchEvent(event) { this.handlers.get(event.type)?.(event); return !event.defaultPrevented; }
    contains(element) { return this === element || this.children.some(child => child.contains(element)); }
    closest() { return this.hidden ? this : this.parent?.closest() ?? null; }
    querySelectorAll() { return this.children.flatMap(child => [...(child.tagName === 'BUTTON' || (child.tagName === 'A' && child.href) ? [child] : []), ...child.querySelectorAll()]); }
    focus() { doc.activeElement = this; }
    remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  const parent = doc.createElement('main'), previous = doc.createElement('canvas'); parent.append(previous); previous.focus();
  function key(code, extra = {}) {
    const event = { type: 'keydown', code, key: code === 'KeyE' ? 'e' : code, target: previous, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
    listeners.get('keydown')?.(event); return event;
  }
  return { parent, doc, key, previous };
}

test('E and touch share one live portal modal, host event, focus trap and Escape cleanup', () => {
  const { parent, doc, key, previous } = fixture();
  const hat = { id: 'alice-hat', position: [0, 1, 0], label: 'The Hatter' };
  let live = [hat], opens = 0, closes = 0, navigation = null;
  parent.addEventListener('squabblemon:story-navigate', event => { navigation = event.detail; event.preventDefault(); });
  const ui = createWorldPortalInteractions({ parent, getPortals: () => live, onOpen: () => opens++, onClose: () => closes++ });
  ui.update([0, 0, 0], .016, { enabled: false }); key('KeyE'); assert.equal(ui.active, false);
  ui.update([0, 0, 0]); key('KeyE', { target: { tagName: 'INPUT' } }); assert.equal(ui.active, false);
  key('KeyE'); assert.equal(ui.active, true); assert.equal(opens, 1);
  assert.equal(navigation.route, '/game/story?season=special-alice');
  assert.equal(ui.navigate('safehouse'), false);
  const overlay = parent.children.find(child => child.id === 'world-portal-conversation');
  assert.equal(overlay.dataset.handled, 'true');
  const card = overlay.children[0], focusable = card.querySelectorAll();
  assert.equal(doc.activeElement, focusable[0]);
  key('Tab', { key: 'Tab', shiftKey: true }); assert.equal(doc.activeElement, focusable.at(-1));
  key('Tab', { key: 'Tab' }); assert.equal(doc.activeElement, focusable[0]);
  live = [{ ...hat, position: [2, 1, -6], aimPoint: [2, 1.4, -6] }];
  assert.equal(ui.sampleCamera().target.z, -6, 'camera tracks live prop records');
  assert.equal(key('Escape').stopped, true); assert.equal(ui.active, false); assert.equal(closes, 1); assert.equal(doc.activeElement, previous);
  ui.update([2, 0, -6]);
  const prompt = parent.children.find(child => child.className === 'character-prompt world-portal-prompt');
  prompt.dispatchEvent({ type: 'click' }); assert.equal(ui.active, true); assert.equal(opens, 2);
  ui.dispose(); assert.equal(closes, 2); assert.equal(parent.children.length, 1);
});

test('standalone audition renders account boundary and never trusts a prop-supplied URL', () => {
  const { parent } = fixture();
  const ui = createWorldPortalInteractions({ parent, portals: [{ id: 'safehouse-door', position: [0, 0, 0], route: 'https://evil.example' }] });
  ui.open('safehouse-door');
  const overlay = parent.children.find(child => child.id === 'world-portal-conversation');
  const destination = overlay.children[0].children.find(child => child.className === 'character-destination');
  assert.ok(destination.children.some(child => child.className === 'character-preview-note'));
  assert.ok(!destination.children.some(child => child.tagName === 'A'));
  assert.equal(ui.state.screenId, 'safehouse');
  assert.equal(STORY_SCREENS.safehouse.route, '/game');
  ui.dispose();
});
