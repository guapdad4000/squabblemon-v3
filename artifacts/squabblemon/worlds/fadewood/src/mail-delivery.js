import { Ray, Vector3 } from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
const smooth = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const heading = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]);
export const MAIL_HOME = Object.freeze([10.1, .261, -8.9]);
export function prepareMailFlight(from, to, { altitude = 8.2, yaw = 0 } = {}) {
  const topFrom = [from[0], Math.max(altitude, from[1]), from[2]], topTo = [to[0], Math.max(altitude, from[1]), to[2]];
  const points = [topFrom, [0, topFrom[1], from[2]], [0, topFrom[1], to[2]], topTo];
  const lengths = [0]; for (let i = 1; i < points.length; i++) lengths.push(lengths.at(-1) + distance(points[i - 1], points[i]));
  const rise = Math.max(.6, distance(from, topFrom) / 5), cruise = Math.max(1.2, lengths.at(-1) / 13), land = Math.max(.8, distance(topTo, to) / 4.5);
  const duration = rise + cruise + land;
  const onPath = progress => {
    const metres = smooth(progress) * lengths.at(-1); let i = 1;
    while (i < lengths.length - 1 && lengths[i] < metres) i++;
    const span = lengths[i] - lengths[i - 1];
    return { position: mix(points[i - 1], points[i], span ? (metres - lengths[i - 1]) / span : 0), yaw: heading(points[i - 1], points[i]) };
  };
  return { from: [...from], to: [...to], points: [[...from], ...points, [...to]], duration, landingAt: rise + cruise,
    sample(elapsed) {
      if (elapsed >= duration) return { id: 'mailman', position: [...to], yaw, phase: 'delivery-waiting', clipRole: 'idle', grounded: true, moving: false, speed: 0 };
      let pose;
      if (elapsed < rise) pose = { position: mix(from, topFrom, smooth(elapsed / rise)), yaw: heading(points[0], points[1]), phase: 'delivery-takeoff' };
      else if (elapsed < rise + cruise) pose = { ...onPath((elapsed - rise) / cruise), phase: 'delivery-flight' };
      else pose = { position: mix(topTo, to, smooth((elapsed - rise - cruise) / land)), yaw, phase: 'delivery-landing' };
      return { id: 'mailman', ...pose, clipRole: pose.phase === 'delivery-landing' ? 'land' : 'fly', grounded: false, moving: true, speed: 1 };
    },
  };
}
/** Planning happens once per new attention or safe retarget, never every frame. */
export function createMailFlightPlanner(octree) {
  const capsule = new Capsule(), ray = new Ray(), down = new Vector3(0, -1, 0);
  function clear(feet) {
    capsule.radius = .34; capsule.start.set(feet[0], feet[1] + .37, feet[2]); capsule.end.set(feet[0], feet[1] + 1.43, feet[2]);
    const hit = octree.capsuleIntersect(capsule);
    return !hit || hit.depth < .018;
  }
  function flight(from, to, yaw) {
    for (const altitude of [8.2, 18.2, 26.2]) {
      const plan = prepareMailFlight(from, to, { altitude, yaw });
      let valid = true;
      for (let i = 1; i < plan.points.length && valid; i++) {
        const steps = Math.max(1, Math.ceil(distance(plan.points[i - 1], plan.points[i]) / .55));
        for (let j = 0; j <= steps; j++) if (!clear(mix(plan.points[i - 1], plan.points[i], j / steps))) { valid = false; break; }
      }
      if (valid) return plan;
    }
    return null;
  }
  return {
    flight, isClear: clear,
    nearPlayer(from, player, records = [], cameraPosition) {
      // Approach from the far side of the player before trying side landings.
      // A fixed +Z landing puts the courier's head directly in the follow lens.
      const awayFromLens = cameraPosition ? Math.atan2(player[0] - cameraPosition[0], player[2] - cameraPosition[2]) : Math.PI;
      const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8];
      for (const radius of [2.8, 3.8, 4.8, 6]) for (const offset of offsets) {
        const angle = awayFromLens + offset * Math.PI / 8, x = player[0] + Math.sin(angle) * radius, z = player[2] + Math.cos(angle) * radius;
        if (Math.abs(x) > 28 || z < -48 || z > 42) continue;
        ray.set(new Vector3(x, player[1] + .65, z), down);
        const floor = octree.rayIntersect(ray);
        if (!floor || floor.distance > 1.3) continue;
        const candidate = [x, floor.position.y + .031, z];
        if (Math.abs(candidate[1] - player[1]) > .65 || !clear(candidate)) continue;
        if (records.some(record => record.id !== 'mailman' && distance(record.feet ?? record.position, candidate) < 1.4)) continue;
        const plan = flight(from, candidate, heading(candidate, player));
        if (plan) return plan;
      }
      return null;
    },
  };
}
/** One pending batch, one visit. Attention is presentation, never a mail claim. */
export function createMailDeliveryController({ planner, handled = [], onHandled = () => {}, onHome = () => {} } = {}) {
  const seen = new Set(handled.slice(-32));
  let disposed = false, attention = null, visit = null, deferred = false, retryIn = 0, lastPlanX = NaN, lastPlanZ = NaN;
  const remember = id => { if (!id || seen.has(id)) return; seen.add(id); if (seen.size > 32) seen.delete(seen.values().next().value); onHandled([...seen]); };
  const waitingPose = (position, yaw = 0) => ({ id: 'mailman', position: [...position], yaw, phase: 'delivery-waiting', clipRole: 'idle', grounded: true, moving: false, speed: 0 });
  const canPlan = player => {
    if (retryIn > 0 && (player[0] - lastPlanX) ** 2 + (player[2] - lastPlanZ) ** 2 >= 4) retryIn = 0;
    return retryIn <= 0;
  };
  const planned = (plan, player) => { lastPlanX = player[0]; lastPlanZ = player[2]; retryIn = plan ? 0 : 1; return plan; };
  function acknowledge() {
    if (disposed) return;
    if (visit && !visit.acknowledged) retryIn = 0;
    if (attention?.id) remember(attention.id);
    if (visit) { visit.acknowledged = true; for (const id of visit.ids) remember(id); }
  }
  return {
    get active() { return visit !== null; }, get state() { return visit ? { phase: visit.pose.phase, attentionId: attention?.id, position: visit.pose.position } : null; },
    setAttention(mail = {}) {
      if (disposed) return;
      const next = mail.attentionId && (mail.unread || mail.gifts) ? { id: mail.attentionId } : null;
      if (next?.id !== attention?.id) retryIn = 0;
      attention = next;
      if (visit && attention) visit.ids.add(attention.id);
      if (mail.opened || !attention) acknowledge();
    },
    acknowledge,
    update(delta, { safe, player, mailman, records = [], cameraPosition } = {}) {
      if (disposed) return null;
      if (!safe) { if (visit?.stage === 'flight') deferred = true; return visit?.pose ?? null; }
      retryIn = Math.max(0, retryIn - Math.max(0, Number.isFinite(delta) ? delta : 0));
      if (visit) {
        if (visit.stage === 'waiting') {
          if (!visit.acknowledged && attention) return visit.pose;
          if (!canPlan(player)) return visit.pose;
          const plan = planned(planner.flight(visit.pose.position, MAIL_HOME, -1.9), player);
          if (!plan) return visit.pose;
          visit.plan = plan; visit.elapsed = 0; visit.stage = 'return';
        } else if (visit.stage === 'flight' && (deferred || (visit.elapsed >= visit.plan.landingAt && Math.hypot(player[0] - visit.plan.to[0], player[2] - visit.plan.to[2]) < 2.3))) {
          if (!canPlan(player)) return visit.pose;
          const plan = planned(planner.nearPlayer(visit.pose.position, player, records, cameraPosition), player);
          if (!plan) return visit.pose;
          visit.plan = plan; visit.elapsed = 0; deferred = false;
        }
        visit.elapsed += Math.max(0, Number.isFinite(delta) ? delta : 0);
        visit.pose = visit.plan.sample(visit.elapsed);
        if (visit.elapsed >= visit.plan.duration) {
          if (visit.stage === 'return') { visit = null; onHome(); return null; }
          visit.stage = 'waiting';
        }
        return visit.pose;
      }
      if (!attention || seen.has(attention.id) || !mailman || !canPlan(player)) return null;
      const feet = [...(mailman.feet ?? mailman.position)];
      const betweenLensAndPlayer = Boolean(cameraPosition && ((feet[0] - player[0]) * (cameraPosition[0] - player[0]) + (feet[2] - player[2]) * (cameraPosition[2] - player[2]) > 0));
      if (!betweenLensAndPlayer && Math.abs(feet[1] - player[1]) < .7 && Math.hypot(feet[0] - player[0], feet[2] - player[2]) < 3.5) {
        visit = { stage: 'waiting', pose: waitingPose(feet, heading(feet, player)), ids: new Set([attention.id]), acknowledged: false };
        return visit.pose;
      }
      const plan = planned(planner.nearPlayer(feet, player, records, cameraPosition), player);
      if (!plan) return null;
      visit = { stage: 'flight', plan, elapsed: 0, pose: plan.sample(0), ids: new Set([attention.id]), acknowledged: false };
      deferred = false; return visit.pose;
    },
    dispose() { disposed = true; visit = null; attention = null; deferred = false; retryIn = 0; },
  };
}
