/** Server-authoritative arcade run rules. A run is a chain of ordinary,
 * deterministic matches; this file only decides chain transitions. */
export type ChallengeStatus = "active" | "settled" | "abandoned";
export type MatchOutcome = "win" | "loss" | "draw";
export type ChallengeTranscript = {
  matchId: string;
  moves: readonly unknown[];
  outcome: MatchOutcome;
  checkpoint: string;
};
export type CrewCardSnapshot = {
  cardId: string;
  xp: number;
  level: number;
  moveTier?: number;
  upgradeIds: string[];
};
export type CrewSnapshot = { deckId: string; cards: CrewCardSnapshot[]; capturedAt: string; rulesVersion: number };
export type ChallengeEncounter = { index: number; seed: number; boss: boolean; rivalDeckId: string; playerMatchId: string };
export type ChallengeRun = {
  id: string; playerId: string; status: ChallengeStatus; seed: number;
  entryDate: string; entryNumber: 1 | 2; encounterIndex: number; wins: number;
  crew: CrewSnapshot; encounter: ChallengeEncounter;
  transcripts: ChallengeTranscript[]; personalBest: boolean;
};

export function utcDay(value: Date | string | number = new Date()): string {
  return new Date(value).toISOString().slice(0, 10);
}
export function encounterFor(seed: number, index: number, playerMatchId = ""): ChallengeEncounter {
  const boss = (index + 1) % 5 === 0;
  return { index, seed: (seed + Math.imul(index, 2654435761)) >>> 0, boss,
    rivalDeckId: boss ? "block" : ["block", "slide", "combo", "receipts", "crashout", "vibes", "compound"][(seed + index) % 7], playerMatchId };
}
export function checkpointFor(matchId: string, moves: readonly unknown[]): string {
  return JSON.stringify({ matchId, moves });
}
export function recordChallengeMatch(run: ChallengeRun, transcript: ChallengeTranscript, nextMatchId: string): ChallengeRun {
  if (run.status !== "active") throw new Error("Challenge run is no longer active");
  const prior = run.transcripts.find((item) => item.matchId === transcript.matchId);
  if (prior) return prior.checkpoint === transcript.checkpoint ? run : (() => { throw new Error("Match checkpoint was changed"); })();
  if (transcript.checkpoint !== checkpointFor(transcript.matchId, transcript.moves)) throw new Error("Invalid challenge transcript checkpoint");
  if (transcript.matchId !== run.encounter.playerMatchId) throw new Error("Match does not belong to this encounter");
  if (transcript.outcome === "draw") return { ...run, transcripts: [...run.transcripts, transcript] };
  if (transcript.outcome === "loss") return { ...run, status: "settled", transcripts: [...run.transcripts, transcript] };
  const index = run.encounterIndex + 1;
  return { ...run, wins: run.wins + 1, encounterIndex: index,
    encounter: encounterFor(run.seed, index, nextMatchId), transcripts: [...run.transcripts, transcript] };
}
export function settleChallenge(run: ChallengeRun): ChallengeRun {
  if (run.status === "abandoned") throw new Error("Abandoned challenge cannot be settled");
  return run.status === "settled" ? run : { ...run, status: "settled" };
}
export function abandonChallenge(run: ChallengeRun): ChallengeRun {
  if (run.status === "settled") throw new Error("Settled challenge cannot be abandoned");
  return run.status === "abandoned" ? run : { ...run, status: "abandoned" };
}