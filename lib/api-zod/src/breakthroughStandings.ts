/** Authenticated GET /api/breakthrough/standings; bounded to 20 leaders plus caller. */
export type BreakthroughStanding = {
  name: string; avatarKey: string; trophies: number; wins: number; games: number;
  position: number; isYou: boolean; automated: boolean;
};
export type BreakthroughStandings = {
  season: string; updatedAt: string; total: number;
  leaders: BreakthroughStanding[]; you: BreakthroughStanding | null;
};
