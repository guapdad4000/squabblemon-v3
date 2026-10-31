import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchControls } from '../src/touch-controls.js';

class FakeTarget {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, fields = {}) {
    const event = { type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields };
    for (const listener of [...this.listeners.get(type) ?? []]) listener(event);
    return event;
  }
}
class FakeElement extends FakeTarget {
  children = []; style = { touchAction: '' }; dataset = {}; attributes = {}; captures = new Set();
  className = ''; hidden = false; parentElement = null;
  rect = { left: 20, top: 600, width: 128, height: 128 };
  constructor(tag) {
    super(); this.tagName = tag.toUpperCase();
    this.classList = {
      add: (name) => this.classList.toggle(name, true),
      remove: (name) => this.classList.toggle(name, false),
      contains: (name) => this.className.split(' ').includes(name),
      toggle: (name, force) => {
        const set = new Set(this.className.split(' ').filter(Boolean));
        const add = force ?? !set.has(name);
        if (add) set.add(name); else set.delete(name);
        this.className = [...set].join(' '); return add;
      },
    };
  }
  append(...nodes) { for (const node of nodes) { this.children.push(node); node.parentElement = this; } }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((node) => node !== this); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) {
    if (this.captures.delete(id)) this.emit('lostpointercapture', { pointerId: id });
  }
}
function find(node, className) {
  if (node.classList?.contains(className)) return node;
  for (const child of node.children ?? []) { const result = find(child, className); if (result) return result; }
  return null;
}
function setup({ mobile = true } = {}) {
  const document = new FakeTarget(); document.hidden = false;
  document.createElement = (tag) => new FakeElement(tag);
  document.body = new FakeElement('body');
  const window = new FakeTarget(); window.innerWidth = mobile ? 390 : 1440;
  const media = new FakeTarget(); media.matches = mobile;
  window.matchMedia = () => media;
  const canvas = new FakeElement('canvas'); canvas.rect = { left: 0, top: 0, width: 390, height: 844 };
  document.body.append(canvas);
  const looks = [], zooms = [];
  const controls = createTouchControls({ canvas, parent: document.body, window, document, onLook: (x, y) => looks.push([x, y]), onZoom: (delta) => zooms.push(delta) });
  const stick = find(controls.element, 'touch-stick'), run = find(controls.element, 'touch-run');
  const point = (target, type, id, x = 84, y = 664, extra = {}) => target.emit(type, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y, ...extra });
  const startMove = (id = 7) => point(stick, 'pointerdown', id, 84, 610);
  controls.setEnabled(true);
  return { controls, canvas, document, window, media, stick, run, point, looks, zooms, startMove };
}

test('thumbstick preserves a circular dead zone, analog walk speed and normalized diagonals', () => {
  const { controls, point, stick } = setup();
  point(stick, 'pointerdown', 0, 87, 664);
  assert.deepEqual(controls.getMovement(), { x: 0, y: 0 });
  point(stick, 'pointermove', 0, 84 + 128 * .34 * .57, 664);
  assert.ok(Math.abs(controls.move.x - .5) < 1e-9, 'half deflection after dead zone should remain analog');
  point(stick, 'pointermove', 0, 250, 450);
  assert.ok(Math.abs(Math.hypot(controls.move.x, controls.move.y) - 1) < 1e-10, 'diagonal must not outrun forward');
  assert.ok(controls.move.x > 0 && controls.move.y > 0, 'upper right is right + forward');
  point(stick, 'pointerup', 0);
  assert.deepEqual(controls.getMovement(), { x: 0, y: 0 });
  assert.equal(stick.captures.size, 0);
  controls.dispose();
});

test('move, look and run retain separate pointer owners during simultaneous three-finger input', () => {
  const { controls, startMove, canvas, stick, run, point, looks } = setup();
  startMove(11);
  point(canvas, 'pointerdown', 21, 280, 300);
  point(run, 'pointerdown', 31);
  point(canvas, 'pointermove', 21, 312, 285);
  assert.deepEqual(looks, [[32, -15]]);
  assert.equal(controls.sprint, true);
  assert.ok(controls.move.y > .99);
  point(stick, 'pointerup', 21);
  point(canvas, 'pointermove', 11, 500, 500);
  assert.equal(controls.diagnostics().pointerIds.move, 11, 'other finger releases cannot stop movement');
  assert.equal(looks.length, 1, 'movement finger must never rotate the view');
  point(canvas, 'pointercancel', 21);
  assert.equal(controls.diagnostics().pointerIds.look, null);
  assert.ok(controls.move.y > .99);
  assert.equal(controls.sprint, true);
  point(run, 'pointerup', 31);
  assert.equal(controls.sprint, false);
  assert.ok(controls.move.y > .99);
  controls.dispose();
});

test('a second movement or look pointer cannot steal the first finger capture', () => {
  const { controls, point, stick, canvas, looks } = setup();
  point(stick, 'pointerdown', 4, 84, 610);
  point(stick, 'pointerdown', 5, 84, 720);
  point(stick, 'pointermove', 5, 84, 740);
  assert.equal(controls.diagnostics().pointerIds.move, 4);
  assert.ok(controls.move.y > .99);
  point(canvas, 'pointerdown', 8, 300, 250);
  point(canvas, 'pointerdown', 9, 300, 400);
  point(canvas, 'pointermove', 9, 310, 420);
  point(canvas, 'pointermove', 8, 305, 260);
  assert.deepEqual(looks, [[5, 10]]);
  controls.dispose();
});

test('right-side touch drags look in CSS pixels while desktop mouse and left canvas touches remain untouched', () => {
  const { controls, point, canvas, looks } = setup();
  const mouse = point(canvas, 'pointerdown', 1, 300, 200, { pointerType: 'mouse' });
  const leftTouch = point(canvas, 'pointerdown', 2, 20, 300);
  assert.equal(mouse.defaultPrevented, false);
  assert.equal(leftTouch.defaultPrevented, false);
  assert.equal(controls.diagnostics().pointerIds.look, null);
  const rightTouch = point(canvas, 'pointerdown', 3, 230, 200);
  assert.equal(rightTouch.defaultPrevented, true, 'owned touch suppresses compatibility mouse events');
  point(canvas, 'pointermove', 3, 250, 224);
  assert.deepEqual(looks, [[20, 24]]);
  canvas.emit('lostpointercapture', { pointerId: 3 });
  point(canvas, 'pointermove', 3, 280, 260);
  assert.equal(looks.length, 1);
  controls.dispose();
});

test('run remains held until every run pointer is released and exposes its pressed state', () => {
  const { controls, point, run } = setup();
  assert.equal(run.getAttribute('aria-label'), 'Hold to run');
  point(run, 'pointerdown', 41); point(run, 'pointerdown', 42);
  point(run, 'pointerup', 41);
  assert.equal(controls.sprint, true);
  assert.equal(run.getAttribute('aria-pressed'), 'true');
  point(run, 'pointercancel', 42);
  assert.equal(controls.sprint, false);
  assert.equal(run.getAttribute('aria-pressed'), 'false');
  run.emit('keydown', { code: 'Space' });
  assert.equal(controls.sprint, true);
  run.emit('keyup', { code: 'Space' });
  assert.equal(controls.sprint, false);
  controls.dispose();
});

test('pausing, travel or dialogs can hide controls and release all owners without stuck movement', () => {
  const { controls, startMove, point, run, canvas, stick } = setup();
  startMove(); point(canvas, 'pointerdown', 8, 250, 300); point(run, 'pointerdown', 9);
  assert.equal(canvas.style.touchAction, 'none');
  controls.setEnabled(false);
  assert.equal(controls.element.hidden, true);
  assert.equal(canvas.style.touchAction, '', 'hidden controls must not disable native modal scrolling');
  assert.deepEqual(controls.diagnostics().pointerIds, { move: null, look: null, sprint: [] });
  assert.deepEqual(controls.getMovement(), { x: 0, y: 0 });
  assert.equal(controls.sprint, false);
  assert.equal(stick.captures.size + canvas.captures.size + run.captures.size, 0);
  point(stick, 'pointerdown', 10, 84, 610);
  controls.setEnabled(true);
  assert.deepEqual(controls.getMovement(), { x: 0, y: 0 });
  assert.equal(controls.sprint, false);
  controls.dispose();
});

test('a release outside a control clears only that owner even when pointer capture is unavailable', () => {
  const { controls, startMove, point, stick, run, canvas, window } = setup();
  stick.setPointerCapture = undefined; run.setPointerCapture = undefined; canvas.setPointerCapture = undefined;
  startMove(71); point(run, 'pointerdown', 72); point(canvas, 'pointerdown', 73, 300, 300);
  window.emit('pointerup', { pointerId: 71 });
  assert.deepEqual(controls.getMovement(), { x: 0, y: 0 });
  assert.equal(controls.sprint, true);
  assert.equal(controls.diagnostics().pointerIds.look, 73);
  window.emit('pointercancel', { pointerId: 72 });
  assert.equal(controls.sprint, false);
  assert.equal(controls.diagnostics().pointerIds.look, 73);
  window.emit('pointerup', { pointerId: 73 });
  assert.equal(controls.diagnostics().pointerIds.look, null);
  controls.dispose();
});

test('blur, hidden document, orientation and resize cancel ongoing gestures before another frame', () => {
  const { controls, startMove, window, document, point, run } = setup();
  const triggers = [
    () => window.emit('blur'),
    () => { document.hidden = true; document.emit('visibilitychange'); document.hidden = false; },
    () => window.emit('orientationchange'),
    () => window.emit('resize'),
  ];
  for (const trigger of triggers) {
    startMove(); point(run, 'pointerdown', 8);
    assert.ok(controls.move.y > 0 && controls.sprint);
    trigger();
    assert.deepEqual(controls.getMovement(), { x: 0, y: 0 });
    assert.equal(controls.sprint, false);
    assert.equal(controls.diagnostics().pointerIds.move, null);
  }
  controls.dispose();
});

test('responsive availability supports wide coarse-pointer tablets and hybrid devices without intercepting mouse', () => {
  const { controls, media, canvas, point, startMove } = setup({ mobile: false });
  assert.equal(controls.enabled, false);
  assert.equal(controls.isTouchMode, false);
  media.matches = true; media.emit('change');
  assert.equal(controls.enabled, true, 'coarse query can activate at any viewport width');
  startMove();
  assert.ok(controls.move.y > 0);
  media.matches = false; media.emit('change');
  assert.equal(controls.enabled, false);
  assert.deepEqual(controls.getMovement(), { x: 0, y: 0 });
  const mouse = point(canvas, 'pointerdown', 25, 300, 100, { pointerType: 'mouse' });
  assert.equal(mouse.defaultPrevented, false);
  controls.dispose();
});

test('zoom buttons use native accessible click behavior and disposal restores scene touch behavior', () => {
  const { controls, canvas, zooms, window, point, stick } = setup();
  const zoomIn = find(controls.element, 'touch-zoom-in'), zoomOut = find(controls.element, 'touch-zoom-out');
  zoomIn.emit('click'); zoomOut.emit('click');
  assert.deepEqual(zooms, [-.65, .65]);
  controls.setEnabled(false); zoomIn.emit('click');
  assert.equal(zooms.length, 2);
  controls.setEnabled(true); controls.dispose();
  assert.equal(canvas.style.touchAction, '');
  assert.equal(controls.enabled, false);
  assert.equal(controls.element.parentElement.children.includes(controls.element), false);
  point(stick, 'pointerdown', 1, 84, 610);
  point(canvas, 'pointerdown', 2, 300, 300);
  window.emit('resize');
  assert.deepEqual(controls.getMovement(), { x: 0, y: 0 });
  assert.equal(controls.diagnostics().pointerIds.look, null);
});
