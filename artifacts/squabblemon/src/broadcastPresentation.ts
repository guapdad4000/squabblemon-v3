export type DistrictOwner = 'player' | 'cpu' | 'draw';

export const changedDistrictControl = (
  before: DistrictOwner[],
  after: DistrictOwner[],
): number[] =>
  after.flatMap((owner, lane) =>
    owner !== 'draw' && owner !== before[lane] ? [lane] : [],
  );

export const broadcastDelay = (
  normalMs: number,
  reducedMs: number,
  reducedMotion: boolean,
  fastForward = false,
): number => fastForward ? 0 : reducedMotion ? reducedMs : normalMs;

export const isReducedMotionRequested = (
  systemPreference: boolean,
  savedPreference: boolean,
): boolean => systemPreference || savedPreference;