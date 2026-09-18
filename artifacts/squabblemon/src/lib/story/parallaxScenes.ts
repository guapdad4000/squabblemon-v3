/**
 * Story Mode parallax cinema — director-friendly scene config.
 *
 * Every "scene" in the screenplay can be rendered by the ParallaxCinema
 * component as a stack of 2D layers (skyline, building, character, dialog
 * box) instead of a single mp4. This is the cheat the user asked for: we
 * can ship drama without a full animation pipeline by giving a director
 * one PNG per layer plus a few "camera path" steps, and letting the runtime
 * translate those into a real-time 2D scene.
 *
 * The shape is intentionally narrow:
 *  - layers: ordered back-to-front, each with its own parallax factor
 *  - cameraPath: x/y/zoom waypoints with timing in ms
 *  - dialogCues: when to advance the dialogue, plays which sound hook
 *  - lighting: a mood that selects tint + grain
 *
 * The screenplays in `scripts/story/*.script.md` will reference scene ids
 * from this file so the director (or a future content tool) can hand off
 * assets against a stable id.
 */
import { VENUE_BY_ID, type StoryVenueEntry } from "@workspace/squabblemon-engine/story";

export type ParallaxMood = "block" | "rooftop" | "alley" | "studio" | "court" | "dusk" | "night";

export type ParallaxLayer = {
  /** Stable id — also the file slug under `public/assets/story/<chapter>/parallax/<scene>/`. */
  readonly id: string;
  /** 0 (locked to background) → 1 (locked to foreground / dialog). */
  readonly depth: number;
  /** Horizontal parallax factor; 0 = static, 1 = moves with the camera. */
  readonly parallaxX: number;
  /** Vertical parallax factor; usually 0 for skyline, 0.4 for midground. */
  readonly parallaxY: number;
  /** Width relative to the camera viewport, used to size the sprite. */
  readonly widthFactor: number;
  /** Where this layer's center is in the scene, in 0..1 normalized coords. */
  readonly anchor: { readonly x: number; readonly y: number };
  /** When true, the runtime may pre-render this layer to a static canvas. */
  readonly cacheable?: boolean;
  /** Optional tint applied to the layer (e.g. dusk haze). */
  readonly tint?: string;
  /** Optional opacity. */
  readonly opacity?: number;
  /** Optional blur (for fog-of-war / focus pulls). */
  readonly blur?: number;
};

export type ParallaxCameraStep = {
  /** 0..1 normalized x in the camera viewport. */
  readonly x: number;
  /** 0..1 normalized y in the camera viewport. */
  readonly y: number;
  /** 1 = no zoom, 1.6 = tight closeup. */
  readonly zoom: number;
  /** Milliseconds to hold this waypoint before easing to the next. */
  readonly holdMs: number;
  /** Easing curve name (matches the `Easing` enum in framer-motion). */
  readonly ease?: "linear" | "easeIn" | "easeOut" | "easeInOut";
};

export type ParallaxDialogCue = {
  /** Token from the StoryDialogueLine, used to advance the dialog overlay. */
  readonly lineToken: string;
  /** When to fire the cue relative to camera path start, in ms. */
  readonly atMs: number;
  /** Optional sound hook id played through the audio bus. */
  readonly soundHook?: string;
  /** Optional focus pull — id of a layer to bring forward, others fade. */
  readonly focusLayerId?: string;
};

export type ParallaxScene = {
  /** Stable id — referenced by the screenplay scripts. */
  readonly id: string;
  /** Display name shown to the writer. */
  readonly name: string;
  /** Venue backdrop id from the engine VENUE_CATALOG. */
  readonly venueId: StoryVenueEntry["id"];
  /** Mood for lighting + grain selection. */
  readonly mood: ParallaxMood;
  /** Layered scene, back-to-front. */
  readonly layers: readonly ParallaxLayer[];
  /** Camera waypoints the director animates through. */
  readonly cameraPath: readonly ParallaxCameraStep[];
  /** Dialog cues that advance the dialog overlay and fire sound hooks. */
  readonly dialogCues: readonly ParallaxDialogCue[];
  /** Total scene duration in ms — used to time the skip button + auto-advance. */
  readonly durationMs: number;
  /** Optional fog or grain overlay strength 0..1. */
  readonly grain?: number;
};

export const PARALLAX_SCENES: readonly ParallaxScene[] = [
  {
    id: "block-party:opening:alley",
    name: "Block Party — Side Alley Opening",
    venueId: "corner-store-court",
    mood: "block",
    layers: [
      { id: "sky", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.4, anchor: { x: 0.5, y: 0.5 }, cacheable: true },
      { id: "storefront", depth: 0.4, parallaxX: 0.4, parallaxY: 0.2, widthFactor: 1.1, anchor: { x: 0.5, y: 0.65 } },
      { id: "lamp-post", depth: 0.7, parallaxX: 0.8, parallaxY: 0.5, widthFactor: 0.4, anchor: { x: 0.15, y: 0.6 } },
      { id: "rival", depth: 0.85, parallaxX: 0.95, parallaxY: 0.6, widthFactor: 0.55, anchor: { x: 0.7, y: 0.62 } },
      { id: "dialog-box", depth: 1, parallaxX: 1, parallaxY: 1, widthFactor: 0.9, anchor: { x: 0.5, y: 0.9 } },
    ],
    cameraPath: [
      { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: "easeInOut" },
      { x: 0.7, y: 0.55, zoom: 1.25, holdMs: 2400, ease: "easeInOut" },
      { x: 0.4, y: 0.6, zoom: 1.1, holdMs: 2200, ease: "easeInOut" },
    ],
    dialogCues: [
      { lineToken: "block-party:pre:0", atMs: 0, soundHook: "story.crowd.ambience" },
      { lineToken: "block-party:pre:1", atMs: 1800, soundHook: "story.crowd.cheer", focusLayerId: "rival" },
      { lineToken: "block-party:pre:2", atMs: 4200, soundHook: "story.footstep" },
    ],
    durationMs: 6400,
    grain: 0.05,
  },
  {
    id: "block-party:red-side:rooftop",
    name: "Red Side Retaliation — Rooftop",
    venueId: "crown-rooftop-court",
    mood: "night",
    layers: [
      { id: "night-sky", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.4, anchor: { x: 0.5, y: 0.4 } },
      { id: "rooftop", depth: 0.5, parallaxX: 0.45, parallaxY: 0.2, widthFactor: 1.1, anchor: { x: 0.5, y: 0.7 } },
      { id: "antenna", depth: 0.8, parallaxX: 0.9, parallaxY: 0.4, widthFactor: 0.45, anchor: { x: 0.78, y: 0.45 } },
      { id: "ganger-red", depth: 0.9, parallaxX: 1, parallaxY: 0.6, widthFactor: 0.55, anchor: { x: 0.62, y: 0.65 } },
      { id: "led-sign", depth: 0.95, parallaxX: 0.6, parallaxY: 0.4, widthFactor: 0.6, anchor: { x: 0.2, y: 0.55 }, tint: "#ff3344", opacity: 0.65 },
      { id: "dialog-box", depth: 1, parallaxX: 1, parallaxY: 1, widthFactor: 0.9, anchor: { x: 0.5, y: 0.9 } },
    ],
    cameraPath: [
      { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 2000, ease: "easeInOut" },
      { x: 0.62, y: 0.55, zoom: 1.4, holdMs: 2600, ease: "easeInOut" },
      { x: 0.5, y: 0.6, zoom: 1.05, holdMs: 2000, ease: "easeInOut" },
    ],
    dialogCues: [
      { lineToken: "red-side:pre:0", atMs: 0, soundHook: "story.wind.rooftop" },
      { lineToken: "red-side:pre:1", atMs: 2000, soundHook: "story.fire.crackle", focusLayerId: "ganger-red" },
      { lineToken: "red-side:pre:2", atMs: 4600, soundHook: "story.bass.drop" },
    ],
    durationMs: 6800,
    grain: 0.08,
  },
  {
    id: "block-party:snitch:corner",
    name: "Snitch At The Corner",
    venueId: "civic-hill-climb",
    mood: "dusk",
    layers: [
      { id: "hill", depth: 0, parallaxX: 0.1, parallaxY: 0, widthFactor: 1.5, anchor: { x: 0.5, y: 0.6 } },
      { id: "city-silhouette", depth: 0.4, parallaxX: 0.3, parallaxY: 0.15, widthFactor: 1.2, anchor: { x: 0.5, y: 0.5 } },
      { id: "guardrail", depth: 0.6, parallaxX: 0.7, parallaxY: 0.4, widthFactor: 1.0, anchor: { x: 0.5, y: 0.78 } },
      { id: "street-lamp", depth: 0.85, parallaxX: 0.95, parallaxY: 0.5, widthFactor: 0.4, anchor: { x: 0.85, y: 0.45 } },
      { id: "snitch", depth: 0.9, parallaxX: 1, parallaxY: 0.6, widthFactor: 0.55, anchor: { x: 0.55, y: 0.62 } },
      { id: "dialog-box", depth: 1, parallaxX: 1, parallaxY: 1, widthFactor: 0.9, anchor: { x: 0.5, y: 0.9 } },
    ],
    cameraPath: [
      { x: 0.5, y: 0.55, zoom: 1.0, holdMs: 1800, ease: "easeInOut" },
      { x: 0.55, y: 0.5, zoom: 1.35, holdMs: 2400, ease: "easeInOut" },
      { x: 0.45, y: 0.6, zoom: 1.0, holdMs: 2200, ease: "easeInOut" },
    ],
    dialogCues: [
      { lineToken: "snitch:pre:0", atMs: 0, soundHook: "story.camera.shutter" },
      { lineToken: "snitch:pre:1", atMs: 1800, soundHook: "story.camera.shutter", focusLayerId: "snitch" },
      { lineToken: "snitch:pre:2", atMs: 4200, soundHook: "story.footstep.run" },
    ],
    durationMs: 6400,
    grain: 0.1,
  },
  {
    id: "block-party:cracked-head:finale",
    name: "Cracked Head Takes The Block",
    venueId: "crown-rooftop-court",
    mood: "rooftop",
    layers: [
      { id: "night-sky", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.4, anchor: { x: 0.5, y: 0.35 } },
      { id: "rooftop", depth: 0.5, parallaxX: 0.4, parallaxY: 0.15, widthFactor: 1.1, anchor: { x: 0.5, y: 0.75 } },
      { id: "antenna", depth: 0.8, parallaxX: 0.85, parallaxY: 0.4, widthFactor: 0.4, anchor: { x: 0.18, y: 0.4 } },
      { id: "cracked-head", depth: 0.95, parallaxX: 1, parallaxY: 0.6, widthFactor: 0.7, anchor: { x: 0.55, y: 0.6 } },
      { id: "crown-glow", depth: 0.92, parallaxX: 1, parallaxY: 0.6, widthFactor: 0.5, anchor: { x: 0.55, y: 0.4 }, tint: "#facc15", opacity: 0.55 },
      { id: "dialog-box", depth: 1, parallaxX: 1, parallaxY: 1, widthFactor: 0.9, anchor: { x: 0.5, y: 0.9 } },
    ],
    cameraPath: [
      { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: "easeInOut" },
      { x: 0.55, y: 0.5, zoom: 1.5, holdMs: 3000, ease: "easeInOut" },
      { x: 0.5, y: 0.55, zoom: 1.15, holdMs: 2200, ease: "easeInOut" },
    ],
    dialogCues: [
      { lineToken: "cracked-head:pre:0", atMs: 0, soundHook: "story.crowd.boo" },
      { lineToken: "cracked-head:pre:1", atMs: 1800, soundHook: "story.bass.drop", focusLayerId: "cracked-head" },
      { lineToken: "cracked-head:pre:2", atMs: 4800, soundHook: "story.crown.shimmer" },
    ],
    durationMs: 7000,
    grain: 0.12,
  },
];

export const PARALLAX_SCENE_BY_ID: Readonly<Record<string, ParallaxScene>> = Object.freeze(
  Object.fromEntries(PARALLAX_SCENES.map((scene) => [scene.id, scene])),
);

export function getParallaxScene(id: string): ParallaxScene | undefined {
  return PARALLAX_SCENE_BY_ID[id];
}

export function getVenueForScene(scene: ParallaxScene): StoryVenueEntry | undefined {
  return VENUE_BY_ID[scene.venueId];
}
