import test from 'node:test';
import assert from 'node:assert/strict';
import { CHANNEL, createHostBridge, validCheckpoint } from '../src/host-bridge.js';
import { HOST_DESTINATIONS, hostDestination } from '../src/host-destinations.js';
import { createHostInteractions } from '../src/host-interactions.js';
import { createPhysics } from '../src/physics.js';
import { integratedGeometry } from './integrated-geometry.js';
import { loadWorldGeometry } from './world-geometry.js';
import { Vector3, Sphere } from 'three';
import { createTravelRoute } from '../src/fast-travel.js';
import { composeArrivalView } from '../src/camera.js';
function harness() {
  const listeners = new Map(), messages = [], commands = [];
  const parent = { postMessage: (data, origin) => messages.push({ data, origin }) };
  const window = { parent, location: { href: 'https://squabblemon.test/scenes/fadewood/?host=1', origin: 'https://squabblemon.test' }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const bridge = createHostBridge({ window, onCommand: command => commands.push(command) });
  const send = (data, options = {}) => listeners.get('message')?.({ source: parent, origin: window.location.origin, data: { channel: CHANNEL, version: 1, instanceId: 'first-scene', ...data }, ...options });
  return { bridge, window, messages, commands, send, listeners };
}
test('bridge rejects cross-origin, wrong-source and pre-init commands', () => {
  const h = harness();
  h.send({ type: 'mode', mode: 'exploring' });
  h.send({ type: 'init', reducedMotion: false }, { origin: 'https://other.test' });
  h.send({ type: 'init', reducedMotion: false }, { source: {} });
  assert.equal(h.commands.length, 0); assert.equal(h.bridge.post('ready'), false);
  h.send({ type: 'init', reducedMotion: false });
  assert.equal(h.commands[0].first, true);
  h.bridge.post('ready'); assert.equal(h.messages[0].origin, 'https://squabblemon.test');
  assert.equal(h.messages[0].data.instanceId, 'first-scene');
});
test('late messages from a previous scene cannot replace this scene nonce', () => {
  const h = harness(); h.send({ type: 'init', reducedMotion: false });
  h.send({ type: 'init', reducedMotion: false, instanceId: 'old-scene' });
  h.send({ type: 'travel', requestId: 'trip', destinationId: 'dojo', instanceId: 'old-scene' });
  h.send({ type: 'mode', mode: 'execute-scripts' });
  assert.equal(h.commands.length, 1);
  h.send({ type: 'init', reducedMotion: true }); assert.equal(h.commands[1].first, false);
  h.send({ type: 'travel', requestId: 'trip', destinationId: 'dojo' });
  assert.deepEqual(h.commands[2], { type: 'travel', requestId: 'trip', destinationId: 'dojo' });
  h.bridge.dispose(); assert.equal(h.listeners.has('message'), false); assert.equal(h.bridge.post('ready'), false);
});
test('invalid checkpoints and unsupported intent do not cross the bridge', () => {
  const h = harness(); h.send({ type: 'init', reducedMotion: false });
  for (const position of [[NaN, 0, 0], [0, -20, 0], [500, 0, 0], [0, 0], ['0', 0, 0]]) {
    assert.equal(validCheckpoint({ position, yaw: 0 }), false);
    h.send({ type: 'restore', checkpoint: { position, yaw: 0 } });
  }
  h.send({ type: 'navigate', route: '/admin' });
  h.send({ type: 'restore', checkpoint: { position: [0, .13, 24.5], yaw: 0 } });
  assert.equal(h.commands.length, 2); assert.equal(h.commands[1].type, 'restore');
});
test('integrated nearest interaction emits source identity without navigation authority', () => {
  const listeners = new Map(), inspected = [];
  const window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const interaction = createHostInteractions({ window, kind: 'character', getRecords: () => [{ id: 'mailman', name: 'The Mailman', feet: [1, .13, 0] }], onInspect: id => inspected.push(id) });
  interaction.update(new Vector3(0, .13, 0), 0, { enabled: true });
  assert.deepEqual(interaction.nearest, { id: 'mailman', name: 'The Mailman', kind: 'character' });
  listeners.get('keydown')({ code: 'KeyE', preventDefault() {}, stopImmediatePropagation() {} });
  assert.deepEqual(inspected, ['mailman']);
  interaction.update(new Vector3(), 0, { enabled: false }); assert.equal(interaction.nearest, undefined);
  interaction.dispose(); assert.equal(listeners.size, 0);
});
test('all semantic destinations settle on active integrated collision geometry with bounded correction', async () => {
  const {physics} = await integratedGeometry();
  assert.equal(new Set(HOST_DESTINATIONS.map(d => d.id)).size, 15);
  for (const destination of HOST_DESTINATIONS) {
    assert.equal(hostDestination(destination.id), destination);
    physics.teleport(new Vector3(...destination.position));
    for (let i = 0; i < 48; i++) physics.move(new Vector3(), 0, 1 / 120);
    assert.equal(physics.grounded, true, destination.id);
    assert.ok(Math.hypot(physics.position.x - destination.position[0], physics.position.z - destination.position[2]) < .5, destination.id);
    assert.ok(physics.position.y > -.1 && physics.position.y < 1, destination.id);
  }
  assert.equal(hostDestination('https://other.test'), null);
});

test('all 225 host routes keep cloud and camera clear with booth, relocated hoop and six vehicle proxies', async () => {
  const {physics} = await integratedGeometry(), grounds = new Map();
  for (const destination of HOST_DESTINATIONS) {
    physics.teleport(new Vector3(...destination.position));
    for (let i = 0; i < 48; i++) physics.move(new Vector3(), 0, 1 / 120);
    grounds.set(destination.id, physics.position.clone());
  }
  const cameraProbe = new Sphere(new Vector3(), .12), cloudProbe = new Sphere(new Vector3(), .3);
  for (const from of HOST_DESTINATIONS) for (const to of HOST_DESTINATIONS) {
    const route = createTravelRoute(grounds.get(from.id), to, composeArrivalView(from, grounds.get(from.id)));
    route.setArrivalPosition(grounds.get(to.id), .87);
    for (let i = 0; i <= 240; i++) {
      const frame = route.sample(i / 240);
      cameraProbe.center.fromArray(frame.camera);
      cloudProbe.center.set(frame.position[0], frame.position[1] + 1.25, frame.position[2]);
      assert.equal(Boolean(physics.colliders.octree.sphereIntersect(cameraProbe)), false, `${from.id}→${to.id} camera@${i}`);
      assert.equal(Boolean(physics.colliders.octree.sphereIntersect(cloudProbe)), false, `${from.id}→${to.id} cloud@${i}`);
    }
  }
});
test('presentation commands accept bounded identities, never account or route fields', () => {
  const h = harness(); h.send({ type: 'init', reducedMotion: false });
  h.send({ type: 'presentation', storyTargets: [{ arcId: 'season-1', sourceId: 'cornball', label: 'Continue Story', route: '/admin' }], mail: { unread: 2, gifts: 1 } });
  assert.deepEqual(h.commands[1], { type: 'presentation', storyTargets: [{ arcId: 'season-1', sourceId: 'cornball', label: 'Continue Story' }], mail: { unread: 2, gifts: 1 } });
  h.send({ type: 'presentation', storyTargets: Array(25).fill({ arcId: 'arc', sourceId: 'npc', label: 'Hi' }) });
  h.send({ type: 'presentation', storyTargets: [], mail: { unread: -1, gifts: 0 } });
  assert.equal(h.commands.length, 2);
});

test('child checkpoints match account-host limits at every inclusive boundary', () => {
  const check = (position, yaw = 0, arrivalId) => validCheckpoint({ position, yaw, ...(arrivalId !== undefined ? { arrivalId } : {}) });
  assert.equal(check([-29, -1, -49], -1000, 'a'.repeat(80)), true);
  assert.equal(check([29, 15, 43], 1000), true);
  for (const position of [[-29.001, 0, 0], [29.001, 0, 0], [0, -1.001, 0], [0, 15.001, 0], [0, 0, -49.001], [0, 0, 43.001]]) assert.equal(check(position), false);
  assert.equal(check([0, 0, 0], 1000.001), false);
  assert.equal(check([0, 0, 0], 0, 'a'.repeat(81)), false);
});

test('focus commands retain request identity and reject malformed framing requests', () => {
  const h=harness();h.send({type:'init',reducedMotion:false});
  h.send({type:'focus',requestId:'framing-1',sourceId:'cornball'});
  h.send({type:'releaseFocus',requestId:'framing-1'});
  assert.deepEqual(h.commands.slice(1),[{type:'focus',requestId:'framing-1',sourceId:'cornball'},{type:'releaseFocus',requestId:'framing-1'}]);
  h.send({type:'focus',requestId:'',sourceId:'cornball'});h.send({type:'focus',requestId:'bad',sourceId:'x'.repeat(97)});
  assert.equal(h.commands.length,3);
});
test('mail presentation accepts bounded account-scoped attention and an actual opened flag', () => {
  const h=harness();h.send({type:'init',reducedMotion:false});
  h.send({type:'presentation',storyTargets:[{arcId:'bulletin',sourceId:'fade-park-bulletin',label:'Events & bounties'}],mail:{unread:1,gifts:2,attentionId:'account-a:hash',opened:false}});
  assert.equal(h.commands[1].mail.attentionId,'account-a:hash');assert.equal(h.commands[1].mail.opened,false);
  h.send({type:'presentation',storyTargets:[],mail:{unread:1,gifts:2,attentionId:'x'.repeat(241)}});
  h.send({type:'presentation',storyTargets:[],mail:{unread:1,gifts:2,opened:'yes'}});
  assert.equal(h.commands.length,2);
});
