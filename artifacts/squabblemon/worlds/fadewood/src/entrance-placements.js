/** Supplied cast at the open garage and behind the player’s initial facing. */
export const ENTRANCE_CHARACTER_PLACEMENTS = Object.freeze([
  { id: 'cracked-head', name: 'Cracked Head', locationId: 'open-garage', asset: 'cracked-head.glb', position: [15.1, .361, -39.15], yaw: .08, height: 1.75, idle: { clip: 'Fadewood_Relaxed_Idle' }, animation: { clip: 'Zombie_Scream', time: .3, loop: true, speed: .75 } },
  { id: 'snitch', name: 'Snitch', locationId: 'town-entrance', asset: 'snitch.glb', position: [-8.7, .109, 37.4], yaw: 2.85, height: 1.8, idle: { clip: 'Fadewood_Relaxed_Idle' }, animation: { clip: 'Head_Hold_in_Pain', time: .2, loop: true, speed: .9 } },
  { id: 'officer-oinkston', name: 'Officer Oinkston', locationId: 'town-entrance', asset: 'officer-oinkston.glb', position: [7.5, .109, 37.8], yaw: -2.65, height: 1.8, idle: { clip: 'Fadewood_Relaxed_Idle' }, animation: { clip: 'Catching_Breath', time: .4, loop: true, speed: .85 } },
].map(p => Object.freeze({ ...p, position: Object.freeze(p.position), animation: Object.freeze(p.animation) })));

// The newer 1030214258 upload faces source -X; this turn points it into town.
export const ENTRANCE_PROP_PLACEMENTS = Object.freeze([
  Object.freeze({ id: 'oink-patrol', name: 'Oink Patrol', asset: 'oink-patrol.glb', position: Object.freeze([4, .109, 40.2]), yaw: -Math.PI / 2, targetLength: 4.8, location: 'East curb behind spawn, facing Hands Ave' }),
]);
