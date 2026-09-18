import * as THREE from '../shared/three.module.js';
let disposed=false;
let armed=false,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const emit=payload=>parent.postMessage({channel:'squabblemon-scene',...payload},location.origin);
const AudioEngine={enabled:false,context:null,init(){if(!this.enabled)return;try{this.context??=new AudioContext();this.context.resume();}catch{}},playPunch(){this.tone(95,.14)},playKO(){this.tone(52,.5)},tone(hz,duration){if(!this.enabled)return;this.init();const c=this.context;if(!c)return;const o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(hz,c.currentTime);o.frequency.exponentialRampToValueAtTime(28,c.currentTime+duration);g.gain.setValueAtTime(.16,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration);o.onended=()=>{o.disconnect();g.disconnect()}}};
    function drawEmblem(ctx, cx, cy, scale = 1, showGloves = true) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      if (showGloves) {
        ctx.save();
        ctx.translate(-195, -15);
        ctx.rotate(-0.35);
        drawMiniGlove(ctx);
        ctx.restore();

        ctx.save();
        ctx.translate(195, -15);
        ctx.scale(-1, 1);
        ctx.rotate(-0.35);
        drawMiniGlove(ctx);
        ctx.restore();
      }

      ctx.beginPath();
      ctx.moveTo(-115, -70);
      ctx.lineTo(-145, -155);
      ctx.lineTo(-65, -120);
      ctx.lineTo(0, -180);
      ctx.lineTo(65, -120);
      ctx.lineTo(145, -155);
      ctx.lineTo(115, -70);
      ctx.closePath();

      const crownGrad = ctx.createLinearGradient(0, -180, 0, -70);
      crownGrad.addColorStop(0, "#fef08a");
      crownGrad.addColorStop(0.3, "#eab308");
      crownGrad.addColorStop(0.7, "#a16207");
      crownGrad.addColorStop(1, "#451a03");
      ctx.fillStyle = crownGrad;
      ctx.lineWidth = 18;
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, -75);
      ctx.lineTo(140, -35);
      ctx.lineTo(140, 85);
      ctx.lineTo(0, 180);
      ctx.lineTo(-140, 85);
      ctx.lineTo(-140, -35);
      ctx.closePath();

      const shieldGrad = ctx.createLinearGradient(-140, -75, 140, 180);
      shieldGrad.addColorStop(0, "#fde047");
      shieldGrad.addColorStop(0.3, "#ca8a04");
      shieldGrad.addColorStop(0.7, "#854d0e");
      shieldGrad.addColorStop(1, "#361a03");
      ctx.fillStyle = shieldGrad;
      ctx.lineWidth = 20;
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, -56);
      ctx.lineTo(118, -22);
      ctx.lineTo(118, 70);
      ctx.lineTo(0, 155);
      ctx.lineTo(-118, 70);
      ctx.lineTo(-118, -22);
      ctx.closePath();
      ctx.fillStyle = "#1c2e22";
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      ctx.fill();

      ctx.font = "900 120px 'Teko', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 20;
      ctx.strokeStyle = "#000000";
      ctx.strokeText("SM", 0, 36);

      const smGrad = ctx.createLinearGradient(0, -20, 0, 90);
      smGrad.addColorStop(0, "#ffffff");
      smGrad.addColorStop(0.3, "#fef08a");
      smGrad.addColorStop(0.7, "#d97706");
      smGrad.addColorStop(1, "#78350f");
      ctx.fillStyle = smGrad;
      ctx.fillText("SM", 0, 36);

      ctx.restore();
    }

    function drawMiniGlove(ctx) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 95, 120, 0.2, 0, Math.PI * 2);
      const gloveGrad = ctx.createLinearGradient(-60, -60, 60, 60);
      gloveGrad.addColorStop(0, "#d97706");
      gloveGrad.addColorStop(0.5, "#b45309");
      gloveGrad.addColorStop(1, "#451a03");
      ctx.fillStyle = gloveGrad;
      ctx.lineWidth = 16;
      ctx.strokeStyle = "#000000";
      ctx.stroke();
      ctx.fill();

      ctx.fillStyle = "#18181b";
      ctx.fillRect(-85, 95, 145, 60);
      ctx.lineWidth = 12;
      ctx.strokeStyle = "#000000";
      ctx.strokeRect(-85, 95, 145, 60);
    }

    function createPunchingBagTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 2048;
      canvas.height = 2048;
      const ctx = canvas.getContext("2d");

      const leatherGrad = ctx.createLinearGradient(0, 0, 2048, 0);
      leatherGrad.addColorStop(0, "#78350f");
      leatherGrad.addColorStop(0.15, "#a16207");
      leatherGrad.addColorStop(0.28, "#d97706");
      leatherGrad.addColorStop(0.5, "#b45309");
      leatherGrad.addColorStop(0.72, "#d97706");
      leatherGrad.addColorStop(0.85, "#a16207");
      leatherGrad.addColorStop(1, "#78350f");
      ctx.fillStyle = leatherGrad;
      ctx.fillRect(0, 0, 2048, 2048);

      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(255, 237, 213, 0.03)" : "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(Math.random() * 2048, Math.random() * 2048, 3, 3);
      }

      for (let x = 0; x <= 2048; x += 512) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 2048);
        ctx.stroke();

        ctx.strokeStyle = "rgba(254, 243, 199, 0.55)";
        ctx.lineWidth = 5;
        ctx.setLineDash([14, 14]);
        ctx.beginPath();
        ctx.moveTo(x - 14, 0);
        ctx.lineTo(x - 14, 2048);
        ctx.moveTo(x + 14, 0);
        ctx.lineTo(x + 14, 2048);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = "#121215";
      ctx.fillRect(0, 1620, 2048, 428);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 20;
      ctx.strokeRect(0, 1620, 2048, 428);

      ctx.fillStyle = "#121215";
      ctx.fillRect(0, 0, 2048, 260);
      ctx.strokeRect(0, 0, 2048, 260);

      for (let x = 256; x < 2048; x += 512) {
        ctx.fillStyle = "#27272a";
        ctx.fillRect(x - 55, 170, 110, 150);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 8;
        ctx.strokeRect(x - 55, 170, 110, 150);

        ctx.fillStyle = "#f4f4f5";
        ctx.beginPath();
        ctx.arc(x, 245, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      drawEmblem(ctx, 512, 920, 2.15, true);
      drawEmblem(ctx, 1536, 920, 2.15, true);

      ctx.save();
      ctx.font = "900 100px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 24;
      ctx.strokeStyle = "#000000";

      ctx.strokeText("SQUABBLEMON", 512, 1390, 670);
      ctx.fillStyle = "#fef08a";
      ctx.fillText("SQUABBLEMON", 512, 1390, 670);

      ctx.strokeText("SQUABBLEMON", 1536, 1390, 670);
      ctx.fillText("SQUABBLEMON", 1536, 1390, 670);
      ctx.restore();

      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = 8; texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping; texture.offset.x = .25;
      return texture;
    }

    function createGlovePatchTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 256);
      ctx.lineWidth = 24;
      ctx.strokeStyle = "#000000";
      ctx.strokeRect(12, 12, 488, 232);

      ctx.font = "900 180px 'Teko', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000000";
      ctx.fillText("SM", 256, 135);

      return new THREE.CanvasTexture(canvas);
    }

    function createGymFloorTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#0f1016";
      ctx.fillRect(0, 0, 1024, 1024);

      for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.3)";
        ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 4, 4);
      }

      ctx.strokeStyle = "rgba(234, 179, 8, 0.3)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(512, 512, 400, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(512, 512, 290, 0, Math.PI * 2);
      ctx.stroke();

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    }


    let scene, camera, renderer;
    let gymGroup, bagAssembly, heavyBagMesh;
    let bagOriginalPositions, bagVertexDents;
    let leftGloveMesh, rightGloveMesh;
    let gloveGhosts = [];
    let cardMeshStack = [];
    let sharedCardBackTexture;

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

      const spotLight = new THREE.SpotLight(0xfffbeb, 95, 22, Math.PI * 0.3, 0.4);
      spotLight.position.set(0, 8.0, 1.4);
      spotLight.target.position.set(0, -0.5, 0);
      scene.add(spotLight);
      scene.add(spotLight.target);

      const rimCyan = new THREE.DirectionalLight(0x38bdf8, 2.2);
      rimCyan.position.set(-6, 2.5, -4);
      scene.add(rimCyan);

      const rimGold = new THREE.DirectionalLight(0xf59e0b, 2.4);
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

      const floorGeo = new THREE.CircleGeometry(10, 32);
      const floorTex = createGymFloorTexture();
      const floorMat = new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.85,
        metalness: 0.1
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI * 0.5;
      floor.position.y = -3.4;
      gymGroup.add(floor);

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
      const bagMat = new THREE.MeshStandardMaterial({
        map: bagTex,
        roughness: 0.38,
        metalness: 0.22
      });

      heavyBagMesh = new THREE.Mesh(bagGeo, bagMat);
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
      return;
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

    function deliverPunch() {
      if (isGachaTriggered || !armed) return;

      punchHits = Math.min(targetKoHits, punchHits + hitsPerPunch); emit({type:"hit",hits:punchHits});
      AudioEngine.init();

      const heatRatio = Math.min(punchHits / targetKoHits, 1.0);
      const speedFactor = 1.0 + heatRatio * 2.8;

      AudioEngine.playPunch(speedFactor);
      screenShake = reduced ? 0 : Math.min(0.10, 0.025 + heatRatio * 0.07);

      hitStopRemaining = heatRatio > 0.8 ? 3 : (heatRatio > 0.4 ? 2 : 1);

      if (punchHits % 5 === 0 || heatRatio >= 0.85) {
        triggerImpactFrame("mono", 2);
      }

      const pushX = (currentHand === "left" ? 0.38 : -0.38) * (0.8 + heatRatio * 0.8);
      const pushZ = -0.75 * (1.0 + heatRatio * 1.0);
      bagVelocity.z += pushZ;
      bagVelocity.x += pushX;

      dentHeavyBag(0.1, 0.22 + heatRatio * 0.25);

      animateGloveJab(currentHand, speedFactor);
      currentHand = currentHand === "left" ? "right" : "left";

      const contactZ = 0.9;
      spawnHitSpark(pushX * 0.5, 0.2, contactZ);
      spawnShockwave(pushX * 0.3, 0.2, contactZ, 0.8 + heatRatio * 0.8);
      if (punchHits % 2 === 0 || heatRatio > 0.7) {
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
 if(d.type==='arm'){punchHits=0;targetKoHits=Number.isInteger(d.targetHits)&&d.targetHits>0?d.targetHits:12;hitsPerPunch=Number.isInteger(d.hitsPerPunch)&&d.hitsPerPunch>0?d.hitsPerPunch:1;isGachaTriggered=false;armed=true;}
 if(d.type==='punch'&&!reduced)deliverPunch();
 if(d.type==='reset'){armed=false;punchHits=0;targetKoHits=12;hitsPerPunch=1;isGachaTriggered=false;bagVelocity={x:0,z:0};}
});
    function onWindowResize() {
      if (!renderer || !camera) return;
      const size = getContainerSize();
      camera.aspect = size.w / size.h; camera.position.z = size.w / size.h < .75 ? 11.6 : 10.2;
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


addEventListener('error',()=>emit({type:'error'}));
try{init3DExperience();renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();armed=false;emit({type:'error'});});requestAnimationFrame(()=>emit({type:'ready'}));}catch(e){emit({type:'error',message:'The gym could not be rendered.'});}

addEventListener('pagehide',()=>{disposed=true;AudioEngine.context?.close();scene?.traverse(object=>{object.geometry?.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){if(!material)continue;for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}});renderer?.dispose();});
