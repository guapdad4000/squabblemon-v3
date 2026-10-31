import { Box3, Ray, Triangle, Vector3 } from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

const UP = new Vector3(0, 1, 0);
const DOWN = new Vector3(0, -1, 0);
const ROAD_MARKING_BATCHES = new Set([
  'AS | 01 Street and fight apron | 06 Diner yellow',
  'AS | 01 Street and fight apron | 12 Off white paint',
]);

// These two authoring batches contain only raised lane/crosswalk paint. Their
// 10–15 mm slabs are visual decals, not bumps in the driving/walking surface.
// GLTFLoader sanitizes mesh names and keeps the original name on a parent when
// a node has several primitives, so check both representations up the hierarchy.
function isRoadMarking(mesh) {
  for (let object = mesh; object; object = object.parent) {
    const name = (object.userData.name ?? object.name).replaceAll('_', ' ');
    if (ROAD_MARKING_BATCHES.has(name)) return true;
  }
  return false;
}

/**
 * Static triangle-world controller. `position` is the avatar's FEET in world
 * coordinates (Y up), not the capsule centre. Call move(direction, metresPerSecond,
 * frameSeconds) every frame, including while idle. Direction is horizontal and may
 * be zero. The returned vectors remain stable references. Rebuild after changing
 * world geometry. Exclude the avatar before calling this factory.
 *
 * Collision uses the actual transformed triangles, including the open garage.
 * Updates use fixed 1/120 s steps; long tab stalls are limited to 0.1 s of motion.
 * Use getRenderPosition(out) for the avatar/camera's interpolated display pose.
 * Options: spawn, radius, height, stepHeight, gravity, bounds (Box3), killY,
 * filterMesh(mesh). Set userData.noCollision on a mesh to exclude decoration.
 *
 * Source contracts: three.js examples/jsm/math/{Octree,Capsule}.js.
 */
export function createPhysics(worldRoot, options = {}) {
  const radius = options.radius ?? 0.32;
  const height = options.height ?? 1.75;
  const stepHeight = options.stepHeight ?? 0.3;
  const gravity = options.gravity ?? 22;
  const fixedStep = 1 / 120;
  const skin = 0.001;
  const walkableY = Math.cos(Math.PI / 4);
  const spawn = (options.spawn ?? new Vector3(0, 0.13, 24.5)).clone();
  const position = spawn.clone();
  const previousPosition = spawn.clone();
  const renderPosition = spawn.clone();
  const velocity = new Vector3();
  const capsule = new Capsule(new Vector3(), new Vector3(), radius);
  const octree = new Octree();
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  let meshCount = 0, triangleCount = 0;

  worldRoot.updateWorldMatrix(true, true);
  worldRoot.traverse((mesh) => {
    if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.userData.noCollision) return;
    if (/sky[ _]accents/i.test(mesh.name)) return;
    if (isRoadMarking(mesh)) return;
    if (options.filterMesh && !options.filterMesh(mesh)) return;
    const geometry = mesh.geometry;
    const attribute = geometry?.attributes.position;
    if (!attribute) return;
    const index = geometry.index;
    const count = index?.count ?? attribute.count;
    const start = Math.max(0, geometry.drawRange.start);
    const end = Math.min(count, start + geometry.drawRange.count);
    meshCount++;
    for (let i = start; i + 2 < end; i += 3) {
      a.fromBufferAttribute(attribute, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(attribute, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(attribute, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
      const triangle = new Triangle(a.clone(), b.clone(), c.clone());
      if (triangle.getArea() > 1e-8) {
        octree.addTriangle(triangle);
        triangleCount++;
      }
    }
  });
  if (!triangleCount) throw new Error('The walkable world contains no collision triangles.');
  octree.build();
  const bounds = options.bounds?.clone() ?? new Box3(
    new Vector3(octree.bounds.min.x - 2, -12, octree.bounds.min.z - 2),
    new Vector3(octree.bounds.max.x + 2, octree.bounds.max.y + 10, octree.bounds.max.z + 2),
  );
  const killY = options.killY ?? Math.min(-8, octree.bounds.min.y - 5);
  const ray = new Ray(new Vector3(), DOWN);
  const offset = new Vector3();
  const moveDirection = new Vector3();
  const displacement = new Vector3();
  const groundNormal = new Vector3();
  const before = capsule.clone();
  const stepCandidate = capsule.clone();
  const triangles = [];
  let grounded = false, accumulator = 0, resetCount = 0, interpolationStep = fixedStep;

  function syncFeet() {
    position.copy(capsule.start);
    position.y -= radius;
  }

  function place(feet) {
    capsule.start.copy(feet).addScaledVector(UP, radius);
    capsule.end.copy(feet).addScaledVector(UP, height - radius);
    position.copy(feet);
  }

  // Resolve individual contacts rather than only an aggregate normal. This keeps
  // a wall/floor corner from being mistaken for a walkable diagonal surface.
  function resolve(body, clipVelocity = false) {
    let floor = false, wall = false, ceiling = false;
    for (let pass = 0; pass < 5; pass++) {
      triangles.length = 0;
      octree.getCapsuleTriangles(body, triangles);
      let corrected = false;
      for (const triangle of triangles) {
        const hit = octree.triangleCapsuleIntersect(body, triangle);
        if (!hit || hit.depth < 1e-7) continue;
        const normal = hit.normal;
        floor ||= normal.y >= walkableY;
        ceiling ||= normal.y < -walkableY;
        wall ||= Math.abs(normal.y) < walkableY;
        body.translate(offset.copy(normal).multiplyScalar(hit.depth + skin));
        if (clipVelocity) {
          const intoSurface = velocity.dot(normal);
          if (intoSurface < 0) velocity.addScaledVector(normal, -intoSurface);
        }
        corrected = true;
      }
      if (!corrected) break;
    }
    return { floor, wall, ceiling };
  }

  // A tiny leading probe lets the rounded capsule climb a curb without needing
  // the user's feet centre to pass through its vertical riser first.
  function support(feet, maxRise, maxDrop, leading) {
    let best = null;
    const samples = leading ? [0, radius * 1.1] : [0];
    for (const distance of samples) {
      ray.origin.copy(feet).addScaledVector(moveDirection, distance);
      ray.origin.y += maxRise + 0.035;
      const hit = octree.rayIntersect(ray);
      if (!hit || hit.triangle.getNormal(groundNormal).y < walkableY) continue;
      const delta = hit.position.y - feet.y;
      if (delta > maxRise + skin || delta < -maxDrop - skin) continue;
      if (!best || hit.position.y > best.y) best = hit.position.clone();
    }
    return best;
  }

  function attemptStep(normalProgress) {
    const feet = before.start.clone().addScaledVector(UP, -radius);
    const ground = support(feet, stepHeight, 0.025, true);
    if (!ground || ground.y - feet.y < 0.015) return false;
    const rise = ground.y - feet.y + skin;
    stepCandidate.copy(before).translate(offset.set(0, rise, 0));
    const raised = resolve(stepCandidate);
    if (raised.ceiling || stepCandidate.start.y < before.start.y + rise - 0.01) return false;
    stepCandidate.translate(offset.set(displacement.x, 0, displacement.z));
    const contacts = resolve(stepCandidate);
    if (contacts.ceiling) return false;
    offset.copy(stepCandidate.start).sub(before.start);
    const stepProgress = offset.dot(moveDirection);
    if (stepProgress <= normalProgress + 0.0001) return false;
    capsule.copy(stepCandidate);
    velocity.y = 0;
    grounded = true;
    return true;
  }

  function substep(dt, targetSpeed) {
    const wasGrounded = grounded;
    // Exponential acceleration keeps direction changes smooth at any render rate.
    const response = 1 - Math.exp(-(grounded ? 22 : 8) * dt);
    velocity.x += (moveDirection.x * targetSpeed - velocity.x) * response;
    velocity.z += (moveDirection.z * targetSpeed - velocity.z) * response;
    velocity.y -= gravity * dt;
    before.copy(capsule);
    displacement.copy(velocity).multiplyScalar(dt);
    capsule.translate(displacement);
    const contacts = resolve(capsule, true);
    grounded = contacts.floor;
    if (contacts.wall && wasGrounded && moveDirection.lengthSq() > 0) {
      const normalProgress = offset.copy(capsule.start).sub(before.start).dot(moveDirection);
      attemptStep(normalProgress);
    }
    syncFeet();
    if (velocity.y <= 0) {
      const floor = support(position, 0.035, wasGrounded ? stepHeight + 0.04 : 0.045,
        wasGrounded && moveDirection.lengthSq() > 0);
      if (floor) {
        const change = floor.y + skin - position.y;
        // Check ceiling/wall contact after snapping; never leave a capsule through
        // geometry solely because a support probe found a higher nearby surface.
        capsule.translate(offset.set(0, change, 0));
        resolve(capsule, true);
        velocity.y = 0;
        grounded = true;
        syncFeet();
      }
    }
    if (!Number.isFinite(position.lengthSq()) || position.y < killY || !bounds.containsPoint(position)) {
      reset();
    }
  }

  function teleport(feet) {
    place(feet);
    velocity.set(0, 0, 0);
    accumulator = 0;
    grounded = false;
    resolve(capsule);
    syncFeet();
    // Clear interpolation history as well as momentum: fast travel and resets
    // must never display a sweep across the entire block from the old location.
    previousPosition.copy(position);
    renderPosition.copy(position);
    return position;
  }

  function reset(feet = spawn) {
    resetCount++;
    return teleport(feet);
  }

  teleport(spawn);
  return {
    position,
    velocity,
    get grounded() { return grounded; },
    get resetCount() { return resetCount; },
    colliders: { octree, capsule, meshCount, triangleCount },
    reset,
    teleport,
    getRenderPosition(out = renderPosition) {
      const alpha = Math.max(0, Math.min(1, accumulator / interpolationStep));
      return out.lerpVectors(previousPosition, position, alpha);
    },
    move(direction, speed, dt) {
      moveDirection.set(direction?.x ?? 0, 0, direction?.z ?? 0);
      if (moveDirection.lengthSq() > 1) moveDirection.normalize();
      const targetSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
      if (!Number.isFinite(dt) || dt <= 0) return position;
      accumulator += Math.min(dt, 0.1);
      // Also bound travel for unusually fast callers. Typical 5 m/s sprint takes
      // 0.042 m per step against a 0.32 m capsule radius.
      const step = Math.min(fixedStep, radius * 0.25 / Math.max(targetSpeed, 1));
      interpolationStep = step;
      while (accumulator + 1e-10 >= step) {
        accumulator -= step;
        previousPosition.copy(position);
        substep(step, targetSpeed);
      }
      return position;
    },
  };
}
