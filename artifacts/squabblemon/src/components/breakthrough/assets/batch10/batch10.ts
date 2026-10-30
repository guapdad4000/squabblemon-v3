// All supplied frames preserved; fire alone is retimed to 650 ms.
export const BATCH10_FX = {
  "lock": {
    "durationMs": 2920,
    "sourceDurationMs": 2920,
    "frames": 73,
    "width": 140,
    "height": 256,
    "className": "bt-b10-lock",
    "loop": true,
    "stillFrame": 36,
    "src": new URL("./lock-atlas.webp", import.meta.url).href
  },
  "loss": {
    "durationMs": 2920,
    "sourceDurationMs": 2920,
    "frames": 73,
    "width": 157,
    "height": 256,
    "className": "bt-b10-loss",
    "loop": false,
    "stillFrame": 36,
    "src": new URL("./loss-atlas.webp", import.meta.url).href
  },
  "fire": {
    "durationMs": 650,
    "sourceDurationMs": 2920,
    "frames": 73,
    "width": 512,
    "height": 283,
    "className": "bt-b10-fire",
    "loop": false,
    "stillFrame": 72,
    "src": new URL("./fire-atlas.webp", import.meta.url).href
  }
} as const;
export type Batch10FxName = keyof typeof BATCH10_FX;
