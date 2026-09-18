import type { BattleFeedback } from './battleFeedback';
import type { PresentationTimeline } from './presentationTimeline';

type VisibilityPhase = 'player-ready' | 'match-finish' | string;

export function settleHiddenBattlePresentation(
  phase: VisibilityPhase,
  feedback: Pick<BattleFeedback, 'reset'>,
  timeline: Pick<PresentationTimeline, 'completeAll'>,
  enableFastForward: () => void,
) {
  feedback.reset();
  if (phase === 'player-ready' || phase === 'match-finish') return false;
  enableFastForward();
  timeline.completeAll();
  return true;
}