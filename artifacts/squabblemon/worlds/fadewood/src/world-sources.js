import { Box3, Vector3 } from 'three';
export const BULLETIN_SOURCE = Object.freeze({
  id: 'fade-park-bulletin', name: 'Fade Park bulletin board', label: 'Events & bounties',
  markerPosition: [18, 4.25, -16.15], position: [18, .3635000119209289, -18], interactionPosition: [18, .3635000119209289, -18], aimPoint: [18, 2.65, -16.15], radius: 4.4,
  camera: { position: [18, 2.1, -22.3], target: [18, 2.4, -16.15], fov: 60, roll: -.008 },
});
export const MURAL_SOURCE = Object.freeze({ id: 'story-mural', name: 'The Yellow Line mural', label: 'The Yellow Line', position: [0, .085, -41], interactionPosition: [0, .085, -41], aimPoint: [0, 1.475, -44.805], radius: 4.5,
  camera: { position: [0, 2.1, -37.5], target: [0, 1.475, -44.805], fov: 60, roll: 0 } });
const portalBounds = [
  ['fade-park-bulletin', [14.3, .3, -16.65], [21.7, 4.2, -15.65]],
  ['underground-arena', [14.9, 0, 19.2], [23.5, 5.1, 20.5]],
  ['safehouse-door', [18.4, .1, -38.6], [20.4, 3.5, -36.7]],
  ['story-mural', [-6.7, .05, -45], [6.7, 3.2, -44.5]],
].map(([id, min, max]) => ({ id, bounds: new Box3(new Vector3(...min), new Vector3(...max)) }));
export function sourceAtVisibleHit(hit) {
  for (let object = hit.object; object; object = object.parent) {
    const id = object.userData?.characterId ?? object.userData?.hostSourceId;
    if (id) return id;
    if (object.name === 'Alice roaming Mad Hatter top hat') return 'alice-hat';
    if (object.name === 'Anunaki rotating hieroglyph ring' || object.name === 'Anunaki hovering ship') return 'anunaki-ufo';
  }
  return portalBounds.find(record => record.bounds.containsPoint(hit.point))?.id ?? null;
}
export function sourceCanBePicked(sourceId, records, player, reach = 6) {
  const record = records.find(record => record.id === sourceId);
  const feet = record?.interactionPosition ?? record?.feet ?? record?.position;
  return Boolean(feet && Math.abs(feet[1] - player.y) <= 2.8 && Math.hypot(feet[0] - player.x, feet[2] - player.z) <= reach);
}
