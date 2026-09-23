export type ChallengeRunRef = { id: string; status: string };

/** A saved active run belongs on the road until the player explicitly opens
 * its cabinet. The server's active-run state must never auto-mount a battle. */
export function selectedChallengeRun<T extends ChallengeRunRef>(
  runs: readonly T[],
  battleRunId: string | null,
): T | undefined {
  if (!battleRunId) return undefined;
  return runs.find(run => run.id === battleRunId);
}