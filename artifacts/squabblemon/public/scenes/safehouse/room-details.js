import { createGrowthCorner } from './growth-corner.js';
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
  let fontDirty = false;
  function placard(text, color = '#e8c468') {
    const paint = (g, w, h, family = "'Blzee', sans-serif") => {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#162924'); bg.addColorStop(1, '#0b1513');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(18, 18, w - 36, h - 36);
      g.strokeStyle = '#d9ad6555'; g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60);
      for (const [cx, cy] of [[42, 42], [w - 42, 42], [42, h - 42], [w - 42, h - 42]]) {
        g.fillStyle = color; g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
      }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `400 148px ${family}`;
      g.fillStyle = '#070c0b'; g.fillText(text, w / 2 + 5, h / 2 + 12, w - 96);
      g.fillStyle = '#ffe28a'; g.fillText(text, w / 2, h / 2 + 6, w - 96);
    };
    const tex = canvasTexture(1024, 384, (g, w, h) => paint(g, w, h));
    if (typeof FontFace !== 'undefined' && typeof document !== 'undefined' && document.fonts) {
      const face = new FontFace('Blzee', `url(${new URL('../../fonts/blzee.woff2', import.meta.url).href}) format('woff2')`);
      face.load().then(loaded => {
        if (disposed) return;
        document.fonts.add(loaded);
        paint(tex.image.getContext('2d'), 1024, 384, "'Blzee', sans-serif");
        tex.needsUpdate = true; fontDirty = true;
      }).catch(() => {});
    }
    return tex;
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
  const sign = add(new T.PlaneGeometry(2.5, .72), new T.MeshStandardMaterial({ map: placard('HOME COURT'), emissive: '#e5ae61', emissiveIntensity: .15, roughness: .65 }), [-.35, 3.95, -4.74]);
  sign.castShadow = false;
  // Low neutral practical lights keep the rear wall readable without a gold cast.
  const bulb = new T.MeshStandardMaterial({ color: '#dce6e6', emissive: '#b9d0d3', emissiveIntensity: 1.25 });
  tube([[-4.25, 4.2, -4.62], [-2, 3.73, -4.58], [0, 3.6, -4.56], [2, 3.78, -4.58], [4.22, 4.18, -4.62]], .012, black);
  for (let i = 0; i < 17; i++) {
    const x = -4.12 + i * .515, y = 3.6 + .033 * x * x;
    cylinder(.035, .08, brass, [x, y - .045, -4.58]);
    const b = add(new T.SphereGeometry(.052, 10, 8), bulb, [x, y - .12, -4.58]); b.castShadow = false;
  }
  const backLight = new T.PointLight('#9fb8c1', 4, 7, 2); backLight.position.set(-.8, 3.4, -4.1); root.add(backLight);

  // City lights sit behind the window bars, with rain on the glass in front.
  const cityTextures = [false, true].map(night => canvasTexture(1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, night ? '#071628' : '#8e5a50');
    sky.addColorStop(.52, night ? '#1b354d' : '#c98862');
    sky.addColorStop(1, night ? '#486c82' : '#f2be7a');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const moonGlow = g.createRadialGradient(786, 105, 8, 786, 105, night ? 98 : 138);
    moonGlow.addColorStop(0, night ? '#e4f4ffdd' : '#fff0c4ee');
    moonGlow.addColorStop(.45, night ? '#7cb4d844' : '#ffbe7044');
    moonGlow.addColorStop(1, '#0000');
    g.fillStyle = moonGlow; g.fillRect(620, 0, 330, 260);
    g.fillStyle = night ? '#d9eef2' : '#ffe6b8'; g.beginPath(); g.arc(786, 105, night ? 29 : 54, 0, Math.PI * 2); g.fill();
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 16; i++) {
        const x = i * 79 - layer * 25, height = 70 + ((i * 31 + layer * 57) % 190), top = h - height + layer * 18;
        g.fillStyle = ['#364b59', '#233645', '#122027'][layer]; g.fillRect(x, top, 67, height);
        for (let row = 0; row < 10; row++) for (let col = 0; col < 4; col++) {
          if ((row * 7 + col * 3 + i + layer) % 4 === 0 || top + 16 + row * 19 > h) continue;
          g.fillStyle = night ? ((i + row) % 3 ? '#f0b86c' : '#79b4cc') : ((i + col) % 4 === 0 ? '#d8aa78' : '#6d7675');
          g.fillRect(x + 9 + col * 13, top + 14 + row * 19, 5, 8);
        }
        g.fillStyle = '#15252b'; g.fillRect(x + 12, top - 10, 2, 15);
        if (layer === 2 && i % 4 === 1) {
          g.fillStyle = night ? '#ff7c5c' : '#e89b60';
          g.fillRect(x + 11, top - 13, 4, 4);
        }
      }
    }
    const horizon = g.createLinearGradient(0, h - 125, 0, h);
    horizon.addColorStop(0, '#0000');
    horizon.addColorStop(1, night ? '#74b6d836' : '#ffd29642');
    g.fillStyle = horizon; g.fillRect(0, h - 125, w, 125);
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
  // Baked window-bar light: one existing transparent plane, no shadow map or
  // extra light. The wide, feathered bands read across the rug at night.
  const poolTexture = canvasTexture(256, 256, g => {
    const glow = g.createRadialGradient(232, 122, 10, 156, 126, 187);
    glow.addColorStop(0, '#9acbf3bb'); glow.addColorStop(.52, '#81b5e58f'); glow.addColorStop(1, '#709ed400');
    g.fillStyle = glow; g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = 'destination-out';
    for (let row = 0; row < 9; row++) {
      const y = row * 32 - 12;
      const bar = g.createLinearGradient(0, y, 0, y + 12);
      bar.addColorStop(0, '#0000'); bar.addColorStop(.3, '#000e'); bar.addColorStop(.7, '#000e'); bar.addColorStop(1, '#0000');
      g.fillStyle = bar; g.beginPath(); g.moveTo(0, y + 13); g.lineTo(256, y); g.lineTo(256, y + 12); g.lineTo(0, y + 25); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  });
  const poolMaterial = new T.MeshBasicMaterial({ map: poolTexture, transparent: true, opacity: .5, depthWrite: false, blending: T.AdditiveBlending });
  const pool = add(new T.PlaneGeometry(5.7, 6.6), poolMaterial, [1.25, .036, .3]); pool.rotation.x = -Math.PI / 2; pool.rotation.z = -.1; pool.castShadow = false;
  // Single-draw-call volumetric window god-rays stream from the barred window into the upper room air.
  const shaftTexture = canvasTexture(256, 256, g => {
    const beam = g.createLinearGradient(0, 0, 256, 0);
    beam.addColorStop(0, '#ffffff00');
    beam.addColorStop(.12, '#ffffffc8');
    beam.addColorStop(.42, '#ffffff68');
    beam.addColorStop(.78, '#ffffff1c');
    beam.addColorStop(1, '#ffffff00');
    g.fillStyle = beam; g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = 'destination-in';
    const edge = g.createLinearGradient(0, 0, 0, 256);
    edge.addColorStop(0, '#0000'); edge.addColorStop(.22, '#000b'); edge.addColorStop(.5, '#000f'); edge.addColorStop(.78, '#000b'); edge.addColorStop(1, '#0000');
    g.fillStyle = edge; g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = 'source-over';
  });
  const shaftMaterial = new T.MeshBasicMaterial({ map: shaftTexture, color: '#ffd394', transparent: true, opacity: .24, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending });
  const shaftPlanes = [[-1.45, 3.28, .85], [-.45, 3.36, .95], [.55, 3.32, .92], [1.45, 3.22, .82]];
  const shaftPos = [], shaftUv = [], shaftIdx = [];
  shaftPlanes.forEach(([z, topY, spread], idx) => {
    const base = idx * 4;
    const x0 = 4.34, y0 = topY, x1 = 2.15, y1 = 1.48;
    const half0 = .38 * spread, half1 = .66 * spread;
    shaftPos.push(
      x0, y0 + .22, z - half0,
      x0, y0 - .22, z + half0,
      x1, y1 + .18, z - half1 + .16,
      x1, y1 - .18, z + half1 + .16
    );
    shaftUv.push(0, 0, 0, 1, 1, 0, 1, 1);
    shaftIdx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  });
  const shaftGeo = new T.BufferGeometry();
  shaftGeo.setAttribute('position', new T.Float32BufferAttribute(shaftPos, 3));
  shaftGeo.setAttribute('uv', new T.Float32BufferAttribute(shaftUv, 2));
  shaftGeo.setIndex(shaftIdx);
  shaftGeo.computeVertexNormals();
  const godRays = add(shaftGeo, shaftMaterial, [0, 0, 0]); godRays.castShadow = false; godRays.receiveShadow = false;

  // A compact metal shelf under the back-wall panel holds the player's corner.
  const steel = standard('#59646a', .42, .72);
  const profileShelf = new T.Group(); profileShelf.name = 'profile-shelf'; profileShelf.position.set(0, 0, -4.66); root.add(profileShelf);
  for (const x of [-1.28, 1.28]) box([.07, 1.35, .32], steel, [x, .68, 0], profileShelf);
  for (const y of [.16, .68, 1.2]) box([2.72, .075, .42], steel, [0, y, 0], profileShelf);
  for (const x of [-1.12, 1.12]) tube([[x, .18, -.12], [-x, 1.18, -.12]], .018, brass, profileShelf);
  const bookColors = ['#6f232b', '#27433d', '#bd9a5a', '#28384b', '#8b5138'];
  for (let i = 0; i < 9; i++) box([.13 + (i % 2) * .025, .36 + (i % 3) * .035, .25], standard(bookColors[i % bookColors.length]), [-1.03 + i * .19, .42, .03], profileShelf);
  // Reuse the sculpted, veined-leaf plant from Buddy's garden at shelf scale.
  const plant = new T.Group(); plant.position.set(-.88,1.24,.03);profileShelf.add(plant);
  const shelfPlant=createGrowthCorner({wood,brass,shelf:true});shelfPlant.position.set(.084,-.49,.028);shelfPlant.scale.setScalar(.7);plant.add(shelfPlant);
  // A small metal fist trophy represents the player's record.
  const trophy = new T.Group(); trophy.position.set(0, 1.23, .04); profileShelf.add(trophy);
  cylinder(.22, .08, black, [0, .04, 0], trophy, .28); cylinder(.09, .31, brass, [0, .22, 0], trophy);
  box([.3, .32, .18], steel, [0, .47, 0], trophy);
  for (let i = 0; i < 4; i++) box([.095, .2 + i * .018, .18], steel, [-.145 + i * .097, .69 + (i % 2) * .025, 0], trophy);
  const thumb = box([.11, .27, .18], steel, [.19, .48, .02], trophy); thumb.rotation.z = -.55;
  // The framed portrait updates to the selected profile character.
  const profileCanvas = document.createElement('canvas'); profileCanvas.width = 384; profileCanvas.height = 480;
  const profileTexture = new T.CanvasTexture(profileCanvas); profileTexture.colorSpace = T.SRGBColorSpace;
  let profileImage = null;
  const drawProfile = (image, name = 'YOUR PROFILE', cell) => {
    const g = profileCanvas.getContext('2d'); g.fillStyle = '#151a1b'; g.fillRect(0, 0, 384, 480);
    g.fillStyle = '#d8c9a6'; g.fillRect(12, 12, 360, 456); g.fillStyle = '#202a2b'; g.fillRect(24, 24, 336, 432);
    if (image) { const cropped = Number.isInteger(cell) && cell >= 0 && cell < 4; const w = image.width / (cropped ? 2 : 1), h = image.height / (cropped ? 2 : 1); const scale = Math.min(322 / w, 356 / h); g.drawImage(image, cropped ? (cell % 2) * w : 0, cropped ? Math.floor(cell / 2) * h : 0, w, h, (384 - w * scale) / 2, 34 + (356 - h * scale) / 2, w * scale, h * scale); }
    g.fillStyle = '#efe1be'; g.fillRect(24, 398, 336, 58); g.fillStyle = '#1b2221'; g.textAlign = 'center'; g.font = '900 24px sans-serif'; g.fillText(name.toUpperCase(), 192, 435, 310); profileTexture.needsUpdate = true;
  };
  drawProfile(null);
  box([.72, .9, .08], black, [.88, 1.7, 0], profileShelf);
  const profilePortrait = add(new T.PlaneGeometry(.64, .8), new T.MeshStandardMaterial({ map: profileTexture, roughness: .88 }), [.88, 1.7, .05], profileShelf); profilePortrait.castShadow = false;
  const setProfile = value => {
    if (!value?.image) { drawProfile(null, value?.name); return; }
    if (profileImage) profileImage.onload = null;
    profileImage = new Image(); profileImage.onload = () => { if (!disposed) drawProfile(profileImage, value.name, value.cell); }; profileImage.src = value.image;
  };

  // A working listening corner for the player's own soundtrack.
  const vinyl = new T.Group(); vinyl.name = 'record-player'; vinyl.position.set(-4.04, 0, 2.02); vinyl.rotation.y = Math.PI / 2; scene.add(vinyl);
  const brushed = new T.MeshStandardMaterial({color:'#b2ada1',metalness:.8,roughness:.36});
  box([1.52,.065,.84],walnut,[0,.24,0],vinyl);box([1.56,.065,.9],walnut,[0,.96,0],vinyl);
  box([1.45,.66,.035],black,[0,.59,-.4],vinyl);
  for(const x of [-.72,.72])box([.065,.69,.84],walnut,[x,.6,0],vinyl);
  box([1.42,.045,.82],walnut,[0,.66,0],vinyl);box([.055,.36,.82],walnut,[.18,.45,0],vinyl);
  for (const x of [-.66,.66])for(const z of [-.3,.3])cylinder(.028,.21,brushed,[x,.11,z],vinyl);
  const spineColors=['#b09672','#783d36','#2e4c48','#c4b694','#333734'];
  for(let i=0;i<16;i++){const spine=box([.043,.33,.56],standard(spineColors[i%5]),[-.65+i*.048,.44,.075],vinyl);spine.rotation.z=(i%3-1)*.02;box([.024,.008,.006],paper,[-.65+i*.048,.53,.358],vinyl);}
  box([.36,.22,.6],black,[.43,.43,.04],vinyl);
  for(let i=0;i<5;i++)box([.3,.012,.012],trim,[.43,.36+i*.035,.347],vinyl);
  for(const x of [-.51,.51])for(const z of [-.23,.23])cylinder(.045,.045,black,[x,1.017,z],vinyl);
  box([1.3,.09,.72],walnut,[0,1.072,0],vinyl);box([1.25,.014,.67],brushed,[0,1.124,0],vinyl);
  cylinder(.313,.045,brushed,[-.16,1.15,0],vinyl);
  for(let i=0;i<48;i++){const angle=i*Math.PI/24;box([.013,.009,.013],black,[-.16+Math.cos(angle)*.311,1.15,Math.sin(angle)*.311],vinyl);}
  const record = new T.Group(); record.position.set(-.16, 1.18, 0); vinyl.add(record);
  cylinder(.29, .026, black, [0, 0, 0], record);
  const recordTexture = canvasTexture(512, 512, g => {
    g.fillStyle = '#0d1010'; g.fillRect(0, 0, 512, 512);
    // Anisotropic vinyl sheen wedges give the spinning platter realistic light play.
    for (const [start, end, tint] of [[.18, .62, '#ffffff18'], [1.75, 2.15, '#ffd79616'], [3.32, 3.76, '#ffffff18'], [4.89, 5.29, '#88c8df14']]) {
      g.fillStyle = tint; g.beginPath(); g.moveTo(256, 256); g.arc(256, 256, 248, start, end); g.closePath(); g.fill();
    }
    g.strokeStyle = '#353c3a'; g.lineWidth = 1;
    for (let i = 82; i < 247; i += 5) { g.beginPath(); g.arc(256, 256, i, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#d5aa5e'; g.beginPath(); g.arc(256, 256, 78, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6f4c1e'; g.lineWidth = 3; g.beginPath(); g.arc(256, 256, 70, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#252a25'; g.textAlign = 'center'; g.font = '900 24px sans-serif'; g.fillText('FADE TUNES', 256, 241); g.font = '12px monospace'; g.fillText('SQUABBLE CITY', 256, 269); g.fillText('AFTER HOURS', 256, 288);
  });
  const disc = add(new T.CircleGeometry(.285, 48), new T.MeshStandardMaterial({ map: recordTexture, metalness: .36, roughness: .38 }), [0, .015, 0], record); disc.rotation.x = -Math.PI / 2;
  cylinder(.008, .045, brass, [0, .025, 0], record);
  cylinder(.066,.072,black,[.43,1.174,-.21],vinyl);cylinder(.044,.065,brushed,[.43,1.23,-.21],vinyl);
  tube([[.43,1.26,-.29],[.43,1.26,-.16],[.39,1.245,.04],[.25,1.23,.15]],.012,brushed,vinyl);
  const counterweight=cylinder(.039,.07,brushed,[.43,1.26,-.29],vinyl);counterweight.rotation.x=Math.PI/2;
  box([.06,.035,.085],black,[.235,1.212,.175],vinyl);box([.025,.015,.038],paper,[.235,1.189,.185],vinyl);
  const led=standard('#ffd084');led.emissive=new T.Color('#ffad42');led.emissiveIntensity=1.2;
  box([.04,.008,.015],led,[.49,1.135,.24],vinyl);
  cylinder(.036,.012,black,[-.54,1.14,.25],vinyl);cylinder(.022,.014,brushed,[.43,1.14,.24],vinyl);
  box([.035,.005,.2],black,[.55,1.135,.025],vinyl);box([.052,.017,.027],brushed,[.55,1.145,.035],vinyl);
  const albumArt=canvasTexture(512,512,g=>{g.fillStyle='#d6bc88';g.fillRect(0,0,512,512);g.fillStyle='#792f32';g.fillRect(28,28,456,350);g.strokeStyle='#dfbe79';g.lineWidth=14;for(let i=0;i<6;i++){g.beginPath();g.arc(256,205,35+i*29,0,Math.PI*2);g.stroke();}g.fillStyle='#1f3534';g.fillRect(28,252,456,126);g.fillStyle='#eee0b8';g.font='bold 48px sans-serif';g.fillText('AFTER HOURS',42,306,428);g.font='21px monospace';g.fillText('FADE TUNES / VOL. 01',44,350);g.fillStyle='#492d25';g.font='bold 29px sans-serif';g.fillText('SQUABBLE CITY',32,438);});
  const sleeve=box([.55,.57,.026],new T.MeshStandardMaterial({map:albumArt,roughness:.9}),[-.39,1.45,-.34],vinyl);sleeve.rotation.x=-.10;

  // Cloth, sneakers, and a marked-up local noticeboard soften the primitives.
  const clothTexture = canvasTexture(128, 128, g => { g.fillStyle = '#aa7246'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 128; i += 16) { g.fillStyle = '#283f38'; g.fillRect(i, 0, 6, 128); g.fillRect(0, i, 128, 4); } for (let y = 0; y < 128; y += 3) { g.fillStyle = '#e2c39038'; g.fillRect(0, y, 128, 1); } for (let x = 0; x < 128; x += 4) { g.fillStyle = '#161e1930'; g.fillRect(x, 0, 1, 128); } });
  const clothGeometry = new T.PlaneGeometry(1.03, 1.55, 24, 32), vertices = clothGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) { const x = vertices.getX(i), y = vertices.getY(i); vertices.setXYZ(i, x, .89 - Math.max(0, -y - .25) * 1.3 + Math.sin(x * 23 + y * 3) * .025, y + .18); }
  clothGeometry.computeVertexNormals();
  const cloth = add(clothGeometry, new T.MeshStandardMaterial({ map: clothTexture, roughness: 1, side: T.DoubleSide }), [.65, 0, .1], couch); cloth.rotation.y = .08;
  const shoeMaterial = standard('#cebe98'), shoeSole = standard('#263731');
  for (let i = 0; i < 2; i++) {
    const shoe = new T.Group(); shoe.position.set(2.05 + i * .32, .14, -3.75 + i * .14); shoe.rotation.y = -.3 + i * .2; root.add(shoe);
    const sole = add(new T.SphereGeometry(1, 16, 8), shoeSole, [0, -.025, 0], shoe); sole.scale.set(.14, .06, .29);
    const upper = add(new T.SphereGeometry(1, 16, 8), shoeMaterial, [0, .015, -.01], shoe); upper.scale.set(.125, .11, .255);
    for (let j = 0; j < 4; j++) box([.16, .014, .018], ivory, [0, .12, -.03 + j * .045], shoe);
  }
  // Warm lamp light on the fan, with gentle fill to keep the corners readable.
  const fan = new T.Group(); fan.position.set(.1, 4.28, .05); root.add(fan); cylinder(.07, .28, brass, [0, .14, 0], fan);
  const rotor = new T.Group(); fan.add(rotor); cylinder(.2, .08, black, [0, -.04, 0], rotor);
  for (let i = 0; i < 4; i++) { const blade = box([.3, .035, 1], walnut, [0, -.06, .56], rotor); blade.position.set(Math.sin(i * Math.PI / 2) * .56, -.06, Math.cos(i * Math.PI / 2) * .56); blade.rotation.y = i * Math.PI / 2; }
  const fanGlow = standard('#efd0a0'); fanGlow.emissive = new T.Color('#ffb568'); fanGlow.emissiveIntensity = 1.6;
  // Suspend an upright bowl below the rotor: the blade sweep ends at -.0775,
  // while the fixture starts at -.24, leaving clear space through a full turn.
  cylinder(.075, .16, brass, [0, -.16, 0], fan);
  cylinder(.35, .035, brass, [0, -.26, 0], fan);
  add(new T.SphereGeometry(.34, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), fanGlow, [0, -.28, 0], fan);
  const fanLight = new T.PointLight('#ffd29a', 34, 13, 1.65); fanLight.position.set(0, -.66, 0); fan.add(fanLight);
  let playing = false, disposed = false;
  return {
    status: () => ({ playing, recordAngle: record.rotation.y, fanAngle: rotor.rotation.y, ceilingVisible: ceiling.visible }),
    vinyl, profileShelf, dynamicObjects: [record, rotor, ceiling, profileShelf],
    resize() { ceiling.visible = innerWidth / innerHeight >= .95; },
    setMusic(value) { playing = Boolean(value); led.emissiveIntensity = playing ? 2.4 : 1.1; },
    setProfile,
    setNight(night) { cityMaterial.map = cityTextures[night ? 1 : 0]; windowLight.color.set(night ? '#7eabc9' : '#e7c095'); windowLight.intensity = night ? 10 : 8; backLight.color.set(night ? '#e6b37c' : '#d9b78e'); backLight.intensity = night ? 4.5 : 4; fanLight.color.set(night ? '#ffd19a' : '#ffdcaf'); fanLight.intensity = night ? 15 : 25; bulb.emissive.set(night ? '#ffd5a1' : '#c8d6d3'); bulb.emissiveIntensity = night ? 1.7 : 1.25; fanGlow.emissiveIntensity = night ? 1.9 : 1.6; poolMaterial.opacity = night ? .66 : .14; shaftMaterial.color.set(night ? '#7eb9ec' : '#ffd28c'); shaftMaterial.opacity = night ? .21 : .26; rainMaterial.uniforms.strength.value = night ? 1 : .35; },
    update(time, dt, reduced) {
      const dirty = fontDirty; fontDirty = false;
      if (reduced) return dirty;
      rainMaterial.uniforms.time.value = time;
      rotor.rotation.y += dt * .45;
      if (playing) record.rotation.y -= dt * 3.49;
      return dirty;
    },
    dispose() { disposed = true; if (profileImage) profileImage.onload = null; cityTextures.forEach(texture => texture.dispose()); shaftTexture.dispose(); }
  };
}
