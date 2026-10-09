/** Give every actual police play its own readable entrance beat. */
export const POLICE_ENTRANCE_MS = 900;
export const policeRevealDuration = (plays: number) =>
  150 + plays * POLICE_ENTRANCE_MS;
