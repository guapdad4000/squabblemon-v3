import { useEffect, useRef, useState } from 'react';
import { createChromaRenderer } from '../lib/chromaRenderer';
import { observePlayback } from '../lib/battleMediaPlayback';

type KeyMode = 'green' | 'light';

export function keyFrame(data: Uint8ClampedArray, mode: KeyMode) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let alpha: number;

    if (mode === 'green') {
      const dominance = g - Math.max(r, b);
      alpha = 1 - Math.max(0, Math.min(1, (dominance - 16) / 52));
      if (alpha > 0) data[i + 1] = Math.min(g, Math.max(r, b) + 10);
    } else {
      // The dust clip is painted over a pale paper field rather than carrying
      // an alpha channel. Preserve its ink and shadows while removing that field.
      const luminance = r * .299 + g * .587 + b * .114;
      alpha = Math.max(0, Math.min(1, (232 - luminance) / 82));
    }

    data[i + 3] = Math.round(data[i + 3] * alpha);
  }
}

export function KeyedVideo({
  src,
  mode,
  className,
  loop = false,
  maxWidth = 480,
  paused = false,
  onEnded,
}: {
  src: string;
  mode: KeyMode;
  className: string;
  loop?: boolean;
  maxWidth?: number;
  paused?: boolean;
  onEnded?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useGpu, setUseGpu] = useState(true);
  const onEndedRef = useRef(onEnded);
  const pausedRef = useRef(paused);
  const refreshPlayback = useRef<(() => void) | null>(null);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    pausedRef.current = paused;
    refreshPlayback.current?.();
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: ReturnType<typeof createChromaRenderer>;
    try { renderer = createChromaRenderer(canvas, mode, pixels => keyFrame(pixels, mode), useGpu); }
    catch { setUseGpu(false); return; }
    if (!renderer) return;
    canvas.dataset.renderer = renderer.kind;
    const contextLost = (event: Event) => { event.preventDefault(); setUseGpu(false); };
    canvas.addEventListener('webglcontextlost', contextLost);

    const video = document.createElement('video');
    let stopped = false;
    let frameHandle = 0;
    let fallbackHandle = 0;
    let allowed = false;
    let lastMediaTime = -1;
    let lastVideoFrames = -1;
    let playPending = false;
    let playbackEpoch = 0;
    let resizeObserver: ResizeObserver | undefined;
    const finish = () => {
      if (stopped) return;
      stopped = true;
      cancelDraw();
      video.pause();
      onEndedRef.current?.();
    };
    const sizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = bounds.height > 0 ? bounds.width / bounds.height : 1;
      const width = Math.max(1, Math.min(maxWidth, Math.round(bounds.width || maxWidth)));
      const height = Math.max(1, Math.round(width / ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        lastMediaTime = -1;
        lastVideoFrames = -1;
        draw();
      }
    };
    const draw = () => {
      if (stopped || document.hidden || video.readyState < 2 || video.seeking || video.currentTime === lastMediaTime) return;
      const decodedFrames = video.getVideoPlaybackQuality?.().totalVideoFrames ?? 0;
      // The RAF fallback may tick faster than the source video. Upload each
      // decoded frame once, while retaining currentTime fallback on older engines.
      if (decodedFrames > 0 && decodedFrames === lastVideoFrames) return;
      try {
        const sourceRatio = video.videoWidth / video.videoHeight;
        const targetRatio = canvas.width / canvas.height;
        let sx = 0;
        let sy = 0;
        let sw = video.videoWidth;
        let sh = video.videoHeight;
        if (sourceRatio > targetRatio) {
          sw = video.videoHeight * targetRatio;
          sx = (video.videoWidth - sw) / 2;
        } else {
          sh = video.videoWidth / targetRatio;
          sy = (video.videoHeight - sh) / 2;
        }
        renderer.draw(video, [sx / video.videoWidth, sy / video.videoHeight, sw / video.videoWidth, sh / video.videoHeight]);
        lastMediaTime = video.currentTime;
        lastVideoFrames = decodedFrames;
        canvas.dataset.ready = 'true';
      } catch {
        finish();
      }
    };
    const cancelDraw = () => {
      if (frameHandle) video.cancelVideoFrameCallback?.(frameHandle);
      cancelAnimationFrame(fallbackHandle);
      frameHandle = fallbackHandle = 0;
    };
    const schedule = () => {
      if (stopped || !allowed || pausedRef.current || video.paused || frameHandle || fallbackHandle) return;
      if (typeof video.requestVideoFrameCallback === 'function') {
        frameHandle = video.requestVideoFrameCallback(() => {
          frameHandle = 0;
          draw();
          schedule();
        });
      } else {
        fallbackHandle = requestAnimationFrame(() => {
          fallbackHandle = 0;
          draw();
          schedule();
        });
      }
    };
    const refresh = () => {
      if (stopped) return;
      // A hidden resize clears the canvas; restore its still frame on return
      // even when the user keeps playback paused or reduced.
      draw();
      if (!allowed || pausedRef.current) {
        playbackEpoch++;
        cancelDraw();
        video.pause();
        return;
      }
      if (video.readyState < 2 || playPending || video.ended && !loop) return;
      if (!video.paused) { schedule(); return; }
      playPending = true;
      const requestedEpoch = playbackEpoch;
      void video.play().then(() => {
        playPending = false;
        // A pause can abort play before a quick resume. Reconcile stale promises
        // with the latest visibility/prop state instead of ending the renderer.
        if (stopped) { video.pause(); return; }
        if (requestedEpoch !== playbackEpoch) { refresh(); return; }
        if (!allowed || pausedRef.current) { video.pause(); return; }
        schedule();
      }, () => {
        playPending = false;
        if (stopped) return;
        if (requestedEpoch !== playbackEpoch) { refresh(); return; }
        if (allowed && !pausedRef.current) finish();
      });
    };
    refreshPlayback.current = refresh;

    sizeCanvas();
    resizeObserver = new ResizeObserver(sizeCanvas);
    resizeObserver.observe(canvas);
    canvas.addEventListener('ended', finish);
    canvas.addEventListener('error', finish);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = loop;
    video.onloadeddata = () => {
      if (stopped) return;
      // Keep the original first frame when motion is paused or reduced.
      draw();
      refresh();
    };
    video.onended = finish;
    video.onerror = finish;
    video.src = src;
    const stopPlayback = observePlayback(canvas, moving => { allowed = moving; refresh(); });

    return () => {
      stopped = true;
      stopPlayback();
      refreshPlayback.current = null;
      resizeObserver?.disconnect();
      canvas.removeEventListener('ended', finish);
      canvas.removeEventListener('error', finish);
      cancelDraw();
      video.onloadeddata = null; video.onended = null; video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
      canvas.removeEventListener('webglcontextlost', contextLost);
      renderer.dispose();
    };
  }, [loop, maxWidth, mode, src, useGpu]);

  return <canvas key={useGpu ? 'gpu' : 'cpu'} ref={canvasRef} className={className} data-source={src} data-ready="false" aria-hidden="true" />;
}
