/**
 * Three independent touch owners: a left thumbstick, a canvas look drag and
 * hold-to-run. Desktop input stays with the host; no synthetic mouse input is
 * generated here. Axes are camera-relative: x = right, y = forward.
 */
export function createTouchControls({
  canvas,
  parent = globalThis.document?.body,
  onLook = () => {},
  onZoom = () => {},
  window: hostWindow = globalThis.window,
  document: hostDocument = globalThis.document,
  deadZone = .14,
} = {}) {
  if (!canvas || !parent || !hostDocument || !hostWindow) {
    throw new Error('Touch controls need a canvas, parent, document and window.');
  }

  const media = hostWindow.matchMedia?.('(max-width: 900px), (any-pointer: coarse)');
  const move = { x: 0, y: 0 };
  const listeners = [];
  const sprintPointers = new Set();
  let requested = false, available = false, active = false, disposed = false;
  let movePointer = null, lookPointer = null, lastLook = null, keyboardSprint = false;
  let lookDistance = 0;
  const previousTouchAction = canvas.style.touchAction;

  function element(tag, className, text, attributes = {}) {
    const node = hostDocument.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }

  const controls = element('div', 'touch-controls', '', { 'aria-label': 'Touch movement controls', role: 'group' });
  controls.hidden = true;
  const stick = element('button', 'touch-stick', '', {
    type: 'button', 'aria-label': 'Move: drag thumbstick. Keyboard: W A S D.', tabindex: '-1',
  });
  const stickCross = element('span', 'touch-stick-cross', '', { 'aria-hidden': 'true' });
  const knob = element('span', 'touch-stick-knob', '', { 'aria-hidden': 'true' });
  const moveLabel = element('span', 'touch-stick-label', 'MOVE', { 'aria-hidden': 'true' });
  stick.append(stickCross, knob, moveLabel);
  const lookHint = element('span', 'touch-look-hint', 'DRAG TO LOOK', { 'aria-hidden': 'true' });
  const run = element('button', 'touch-run', '', { type: 'button', 'aria-label': 'Hold to run', 'aria-pressed': 'false' });
  run.append(element('span', 'touch-run-mark', '»', { 'aria-hidden': 'true' }), element('span', 'touch-run-label', 'RUN'));
  const zoom = element('div', 'touch-zoom', '', { role: 'group', 'aria-label': 'Camera zoom' });
  const zoomIn = element('button', 'touch-zoom-in', '+', { type: 'button', 'aria-label': 'Zoom camera in' });
  const zoomOut = element('button', 'touch-zoom-out', '−', { type: 'button', 'aria-label': 'Zoom camera out' });
  zoom.append(zoomIn, zoomOut);
  controls.append(stick, lookHint, run, zoom);
  parent.append(controls);

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function capture(target, id) {
    try { target.setPointerCapture?.(id); } catch { /* A canceled touch may already be gone. */ }
  }

  function release(target, id) {
    if (id === null) return;
    try {
      if (!target.hasPointerCapture || target.hasPointerCapture(id)) target.releasePointerCapture?.(id);
    } catch { /* Lost capture and pointercancel can arrive in either order. */ }
  }

  function clearMovement() {
    move.x = 0; move.y = 0;
    knob.style.transform = 'translate(-50%, -50%)';
    stick.classList.remove('is-held');
  }

  function showSprint() {
    const held = active && (sprintPointers.size > 0 || keyboardSprint);
    run.classList.toggle('is-held', held);
    run.setAttribute('aria-pressed', String(held));
  }

  function reset() {
    const oldMove = movePointer, oldLook = lookPointer, oldRun = [...sprintPointers];
    movePointer = null; lookPointer = null; lastLook = null;
    sprintPointers.clear(); keyboardSprint = false;
    clearMovement(); showSprint(); lookHint.classList.remove('is-held');
    release(stick, oldMove); release(canvas, oldLook);
    for (const id of oldRun) release(run, id);
  }

  function updateVisibility() {
    if (disposed) return;
    available = media ? media.matches : hostWindow.innerWidth <= 900 || (hostWindow.navigator?.maxTouchPoints ?? 0) > 0;
    const next = requested && available;
    if (active && !next) reset();
    active = next;
    controls.hidden = !active;
    controls.dataset.enabled = String(active);
    canvas.style.touchAction = active ? 'none' : previousTouchAction;
    showSprint();
  }

  function updateStick(event) {
    const rect = stick.getBoundingClientRect();
    const radius = Math.max(22, Math.min(rect.width, rect.height) * .34);
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy);
    const fraction = Math.min(1, length / radius);
    const zone = Math.max(0, Math.min(.9, deadZone));
    const strength = Math.max(0, (fraction - zone) / (1 - zone));
    move.x = strength > 0 ? dx / length * strength : 0;
    move.y = strength > 0 ? -dy / length * strength : 0;
    const visualScale = length > radius ? radius / length : 1;
    knob.style.transform = `translate(calc(-50% + ${dx * visualScale}px), calc(-50% + ${dy * visualScale}px))`;
  }

  function isTouch(event) { return event.pointerType === 'touch'; }
  function consume(event) { event.preventDefault(); }

  listen(stick, 'pointerdown', (event) => {
    if (!active || !isTouch(event) || movePointer !== null) return;
    consume(event);
    movePointer = event.pointerId;
    stick.classList.add('is-held');
    capture(stick, event.pointerId);
    updateStick(event);
  }, { passive: false });
  listen(stick, 'pointermove', (event) => {
    if (!active || event.pointerId !== movePointer) return;
    consume(event); updateStick(event);
  }, { passive: false });
  function endStick(event) {
    if (event.pointerId !== movePointer) return;
    const id = movePointer; movePointer = null; clearMovement(); release(stick, id);
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(stick, type, endStick);

  listen(canvas, 'pointerdown', (event) => {
    if (!active || !isTouch(event) || lookPointer !== null) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left + rect.width * .4) return;
    consume(event);
    lookPointer = event.pointerId;
    lastLook = { x: event.clientX, y: event.clientY };
    capture(canvas, event.pointerId);
    lookHint.classList.add('is-held');
  }, { passive: false });
  listen(canvas, 'pointermove', (event) => {
    if (!active || event.pointerId !== lookPointer || !lastLook) return;
    consume(event);
    const dx = event.clientX - lastLook.x, dy = event.clientY - lastLook.y;
    lastLook.x = event.clientX; lastLook.y = event.clientY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    lookDistance += Math.hypot(dx, dy);
    onLook(dx, dy);
  }, { passive: false });
  function endLook(event) {
    if (event.pointerId !== lookPointer) return;
    const id = lookPointer; lookPointer = null; lastLook = null;
    lookHint.classList.remove('is-held'); release(canvas, id);
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(canvas, type, endLook);
  listen(canvas, 'contextmenu', (event) => { if (lookPointer !== null) event.preventDefault(); });

  listen(run, 'pointerdown', (event) => {
    if (!active || !isTouch(event)) return;
    consume(event); sprintPointers.add(event.pointerId); capture(run, event.pointerId); showSprint();
  }, { passive: false });
  function endRun(event) {
    if (!sprintPointers.delete(event.pointerId)) return;
    showSprint(); release(run, event.pointerId);
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(run, type, endRun);
  // Window listeners also recover safely if capture is unsupported or lost as
  // the pointer leaves a control. Each handler checks its own pointer id.
  for (const type of ['pointerup', 'pointercancel']) listen(hostWindow, type, (event) => {
    endStick(event); endLook(event); endRun(event);
  });
  listen(run, 'keydown', (event) => {
    if (!active || !['Space', 'Enter'].includes(event.code)) return;
    event.preventDefault(); keyboardSprint = true; showSprint();
  });
  listen(run, 'keyup', (event) => {
    if (!['Space', 'Enter'].includes(event.code)) return;
    event.preventDefault(); keyboardSprint = false; showSprint();
  });
  listen(run, 'blur', () => { keyboardSprint = false; showSprint(); });
  listen(run, 'click', (event) => event.preventDefault());
  listen(stick, 'click', (event) => event.preventDefault());
  listen(zoomIn, 'click', () => { if (active) onZoom(-.65); });
  listen(zoomOut, 'click', () => { if (active) onZoom(.65); });
  listen(hostWindow, 'blur', reset);
  listen(hostDocument, 'visibilitychange', () => { if (hostDocument.hidden) reset(); });
  function reflow() { reset(); updateVisibility(); }
  listen(hostWindow, 'resize', reflow);
  listen(hostWindow, 'orientationchange', reflow);
  if (media?.addEventListener) listen(media, 'change', reflow);
  else if (media?.addListener) {
    media.addListener(reflow);
    listeners.push(() => media.removeListener(reflow));
  }
  updateVisibility();

  return {
    element: controls,
    move,
    getMovement: () => ({ ...move }),
    get sprint() { return active && (sprintPointers.size > 0 || keyboardSprint); },
    get enabled() { return active; },
    get isTouchMode() { return available; },
    setEnabled(value) { requested = Boolean(value); updateVisibility(); },
    reset,
    diagnostics: () => ({
      enabled: active, touchMode: available, movement: { ...move },
      sprint: active && (sprintPointers.size > 0 || keyboardSprint),
      pointerIds: { move: movePointer, look: lookPointer, sprint: [...sprintPointers] },
      lookDistance,
    }),
    dispose() {
      if (disposed) return;
      reset(); disposed = true; active = false;
      for (const remove of listeners) remove();
      controls.remove();
      canvas.style.touchAction = previousTouchAction;
    },
  };
}
