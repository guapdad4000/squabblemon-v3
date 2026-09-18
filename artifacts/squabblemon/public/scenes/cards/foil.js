import { WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, ShaderMaterial, Mesh, Vector2 } from '../shared/three.module.js';

export function mountFoil(host, tier) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { pointer: { value: new Vector2(.5, .5) }, tier: { value: tier } },
    vertexShader: `varying vec2 uvCoord;
      void main() { uvCoord = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `precision mediump float;
      varying vec2 uvCoord; uniform vec2 pointer; uniform float tier;
      void main() {
        vec2 p = uvCoord;
        float angle = p.x * 1.6 + p.y * .7 + pointer.x * .9 - pointer.y * .6;
        vec3 spectrum = .5 + .5 * cos(6.28318 * (angle + vec3(0., .33, .67)));
        if (tier > 3.5) spectrum = mix(spectrum, vec3(1., .72, .22), .5);
        float beam = pow(max(0., 1. - abs(p.x + p.y * .5 - pointer.x * 1.2)), 5.);
        vec2 cell = fract(p * vec2(90., 126.)) - .5;
        float fleck = pow(max(0., 1. - length(cell) * 2.), 12.);
        float sparkle = fleck * pow(max(0., sin(angle * 38.)), 14.);
        float artMask = smoothstep(.14, .4, p.y);
        gl_FragColor = vec4(spectrum + sparkle, (beam * .2 + sparkle * .5) * artMask * (.35 + tier * .16));
      }`,
  });
  scene.add(new Mesh(geometry, material));
  host.appendChild(renderer.domElement);
  const card = host.closest('[data-card-id]');
  let frame = 0;
  const draw = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; renderer.render(scene, camera); });
  };
  const move = event => {
    if (document.documentElement.dataset.reducedMotion === 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = card.getBoundingClientRect();
    material.uniforms.pointer.value.set((event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height);
    draw();
  };
  const reset = () => { material.uniforms.pointer.value.set(.5, .5); draw(); };
  const observer = new ResizeObserver(() => {
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    draw();
  });
  observer.observe(host);
  card?.addEventListener('pointermove', move, { passive: true });
  card?.addEventListener('pointerleave', reset);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    card?.removeEventListener('pointermove', move);
    card?.removeEventListener('pointerleave', reset);
    geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
