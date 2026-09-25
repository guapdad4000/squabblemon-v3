import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/scenes/shared/three.module.js';
import { clampCameraOrbit, positionRoomCamera, ROOM_INTERIOR, CAMERA_CLEARANCE } from '../public/scenes/safehouse/camera-limits.js';

function assertInside(position, clearance = CAMERA_CLEARANCE) {
  for (const axis of ['x', 'y', 'z']) {
    const suffix = axis.toUpperCase();
    assert.ok(position[axis] >= ROOM_INTERIOR[`min${suffix}`] + clearance - 1e-9, `${axis} below room`);
    assert.ok(position[axis] <= ROOM_INTERIOR[`max${suffix}`] - clearance + 1e-9, `${axis} above room`);
  }
}

test('a full 180 degree sweep remains available and overshoot reverses immediately', () => {
  const orbit = { yaw: -100, pitch: .23, radius: 10.7, target: new T.Vector3(.1, 1.52, -.45) };
  clampCameraOrbit(orbit);
  const left = positionRoomCamera(orbit, new T.Vector3()).sub(orbit.target);
  orbit.yaw = 100;
  clampCameraOrbit(orbit);
  const right = positionRoomCamera(orbit, new T.Vector3()).sub(orbit.target);
  assert.ok(Math.abs(Math.atan2(right.x, right.z) - Math.atan2(left.x, left.z) - Math.PI) < 1e-9);
  orbit.yaw -= .08;
  clampCameraOrbit(orbit);
  assert.ok(orbit.yaw < Math.PI / 2);
});

test('drag, tilt and zoom extremes keep the camera and near plane within the room', () => {
  const targets = [[.1, 1.52, -.45], [4.1, 1.8, -3.6], [-3.8, 1.65, -1.15], [3.95, 1.85, 3.3], [2.5, .78, 3.05]];
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390], [820, 1180]]) {
    const camera = new T.PerspectiveCamera(width / height < .95 ? 57 : 44, width / height, .1, 70);
    camera.setViewOffset(width, height, 0, height * .14, width, height);
    for (const target of targets) for (const yaw of [-100, -Math.PI / 2, -.8, 0, .8, Math.PI / 2, 100]) {
      for (const pitch of [-100, .06, .48, 1.2, 100]) for (const radius of [-100, 1.1, 12.1, 17, 100]) {
        const orbit = clampCameraOrbit({ yaw, pitch, radius, target: new T.Vector3(...target) });
        positionRoomCamera(orbit, camera.position);
        assertInside(camera.position);
        camera.lookAt(orbit.target);
        camera.updateMatrixWorld(true);
        for (const x of [-1, 1]) for (const y of [-1, 1]) assertInside(new T.Vector3(x, y, -1).unproject(camera), 0);
      }
    }
  }
});

test('every frame of a contained camera transition stays below the roof', () => {
  const orbit = { yaw: .03, pitch: .23, radius: 10.7, target: new T.Vector3(.1, 1.52, -.45) };
  const presets = [[-1.5, .12, 6.2, 4.1, 1.8, -3.6], [-.82, .15, 4.6, 3.95, 1.85, 3.3], [.16, .48, 12.1, .15, 1.3, -.15]];
  assertInside(positionRoomCamera(orbit, new T.Vector3()));
  for (const [yaw, pitch, radius, ...target] of presets) {
    for (let frame = 0; frame < 120; frame++) {
      const speed = 1 - Math.exp(-5 / 60);
      orbit.yaw += (yaw - orbit.yaw) * speed;
      orbit.pitch += (pitch - orbit.pitch) * speed;
      orbit.radius += (radius - orbit.radius) * speed;
      orbit.target.lerp(new T.Vector3(...target), speed);
      assertInside(positionRoomCamera(orbit, new T.Vector3()));
    }
  }
});

test('mobile can keep its elevated angle above the open roof', () => {
  const orbit = { yaw: .16, pitch: .48, radius: 12.1, target: new T.Vector3(.15, 1.3, -.15) };
  const position = positionRoomCamera(orbit, new T.Vector3(), false);
  assert.ok(position.y > ROOM_INTERIOR.maxY);
  assert.ok(Math.abs(position.distanceTo(orbit.target) - orbit.radius) < 1e-9);
});

test('zoom can return to the room overview but never go beyond it', () => {
  for (const overview of [10.7, 12.1]) {
    const orbit = { yaw: 0, pitch: .48, radius: 100 };
    clampCameraOrbit(orbit, overview);
    assert.equal(orbit.radius, overview);
    orbit.radius = 2;
    clampCameraOrbit(orbit, overview);
    assert.equal(orbit.radius, 2);
    orbit.radius += .4;
    clampCameraOrbit(orbit, overview);
    assert.equal(orbit.radius, 2.4);
  }
});
