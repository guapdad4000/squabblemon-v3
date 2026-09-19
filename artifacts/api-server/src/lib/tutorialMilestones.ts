import type { EffectLogEntry } from "@workspace/squabblemon-engine/gameEngine";

export type TutorialMilestones = {
  playerCardPlayed: boolean;
  bankedMotionAfterPlay: boolean;
  squabbleUsed: boolean;
};

type TutorialEvent = {
  readonly round: EffectLogEntry["round"];
  readonly type: EffectLogEntry["type"];
  readonly owner: EffectLogEntry["owner"];
  readonly resources: {
    readonly before: Pick<EffectLogEntry["resources"]["before"], "playerMotion">;
  };
  readonly replay: {
    readonly before: Pick<EffectLogEntry["replay"]["before"], "squabbleUsed" | "squabbleByOwner">;
    readonly after: Pick<EffectLogEntry["replay"]["after"], "squabbleUsed" | "squabbleByOwner">;
  };
};

type TutorialMatchHistory = {
  readonly effectLog: readonly TutorialEvent[];
};

const playerSquabbleUsed = (
  state: TutorialEvent["replay"]["before"] | TutorialEvent["replay"]["after"],
) => state.squabbleByOwner?.player ?? state.squabbleUsed;

/** Derive the authored round-one through round-four lessons from verified events. */
export function getTutorialMilestones(
  match: TutorialMatchHistory,
): TutorialMilestones {
  const playerPlays = match.effectLog.filter(
    (event) => event.owner === "player" && event.type === "play",
  );
  const playRounds = new Set(playerPlays.map((event) => event.round));
  const firstPlayRound = playerPlays.reduce(
    (earliest, event) => Math.min(earliest, event.round),
    Number.POSITIVE_INFINITY,
  );

  return {
    playerCardPlayed: playerPlays.length > 0,
    bankedMotionAfterPlay: match.effectLog.some(
      (event) =>
        event.owner === "player" &&
        event.type === "pass" &&
        event.round === 3 &&
        event.round > firstPlayRound &&
        !playRounds.has(event.round) &&
        event.resources.before.playerMotion > 0,
    ),
    squabbleUsed: playerPlays.some(
      (event) =>
        event.round === 4 &&
        !playerSquabbleUsed(event.replay.before) &&
        playerSquabbleUsed(event.replay.after),
    ),
  };
}

export function completedTutorialMilestones(
  milestones: TutorialMilestones,
): boolean {
  return (
    milestones.playerCardPlayed &&
    milestones.bankedMotionAfterPlay &&
    milestones.squabbleUsed
  );
}