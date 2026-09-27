import { useEffect, useRef } from 'react';
import { currentDepthQuality, subscribeDepthQuality, type DepthQuality } from '../lib/depthQuality';

/** Pointer/gyro parallax layers plus a lightweight 2D ember field for the lobby. */
export function LobbyDepth() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const root = host.current, surface = canvas.current;
    if (!root || !surface) return;
    const context = surface.getContext('2d');
    let raf = 0, last = 0, quality: DepthQuality = currentDepthQuality();
    type Mote = { x: number; y: number; r: number; vy: number; vx: number; a: number; layer: number };
    let motes: Mote[] = [];
    const seed = () => {
      const count = quality === 'full' ? 42 : quality === 'lite' ? 16 : 0;
      motes = Array.from({ length: count }, () => ({
        x: Math.random(), y: Math.random(), r: .6 + Math.random() * 1.8,
        vy: 0.004 + Math.random() * 0.012, vx: (Math.random() - .5) * 0.004,
        a: .25 + Math.random() * .5, layer: 0.3 + Math.random() * 0.7,
      }));
    };
    const size = () => {
      const scale = quality === 'full' ? Math.min(devicePixelRatio || 1, 1.5) : 1;
      surface.width = Math.round(root.clientWidth * scale);
      surface.height = Math.round(root.clientHeight * scale);
    };
    let px = 0, py = 0;
    const frame = (now: number) => {
      raf = 0;
      if (!context || quality === 'off' || document.hidden) return;
      const budget = quality === 'full' ? 16 : 40;
      if (now - last >= budget) {
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        const style = document.documentElement.style;
        const gx = parseFloat(style.getPropertyValue('--gyro-x')) || 0;
        const gy = parseFloat(style.getPropertyValue('--gyro-y')) || 0;
        const tx = document.documentElement.dataset.gyro === 'on' ? gx : px;
        const ty = document.documentElement.dataset.gyro === 'on' ? gy : py;
        root.style.setProperty('--px', tx.toFixed(3));
        root.style.setProperty('--py', ty.toFixed(3));
        const { width, height } = surface;
        context.clearRect(0, 0, width, height);
        for (const mote of motes) {
          mote.y -= mote.vy * dt * 6; mote.x += mote.vx * dt * 6;
          if (mote.y < -0.05) { mote.y = 1.05; mote.x = Math.random(); }
          const x = (mote.x + tx * -0.02 * mote.layer) * width;
          const y = (mote.y + ty * -0.015 * mote.layer) * height;
          context.globalAlpha = mote.a * (0.6 + 0.4 * Math.sin(now / 900 + mote.x * 20));
          context.fillStyle = '#ffd89a';
          context.beginPath(); context.arc(x, y, mote.r * mote.layer * (width / root.clientWidth || 1), 0, Math.PI * 2); context.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      px = event.clientX / innerWidth * 2 - 1; py = event.clientY / innerHeight * 2 - 1;
    };
    const restart = (next: DepthQuality) => { quality = next; seed(); size(); context?.clearRect(0, 0, surface.width, surface.height); wake(); };
    const visibility = () => { if (!document.hidden) wake(); };
    const observer = new ResizeObserver(size);
    observer.observe(root);
    const unsubscribe = subscribeDepthQuality(restart);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    restart(quality);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); unsubscribe(); window.removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return (
    <div ref={host} className="lobby-depth" aria-hidden="true" data-testid="lobby-depth">
      <div className="lobby-depth__layer lobby-depth__layer--far" />
      <div className="lobby-depth__layer lobby-depth__layer--mid"><canvas ref={canvas} /></div>
      <div className="lobby-depth__layer lobby-depth__layer--near" />
    </div>
  );
}
