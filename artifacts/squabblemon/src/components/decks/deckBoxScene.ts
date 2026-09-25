import * as THREE from 'three';

// This is the deck-box scene recovered from the previous production deployment.
// Portrait ink stays matte; the frame, seal, spine, and lettering carry the foil.
export function mountDeckBox(host: HTMLElement, { name, image, fullCover = false }: { name: string; image: string | null; fullCover?: boolean }) {
  let renderer: THREE.WebGLRenderer;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    if (!context) return () => {};
    renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch {
    return () => {};
  }

  let disposed = false;
  let unavailable = false;
  let raf = 0;
  let last = 0;
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  camera.position.set(0, 0.05, 7.5);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = 'deck-box__canvas';
  host.appendChild(renderer.domElement);

  const makeCanvas = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };
  const makeTexture = (canvas: HTMLCanvasElement, color = false) => {
    const texture = new THREE.CanvasTexture(canvas);
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    textures.push(texture);
    return texture;
  };
  const makeMaps = (portrait: HTMLImageElement | null) => {
    const color = makeCanvas(768, 1075);
    const mask = makeCanvas(768, 1075);
    const colorContext = color.getContext('2d')!;
    const maskContext = mask.getContext('2d')!;
    const gradient = colorContext.createLinearGradient(0, 0, 768, 1075);
    gradient.addColorStop(0, '#283b3b');
    gradient.addColorStop(0.5, '#131d22');
    gradient.addColorStop(1, '#080e13');
    colorContext.fillStyle = gradient;
    colorContext.fillRect(0, 0, 768, 1075);
    maskContext.fillStyle = '#111';
    maskContext.fillRect(0, 0, 768, 1075);
    if (portrait && fullCover) {
      // Fit the complete supplied print without cropping its character, lettering or border.
      const scale = Math.min(768 / portrait.width, 1075 / portrait.height);
      const width = portrait.width * scale, height = portrait.height * scale;
      colorContext.drawImage(portrait, (768 - width) / 2, (1075 - height) / 2, width, height);
      maskContext.fillStyle = '#ddd';
      maskContext.fillRect(0, 0, 14, 1075);
      maskContext.fillRect(754, 0, 14, 1075);
      return { color, mask };
    }
    colorContext.strokeStyle = '#9aaab112';
    colorContext.lineWidth = 1;
    for (let x = -1100; x < 850; x += 17) {
      colorContext.beginPath();
      colorContext.moveTo(x, 0);
      colorContext.lineTo(x + 1075, 1075);
      colorContext.stroke();
    }
    const foil = (draw: (context: CanvasRenderingContext2D) => void) => {
      colorContext.save();
      maskContext.save();
      colorContext.strokeStyle = '#bdad86';
      colorContext.fillStyle = '#d7c59d';
      maskContext.strokeStyle = '#eee';
      maskContext.fillStyle = '#eee';
      draw(colorContext);
      draw(maskContext);
      colorContext.restore();
      maskContext.restore();
    };
    foil((context) => {
      context.lineWidth = 3;
      context.strokeRect(28, 28, 712, 1019);
      context.lineWidth = 1;
      context.strokeRect(40, 40, 688, 995);
      for (const x of [54, 714]) {
        for (const y of [54, 1021]) {
          context.beginPath();
          context.moveTo(x, y - 8);
          context.lineTo(x + 8, y);
          context.lineTo(x, y + 8);
          context.lineTo(x - 8, y);
          context.closePath();
          context.fill();
        }
      }
      context.textAlign = 'center';
      context.font = '900 52px Georgia';
      context.fillText('SM', 384, 113);
      context.font = '600 18px Arial';
      context.fillText('S Q U A B B L E M O N', 384, 145);
      context.beginPath();
      context.moveTo(152, 165);
      context.lineTo(616, 165);
      context.stroke();
    });
    if (portrait) {
      const scale = Math.min(646 / portrait.width, 717 / portrait.height);
      const width = portrait.width * scale;
      const height = portrait.height * scale;
      colorContext.drawImage(portrait, (768 - width) / 2, 905 - height, width, height);
      maskContext.fillStyle = '#090909';
      maskContext.fillRect(60, 179, 648, 727);
    } else {
      foil((context) => {
        context.textAlign = 'center';
        context.font = '900 174px Georgia';
        context.fillText('SM', 384, 580);
      });
    }
    const fade = colorContext.createLinearGradient(0, 810, 0, 930);
    fade.addColorStop(0, '#0b131800');
    fade.addColorStop(1, '#0b1318');
    colorContext.fillStyle = fade;
    colorContext.fillRect(48, 810, 672, 220);
    foil((context) => {
      context.textAlign = 'center';
      let size = 39;
      context.font = `800 ${size}px Arial`;
      while (context.measureText(name.toUpperCase()).width > 624 && size > 16) {
        size -= 1;
        context.font = `800 ${size}px Arial`;
      }
      context.fillText(name.toUpperCase(), 384, 951, 624);
      context.font = '14px Arial';
      context.fillText('C O L L E C T .  B U I L D .  S Q U A B B L E .', 384, 990);
    });
    return { color, mask };
  };

  const cover = makeMaps(null);
  const coverColor = makeTexture(cover.color, true);
  const coverMask = makeTexture(cover.mask);
  const thicknessCanvas = makeCanvas(128, 128);
  const thicknessContext = thicknessCanvas.getContext('2d')!;
  const thicknessData = thicknessContext.createImageData(128, 128);
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const index = (y * 128 + x) * 4;
      const shade = 110 + 65 * Math.sin(x * 0.055 + Math.sin(y * 0.04));
      thicknessData.data[index] = thicknessData.data[index + 1] = thicknessData.data[index + 2] = shade;
      thicknessData.data[index + 3] = 255;
    }
  }
  thicknessContext.putImageData(thicknessData, 0, 0);
  const thickness = makeTexture(thicknessCanvas);
  const roughnessCanvas = makeCanvas(768, 1075);
  const roughnessContext = roughnessCanvas.getContext('2d')!;
  const updateRoughness = () => {
    roughnessContext.drawImage(cover.mask, 0, 0);
    const pixels = roughnessContext.getImageData(0, 0, 768, 1075);
    for (let index = 0; index < pixels.data.length; index += 4) {
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = 255 - pixels.data[index] * 0.72;
    }
    roughnessContext.putImageData(pixels, 0, 0);
  };
  updateRoughness();
  const roughness = makeTexture(roughnessCanvas);
  const face = new THREE.MeshPhysicalMaterial({
    map: coverColor,
    metalnessMap: coverMask,
    metalness: 0.86,
    roughness: 0.88,
    roughnessMap: roughness,
    specularIntensity: 0.18,
    clearcoat: 0.6,
    clearcoatMap: coverMask,
    clearcoatRoughness: 0.27,
    iridescence: 0.65,
    iridescenceMap: coverMask,
    iridescenceThicknessMap: thickness,
    iridescenceThicknessRange: [260, 390],
    envMapIntensity: 0.55,
  });
  const sideCanvas = makeCanvas(180, 840);
  const sideContext = sideCanvas.getContext('2d')!;
  sideContext.fillStyle = '#17282d';
  sideContext.fillRect(0, 0, 180, 840);
  sideContext.strokeStyle = '#b6a279';
  sideContext.lineWidth = 4;
  sideContext.strokeRect(14, 14, 152, 812);
  sideContext.translate(90, 420);
  sideContext.rotate(-Math.PI / 2);
  sideContext.fillStyle = '#d5c5a0';
  sideContext.textAlign = 'center';
  sideContext.font = 'bold 34px Georgia';
  sideContext.fillText('S Q U A B B L E M O N', 0, 12);
  const side = new THREE.MeshPhysicalMaterial({
    map: makeTexture(sideCanvas, true),
    metalness: 0.7,
    roughness: 0.3,
    clearcoat: 1,
    iridescence: 0.28,
    iridescenceThicknessRange: [270, 340],
  });
  const edge = new THREE.MeshStandardMaterial({ color: '#968564', metalness: 0.85, roughness: 0.35 });
  materials.push(face, side, edge);

  const geometry = new THREE.BoxGeometry(2.5, 3.5, 0.7, 8, 12, 4);
  const positions = geometry.attributes.position;
  const point = new THREE.Vector3();
  const inner = new THREE.Vector3();
  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index);
    inner.set(
      Math.max(-1.2, Math.min(1.2, point.x)),
      Math.max(-1.7, Math.min(1.7, point.y)),
      Math.max(-0.3, Math.min(0.3, point.z)),
    );
    point.sub(inner).normalize().multiplyScalar(0.05).add(inner);
    positions.setXYZ(index, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  geometries.push(geometry);
  const box = new THREE.Mesh(geometry, [side, side, edge, edge, face, face]);
  box.rotation.set(-0.09, -0.43, -0.055);
  scene.add(box);

  const room = new THREE.Scene();
  room.background = new THREE.Color('#191f29');
  const roomGeometry = new THREE.PlaneGeometry(8, 8);
  geometries.push(roomGeometry);
  const softboxes: Array<[THREE.Vector3Tuple, string, number, [number, number]]> = [
    [[-4, 3, 4], '#fff2db', 5, [1, 0.7]],
    [[4, 1, 2], '#c9e2ec', 3, [0.3, 1.2]],
    [[0, 5, -2], '#fff4dc', 4, [1, 0.25]],
  ];
  for (const [position, tint, strength, scale] of softboxes) {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(tint).multiplyScalar(strength),
      side: THREE.DoubleSide,
    });
    materials.push(material);
    const light = new THREE.Mesh(roomGeometry, material);
    light.position.set(...position);
    light.scale.set(...scale, 1);
    light.lookAt(0, 0, 0);
    room.add(light);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  pmrem.dispose();
  scene.add(new THREE.AmbientLight('#cbdbe7', 1.3));
  const key = new THREE.DirectionalLight('#fff0d2', 2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#b5d9ed', 1.4);
  fill.position.set(4, 0, 3);
  scene.add(fill);

  const target = { x: 0, y: 0 };
  let aimX = 0;
  let aimY = 0;
  const render = (now: number) => {
    raf = 0;
    if (disposed || unavailable || document.hidden) return;
    if (now - last < 30) {
      raf = requestAnimationFrame(render);
      return;
    }
    last = now;
    aimX += (target.x - aimX) * 0.16;
    aimY += (target.y - aimY) * 0.16;
    box.rotation.set(-0.09 + aimY * 0.18, -0.43 + aimX * 0.55, -0.055);
    renderer.render(scene, camera);
    host.dataset.rendered = 'true';
    if (Math.abs(target.x - aimX) + Math.abs(target.y - aimY) > 0.001) raf = requestAnimationFrame(render);
  };
  const wake = () => {
    if (!disposed && !unavailable && !raf && !document.hidden) raf = requestAnimationFrame(render);
  };
  const pointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const rect = host.getBoundingClientRect();
    target.x = (event.clientX - rect.left) / rect.width - 0.5;
    target.y = (event.clientY - rect.top) / rect.height - 0.5;
    wake();
  };
  const leave = () => {
    target.x = target.y = 0;
    wake();
  };
  const resize = () => {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.position.z = camera.aspect < 0.77 ? (6.9 / camera.aspect) * 0.77 : 6.9;
    camera.updateProjectionMatrix();
    wake();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const contextLost = (event: Event) => {
    event.preventDefault();
    unavailable = true;
    delete host.dataset.rendered;
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      wake();
    }
  };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  host.addEventListener('pointermove', pointer);
  host.addEventListener('pointerleave', leave);
  document.addEventListener('visibilitychange', visibility);

  const portrait = new Image();
  portrait.onload = () => {
    if (disposed) return;
    const printed = makeMaps(portrait);
    cover.color.getContext('2d')!.drawImage(printed.color, 0, 0);
    cover.mask.getContext('2d')!.drawImage(printed.mask, 0, 0);
    updateRoughness();
    coverColor.needsUpdate = coverMask.needsUpdate = roughness.needsUpdate = true;
    wake();
  };
  if (image) portrait.src = image;
  resize();

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    portrait.onload = null;
    portrait.src = '';
    host.removeEventListener('pointermove', pointer);
    host.removeEventListener('pointerleave', leave);
    document.removeEventListener('visibilitychange', visibility);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    geometries.forEach((item) => item.dispose());
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    delete host.dataset.rendered;
  };
}
