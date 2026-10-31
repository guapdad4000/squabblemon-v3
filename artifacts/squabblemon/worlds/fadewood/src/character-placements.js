import { ENTRANCE_CHARACTER_PLACEMENTS } from './entrance-placements.js';

/**
 * The user's cast replaces the hosts at these eight landmarks. Positions are
 * grounded feet in the neighborhood's Y-up coordinates; yaw faces local +Z
 * toward the street. Height is a uniform normalization target in metres.
 * Keep both sides of paired entrances clear of the central approach lane.
 */
export const CHARACTER_PLACEMENTS = Object.freeze([
  { id: 'cornball', name: 'Cornball', locationId: 'fade-market', asset: 'cornball-compressed.glb', position: [17.65, .241, 33.0], yaw: -.3, height: 1.8, animation: { clip: 'FunnyDancing_03', time: 0, loop: true, speed: .9 } },
  { id: 'og-blue', name: 'OG Blue', locationId: 'blue-block', asset: 'og-blue-compressed.glb', position: [-10.25, .261, 4.85], yaw: 1.25, height: 2.0, idle: { clip: 'Fadewood_Relaxed_Idle' }, animation: { clip: 'Punch_Combo_3', time: 0, loop: true, speed: .85 } },
  { id: 'ganger-blue', name: 'Ganger Blue', locationId: 'blue-block', asset: 'ganger-blue-compressed.glb', position: [-10.25, .261, 9.15], yaw: 1.7, height: 1.85, idle: { clip: 'Fadewood_Relaxed_Idle' }, animation: { clip: 'Punch_Combo_1', time: 0, loop: true, speed: .9 } },
  { id: 'og-red', name: 'OG Red', locationId: 'red-block', asset: 'og-red-compreseed.glb', position: [10.35, .261, 9.15], yaw: -1.85, height: 2.0, idle: { clip: 'Fadewood_Relaxed_Idle' }, animation: { clip: 'Stand_Talking_Angry', time: 0, loop: true } },
  { id: 'ganger-red', name: 'Ganger Red', locationId: 'red-block', asset: 'ganger-red-compressed.glb', position: [10.1, .261, 4.85], yaw: -1.3, height: 1.85, animation: { clip: 'Idle_03', time: 0, loop: true } },
  { id: 'homeless-guy', name: 'Leon', locationId: 'fade-market', asset: 'homelessguy-compressed.glb', position: [20.25, .925, 32.5], yaw: 0, height: 1.8, pose: { rotation: [-Math.PI / 2, .26, Math.PI / 2], support: { bones: ['spine', 'spine001', 'spine002', 'shoulderL', 'shoulderR'], surfaces: [{ min: [19.5, 32.1], max: [20.5, 32.9], top: .925 }, { min: [20.7, 32.1], max: [21.5, 32.9], top: .68 }], clearance: .004 } }, animation: { clip: 'Stand_and_Drink', time: .5, loop: false } },
  { id: 'squabble-house-manager', name: 'Squabble House Manager', locationId: 'squabble-house', asset: 'squabblehouse-manager-compressed.glb', position: [-17.75, .241, 33.0], yaw: .25, height: 1.9, idle: { clip: 'Fadewood_Relaxed_Idle' }, animation: { clip: 'Shouting_Angrily', time: 0, loop: true, speed: .85 } },
  { id: 'wifey', name: 'Wifey', locationId: 'fade-park', asset: 'wifey-compressed.glb', position: [10.25, .371, -23.25], yaw: -1.35, height: 1.78, animation: { clip: 'Idle_15', time: 0, loop: true } },
  { id: 'baby-momma', name: 'Baby Momma', locationId: 'fade-park', asset: 'babymoma-compressed.glb', position: [10.25, .261, -18.75], yaw: -1.8, height: 1.8, animation: { clip: 'Idle_9', time: 0, loop: true, speed: 1.15 } },
  { id: 'inmate-kingpin', name: 'Inmate Kingpin', locationId: 'county', asset: 'inmate-kingpin-compressed.glb', position: [-9.9, .276, -22.0], yaw: 1.9, height: 2.05, idle: { clip: 'Fadewood_Relaxed_Idle' }, animation: { clip: 'Right_Upper_Hook_from_Guard', time: 0, loop: true, speed: .85 } },
  { id: 'yasuke', name: 'Yasuke', locationId: 'dojo', asset: 'yasuke-compressed.glb', position: [-10.25, .261, -42.95], yaw: 1.3, height: 1.95, animation: { clip: 'Short_Breathe_and_Look_Around', time: 0, loop: true } },
]);

/** New supplied residents keep their original rigs, textures and full clips. */
export const RESIDENT_PLACEMENTS = Object.freeze([
  { id: 'mailman', name: 'The Mailman', locationId: 'post-office', asset: 'mailman.glb', position: [10.1, .261, -8.9], yaw: -1.9, height: 1.75, idle: { clip: 'Fadewood_Relaxed_Idle' }, animation: { clip: 'Fadewood_Relaxed_Idle', time: 0, loop: true }, motionClips: { walk: 'Walking', idle: { clip: 'Fadewood_Relaxed_Idle', paused: false }, fly: '_01a18e89_f67c_70b3_ab8b_c4aa7bf664be' } },
  { id: 'dr-fade', name: 'Dr. Fade', locationId: 'underground-arena', asset: 'dr-fade.glb', position: [21.65, .031, 17.3], yaw: Math.PI + .2, height: 1.85, idle: { clip: 'Fadewood_Relaxed_Idle' }, animation: { clip: 'Alert', time: .5, loop: true } },
  { id: 'blue-yb', name: 'Blue YB', locationId: 'fade-park', asset: 'blue-yb.glb', position: [13, .331, -22.8], yaw: -1.1, height: 1.7, animation: { clip: 'Boxing_Practice', time: 1.2, loop: true, speed: .8 } },
  { id: 'sherlock', name: 'Sherlock', locationId: 'the-block', asset: 'sherlock.glb', position: [-8.7, .261, 11], yaw: 0, height: 1.75, animation: { clip: 'Walking', time: 0, loop: true }, motionClips: { walk: 'Walking', idle: 'Idle_03' } },
  { id: 'nova', name: 'Nova', locationId: 'fade-park', asset: 'nova.glb', position: [16.5, .331, -21.8], yaw: 0, height: .62, animation: { clip: 'Armature|clip0|baselayer', time: 0, loop: true }, motionClips: { walk: 'Armature|clip0|baselayer', idle: 'Armature|clip0|baselayer' } },
  { id: 'golden-doberman', name: 'Golden Doberman', locationId: 'fade-park', asset: 'golden-doberman.glb', position: [18.7, .331, -28.6], yaw: 0, height: .95, animation: { clip: 'Armature|Unreal Take|baselayer', time: 0, loop: true }, motionClips: { walk: 'Armature|Unreal Take|baselayer', idle: { clip: 'Armature|Unreal Take|baselayer', paused: true } } },
]);

export const ALL_CHARACTER_PLACEMENTS = Object.freeze([...CHARACTER_PLACEMENTS, ...RESIDENT_PLACEMENTS, ...ENTRANCE_CHARACTER_PLACEMENTS]);

export const REPLACED_HOST_LOCATIONS = new Set(ALL_CHARACTER_PLACEMENTS.map(({ locationId }) => locationId));
