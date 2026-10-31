import { Quaternion, Vector3 } from 'three';

const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a, b, value) => a.map((component, index) => component + (b[index] - component) * value);
const length = (a, b) => Math.hypot(...a.map((component, index) => component - b[index]));
const angleDifference = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const mixAngle = (a, b, value) => a + angleDifference(a, b) * value;
const heading = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]);
const pointArray = (point) => Array.isArray(point) ? point : point && [point.x, point.y, point.z];
const safeTime = (time) => Number.isFinite(time) ? Math.max(0, time) : 0;
export const DOG_TURN_RATE = .95;
export const DOG_TURN_ACCELERATION = 3.2;
const isDog = id => id === 'nova' || id === 'golden-doberman';
const approach = (value, target, step) => value + clamp(target - value, -step, step);

// A shortest arc with angular acceleration, rather than an exponential 180°
// catch-up. A stationary dog can take small paw steps while reorienting.
export function advanceDogHeading(yaw, velocity, target, delta) {
  const dt = clamp(delta, 0, .25);
  let error = angleDifference(yaw, target);
  if (Math.abs(Math.abs(error) - Math.PI) < .08 && Math.abs(velocity) > .03) error = Math.sign(velocity) * Math.abs(error);
  if (Math.abs(error) < .003 && Math.abs(velocity) < .03) return { yaw, velocity: 0 };
  const next = approach(velocity, clamp(error * 3, -DOG_TURN_RATE, DOG_TURN_RATE), DOG_TURN_ACCELERATION * dt);
  return { yaw: yaw + next * dt, velocity: next };
}

const HOME = Object.freeze([10.1, .261, -8.9]);
const FLIGHT_HEIGHT = 8.2;
const MAIL_HOME_DWELL = 18;
const MAIL_LEG = Object.freeze({ rise: 4, flight: 18, land: 4, stop: 10 });
const MAIL_LEG_DURATION = Object.values(MAIL_LEG).reduce((total, value) => total + value, 0);

export const MAIL_TOUR_DURATION = MAIL_HOME_DWELL + MAIL_LEG_DURATION * 4;
export const RESIDENT_ROUTE_IDS = Object.freeze(['mailman', 'sherlock', 'nova', 'golden-doberman']);
export const MAIL_DELIVERY_STOPS = Object.freeze([
  { id: 'blue-block', position: [-8.7, .261, 3.1] },
  { id: 'county', position: [-8.7, .261, -24.4] },
  { id: 'dojo', position: [-8.7, .261, -39.1] },
  { id: 'red-block', position: [8.7, .261, 3.2] },
  { id: 'fade-park', position: [8.7, .261, -21] },
  { id: 'market-alley', position: [8.7, .261, 17.1] },
].map((stop) => Object.freeze({ ...stop, position: Object.freeze(stop.position) })));

// The sidewalks are at .261m and the road at .085m. This small transition
// follows the curb step without a hard vertical jump in the walking wrapper.
function streetHeight(x) {
  return .085 + .176 * smooth((Math.abs(x) - 4.98) / .4);
}

function makePath(waypoints, radius = .85) {
  const points = [[...waypoints[0]]];
  for (let index = 1; index < waypoints.length - 1; index += 1) {
    const a = waypoints[index - 1], b = waypoints[index], c = waypoints[index + 1];
    const ab = length(a, b), bc = length(b, c);
    const inset = Math.min(radius, ab * .35, bc * .35);
    if (inset < .00001) { points.push([...b]); continue; }
    const entry = mix(b, a, inset / ab), exit = mix(b, c, inset / bc);
    points.push(entry);
    for (let step = 1; step <= 12; step += 1) {
      const t = step / 12;
      points.push(mix(mix(entry, b, t), mix(b, exit, t), t));
    }
  }
  points.push([...waypoints.at(-1)]);
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) distances.push(distances.at(-1) + length(points[index - 1], points[index]));
  return { points, distances, distance: distances.at(-1) };
}

function pathPoint(path, metres) {
  const distance = clamp(metres, 0, path.distance);
  let index = 1;
  while (index < path.distances.length - 1 && path.distances[index] < distance) index += 1;
  const segmentLength = path.distances[index] - path.distances[index - 1];
  return mix(path.points[index - 1], path.points[index], segmentLength > 0 ? (distance - path.distances[index - 1]) / segmentLength : 0);
}

function samplePath(path, progress) {
  const p = clamp(progress), metres = smooth(p) * path.distance;
  const position = pathPoint(path, metres);
  const before = pathPoint(path, Math.max(0, metres - .25));
  const after = pathPoint(path, Math.min(path.distance, metres + .25));
  return { position, yaw: heading(before, after), derivative: 6 * p * (1 - p) * path.distance };
}

// A tour index seeds a shuffle once per sampled tour. Each closed tour has
// three different deliveries followed by the post office, so the mailman can
// always be found at home again rather than wandering off permanently.
function shuffledStops(tour) {
  let seed = (Math.imul(tour + 1, 0x9e3779b1) ^ 0x1b873593) >>> 0;
  const result = MAIL_DELIVERY_STOPS.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const swap = seed % (index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result.slice(0, 3);
}

// At most two prepared tours are retained, irrespective of session length.
const mailTourCache = new Map();
function mailTour(tour, home) {
  const cacheKey = `${tour}:${home.join(',')}`;
  if (mailTourCache.has(cacheKey)) return mailTourCache.get(cacheKey);
  const stops = [...shuffledStops(tour), { id: 'post-office', position: home }];
  let from = home;
  const legs = stops.map((stop) => {
    const to = stop.position;
    const path = makePath([
      [from[0], FLIGHT_HEIGHT, from[2]], [0, FLIGHT_HEIGHT, from[2]],
      [0, FLIGHT_HEIGHT, to[2]], [to[0], FLIGHT_HEIGHT, to[2]],
    ], 2.3);
    const result = { from, to, stopId: stop.id, path };
    from = to;
    return result;
  });
  const prepared = { stops, legs };
  mailTourCache.set(cacheKey, prepared);
  if (mailTourCache.size > 2) mailTourCache.delete(mailTourCache.keys().next().value);
  return prepared;
}

function sampleMail(time, home) {
  const tour = Math.floor(time / MAIL_TOUR_DURATION);
  const local = time - tour * MAIL_TOUR_DURATION;
  const prepared = mailTour(tour, home);
  const common = { id: 'mailman', tour, speed: 0, moving: false, grounded: true, stopId: 'post-office', returning: false };
  if (local < MAIL_HOME_DWELL) return { ...common, position: [...home], yaw: -1.9, phase: 'home', clipRole: 'idle' };
  const legIndex = Math.min(3, Math.floor((local - MAIL_HOME_DWELL) / MAIL_LEG_DURATION));
  let phaseTime = local - MAIL_HOME_DWELL - legIndex * MAIL_LEG_DURATION;
  const leg = prepared.legs[legIndex];
  const outwardYaw = samplePath(leg.path, 0).yaw;
  const arrivalYaw = leg.to[0] > 0 ? -Math.PI / 2 : Math.PI / 2;
  const previousYaw = legIndex === 0 ? -1.9 : leg.from[0] > 0 ? -Math.PI / 2 : Math.PI / 2;
  Object.assign(common, { stopId: leg.stopId, returning: legIndex === 3, leg: legIndex });
  if (phaseTime < MAIL_LEG.rise) {
    const p = phaseTime / MAIL_LEG.rise;
    return { ...common, position: [leg.from[0], leg.from[1] + (FLIGHT_HEIGHT - leg.from[1]) * smooth(p), leg.from[2]], yaw: mixAngle(previousYaw, outwardYaw, smooth(p)), phase: 'takeoff', clipRole: 'fly', moving: true, grounded: false, speed: (FLIGHT_HEIGHT - leg.from[1]) * 6 * p * (1 - p) / MAIL_LEG.rise };
  }
  phaseTime -= MAIL_LEG.rise;
  if (phaseTime < MAIL_LEG.flight) {
    const path = samplePath(leg.path, phaseTime / MAIL_LEG.flight);
    return { ...common, position: path.position, yaw: path.yaw, phase: 'flight', clipRole: 'fly', moving: true, grounded: false, speed: path.derivative / MAIL_LEG.flight };
  }
  phaseTime -= MAIL_LEG.flight;
  if (phaseTime < MAIL_LEG.land) {
    const p = phaseTime / MAIL_LEG.land;
    return { ...common, position: [leg.to[0], FLIGHT_HEIGHT + (leg.to[1] - FLIGHT_HEIGHT) * smooth(p), leg.to[2]], yaw: mixAngle(samplePath(leg.path, 1).yaw, leg.stopId === 'post-office' ? -1.9 : arrivalYaw, smooth(p)), phase: 'landing', clipRole: 'land', moving: true, grounded: false, speed: (FLIGHT_HEIGHT - leg.to[1]) * 6 * p * (1 - p) / MAIL_LEG.land };
  }
  return { ...common, position: [...leg.to], yaw: leg.stopId === 'post-office' ? -1.9 : arrivalYaw, phase: 'delivery', clipRole: 'idle' };
}

function walkingCycle(id, stops, speed, dwell, street = false) {
  let duration = 0;
  const parts = stops.map((from, index) => {
    const to = stops[(index + 1) % stops.length];
    const path = makePath([from, to]);
    const travel = Math.max(3.5, path.distance / speed);
    const result = { path, from, to, start: duration, travel, dwell: dwell + (index % 3) * .65 };
    duration += result.travel + result.dwell;
    return result;
  });
  return { id, parts, duration, street };
}

const WALKING_ROUTES = Object.freeze({
  sherlock: walkingCycle('sherlock', [
    [-8.7, .261, 11], [-8.7, .261, -1.5], [-8.7, .261, -23.5],
    [-8.7, .261, -35.5], [8.7, .261, -35.5], [8.7, .261, -22],
    [8.7, .261, -1], [8.7, .261, 18.2], [-8.7, .261, 18.2],
  ], 1.05, 4.8, true),
  nova: walkingCycle('nova', [
    [16.5, .331, -21.8], [18.6, .331, -20.4], [19.1, .331, -24.2],
    [17.8, .331, -28.8], [15.7, .331, -28.3], [15.7, .331, -24.4],
  ], .56, 4.1),
  'golden-doberman': walkingCycle('golden-doberman', [
    [18.7, .331, -28.6], [20.2, .331, -25.9], [19.9, .331, -22.3],
    [17.5, .331, -23.5], [17.1, .331, -26.8],
  ], .66, 5.2),
});

function sampleWalk(route, time) {
  const local = time % route.duration;
  const partIndex = route.parts.findIndex((part) => local < part.start + part.travel + part.dwell);
  const part = route.parts[partIndex < 0 ? 0 : partIndex];
  const phaseTime = local - part.start;
  if (phaseTime < part.travel) {
    const pose = samplePath(part.path, phaseTime / part.travel);
    if (route.street) pose.position[1] = streetHeight(pose.position[0]);
    return { id: route.id, position: pose.position, yaw: pose.yaw, phase: 'walking', clipRole: 'walk', speed: pose.derivative / part.travel, moving: true, grounded: true, stopId: `patrol-${partIndex}` };
  }
  const next = route.parts[(partIndex + 1) % route.parts.length];
  const yaw = mixAngle(samplePath(part.path, 1).yaw, samplePath(next.path, 0).yaw, smooth((phaseTime - part.travel) / part.dwell));
  const position = [...part.to];
  if (route.street) position[1] = streetHeight(position[0]);
  return { id: route.id, position, yaw, phase: 'looking-around', clipRole: 'idle', speed: 0, moving: false, grounded: true, stopId: `patrol-${partIndex}` };
}

/** Pure, reproducible feet/yaw samples; no randomness, raycasts or mesh scans per frame. */
export function sampleResidentRoute(id, elapsedSeconds, { position } = {}) {
  const time = safeTime(elapsedSeconds);
  if (id === 'mailman') return sampleMail(time, position ?? HOME);
  if (WALKING_ROUTES[id]) return sampleWalk(WALKING_ROUTES[id], time);
  return null;
}

/** Nova's supplied clip is a static rig pose; add a small diagonal paw gait. */
export function sampleNovaGait(elapsedSeconds, weight = 1) {
  const amplitude = clamp(weight), phase = safeTime(elapsedSeconds) * TAU * 1.65;
  const swing = Math.sin(phase) * .22 * amplitude;
  const opposite = Math.sin(phase + Math.PI) * .22 * amplitude;
  return {
    phase, weight: amplitude, bodyBob: (1 - Math.cos(phase * 2)) * .006 * amplitude,
    frontleg: swing, R_frontleg: opposite, backleg: opposite, R_backleg: swing,
    frontleg0: Math.max(0, -Math.sin(phase)) * .11 * amplitude,
    R_frontleg0: Math.max(0, Math.sin(phase)) * .11 * amplitude,
    backleg0: Math.max(0, Math.sin(phase)) * .11 * amplitude,
    R_backleg0: Math.max(0, -Math.sin(phase)) * .11 * amplitude,
    tail: Math.sin(phase * .5) * .065 * amplitude,
  };
}

function prepareDogGait(character, proceduralWalk) {
  if (!character) return null;
  const channels = [], idleChannels = [];
  character.updateWorldMatrix(true, true);
  const lateral = new Vector3(1, 0, 0).applyQuaternion(character.getWorldQuaternion(new Quaternion()));
  character.traverse((bone) => {
    if (!bone.isBone) return;
    const inverse = bone.parent.getWorldQuaternion(new Quaternion()).invert();
    if (/^(?:R_)?(?:frontleg0?|backleg0?)$|^tail$/.test(bone.name)) channels.push({ bone, base: bone.quaternion.clone(), axis: lateral.clone().applyQuaternion(inverse).normalize() });
    if (/^(?:head|chest|tail)$/.test(bone.name)) idleChannels.push({ bone, base: bone.quaternion.clone(), standingBase: bone.quaternion.clone(), axis: (bone.name === 'tail' ? new Vector3(0, 1, 0) : lateral.clone()).applyQuaternion(inverse).normalize() });
  });
  const turn = new Quaternion();
  let wasStanding = false;
  return {
    channels,
    apply(gait, time, standing) {
      if (proceduralWalk) for (const { bone, base, axis } of channels) bone.quaternion.copy(base).premultiply(turn.setFromAxisAngle(axis, gait[bone.name] ?? 0));
      const quiet = 1 - gait.weight;
      for (const channel of idleChannels) {
        const { bone, base, axis } = channel;
        if (!proceduralWalk && standing && !wasStanding) channel.standingBase.copy(bone.quaternion);
        // The native walk owns Golden's legs. During a paused stance, always
        // rebuild the small idle overlay from its saved base, never accumulate it.
        if (!proceduralWalk && standing) bone.quaternion.copy(channel.standingBase);
        if (proceduralWalk && bone.name !== 'tail') bone.quaternion.copy(base);
        const angle = bone.name === 'tail' ? Math.sin(time * 1.65) * .045 * (.3 + quiet * .7)
          : bone.name === 'head' ? Math.sin(time * .61) * .018 * quiet
          : Math.sin(time * TAU * .24) * .009 * quiet;
        bone.quaternion.premultiply(turn.setFromAxisAngle(axis, angle));
      }
      wasStanding = standing;
    },
    restore() { for (const { bone, base } of [...channels, ...idleChannels]) bone.quaternion.copy(base); },
  };
}

/**
 * Move normalizing character wrappers after cast.update(). Animation mixers,
 * source rig geometry and sole support remain owned by loadCharacterCast.
 * Records are stable objects: interaction UIs keep following the live actor.
 */
export function createResidentMotion({ cast, placements = [] } = {}) {
  const casts = Array.isArray(cast) ? cast : [cast];
  if (!casts.length || casts.some((item) => !item?.group?.isObject3D)) throw new Error('Resident motion requires a loaded character cast.');
  const wrappers = new Map(), owners = new Map();
  for (const item of casts) for (const character of item.group.children) {
    if (!character.userData.characterId) continue;
    wrappers.set(character.userData.characterId, character);
    owners.set(character.userData.characterId, item);
  }
  const records = placements.map((placement) => ({ ...placement, position: [...placement.position], feet: [...placement.position], yaw: placement.yaw ?? 0 }));
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const states = RESIDENT_ROUTE_IDS.filter((id) => wrappers.has(id) && recordsById.has(id)).map((id) => {
    const character = wrappers.get(id), placement = placements.find((candidate) => candidate.id === id);
    return { id, character, placement, owner: owners.get(id), time: 0, rate: 1, near: false, yaw: isDog(id) ? sampleResidentRoute(id, 0).yaw : character.rotation.y, turnVelocity: 0, gaitWeight: 0, gaitTime: 0, clipKey: null, pose: null, gait: isDog(id) ? prepareDogGait(character, id === 'nova') : null };
  });
  let previousTime = 0, disposed = false;

  function setAnimation(state, role, standing, grounded, playbackSpeed = 1) {
    const configured = state.placement.motionClips?.[role] ?? (role === 'land' ? state.placement.motionClips?.fly : null);
    if (!configured || !state.owner.setAnimation) return;
    const choice = typeof configured === 'string' ? { clip: configured } : configured;
    const paused = choice.paused ?? (standing && !state.placement.motionClips?.idle);
    const speed = Math.round((choice.speed ?? 1) * playbackSpeed * 20) / 20;
    const key = `${choice.clip}:${Boolean(paused)}:${grounded}:${speed}`;
    if (key === state.clipKey) return;
    if (state.owner.setAnimation(state.id, choice.clip, { ...choice, speed, paused, groundSupport: grounded, fadeDuration: .24 }) !== false) state.clipKey = key;
  }

  function update(elapsedSeconds, { playerPosition = null, activeCharacterId = null, paused = false, overrides = {} } = {}) {
    if (disposed) return records;
    const time = safeTime(elapsedSeconds), backwards = time < previousTime;
    const delta = backwards ? 0 : time - previousTime;
    const player = pointArray(playerPosition);
    for (const state of states) {
      const dog = isDog(state.id), dt = dog ? Math.min(delta, .25) : delta;
      if (backwards) { state.time = time; state.rate = 1; state.near = false; state.turnVelocity = 0; state.gaitTime = 0; state.gaitWeight = 0; if (dog) state.yaw = sampleResidentRoute(state.id, time).yaw; }
      const override = overrides[state.id];
      if (override) {
        state.character.position.fromArray(override.position); state.character.rotation.y = override.yaw;
        state.yaw = override.yaw; state.rate = 0; state.near = false;
        setAnimation(state, override.clipRole, !override.moving, override.grounded);
        const record = recordsById.get(state.id);
        record.position.splice(0, 3, ...override.position); record.feet.splice(0, 3, ...override.position); record.yaw = override.yaw;
        state.pose = { ...override, routeTime: state.time, rate: 0, paused: !override.moving, standing: !override.moving, procedural: null };
        continue;
      }
      const routeOptions = state.id === 'mailman' ? { position: state.placement.position } : {};
      const before = sampleResidentRoute(state.id, state.time, routeOptions);
      const active = activeCharacterId === state.id;
      const approachable = before.grounded && (state.id !== 'mailman' || !before.moving);
      if (player?.every(Number.isFinite) && approachable) {
        const distance = Math.hypot(player[0] - before.position[0], player[2] - before.position[2]);
        const level = Math.abs(player[1] - before.position[1]) < 2;
        state.near = level && distance < (state.near ? 4.4 : 3.5);
      } else state.near = false;
      const shouldStop = active || paused || state.near;
      const nextRate = active || paused ? 0 : state.rate + ((shouldStop ? 0 : 1) - state.rate) * (1 - Math.exp(-dt * 5));
      state.time += dt * (active || paused ? 0 : (state.rate + nextRate) * .5);
      state.rate = nextRate < .0001 ? 0 : nextRate;
      const pose = sampleResidentRoute(state.id, state.time, routeOptions);
      let standing = active || paused || (state.near && state.rate < .12) || !pose.moving;
      // A nearby dog stops along its route rather than pirouetting to face the
      // player. Memorial/UI interaction does not change its locomotion target.
      const targetYaw = state.near && player && !active && !dog ? heading(pose.position, player) : pose.yaw;
      if (!active && !paused) {
        if (dog) { const turn = advanceDogHeading(state.yaw, state.turnVelocity, targetYaw, dt); state.yaw = turn.yaw; state.turnVelocity = turn.velocity; }
        else state.yaw = mixAngle(state.yaw, targetYaw, 1 - Math.exp(-dt * 7));
      } else state.turnVelocity = 0;
      const groundDistance = Math.hypot(pose.position[0] - state.character.position.x, pose.position[2] - state.character.position.z);
      const groundSpeed = delta > 0 ? groundDistance / delta : 0;
      let playbackSpeed = 1, procedural = null;
      if (dog) {
        const turning = Math.abs(state.turnVelocity) > .005;
        const turnWeight = turning ? clamp(Math.abs(state.turnVelocity) / DOG_TURN_RATE, .12, .75) : 0;
        const targetWeight = active || paused ? 0 : Math.max(clamp(groundSpeed / .7), turnWeight);
        state.gaitWeight += (targetWeight - state.gaitWeight) * (1 - Math.exp(-dt * 10));
        state.gaitTime += groundDistance / .56 + (turning ? Math.abs(state.turnVelocity) * dt * .65 : 0);
        const stepping = !active && !paused && (turning || groundSpeed > .015 || state.gaitWeight > .025);
        standing = !stepping;
        playbackSpeed = stepping ? clamp((groundSpeed + turnWeight * .3) / .75, .15, 1.35) : 1;
        procedural = sampleNovaGait(state.gaitTime, state.gaitWeight);
      }
      setAnimation(state, standing ? 'idle' : dog ? 'walk' : pose.clipRole, standing, pose.grounded, playbackSpeed);
      state.character.position.fromArray(pose.position);
      state.character.rotation.y = state.yaw;
      if (state.gait) {
        state.gait.apply(procedural, time, standing);
        if (state.id === 'nova') state.character.position.y += procedural.bodyBob;
      }
      const record = recordsById.get(state.id);
      const feet = state.character.position.toArray();
      record.position.splice(0, 3, ...feet); record.feet.splice(0, 3, ...feet); record.yaw = state.yaw;
      state.pose = { ...pose, position: feet, yaw: state.yaw, routeTime: state.time, rate: state.rate, paused: shouldStop, standing, procedural, ...(dog ? { groundSpeed, turnVelocity: state.turnVelocity, gaitWeight: state.gaitWeight, animationSpeed: playbackSpeed } : {}) };
    }
    previousTime = time;
    return records;
  }

  update(0);
  return {
    update,
    getInteractionRecords: () => records,
    resetRoute(id, time = 0) { const state = states.find(state => state.id === id); if (state) { state.time = time; state.rate = 1; state.near = false; state.clipKey = null; } },
    sample: () => states.map((state) => ({ id: state.id, ...state.pose })),
    stats: Object.freeze({ movingResidents: states.length, proceduralPawBones: states.find((state) => state.id === 'nova')?.gait?.channels.length ?? 0, raycastsPerFrame: 0 }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const state of states) state.gait?.restore();
    },
  };
}
