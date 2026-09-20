import * as T from '../shared/three.module.js';

// Authored room dressing. No external model downloads or additional render loops.
export function dressSafehouse({ scene, couch, brass, wood, black, ivory, plaster }) {
  const root = new T.Group(); root.name = 'safehouse-details'; scene.add(root);
  const boxGeometry = new T.BoxGeometry(1, 1, 1);
  const standard = (color, roughness = .8, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
  const walnut = standard('#452b22'), green = standard('#263e36'), trim = standard('#65513b', .55), paper = standard('#dac9a4');
  const add = (geometry, material, position, parent = root) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const box = (size, material, position, parent) => { const mesh = add(boxGeometry, material, position, parent); mesh.scale.set(...size); return mesh; };
  const cylinder = (radius, height, material, position, parent, bottom = radius) => add(new T.CylinderGeometry(radius, bottom, height, 32), material, position, parent);
  const tube = (points, radius, material, parent = root) => add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 32, radius, 6, false), material, [0, 0, 0], parent);
  function canvasTexture(width, height, draw) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4; return texture;
  }
  function placard(text, subtitle, color = '#d9ad65') {
    return canvasTexture(1024, 384, (g, w, h) => {
      g.fillStyle = '#14231f'; g.fillRect(0, 0, w, h); g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(18, 18, w - 36, h - 36);
      g.fillStyle = color; g.textAlign = 'center'; g.font = '900 112px sans-serif'; g.fillText(text, w / 2, 196, w - 80);
      g.font = '24px monospace'; g.fillText(subtitle, w / 2, 278, w - 90);
    });
  }
  // Deep green joinery grounds the warm plaster and gives the walls real relief.
  box([8.9, .87, .07], green, [0, .43, -4.85]);
  box([.07, .87, 9.85], green, [-4.38, .43, 0]);
  for (let x = -4.25; x < 4.4; x += .66) box([.035, .74, .035], trim, [x, .43, -4.79]);
  for (let z = -4.65; z < 4.8; z += .66) box([.035, .74, .035], trim, [-4.32, .43, z]);
  box([9, .055, .14], brass, [0, .91, -4.79]); box([.14, .055, 10], brass, [-4.32, .91, 0]);
  for (const z of [-4.72, -.85]) box([9.05, .12, .14], walnut, [0, 4.5, z]);
  const ceiling = box([9.2, .12, 24], standard('#49483a'), [0, 4.65, 7]); ceiling.visible = innerWidth / innerHeight >= .95;
  box([.18, 4.8, 12], plaster, [-4.5, 2.25, 11]);
  box([.18, 4.8, 12], plaster, [4.5, 2.25, 11]);
  box([9, .25, 12], wood, [0, -.16, 11]);
  // The sign belongs to the room, rather than floating over the game.
  box([2.65, .85, .08], walnut, [-.35, 3.95, -4.8]);
  const sign = add(new T.PlaneGeometry(2.5, .72), new T.MeshStandardMaterial({ map: placard('HOME COURT', 'OAKLAND / EST. AFTER HOURS'), emissive: '#e5ae61', emissiveIntensity: .12, roughness: .7 }), [-.35, 3.95, -4.74]);
  sign.castShadow = false;
  // A sagging string of small practical lights gives the rear wall a warm edge.
  const bulb = new T.MeshStandardMaterial({ color: '#ffe7a5', emissive: '#ffc16d', emissiveIntensity: 3 });
  tube([[-4.25, 4.2, -4.62], [-2, 3.73, -4.58], [0, 3.6, -4.56], [2, 3.78, -4.58], [4.22, 4.18, -4.62]], .012, black);
  for (let i = 0; i < 17; i++) {
    const x = -4.12 + i * .515, y = 3.6 + .033 * x * x;
    cylinder(.035, .08, brass, [x, y - .045, -4.58]);
    const b = add(new T.SphereGeometry(.052, 10, 8), bulb, [x, y - .12, -4.58]); b.castShadow = false;
  }
  const backLight = new T.PointLight('#ffb66b', 10, 7, 2); backLight.position.set(-.8, 3.4, -4.1); root.add(backLight);

  // City lights sit behind the window bars, with rain on the glass in front.
  const cityTextures = [false, true].map(night => canvasTexture(1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, night ? '#091d31' : '#a97663'); sky.addColorStop(1, night ? '#426278' : '#e5b377'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = night ? '#bdd7d4' : '#ffdfad'; g.beginPath(); g.arc(786, 105, night ? 29 : 57, 0, Math.PI * 2); g.fill();
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 16; i++) {
        const x = i * 79 - layer * 25, height = 70 + ((i * 31 + layer * 57) % 190), top = h - height + layer * 18;
        g.fillStyle = ['#364b59', '#263948', '#15252b'][layer]; g.fillRect(x, top, 67, height);
        for (let row = 0; row < 10; row++) for (let col = 0; col < 4; col++) {
          if ((row * 7 + col * 3 + i + layer) % 4 === 0 || top + 16 + row * 19 > h) continue;
          g.fillStyle = night ? ((i + row) % 3 ? '#d3a66a' : '#7199aa') : '#6d7675'; g.fillRect(x + 9 + col * 13, top + 14 + row * 19, 5, 8);
        }
        g.fillStyle = '#15252b'; g.fillRect(x + 12, top - 10, 2, 15);
      }
    }
    g.fillStyle = '#a7d1cf18'; g.fillRect(0, h - 90, w, 90);
  }));
  const cityMaterial = new T.MeshBasicMaterial({ map: cityTextures[1], toneMapped: false });
  const city = add(new T.PlaneGeometry(4.22, 2.17), cityMaterial, [4.48, 2.65, -.2]); city.rotation.y = -Math.PI / 2; city.castShadow = false;
  const rainMaterial = new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, strength: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float time,strength;
      float hash(float x){return fract(sin(x*127.1)*43758.5453);}
      void main(){float col=floor(vUv.x*68.);float speed=.15+hash(col)*.2;
      float y=fract(vUv.y+time*speed+hash(col+4.));float x=fract(vUv.x*68.+vUv.y*.6);
      float streak=(1.-smoothstep(0.,.04,abs(x-.5))) * smoothstep(.84,.98,y)*(1.-smoothstep(.985,1.,y));
      gl_FragColor=vec4(.67,.85,.91,streak*.38*strength);}` });
  const rain = add(new T.PlaneGeometry(4.18, 2.15), rainMaterial, [4.46, 2.65, -.2]); rain.rotation.y = -Math.PI / 2; rain.castShadow = false;
  const windowLight = new T.PointLight('#739fb9', 25, 8, 2); windowLight.position.set(3.9, 2.7, .1); root.add(windowLight);
  const poolTexture = canvasTexture(128, 128, (g) => { const glow = g.createRadialGradient(64, 64, 5, 64, 64, 64); glow.addColorStop(0, '#91c8de88'); glow.addColorStop(1, '#91c8de00'); g.fillStyle = glow; g.fillRect(0, 0, 128, 128); });
  const poolMaterial = new T.MeshBasicMaterial({ map: poolTexture, transparent: true, opacity: .3, depthWrite: false, blending: T.AdditiveBlending });
  const pool = add(new T.PlaneGeometry(3.2, 5.7), poolMaterial, [2.9, .036, .1]); pool.rotation.x = -Math.PI / 2; pool.castShadow = false;

  // Crew artwork is the game's own character art, framed as a neighbourhood poster.
  const posterCanvas = document.createElement('canvas'); posterCanvas.width = 768; posterCanvas.height = 1024;
  const posterTexture = new T.CanvasTexture(posterCanvas); posterTexture.colorSpace = T.SRGBColorSpace;
  const drawPoster = image => {
    const g = posterCanvas.getContext('2d'); g.fillStyle = '#c3a877'; g.fillRect(0, 0, 768, 1024);
    g.fillStyle = '#293e37'; g.fillRect(28, 28, 712, 968); g.fillStyle = '#d8bd82'; g.font = '900 94px sans-serif'; g.textAlign = 'center'; g.fillText('THE BLOCK', 384, 140); g.font = '25px monospace'; g.fillText('BUILT US. WE BUILD IT BACK.', 384, 196);
    if (image) { const scale = Math.min(690 / image.width, 650 / image.height); g.drawImage(image, (768 - image.width * scale) / 2, 244, image.width * scale, image.height * scale); }
    g.fillStyle = '#d8bd82'; g.font = '900 42px sans-serif'; g.fillText('SQUABBLEMON', 384, 952); posterTexture.needsUpdate = true;
  };
  drawPoster(); const portrait = new Image(); portrait.onload = () => { if (!disposed) drawPoster(portrait); }; portrait.src = '../../assets/characters/ganger-blue.webp';
  const posterGroup = new T.Group(); posterGroup.position.set(-4.32, 2.46, .32); posterGroup.rotation.y = Math.PI / 2; root.add(posterGroup);
  box([1.87, 2.5, .07], walnut, [0, 0, 0], posterGroup);
  add(new T.PlaneGeometry(1.75, 2.34), new T.MeshStandardMaterial({ map: posterTexture, roughness: .95 }), [0, 0, .045], posterGroup);

  // A working listening corner for the player's own soundtrack.
  const vinyl = new T.Group(); vinyl.name = 'record-player'; vinyl.position.set(-3.25, 0, 2.15); vinyl.rotation.y = .38; scene.add(vinyl);
  box([1.5, .86, .84], walnut, [0, .5, 0], vinyl); box([1.56, .06, .9], wood, [0, .96, 0], vinyl);
  for (const x of [-.66, .66]) for (const z of [-.3, .3]) cylinder(.028, .14, brass, [x, .08, z], vinyl);
  box([1.28, .22, .045], black, [0, .45, .436], vinyl);
  for (let i = 0; i < 16; i++) box([.037, .32, .022], i % 3 ? trim : paper, [-.57 + i * .07, .4, .47], vinyl);
  box([1.28, .1, .69], black, [0, 1.045, 0], vinyl); box([1.24, .02, .65], brass, [0, 1.102, 0], vinyl);
  const record = new T.Group(); record.position.set(-.16, 1.137, 0); vinyl.add(record);
  cylinder(.29, .026, black, [0, 0, 0], record);
  const recordTexture = canvasTexture(512, 512, g => {
    g.fillStyle = '#0d1010'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#353c3a'; g.lineWidth = 1;
    for (let i = 82; i < 247; i += 5) { g.beginPath(); g.arc(256, 256, i, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#d5aa5e'; g.beginPath(); g.arc(256, 256, 78, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#252a25'; g.textAlign = 'center'; g.font = '900 27px sans-serif'; g.fillText('TREBLO', 256, 241); g.font = '12px monospace'; g.fillText('OAKLAND CHROME', 256, 269); g.fillText('AND CURLS', 256, 288);
  });
  const disc = add(new T.CircleGeometry(.285, 48), new T.MeshStandardMaterial({ map: recordTexture, metalness: .28, roughness: .5 }), [0, .015, 0], record); disc.rotation.x = -Math.PI / 2;
  cylinder(.008, .045, brass, [0, .025, 0], record);
  cylinder(.07, .055, brass, [.42, 1.15, -.2], vinyl);
  tube([[.42, 1.2, -.2], [.44, 1.2, .04], [.23, 1.16, .17]], .015, brass, vinyl); box([.07, .04, .095], ivory, [.21, 1.15, .19], vinyl);
  const led = standard('#a3b998'); led.emissive = new T.Color('#bada8b'); led.emissiveIntensity = .3;
  box([.09, .018, .04], led, [.45, 1.124, .24], vinyl);
  // Album sleeve leaning against the wall next to the deck.
  const sleeve = box([.59, .65, .035], new T.MeshStandardMaterial({ map: placard('TREBLO', 'OAKLAND CHROME AND CURLS'), roughness: .9 }), [.42, 1.42, -.3], vinyl); sleeve.rotation.x = -.16;

  // Cloth, a mug, sneakers, and a marked-up local noticeboard soften the primitives.
  const clothTexture = canvasTexture(128, 128, g => { g.fillStyle = '#aa7246'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 128; i += 16) { g.fillStyle = '#283f38'; g.fillRect(i, 0, 6, 128); g.fillRect(0, i, 128, 4); } });
  const clothGeometry = new T.PlaneGeometry(1.03, 1.55, 24, 32), vertices = clothGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) { const x = vertices.getX(i), y = vertices.getY(i); vertices.setXYZ(i, x, .89 - Math.max(0, -y - .25) * 1.3 + Math.sin(x * 23 + y * 3) * .025, y + .18); }
  clothGeometry.computeVertexNormals();
  const cloth = add(clothGeometry, new T.MeshStandardMaterial({ map: clothTexture, roughness: 1, side: T.DoubleSide }), [.65, 0, .1], couch); cloth.rotation.y = .08;
  const mug = cylinder(.09, .19, paper, [.48, 1.047, 1.5]);
  const coffee = cylinder(.076, .006, standard('#2a1810'), [.48, 1.145, 1.5]);
  const handle = add(new T.TorusGeometry(.065, .015, 8, 16), paper, [.59, 1.05, 1.5]);
  const steamPositions = new Float32Array(18 * 3); for (let i = 0; i < 18; i++) { steamPositions[i * 3] = .48; steamPositions[i * 3 + 1] = 1.2 + i * .018; steamPositions[i * 3 + 2] = 1.5; }
  const steamGeometry = new T.BufferGeometry(); steamGeometry.setAttribute('position', new T.BufferAttribute(steamPositions, 3));
  const steam = new T.Points(steamGeometry, new T.PointsMaterial({ size: .022, color: '#ead9b5', opacity: .15, transparent: true, depthWrite: false })); root.add(steam);
  const shoeMaterial = standard('#cebe98'), shoeSole = standard('#263731');
  for (let i = 0; i < 2; i++) {
    const shoe = new T.Group(); shoe.position.set(2.05 + i * .32, .14, -3.75 + i * .14); shoe.rotation.y = -.3 + i * .2; root.add(shoe);
    const sole = add(new T.SphereGeometry(1, 16, 8), shoeSole, [0, -.025, 0], shoe); sole.scale.set(.14, .06, .29);
    const upper = add(new T.SphereGeometry(1, 16, 8), shoeMaterial, [0, .015, -.01], shoe); upper.scale.set(.125, .11, .255);
    for (let j = 0; j < 4; j++) box([.16, .014, .018], ivory, [0, .12, -.03 + j * .045], shoe);
  }
  const board = new T.Group(); board.position.set(3.84, 2.8, -4.77); root.add(board);
  box([.74, 1.18, .075], walnut, [0, 0, 0], board); box([.65, 1.08, .04], standard('#8a6348'), [0, 0, .06], board);
  for (let i = 0; i < 5; i++) { const note = box([.22, .26, .006], i % 2 ? paper : standard('#b7b69a'), [(i % 2 - .5) * .27, .34 - Math.floor(i / 2) * .31, .09], board); note.rotation.z = (i % 3 - 1) * .12; }
  // Ceiling fan is deliberately slow, with motion disabled by the player's preference.
  const fan = new T.Group(); fan.position.set(-2.65, 4.27, -.7); root.add(fan); cylinder(.07, .3, brass, [0, .13, 0], fan);
  const rotor = new T.Group(); fan.add(rotor); cylinder(.2, .08, black, [0, -.06, 0], rotor);
  for (let i = 0; i < 4; i++) { const blade = box([.3, .035, 1], walnut, [0, -.07, .56], rotor); blade.position.set(Math.sin(i * Math.PI / 2) * .56, -.07, Math.cos(i * Math.PI / 2) * .56); blade.rotation.y = i * Math.PI / 2; }
  let playing = false, disposed = false;
  return {
    status: () => ({ playing, recordAngle: record.rotation.y, fanAngle: rotor.rotation.y, ceilingVisible: ceiling.visible }),
    vinyl, dynamicObjects: [record, rotor, ceiling],
    resize() { ceiling.visible = innerWidth / innerHeight >= .95; },
    setMusic(value) { playing = Boolean(value); led.emissiveIntensity = playing ? 2 : .3; },
    setNight(night) { cityMaterial.map = cityTextures[night ? 1 : 0]; windowLight.color.set(night ? '#739fb9' : '#ffd292'); windowLight.intensity = night ? 34 : 9; backLight.intensity = night ? 10 : 3; poolMaterial.opacity = night ? .28 : .1; rainMaterial.uniforms.strength.value = night ? 1 : .35; },
    update(time, dt, reduced, cameraHeight) {
      const ceilingVisible = innerWidth / innerHeight >= .95 && cameraHeight < 4.53;
      const ceilingChanged = ceiling.visible !== ceilingVisible;
      ceiling.visible = ceilingVisible;
      if (reduced) return ceilingChanged;
      rainMaterial.uniforms.time.value = time;
      rotor.rotation.y += dt * .45;
      if (playing) record.rotation.y -= dt * 3.49;
      const points = steamGeometry.attributes.position;
      for (let i = 0; i < points.count; i++) { const height = ((time * .1 + i * .023) % .4); points.setXYZ(i, .48 + Math.sin(time + i * .3) * height * .09, 1.18 + height, 1.5 + Math.cos(time * .6 + i) * height * .07); }
      points.needsUpdate = true;
      return ceilingChanged;
    },
    dispose() { disposed = true; portrait.onload = null; cityTextures.forEach(texture => texture.dispose()); }
  };
}
