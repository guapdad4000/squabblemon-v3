/**
 * Authored entrance staging for the shipped Y-up neighborhood.
 * Entry/host yaw rotates local +Z toward the street. All positions describe
 * feet/the bottom of a portal, not the centre of its geometry. Arrival yaw uses
 * the follow camera convention: from the player toward the camera.
 *
 * Street-facing entrances keep their camera on the open road instead of in the
 * next building. Each location has its own low, oblique establishing shot.
 */
export const LANDMARKS = Object.freeze([
  {
    id: 'squabble-house', name: 'Squabble House', color: '#f5c84b',
    entry: { position: [-15.7, .25, 31.72], yaw: 0, width: 2.35, height: 2.95, style: 'diner' },
    host: { position: [-17.75, .241, 33.0], yaw: .25 },
    arrival: { position: [-13.3, .5, 36.0], yaw: .48, pitch: .12, distance: 5.7, targetHeight: 1.35, shoulder: -.25, roll: -.025, fov: 60 },
    note: 'Pull up for a plate.', shot: 'Low three-quarter view across the diner entrance and yellow roof tiles.',
  },
  {
    id: 'fade-market', name: 'Fade Market', color: '#6ab99b',
    entry: { position: [15.7, .25, 31.72], yaw: 0, width: 2.25, height: 2.85, style: 'market' },
    host: { position: [17.65, .241, 33.0], yaw: -.3 },
    arrival: { position: [13.2, .5, 35.9], yaw: -.45, pitch: .14, distance: 5.8, targetHeight: 1.4, shoulder: .28, roll: .024, fov: 60 },
    note: 'Your corner-store stop.', shot: 'Reverse three-quarter view under the striped market awning.',
  },
  {
    id: 'blue-block', name: 'Blue Block', color: '#5494ef',
    entry: { position: [-11.20, .371, 7.0], yaw: Math.PI / 2, width: 2.35, height: 3.0, style: 'blue-housing' },
    host: { position: [-10.25, .261, 4.85], yaw: 1.25 },
    arrival: { position: [-7.1, .5, 9.3], yaw: 1.13, pitch: .08, distance: 5.6, targetHeight: 1.3, shoulder: -.25, roll: -.034, fov: 62 },
    note: 'Blue paint. Big energy.', shot: 'Low sidewalk diagonal with blue graffiti rising behind the host.',
  },
  {
    id: 'red-block', name: 'Red Block', color: '#ee635d',
    entry: { position: [11.20, .371, 7.0], yaw: -Math.PI / 2, width: 2.35, height: 3.0, style: 'red-housing' },
    host: { position: [10.1, .261, 9.15], yaw: -1.85 },
    arrival: { position: [7.2, .5, 5.2], yaw: -1.98, pitch: .1, distance: 5.7, targetHeight: 1.3, shoulder: .25, roll: .034, fov: 62 },
    note: 'Across the street.', shot: 'Opposing diagonal catches red brick, entrance and fire-escape depth.',
  },
  {
    id: 'county', name: 'County Jail / Library', color: '#c7c2e4',
    entry: { position: [-11.20, .371, -24.0], yaw: Math.PI / 2, width: 2.7, height: 3.15, style: 'civic' },
    host: { position: [-9.9, .276, -22.0], yaw: 1.9 },
    arrival: { position: [-7.1, .5, -26.2], yaw: 1.98, pitch: .12, distance: 6.1, targetHeight: 1.45, shoulder: .2, roll: -.018, fov: 60 },
    note: 'Time served. Books returned.', shot: 'Civic facade from the library end, with the street clear behind camera.',
  },
  {
    id: 'post-office', name: 'Post Office', color: '#5e8fcb',
    entry: { position: [11.40, .27, -11.0], yaw: -Math.PI / 2, width: 2.3, height: 2.9, style: 'postal' },
    host: { position: [10.1, .261, -8.9], yaw: -1.9 },
    arrival: { position: [7.6, .5, -13.2], yaw: -2.0, pitch: .1, distance: 5.8, targetHeight: 1.4, shoulder: .2, roll: .022, fov: 58 },
    note: 'Special delivery.', shot: 'Street-side postal entrance and blade sign, avoiding the housing behind its front facade.',
  },
  {
    id: 'fade-park', name: 'Fade Park', color: '#9ac967',
    entry: { position: [11.73, .35, -21.0], yaw: -Math.PI / 2, width: 2.15, height: 2.8, style: 'park' },
    host: { position: [10.25, .371, -23.25], yaw: -1.35 },
    arrival: { position: [7.5, .5, -18.8], yaw: -1.12, pitch: .11, distance: 5.9, targetHeight: 1.35, shoulder: -.2, roll: -.022, fov: 62 },
    note: 'Catch some air.', shot: 'Look through the real street-side gate toward the park path and trees.',
  },
  {
    id: 'dojo', name: 'Dojo', color: '#cda76d',
    entry: { position: [-11.39, .45, -41.4], yaw: Math.PI / 2, width: 2.8, height: 3.05, style: 'dojo' },
    host: { position: [-10.25, .261, -42.95], yaw: 1.3 },
    arrival: { position: [-7.4, .5, -39.2], yaw: 1.13, pitch: .085, distance: 6.0, targetHeight: 1.3, shoulder: -.2, roll: -.027, fov: 58 },
    note: 'Hands up. Shoes off.', shot: 'Timber portal and indigo eaves from a low street angle, clear of the county rear wall.',
  },
  {
    id: 'open-garage', name: 'Open Garage', color: '#ee9c67',
    entry: { position: [14.90, .36, -38.13], yaw: 0, width: 5.0, height: 2.72, style: 'garage' },
    host: { position: [13.3, .361, -40.1], yaw: .2 },
    arrival: { position: [16.4, .5, -36.6], yaw: .2, pitch: .1, distance: 4.6, targetHeight: 1.35, shoulder: .15, roll: .024, fov: 58 },
    note: 'The door is already up.', shot: 'Low front-right view into the open garage bay, keeping the park tree off the entrance.',
  },
]);

// The house is a separate front door beside the garage rather than another
// travel stop. Its host stands on the little porch, away from the garage mouth.
export const EXTRA_ENTRANCES = Object.freeze([
  {
    id: 'small-house', name: 'Small House', color: '#eab77f',
    entry: { position: [19.35, .32, -38.10], yaw: 0, width: 1.3, height: 2.5, style: 'house' },
    host: { position: [21.15, .381, -37.75], yaw: -.15 },
  },
]);
