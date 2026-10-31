import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createPhysics } from './physics.js';
import { createFollowCameraRig, createArrivalShot } from './camera.js';
import { createFightCloud } from './fight-cloud.js';
import { DESTINATIONS, createTravelSequence } from './fast-travel.js';
import { LANDMARKS, EXTRA_ENTRANCES } from './landmarks.js';
import { createEntranceDoors } from './entrance-doors.js';
import { loadCharacterCast } from './character-cast.js';
import { CHARACTER_PLACEMENTS, RESIDENT_PLACEMENTS, ALL_CHARACTER_PLACEMENTS } from './character-placements.js';
import { ENTRANCE_CHARACTER_PLACEMENTS, ENTRANCE_PROP_PLACEMENTS } from './entrance-placements.js';
import { createAnimeEnvironment } from './anime-environment.js';
import { createAnimeSurfaces } from './anime-surfaces.js';
import { createTouchControls } from './touch-controls.js';
import { getRenderProfile } from './render-profile.js';
import { fitViewFov } from './view-layout.js';
import { loadNeighborhoodProps } from './neighborhood-props.js';
import { PROP_PLACEMENTS } from './prop-placements.js';
import { createPropColliders, removeLegacyCar } from './prop-colliders.js';
import { createHostBridge } from './host-bridge.js';
import { createPresentationClock } from './presentation-clock.js';
import { HOST_DESTINATIONS, hostDestination } from './host-destinations.js';
import { createHostInteractions } from './host-interactions.js';
import { createFocusController } from './focus-controller.js';
import { BULLETIN_SOURCE, MURAL_SOURCE } from './world-sources.js';
import { createWorldPicker } from './world-picker.js';
import { createMailFlightPlanner, createMailDeliveryController } from './mail-delivery.js';
import { createParkBulletin } from './park-bulletin.js';
import { createStreetLighting } from './street-lighting.js';
import { createCurbDetails } from './curb-details.js';
import { loadAmbientAnimations, createAmbientActions } from './ambient-actions.js';
import './touch-controls.css';

let fatalError = null;
let stateTimer = null;
let disposed = false, hostMode = 'paused', reducedMotion = false, pendingRestore = null;
let frameId = null, lastHostState = 0, lastArrivalId = null, travelRequest = null;
let focusController, worldPicker, mailDelivery, parkBulletin, streetLighting, curbDetails, ambientActions;
let requestedNight = false;
let frameWallDelta = 0;
let presentation = { storyTargets: [], mail: { unread: 0, gifts: 0 } };
const markerPosition = new THREE.Vector3();
let progressState = { progress: 0, label: 'Opening the neighborhood…' };
const listeners = [];
function listen(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  listeners.push(() => target.removeEventListener(type, handler, options));
}
const host = createHostBridge({ onCommand: handleHostCommand });
// Read-only motion samples are opt-in for local fixture verification only.
const motionProof = (() => {
  if (!host.enabled || !['127.0.0.1', 'localhost'].includes(location.hostname)) return false;
  try { const url = new URL(parent.location.href); return url.pathname.startsWith('/e2e/') && url.searchParams.get('motionProof') === '1'; } catch { return false; }
})();
let lastMotionProof = 0;
const ENTRANCES = [...LANDMARKS, ...EXTRA_ENTRANCES];
const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries(['game', 'menu', 'menu-title', 'menu-copy', 'play-button', 'load-status', 'load-progress', 'resume-hint', 'district-name', 'motion-state', 'help-panel', 'help-button', 'help-close', 'reset-button', 'pause-button', 'travel-button', 'travel-panel', 'travel-close', 'travel-destinations', 'travel-transition', 'travel-announcement'].map((id) => [id, $(id)]));
ui['reset-button'].disabled = true;
const viewportSize = () => ({ width: innerWidth, height: innerHeight });
const readRenderProfile = () => getRenderProfile({ ...viewportSize(), devicePixelRatio, coarsePointer: matchMedia('(any-pointer: coarse)').matches, deviceMemory: navigator.deviceMemory });
const assetProfile = readRenderProfile();
let renderProfile = assetProfile;
const spawn = new THREE.Vector3(0, 0.13, 24.5);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#4eafce');
scene.fog = new THREE.Fog('#7da9b6', 64, 150);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.06, 240);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: assetProfile.antialias, powerPreference: 'high-performance' });
} catch {
  ui['load-status'].textContent = 'This browser could not open the 3D view. Try Chrome or Edge with graphics acceleration enabled.';
  ui['play-button'].textContent = '3D view unavailable';
  fatalError = 'This browser could not open the 3D view. Graphics acceleration is required.';
  host.post('error', { message: fatalError });
  throw new Error('WebGL is unavailable.');
}
renderer.setPixelRatio(renderProfile.pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const canvas = renderer.domElement;
canvas.tabIndex = 0;
canvas.setAttribute('aria-label', 'Squabble Block. WASD to move, mouse to look, Shift to sprint, Escape to pause.');
ui.game.append(canvas);

let world, physics, player, modelOffset, avatarMesh, mixer, action, state = 'Idle_10';
let loaded = false, playing = false, started = false, wasLocked = false, drag = false, lockFallback = false;
let yaw = 0, pitch = 0.24, distance = 4.8, modelHeightOffset = -0.13;
const keys = new Set();
let sprintHeld = false;
const actions = new Map();
const moveInput = new THREE.Vector3();
const direction = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const meshTargets = [];
const portalCameraTargets = [];
const cameraProbeOrigin = new THREE.Vector3();
const cameraProbeOffsets = [new THREE.Vector3(0, -.38, 0), new THREE.Vector3(0, .38, 0), new THREE.Vector3(-.38, 0, 0), new THREE.Vector3(.38, 0, 0)];
let distanceTravelled = 0, actualSpeed = 0;
let errorMessage = null;
let locomotionHold = 0, bodyVisible = true;
const previousFeet = new THREE.Vector3();
const followRig = createFollowCameraRig();
const arrivalShot = createArrivalShot();
let entranceDoors, characterCast, residentCast, entranceCast, residentMotion, streetSigns, entranceProps, neighborhoodSurfaces, anunakiShip, animeEnvironment, animeSurfaces, interactions, neighborhoodProps, propColliders, railway, storyPortals, portalInteractions, viewRoll = 0;
const hasOpenInteraction = () => Boolean(focusController?.active || interactions?.active || portalInteractions?.active);
let travelCameraTrace = [], recordTravelUntil = 0;
const fightCloud = createFightCloud(scene, { textureUrl: `${import.meta.env.BASE_URL}assets/v3/anime-fists.png` });
const travel = createTravelSequence({ onArrive: arriveAt, onComplete: completeTravel });
const travelClock = createPresentationClock();
const touch = createTouchControls({
  canvas, parent: ui.game,
  onLook: (dx, dy) => {
    if (!playing || travel.active || hasOpenInteraction()) return;
    arrivalShot.cancel();
    yaw -= dx * .004;
    pitch = THREE.MathUtils.clamp(pitch + dy * .004, .04, 1.03);
  },
  onZoom: (delta) => {
    arrivalShot.cancel(); distance = THREE.MathUtils.clamp(distance + delta, 2.3, 7.5);
  },
});
let previousTouchMode = null;
function syncInputControls() {
  touch.setEnabled(loaded && playing && !travel.active && !hasOpenInteraction() && ui.menu.hidden && ui['help-panel'].hidden && ui['travel-panel'].hidden);
  ui['pause-button'].disabled = !loaded || hasOpenInteraction() || (!playing && !travel.active);
  if (previousTouchMode !== touch.isTouchMode) {
    previousTouchMode = touch.isTouchMode;
    document.body.classList.toggle('touch-ui', touch.isTouchMode);
  canvas.setAttribute('aria-label', touch.isTouchMode ? 'Fadewood. Left thumbstick to move, drag the right side to look. Hold Run to sprint. Tap a nearby interaction prompt, Travel or Pause.' : 'Fadewood. WASD to move, mouse to look, Shift to sprint, E to interact, Escape to pause.');
  }
}
syncInputControls();

// Keep the original painted textures, adding a three-step directional tint.
// This small Basic-material extension avoids adding light/normal texture samplers.
function addCelTint(material) {
  if (!material.isMeshBasicMaterial) return;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBlockNormal;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #if !defined(USE_ENVMAP) && !defined(USE_SKINNING)
        vec3 objectNormal = normal;
      #endif
      vBlockNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBlockNormal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 blockNormal = normalize(vBlockNormal) * (gl_FrontFacing ? 1.0 : -1.0);
      float blockLight = dot(blockNormal, normalize(vec3(-0.38, 0.81, 0.44)));
      vec3 blockTone = blockLight > 0.45 ? vec3(1.0, 0.98, 0.91) : (blockLight > 0.05 ? vec3(0.87, 0.88, 0.97) : vec3(0.66, 0.69, 0.84));
      diffuseColor.rgb *= blockTone;`);
  };
  material.customProgramCacheKey = () => 'squabble-cel-v1';
  material.needsUpdate = true;
}

function updateProgress(percent, text) {
  ui['load-progress'].value = percent;
  ui['load-status'].textContent = text;
  progressState = { progress: percent, label: text };
  host.post('progress', progressState);
}

function changeAnimation(name) {
  if (name === state && action) return;
  const next = actions.get(name);
  if (!next) return;
  const previous = action;
  next.reset().setEffectiveTimeScale(name === 'Walking' ? 1.03 : name === 'Running' ? 1.06 : 1).setEffectiveWeight(1).play();
  if (previous) next.crossFadeFrom(previous, 0.19, false);
  action = next;
  state = name;
  if (import.meta.env.DEV && name !== 'Idle_10') ui.game.dataset.lastLocomotion = name;
  modelHeightOffset = name === 'Idle_10' ? -0.13 : -0.188;
}

function setMenu(paused = false) {
  ui.menu.hidden = false;
  ui['play-button'].textContent = paused ? 'Keep walking →' : 'Step outside →';
  ui['menu-title'].innerHTML = paused ? 'TAKE<br /><span>A BREATHER.</span>' : 'WALK<br /><span>THE BLOCK.</span>';
  ui['menu-copy'].textContent = paused ? 'The block will be right here. Jump back in when you’re ready.' : 'Step into Fadewood. Meet the block, talk to your neighbors, and find your next fade.';
  ui['resume-hint'].hidden = !paused;
}

function pauseGame({ focus = true } = {}) {
  if (!loaded) return;
  if (host.enabled) { inspectHost('world-pause'); return; }
  playing = false;
  keys.clear();
  sprintHeld = false;
  drag = false;
  touch.setEnabled(false);
  ui['pause-button'].disabled = true;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  changeAnimation('Idle_10');
  ui['motion-state'].textContent = 'TAKING A BREATHER';
  setMenu(started);
  if (focus) ui['play-button'].focus({ preventScroll: true });
}

function useDragLook() {
  lockFallback = true;
  if (touch.isTouchMode) {
    ui['resume-hint'].textContent = 'Left thumbstick to move. Drag the right side to look. Hold Run to sprint.';
    return;
  }
  const tips = document.querySelector('.key-tips');
  tips.innerHTML = '<span><kbd>WASD</kbd> move</span><span><kbd>Drag</kbd> look</span><span><kbd>Shift</kbd> sprint</span><span><kbd>E</kbd> interact</span><span><kbd>F</kbd> fast travel</span><span><kbd>Esc</kbd> pause</span>';
  ui['resume-hint'].textContent = 'This view uses click-and-drag to look. WASD and sprint work normally.';
}

async function startGame() {
  if (!loaded || disposed || travel.active || hasOpenInteraction()) return;
  if (host.enabled && (hostMode !== 'exploring' || document.hidden)) return;
  playing = true;
  started = true;
  ui.menu.hidden = true;
  ui['help-panel'].hidden = true;
  ui['travel-panel'].hidden = true;
  if (!host.enabled) canvas.focus({ preventScroll: true });
  syncInputControls();
  if (host.enabled) { useDragLook(); return; }
  if (touch.isTouchMode) {
    if (document.pointerLockElement === canvas) { wasLocked = false; document.exitPointerLock(); }
    useDragLook();
  } else if (canvas.requestPointerLock) {
    try { await canvas.requestPointerLock(); if (disposed || !playing || (host.enabled && hostMode !== 'exploring')) document.exitPointerLock(); }
    catch { useDragLook(); }
  } else useDragLook();
}

function resetPlayer() {
  if (!physics) return;
  arrivalShot.cancel(); viewRoll = 0;
  keys.clear(); sprintHeld = false; locomotionHold = 0;
  touch.reset();
  physics.reset();
  yaw = 0; pitch = 0.24; distance = 4.8;
  player.rotation.y = Math.PI;
  physics.getRenderPosition(player.position);
  changeAnimation('Idle_10');
  updateCamera(1, true);
  if (playing) canvas.focus({ preventScroll: true });
}

function showHelp() {
  if (host.enabled) { inspectHost('world-pause'); return; }
  pauseGame({ focus: false });
  ui.menu.hidden = true;
  ui['help-panel'].hidden = false;
  ui['help-close'].focus();
}
function closeHelp() {
  ui['help-panel'].hidden = true;
  if (loaded) setMenu(started);
  ui['play-button'].focus();
}

function locationLabel(p) {
  let nearest = null, closest = 81;
  for (const location of ENTRANCES) {
    const [x, , z] = location.entry.position;
    const squared = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (squared < closest) { nearest = location; closest = squared; }
  }
  return nearest?.name.toUpperCase() ?? 'FADE DISTRICT';
}

function updateCamera(dt, immediate = false) {
  const composition = arrivalShot.sample(immediate ? 0 : dt);
  if (composition) { yaw = composition.yaw; pitch = composition.pitch; distance = composition.distance; }
  followRig.aim(player.position, yaw, pitch, dt, immediate, composition ?? {});
  raycaster.set(followRig.target, followRig.direction);
  raycaster.near = 0.05;
  raycaster.far = distance + 0.25;
  storyPortals?.group.updateMatrixWorld(true);
  const hit = raycaster.intersectObjects(meshTargets, false)[0];
  let obstruction = hit?.distance;
  // Moving portal artwork is render-only for walking, but must not enter the
  // follow camera. A narrow swept clearance catches the hat brim below centre.
  for (const offset of cameraProbeOffsets) {
    cameraProbeOrigin.copy(followRig.target).add(offset);
    raycaster.set(cameraProbeOrigin, followRig.direction);
    const portalHit = raycaster.intersectObjects(portalCameraTargets, false)[0];
    if (portalHit) obstruction = Math.min(obstruction ?? Infinity, Math.max(.01, portalHit.distance - .22));
  }
  camera.position.copy(followRig.place(distance, obstruction, dt, immediate));
  camera.lookAt(followRig.target);
  viewRoll = immediate ? (composition?.roll ?? 0) : THREE.MathUtils.damp(viewRoll, composition?.roll ?? 0, 8, dt);
  camera.rotateZ(viewRoll);
  const fittedFov = fitViewFov(composition?.fov ?? 58, viewportSize());
  const fov = immediate ? fittedFov : THREE.MathUtils.damp(camera.fov, fittedFov, 8, dt);
  if (Math.abs(fov - camera.fov) > .001) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // Hysteresis avoids flickering the body at the near-camera transition.
  if (followRig.armLength < 1.15) bodyVisible = false;
  else if (followRig.armLength > 1.4) bodyVisible = true;
  if (avatarMesh) avatarMesh.visible = bodyVisible && !travel.active && !hasOpenInteraction();
}

function openTravel() {
  if (host.enabled) { if (loaded && !travel.active) inspectHost('world-map'); return; }
  if (!loaded || travel.active || hasOpenInteraction()) return;
  pauseGame({ focus: false });
  ui.menu.hidden = true; ui['help-panel'].hidden = true;
  ui['travel-panel'].hidden = false;
  ui['travel-destinations'].querySelector('button')?.focus();
}
function closeTravel() {
  ui['travel-panel'].hidden = true;
  setMenu(started); ui['play-button'].focus();
}
function startTravel(destination) {
  if (!loaded || hasOpenInteraction() || !travel.start(destination, player.position, { camera: camera.position, target: followRig.target, fov: camera.fov, roll: viewRoll })) return;
  travelClock.reset(performance.now());
  travelCameraTrace = []; recordTravelUntil = 0;
  arrivalShot.cancel();
  playing = false; started = true; drag = false; keys.clear(); sprintHeld = false;
  touch.setEnabled(false);
  ui['pause-button'].disabled = false;
  locomotionHold = 0; changeAnimation('Idle_10');
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  ui.menu.hidden = true; ui['help-panel'].hidden = true; ui['travel-panel'].hidden = true;
  ui['travel-transition'].hidden = false;
  ui['travel-announcement'].textContent = `Next stop: ${destination.name}`;
  document.body.classList.add('travel-in-flight');
  ui['travel-button'].disabled = true; ui['reset-button'].disabled = true; ui['help-button'].disabled = true;
  fightCloud.start(player.position, { duration: travel.duration });
  avatarMesh.visible = false;
  shadow.visible = false;
  ui['motion-state'].textContent = 'CATCHING A FADE';
}
function arriveAt(destination) {
  physics.teleport(new THREE.Vector3(...destination.position));
  for (let i = 0; i < 48; i++) physics.move(direction.set(0, 0, 0), 0, 1 / 120);
  physics.getRenderPosition(player.position);
  const entrance = destination.lookAt ?? LANDMARKS.find((landmark) => landmark.id === (destination.arrivalId ?? destination.id))?.entry.position ?? destination.position;
  lastArrivalId = destination.arrivalId ?? destination.id;
  player.rotation.y = Math.atan2(entrance[0] - player.position.x, entrance[2] - player.position.z);
  modelOffset.position.y = -.13; modelHeightOffset = -.13;
  mixer.setTime(.3);
  ui['district-name'].textContent = destination.name.toUpperCase();
  ui['travel-announcement'].textContent = `You’re at ${destination.name}`;
  return player.position;
}
function clearTravelVisuals() {
  fightCloud.stop();
  document.body.classList.remove('travel-in-flight', 'travel-flash');
  ui['travel-transition'].hidden = true;
  ui['travel-button'].disabled = false; ui['reset-button'].disabled = false; ui['help-button'].disabled = false;
  shadow.visible = true;
}
function completeTravel(destination, finalFrame) {
  clearTravelVisuals();
  arrivalShot.start(destination, { settled: true });
  // Seed the regular follow rig at the same authored pose used by the final
  // route sample. No stale departure target and no second arrival dolly.
  updateCamera(0, true);
  if (finalFrame) applyTravelView(finalFrame);
  recordTravelUntil = performance.now() + 1000;
  playing = !host.enabled || (hostMode === 'exploring' && !document.hidden); useDragLook(); if (playing) canvas.focus({ preventScroll: true });
  if (travelRequest) { const completed = travelRequest; travelRequest = null; host.post('travelComplete', { ...completed, checkpoint: checkpoint() }); }
  postHostState(true);
  ui['motion-state'].textContent = 'STANDING BY';
}
function cancelTravel() {
  const cancelled = travelRequest; travelRequest = null;
  travel.cancel(); clearTravelVisuals(); if (loaded) updateCamera(0, true);
  if (cancelled) host.post('travelCancelled', { requestId: cancelled.requestId });
  if (host.enabled) { clearInput(); playing = hostMode === 'exploring' && !document.hidden; postHostState(true); syncLoop(); }
  else pauseGame();
}
function applyTravelView(view) {
  camera.position.fromArray(view.camera);
  camera.lookAt(direction.fromArray(view.target));
  viewRoll = view.roll ?? 0;
  camera.rotateZ(viewRoll);
  camera.fov = fitViewFov(view.fov ?? 58, viewportSize());
  camera.updateProjectionMatrix();
}
for (const [index, destination] of DESTINATIONS.entries()) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'travel-destination';
  button.dataset.destination = destination.id;
  for (const [className, text] of [['travel-number', index + 1], ['travel-name', destination.name], ['travel-note', destination.note]]) {
    const span = document.createElement('span'); span.className = className; span.textContent = text; button.append(span);
  }
  listen(button, 'click', () => startTravel(destination));
  ui['travel-destinations'].append(button);
}

// A single analytic contact shadow follows the player; it adds no image texture.
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.15), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'varying vec2 vUv; void main(){ float r=length((vUv-.5)*2.0); float a=(1.0-smoothstep(.12,1.0,r))*.25; gl_FragColor=vec4(.045,.065,.12,a); }',
}));
shadow.rotation.x = -Math.PI / 2;
shadow.renderOrder = 2;
shadow.visible = false;
scene.add(shadow);

async function loadBlock() {
  updateProgress(4, 'Opening the neighborhood…');
  const loader = new GLTFLoader();
  const loadAsync = loader.loadAsync.bind(loader);
  loader.loadAsync = async (...args) => {
    if (disposed) throw new DOMException('Scene disposed', 'AbortError');
    return awaitLive(loadAsync(...args));
  };
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/squabble-block.glb`, (event) => {
    if (event.total) updateProgress(5 + Math.round(event.loaded / event.total * 66), 'Bringing in your block…');
  });
  // GLTFLoader may resolve a scene after an image fails. Require every authored
  // texture so a failed WebP decode cannot silently turn a facade white.
  const worldTextures = await awaitLive(gltf.parser.getDependencies('texture'));
  if (disposed) return;
  if (worldTextures.length !== gltf.parser.json.textures.length || worldTextures.some((texture) =>
    !texture?.isTexture || !texture.image?.width || !texture.image?.height)) {
    throw new Error('A neighborhood texture did not load. Reload to try again.');
  }
  world = gltf.scene;
  world.updateMatrixWorld(true);
  let skinned;
  world.traverse((o) => { if (o.isSkinnedMesh) skinned = o; });
  if (!skinned) throw new Error('The Friendly Fades avatar was not found in the scene.');
  avatarMesh = skinned;
  let rig = skinned;
  while (rig.parent && rig.parent !== world) rig = rig.parent;
  player = new THREE.Group();
  player.name = 'Player controller';
  player.position.copy(spawn);
  player.rotation.y = Math.PI;
  modelOffset = new THREE.Group();
  // Keep the original mesh bind matrices and staged rig transforms intact.
  // This inverse staging offset makes the new parent pivot sit at the feet.
  modelOffset.position.copy(spawn).negate();
  player.add(modelOffset);
  modelOffset.add(rig);
  scene.add(world, player);
  // Old unassigned crowd batches and generated stand-ins are omitted in V3.
  const backgroundResidents = [];
  world.traverse((object) => {
    if (/09[ _]+Background[ _]+residents/i.test(`${object.name} ${object.userData?.name ?? ''}`)) backgroundResidents.push(object);
  });
  backgroundResidents.forEach((object) => object.removeFromParent());
  const legacySkyline = [];
  world.traverse((object) => {
    if (/04[ _]+Neighborhood[ _]+silhouette[ _]+and[ _]+horizon/.test(object.name) && /02[ _]+Warm[ _]+cream|08[ _]+Glass[ _]+petrol|13[ _]+Distance[ _]+blue/.test(object.name)) legacySkyline.push(object);
  });
  legacySkyline.forEach((object) => object.removeFromParent());
  entranceDoors = createEntranceDoors(world, ENTRANCES.map((location) => ({
    ...location.entry, id: location.id, name: location.name, color: location.color,
  })));
  updateProgress(73, 'Painting Fadewood…');
  animeEnvironment = await awaitLive(createAnimeEnvironment({ world, parent: scene, renderer, preserveParkBulletin: host.enabled }));
  animeSurfaces = await awaitLive(createAnimeSurfaces({ parent: scene, renderer, textureLedSafehouse: host.enabled }));
  if (host.enabled) curbDetails = await awaitLive(createCurbDetails({ world, parent: scene, renderer, loader }));
  if (host.enabled) parkBulletin = await awaitLive(createParkBulletin({ parent: scene, renderer }));
  const { createStreetSigns } = await awaitLive(import('./street-signs.js'));
  streetSigns = await awaitLive(createStreetSigns({ parent: scene, renderer }));
  updateProgress(74, 'Laying the Fadewood rail loop…');
  const { createRailway } = await awaitLive(import('./railway.js'));
  railway = await awaitLive(createRailway({ parent: scene, renderer }));
  updateProgress(75, 'Opening the stories behind the block…');
  const { createStoryPortals } = await awaitLive(import('./story-portals.js'));
  storyPortals = await awaitLive(createStoryPortals({ world, parent: scene, renderer, textureLedSafehouse: host.enabled }));
  storyPortals.group.traverse(object => { if (object.isMesh) portalCameraTargets.push(object); });
  const { loadAnunakiShip } = await awaitLive(import('./anunaki-ship.js'));
  anunakiShip = await awaitLive(loadAnunakiShip({ portals: storyPortals, loader, baseUrl: `${import.meta.env.BASE_URL}assets/residents/` }));
  const { createNeighborhoodSurfaces } = await awaitLive(import('./neighborhood-surfaces.js'));
  neighborhoodSurfaces = await awaitLive(createNeighborhoodSurfaces({ world, parent: scene, renderer }));
  updateProgress(76, 'Parking your cars and stocking the garage…');
  neighborhoodProps = await awaitLive(loadNeighborhoodProps({
    parent: scene, loader, placements: PROP_PLACEMENTS,
    baseUrl: `${import.meta.env.BASE_URL}assets/props/`,
    onProgress: ({ loaded, total }) => updateProgress(76 + Math.round(3 * loaded / total), `Placing your neighborhood props… ${loaded}/${total}`),
  }));
  entranceProps = await awaitLive(loadNeighborhoodProps({ parent: scene, loader, placements: ENTRANCE_PROP_PLACEMENTS, baseUrl: `${import.meta.env.BASE_URL}assets/entrance-cast/` }));
  const legacyCar = removeLegacyCar(world);
  propColliders = createPropColliders([...neighborhoodProps.records, ...entranceProps.records]);
  const collisionWorld = new THREE.Group();
  collisionWorld.name = 'Static neighborhood collision';
  scene.add(collisionWorld);
  collisionWorld.add(world, propColliders.group);
  if (curbDetails) { collisionWorld.add(curbDetails.collisionGroup); meshTargets.push(...curbDetails.collisionGroup.children); }
  meshTargets.push(...propColliders.meshes);
  world.updateMatrixWorld(true);
  const materials = new Set();
  world.traverse((o) => {
    if (!o.isMesh) return;
    meshTargets.push(o);
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) materials.add(m);
  });
  player.traverse((o) => {
    if (o.isMesh) {
      // The imported mesh positions contain staging coordinates; use the rig's
      // actual pose instead of the original accessor box for culling.
      o.frustumCulled = false;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) materials.add(m);
    }
  });
  for (const m of materials) {
    addCelTint(m);
    if (m.map) m.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  }
  updateProgress(79, 'Checking the sidewalks…');
  await awaitLive(new Promise(requestAnimationFrame));
  physics = createPhysics(collisionWorld, {
    spawn,
    bounds: new THREE.Box3(new THREE.Vector3(-29, -1, -49), new THREE.Vector3(29, 15, 43)),
  });
  mixer = new THREE.AnimationMixer(player);
  for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip));
  for (const required of ['Idle_10', 'Walking', 'Running']) if (!actions.has(required)) throw new Error(`Missing avatar animation: ${required}`);
  changeAnimation('Idle_10');
  mixer.update(0.3);
  for (let i = 0; i < 30; i++) physics.move(direction.set(0, 0, 0), 0, 1 / 60);
  player.position.copy(physics.position);
  updateCamera(1, true);
  shadow.visible = true;
  updateProgress(80, 'Bringing your characters to the block…');
  const additionalAnimations = await awaitLive(loadAmbientAnimations(loader));
  characterCast = await awaitLive(loadCharacterCast(scene, {
    loader,
    placements: CHARACTER_PLACEMENTS, additionalAnimations,
    baseUrl: `${import.meta.env.BASE_URL}assets/${assetProfile.characterAssetDirectory}/`,
    onProgress: ({ loaded, total }) => updateProgress(80 + Math.round(8 * loaded / total), `Bringing your characters in… ${loaded}/${total}`),
  }));
  residentCast = await awaitLive(loadCharacterCast(scene, {
    loader, placements: RESIDENT_PLACEMENTS, baseUrl: `${import.meta.env.BASE_URL}assets/residents/`,
    onProgress: ({ loaded, total }) => updateProgress(88 + Math.round(4 * loaded / total), `Meeting the new neighbors… ${loaded}/${total}`),
  }));
  entranceCast = await awaitLive(loadCharacterCast(scene, {
    loader, placements: ENTRANCE_CHARACTER_PLACEMENTS, baseUrl: `${import.meta.env.BASE_URL}assets/entrance-cast/`,
    onProgress: ({ loaded, total }) => updateProgress(92 + Math.round(2 * loaded / total), `Opening Catch Lane… ${loaded}/${total}`),
  }));
  ambientActions = createAmbientActions({ cast: [characterCast, residentCast, entranceCast], placements: ALL_CHARACTER_PLACEMENTS });
  ambientActions.update(0, { reducedMotion });
  const { createResidentMotion } = await awaitLive(import('./resident-motion.js'));
  residentMotion = createResidentMotion({ cast: [characterCast, residentCast, entranceCast], placements: ALL_CHARACTER_PLACEMENTS });
  if (host.enabled) {
    focusController = createFocusController({ getCharacters: () => residentMotion.getInteractionRecords(), getPortals: worldPortalRecords, getViewport: viewportSize,
      onComplete: payload => { if (payload.sourceId === 'mailman') mailDelivery?.acknowledge(); host.post('focusComplete', payload); },
      onCancelled: payload => host.post('focusCancelled', payload),
    });
    let handled = [];
    try { const saved = JSON.parse(sessionStorage.getItem('squabblemon:fadewood:mail-acknowledged:v2') ?? '[]'); if (Array.isArray(saved)) handled = saved.filter(id => typeof id === 'string' && id.length <= 240).slice(-32); } catch { /* Optional presentation memory. */ }
    const planner = createMailFlightPlanner(physics.colliders.octree);
    mailDelivery = createMailDeliveryController({ planner, handled,
      onHandled: ids => { try { sessionStorage.setItem('squabblemon:fadewood:mail-acknowledged:v2', JSON.stringify(ids)); } catch { /* Storage restrictions do not block mail. */ } },
      onHome: () => residentMotion.resetRoute('mailman', 0),
    });
    mailDelivery.setAttention(presentation.mail);
    worldPicker = createWorldPicker({ canvas, camera, scene, getRecords: () => [...residentMotion.getInteractionRecords(), ...worldPortalRecords()], getPlayer: () => player.position,
      enabled: () => playing && !travel.active && !hasOpenInteraction() && hostMode === 'exploring', onInspect: inspectHost });
  }
  const { createCharacterInteractions } = host.enabled ? {} : await import('./character-interactions.js');
  const lifecycle = {
    onOpen: () => {
      playing = false; drag = false; keys.clear(); sprintHeld = false; actualSpeed = 0;
      touch.setEnabled(false);
      arrivalShot.cancel(); changeAnimation('Idle_10');
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      ui.menu.hidden = true; avatarMesh.visible = false; shadow.visible = false;
      for (const id of ['travel-button', 'reset-button', 'help-button']) ui[id].disabled = true;
      ui['motion-state'].textContent = 'ON THE BLOCK';
    },
    onClose: () => {
      playing = true; keys.clear(); sprintHeld = false; viewRoll = 0;
      for (const id of ['travel-button', 'reset-button', 'help-button']) ui[id].disabled = false;
      shadow.visible = true; ui.menu.hidden = true; useDragLook(); updateCamera(0, true);
    },
  };
  const appBaseUrl = import.meta.env.VITE_SQUABBLEMON_APP_BASE_URL || null;
  interactions = host.enabled ? createHostInteractions({ getRecords: () => residentMotion.getInteractionRecords(), kind: 'character', onInspect: inspectHost }) : createCharacterInteractions({ characters: residentMotion.getInteractionRecords(), appBaseUrl, ...lifecycle });
  const { createWorldPortalInteractions } = host.enabled ? {} : await import('./world-portal-interactions.js');
  portalInteractions = host.enabled ? createHostInteractions({ getRecords: worldPortalRecords, kind: 'portal', onInspect: inspectHost }) : createWorldPortalInteractions({ getPortals: () => storyPortals.getPortals(), appBaseUrl, ...lifecycle });
  if (import.meta.env.DEV) {
    ui.game.dataset.castRecords = JSON.stringify([...characterCast.records, ...residentCast.records, ...entranceCast.records]);
    ui.game.dataset.castStats = JSON.stringify({ original: characterCast.stats, residents: residentCast.stats, entrance: entranceCast.stats });
    ui.game.dataset.streetSignStats = JSON.stringify(streetSigns.stats);
    ui.game.dataset.entrancePropStats = JSON.stringify(entranceProps.stats);
    ui.game.dataset.entrancePropRecords = JSON.stringify(entranceProps.records);
    ui.game.dataset.neighborhoodSurfaceStats = JSON.stringify(neighborhoodSurfaces.stats);
    ui.game.dataset.anunakiShipStats = JSON.stringify(anunakiShip.stats);
    ui.game.dataset.environmentStats = JSON.stringify(animeEnvironment.stats);
    if (curbDetails) ui.game.dataset.curbStats = JSON.stringify(curbDetails.stats);
    ui.game.dataset.surfaceStats = JSON.stringify(animeSurfaces.stats);
    ui.game.dataset.removedResidentBatches = String(backgroundResidents.length);
    ui.game.dataset.removedLegacySkylineBatches = String(legacySkyline.length);
    ui.game.dataset.characterAssetDirectory = assetProfile.characterAssetDirectory;
    ui.game.dataset.worldTextures = JSON.stringify(worldTextures.map((texture) => ({
      name: texture.name, mimeType: texture.userData.mimeType, width: texture.image.width, height: texture.image.height,
      colorSpace: texture.colorSpace, flipY: texture.flipY, wrapS: texture.wrapS, wrapT: texture.wrapT,
      minFilter: texture.minFilter, magFilter: texture.magFilter,
    })));
    ui.game.dataset.propRecords = JSON.stringify(neighborhoodProps.records);
    ui.game.dataset.propStats = JSON.stringify(neighborhoodProps.stats);
    ui.game.dataset.propCollisionStats = JSON.stringify(propColliders.stats);
    ui.game.dataset.removedLegacyCar = JSON.stringify({ meshes: legacyCar.removedMeshes, triangles: legacyCar.triangles });
    ui.game.dataset.railwayStats = JSON.stringify(railway.stats);
    ui.game.dataset.storyPortalStats = JSON.stringify(storyPortals.stats);
  }
  streetLighting = createStreetLighting({ scene, environment: animeEnvironment, renderer, onStatus: value => {
    ui.game.dataset.night = String(value.night);
    ui.game.dataset.lightingStatus = value.status;
    host.post('lighting', value);
    if (loaded && !disposed && !document.hidden && hostMode !== 'exploring') renderer.render(scene, camera);
  } });
  await awaitLive(streetLighting.setNight(requestedNight));
  updateProgress(96, 'Getting your steps ready…');
  fightCloud.group.visible = true;
  fightCloud.group.scale.setScalar(0);
  await awaitLive(renderer.compileAsync(scene, camera));
  fightCloud.stop();
  loaded = true;
  updateProgress(100, 'The block is yours.');
  ui['play-button'].disabled = false;
  ui['reset-button'].disabled = false;
  ui['travel-button'].disabled = false;
  ui['play-button'].textContent = 'Step outside →';
  ui['motion-state'].textContent = 'READY TO ROAM';
  if (host.enabled) {
    ui.menu.hidden = true; ui['help-panel'].hidden = true; ui['travel-panel'].hidden = true;
    if (pendingRestore) { restoreCheckpoint(pendingRestore); pendingRestore = null; }
    postReady(); if (hostMode === 'exploring') startGame(); syncLoop();
  } else ui['play-button'].focus({ preventScroll: true });
}

listen(ui['play-button'], 'click', startGame);
listen(ui['reset-button'], 'click', resetPlayer);
listen(ui['pause-button'], 'click', () => { if (travel.active) cancelTravel(); else if (playing) pauseGame(); });
listen(ui['help-button'], 'click', showHelp);
listen(ui['help-close'], 'click', closeHelp);
listen(ui['travel-button'], 'click', openTravel);
listen(ui['travel-close'], 'click', closeTravel);
listen(document, 'pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (wasLocked && !locked && playing) pauseGame();
  wasLocked = locked;
});
listen(document, 'pointerlockerror', useDragLook);
listen(window, 'keydown', (event) => {
  if (import.meta.env.DEV) ui.game.dataset.lastInput = `${event.code}:${event.key}:${event.shiftKey}`;
  if (event.code === 'Escape') {
    if (focusController?.active && !focusController.complete) { event.preventDefault(); releaseHostFocus(); return; }
    if (hasOpenInteraction()) return;
    if (travel.active) cancelTravel();
    else if (!ui['travel-panel'].hidden) closeTravel();
    else if (!ui['help-panel'].hidden) closeHelp();
    else if (playing) pauseGame();
    return;
  }
  if (travel.active || hasOpenInteraction()) return;
  if (!ui['travel-panel'].hidden) {
    const index = Number(event.code.replace('Digit', '')) - 1;
    if (event.code.startsWith('Digit') && DESTINATIONS[index]) { event.preventDefault(); startTravel(DESTINATIONS[index]); }
    return;
  }
  if (event.code === 'KeyF' && !event.repeat && !(event.ctrlKey || event.metaKey || event.altKey)) { event.preventDefault(); openTravel(); return; }
  if (!playing) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) arrivalShot.cancel();
  sprintHeld = event.shiftKey || event.code === 'ShiftLeft' || event.code === 'ShiftRight';
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyR'].includes(event.code)) event.preventDefault();
  if (event.code === 'KeyR' && !event.repeat) resetPlayer();
  else if (event.code === 'KeyH' && !event.repeat) showHelp();
  else keys.add(event.code);
});
listen(window, 'keyup', (event) => { keys.delete(event.code); sprintHeld = playing && event.shiftKey; });
listen(window, 'blur', () => { if (host.enabled) { clearInput(); return; } if (travel.active) cancelTravel(); else if (playing) pauseGame({ focus: false }); });
listen(document, 'visibilitychange', () => { if (host.enabled) { clearInput(); if (document.hidden && focusController?.active && !focusController.complete) releaseHostFocus(); if (document.hidden && travel.active) cancelTravel(); playing = loaded && hostMode === 'exploring' && !document.hidden; syncLoop(); postHostState(true); return; } if (document.hidden) { if (travel.active) cancelTravel(); else if (playing) pauseGame({ focus: false }); } });
listen(window, 'mousemove', (event) => {
  if (!playing || event.sourceCapabilities?.firesTouchEvents || (document.pointerLockElement !== canvas && !drag)) return;
  arrivalShot.cancel();
  yaw -= event.movementX * 0.0024;
  pitch = THREE.MathUtils.clamp(pitch + event.movementY * 0.0024, 0.04, 1.03);
});
listen(canvas, 'pointerdown', (event) => {
  if (!playing || event.pointerType === 'touch') return;
  if (document.pointerLockElement !== canvas) {
    drag = true;
    canvas.setPointerCapture(event.pointerId);
  }
});
listen(canvas, 'pointerup', (event) => { if (event.pointerType !== 'touch') drag = false; });
listen(canvas, 'pointercancel', (event) => { if (event.pointerType !== 'touch') drag = false; });
listen(canvas, 'wheel', (event) => {
  if (!playing) return;
  arrivalShot.cancel();
  event.preventDefault();
  distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.003, 2.3, 7.5);
}, { passive: false });
listen(window, 'resize', () => {
  renderProfile = readRenderProfile();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(renderProfile.pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  touch.reset(); syncInputControls();
  if (loaded && !travel.active && !hasOpenInteraction()) updateCamera(0, true);
});
listen(ui['travel-panel'], 'keydown', (event) => {
  if (event.key !== 'Tab') return;
  const buttons = [...ui['travel-panel'].querySelectorAll('button:not(:disabled)')];
  const index = buttons.indexOf(document.activeElement);
  event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
});
listen(ui['help-panel'], 'keydown', (event) => {
  if (event.key === 'Tab') { event.preventDefault(); ui['help-close'].focus(); }
});

let previous = performance.now();
let npcElapsed = 0;
let portalElapsed = 0;
let lastObservation = 0;
function frame(now) {
  frameId = null;
  if (disposed || (host.enabled && (hostMode !== 'exploring' || document.hidden || !loaded))) return;
  frameId = requestAnimationFrame(frame);
  frameWallDelta = Math.max(0, (now - previous) / 1000);
  const dt = Math.min(frameWallDelta, 0.055);
  previous = now;
  if (!loaded) { renderer.render(scene, camera); return; }
  syncInputControls();
  npcElapsed += dt;
  const activeNpc = focusController?.sourceId ?? interactions.state.characterId;
  ambientActions?.update(npcElapsed, { playerPosition: player.position, activeCharacterId: activeNpc, reducedMotion });
  characterCast.update(npcElapsed);
  residentCast.update(npcElapsed);
  entranceCast.update(npcElapsed);
  curbDetails?.update?.(npcElapsed, { playerPosition: player.position, activeCharacterId: activeNpc, reducedMotion });
  const mailPose = mailDelivery?.update(frameWallDelta, { safe: playing && !travel.active && !focusController?.active && hostMode === 'exploring', player: player.position.toArray(),
    mailman: residentMotion.getInteractionRecords().find(record => record.id === 'mailman'), records: residentMotion.getInteractionRecords(), cameraPosition: camera.position.toArray() });
  residentMotion.update(npcElapsed, { playerPosition: player.position, activeCharacterId: focusController?.sourceId ?? interactions.state.characterId, overrides: mailPose ? { mailman: mailPose } : {} });
  animeEnvironment.update(reducedMotion ? 0 : npcElapsed, camera);
  railway.update(reducedMotion ? 0 : npcElapsed);
  // Hold a moving portal in its interaction composition until the player exits.
  // NPCs, leaves and the train retain their own ambient clocks.
  if (!portalInteractions.active && !focusController?.active) portalElapsed += dt;
  storyPortals.update(reducedMotion ? 0 : portalElapsed, { playerPosition: player.position, enabled: playing && !travel.active && !hasOpenInteraction() });
  if (playing) {
    const forwardValue = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) + touch.move.y;
    const sideValue = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + touch.move.x;
    if (touch.move.x || touch.move.y) arrivalShot.cancel();
    const movementYaw = followRig.yaw;
    forward.set(-Math.sin(movementYaw), 0, -Math.cos(movementYaw));
    right.set(Math.cos(movementYaw), 0, -Math.sin(movementYaw));
    moveInput.copy(forward).multiplyScalar(forwardValue).addScaledVector(right, sideValue);
    if (moveInput.lengthSq() > 1) moveInput.normalize();
    const sprint = sprintHeld || keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.sprint;
    previousFeet.copy(physics.position);
    physics.move(moveInput, sprint ? 5.2 : 2.25, dt);
    const travelled = Math.hypot(physics.position.x - previousFeet.x, physics.position.z - previousFeet.z);
    actualSpeed = Math.hypot(physics.velocity.x, physics.velocity.z);
    distanceTravelled += travelled;
    physics.getRenderPosition(player.position);
    if (moveInput.lengthSq() > 0.001) {
      const desiredAngle = Math.atan2(moveInput.x, moveInput.z);
      const error = Math.atan2(Math.sin(desiredAngle - player.rotation.y), Math.cos(desiredAngle - player.rotation.y));
      player.rotation.y += error * (1 - Math.exp(-16 * dt));
    }
    if (moveInput.lengthSq() > .001 && actualSpeed > .12) locomotionHold = .1;
    else locomotionHold = Math.max(0, locomotionHold - dt);
    const moving = locomotionHold > 0;
    changeAnimation(moving ? (sprint ? 'Running' : 'Walking') : 'Idle_10');
    ui['motion-state'].textContent = moving ? (sprint ? 'RUN THE BLOCK' : 'TAKING A LAP') : 'STANDING BY';
    ui['district-name'].textContent = locationLabel(physics.position);
    updateCamera(dt);
  }
  if (travel.active) {
    travel.advance(travelClock.sample(now));
    if (travel.active) {
      const route = travel.sample();
      applyTravelView(route);
      if (!reducedMotion) fightCloud.update(travel.elapsed, camera, route);
      avatarMesh.visible = false; shadow.visible = false;
    }
  }
  const canInteract = playing && !travel.active && !hasOpenInteraction() && ui.menu.hidden && ui['help-panel'].hidden && ui['travel-panel'].hidden;
  portalInteractions.update(player.position, dt, { enabled: canInteract });
  interactions.update(player.position, dt, { enabled: canInteract && !portalInteractions.nearby });
  const closeup = focusController?.sample(now) ?? portalInteractions.sampleCamera() ?? interactions.sampleCamera();
  if (closeup) {
    camera.position.copy(closeup.position); camera.lookAt(closeup.target); camera.rotateZ(closeup.roll);
    camera.fov = closeup.fov; camera.updateProjectionMatrix(); viewRoll = closeup.roll;
  }
  if (playing || !started) mixer.update(dt);
  modelOffset.position.y = THREE.MathUtils.damp(modelOffset.position.y, modelHeightOffset, 14, dt);
  shadow.position.copy(player.position);
  shadow.position.y += 0.012;
  if (import.meta.env.DEV && (travel.active || now < recordTravelUntil)) {
    travelCameraTrace.push({ t: now / 1000, active: travel.active, position: camera.position.toArray(), fov: camera.fov, roll: viewRoll, fists: fightCloud.group.userData.activeFists ?? 0 });
    if (travelCameraTrace.length > 1200) travelCameraTrace.shift();
  }
  if (import.meta.env.DEV && now - lastObservation > 120) {
    lastObservation = now;
    Object.assign(ui.game.dataset, {
      ready: String(loaded), playing: String(playing), motion: state,
      x: physics.position.x.toFixed(3), y: physics.position.y.toFixed(3), z: physics.position.z.toFixed(3),
      yaw: yaw.toFixed(3), grounded: String(physics.grounded),
      travel: String(travel.active), travelStage: travel.active ? travel.sample().stage : 'idle',
      destination: travel.destination?.id ?? '', travelTime: travel.elapsed.toFixed(2),
      cloudX: fightCloud.group.position.x.toFixed(3), cloudY: fightCloud.group.position.y.toFixed(3), cloudZ: fightCloud.group.position.z.toFixed(3),
      travelDuration: travel.duration.toFixed(2), fistTextureReady: String(fightCloud.group.userData.fistTextureReady),
      activeFists: String(fightCloud.group.userData.activeFists ?? 0),
      fistMotion: JSON.stringify(fightCloud.group.children.filter((object) => object.name.startsWith('Anime fist sprite')).map((object) => ({ opacity: object.userData.opacity, extension: object.userData.extension, depth: object.userData.depth }))),
      travelCameraTrace: JSON.stringify(travelCameraTrace),
      cameraX: camera.position.x.toFixed(3), cameraY: camera.position.y.toFixed(3), cameraZ: camera.position.z.toFixed(3),
      cameraRoll: viewRoll.toFixed(3), cameraFov: camera.fov.toFixed(2), arrivalShot: arrivalShot.active ? (arrivalShot.settled ? 'composed' : 'moving') : 'free',
      entranceCount: String(ENTRANCES.length), placeholderCount: '0',
      castCount: String(characterCast.stats.characters + residentCast.stats.characters + entranceCast.stats.characters), castNames: [...characterCast.records, ...residentCast.records, ...entranceCast.records].map(({ name }) => name).join(', '),
      castAnimations: String(characterCast.stats.idleAnimations + residentCast.stats.idleAnimations + entranceCast.stats.idleAnimations),
      castMotion: JSON.stringify([...characterCast.sampleMotion(), ...residentCast.sampleMotion(), ...entranceCast.sampleMotion()]),
      residentMotion: JSON.stringify(residentMotion.sample()),
      placeholderMotion: '[]', interaction: JSON.stringify(interactions.state),
      portalInteraction: JSON.stringify(portalInteractions.state), storyPortals: JSON.stringify(storyPortals.getPortals()),
      renderCalls: String(renderer.info.render.calls), renderTriangles: String(renderer.info.render.triangles),
      inputMode: touch.isTouchMode ? 'touch' : 'desktop', touchControls: JSON.stringify(touch.diagnostics()), renderProfile: JSON.stringify(renderProfile),
      speed: actualSpeed.toFixed(3), collisionTriangles: String(physics.colliders.triangleCount),
      railwayMotion: JSON.stringify(railway.sampleMotion()),
    });
  }
  if (motionProof && now - lastMotionProof >= 250) {
    lastMotionProof = now;
    Object.assign(ui.game.dataset, {
      npcTime: npcElapsed.toFixed(3), npcWallTime: now.toFixed(2),
      npcMotion: JSON.stringify([...characterCast.sampleMotion(), ...residentCast.sampleMotion(), ...entranceCast.sampleMotion(), ...(curbDetails?.sampleMotion() ?? [])]),
      npcAmbient: JSON.stringify([...(ambientActions?.sample() ?? []), ...(curbDetails?.sampleAmbient() ?? [])]),
      npcRoutes: JSON.stringify(residentMotion.sample()),
      curbStats: JSON.stringify(curbDetails?.stats ?? {}),
    });
  }
  postHostState();
  renderer.render(scene, camera);
}
syncLoop();
loadBlock().catch((error) => {
  if (disposed || error.name === 'AbortError') return;
  errorMessage = error.message;
  fatalError = 'The neighborhood could not finish loading. Reload to try again.';
  host.post('error', { message: 'The neighborhood could not finish loading. Reload to try again.' });
  console.error(error);
  updateProgress(0, 'The block could not finish loading. Refresh to try again.');
  ui['play-button'].textContent = 'Refresh to try again';
});

listen(window, 'pagehide', disposeWorld);

if (import.meta.env.DEV) {
  window.__SQUABBLE_PREVIEW__ = {
    getState: () => ({ loaded, playing, started, state, grounded: physics?.grounded, position: physics?.position.toArray(), velocity: physics?.velocity.toArray(), yaw, pitch, distance, actualSpeed, distanceTravelled, pointerLocked: document.pointerLockElement === canvas, lockFallback, avatarVisible: player?.visible, clips: [...actions.keys()], collisionTriangles: physics?.colliders.triangleCount, drawCalls: renderer.info.render.calls, renderTriangles: renderer.info.render.triangles, error: errorMessage }),
    teleport: (x, y, z) => { physics.teleport(new THREE.Vector3(x, y, z)); player.position.copy(physics.position); updateCamera(1, true); },
    setOrbit: (newYaw, newPitch = pitch) => { yaw = newYaw; pitch = newPitch; updateCamera(1, true); },
    interactions: () => interactions,
  };
}

function checkpoint() {
  return { position: physics.position.toArray(), yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)), ...(lastArrivalId ? { arrivalId: lastArrivalId } : {}) };
}
function postHostState(force = false) {
  if (!host.enabled || !loaded || disposed) return;
  if (performance.now() - lastHostState < 220) {
    if (force && stateTimer === null) stateTimer = setTimeout(() => { stateTimer = null; postHostState(true); }, 221 - (performance.now() - lastHostState));
    return;
  }
  lastHostState = performance.now();
  const courier = mailDelivery?.state ?? residentMotion?.sample().find(record => record.id === 'mailman');
  Object.assign(ui.game.dataset, {
    ready: String(loaded), playing: String(playing),
    focusState: focusController?.active ? (focusController.complete ? 'held' : 'framing') : 'idle', focusSource: focusController?.sourceId ?? '',
    courierPhase: courier?.phase ?? 'unavailable',
    courierDistance: courier?.position ? Math.hypot(courier.position[0] - player.position.x, courier.position[2] - player.position.z).toFixed(2) : '',
    courierPosition: courier?.position ? courier.position.map(value => value.toFixed(3)).join(',') : '',
    cameraPosition: camera.position.toArray().map(value => value.toFixed(3)).join(','),
  });
  const nearest = playing ? portalInteractions?.nearest ?? interactions?.nearest : undefined;
  let locationId;
  let closest = Infinity;
  for (const landmark of LANDMARKS) { const [x, , z] = landmark.entry.position; const d = Math.hypot(physics.position.x - x, physics.position.z - z); if (d < closest) { closest = d; locationId = landmark.id; } }
  host.post('state', { playing, travel: travel.active, courier: mailDelivery?.state, locationId, checkpoint: checkpoint(), markers: projectedMarkers(), ...(nearest ? { nearest } : {}) });
}
function clearInput() {
  keys.clear(); sprintHeld = false; drag = false; locomotionHold = 0; actualSpeed = 0;
  touch.reset(); touch.setEnabled(false);
  wasLocked = false;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}
function inspectHost(sourceId) {
  if (!host.enabled || !loaded || disposed) return;
  host.post('inspect', { sourceId });
  hostMode = 'overlay'; playing = false; clearInput(); postHostState(true); syncLoop();
}
function postReady() {
  if (loaded && !disposed) host.post('ready', { destinationIds: HOST_DESTINATIONS.map(destination => destination.id) });
}
function restoreCheckpoint(value) {
  releaseHostFocus();
  if (!loaded) { pendingRestore = value; return; }
  if (travel.active) cancelTravel();
  clearInput();
  physics.teleport(new THREE.Vector3(...value.position));
  for (let i = 0; i < 48; i++) physics.move(direction.set(0, 0, 0), 0, 1 / 120);
  physics.getRenderPosition(player.position);
  // A checkpoint may predate prop placement. Recover to its known safe apron.
  if (Math.hypot(player.position.x - value.position[0], player.position.z - value.position[2]) > 2 || player.position.y < -1) {
    const safe = hostDestination(value.arrivalId) ?? hostDestination('blue-block');
    physics.teleport(new THREE.Vector3(...safe.position)); physics.getRenderPosition(player.position);
  }
  yaw = value.yaw; lastArrivalId = hostDestination(value.arrivalId)?.arrivalId ?? null;
  arrivalShot.cancel(); updateCamera(0, true); postHostState(true);
}
function handleHostCommand(command) {
  if (fatalError) { if (command.type === 'init') host.post('error', { message: fatalError }); return; }
  if (disposed) return;
  if (command.type === 'init') {
    reducedMotion = command.reducedMotion;
    requestedNight = command.night ?? requestedNight;
    if (streetLighting) void streetLighting.setNight(requestedNight);
    if (command.first && command.checkpoint) { if (loaded) restoreCheckpoint(command.checkpoint); else pendingRestore = command.checkpoint; }
    host.post('progress', progressState); postReady();
  } else if (command.type === 'lighting') {
    requestedNight = command.night;
    if (streetLighting) void streetLighting.setNight(requestedNight);
  } else if (command.type === 'mode') {
    hostMode = command.mode;
    if (hostMode !== 'exploring') { playing = false; clearInput(); if (focusController?.active && !focusController.complete) releaseHostFocus(); if (travel.active) cancelTravel(); }
    else if (loaded && !document.hidden) { ui.menu.hidden = true; startGame(); }
    postHostState(true); syncLoop();
  } else if (command.type === 'travel') {
    if (travelRequest?.requestId === command.requestId) return;
    if (travel.active) cancelTravel();
    releaseHostFocus();
    const destination = hostDestination(command.destinationId);
    if (!loaded || !destination || document.hidden) { host.post('travelCancelled', { requestId: command.requestId }); return; }
    hostMode = 'exploring';
    travelRequest = { requestId: command.requestId, destinationId: command.destinationId };
    startTravel(destination);
    if (!travel.active) { host.post('travelCancelled', { requestId: command.requestId }); travelRequest = null; }
    // Reduced motion keeps the same grounded arrival and completion semantics.
    if (travel.active && reducedMotion) travel.advance(travel.duration);
    postHostState(true); syncLoop();
  } else if (command.type === 'focus') {
    if (!loaded || !focusController || document.hidden || travel.active) { host.post('focusCancelled', { requestId: command.requestId, sourceId: command.sourceId, reason: 'unavailable' }); return; }
    const started = focusController.start({ ...command, now: performance.now(), from: { position: camera.position, target: camera.getWorldDirection(new THREE.Vector3()).add(camera.position), fov: camera.fov, roll: viewRoll }, reducedMotion });
    if (!started) return;
    hostMode = 'exploring'; playing = false; clearInput(); arrivalShot.cancel(); changeAnimation('Idle_10'); avatarMesh.visible = false; shadow.visible = false;
    if (reducedMotion) { const shot = focusController.sample(performance.now()); if (shot) { camera.position.copy(shot.position); camera.lookAt(shot.target); camera.rotateZ(shot.roll); camera.fov = shot.fov; camera.updateProjectionMatrix(); viewRoll = shot.roll; renderer.render(scene, camera); } }
    postHostState(true); syncLoop();
  } else if (command.type === 'releaseFocus') { releaseHostFocus(command.requestId); postHostState(true); syncLoop();
  } else if (command.type === 'cancelTravel') {
    if (!command.requestId || command.requestId === travelRequest?.requestId) cancelTravel();
  } else if (command.type === 'presentation') {
    const known = new Set([...ALL_CHARACTER_PLACEMENTS.map(record => record.id), 'anunaki-ufo', 'alice-hat', 'underground-arena', 'safehouse-door', 'story-mural', 'fade-park-bulletin', 'demario-luigion-booth']);
    presentation = { storyTargets: command.storyTargets.filter(target => known.has(target.sourceId)), mail: command.mail ?? { unread: 0, gifts: 0 } };
    mailDelivery?.setAttention(presentation.mail);
    postHostState(true);
  } else if (command.type === 'restore') restoreCheckpoint(command.checkpoint);
  else if (command.type === 'dispose') disposeWorld();
}
function syncLoop() {
  const active = !disposed && (!host.enabled || (loaded && hostMode === 'exploring' && !document.hidden));
  if (!active && frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
  if (active && frameId === null) { previous = performance.now(); frameId = requestAnimationFrame(frame); }
}
function releaseObject(root) {
  const objects = root?.scene ?? root?.group ?? root;
  const resources = new Set();
  objects?.traverse?.(object => {
    if (object.geometry) resources.add(object.geometry);
    if (object.skeleton) resources.add(object.skeleton);
    for (const material of (Array.isArray(object.material) ? object.material : object.material ? [object.material] : [])) {
      resources.add(material); for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  for (const resource of resources) { resource.dispose?.(); if (resource.isTexture) resource.source?.data?.close?.(); }
  objects?.removeFromParent?.();
}
async function awaitLive(promise) {
  const resource = await promise;
  if (disposed) { resource?.dispose?.(); releaseObject(resource); throw new DOMException('Scene disposed', 'AbortError'); }
  return resource;
}
function disposeWorld() {
  if (disposed) return;
  disposed = true; playing = false; clearInput();
  if (stateTimer !== null) { clearTimeout(stateTimer); stateTimer = null; }
  if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
  travel.cancel(); travelRequest = null;
  for (const remove of listeners.splice(0)) remove();
  for (const resource of [streetLighting, curbDetails, ambientActions, worldPicker, focusController, mailDelivery, parkBulletin, interactions, portalInteractions, residentMotion, anunakiShip, entranceCast, residentCast, characterCast, entranceProps, neighborhoodProps, neighborhoodSurfaces, storyPortals, railway, streetSigns, animeEnvironment, animeSurfaces, entranceDoors, fightCloud]) resource?.dispose?.();
  mixer?.stopAllAction(); if (player) mixer?.uncacheRoot(player);
  releaseObject(scene); scene.clear();
  renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  touch.dispose(); host.dispose();
}

function projectedMarkers() {
  if (!residentMotion || !storyPortals) return [];
  const actors = residentMotion.getInteractionRecords();
  const portals = worldPortalRecords();
  const targets = [...presentation.storyTargets];
  if (presentation.mail.unread || presentation.mail.gifts) targets.push({ arcId: 'mail', sourceId: 'mailman', label: 'Mail & gifts' });
  return targets.map(target => {
    const actor = actors.find(record => record.id === target.sourceId);
    const portal = portals.find(record => record.id === target.sourceId);
    const record = actor ?? portal;
    const feet = record?.markerPosition ?? record?.feet ?? record?.interactionPosition ?? record?.position ?? (target.sourceId === 'story-mural' ? [0, 1.475, -44.805] : null);
    if (!feet) return { ...target, x: 50, y: 50, visible: false };
    markerPosition.fromArray(feet);
    if (!record?.markerPosition) markerPosition.y += actor ? (actor.height ?? 1.8) + .35 : target.sourceId === 'anunaki-ufo' ? 1.2 : 2.4;
    markerPosition.project(camera);
    const visible = markerPosition.z > -1 && markerPosition.z < 1 && Math.abs(markerPosition.x) <= 1 && Math.abs(markerPosition.y) <= 1;
    return { ...target, x: Math.max(0, Math.min(100, (markerPosition.x + 1) * 50)), y: Math.max(0, Math.min(100, (1 - markerPosition.y) * 50)), visible };
  });
}

// Explicit same-origin diagnostics are read-only scene observations, never account actions.
if (host.enabled && new URL(location.href).searchParams.get('debug') === '1') {
  window.__FADEWOOD_RENDER_DIAGNOSTICS__ = () => {
    const probe = new THREE.Raycaster();
    const visible = object => { for (let current = object; current; current = current.parent) if (!current.visible) return false; return true; };
    return { loaded, playing, camera: camera.position.toArray(), player: player?.position.toArray(),
      focus: { active: focusController?.active, complete: focusController?.complete, sourceId: focusController?.sourceId }, courier: mailDelivery?.state, bulletin: BULLETIN_SOURCE,
      rays: [-.1, -.5, -.8, -.95].map(y => {
        probe.setFromCamera(new THREE.Vector2(0, y), camera);
        return { y, hits: probe.intersectObjects(scene.children, true).filter(hit => visible(hit.object)).slice(0, 5).map(hit => ({ name: hit.object.name, parent: hit.object.parent?.name, distance: hit.distance, point: hit.point.toArray() })) };
      }) };
  };
}

function worldPortalRecords() { return [...(storyPortals?.getPortals() ?? []), ...(curbDetails?.getPortals() ?? []), BULLETIN_SOURCE, MURAL_SOURCE]; }
function releaseHostFocus(requestId) {
  if (!focusController?.active) return;
  const released = focusController.cancel('cancelled', requestId);
  if (!released) return;
  clearInput(); shadow.visible = true; if (avatarMesh) avatarMesh.visible = true;
  if (loaded) updateCamera(0, true);
  playing = loaded && hostMode === 'exploring' && !document.hidden;
}
