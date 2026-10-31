// Meshy vehicles face source +X. Quarter turns park them along the street's Z
// axis; the two garage vehicles face out of the open bay toward +Z.
export const PROP_PLACEMENTS = Object.freeze([
  { id: 'purple-scraper', name: 'Purple Majesty scraper', asset: 'purple-scraper.glb', position: [4.15, .085, 16.7], yaw: Math.PI / 2, targetLength: 5.0, location: 'East curb by Red Block' },
  { id: 'beige-sedan', name: 'Vintage beige sedan', asset: 'vintage-sedan.glb', position: [-4.15, .085, -17], yaw: -Math.PI / 2, targetLength: 4.7, location: 'West curb near County Jail / Library' },
  { id: 'red-atv', name: 'Red Thunder ATV', asset: 'red-atv.glb', position: [13.85, .361, -41.2], yaw: -Math.PI / 2, targetLength: 2.15, location: 'Open Garage, left bay' },
  { id: 'yellow-dirt-bike', name: 'Yellow dirt bike', asset: 'yellow-dirt-bike.glb', position: [16.35, .361, -41.7], yaw: -Math.PI / 2, targetLength: 2.1, location: 'Open Garage, right bay' },
  { id: 'shopping-cart', name: 'Shopping cart', asset: 'shopping-cart.glb', position: [23.2, .241, 33.1], yaw: -.2, targetLength: .95, location: 'Fade Market, beside the entrance apron' },
].map((placement) => Object.freeze({ ...placement, position: Object.freeze(placement.position) })));
