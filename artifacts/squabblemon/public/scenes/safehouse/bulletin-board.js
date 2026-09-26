import * as T from '../shared/three.module.js';

function paperTexture({ color, eyebrow, title, accent = '#bd2d27', fresh = false }) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 640;
  const context = canvas.getContext('2d');
  context.fillStyle = color; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#3b2f2150'; context.lineWidth = 5; context.strokeRect(15, 15, 482, 610);
  context.fillStyle = accent; context.fillRect(35, 38, 442, 20);
  context.fillStyle = '#31291f'; context.font = '700 25px monospace'; context.fillText(eyebrow, 38, 105);
  context.font = '900 58px sans-serif';
  const words = title.split(' '); let line = '', y = 185;
  for (const word of words) {
    const next = `${line}${line ? ' ' : ''}${word}`;
    if (context.measureText(next).width > 430 && line) { context.fillText(line, 38, y); line = word; y += 67; }
    else line = next;
  }
  context.fillText(line, 38, y);
  context.strokeStyle = '#554a3a'; context.lineWidth = 4;
  for (let row = y + 58; row < 545; row += 35) { context.beginPath(); context.moveTo(40, row); context.lineTo(470 - (row % 3) * 12, row); context.stroke(); }
  context.fillStyle = accent; context.beginPath(); context.arc(450, 570, 42, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#fff4d5'; context.font = '900 25px sans-serif'; context.textAlign = 'center'; context.fillText(fresh ? 'NEW' : 'LIVE', 450, 579);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

export function createBulletinBoard() {
  const root = new T.Group(); root.name = 'bulletin-board';
  root.position.set(4.22, 1.82, -1.7); root.rotation.y = -Math.PI / 2;
  const wood = new T.MeshStandardMaterial({ color: '#58341f', roughness: .78 });
  const cork = new T.MeshStandardMaterial({ color: '#a76c39', roughness: 1 });
  const trim = (w, h, x, y) => { const mesh = new T.Mesh(new T.BoxGeometry(w, h, .12), wood); mesh.position.set(x, y, 0); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); };
  const back = new T.Mesh(new T.BoxGeometry(2.25, 1.52, .12), cork); back.castShadow = back.receiveShadow = true; root.add(back);
  trim(2.42, .11, 0, .79); trim(2.42, .11, 0, -.79); trim(.11, 1.52, -1.16, 0); trim(.11, 1.52, 1.16, 0);
  const papers = [
    { x: -.58, y: .23, w: .72, h: .92, r: -.065, texture: paperTexture({ color: '#efe1b9', eyebrow: 'EVENT', title: 'BLOCK PARTY', fresh: true }) },
    { x: .34, y: .32, w: .82, h: .84, r: .045, texture: paperTexture({ color: '#dbe0ce', eyebrow: 'ROADMAP', title: 'WHAT IS NEXT', accent: '#263c35' }) },
    { x: .65, y: -.48, w: .58, h: .37, r: -.04, texture: paperTexture({ color: '#eee4ce', eyebrow: 'DEVS', title: 'READ ME', accent: '#bd2d27', fresh: true }) },
  ];
  for (const paper of papers) {
    const mesh = new T.Mesh(new T.PlaneGeometry(paper.w, paper.h), new T.MeshStandardMaterial({ map: paper.texture, roughness: .9 }));
    mesh.position.set(paper.x, paper.y, .075); mesh.rotation.z = paper.r; mesh.castShadow = true; root.add(mesh);
    const pin = new T.Mesh(new T.SphereGeometry(.045, 12, 8), new T.MeshStandardMaterial({ color: paper.x > 0 ? '#d3a23a' : '#b32625', metalness: .25, roughness: .45 }));
    pin.scale.z = .45; pin.position.set(paper.x, paper.y + paper.h * .42, .105); root.add(pin);
  }
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 768; labelCanvas.height = 128;
  const label = labelCanvas.getContext('2d'); label.fillStyle = '#191712'; label.fillRect(0, 0, 768, 128); label.fillStyle = '#f0c15a'; label.font = '900 57px sans-serif'; label.textAlign = 'center'; label.fillText('THE BLOCK / EVENTS', 384, 83);
  const labelTexture = new T.CanvasTexture(labelCanvas); labelTexture.colorSpace = T.SRGBColorSpace;
  const plaque = new T.Mesh(new T.PlaneGeometry(1.75, .29), new T.MeshStandardMaterial({ map: labelTexture, roughness: .72 })); plaque.position.set(0, .93, .075); root.add(plaque);
  const badge = new T.Mesh(new T.SphereGeometry(.10, 16, 12), new T.MeshStandardMaterial({ color: '#d9342d', emissive: '#8f120f', emissiveIntensity: .8, roughness: .42 })); badge.position.set(1.1, .87, .13); root.add(badge);
  let unread = true;
  return {
    root,
    setUnread(value) { unread = Boolean(value); badge.visible = unread; },
    update(t, reduced) { if (unread && !reduced) badge.scale.setScalar(1 + Math.sin(t * 3.4) * .09); else badge.scale.setScalar(1); },
    status() { return { unread }; },
  };
}
