import { MathUtils, Vector3 } from 'three';

/** Keep the follow camera on the player's side of the first obstruction. */
export function safeArmDistance(desired, hitDistance) {
  if (!Number.isFinite(hitDistance)) return desired;
  return Math.min(desired, Math.max(0.01, hitDistance - 0.18));
}

/** The exact, settled world-space frame used by travel and ordinary follow. */
export function composeArrivalView(preset, playerPosition = preset.position) {
  const p = Array.isArray(playerPosition) ? playerPosition : [playerPosition.x, playerPosition.y, playerPosition.z];
  const yaw = preset.yaw, pitch = preset.pitch, distance = preset.distance;
  const shoulder = preset.shoulder ?? .5;
  const target = [p[0] + Math.cos(yaw) * shoulder, p[1] + (preset.targetHeight ?? 1.3), p[2] - Math.sin(yaw) * shoulder];
  const direction = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  return {
    target, direction, camera: target.map((value, i) => value + direction[i] * distance),
    yaw, pitch, distance, targetHeight: preset.targetHeight ?? 1.3, shoulder,
    roll: preset.roll ?? 0, fov: preset.fov ?? 58,
  };
}

/**
 * Filter the aim point, then place a stable orbit arm around it. Never decide
 * whether to snap by measuring the old camera against a moving player target:
 * that repeatedly resets ordinary follow lag and causes visible shake.
 * Call aim(), cast the obstruction ray using target/direction, then place().
 */
export function createFollowCameraRig() {
  const target = new Vector3();
  const direction = new Vector3();
  const position = new Vector3();
  const desiredTarget = new Vector3();
  let initialized = false, orbitYaw = 0, orbitPitch = 0.24, armLength = 4.8;
  return {
    target, direction, position,
    get yaw() { return orbitYaw; },
    get armLength() { return armLength; },
    aim(playerPosition, yaw, pitch, dt, immediate = false, framing = {}) {
      const shoulder = framing.shoulder ?? 0;
      desiredTarget.copy(playerPosition);
      desiredTarget.y += framing.targetHeight ?? 1.18;
      desiredTarget.x += Math.cos(yaw) * shoulder;
      desiredTarget.z -= Math.sin(yaw) * shoulder;
      if (!initialized || immediate) {
        target.copy(desiredTarget); orbitYaw = yaw; orbitPitch = pitch;
      } else {
        const horizontal = 1 - Math.exp(-24 * dt);
        target.x = MathUtils.lerp(target.x, desiredTarget.x, horizontal);
        target.z = MathUtils.lerp(target.z, desiredTarget.z, horizontal);
        target.y = MathUtils.damp(target.y, desiredTarget.y, 12, dt);
        const angleError = Math.atan2(Math.sin(yaw - orbitYaw), Math.cos(yaw - orbitYaw));
        orbitYaw += angleError * (1 - Math.exp(-20 * dt));
        orbitPitch = MathUtils.damp(orbitPitch, pitch, 20, dt);
      }
      direction.set(Math.sin(orbitYaw) * Math.cos(orbitPitch), Math.sin(orbitPitch), Math.cos(orbitYaw) * Math.cos(orbitPitch));
    },
    place(distance, hitDistance, dt, immediate = false) {
      const safe = safeArmDistance(distance, hitDistance);
      // Only an actual obstruction or inward zoom may shorten the arm instantly.
      // Ordinary player movement does not change the requested arm length.
      if (!initialized || immediate || safe < armLength) armLength = safe;
      else armLength = MathUtils.damp(armLength, safe, 9, dt);
      armLength = Math.min(armLength, safe);
      position.copy(target).addScaledVector(direction, armLength);
      initialized = true;
      return position;
    },
  };
}

/** A short dolly arc into an authored landmark composition; input can end it. */
export function createArrivalShot() {
  let preset = null, elapsed = 0;
  const duration = 2.6;
  return {
    get active() { return preset !== null; },
    get settled() { return preset !== null && elapsed >= duration; },
    start(next, { settled = false } = {}) { preset = next; elapsed = settled ? duration : 0; },
    cancel() { preset = null; elapsed = 0; },
    sample(dt = 0) {
      if (!preset) return null;
      elapsed = Math.min(duration, elapsed + Math.max(0, Number.isFinite(dt) ? dt : 0));
      const t = elapsed / duration;
      const remaining = 1 - t * t * (3 - 2 * t);
      return {
        yaw: preset.yaw + .12 * remaining,
        pitch: preset.pitch + .04 * remaining,
        distance: preset.distance + .7 * remaining,
        targetHeight: preset.targetHeight ?? 1.3,
        shoulder: preset.shoulder ?? .5,
        roll: (preset.roll ?? 0) * (1 + .3 * remaining),
        fov: (preset.fov ?? 58) + 2 * remaining,
      };
    },
  };
}
