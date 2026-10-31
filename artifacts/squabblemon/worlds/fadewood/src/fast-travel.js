import { LANDMARKS } from './landmarks.js';
import { composeArrivalView } from './camera.js';

export const DESTINATIONS = Object.freeze(LANDMARKS.map(({ id, name, note, arrival }) => ({ id, name, note, ...arrival })));

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => { const t = clamp01(value); return t * t * (3 - 2 * t); };
const smoother = (value) => { const t = clamp01(value); return t * t * t * (t * (t * 6 - 15) + 10); };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const length = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const point = (value, fallback = [0, .13, 24.5]) => {
  const result = Array.isArray(value) ? value.slice(0, 3) : value && [value.x, value.y, value.z];
  return result?.length === 3 && result.every(Number.isFinite) ? result : [...fallback];
};

/**
 * A rounded, arc-length sampled route through the open centre of the street.
 * Fillets stay inside their control-point triangle, avoiding spline overshoot
 * into the housing. The long leg is on X=0; only the entrance aprons are crossed.
 * A tangent-following roadway camera eases into the destination's exact authored
 * composition during the final leg. Camera state is sampled, never reset at the
 * teleport/completion callbacks.
 */
export function createTravelRoute(origin, destination, options = {}) {
  const from = point(origin);
  const to = point(destination?.position ?? destination, from);
  const ground = Math.min(from[1], to[1]);
  const raw = length(from, to) < 4 ? [from, to] : [from, [0, ground, from[2]], [0, ground, to[2]], to];
  const waypoints = raw.filter((value, i) => !i || length(value, raw[i - 1]) > .015);
  if (waypoints.length === 1) waypoints.push([...to]);
  const points = [waypoints[0]];
  for (let i = 1; i < waypoints.length - 1; i += 1) {
    const a = waypoints[i - 1], b = waypoints[i], c = waypoints[i + 1];
    const ab = length(a, b), bc = length(b, c);
    const radius = Math.min(3.2, ab * .42, bc * .42);
    const entry = mix(b, a, ab ? radius / ab : 0);
    const exit = mix(b, c, bc ? radius / bc : 0);
    points.push(entry);
    for (let step = 1; step <= 20; step += 1) {
      const t = step / 20;
      points.push(mix(mix(entry, b, t), mix(b, exit, t), t));
    }
  }
  points.push(to);
  const distances = [0];
  for (let i = 1; i < points.length; i += 1) distances.push(distances[i - 1] + length(points[i - 1], points[i]));
  const distance = distances.at(-1);
  const duration = options.duration ?? Math.max(2.8, Math.min(6.2, 1.3 + distance / 18));
  const initialCamera = options.camera ? point(options.camera) : null;
  const initialTarget = options.target ? point(options.target) : null;
  const initialFov = options.fov ?? 58;
  const initialRoll = options.roll ?? 0;
  const authored = Number.isFinite(destination?.yaw) && Number.isFinite(destination?.distance) ? destination : null;
  let arrivalPosition = options.arrivalPosition ? point(options.arrivalPosition, to) : [...to];
  let correctionStart = 0;

  function positionAtDistance(metres) {
    if (distance < .0001) return [...to];
    let i = 1;
    while (i < distances.length - 1 && distances[i] < metres) i += 1;
    const segment = distances[i] - distances[i - 1];
    return mix(points[i - 1], points[i], segment ? clamp01((metres - distances[i - 1]) / segment) : 0);
  }
  function atDistance(metres) {
    const position = positionAtDistance(metres);
    // A few metres of lookahead rounds the view through the street fillets rather
    // than immediately yawing with the cloud on each small polyline segment.
    const a = positionAtDistance(Math.max(0, metres - 3.2));
    const b = positionAtDistance(Math.min(distance, metres + 3.2));
    const norm = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const tangent = norm > .0001 ? [(b[0] - a[0]) / norm, 0, (b[2] - a[2]) / norm] : [0, 0, -1];
    return { position, tangent };
  }

  function sample(progress) {
    const p = clamp01(Number.isFinite(progress) ? progress : 0);
    const pathProgress = smooth((p - .06) / .80);
    const { position, tangent } = atDistance(distance * pathProgress);
    const hover = pathProgress === 0 || pathProgress === 1 ? 0 : Math.sin(pathProgress * Math.PI);
    const cameraGroundY = position[1] + hover * .16;
    // Extended alley arrivals cross parked-car footprints. Lift the comic effect
    // over their actual roofs while retaining the authored camera corridor.
    position[1] += hover * 1.9;
    const target = [position[0] + tangent[0] * .9, position[1] + 1.3, position[2] + tangent[2] * .9];
    // Follow the route several metres behind the cloud. A rotating rigid boom
    // swings rapidly around street corners; a trailing path camera glides through
    // the same turn. A smooth road clamp keeps its shoulder out of the facades.
    const trailMetres = distance * pathProgress - 6.1;
    const trailing = atDistance(Math.max(0, trailMetres));
    if (trailMetres < 0) {
      trailing.position[0] += trailing.tangent[0] * trailMetres;
      trailing.position[2] += trailing.tangent[2] * trailMetres;
    }
    const cruiseCamera = [
      3.8 * Math.tanh((trailing.position[0] + trailing.tangent[2] * 2.2) / 3.8),
      cameraGroundY + 3.65,
      trailing.position[2] - trailing.tangent[0] * 2.2,
    ];
    const release = smoother(p / .18);
    const landing = smoother((p - .69) / .31);
    const groundCorrection = smoother((p - correctionStart) / Math.max(.00001, 1 - correctionStart));
    const grounded = mix(to, arrivalPosition, groundCorrection);
    const finalView = authored ? composeArrivalView(authored, grounded) : null;
    let camera = initialCamera ? mix(initialCamera, cruiseCamera, release) : cruiseCamera;
    let look = initialTarget ? mix(initialTarget, target, release) : target;
    // Banking is driven by the route turn and remains deliberately subtle.
    const ahead = atDistance(Math.min(distance, distance * pathProgress + 3.5)).tangent;
    const turn = Math.atan2(tangent[0] * ahead[2] - tangent[2] * ahead[0], tangent[0] * ahead[0] + tangent[2] * ahead[2]);
    let roll = initialRoll + (Math.max(-.025, Math.min(.025, -turn * .055)) - initialRoll) * release;
    let fov = initialFov + (62 + Math.sin(pathProgress * Math.PI) * 3 - initialFov) * release;
    if (finalView) {
      camera = mix(camera, finalView.camera, landing);
      look = mix(look, finalView.target, landing);
      roll += (finalView.roll - roll) * landing;
      fov += (finalView.fov - fov) * landing;
      if ((authored.arrivalId ?? authored.id) === 'open-garage') {
        // The garage approach skirts the southern park tree rather than cutting
        // the final camera diagonally through its trunk on the way off the road.
        camera[2] -= Math.sin(Math.PI * landing) * 1.8;
      }
      if (distance < 4) {
        const settle = smoother(p);
        camera = initialCamera ? mix(initialCamera, finalView.camera, settle) : finalView.camera;
        look = initialTarget ? mix(initialTarget, finalView.target, settle) : finalView.target;
        roll = initialRoll + (finalView.roll - initialRoll) * settle;
        fov = initialFov + (finalView.fov - initialFov) * settle;
      }
    }
    if (distance >= 4) {
      // The bulletin camera crosses the actual park gateway on release/landing.
      // A local smooth arch clears its lintel without changing other districts.
      const gate = smooth((camera[0]-10)/1) * smooth((14-camera[0])/1)
        * smooth((camera[2]+23.5)/1) * smooth((-18-camera[2])/1);
      camera[1] += 1.0 * gate;
    }
    position[1] += (grounded[1] - to[1]) * smoother((p - .86) / .14);
    const dx = camera[0] - look[0], dy = camera[1] - look[1], dz = camera[2] - look[2];
    return {
      position, camera, target: look, tangent, fov, roll,
      yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), distance: Math.hypot(dx, dy, dz),
      progress: p, pathProgress, landing,
      stage: p < .06 ? 'departing' : p < .69 ? 'travelling' : 'arriving',
    };
  }
  return {
    points, distance, duration, from, to, sample,
    // Physics resolves the actual supporting floor at the arrival callback. Fold
    // its small vertical correction into the remaining dolly, without a cut.
    setArrivalPosition(value, progress = 0) {
      arrivalPosition = point(value, to);
      correctionStart = clamp01(progress);
    },
  };
}

/** One route, one grounded arrival near the end, then a short cloud dissolve. */
export function createTravelSequence({ onArrive = () => {}, onComplete = () => {}, duration, cutAt } = {}) {
  let active = false, elapsed = 0, arrived = false, destination = null, route = null;
  let tripDuration = duration ?? 2.8;
  let tripCut = cutAt ?? tripDuration * .87;
  return {
    get active() { return active; }, get elapsed() { return elapsed; },
    get arrived() { return arrived; }, get destination() { return destination; },
    get duration() { return tripDuration; }, get cutAt() { return tripCut; },
    get route() { return route; },
    sample() { return route?.sample(elapsed / tripDuration) ?? null; },
    start(next, origin, cameraOptions = {}) {
      if (active || !next) return false;
      route = createTravelRoute(origin ?? next.position, next, { ...cameraOptions, duration });
      tripDuration = route.duration;
      tripCut = Math.min(tripDuration, cutAt ?? tripDuration * .87);
      active = true; elapsed = 0; arrived = false; destination = next;
      return true;
    },
    advance(dt) {
      if (!active || !Number.isFinite(dt) || dt <= 0) return;
      elapsed = Math.min(tripDuration, elapsed + dt);
      if (!arrived && elapsed >= tripCut) {
        arrived = true;
        const groundedPosition = onArrive(destination);
        if (groundedPosition) route?.setArrivalPosition(groundedPosition, Math.min(.99, elapsed / tripDuration));
      }
      // onArrive may cancel the trip (focus/visibility changes must stay final).
      if (active && elapsed >= tripDuration) { active = false; onComplete(destination, route.sample(1)); }
    },
    cancel() { active = false; elapsed = 0; arrived = false; destination = null; route = null; },
  };
}
