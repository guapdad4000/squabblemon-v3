/** Keep a useful horizontal field of view on a tall phone without moving the
 * authored camera through nearby buildings. This is idempotent for travel. */
export function fitViewFov(fov = 58, { width = 1280, height = 720 } = {}) {
  const aspect = width > 0 && height > 0 ? width / height : 16 / 9;
  if (aspect < .85) return Math.max(fov, 80);
  if (aspect < 1.2) return Math.max(fov, 69);
  return fov;
}

export function portraitCharacterLayout({ width = 1280, height = 720 } = {}) {
  return width <= 900 && height > width;
}
