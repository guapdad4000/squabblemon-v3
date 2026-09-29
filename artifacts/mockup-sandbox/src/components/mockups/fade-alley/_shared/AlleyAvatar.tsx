import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  AnimationAction,
  AnimationMixer,
  Box3,
  Clock,
  DirectionalLight,
  Group,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export type AlleyAnimation = "Idle_10" | "Walking" | "Running" | "Boxing_Practice";

const MODEL_URL = "/__mockup/images/fade-alley/street-sentinel.glb";
const STILL_URL = "/__mockup/images/fade-alley/street-sentinel-still.png";

/** A transparent, independently lit model layer for compositing over the alley image. */
export function AlleyAvatar({
  animation = "Idle_10",
  className = "",
}: {
  animation?: AlleyAnimation;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef(animation);
  const loadedRef = useRef<{ mixer: AnimationMixer; gltf: GLTF; action: AnimationAction | null } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    animationRef.current = animation;
    const loaded = loadedRef.current;
    if (!loaded) return;
    const clip = loaded.gltf.animations.find((item) => item.name === animation) ??
      loaded.gltf.animations.find((item) => item.name === "Idle_10");
    if (!clip) return;
    const next = loaded.mixer.clipAction(clip);
    if (next === loaded.action) return;
    next.reset().fadeIn(0.24).play();
    loaded.action?.fadeOut(0.24);
    loaded.action = next;
  }, [animation]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: WebGLRenderer;
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
      if (!context) {
        setStatus("fallback");
        return;
      }
      renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      setStatus("fallback");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new OrthographicCamera(-1.6, 1.6, 1.85, -1.85, 0.1, 100);
    camera.position.set(0, 1.35, 7);
    camera.lookAt(0, 1.35, 0);
    scene.add(new AmbientLight(0xffffff, 0.75));
    scene.add(new HemisphereLight(0x8fd9d4, 0x714a2f, 1.65));
    const key = new DirectionalLight(0xffd69b, 2.2);
    key.position.set(3, 6, 5);
    scene.add(key);
    const rim = new DirectionalLight(0x2cc6c6, 2.1);
    rim.position.set(-4, 3, -2);
    scene.add(rim);

    let disposed = false;
    let frame = 0;
    let mixer: AnimationMixer | null = null;
    let model: Group | null = null;
    const clock = new Clock();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!host || disposed) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const aspect = width / height;
      camera.left = -1.85 * aspect;
      camera.right = 1.85 * aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    function render() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      if (!reduced) mixer?.update(delta);
      renderer.render(scene, camera);
      if (!reduced) frame = requestAnimationFrame(render);
    }

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        model = new Group();
        const bounds = new Box3().setFromObject(gltf.scene);
        const center = bounds.getCenter(new Vector3());
        const height = Math.max(0.01, bounds.getSize(new Vector3()).y);
        const scale = 2.8 / height;
        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        model.add(gltf.scene);
        scene.add(model);
        mixer = new AnimationMixer(gltf.scene);
        const clip = gltf.animations.find((item) => item.name === animationRef.current) ??
          gltf.animations.find((item) => item.name === "Idle_10");
        const action = clip ? mixer.clipAction(clip) : null;
        action?.play();
        loadedRef.current = { mixer, gltf, action };
        setStatus("ready");
        render();
      },
      undefined,
      () => {
        if (!disposed) setStatus("fallback");
      },
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      loadedRef.current = null;
      mixer?.stopAllAction();
      if (model) {
        model.traverse((object) => {
          if ("geometry" in object && object.geometry && typeof object.geometry === "object" && "dispose" in object.geometry) {
            (object.geometry as { dispose: () => void }).dispose();
          }
        });
      }
      renderer.dispose();
      renderer.forceContextLoss();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className={className} style={{ position: "relative" }} role="img" aria-label="Animated masked street fighter">
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
      {status !== "ready" && <img src={STILL_URL} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />}
    </div>
  );
}