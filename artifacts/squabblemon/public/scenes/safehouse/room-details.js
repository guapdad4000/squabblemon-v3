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
  const drawProfile = (image, name = 'YOUR PROFILE') => {
    const g = profileCanvas.getContext('2d'); g.fillStyle = '#151a1b'; g.fillRect(0, 0, 384, 480);
    g.fillStyle = '#d8c9a6'; g.fillRect(12, 12, 360, 456); g.fillStyle = '#202a2b'; g.fillRect(24, 24, 336, 432);
    if (image) { const scale = Math.min(322 / image.width, 356 / image.height); g.drawImage(image, (384 - image.width * scale) / 2, 34, image.width * scale, image.height * scale); }
    g.fillStyle = '#efe1be'; g.fillRect(24, 398, 336, 58); g.fillStyle = '#1b2221'; g.textAlign = 'center'; g.font = '900 24px sans-serif'; g.fillText(name.toUpperCase(), 192, 435, 310); profileTexture.needsUpdate = true;
  };
  drawProfile(null);
  box([.72, .9, .08], black, [.88, 1.7, 0], profileShelf);
  const profilePortrait = add(new T.PlaneGeometry(.64, .8), new T.MeshStandardMaterial({ map: profileTexture, roughness: .88 }), [.88, 1.7, .05], profileShelf); profilePortrait.castShadow = false;
  const setProfile = value => {
    if (!value?.image) { drawProfile(null, value?.name); return; }
    if (profileImage) profileImage.onload = null;
    profileImage = new Image(); profileImage.onload = () => { if (!disposed) drawProfile(profileImage, value.name); }; profileImage.src = value.image;
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
    g.fillStyle = '#0d1010'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#353c3a'; g.lineWidth = 1;
    for (let i = 82; i < 247; i += 5) { g.beginPath(); g.arc(256, 256, i, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#d5aa5e'; g.beginPath(); g.arc(256, 256, 78, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#252a25'; g.textAlign = 'center'; g.font = '900 24px sans-serif'; g.fillText('FADE TUNES', 256, 241); g.font = '12px monospace'; g.fillText('SQUABBLE CITY', 256, 269); g.fillText('AFTER HOURS', 256, 288);
  });
  const disc = add(new T.CircleGeometry(.285, 48), new T.MeshStandardMaterial({ map: recordTexture, metalness: .28, roughness: .5 }), [0, .015, 0], record); disc.rotation.x = -Math.PI / 2;
  cylinder(.008, .045, brass, [0, .025, 0], record);
  cylinder(.066,.072,black,[.43,1.174,-.21],vinyl);cylinder(.044,.065,brushed,[.43,1.23,-.21],vinyl);
  tube([[.43,1.26,-.29],[.43,1.26,-.16],[.39,1.245,.04],[.25,1.23,.15]],.012,brushed,vinyl);
  const counterweight=cylinder(.039,.07,brushed,[.43,1.26,-.29],vinyl);counterweight.rotation.x=Math.PI/2;
  box([.06,.035,.085],black,[.235,1.212,.175],vinyl);box([.025,.015,.038],paper,[.235,1.189,.185],vinyl);
  const led=standard('#d3a05f');led.emissive=new T.Color('#ffb653');led.emissiveIntensity=.3;
  box([.04,.008,.015],led,[.49,1.135,.24],vinyl);
  cylinder(.036,.012,black,[-.54,1.14,.25],vinyl);cylinder(.022,.014,brushed,[.43,1.14,.24],vinyl);
  box([.035,.005,.2],black,[.55,1.135,.025],vinyl);box([.052,.017,.027],brushed,[.55,1.145,.035],vinyl);
  const albumArt=canvasTexture(512,512,g=>{g.fillStyle='#d6bc88';g.fillRect(0,0,512,512);g.fillStyle='#792f32';g.fillRect(28,28,456,350);g.strokeStyle='#dfbe79';g.lineWidth=14;for(let i=0;i<6;i++){g.beginPath();g.arc(256,205,35+i*29,0,Math.PI*2);g.stroke();}g.fillStyle='#1f3534';g.fillRect(28,252,456,126);g.fillStyle='#eee0b8';g.font='bold 48px sans-serif';g.fillText('AFTER HOURS',42,306,428);g.font='21px monospace';g.fillText('FADE TUNES / VOL. 01',44,350);g.fillStyle='#492d25';g.font='bold 29px sans-serif';g.fillText('SQUABBLE CITY',32,438);});
  const sleeve=box([.55,.57,.026],new T.MeshStandardMaterial({map:albumArt,roughness:.9}),[-.39,1.45,-.34],vinyl);sleeve.rotation.x=-.10;

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
    setMusic(value) { playing = Boolean(value); led.emissiveIntensity = playing ? 2 : .3; },
    setProfile,
    setNight(night) { cityMaterial.map = cityTextures[night ? 1 : 0]; windowLight.color.set(night ? '#c1a98b' : '#edbc86'); windowLight.intensity = night ? 8 : 8; backLight.color.set('#d9b78e'); backLight.intensity = night ? 5 : 4; fanLight.intensity = night ? 22 : 25; poolMaterial.opacity = night ? .22 : .14; rainMaterial.uniforms.strength.value = night ? 1 : .35; },
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
    dispose() { disposed = true; if (profileImage) profileImage.onload = null; cityTextures.forEach(texture => texture.dispose()); }
  };
}
