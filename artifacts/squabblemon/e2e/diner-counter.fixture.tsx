import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Battle } from '../src/components/Battle';
import { createCardInstance, createMatch, nextRound, playTurnCard, type EffectLogEntry, type Match } from '../src/gameEngine';
import { buildReplayFrame } from '../src/components/PlayLoop';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { onlineBattleProjection } from '../src/components/MultiplayerBattle';
import { decks } from '../src/data';
import type { OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import '../src/index.css';

type ReceiptState = 'ready' | 'spent' | 'expired';
type JanitorState = 'ready' | 'harm-spent' | 'staff-spent' | 'both-spent' | 'legacy' | 'next-round';
type Perspective = 'player' | 'guest';
type DinerScenario = 'receipt' | 'on-shift' | 'source-killed';
type ScenarioFixture = { match: Match; replayEvent: EffectLogEntry; replayFrame?: Match };

const fixtureQuery = new URLSearchParams(window.location.search);
function queryChoice<const T extends readonly string[]>(key: string, values: T, fallback: T[number]): T[number] {
  const value = fixtureQuery.get(key);
  return values.includes(value as T[number]) ? value as T[number] : fallback;
}

function receiptMatch(state: ReceiptState, janitorState: JanitorState): Match {
  const round = state === 'expired' ? 3 : 1;
  const cashier = { ...createCardInstance('squabblehouse-cashier', 'player', 'diner-counter-fixture', 0), lane: 0 as const };
  const rival = { ...createCardInstance('griddle-master', 'cpu', 'diner-counter-fixture', 1), lane: 0 as const };
  const janitor = { ...createCardInstance('janitor', 'player', 'diner-counter-fixture', 5), lane: 2 as const };
  const ally = { ...createCardInstance('squabblehouse-security', 'player', 'diner-counter-fixture', 6), lane: 2 as const };
  const receipt = {
    kind: 'open-tab',
    owner: 'player',
    lane: 0,
    source: cashier,
    expiresAfterRound: 2,
    ...(state === 'spent' ? { spentRound: round } : {}),
  };
  const reversal = (charge?: 'harm' | 'staff') => ({
    owner: 'player' as const,
    lane: 2 as const,
    round,
    sourceInstanceId: janitor.instanceId,
    targetInstanceId: ally.instanceId,
    ...(charge ? { charge } : {}),
  });
  const janitorReversals = janitorState === 'harm-spent' ? [reversal('harm')]
    : janitorState === 'staff-spent' ? [reversal('staff')]
      : janitorState === 'both-spent' ? [reversal('harm'), reversal('staff')]
        : janitorState === 'legacy' ? [reversal()]
          : janitorState === 'next-round' ? [reversal('harm'), reversal('staff')] : [];
  // Bus Boy now costs 1; keep this actual engine play within the reset Motion budget.
  const replayCard = createCardInstance('squabblehouse-bus-boy', 'player', 'diner-counter-fixture-replay', 2);
  let match = {
    ...createMatch('block', 'slide'),
    round,
    phase: janitorState === 'next-round' ? 'resolved' as const : 'player' as const,
    playerHand: [replayCard],
    cpuHand: [],
    playerMotion: 9,
    boards: [[cashier, rival], [], [janitor, ally]],
    districtTraps: [receipt],
    janitorReversals,
  } as unknown as Match;
  if (janitorState === 'next-round') match = nextRound(match);
  return playTurnCard(match, 'player', replayCard.instanceId, 1);
}

function playFixtureCard(match: Match, cardId: string, owner: 'player' | 'cpu', lane: 0 | 1 | 2, index: number): Match {
  const card = createCardInstance(cardId, owner, 'diner-on-shift-fixture', index);
  const prepared = owner === 'player'
    ? { ...match, phase: 'player' as const, playerHand: [card], playerMotion: 9 }
    : { ...match, phase: 'cpu-reveal' as const, cpuHand: [card], cpuMotion: 9 };
  return playTurnCard(prepared, owner, card.instanceId, lane);
}

function onShiftFixture(sourceKilled: boolean): ScenarioFixture {
  const initial = createMatch('block', 'slide');
  let match: Match = {
    ...initial,
    phase: 'player',
    playerHand: [],
    cpuHand: [],
    playerCardIds: [],
    cpuCardIds: [],
    playerDrawIndex: 0,
    cpuDrawIndex: 0,
    playerMotion: 9,
    cpuMotion: 9,
    boards: [[], [], []],
  };

  // Place an enemy first so the Manager's real On Reveal grants its printed +1 Hand.
  match = playFixtureCard(match, 'griddle-master', 'cpu', 0, 4);
  match = playFixtureCard(match, 'squabble-house-manager', 'player', 0, 1);
  match = playFixtureCard(match, 'squabblehouse-security', 'player', 0, 2);
  match = playFixtureCard(match, 'squabbleserver', 'player', 2, 3);
  // Keep a stable instance identity for this real Bus Boy play and its round-start event.
  const busBoy = createCardInstance('squabblehouse-bus-boy', 'player', 'diner-on-shift-fixture', 0);
  match = playTurnCard({ ...match, phase: 'player', playerHand: [busBoy], playerMotion: 9 },
    'player', busBoy.instanceId, 2);

  // The real On Reveal moves the staff member to lane 1 and gives it +1 Hand.
  match = playFixtureCard(match, 'sugarfoot', 'cpu', 1, 5);
  const prePatrol = match;
  const patrolMatch = nextRound({ ...match, phase: 'resolved' });
  const patrolEvent = patrolMatch.effectLog.filter(event =>
    event.source?.cardInstanceId === busBoy.instanceId && event.note.startsWith('Clear the Table patrol gave')).at(-1);
  if (!patrolEvent) throw new Error('Bus Boy fixture did not produce its round-start arrival reward.');

  const replayFrame = buildReplayFrame(patrolMatch, patrolEvent, 'after');
  if (!sourceKilled) return { match: prePatrol, replayEvent: patrolEvent, replayFrame };

  // P. Tang moves the now-cleansed worker away, leaving Bus Boy as Queen of Hearts' target.
  let departed = playFixtureCard(patrolMatch, 'ptang', 'cpu', 1, 6);
  departed = playFixtureCard(departed, 'queenofhearts', 'cpu', 1, 7);
  return { match: departed, replayEvent: patrolEvent, replayFrame };
}

function roomWithMatch(match: Match): OnlineRoom {
  const now = Date.now();
  const member = (userId: string, deck = decks[0]) => ({ userId, name: userId, ready: false, deck });
  let room = createOnlineRoom(member('receipt-host'), 'player', now);
  room = joinOnlineRoom(room, member('receipt-guest', decks[1]), now);
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
  room = applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
  return { ...room, match };
}

function Fixture() {
  const [scenario, setScenario] = useState<DinerScenario>(() =>
    queryChoice('scenario', ['receipt', 'on-shift', 'source-killed'], 'receipt'));
  const [state, setState] = useState<ReceiptState>(() => queryChoice('receipt', ['ready', 'spent', 'expired'], 'ready'));
  const [janitorState, setJanitorState] = useState<JanitorState>(() =>
    queryChoice('janitor', ['ready', 'harm-spent', 'staff-spent', 'both-spent', 'legacy', 'next-round'], 'ready'));
  const [perspective, setPerspective] = useState<Perspective>(() => queryChoice('perspective', ['player', 'guest'], 'player'));
  const [replay, setReplay] = useState(() => fixtureQuery.get('replay') === 'true');
  const fixture = useMemo<ScenarioFixture>(() => {
    if (scenario === 'on-shift') return onShiftFixture(false);
    if (scenario === 'source-killed') return onShiftFixture(true);
    const match = receiptMatch(state, janitorState);
    const replayEvent = match.effectLog.at(-1);
    if (!replayEvent) throw new Error('Receipt fixture play did not produce a replay event.');
    return { match, replayEvent };
  }, [scenario, state, janitorState]);
  const { match, replayEvent } = fixture;
  const replayMatch = useMemo(() => replay
    ? fixture.replayFrame ?? buildReplayFrame(match, replayEvent, 'after')
    : match, [fixture, match, replay, replayEvent]);
  const room = useMemo(() => roomWithMatch(replayMatch), [replayMatch]);
  const userId = perspective === 'player' ? 'receipt-host' : 'receipt-guest';
  const projected = useMemo(() => {
    const view = onlineRoomView(room, 'DINER1234567', userId, Date.now());
    return onlineBattleProjection(view);
  }, [match, room, userId]);
  const battleMatch = perspective === 'player' ? replayMatch : projected.match;
  return <>
    <header className="flex flex-wrap items-center gap-3 bg-zinc-950 p-3 text-white">
      <label>Diner scenario <select data-testid="select-diner-scenario" value={scenario} onChange={event => setScenario(event.target.value as DinerScenario)}>
        <option value="receipt">Receipt and Janitor</option><option value="on-shift">Manager and Bus Boy shift</option><option value="source-killed">Bus Boy source killed</option>
      </select></label>
      <label>Receipt state <select data-testid="select-receipt-state" value={state} onChange={event => setState(event.target.value as ReceiptState)}>
        <option value="ready">Ready</option><option value="spent">Spent</option><option value="expired">Expired</option>
      </select></label>
      <label>Janitor state <select data-testid="select-janitor-state" value={janitorState} onChange={event => setJanitorState(event.target.value as JanitorState)}>
        <option value="ready">Both ready</option><option value="harm-spent">Harm spent</option><option value="staff-spent">Staff spent</option>
        <option value="both-spent">Both spent</option><option value="legacy">Legacy uncategorized</option><option value="next-round">Next round reset</option>
      </select></label>
      <label>Perspective <select data-testid="select-perspective" value={perspective} onChange={event => setPerspective(event.target.value as Perspective)}>
        <option value="player">Host player</option><option value="guest">Public guest</option>
      </select></label>
      <label><input data-testid="toggle-replay" type="checkbox" checked={replay} onChange={event => setReplay(event.target.checked)} /> Replay</label>
    </header>
    <div className="h-[calc(100dvh-10rem)] sm:h-[calc(100dvh-54px)]">
      <Battle
        match={battleMatch}
        deck={decks[0]}
        rivalDeck={decks[1]}
        selectedInstanceId={null}
        setSelectedInstanceId={() => {}}
        selectedLane={null}
        setSelectedLane={() => {}}
        commit={() => {}}
        skipSequence={() => {}}
        presentationPhase={replay ? 'replay' : 'player-ready'}
        phaseMessage="Receipt marker verification"
        timerSeconds={20}
        timerEnabled={false}
        impactLane={null}
        stagedRival={null}
        stagedPlayer={null}
        activeEffectId={null}
        activeEffectLane={null}
        activeEffect={null}
        presentationScores={projected.presentation.scores}
        squabble={false}
        setSquabble={() => {}}
        setInspect={() => {}}
        archiveMatch={() => {}}
        onShowRules={() => {}}
        replay={replay ? { event: replayEvent, step: 'after' } : undefined}
        online={perspective === 'guest' ? {
          ...projected.presentation,
          status: 'Rival turn',
          yourTurn: false,
          clockRunning: false,
        } : undefined}
      />
    </div>
  </>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<Fixture />);
import.meta.hot?.dispose(() => root.unmount());