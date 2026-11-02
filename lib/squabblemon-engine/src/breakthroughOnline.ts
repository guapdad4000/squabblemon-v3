/** Hand-written online contract shared by the API and browser. Server owns all grants. */
export const BREAKTHROUGH_PROTOCOL = "breakthrough-online-v1";
export const BREAKTHROUGH_SEASON = "breakthrough-season-1";
export const BREAKTHROUGH_REWARD_POLICY = "breakthrough-trophies-v1";
export interface BreakthroughReceipt {
  roomId: string;
  policy: typeof BREAKTHROUGH_REWARD_POLICY;
  season: typeof BREAKTHROUGH_SEASON;
  outcome: "win" | "loss" | "draw" | "expired";
  eligible: boolean;
  exclusion:
    "incomplete" | "insufficient-play" | "daily-cap" | "opponent-cap" | null;
  before: number;
  after: number;
  delta: number;
}
export interface BreakthroughLobby {
  search: {
    requestId: string;
    deckId: string;
    status: "waiting" | "paired" | "cancelled" | "complete";
    roomId: string | null;
  } | null;
  record: { trophies: number; wins: number; losses: number; draws: number };
}
