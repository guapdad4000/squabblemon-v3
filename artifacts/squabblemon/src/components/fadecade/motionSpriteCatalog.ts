/** Every atlas uses four horizontal frames. Animation only presents server-owned state. */
export interface SpriteAnimation {
  atlas: string;
  row: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  duration: number;
  loop: boolean;
  frames?: 2 | 4;
  firstFrame?: number;
  stillFrame?: number;
}
export const MOTION_ASSET_ROOT = 'assets/minigames/motion-v1';
const clip = (atlas: string, row: number, rows: number, duration = 1000, loop = true, cellWidth = 128, cellHeight = cellWidth): SpriteAnimation =>
  ({ atlas, row, rows, duration, loop, cellWidth, cellHeight, stillFrame: loop ? 0 : 2 });
export function arcadeSpriteAnimation(name: string): SpriteAnimation | null {
  const girl = /^girl-([0-2])-(front|back)(?:-(jab-left|jab-right|uppercut|duck))?$/.exec(name);
  if (girl) {
    const row = girl[3] ? ['jab-left', 'jab-right', 'uppercut', 'duck'].indexOf(girl[3]) + 1 : 0;
    return clip(`girl-${girl[1]}-${girl[2]}`, row, 5, row ? 480 : 1200, row === 0, 320);
  }
  if (name === 'market-doctor-north' || name === 'market-punch-north') return clip('market-crew', name === 'market-punch-north' ? 1 : 0, 6, name === 'market-punch-north' ? 450 : 1100, name !== 'market-punch-north');
  if (name === 'market-cashier' || name === 'market-restock' || name === 'market-cashier-front') return clip('market-crew', name === 'market-restock' ? 3 : 2, 6, name === 'market-restock' ? 650 : 700);
  if (name === 'market-doctor-front' || name === 'market-doctor') return clip('block-crew', 0, 3, 1200, true, 96);
  if (/^market-yn-[01]$/.test(name)) return clip('market-crew', 4 + Number(name.at(-1)), 6, 650);
  return null;
}
export function waffleSpriteAnimation(name: string): SpriteAnimation | null {
  const bird = ['pigeon-idle', 'pigeon-hop', 'pigeon-attack', 'pigeon-back', 'pigeon-syrup', 'pigeon-hurt'].indexOf(name);
  if (bird >= 0) return clip('waffle-pigeon', bird, 6, bird === 1 ? 320 : bird === 0 || bird === 3 ? 1000 : 600, bird === 0 || bird === 3);
  const staff = /^staff-([0-3])(?:-(attack))?$/.exec(name);
  if (staff) return { ...clip(`waffle-staff-${staff[1]}`, 0, 1, staff[2] ? 600 : 1100, !staff[2]), frames: 2, firstFrame: staff[2] ? 2 : 0, stillFrame: staff[2] ? 3 : 0 };
  return null;
}
export function stockzSpriteAnimation(mood: 'idle' | 'waiting' | 'win' | 'miss'): SpriteAnimation {
  const row = ['idle', 'waiting', 'win', 'miss'].indexOf(mood);
  return clip('stockz-chibi', row, 4, row < 2 ? 1400 : 900, row < 2, 160);
}
export function blockSpriteAnimation(crew: number): SpriteAnimation {
  return clip('block-crew', Math.max(0, Math.min(2, crew)), 3, 1200, true, 96);
}
export function roadSpriteAnimation(defeated: boolean): SpriteAnimation {
  return clip('road-rest', defeated ? 1 : 0, 2, defeated ? 850 : 1400, !defeated, 128, 192);
}
