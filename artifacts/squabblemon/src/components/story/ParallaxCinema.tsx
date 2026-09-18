/**
 * ParallaxCinema — the 2D layered scene renderer the user asked for.
 *
 * Director hands off a `ParallaxScene` (defined in `lib/story/parallaxScenes.ts`)
 * with a stack of 2D layers, a camera waypoint path, and dialog cues. The
 * component runs the camera path with framer-motion, slides each layer
 * independently based on its parallax factor, and ticks the dialog overlay
 * against the cue list. The director never has to ship a rendered mp4 —
 * a handful of PNG layers and a camera path can deliver the same drama.
 *
 * When no parallax scene is provided, the component falls back to the
 * existing mp4+webp cinematic (legacy chapters), so old chapters keep
 * working without rewrites.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { getAssetUrl } from '../../data';
import {
  getParallaxScene,
  getVenueForScene,
  type ParallaxScene,
  type ParallaxDialogCue,
} from '../../lib/story/parallaxScenes';
import type { StoryDialogueLine } from '@workspace/squabblemon-engine/story';

export interface ParallaxCinemaProps {
  /** Stable scene id from PARALLAX_SCENES, e.g. "block-party:opening:alley". */
  sceneId?: string;
  /** Optional inline scene override (used by tooling that generates scenes). */
  scene?: ParallaxScene;
  /** Dialog lines to render in the overlay. Cues map into this list by index. */
  lines?: readonly StoryDialogueLine[];
  /** When the scene finishes (camera path complete + final cue fired). */
  onComplete?: () => void;
  /** When the player taps skip. */
  onSkip?: () => void;
  /** Fallback mp4 path when no scene is provided. */
  fallbackSource?: string;
  /** Fallback webp poster when no scene is provided. */
  fallbackPoster?: string;
  /** Optional chapter title shown under the dialog. */
  title?: string;
  /** Optional eyebrow line (chapter / scene number). */
  eyebrow?: string;
}

export function ParallaxCinema({
  sceneId,
  scene: sceneProp,
  lines,
  onComplete,
  onSkip,
  fallbackSource,
  fallbackPoster,
  title,
  eyebrow,
}: ParallaxCinemaProps) {
  const reducedMotion = useReducedMotion();
  const scene = useMemo(() => sceneProp ?? (sceneId ? getParallaxScene(sceneId) : undefined), [
    sceneProp,
    sceneId,
  ]);
  const venue = useMemo(() => (scene ? getVenueForScene(scene) : undefined), [scene]);

  if (!scene) {
    return (
      <FallbackCinema
        source={fallbackSource}
        poster={fallbackPoster}
        title={title}
        eyebrow={eyebrow}
        onComplete={onComplete}
        onSkip={onSkip}
      />
    );
  }

  return (
    <ParallaxSceneRunner
      scene={scene}
      venueBackdrop={venue?.backdropAssetId}
      lines={lines ?? []}
      reducedMotion={!!reducedMotion}
      onComplete={onComplete}
      onSkip={onSkip}
      title={title}
      eyebrow={eyebrow}
    />
  );
}

function ParallaxSceneRunner({
  scene,
  venueBackdrop,
  lines,
  reducedMotion,
  onComplete,
  onSkip,
  title,
  eyebrow,
}: {
  scene: ParallaxScene;
  venueBackdrop?: string;
  lines: readonly StoryDialogueLine[];
  reducedMotion: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  title?: string;
  eyebrow?: string;
}) {
  const [activeCueIndex, setActiveCueIndex] = useState(0);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const cueTimers = useRef<number[]>([]);
  const cameraTimers = useRef<number[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Schedule camera waypoint transitions and dialog cues.
  useEffect(() => {
    cueTimers.current.forEach((id) => window.clearTimeout(id));
    cameraTimers.current.forEach((id) => window.clearTimeout(id));
    cueTimers.current = [];
    cameraTimers.current = [];
    setHasStarted(true);
    setActiveCueIndex(0);
    setCameraIndex(0);
    if (reducedMotion) {
      // Skip the camera animation but still surface the last cue.
      const last = scene.cameraPath.length - 1;
      setCameraIndex(last);
      const lastCue = scene.dialogCues.length - 1;
      if (lastCue >= 0) setActiveCueIndex(lastCue);
      const id = window.setTimeout(() => onCompleteRef.current?.(), 600);
      cueTimers.current.push(id);
      return () => {
        cueTimers.current.forEach((tid) => window.clearTimeout(tid));
        cameraTimers.current.forEach((tid) => window.clearTimeout(tid));
      };
    }
    let cameraAcc = 0;
    scene.cameraPath.forEach((step, index) => {
      if (index === 0) return;
      const id = window.setTimeout(() => setCameraIndex(index), cameraAcc);
      cameraTimers.current.push(id);
      cameraAcc += step.holdMs;
    });
    scene.dialogCues.forEach((cue, index) => {
      const id = window.setTimeout(() => setActiveCueIndex(index), cue.atMs);
      cueTimers.current.push(id);
    });
    const completeId = window.setTimeout(
      () => onCompleteRef.current?.(),
      scene.durationMs,
    );
    cueTimers.current.push(completeId);
    return () => {
      cueTimers.current.forEach((id) => window.clearTimeout(id));
      cameraTimers.current.forEach((id) => window.clearTimeout(id));
    };
  }, [scene, reducedMotion]);

  const cameraStep = scene.cameraPath[cameraIndex] ?? scene.cameraPath[0];
  const activeCue: ParallaxDialogCue | undefined = scene.dialogCues[activeCueIndex];
  const lineToken = activeCue?.lineToken;
  const activeLine = lines.find((line) => `${scene.id}:${lineToken?.split(':').pop()}` === lineToken)
    ?? lines[activeCueIndex]
    ?? lines[0];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end overflow-hidden bg-black text-white"
      data-testid={`parallax-cinema-${scene.id}`}
    >
      {/* Parallax stage — back to front. */}
      <div
        className="absolute inset-0"
        style={{
          background: venueBackdrop ? `url(${getAssetUrl(venueBackdrop)}) center/cover no-repeat` : 'black',
          filter: scene.mood === 'night' ? 'brightness(0.6) saturate(1.1)' : undefined,
        }}
        aria-hidden
      />
      <motion.div
        className="absolute inset-0"
        animate={{
          scale: cameraStep.zoom,
          x: `${(cameraStep.x - 0.5) * -8}%`,
          y: `${(cameraStep.y - 0.5) * -6}%`,
        }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {scene.layers
          .filter((layer) => layer.id !== 'dialog-box')
          .map((layer) => (
            <ParallaxLayer key={layer.id} layer={layer} cameraStep={cameraStep} scene={scene} />
          ))}
      </motion.div>

      {/* Grain + vignette. */}
      <div className="pointer-events-none absolute inset-0 z-30">
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{ background: `repeating-linear-gradient(0deg, rgba(255,255,255,${(scene.grain ?? 0.06).toFixed(2)}), rgba(0,0,0,0) 1px)`, opacity: 0.6 }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/85" />
      </div>

      {/* Dialog overlay. */}
      <div className="relative z-40 flex h-full flex-col justify-end p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:p-8">
        <AnimatePresence mode="wait">
          {activeLine && (
            <motion.div
              key={activeCue?.lineToken ?? activeCueIndex}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto flex w-full max-w-3xl flex-col gap-3"
            >
              <div className="flex items-end gap-4">
                {activeLine.portraitAssetId && (
                  <img
                    src={getAssetUrl(activeLine.portraitAssetId)}
                    alt={activeLine.speaker}
                    className="h-20 w-20 flex-none rounded-sm border-2 border-primary/70 bg-black object-contain shadow-[0_0_20px_rgba(250,204,21,0.4)] md:h-28 md:w-28"
                    loading="eager"
                  />
                )}
                <div className="min-w-0 flex-1 border-2 border-white/15 bg-black/85 p-3 backdrop-blur-md md:p-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary md:text-xs">
                    {eyebrow ?? activeCue?.focusLayerId ?? 'Squabblemon'}
                  </div>
                  <div className="mt-1 font-display text-lg font-black uppercase italic leading-none md:text-2xl">
                    {activeLine.speaker}
                  </div>
                  <p className="mt-2 text-sm leading-snug text-white/85 md:text-base">
                    {activeLine.text}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mx-auto mt-6 flex w-full max-w-3xl items-center justify-between gap-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
            {title ?? scene.name}
            {hasStarted && (
              <span className="ml-2 text-white/35">
                Cue {Math.min(activeCueIndex + 1, scene.dialogCues.length)} / {scene.dialogCues.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="border border-white/25 bg-black/55 px-5 py-2 font-mono text-[10px] uppercase tracking-widest text-white/75 backdrop-blur-md transition-colors hover:border-white/45 hover:text-white active:scale-95"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function ParallaxLayer({
  layer,
  cameraStep,
  scene,
}: {
  layer: ParallaxScene['layers'][number];
  cameraStep: ParallaxScene['cameraPath'][number];
  scene: ParallaxScene;
}) {
  const offsetX = (cameraStep.x - 0.5) * 60 * (layer.parallaxX - 1);
  const offsetY = (cameraStep.y - 0.5) * 60 * (layer.parallaxY - 1);
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${(layer.anchor.x - 0.5) * 100}%`,
        top: `${(layer.anchor.y - 0.5) * 100}%`,
        width: `${layer.widthFactor * 100}%`,
        transform: `translate(-50%, -50%) translate(${offsetX}%, ${offsetY}%)`,
        filter: layer.tint ? `drop-shadow(0 0 12px ${layer.tint})` : undefined,
        opacity: layer.opacity ?? 1,
        zIndex: Math.round(layer.depth * 100),
      }}
      data-layer={layer.id}
      data-scene={scene.id}
    >
      <ParallaxLayerArt layer={layer} scene={scene} />
    </div>
  );
}

/**
 * Renders the visual for a parallax layer. We use a CSS-painted card as a
 * fallback when the director hasn't yet shipped a PNG for the layer — that
 * way the cinema can be wired into the UI immediately and replaced with
 * real art as it's authored. Real PNGs live under
 * `public/assets/story/<chapter>/parallax/<scene>/<layer-id>.png`.
 */
function ParallaxLayerArt({ layer, scene }: { layer: ParallaxScene['layers'][number]; scene: ParallaxScene }) {
  const slug = `${scene.id}/${layer.id}`;
  return (
    <>
      <img
        src={getAssetUrl(`assets/story/parallax/${slug}.png`)}
        alt=""
        className="block h-auto w-full object-contain"
        loading="eager"
        onError={(event) => {
          // Hide the broken image and let the CSS card carry the silhouette.
          (event.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
      <div
        className="absolute inset-0 -z-10 border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-800 to-black text-center font-mono text-[8px] uppercase tracking-widest text-white/30"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {layer.id}
      </div>
    </>
  );
}

/**
 * Fallback cinema — preserves the original mp4+webp behavior so existing
 * chapters keep working. Used when no parallax scene is provided.
 */
function FallbackCinema({
  source,
  poster,
  title,
  eyebrow,
  onComplete,
  onSkip,
}: {
  source?: string;
  poster?: string;
  title?: string;
  eyebrow?: string;
  onComplete?: () => void;
  onSkip?: () => void;
}) {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  if (!source) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black text-center text-white/60">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end overflow-hidden bg-black text-white">
      <div className="absolute inset-0 z-0 bg-black">
        {!hasError ? (
          <video
            ref={videoRef}
            src={getAssetUrl(source)}
            poster={poster ? getAssetUrl(poster) : undefined}
            autoPlay
            muted
            playsInline
            onCanPlay={() => setIsVideoLoaded(true)}
            onError={() => setHasError(true)}
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          <img
            src={poster ? getAssetUrl(poster) : ''}
            alt=""
            className="h-full w-full object-cover opacity-80"
          />
        )}
        {!isVideoLoaded && !hasError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-black/20 via-transparent to-black/95" />
      </div>
      <div className="relative z-30 flex w-full flex-col items-center gap-4 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
            {eyebrow ?? 'Squabblemon'}
          </div>
          <h1 className="cinematic-callout text-white">{title ?? 'Loading…'}</h1>
        </div>
        <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={() => (onSkip ? onSkip() : onComplete?.())}
            className="w-full border border-white/25 bg-black/40 py-4 font-mono text-[11px] uppercase tracking-widest text-white/75 backdrop-blur-md transition-colors hover:bg-white/10"
          >
            Skip
          </button>
          {onComplete && (
            <button
              type="button"
              onClick={onComplete}
              className="w-full bg-primary py-4 font-display text-lg font-black italic uppercase text-black shadow-[0_0_20px_rgba(250,204,21,0.3)] active:scale-95"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
