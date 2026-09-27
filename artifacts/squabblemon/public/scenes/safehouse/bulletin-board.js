import * as T from '../shared/three.module.js';

function drawFittedText(context, text, x, y, maxWidth, size, minSize = 24) {
  let next = size;
  do { context.font = `900 ${next}px sans-serif`; next -= 2; } while (context.measureText(text).width > maxWidth && next > minSize);
  context.fillText(text, x, y, maxWidth);
}

function paperTexture({ color, eyebrow, title, accent, fresh = false }) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 640;
  const context = canvas.getContext('2d');
  context.fillStyle = color; context.fillRect(0, 0, 512, 640);
  context.strokeStyle = '#181510'; context.lineWidth = 7; context.strokeRect(18, 18, 476, 604);
  context.fillStyle = accent; context.fillRect(30, 30, 452, 26);
  context.fillStyle = '#27231c'; context.font = '900 23px monospace'; context.fillText(eyebrow, 38, 103);
  drawFittedText(context, title, 38, 188, 430, 58);
  context.strokeStyle = '#675e4d'; context.lineWidth = 4;
  for (let row = 256; row < 532; row += 39) { context.beginPath(); context.moveTo(40, row); context.lineTo(468, row); context.stroke(); }
  context.fillStyle = accent; context.beginPath(); context.arc(448, 570, 43, 0, Math.PI * 2); context.fill();
  context.strokeStyle = '#181510'; context.lineWidth = 6; context.stroke();
  context.fillStyle = '#fff'; context.font = '900 24px sans-serif'; context.textAlign = 'center'; context.fillText(fresh ? 'NEW' : 'LIVE', 448, 578);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

export function createBulletinBoard() {
  const root = new T.Group(); root.name = 'bulletin-board';
  // The board belongs on the back wall immediately to the left of the mail door.
  root.position.set(2.92, 1.9, -4.76);
  const backing = new T.Mesh(new T.BoxGeometry(2.46, 1.66, .1), new T.MeshStandardMaterial({ color: '#063d36', roughness: .55, metalness: .12 }));
  backing.castShadow = backing.receiveShadow = true; root.add(backing);
  const boardTexture = new T.TextureLoader().load(new URL('../../assets/events/generated/fadepark-board-texture.webp', import.meta.url).href);
  boardTexture.colorSpace = T.SRGBColorSpace; boardTexture.anisotropy = 8;
  const board = new T.Mesh(new T.PlaneGeometry(2.4, 1.6), new T.MeshStandardMaterial({ map: boardTexture, roughness: .72, metalness: .05 }));
  board.position.z = .058; board.castShadow = true; root.add(board);

  const papers = [
    { x: -.62, y: .12, w: .68, h: .84, r: -.035, pin: '#e6332d', texture: paperTexture({ color: '#fff6dc', eyebrow: 'EVENT', title: 'BLOCK PARTY', accent: '#e6332d', fresh: true }) },
    { x: .18, y: .24, w: .72, h: .77, r: .025, pin: '#f2c62f', texture: paperTexture({ color: '#fffbe8', eyebrow: 'ROADMAP', title: 'WHAT IS NEXT', accent: '#007b68' }) },
    { x: .71, y: -.44, w: .48, h: .33, r: -.035, pin: '#16a66f', texture: paperTexture({ color: '#f1ffe8', eyebrow: 'DEVS', title: 'READ ME', accent: '#16a66f', fresh: true }) },
  ];
  for (const paper of papers) {
    const mesh = new T.Mesh(new T.PlaneGeometry(paper.w, paper.h), new T.MeshStandardMaterial({ map: paper.texture, roughness: .86 }));
    mesh.position.set(paper.x, paper.y, .072); mesh.rotation.z = paper.r; mesh.castShadow = true; root.add(mesh);
    const pin = new T.Mesh(new T.SphereGeometry(.046, 16, 10), new T.MeshStandardMaterial({ color: paper.pin, metalness: .2, roughness: .3 }));
    pin.scale.z = .42; pin.position.set(paper.x, paper.y + paper.h * .42, .105); root.add(pin);
  }

  // A small pinned photograph uses the same art as the event flyer.
  const photoArt = new T.TextureLoader().load(new URL('../../assets/layered/festival-street.webp', import.meta.url).href);
  photoArt.colorSpace = T.SRGBColorSpace;
  const photo = new T.Mesh(new T.PlaneGeometry(.69, .38), new T.MeshStandardMaterial({map:photoArt, roughness:.9}));
  photo.position.set(-.15,-.49,.083); photo.rotation.z = -.045; root.add(photo);

  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 768; labelCanvas.height = 128;
  const label = labelCanvas.getContext('2d'); label.fillStyle = '#007b68'; label.fillRect(0, 0, 768, 128); label.strokeStyle = '#f1c436'; label.lineWidth = 12; label.strokeRect(6, 6, 756, 116); label.fillStyle = '#fff8df'; label.font = '900 56px sans-serif'; label.textAlign = 'center'; label.fillText('THE BLOCK / EVENTS', 384, 83);
  const labelTexture = new T.CanvasTexture(labelCanvas); labelTexture.colorSpace = T.SRGBColorSpace;
  const plaque = new T.Mesh(new T.PlaneGeometry(1.78, .3), new T.MeshStandardMaterial({ map: labelTexture, roughness: .46, metalness: .08 })); plaque.position.set(0, .94, .075); root.add(plaque);
  const badge = new T.Mesh(new T.SphereGeometry(.045, 18, 12), new T.MeshStandardMaterial({ color: '#e6332d', emissive: '#9e1513', emissiveIntensity: .7, roughness: .34 })); badge.position.set(1.08, .91, .13); root.add(badge);
  let unread = true;
  return {
    root,
    setUnread(value) { unread = Boolean(value); badge.visible = unread; },
    update(t, reduced) { if (unread && !reduced) badge.scale.setScalar(1 + Math.sin(t * 3.4) * .09); else badge.scale.setScalar(1); },
    status() { return { unread }; },
  };
}
