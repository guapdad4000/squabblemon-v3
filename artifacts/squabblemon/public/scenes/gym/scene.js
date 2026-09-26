import * as THREE from '../shared/three.module.js';
let disposed=false,sceneInitialized=false;
let armed=false,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const emit=payload=>parent.postMessage({channel:'squabblemon-scene',...payload},location.origin);
const AudioEngine={
  enabled:false,
  context:null,
  sampleRoot:new URL('../../audio/sfx/gacha/',location.href),
  init(){
    if(!this.enabled)return;
    try{this.context??=new AudioContext();this.context.resume();}catch{}
    for(const name of ['jab','hook','finisher','knockout'])this.preload(name);
  },
  source(name){
    const probe=document.createElement('audio');
    const extension=probe.canPlayType('audio/ogg; codecs=\"vorbis\"')?'ogg':'m4a';
    return new URL(`${name}.${extension}`,this.sampleRoot).href;
  },
  preload(name){
    const audio=new Audio(this.source(name));
    audio.preload='auto';
  },
  sample(name,volume=.82){
    if(!this.enabled)return;
    const audio=new Audio(this.source(name));
    audio.volume=volume;
    audio.play().catch(()=>this.tone(name==='knockout'?52:95,name==='knockout'?.5:.14));
  },
  playPunch(intensity='normal'){
    this.sample(intensity==='finisher'?'finisher':intensity==='heavy'?'hook':'jab',intensity==='finisher'?1:.84);
  },
  playKO(){this.sample('knockout',1)},
  tone(hz,duration){
    if(!this.enabled)return;
    this.init();
    const c=this.context;
    if(!c)return;
    const o=c.createOscillator(),g=c.createGain();
    o.frequency.setValueAtTime(hz,c.currentTime);
    o.frequency.exponentialRampToValueAtTime(28,c.currentTime+duration);
    g.gain.setValueAtTime(.16,c.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);
    o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration);
    o.onended=()=>{o.disconnect();g.disconnect()}
  }
};
    function createPunchingBagTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 2048;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#08090b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.offset.x = .5;
      bagSurfaceCanvas = canvas;
      bagSurfaceCtx = ctx;
      bagSurfaceTexture = texture;
      bagBasePixels = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const wrap = new Image();
      wrap.decoding = "async";
      wrap.onload = () => {
        // The production panel includes dark presentation bands above and below
        // the printable artwork. Crop those bands so the wrap reaches both ends
        // of the bag instead of leaving an unbranded cap and base.
        const cropY = Math.round(wrap.naturalHeight * 0.095);
        const cropHeight = wrap.naturalHeight - cropY * 2;
        ctx.drawImage(
          wrap,
          0,
          cropY,
          wrap.naturalWidth,
          cropHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        bagBasePixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        texture.needsUpdate = true;
      };
      wrap.onerror = () => emit({type:"error",message:"The bag wrap could not be loaded."});
      wrap.src = new URL("../../brand/prismatic/sheets/squabblemon-bag-wrap-standard-gold.webp", location.href).href;
      return texture;
    }

    function createGlovePatchTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#080a11";
      ctx.fillRect(0, 0, 512, 256);
      ctx.lineWidth = 12;
      ctx.strokeStyle = "#d4a438";
      ctx.strokeRect(6, 6, 500, 244);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const emblem = new Image();
      emblem.onload = () => {
        if (disposed) return;
        const scale = Math.min(224 / emblem.naturalWidth, 224 / emblem.naturalHeight);
        const width = emblem.naturalWidth * scale, height = emblem.naturalHeight * scale;
        ctx.drawImage(emblem, (512 - width) / 2, (256 - height) / 2, width, height);
        texture.needsUpdate = true;
      };
      emblem.src = new URL('../../brand/prismatic/marks/impact-standard-gold.webp', import.meta.url).href;
      return texture;
    }
    let scene, camera, renderer;
    let gymGroup, bagAssembly, heavyBagMesh;
    let bagOriginalPositions, bagVertexDents;
    let leftGloveMesh, rightGloveMesh;
    let gloveGhosts = [];
    let cardMeshStack = [];
    let sharedCardBackTexture;
    let spotLight, rimCyan, rimGold, heavyBagMaterial;
    let bagSurfaceCanvas, bagSurfaceCtx, bagSurfaceTexture, bagBasePixels;

    function createAnimeOutline(geometry, thickness = 0.05) {
      const outlineGeo = geometry.clone();
      const pos = outlineGeo.attributes.position;
      const norm = outlineGeo.attributes.normal;

      if (norm) {
        for (let i = 0; i < pos.count; i++) {
          pos.setXYZ(
            i,
            pos.getX(i) + norm.getX(i) * thickness,
            pos.getY(i) + norm.getY(i) * thickness,
            pos.getZ(i) + norm.getZ(i) * thickness
          );
        }
        outlineGeo.computeVertexNormals();
      }

      const outlineMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide
      });
      return new THREE.Mesh(outlineGeo, outlineMat);
    }

    function getContainerSize() {
      const container = document.getElementById("webgl-container");
      const w = container && container.clientWidth > 0 ? container.clientWidth : window.innerWidth;
      const h = container && container.clientHeight > 0 ? container.clientHeight : window.innerHeight;
      return { w: Math.max(w, 320), h: Math.max(h, 240) };
    }

    function init3DExperience() {
      const container = document.getElementById("webgl-container");
      if (!container) return;

      const size = getContainerSize();

      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(45, size.w / size.h, 0.1, 100);
      camera.position.set(0, 0.35, 10.2);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(size.w, size.h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      
      // Clean up previous canvas if any
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      container.appendChild(renderer.domElement);

      const ambient = new THREE.HemisphereLight(0xfff1d2, 0x272016, 1.6);
      scene.add(ambient);

      spotLight = new THREE.SpotLight(0xfffbeb, 95, 22, Math.PI * 0.3, 0.4);
      spotLight.position.set(0, 8.0, 1.4);
      spotLight.target.position.set(0, -0.5, 0);
      scene.add(spotLight);
      scene.add(spotLight.target);

      rimCyan = new THREE.DirectionalLight(0x38bdf8, 2.2);
      rimCyan.position.set(-6, 2.5, -4);
      scene.add(rimCyan);

      rimGold = new THREE.DirectionalLight(0xf59e0b, 2.4);
      rimGold.position.set(6, -0.5, -3);
      scene.add(rimGold);

      
      buildGymEnvironment();
      buildHeavyBag();
      buildGloves();


      setupSpeedLines();
      setupImpactFrames();
      bindInteractions();

      window.addEventListener("resize", onWindowResize);

      // Listen for container layout shifts
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => onWindowResize());
        ro.observe(container);
      }

      // Re-trigger layout after first frame
      requestAnimationFrame(() => onWindowResize());

      animateLoop();
    }

    function buildGymEnvironment() {
      gymGroup = new THREE.Group();
      scene.add(gymGroup);

      const mountGeo = new THREE.CylinderGeometry(0.42, 0.55, 0.35, 16);
      const mountMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.25 });
      const mount = new THREE.Mesh(mountGeo, mountMat);
      mount.position.set(0, 4.3, 0);
      gymGroup.add(mount);
    }

    function buildHeavyBag() {
      bagAssembly = new THREE.Group();
      bagAssembly.position.set(0, 3.8, 0);
      scene.add(bagAssembly);

      buildInterlockingChains(bagAssembly);

      const bagRadius = 1.18;
      const bagHeight = 4.1;
      const bagGeo = new THREE.CylinderGeometry(bagRadius, bagRadius, bagHeight, 48, 48);

      const pos = bagGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const bulge = Math.sin(((y + bagHeight * 0.5) / bagHeight) * Math.PI) * 0.14;
        pos.setX(i, pos.getX(i) * (1 + bulge));
        pos.setZ(i, pos.getZ(i) * (1 + bulge));
      }
      bagGeo.computeVertexNormals();

      bagOriginalPositions = new Float32Array(pos.array);
      bagVertexDents = new Float32Array(pos.count * 3);

      const bagTex = createPunchingBagTexture();
      heavyBagMaterial = new THREE.MeshStandardMaterial({
        map: bagTex,
        roughness: 0.56,
        metalness: 0.08,
        emissive: 0x090200,
        emissiveIntensity: 0.1
      });

      heavyBagMesh = new THREE.Mesh(bagGeo, heavyBagMaterial);
      heavyBagMesh.position.set(0, -3.2, 0);

      const bagOutline = createAnimeOutline(bagGeo, 0.065);
      heavyBagMesh.add(bagOutline);

      bagAssembly.add(heavyBagMesh);
    }

    function buildInterlockingChains(parent) {
      const chainMat = new THREE.MeshStandardMaterial({
        color: 0xd4d4d8,
        metalness: 0.95,
        roughness: 0.18
      });

      for (let c = 0; c < 4; c++) {
        const ang = (c * Math.PI) / 2;
        const radius = 0.92;
        const targetX = Math.cos(ang) * radius;
        const targetZ = Math.sin(ang) * radius;

        const linksCount = 7;
        const start = new THREE.Vector3(0, 0, 0);
        const end = new THREE.Vector3(targetX, -1.25, targetZ);

        for (let l = 0; l < linksCount; l++) {
          const t = (l + 0.5) / linksCount;
          const linkPos = new THREE.Vector3().lerpVectors(start, end, t);

          const torusGeo = new THREE.TorusGeometry(0.085, 0.024, 8, 14);
          const linkMesh = new THREE.Mesh(torusGeo, chainMat);
          linkMesh.position.copy(linkPos);

          linkMesh.lookAt(end);
          if (l % 2 === 0) {
            linkMesh.rotateZ(Math.PI * 0.5);
          }
          parent.add(linkMesh);
        }
      }
    }

    function buildGloves() {
      const patchTex = createGlovePatchTexture();

      function createGloveMesh(isLeft) {
        const group = new THREE.Group();

        const fistGeo = new THREE.SphereGeometry(0.52, 22, 18);
        fistGeo.scale(1.15, 1.25, 1.45);
        const leatherMat = new THREE.MeshStandardMaterial({
          color: 0xd97706,
          roughness: 0.32,
          metalness: 0.28
        });
        const fist = new THREE.Mesh(fistGeo, leatherMat);
        fist.add(createAnimeOutline(fistGeo, 0.045));
        group.add(fist);

        const ridgeGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.22, 16);
        ridgeGeo.scale(1.1, 1.0, 1.3);
        const ridge = new THREE.Mesh(ridgeGeo, leatherMat);
        ridge.rotation.z = Math.PI * 0.5;
        ridge.position.set(0, 0.1, 0.15);
        group.add(ridge);

        const thumbGeo = new THREE.SphereGeometry(0.24, 16, 12);
        thumbGeo.scale(0.85, 1.35, 0.9);
        const thumb = new THREE.Mesh(thumbGeo, leatherMat);
        thumb.position.set(isLeft ? 0.38 : -0.38, -0.05, 0.18);
        thumb.rotation.z = isLeft ? -0.42 : 0.42;
        thumb.add(createAnimeOutline(thumbGeo, 0.038));
        group.add(thumb);

        const cuffGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.5, 20);
        const cuffMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.55 });
        const cuff = new THREE.Mesh(cuffGeo, cuffMat);
        cuff.position.set(0, -0.5, -0.38);
        cuff.rotation.x = 0.52;
        cuff.add(createAnimeOutline(cuffGeo, 0.04));
        group.add(cuff);

        const patchGeo = new THREE.PlaneGeometry(0.42, 0.22);
        const patchMat = new THREE.MeshBasicMaterial({ map: patchTex, side: THREE.DoubleSide });
        const patch = new THREE.Mesh(patchGeo, patchMat);
        patch.position.set(0, -0.48, -0.15);
        patch.rotation.x = 0.52;
        group.add(patch);

        return group;
      }

      leftGloveMesh = createGloveMesh(true);
      leftGloveMesh.position.set(-1.35, -1.25, 5.8);
      scene.add(leftGloveMesh);

      rightGloveMesh = createGloveMesh(false);
      rightGloveMesh.position.set(1.35, -1.25, 5.8);
      scene.add(rightGloveMesh);
    }


    let speedlineCanvas, speedlineCtx;
    let impactCanvas, impactCtx;
    let speedlineIntensity = 0;
    let activeImpactFrameTimer = 0;
    let hitStopRemaining = 0;

    function setupSpeedLines() {
      speedlineCanvas = document.getElementById("speedline-canvas");
      if (speedlineCanvas) {
        speedlineCtx = speedlineCanvas.getContext("2d");
        resizeSpeedlines();
      }
    }

    function setupImpactFrames() {
      impactCanvas = document.getElementById("impact-frame-canvas");
      if (impactCanvas) {
        impactCtx = impactCanvas.getContext("2d");
        resizeImpactCanvas();
      }
    }

    function resizeSpeedlines() {
      if (!speedlineCanvas) return;
      speedlineCanvas.width = window.innerWidth;
      speedlineCanvas.height = window.innerHeight;
    }

    function resizeImpactCanvas() {
      if (!impactCanvas) return;
      impactCanvas.width = window.innerWidth;
      impactCanvas.height = window.innerHeight;
    }

    function triggerImpactFrame(type = "mono", durationFrames = 2) {
      activeImpactFrameTimer = durationFrames;
      const body = document.body;
      if (type === "mono") {
        body.classList.add("impact-frame-active");
      } else if (type === "crimson") {
        body.classList.add("crimson-frame-active");
      }
    }

    function clearImpactFrame() {
      document.body.classList.remove("impact-frame-active", "crimson-frame-active");
    }

    function renderImpactFrameCanvas() {
      if (!impactCtx) return;
      impactCtx.clearRect(0, 0, impactCanvas.width, impactCanvas.height);

      if (activeImpactFrameTimer > 0) {
        activeImpactFrameTimer--;
        if (activeImpactFrameTimer <= 0) {
          clearImpactFrame();
        }

        const w = impactCanvas.width;
        const h = impactCanvas.height;
        const cx = w * 0.5;
        const cy = h * 0.45;

        impactCtx.save();
        impactCtx.strokeStyle = "#ffffff";
        impactCtx.lineWidth = 6;
        for (let i = 0; i < 24; i++) {
          const ang = Math.random() * Math.PI * 2;
          const len = Math.random() * Math.max(w, h);
          impactCtx.beginPath();
          impactCtx.moveTo(cx, cy);
          impactCtx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
          impactCtx.stroke();
        }
        impactCtx.restore();
      }
    }

    function renderSpeedLines() {
      if (!speedlineCtx) return;
      speedlineCtx.clearRect(0, 0, speedlineCanvas.width, speedlineCanvas.height);

      if (speedlineIntensity <= 0.02) return;

      const cx = speedlineCanvas.width * 0.5;
      const cy = speedlineCanvas.height * 0.5;
      const linesCount = Math.floor(speedlineIntensity * 52);

      speedlineCtx.save();
      speedlineCtx.strokeStyle = `rgba(255, 255, 255, ${speedlineIntensity * 0.5})`;
      speedlineCtx.lineWidth = 3 + speedlineIntensity * 5;

      for (let i = 0; i < linesCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        const outerR = Math.max(cx, cy) * 1.25;
        const innerR = (1 - speedlineIntensity * 0.55) * 220 + Math.random() * 80;

        speedlineCtx.beginPath();
        speedlineCtx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR);
        speedlineCtx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR);
        speedlineCtx.stroke();
      }
      speedlineCtx.restore();
    }

    /* =========================================================
       3D COMIC ONOMATOPOEIA (SFX), CEL SHOCKWAVES & SPARKS
       ========================================================= */
    const activeSparks = [];
    const activeShockwaves = [];
    const activeComicSFX = [];
    const COMIC_WORDS = ["BAM!", "CRACK!", "POW!", "SMACK!", "ORA!", "WHAM!"];

    function createComicSFXTexture(word) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");

      ctx.save();
      ctx.translate(256, 128);
      ctx.beginPath();
      const points = 16;
      for (let i = 0; i < points; i++) {
        const rad = i % 2 === 0 ? 115 : 65;
        const th = (i * Math.PI) / (points / 2);
        ctx.lineTo(Math.cos(th) * rad, Math.sin(th) * rad);
      }
      ctx.closePath();
      ctx.fillStyle = "#ef4444";
      ctx.lineWidth = 14;
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      ctx.fill();

      ctx.font = "900 115px 'Bangers', cursive";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 22;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(word, 0, 4);

      ctx.fillStyle = "#fde047";
      ctx.fillText(word, 0, 4);
      ctx.restore();

      return new THREE.CanvasTexture(canvas);
    }

    function spawnComicSFX(x, y, z) {
      const word = COMIC_WORDS[Math.floor(Math.random() * COMIC_WORDS.length)];
      const tex = createComicSFXTexture(word);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const geo = new THREE.PlaneGeometry(1.6, 0.8);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, z + 0.3);
      mesh.rotation.z = (Math.random() - 0.5) * 0.35;
      mesh.userData = { life: 0.35, maxLife: 0.35 };
      scene.add(mesh);
      activeComicSFX.push(mesh);
    }

    function spawnShockwave(x, y, z, scaleMultiplier = 1.0) {
      const ringGeo = new THREE.RingGeometry(0.15, 0.35, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(x, y, z);
      ring.userData = {
        life: 0.28,
        maxLife: 0.28,
        growth: 9.5 * scaleMultiplier
      };
      scene.add(ring);
      activeShockwaves.push(ring);
    }

    function spawnHitSpark(x, y, z, isBig = false) {
      const sparkCount = isBig ? 24 : 10;
      const geo = new THREE.PlaneGeometry(0.35, 0.35);
      const colors = [0xfacc15, 0xffffff, 0xef4444, 0xf97316];

      for (let i = 0; i < sparkCount; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: colors[i % colors.length],
          side: THREE.DoubleSide
        });
        const spark = new THREE.Mesh(geo, mat);
        spark.position.set(
          x + (Math.random() - 0.5) * 0.6,
          y + (Math.random() - 0.5) * 0.8,
          z + (Math.random() - 0.5) * 0.4
        );
        spark.userData = {
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * (isBig ? 14 : 8),
            (Math.random() - 0.5) * (isBig ? 14 : 8),
            Math.random() * (isBig ? 8 : 4) + 2
          ),
          life: isBig ? 0.6 : 0.35
        };
        scene.add(spark);
        activeSparks.push(spark);
      }
    }

    function dentHeavyBag(hitY, intensity = 0.25) {
      if (!heavyBagMesh) return;
      const pos = heavyBagMesh.geometry.attributes.position;
      const count = pos.count;

      for (let i = 0; i < count; i++) {
        const y = pos.getY(i);
        const z = pos.getZ(i);

        if (z > 0.4 && Math.abs(y - hitY) < 1.1) {
          const dist = Math.abs(y - hitY);
          const factor = Math.max(0, 1 - dist / 1.1);
          bagVertexDents[i * 3 + 2] = -intensity * factor;
        }
      }
    }

    const OMEN_LIGHTS = {
      SuperCommon: { key: 0xd7c7ab, left: 0x9c8b72, right: 0xd7c7ab, floor: 0x17120d },
      Common: { key: 0xfff1d2, left: 0x8b9a93, right: 0xd6b778, floor: 0x15140f },
      Uncommon: { key: 0xc9ffd7, left: 0x36d67d, right: 0xd6b778, floor: 0x07190e },
      Rare: { key: 0xd8eaff, left: 0x3b82f6, right: 0x72d8ff, floor: 0x071225 },
      Epic: { key: 0xf1dcff, left: 0xa855f7, right: 0xe85d9e, floor: 0x190722 },
      Legendary: { key: 0xffedb0, left: 0xf5b829, right: 0xffe08a, floor: 0x231704 },
      Mythical: { key: 0xffd6c7, left: 0xef3340, right: 0xffa62b, floor: 0x260408 }
    };

    function applyOmen(rarity = "Common") {
      const colors = OMEN_LIGHTS[rarity] || OMEN_LIGHTS.Common;
      spotLight?.color.setHex(colors.key);
      rimCyan?.color.setHex(colors.left);
      rimGold?.color.setHex(colors.right);
      if (spotLight) spotLight.intensity = rarity === "Mythical" ? 125 : rarity === "Legendary" ? 112 : 95;
      if (rimCyan) rimCyan.intensity = rarity === "Mythical" ? 4.8 : rarity === "Legendary" ? 3.7 : 2.6;
      if (rimGold) rimGold.intensity = rarity === "Mythical" ? 4.1 : rarity === "Legendary" ? 4.4 : 2.8;
      heavyBagMaterial?.emissive.setHex(colors.floor);
      if (heavyBagMaterial) heavyBagMaterial.emissiveIntensity = rarity === "Mythical" ? 0.38 : 0.16;
    }

    function paintBagDamage(stage = 0) {
      if (!bagSurfaceCtx || !bagSurfaceTexture || !bagBasePixels) return;
      bagSurfaceCtx.putImageData(bagBasePixels, 0, 0);
      const tears = [
        [[-145,-60],[-70,-20],[-115,25],[-20,62],[55,35],[128,82]],
        [[-120,-72],[-40,-28],[-85,18],[15,58],[96,24],[145,70]],
        [[-160,-35],[-92,12],[-125,57],[-24,84],[64,48],[148,98]]
      ];
      for (let level = 0; level < stage; level++) {
        for (const centerX of [bagSurfaceCanvas.width * .5]) {
          const centerY = bagSurfaceCanvas.height * (.46 + level * .12);
          const points = tears[level];
          bagSurfaceCtx.save();
          bagSurfaceCtx.translate(centerX, centerY);
          bagSurfaceCtx.beginPath();
          points.forEach(([x,y], index) => index ? bagSurfaceCtx.lineTo(x,y) : bagSurfaceCtx.moveTo(x,y));
          bagSurfaceCtx.lineCap = "round";
          bagSurfaceCtx.lineJoin = "round";
          bagSurfaceCtx.strokeStyle = "rgba(20,8,4,.92)";
          bagSurfaceCtx.lineWidth = 34 - level * 5;
          bagSurfaceCtx.stroke();
          bagSurfaceCtx.strokeStyle = level === 2 ? "#f3d58d" : "#e7b45d";
          bagSurfaceCtx.lineWidth = 7;
          bagSurfaceCtx.setLineDash([20, 16]);
          bagSurfaceCtx.stroke();
          bagSurfaceCtx.setLineDash([]);
          bagSurfaceCtx.restore();
        }
      }
      bagSurfaceTexture.needsUpdate = true;
    }

    /* =========================================================
       PUNCH FLURRY LOGIC, HIT-STOP & FINALE CLIMAX
       ========================================================= */
    let punchHits = 0;
    let targetKoHits = 12;
    let hitsPerPunch = 1;
    let isGachaTriggered = false;
    let autoRushInterval = null;

    let bagAngle = { x: 0, z: 0 };
    let bagVelocity = { x: 0, z: 0 };
    let screenShake = 0;
    let currentHand = "left";

    function deliverPunch(requestedIntensity) {
      if (isGachaTriggered || !armed) return;

      const nextRatio = Math.min((punchHits + hitsPerPunch) / targetKoHits, 1);
      const automaticIntensity = nextRatio >= 1 ? "finisher" : nextRatio > 0.34 ? "heavy" : "normal";
      const intensityRank = { normal: 0, heavy: 1, finisher: 2 };
      const intensity = requestedIntensity && intensityRank[requestedIntensity] > intensityRank[automaticIntensity]
        ? requestedIntensity
        : automaticIntensity;
      const impactBoost = intensity === "finisher" ? 1.85 : intensity === "heavy" ? 1.35 : 1;
      punchHits = Math.min(targetKoHits, punchHits + hitsPerPunch); emit({type:"hit",hits:punchHits});
      AudioEngine.init();

      const heatRatio = Math.min(punchHits / targetKoHits, 1.0);
      const speedFactor = (1.0 + heatRatio * 2.8) * impactBoost;

      AudioEngine.playPunch(intensity);
      screenShake = reduced ? 0 : Math.min(0.2, (0.025 + heatRatio * 0.07) * impactBoost);

      hitStopRemaining = intensity === "finisher" ? 6 : intensity === "heavy" ? 3 : 1;

      if (intensity !== "normal") {
        triggerImpactFrame(intensity === "finisher" ? "crimson" : "mono", intensity === "finisher" ? 5 : 2);
      }

      const pushX = (currentHand === "left" ? 0.38 : -0.38) * (0.8 + heatRatio * 0.8) * impactBoost;
      const pushZ = -0.75 * (1.0 + heatRatio * 1.0) * impactBoost;
      bagVelocity.z += pushZ;
      bagVelocity.x += pushX;

      dentHeavyBag(0.1, (0.22 + heatRatio * 0.25) * impactBoost);
      paintBagDamage(Math.min(3, Math.ceil(heatRatio * 3)));

      animateGloveJab(currentHand, speedFactor);
      currentHand = currentHand === "left" ? "right" : "left";

      const contactZ = 0.9;
      spawnHitSpark(pushX * 0.5, 0.2, contactZ, intensity === "finisher");
      spawnShockwave(pushX * 0.3, 0.2, contactZ, (0.8 + heatRatio * 0.8) * impactBoost);
      if (intensity !== "normal") {
        spawnComicSFX(pushX * 0.4, 0.4, contactZ);
      }

      speedlineIntensity = reduced ? 0 : Math.min(0.35, speedlineIntensity + 0.10);
      updateComboHud(heatRatio);

      if (punchHits >= targetKoHits) {
        triggerGachaKnockout();
      }
    }

    function animateGloveJab(hand, speed) {
      const glove = hand === "left" ? leftGloveMesh : rightGloveMesh;
      if (!glove) return;

      const restPos = hand === "left" ? new THREE.Vector3(-1.35, -1.25, 5.8) : new THREE.Vector3(1.35, -1.25, 5.8);
      const targetPos = new THREE.Vector3((hand === "left" ? -0.35 : 0.35), 0.2, 2.1);

      const startTime = performance.now();
      const duration = Math.max(85, 210 / speed);

      if (speed > 1.8) {
        spawnGloveGhost(glove);
      }

      function stepJab(now) {
        const p = (now - startTime) / duration;
        if (p < 0.38) {
          const f = p / 0.38;
          glove.position.lerpVectors(restPos, targetPos, f);
        } else if (p < 1.0) {
          const f = (p - 0.38) / 0.62;
          glove.position.lerpVectors(targetPos, restPos, f);
        } else {
          glove.position.copy(restPos);
          return;
        }
        requestAnimationFrame(stepJab);
      }
      requestAnimationFrame(stepJab);
    }

    function spawnGloveGhost(originalGlove) {
      const ghostMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending
      });
      const ghost = originalGlove.clone();
      ghost.traverse((child) => {
        if (child.isMesh) child.material = ghostMat;
      });
      ghost.position.copy(originalGlove.position);
      ghost.userData = { life: 0.12, maxLife: 0.12 };
      scene.add(ghost);
      gloveGhosts.push(ghost);
    }


function updateComboHud(){}
function triggerGachaKnockout(){if(isGachaTriggered)return;isGachaTriggered=true;armed=false;AudioEngine.playKO();spawnShockwave(0,0,1.2,2);emit({type:'complete'});}
function bindInteractions(){document.getElementById('webgl-container').addEventListener('pointerdown',()=>{if(!reduced)deliverPunch()});}
addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==parent||e.data?.channel!=='squabblemon-scene')return;
 const d=e.data;
 if(d.type==='settings'){reduced=Boolean(d.reducedMotion)||matchMedia('(prefers-reduced-motion: reduce)').matches;AudioEngine.enabled=Boolean(d.sound);}
  if(d.type==='arm'){punchHits=0;targetKoHits=Number.isInteger(d.targetHits)&&d.targetHits>0?d.targetHits:3;hitsPerPunch=Number.isInteger(d.hitsPerPunch)&&d.hitsPerPunch>0?d.hitsPerPunch:1;isGachaTriggered=false;paintBagDamage(0);applyOmen(d.omen);armed=true;if(camera){camera.position.z=camera.aspect<.75?14.8:12.9;camera.updateProjectionMatrix();}}
 if(d.type==='punch'&&!reduced)deliverPunch(d.intensity);
  if(d.type==='reset'){armed=false;punchHits=0;targetKoHits=3;hitsPerPunch=1;isGachaTriggered=false;bagVelocity={x:0,z:0};paintBagDamage(0);applyOmen("Common");if(camera){camera.position.z=camera.aspect<.75?11.6:10.2;camera.updateProjectionMatrix();}}
});
    function onWindowResize() {
      if (!renderer || !camera) return;
      const size = getContainerSize();
      camera.aspect = size.w / size.h;
      camera.position.z = armed
        ? (camera.aspect < .75 ? 14.8 : 12.9)
        : (camera.aspect < .75 ? 11.6 : 10.2);
      camera.updateProjectionMatrix();
      renderer.setSize(size.w, size.h);
      resizeSpeedlines();
      resizeImpactCanvas();
    }

    /* =========================================================
       MAIN RENDER LOOP: SIMULATION & REAL-TIME VERTEX DENTING
       ========================================================= */
    const clock = new THREE.Clock();

    function animateLoop() {
      requestAnimationFrame(animateLoop);

      if(document.hidden||disposed)return;
      if (hitStopRemaining > 0) {
        hitStopRemaining--;
        renderImpactFrameCanvas();
        renderSpeedLines();
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
        return;
      }

      const delta = Math.min(clock.getDelta(), 0.04);
      const time = clock.elapsedTime;

      if (bagAssembly) {
        const springK = 14.5;
        const damping = 0.93;

        bagVelocity.x += -springK * bagAngle.x * delta;
        bagVelocity.z += -springK * bagAngle.z * delta;

        bagVelocity.x *= damping;
        bagVelocity.z *= damping;

        bagAngle.x += bagVelocity.x * delta;
        bagAngle.z += bagVelocity.z * delta;

        bagAssembly.rotation.x = bagAngle.z;
        bagAssembly.rotation.z = -bagAngle.x;
        bagAssembly.rotation.y = reduced ? 0 : Math.sin(time * 0.8) * 0.025;
      }

      if (heavyBagMesh && bagOriginalPositions) {
        const pos = heavyBagMesh.geometry.attributes.position;
        let needsUpdate = false;
        const reboundSpeed = 4.5;

        for (let i = 0; i < pos.count; i++) {
          const dentZ = bagVertexDents[i * 3 + 2];
          if (Math.abs(dentZ) > 0.001) {
            bagVertexDents[i * 3 + 2] *= Math.max(0, 1 - reboundSpeed * delta);
            pos.setZ(i, bagOriginalPositions[i * 3 + 2] + bagVertexDents[i * 3 + 2]);
            needsUpdate = true;
          }
        }
        if (needsUpdate) {
          pos.needsUpdate = true;
          heavyBagMesh.geometry.computeVertexNormals();
        }
      }

      if (screenShake > 0.001) {
        camera.position.x = (Math.random() - 0.5) * screenShake;
        camera.position.y = 0.35 + (Math.random() - 0.5) * screenShake;
        screenShake *= 0.86;
      } else {
        camera.position.x = 0;
        camera.position.y = 0.35;
      }

      if (isGachaTriggered) {
        cardMeshStack.forEach((card, i) => {
          card.position.y = card.userData.fanPos.y + Math.sin(time * 2.2 + i * 0.7) * 0.08;
          if (card.userData.data.isFoil) {
            card.rotation.y = card.userData.fanRot.y + Math.sin(time * 3.0) * 0.08;
          }
        });
      }

      for (let i = gloveGhosts.length - 1; i >= 0; i--) {
        const ghost = gloveGhosts[i];
        ghost.userData.life -= delta;
        if (ghost.userData.life <= 0) {
          scene.remove(ghost); const materials=new Set();ghost.traverse(c=>{if(c.isMesh)materials.add(c.material)});materials.forEach(m=>m.dispose());
          gloveGhosts.splice(i, 1);
        }
      }

      for (let i = activeComicSFX.length - 1; i >= 0; i--) {
        const sfx = activeComicSFX[i];
        sfx.userData.life -= delta;
        const prog = 1 - (sfx.userData.life / sfx.userData.maxLife);
        sfx.scale.setScalar(1.0 + prog * 0.6);
        sfx.position.y += delta * 0.8;
        sfx.material.opacity = Math.max(0, sfx.userData.life / sfx.userData.maxLife);

        if (sfx.userData.life <= 0) {
          scene.remove(sfx); sfx.geometry.dispose(); sfx.material.map?.dispose(); sfx.material.dispose();
          activeComicSFX.splice(i, 1);
        }
      }

      for (let i = activeShockwaves.length - 1; i >= 0; i--) {
        const sw = activeShockwaves[i];
        sw.userData.life -= delta;
        const prog = 1 - (sw.userData.life / sw.userData.maxLife);
        sw.scale.setScalar(1.0 + prog * sw.userData.growth);
        sw.material.opacity = Math.max(0, (sw.userData.life / sw.userData.maxLife) * 0.9);

        if (sw.userData.life <= 0) {
          scene.remove(sw); sw.geometry.dispose(); sw.material.dispose();
          activeShockwaves.splice(i, 1);
        }
      }

      for (let i = activeSparks.length - 1; i >= 0; i--) {
        const spark = activeSparks[i];
        spark.position.addScaledVector(spark.userData.velocity, delta);
        spark.userData.life -= delta;
        spark.scale.setScalar(Math.max(0.001, spark.userData.life * 3.0));

        if (spark.userData.life <= 0) {
          scene.remove(spark); spark.geometry.dispose(); spark.material.dispose();
          activeSparks.splice(i, 1);
        }
      }

      if (!isGachaTriggered) {
        speedlineIntensity = Math.max(0, speedlineIntensity - delta * 0.45);
      }
      renderSpeedLines();
      renderImpactFrameCanvas();

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    }


addEventListener('error',event=>{if(event.error)emit({type:'error',message:event.error.message});});
addEventListener('unhandledrejection',event=>emit({type:'error',message:String(event.reason || 'The gym could not be rendered.')}));
try{init3DExperience();renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();armed=false;sceneInitialized=false;emit({type:'error'});});sceneInitialized=true;emit({type:'ready'});}catch(e){emit({type:'error',message:'The gym could not be rendered.'});}

addEventListener('pagehide',()=>{disposed=true;AudioEngine.context?.close();scene?.traverse(object=>{object.geometry?.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){if(!material)continue;for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}});renderer?.dispose();});

addEventListener('message', event => {
  if (event.origin === location.origin && event.source === parent && event.data?.channel === 'squabblemon-scene' && event.data.type === 'ping' && sceneInitialized && renderer && !disposed && !renderer.getContext().isContextLost()) emit({type:'ready'});
});
