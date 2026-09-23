import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRotation: number;
  bornAt: number;
  lifetime: number;
};

const MAX_PARTICLES = 24;
const PARTICLES_PER_POP = 4;

function motionIsReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.reduceMotion === 'true';
}

export function usePopcornParticles() {
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number | null>(null);
  const particleId = useRef(0);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const clear = useCallback(() => {
    stop();
    particlesRef.current = [];
    containerRef.current?.replaceChildren();
  }, [stop]);

  const updateParticles = useCallback((now: number) => {
    frameRef.current = null;
    const container = containerRef.current;
    if (!container || motionIsReduced()) {
      clear();
      return;
    }

    const active: Particle[] = [];
    for (const particle of particlesRef.current) {
      const progress = (now - particle.bornAt) / particle.lifetime;
      const element = container.querySelector<HTMLElement>(`[data-popcorn-id="${particle.id}"]`);
      if (progress >= 1) {
        element?.remove();
        continue;
      }

      particle.vy += 0.32;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.vRotation;
      if (element) {
        const scale = 0.65 + Math.sin(progress * Math.PI) * 0.35;
        element.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0) rotate(${particle.rotation}deg) scale(${scale})`;
        element.style.opacity = String(Math.min(1, (1 - progress) * 2));
      }
      active.push(particle);
    }

    particlesRef.current = active;
    if (active.length > 0) frameRef.current = requestAnimationFrame(updateParticles);
  }, [clear]);

  const spawnParticles = useCallback((event: PointerEvent | MouseEvent) => {
    const container = containerRef.current;
    if (motionIsReduced() || !container) return;

    const available = MAX_PARTICLES - particlesRef.current.length;
    const count = Math.min(PARTICLES_PER_POP, available);
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const id = ++particleId.current;
      particlesRef.current.push({
        id,
        x: event.clientX,
        y: event.clientY,
        vx: (Math.random() - 0.5) * 6,
        vy: -4 - Math.random() * 5,
        rotation: Math.random() * 360,
        vRotation: (Math.random() - 0.5) * 8,
        bornAt: now,
        lifetime: 650 + Math.random() * 300,
      });

      const el = document.createElement('div');
      el.dataset.popcornId = String(id);
      el.className = 'popcorn-particle';
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.top = '0';
      el.style.width = '9px';
      el.style.height = '8px';
      el.style.backgroundColor = '#fef08a';
      el.style.borderRadius = '55% 45% 48% 52%';
      el.style.boxShadow = 'inset -1px -1px 0 #ca8a04';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '9999';
      container.appendChild(el);
    }

    if (count > 0 && frameRef.current === null) {
      frameRef.current = requestAnimationFrame(updateParticles);
    }
  }, [updateParticles]);

  useEffect(() => clear, [clear]);

  return { containerRef, spawnParticles };
}
