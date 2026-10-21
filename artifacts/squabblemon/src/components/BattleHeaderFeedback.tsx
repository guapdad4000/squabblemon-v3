import type { ReactNode } from 'react';
import type { Card } from '../data';
import { getAssetUrl, getCardImage } from '../data';
import { abilityFailed } from '../abilityOutcome';
import { getCardArtworkId } from '../lib/assets';
import { BattlePhaseStatusChip, describeBattlePhase } from './BattleReadingCue';
import type { PresentationEffect, PresentationPhase } from './PlayLoop';

/** Presentation only: source/chain stay in the header; totals stay on their districts. */
export function BattleHeaderFeedback({ phase, round, complete, effect, actor, landed, decision, phaseMessage, onlineLabel, detail, upgradeName, claims }: {
  phase: PresentationPhase; round: number; complete: boolean;
  effect: PresentationEffect | null; actor?: Card | null; landed: boolean;
  decision: string; detail: string; phaseMessage: string; onlineLabel?: string; upgradeName?: string | null;
  claims?: ReactNode;
}) {
  const status = describeBattlePhase(phase, complete, round, effect, actor?.name);
  const failed = effect ? abilityFailed(effect) : false;
  const chain = effect?.chain && effect.chain.total > 1 ? effect.chain : null;
  const resolving = phase === 'round-result' || phase === 'district-flipped';
  const showMove = !!effect && !!actor && !resolving && !['round-intro', 'match-finish'].includes(phase);
  const move = showMove ? upgradeName ?? effect.abilityMetadata?.upgradeName ?? (effect.type === 'play' ? actor.name : actor.ability) : undefined;
  const guidance = phase === 'player-ready' ? decision : resolving ? `Round ${round} settled` : phase === 'round-intro' ? `Round ${round}` : phaseMessage;
  return <div className="battle-live-feedback" data-testid="battle-live-feedback">
    <div className="battle-live-move" data-testid="battle-live-move" title={showMove ? `${actor.name} · ${move}${failed ? ' · No effect' : ''}` : detail}>
      {showMove && <img src={getCardImage(getCardArtworkId(actor))} alt="" width="34" height="40" />}
      {!showMove && phase === 'round-intro' && round <= 6 && <img data-testid={`broadcast-round-${String(round).padStart(2, '0')}`} src={getAssetUrl(`assets/fight-night/round-${String(round).padStart(2, '0')}.webp`)} alt="" width="34" height="40" />}
      <div className="battle-live-move__copy">
        {showMove ? <span className="battle-live-kicker">{effect.owner === 'player' ? 'Your' : 'Rival'} move · {failed ? 'No effect' : landed ? 'Landed' : 'Windup'}</span>
          : <BattlePhaseStatusChip status={status} onlineLabel={onlineLabel} />}
        <strong data-testid="battle-guidance"><span data-testid={showMove && upgradeName ? "effect-upgrade-trigger" : undefined}>{showMove && upgradeName ? `Upgrade · ${move}` : move ?? guidance}</span></strong>
        {!showMove && <span className="sr-only">{detail}</span>}
        {showMove && <span className="sr-only"><BattlePhaseStatusChip status={status} onlineLabel={onlineLabel} /></span>}
      </div>
    </div>
    {claims && <div className="battle-live-claims">{claims}</div>}
    <div className="battle-live-combo" data-testid="battle-live-combo">
      {chain && showMove ? <div data-testid="ability-chain" aria-label={`Combo ${chain.index} of ${chain.total}`}>
        <span className="battle-live-kicker">Combo</span>
        <strong><b>{chain.index}</b><small> / {chain.total}</small></strong>
        <span className="battle-combo-track" aria-hidden="true"><i style={{ transform: `scaleX(${Math.min(1, chain.index / chain.total)})` }} /></span>
      </div> : showMove ? <><span className="battle-live-kicker">{actor.name}</span><strong>{failed ? 'No effect' : effect.durationLabel ?? effect.kind}</strong></>
        : resolving ? <><span className="battle-live-kicker">Districts</span><strong>Scores settled</strong></> : null}
    </div>
  </div>;
}
