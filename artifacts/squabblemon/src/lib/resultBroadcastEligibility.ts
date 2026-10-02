export type ResultBroadcastMode = 'guest' | 'practice' | 'tutorial' | 'story';
export type ResultBroadcastOutcome = 'victory' | 'defeat' | 'draw';

const TRAINING_CIRCUIT_ACTIVITIES = new Set([
  'auto',
  'fair',
  'pressure',
  'control',
  'movement',
  'support',
  'freeze',
  'cheap',
]);

export function isTrainingCircuitActivity(activity?: string | null) {
  return activity != null && TRAINING_CIRCUIT_ACTIVITIES.has(activity);
}

export function isResultBroadcastEligible({
  mode,
  trainingCircuit = false,
  phase,
}: {
  mode: ResultBroadcastMode;
  trainingCircuit?: boolean;
  phase: string;
}) {
  return phase === 'complete' && (mode === 'story' || (mode === 'practice' && trainingCircuit));
}

export function claimResultBroadcastOnce(seenMatches: Set<string>, matchKey: string) {
  if (seenMatches.has(matchKey)) return false;
  seenMatches.add(matchKey);
  return true;
}

export function resultBroadcastOutcome(winner: 'player' | 'cpu' | 'draw'): ResultBroadcastOutcome {
  return winner === 'player' ? 'victory' : winner === 'cpu' ? 'defeat' : 'draw';
}