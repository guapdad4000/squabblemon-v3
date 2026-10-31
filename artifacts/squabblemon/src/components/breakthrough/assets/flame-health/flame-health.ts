// Generated from the supplied 121-frame GIF; timing is preserved at 40 ms/frame.
export const FLAME_HEALTH = {
  "full": {
    "durationMs": 1120,
    "frames": 28,
    "className": "bt-flame-full",
    "loop": true
  },
  "hitOne": {
    "durationMs": 1440,
    "frames": 36,
    "className": "bt-flame-hit-one",
    "loop": false
  },
  "half": {
    "durationMs": 680,
    "frames": 17,
    "className": "bt-flame-half",
    "loop": true
  },
  "hitTwo": {
    "durationMs": 1040,
    "frames": 26,
    "className": "bt-flame-hit-two",
    "loop": false
  },
  "empty": {
    "durationMs": 560,
    "frames": 14,
    "className": "bt-flame-empty",
    "loop": true
  }
} as const;
export type FlameHealthState = keyof typeof FLAME_HEALTH;
// Normalized SM-circle geometry, measured on the shared source canvas.
export const FLAME_HEALTH_GEOMETRY = {
  "cellWidth": 384,
  "cellHeight": 150,
  "sourceWidth": 760,
  "sourceHeight": 296,
  "avatarCenterX": 0.11447368,
  "avatarCenterY": 0.52364865,
  "avatarDiameterByWidth": 0.14473684
} as const;
