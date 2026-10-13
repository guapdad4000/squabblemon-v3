import type { ChallengeRun } from "@workspace/api-client-react";
/** A stale/error payload must become retry UI, never a cabinet render crash. */
export function challengeRunResponse(value: unknown): ChallengeRun[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (run) =>
        !run ||
        typeof run !== "object" ||
        typeof run.id !== "string" ||
        typeof run.status !== "string" ||
        !Number.isFinite(run.wins) ||
        !Number.isFinite(run.encounterIndex) ||
        !run.encounter ||
        typeof run.encounter !== "object",
    )
  )
    throw new Error(
      "Your saved road response was incomplete. Please reload the road.",
    );
  return value as ChallengeRun[];
}
