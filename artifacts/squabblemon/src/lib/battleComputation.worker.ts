import { computeBattleJob, type BattleJob } from './battleComputation';
const scope = self as unknown as { onmessage: ((event: MessageEvent<{ id: number; job: BattleJob }>) => void) | null; postMessage: (value: unknown) => void };
scope.onmessage = ({ data: { id, job } }) => {
  try { scope.postMessage({ id, result: computeBattleJob(job) }); }
  catch (error) { scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) }); }
};
