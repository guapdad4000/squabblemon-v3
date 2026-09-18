import { Profiler, useCallback, useMemo, useState } from 'react';
import { LayoutGroup, MotionConfig } from 'framer-motion';
import { decks } from '../data';
import { canAffordSelection, createMatch, nextRound, playCard, type CardInstance, type Lane, type Match, type ScoreState } from '../gameEngine';
import { Battle } from './Battle';
import { applyEventState, EFFECT_PRESENTATION_TIMING, type PresentationEffect, type PresentationPhase } from './PlayLoop';

declare global {
  interface Window {
    __battlePerf?: {
      ready: boolean;
      run: () => Promise<{ commits: number; renderDurationMs: number; occupiedDistricts: number }>;
    };
  }
}

const noop = () => {};
const waitForDuration = (durationMs: number) => new Promise<void>((resolve) => {
  const started = performance.now();
  const sample = (now: number) => now - started >= durationMs ? resolve() : requestAnimationFrame(sample);
  requestAnimationFrame(sample);
});

type ScriptedFrame = {
  match: Match;
  lane: Lane | null;
  phase: PresentationPhase;
  stagedPlayer: CardInstance | null;
  stagedRival: CardInstance | null;
  activeEffectId: string | null;
  activeEffect: PresentationEffect | null;
  presentationScores: ScoreState[] | null;
  timing: 'beforeMs' | 'afterMs';
};

const allCards = (match: Match) => [...match.playerHand, ...match.cpuHand, ...match.boards.flat()];
const cardById = (match: Match, instanceId: string) => allCards(match).find((card) => card.instanceId === instanceId);

function buildSixRoundScript() {
  let match = createMatch('block', 'combo');
  const frames: ScriptedFrame[] = [];

  const presentResolvedPlay = (before: Match, resolved: Match) => {
    let visual = before;
    const events = resolved.effectLog
      .filter((event) => event.sequence >= before.nextEventSequence)
      .sort((a, b) => a.sequence - b.sequence);

    for (const event of events) {
      const sourceId = event.source?.cardInstanceId ?? event.cardInstanceId;
      const targetIds = event.targets.map((target) => target.cardInstanceId);
      const eventLane = event.source?.after?.lane
        ?? event.source?.before?.lane
        ?? event.targets[0]?.after?.lane
        ?? event.targets[0]?.before?.lane
        ?? event.lane;
      const isPlay = event.type === 'play';
      const staged = isPlay ? cardById(resolved, sourceId) ?? cardById(visual, sourceId) ?? null : null;
      const effect: PresentationEffect = { ...event, cardInstanceId: sourceId, lane: eventLane, targetIds };
      const travelPhase: PresentationPhase = isPlay
        ? event.owner === 'player' ? 'player-travel' : 'rival-travel'
        : 'effects';
      const impactPhase: PresentationPhase = isPlay
        ? event.owner === 'player' ? 'player-impact' : 'rival-impact'
        : 'effects';

      visual = applyEventState(visual, resolved, event, 'before');
      frames.push({
        match: visual,
        lane: eventLane,
        phase: travelPhase,
        stagedPlayer: event.owner === 'player' ? staged : null,
        stagedRival: event.owner === 'cpu' ? staged : null,
        activeEffectId: event.source ? sourceId : null,
        activeEffect: effect,
        presentationScores: event.scores.before,
        timing: 'beforeMs',
      });
      visual = applyEventState(visual, resolved, event, 'after');
      frames.push({
        match: visual,
        lane: eventLane,
        phase: impactPhase,
        stagedPlayer: event.owner === 'player' ? staged : null,
        stagedRival: event.owner === 'cpu' ? staged : null,
        activeEffectId: event.source ? sourceId : null,
        activeEffect: effect,
        presentationScores: event.scores.after,
        timing: 'afterMs',
      });
    }
  };

  for (let round = 1; round <= 6; round += 1) {
    const lane = ((round - 1) % 3) as Lane;
    const playerCard = match.playerHand.find((card) => canAffordSelection(match, 'player', card.instanceId, lane));
    if (!playerCard) throw new Error(`No legal scripted player card in round ${round}.`);
    const playerResolved = playCard(match, 'player', playerCard.instanceId, lane);
    presentResolvedPlay(match, playerResolved);
    match = playerResolved;

    const cpuCard = match.cpuHand.find((card) => canAffordSelection(match, 'cpu', card.instanceId, lane));
    if (!cpuCard) throw new Error(`No legal scripted rival card in round ${round}.`);
    const cpuResolved = playCard(match, 'cpu', cpuCard.instanceId, lane);
    presentResolvedPlay(match, cpuResolved);
    match = cpuResolved;
    match = nextRound(match);
  }

  return { frames, finalMatch: match };
}

export function BattlePerfHarness() {
  const script = useMemo(buildSixRoundScript, []);
  const [frame, setFrame] = useState<ScriptedFrame>(() => ({
    match: createMatch('block', 'combo'),
    lane: null,
    phase: 'player-ready',
    stagedPlayer: null,
    stagedRival: null,
    activeEffectId: null,
    activeEffect: null,
    presentationScores: null,
    timing: 'afterMs',
  }));
  const [commits, setCommits] = useState(0);
  const [renderDurationMs, setRenderDurationMs] = useState(0);
  const deck = decks.find((item) => item.id === frame.match.playerDeck);
  const rivalDeck = decks.find((item) => item.id === frame.match.cpuDeck);

  const run = useCallback(async () => {
    let measuredCommits = 0;
    let measuredDuration = 0;
    const record = (_id: string, _phase: string, actualDuration: number) => {
      measuredCommits += 1;
      measuredDuration += actualDuration;
    };
    window.__battlePerfRecord = record;

    for (const nextFrame of script.frames) {
      setFrame(nextFrame);
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'standard';
      await waitForDuration(EFFECT_PRESENTATION_TIMING[motion][nextFrame.timing]);
    }

    setFrame({
      match: script.finalMatch,
      lane: null,
      phase: 'player-ready',
      stagedPlayer: null,
      stagedRival: null,
      activeEffectId: null,
      activeEffect: null,
      presentationScores: null,
      timing: 'afterMs',
    });
    await waitForDuration(EFFECT_PRESENTATION_TIMING.reduced.afterMs);
    window.__battlePerfRecord = undefined;
    setCommits(measuredCommits);
    setRenderDurationMs(measuredDuration);
    const occupiedDistricts = script.finalMatch.boards.filter((lane) => lane.length > 0).length;
    return { commits: measuredCommits, renderDurationMs: measuredDuration, occupiedDistricts };
  }, [script]);

  window.__battlePerf = { ready: true, run };

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <Profiler
          id="crowded-battle"
          onRender={(...args) => window.__battlePerfRecord?.(args[0], args[1], args[2])}
        >
          <div data-testid="battle-perf-harness" data-commits={commits} data-render-duration={renderDurationMs}>
          <Battle
          match={frame.match}
          deck={deck}
          rivalDeck={rivalDeck}
          selectedInstanceId={null}
          setSelectedInstanceId={noop}
          selectedLane={null}
          setSelectedLane={noop}
          commit={noop}
          skipSequence={noop}
          presentationPhase={frame.phase}
          phaseMessage={frame.activeEffect?.note ?? `ROUND ${frame.match.round} // YOUR MOVE`}
          timerSeconds={20}
          timerEnabled={false}
          impactLane={frame.lane}
          stagedRival={frame.stagedRival}
          stagedPlayer={frame.stagedPlayer}
          activeEffectId={frame.activeEffectId}
          activeEffectLane={frame.lane}
          activeEffect={frame.activeEffect}
          presentationScores={frame.presentationScores}
          squabble={false}
          setSquabble={noop}
          setInspect={noop}
          archiveMatch={noop}
          onShowRules={noop}
        />
          </div>
        </Profiler>
      </LayoutGroup>
    </MotionConfig>
  );
}

declare global {
  interface Window {
    __battlePerfRecord?: (id: string, phase: string, actualDuration: number) => void;
  }
}