import { loadNeighborhoodProps } from './neighborhood-props.js';

export const ANUNAKI_SHIP = Object.freeze({
  id: 'anunaki-starship', name: 'Eye of Ra Anunaki starship',
  asset: 'anunaki-starship.glb', position: [0, -.9, 0], yaw: 0, targetLength: 7.6,
});
const OLD_HULLS = ['Anunaki cel saucer with round ink silhouette', 'Anunaki blue gold hieroglyph painted rim'];

/** Reuse the existing hover, beam and story trigger with the supplied artwork. */
export async function loadAnunakiShip({ portals, loader, baseUrl } = {}) {
  const pivot = portals?.group?.getObjectByName('Anunaki rotating hieroglyph ring');
  if (!pivot) throw new Error('The Anunaki hover pivot is missing.');
  const hulls = OLD_HULLS.map((name) => pivot.getObjectByName(name));
  if (hulls.some((object) => !object?.isMesh)) throw new Error('The original Anunaki hull cannot be safely replaced.');
  const asset = await loadNeighborhoodProps({ parent: pivot, loader, baseUrl, placements: [ANUNAKI_SHIP] });
  const previous = hulls.map((object) => object.visible);
  hulls.forEach((object) => { object.visible = false; });
  let disposed = false;
  return { ...asset, hiddenHulls: OLD_HULLS, stats: { ...asset.stats, replacedHullMeshes: hulls.length },
    dispose() {
      if (disposed) return; disposed = true;
      asset.dispose(); hulls.forEach((object, index) => { object.visible = previous[index]; });
    },
  };
}
