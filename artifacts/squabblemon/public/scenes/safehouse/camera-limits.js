// Interior faces of the authored room, including its extended front section.
export const ROOM_INTERIOR = Object.freeze({
  minX: -4.41, maxX: 4.41,
  minY: -.035, maxY: 4.59,
  minZ: -4.91, maxZ: 17,
});

// Keep the eye and near clipping plane clear of the plaster, trim and roof.
export const CAMERA_CLEARANCE = .3;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function clampCameraOrbit(orbit, maxRadius = 17) {
  orbit.yaw = clamp(orbit.yaw, -Math.PI / 2, Math.PI / 2);
  orbit.pitch = clamp(orbit.pitch, .06, 1.2);
  orbit.radius = clamp(orbit.radius, 1.1, maxRadius);
  return orbit;
}

export function positionRoomCamera(orbit, position, contain = true) {
  const { yaw, pitch, radius, target } = orbit;
  const horizontal = Math.cos(pitch) * radius;
  position.x = target.x + Math.sin(yaw) * horizontal;
  position.y = target.y + Math.sin(pitch) * radius;
  position.z = target.z + Math.cos(yaw) * horizontal;
  // Portrait screens keep their elevated overview and open roof for visibility.
  if (!contain) return position;
  // Clamp world space after easing: presets and the whole transition between
  // them must stay inside too. Sliding along a wall preserves the 180° sweep.
  position.x = clamp(position.x, ROOM_INTERIOR.minX + CAMERA_CLEARANCE, ROOM_INTERIOR.maxX - CAMERA_CLEARANCE);
  position.y = clamp(position.y, ROOM_INTERIOR.minY + CAMERA_CLEARANCE, ROOM_INTERIOR.maxY - CAMERA_CLEARANCE);
  position.z = clamp(position.z, ROOM_INTERIOR.minZ + CAMERA_CLEARANCE, ROOM_INTERIOR.maxZ - CAMERA_CLEARANCE);
  return position;
}
