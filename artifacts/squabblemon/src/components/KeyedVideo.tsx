import { useEffect, useRef } from 'react';

type KeyMode = 'green' | 'light';

function keyFrame(data: Uint8ClampedArray, mode: KeyMode) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let alpha: number;

    if (mode === 'green') {
      const dominance = g - Math.max(r, b);
      alpha = 1 - Math.max(0, Math.min(1, (dominance - 28) / 72));
      if (alpha > 0 && alpha < 1) {
        data[i + 1] = Math.round(g * alpha + Math.max(r, b) * (1 - alpha));
      }
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
  onEnded,
}: {
  src: string;
  mode: KeyMode;
  className: string;
  loop?: boolean;
  maxWidth?: number;
  onEnded?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !context) return;

    const video = document.createElement('video');
    let stopped = false;
    let frameHandle = 0;
    let fallbackHandle = 0;
    let resizeObserver: ResizeObserver | undefined;
    const finish = () => {
      if (stopped) return;
      stopped = true;
      onEndedRef.current?.();
    };
    const sizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = bounds.height > 0 ? bounds.width / bounds.height : 1;
      canvas.width = Math.max(1, Math.min(maxWidth, Math.round(bounds.width || maxWidth)));
      canvas.height = Math.max(1, Math.round(canvas.width / ratio));
    };
    const draw = () => {
      if (stopped || video.readyState < 2 || video.seeking) return;
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
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        keyFrame(pixels.data, mode);
        context.putImageData(pixels, 0, 0);
        canvas.dataset.ready = 'true';
      } catch {
        finish();
      }
    };
    const schedule = () => {
      if (stopped) return;
      const frameVideo = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
        cancelVideoFrameCallback?: (handle: number) => void;
      };
      if (frameVideo.requestVideoFrameCallback) {
        frameHandle = frameVideo.requestVideoFrameCallback(() => {
          draw();
          schedule();
        });
      } else {
        fallbackHandle = requestAnimationFrame(() => {
          draw();
          schedule();
        });
      }
    };

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
      void video.play().then(schedule, finish);
    };
    video.onended = finish;
    video.onerror = finish;
    video.src = src;

    return () => {
      stopped = true;
      resizeObserver?.disconnect();
      canvas.removeEventListener('ended', finish);
      canvas.removeEventListener('error', finish);
      cancelAnimationFrame(fallbackHandle);
      const frameVideo = video as HTMLVideoElement & { cancelVideoFrameCallback?: (handle: number) => void };
      frameVideo.cancelVideoFrameCallback?.(frameHandle);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [loop, maxWidth, mode, src]);

  return <canvas ref={canvasRef} className={className} data-source={src} data-ready="false" aria-hidden="true" />;
}