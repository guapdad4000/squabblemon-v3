import type { PresentationEffect, PresentationPhase } from './PlayLoop';
import type { GuidedReadingCue as SharedGuidedReadingCue } from '../lib/playerControlledPresentation';
import './battle-reading.css';

export type GuidedReadingCue = Pick<SharedGuidedReadingCue, 'kind' | 'title' | 'body' | 'continueLabel'> & { key?: string };

export type BattlePhaseStatus = { key: 'setup' | 'your-turn' | 'your-play' | 'rival-reveal' | 'effects' | 'round-result' | 'match-complete'; label: string; detail?: string };

const RIVAL = new Set<PresentationPhase>(['rival-thinking', 'rival-travel', 'rival-reveal', 'rival-focus', 'rival-slam', 'rival-impact', 'rival-pass']);
const YOURS = new Set<PresentationPhase>(['lock-in', 'player-travel', 'player-reveal', 'player-focus', 'player-slam', 'player-impact', 'player-pass']);

/** Plain-language status derived only from the existing presentation phase. */
export function describeBattlePhase(phase: PresentationPhase, engineComplete: boolean, round: number, effect: PresentationEffect | null, actorName?: string): BattlePhaseStatus {
  if (phase === 'match-finish' || engineComplete) return { key: 'match-complete', label: 'Match complete' };
  if (phase === 'player-ready') return { key: 'your-turn', label: 'Your turn' };
  if (phase === 'effects') {
    const owner = effect ? (effect.owner === 'player' ? 'Your' : 'Rival') : '';
    return { key: 'effects', label: 'Effects resolve', detail: effect ? `${owner}${actorName ? ` ${actorName}` : ' card'}` : undefined };
  }
  if (phase === 'rival-thinking') return { key: 'rival-reveal', label: "Rival's turn", detail: 'Choosing a play' };
  if (phase === 'rival-pass') return { key: 'rival-reveal', label: 'Rival passed' };
  if (phase === 'player-pass') return { key: 'your-play', label: 'Your turn ends' };
  if (RIVAL.has(phase)) return { key: 'rival-reveal', label: 'Rival reveal' };
  if (YOURS.has(phase)) return { key: 'your-play', label: 'Your play lands' };
  if (phase === 'district-flipped' || phase === 'round-result') return { key: 'round-result', label: 'Round result' };
  if (phase === 'round-intro') return { key: 'setup', label: `Round ${round} starting`, detail: 'Cards draw at round start while cards remain.' };
  return { key: 'setup', label: 'Round starting' };
}

export function BattlePhaseStatusChip({ status, onlineLabel }: { status: BattlePhaseStatus; onlineLabel?: string }) {
  const detail = onlineLabel ?? status.detail;
  return (
    <div data-testid="battle-phase-status" data-phase-status={status.key} role="status" aria-live="polite" className={`battle-phase-status is-${status.key}`}>
      <i aria-hidden="true" />
      <b>{status.label}</b>
      {detail && <span>{detail}</span>}
    </div>
  );
}

export function GuidedReadingPanel({ cue, onContinue }: { cue: GuidedReadingCue; onContinue?: () => void }) {
  return (
    <section data-testid="guided-reading-cue" data-cue-kind={cue.kind} aria-labelledby="guided-reading-title" className="guided-reading-cue">
      <div className="guided-reading-cue__kicker">{cue.kind === 'round' ? 'Round recap' : 'What just happened'}</div>
      <h3 id="guided-reading-title">{cue.title}</h3>
      <div className="guided-reading-cue__body" tabIndex={0} aria-label={`${cue.title} details`}>{cue.body}</div>
      <button type="button" data-testid="button-continue-guided-reading" onClick={onContinue} disabled={!onContinue}>{cue.continueLabel}</button>
    </section>
  );
}
