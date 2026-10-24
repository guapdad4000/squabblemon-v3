import * as T from '../shared/three.module.js';

/** A late-90s cordless handset: warm ABS, physical keys and a quiet green LCD. */
export function createCordlessPhone({ brass, black, ivory }) {
  const root = new T.Group(); root.name = 'cordless-phone';
  const shell = new T.MeshStandardMaterial({ color: '#cec3a6', roughness: .66 });
  const rubber = new T.MeshStandardMaterial({ color: '#454a43', roughness: .9 });
  const add = (geometry, material, x, y, z) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const rounded = (w, h, d, material, x, y, z) => {
    const r = Math.min(w, h, d) * .3, shape = new T.Shape();
    shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const geometry = new T.ExtrudeGeometry(shape, { depth: d - r * 2, bevelEnabled: true, bevelSegments: 2, curveSegments: 3, steps: 1, bevelSize: r, bevelThickness: r });
    geometry.translate(0, 0, -d / 2 + r);
    return add(geometry, material, x, y, z);
  };
  rounded(.45, .81, .1, shell, 0, -.025, -.045); // charging cradle
  rounded(.32, .79, .13, shell, 0, .025, .045);
  rounded(.285, .75, .025, ivory, 0, .025, .113);
  const antenna = add(new T.CylinderGeometry(.018, .024, .34, 12), rubber, -.105, .58, .025);
  antenna.rotation.z = -.05;
  add(new T.SphereGeometry(.018, 8, 6), rubber, -.113, .749, .025);
  // Recessed speaker and microphone slots, not a simulated smartphone screen.
  for (let row = 0; row < 4; row++) rounded(.14 - row * .012, .008, .006, black, 0, .328 - row * .021, .13);
  for (let row = 0; row < 2; row++) rounded(.09, .006, .006, rubber, 0, -.316 - row * .015, .13);
  rounded(.237, .147, .012, rubber, 0, .15, .13);
  const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 192;
  const g = canvas.getContext('2d'); g.fillStyle = '#a3b28a'; g.fillRect(0, 0, 384, 192);
  g.fillStyle = '#263c28'; g.font = 'bold 23px monospace'; g.fillText('HOME COURT', 22, 40);
  g.font = 'bold 52px monospace'; g.fillText('4:00', 22, 100); g.font = '21px monospace'; g.fillText('THE BLOCK IS CALLING', 22, 151);
  for (let i = 0; i < 4; i++) g.fillRect(293 + i * 15, 57 - i * 8, 9, 13 + i * 8);
  const lcd = new T.CanvasTexture(canvas); lcd.colorSpace = T.SRGBColorSpace;
  add(new T.PlaneGeometry(.211, .119), new T.MeshBasicMaterial({ map: lcd }), 0, .15, .138).castShadow = false;
  // One texture labels twelve raised keys, keeping the new prop cheap to batch.
  const keys = document.createElement('canvas'); keys.width = 384; keys.height = 448;
  const k = keys.getContext('2d'); k.clearRect(0, 0, 384, 448); k.fillStyle = '#20302b'; k.textAlign = 'center';
  const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    rounded(.066, .046, .019, shell, (col - 1) * .079, -.026 - row * .061, .138);
    k.font = 'bold 58px monospace'; k.fillText(labels[row * 3 + col], 64 + col * 128, 77 + row * 112);
  }
  const keyTexture = new T.CanvasTexture(keys); keyTexture.colorSpace = T.SRGBColorSpace;
  add(new T.PlaneGeometry(.237, .244), new T.MeshBasicMaterial({ map: keyTexture, transparent: true, depthWrite: false }), 0, -.1175, .151).castShadow = false;
  rounded(.085, .027, .014, new T.MeshStandardMaterial({ color: '#346c50', roughness: .65 }), -.063, .042, .137);
  rounded(.085, .027, .014, new T.MeshStandardMaterial({ color: '#8b4542', roughness: .65 }), .063, .042, .137);
  add(new T.SphereGeometry(.009, 8, 6), new T.MeshBasicMaterial({ color: '#a7c487' }), .17, -.34, .012).castShadow = false;
  for (const x of [-.14, .14]) rounded(.025, .035, .008, brass, x, -.28, .013);
  return root;
}
