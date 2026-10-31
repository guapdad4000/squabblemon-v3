import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, TextureLoader } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const BASE_URL = import.meta.env?.BASE_URL ?? '/';
// Aspect-preserving derivatives of existing host art; assets/bulletin/provenance.json records source/output hashes.
export const BULLETIN_ART = Object.freeze([
  { id: 'cork', file: 'cork.webp', source: 'assets/events/generated/fadepark-board-texture.webp', pixels: [1536, 1024] },
  { id: 'block-party', file: 'block-party.webp', source: 'assets/layered/festival-street.webp', pixels: [1424, 800] },
  { id: 'roster-pass', file: 'roster-pass.jpg', source: 'brand/squabblemon-standard-gold-share.jpg', pixels: [1200, 630] },
  { id: 'fight-night', file: 'fight-night.webp', source: 'assets/fight-night/rooms/rooftop-court.webp', pixels: [1672, 941] },
]);
export const BULLETIN_FACE = Object.freeze({ position: [18, 2.65, -16.37], size: [6.08, .82] });
const FLYERS = [{ x: 16.15, roll: -.025 }, { x: 18, roll: .018 }, { x: 19.85, roll: -.018 }];
function plane(width, height, position, roll = 0, crop = [0, 0, 1, 1]) {
  const geometry = new PlaneGeometry(width, height), uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, crop[0] + uv.getX(i) * (crop[2] - crop[0]), crop[1] + uv.getY(i) * (crop[3] - crop[1]));
  geometry.rotateZ(roll).rotateY(Math.PI).translate(...position);
  return geometry;
}
/** Repurpose only the obsolete sign face; source posts/frame and park gate stay. */
export async function createParkBulletin({ parent, renderer, textures, textureLoader = new TextureLoader() } = {}) {
  const owned = !textures;
  if (!textures) {
    const loaded = await Promise.allSettled(BULLETIN_ART.map(art => textureLoader.loadAsync(`${BASE_URL}assets/bulletin/${art.file}`)));
    const failed = loaded.find(result => result.status === 'rejected');
    if (failed) { for (const result of loaded) if (result.status === 'fulfilled') result.value.dispose(); throw failed.reason; }
    textures = loaded.map(result => result.value);
  }
  const group = new Group(); group.name = 'Fadewood | Events and bounties on the old park placard';
  group.userData.hostSourceId = 'fade-park-bulletin'; group.userData.noCollision = true;
  const geometries = [], materials = [], posterSizes = [];
  const material = texture => { texture.colorSpace = SRGBColorSpace; texture.anisotropy = Math.min(4, renderer?.capabilities.getMaxAnisotropy() ?? 1); const value = new MeshBasicMaterial({ map: texture }); materials.push(value); return value; };
  const add = (geometry, surface, name) => { geometries.push(geometry); const mesh = new Mesh(geometry, surface); mesh.name = name; mesh.userData.noCollision = true; group.add(mesh); return mesh; };
  // Crop a horizontal strip of the existing cork interior to retain grain scale.
  const spanU = .84, spanV = spanU * (1536 / 1024) / (BULLETIN_FACE.size[0] / BULLETIN_FACE.size[1]);
  const corkCrop = [.08, .5 - spanV / 2, .92, .5 + spanV / 2];
  add(plane(...BULLETIN_FACE.size, BULLETIN_FACE.position, 0, corkCrop), material(textures[0]), 'Existing cork face inside original navy frame');
  const papers = FLYERS.map(({ x, roll }) => plane(1.38, .746, [x, 2.65, -16.385], roll));
  const paperGeometry = mergeGeometries(papers); papers.forEach(geometry => geometry.dispose());
  const paper = new MeshBasicMaterial({ color: '#fff3d5' }); materials.push(paper);
  add(paperGeometry, paper, 'Three cream flyer paper edges');
  FLYERS.forEach(({ x, roll }, i) => {
    const art = BULLETIN_ART[i + 1], width = 1.27, height = width * art.pixels[1] / art.pixels[0];
    posterSizes.push({ id: art.id, width, height, pixels: art.pixels });
    add(plane(width, height, [x, 2.65, -16.4], roll), material(textures[i + 1]), `Canonical event flyer: ${art.id}`);
  });
  parent.add(group);
  return { group, stats: { triangles: 14, drawCalls: 5, textures: 4, structuralGeometry: 0 }, posterSizes, corkCrop,
    dispose() { group.removeFromParent(); geometries.forEach(geometry => geometry.dispose()); materials.forEach(value => value.dispose()); if (owned) textures.forEach(texture => { texture.dispose(); texture.source?.data?.close?.(); }); } };
}
