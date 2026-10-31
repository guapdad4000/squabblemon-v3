import { DESTINATIONS } from './fast-travel.js';
/** Semantic stops have grounded, collision-checked approaches. */
export const HOST_DESTINATIONS = Object.freeze([
  ...DESTINATIONS.map(destination => Object.freeze({ ...destination, arrivalId: destination.id })),
  Object.freeze({ id: 'safehouse', arrivalId: 'safehouse', name: 'Safehouse', note: 'The painted green door.', position: [19.82,.5,-36.5], yaw: -.55, pitch: .12, distance: 3.4, targetHeight: 1.35, shoulder: 0, roll: -.012, fov: 60, lookAt: [19.82,1.65,-38.04] }),
  Object.freeze({ id: 'demario-luigion-booth', arrivalId: 'demario-luigion-booth', name: 'DeMario & Luigion', note: 'The curb popup.', position: [7.7,.5,-3.6], yaw: -Math.PI/2, pitch: .12, distance: 4.8, targetHeight: 1.35, shoulder: 0, roll: 0, fov: 60, lookAt: [10.4,1.65,-3.6] }),
  Object.freeze({ id: 'underground-arena', arrivalId: 'underground-arena', name: 'Underground Kumite', note: 'Meet Dr. Fade.', position: [20.1, .5, 18.1], yaw: -Math.PI / 2, pitch: .12, distance: 4.5, targetHeight: 1.4, shoulder: 0, roll: 0, fov: 62, lookAt: [21.65, .031, 17.3] }),
  Object.freeze({ id: 'anunaki-ufo', arrivalId: 'anunaki-ufo', name: 'Anunaki Signal', note: 'Follow the signal.', position: [23.8, .3685000071525573, -35.5], yaw: .5, pitch: .05, distance: 5.5, targetHeight: 9, shoulder: 0, roll: 0, fov: 65, lookAt: [20.4, 10.2, -42.5] }),
  Object.freeze({ id: 'fade-park-bulletin', arrivalId: 'fade-park-bulletin', name: 'Fade Park bulletin board', note: 'Events & bounties.', position: [18, .3635000119209289, -18], yaw: Math.PI, pitch: .12, distance: 4.6, targetHeight: 1.4, shoulder: 0, roll: 0, fov: 60, lookAt: [18, 2.65, -16.15] }),
  Object.freeze({ id: 'story-mural', arrivalId: 'story-mural', name: 'Story Mural', note: 'The stories of Fadewood.', position: [0, .5, -39.5], yaw: 0, pitch: .12, distance: 5.4, targetHeight: 1.3, shoulder: 0, roll: 0, fov: 60, lookAt: [0, 1.475, -44.805] }),
]);
export function hostDestination(id) { return HOST_DESTINATIONS.find(destination => destination.id === id) ?? null; }
