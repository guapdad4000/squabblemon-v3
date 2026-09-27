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
  context.fillStyle = accent; context.fillRect(0, 0, 512, 100);
  context.fillStyle = '#fff8e8'; context.font = '900 28px monospace'; context.fillText(eyebrow, 36, 65);
  context.fillStyle = '#27231c';
  const words = title === 'BLOCK PARTY' ? ['BLOCK', 'PARTY.'] : ['WHAT IS', 'NEXT?'];
  words.forEach((word, index) => drawFittedText(context, word, 36, 214 + index * 88, 440, 84));
  context.fillStyle = accent; context.fillRect(36, 341, 88, 9);
  const lines = title === 'BLOCK PARTY' ? ['MEET. PLAY. SQUABBLE.', 'Your block. Your people.', 'See the latest events.'] : ['FROM THE DEVS', 'New plans. Fresh updates.', 'See what we are building.'];
  lines.forEach((line, index) => { context.font = `${index === 0 ? 900 : 500} ${index === 0 ? 25 : 24}px sans-serif`; context.fillStyle = '#38382e'; context.fillText(line, 36, 408 + index * 42, 440); });
  context.fillStyle = accent; context.fillRect(36, 554, 440, 48);
  context.fillStyle = '#fff8e8'; context.font = '900 23px monospace'; context.fillText(fresh ? 'OPEN THE BOARD  →' : 'DEVELOPER NOTES  →', 54, 586);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

export function createBulletinBoard() {
  const root = new T.Group(); root.name = 'bulletin-board';
  // The board belongs on the back wall immediately to the left of the mail door.
  root.position.set(3.05, 2.55, -4.76);
  const backing = new T.Mesh(new T.BoxGeometry(2.06, 1.78, .15), new T.MeshStandardMaterial({ color: '#063d36', roughness: .55, metalness: .12 }));
  backing.castShadow = backing.receiveShadow = true; root.add(backing);
  const boardTexture = new T.TextureLoader().load(new URL('../../assets/events/supplied/cork.png', import.meta.url).href);
  boardTexture.colorSpace = T.SRGBColorSpace; boardTexture.anisotropy = 8;
  const board = new T.Mesh(new T.PlaneGeometry(1.92, 1.6), new T.MeshStandardMaterial({ map: boardTexture, roughness: .72, metalness: .05 }));
  board.position.z = .081; board.castShadow = true; root.add(board);

  const wood = new T.TextureLoader().load(new URL('../../assets/events/supplied/wood-borders.png', import.meta.url).href);
  wood.colorSpace = T.SRGBColorSpace; wood.repeat.set(.93,.055); wood.offset.set(.035,.902);
  const woodMaterial = new T.MeshStandardMaterial({map:wood,transparent:true,roughness:.86});
  const timber = new T.MeshStandardMaterial({color:'#513018',roughness:.82});
  const trim = new T.MeshStandardMaterial({color:'#bd8741',roughness:.5,metalness:.25});
  for (const [w,h,x,y] of [[2.1,.15,0,.84],[2.1,.15,0,-.84],[.15,1.54,-.975,0],[.15,1.54,.975,0]]) {
    const depth = new T.Mesh(new T.BoxGeometry(w,h,.16),timber); depth.position.set(x,y,.09); depth.castShadow=depth.receiveShadow=true; root.add(depth);
    const face = new T.Mesh(new T.PlaneGeometry(w > h ? w : h,w > h ? h : w),woodMaterial); face.rotation.z=w>h?0:Math.PI/2; face.position.set(x,y,.172); root.add(face);
  }
  for (const x of [-.97,.97]) for (const y of [-.84,.84]) {
    const screw = new T.Mesh(new T.SphereGeometry(.034,16,8),trim); screw.scale.z=.3; screw.position.set(x,y,.187); root.add(screw);
  }
  const iconTexture = new T.TextureLoader().load(new URL('../../assets/events/supplied/calendar.png', import.meta.url).href);
  iconTexture.colorSpace=T.SRGBColorSpace;
  const icon=new T.Mesh(new T.PlaneGeometry(.3,.3),new T.MeshStandardMaterial({map:iconTexture,transparent:true,roughness:.9}));
  icon.position.set(.73,.47,.13); root.add(icon);

  const papers = [
    { x: -.55, y: -.31, w: .55, h: .70, r: -.035, pin: '#e6332d', texture: paperTexture({ color: '#fff6dc', eyebrow: 'EVENT', title: 'BLOCK PARTY', accent: '#e6332d', fresh: true }) },
    { x: .09, y: -.29, w: .55, h: .70, r: .025, pin: '#f2c62f', texture: paperTexture({ color: '#fffbe8', eyebrow: 'ROADMAP', title: 'WHAT IS NEXT', accent: '#007b68' }) },

  ];
  for (const paper of papers) {
    const mesh = new T.Mesh(new T.PlaneGeometry(paper.w, paper.h), new T.MeshStandardMaterial({ map: paper.texture, roughness: .86 }));
    mesh.position.set(paper.x, paper.y, .115); mesh.rotation.z = paper.r; mesh.castShadow = true; root.add(mesh);
    const stock = new T.Mesh(new T.BoxGeometry(paper.w, paper.h, .012),new T.MeshStandardMaterial({color:'#eee1c1',roughness:1})); stock.position.copy(mesh.position); stock.position.z-=.009; stock.rotation.z=paper.r; stock.castShadow=true; root.add(stock);
    const pin = new T.Mesh(new T.SphereGeometry(.046, 16, 10), new T.MeshStandardMaterial({ color: paper.pin, metalness: .2, roughness: .3 }));
    pin.scale.set(.78,.78,.65); pin.position.set(paper.x - Math.sin(paper.r)*paper.h*.42, paper.y + Math.cos(paper.r)*paper.h*.42, .149); root.add(pin);
  }

  // A small pinned photograph uses the same art as the event flyer.
  const photoArt = new T.TextureLoader().load(new URL('../../assets/layered/festival-street.webp', import.meta.url).href);
  photoArt.colorSpace = T.SRGBColorSpace;
  const photo = new T.Mesh(new T.PlaneGeometry(.32, .18), new T.MeshStandardMaterial({map:photoArt, roughness:.9}));
  photo.position.set(-.73,.43,.132); photo.rotation.z = -.045; root.add(photo);

  const photoMount = new T.Mesh(new T.BoxGeometry(.37,.25,.015),new T.MeshStandardMaterial({color:'#fff7e5',roughness:.9})); photoMount.position.set(-.73,.415,.117); photoMount.rotation.z=-.045; photoMount.castShadow=true; root.add(photoMount);
  function artwork(name,w,h,x,y,z) {
    const map=new T.TextureLoader().load(new URL(`../../assets/events/supplied/${name}.png`,import.meta.url).href); map.colorSpace=T.SRGBColorSpace; map.anisotropy=8;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map,transparent:true,alphaTest:.05,roughness:.8})); mesh.position.set(x,y,z); root.add(mesh); return mesh;
  }
  // Keep decoration in its own column, clear of the readable notices.
  artwork('punch',.38,.38,.68,-.20,.125).rotation.z=-.08;
  artwork('fist-stamp',.23,.23,.70,-.59,.119).rotation.z=.15;
  artwork('events-title',.95,.7125,-.02,.40,.14);
  const badge = new T.Mesh(new T.SphereGeometry(.045, 18, 12), new T.MeshStandardMaterial({ color: '#e6332d', emissive: '#9e1513', emissiveIntensity: .7, roughness: .34 })); badge.position.set(.87, .72, .14); root.add(badge);
  let unread = true;
  return {
    root,
    setUnread(value) { unread = Boolean(value); badge.visible = unread; },
    update(t, reduced) { if (unread && !reduced) badge.scale.setScalar(1 + Math.sin(t * 3.4) * .09); else badge.scale.setScalar(1); },
    status() { return { unread }; },
  };
}
