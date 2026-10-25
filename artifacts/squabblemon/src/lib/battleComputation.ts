import { revealCpuTurn, type Match, type Lane } from '../gameEngine';
import { previewBattlePlay } from '../battlePreview';

export type PreviewInput = { match: Match; instanceId: string; squabble: boolean; lane: number | null; investment: number };
export type BattleJob = { kind: 'previews'; input: PreviewInput } | { kind: 'rival'; input: Match };
export type PreviewResults = ReturnType<typeof previewBattlePlay>[];
/** Replay boards are presentation-only. Preserve event metadata and sequence/seed inputs. */
export function computationMatch(match: Match, publicOnly = false): Match {
  return { ...match, effectLog: match.effectLog.map(({ replay: _replay, ...event }) => event as Match['effectLog'][number]),
    ...(publicOnly ? { cpuHand: [], cpuCardIds: [], cpuDrawIndex: 0 } : {}) };
}
export function computePreviews({ match, instanceId, squabble, lane: selectedLane, investment }: PreviewInput): PreviewResults {
  const card = match.playerHand.find(card => card.instanceId === instanceId);
  return ([0, 1, 2] as Lane[]).map(lane => card
    ? previewBattlePlay(match, instanceId, lane, card.kind === 'blockbuster' ? false : squabble, lane === selectedLane ? investment : 0) : null);
}
export function computeBattleJob(job: BattleJob) {
  if (job.kind === 'previews') return computePreviews(job.input);
  const result = revealCpuTurn(job.input);
  // Return only newly authored replay entries; the caller owns the old history.
  return { ...result, effectLog: result.effectLog.filter(event => event.sequence >= job.input.nextEventSequence) };
}
