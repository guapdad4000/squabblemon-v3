import { useState } from 'react';
import './_group.css';
import { Battle } from './_shared/components/Battle';
import { createMatch } from './_shared/engine/gameEngine';
import { decks } from './_shared/engine/data';

const match = createMatch('block', 'combo');
const deck = decks.find((item) => item.id === 'block')!;
const rivalDeck = decks.find((item) => item.id === 'combo')!;

/** Genuine copied Battle with a deliberately inert, local round-one fixture. */
export function Current() {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState<number | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [feedbackPreferences, setFeedbackPreferences] = useState({ audioEnabled: true, hapticsEnabled: true });

  return (
    <div className="relative h-[100dvh] flex flex-col">
      <span className="battle-current-preview-label">Current implementation · isolated sample state · preview only</span>
      <div className="flex-1 min-h-0">
      <Battle
        match={match}
        deck={deck}
        rivalDeck={rivalDeck}
        selectedInstanceId={selectedInstanceId}
        setSelectedInstanceId={setSelectedInstanceId}
        selectedLane={selectedLane}
        setSelectedLane={setSelectedLane}
        commit={() => undefined}
        skipSequence={() => undefined}
        presentationPhase="player-ready"
        phaseMessage="ROUND 1 // YOUR MOVE"
        timerSeconds={20}
        timerEnabled
        impactLane={null}
        stagedRival={null}
        stagedPlayer={null}
        activeEffectId={null}
        activeEffectLane={null}
        activeEffect={null}
        squabble={squabble}
        setSquabble={setSquabble}
        setInspect={() => undefined}
        archiveMatch={() => undefined}
        onShowRules={() => undefined}
        presentationScores={null}
        feedbackPreferences={feedbackPreferences}
        setFeedbackPreferences={setFeedbackPreferences}
        decisionStartedAt={0}
        equippedVariants={{}}
        authoritativeHistory={match.effectLog}
        replay={null}
        onReplayStep={() => undefined}
        onExitReplay={() => undefined}
      />
      </div>
    </div>
  );
}