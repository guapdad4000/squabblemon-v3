import { PersonalFadeRecord } from './social/PersonalFadeRecord';
import { BattleReactions } from './BattleReactions';
import { MatchArrival } from './MatchArrival';
import { ParkResult } from './ParkResult';
import { PostMatchHomie } from './social/PostMatchHomie';
import { FadeSeriesBoard } from './social/FadeSeriesBoard';
import { resolveRoomExit, type RoomExitIntent } from '../lib/roomExit';
import { onlineResultCopy } from './onlineResultCopy';
import { useBattleResultExit } from '../lib/useBattleResultExit';
import { useTurnClockCues } from '../lib/turnClockCues';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { replaceEqualDeep } from '@tanstack/react-query';
import { LayoutGroup, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cards, getAssetUrl, type Card } from '../data';
import { KumiteArena } from './kumite/KumiteArena';
import { KumiteResult } from './kumite/KumiteResult';
import { SUMMON_TEMPLATES, type CardInstance, type Lane, type Match } from '../gameEngine';
import { otherSeat, TURN_SECONDS, type OnlineCommand, type OnlineRoomView, type PublicCard, type Seat } from '@workspace/squabblemon-engine/multiplayer';
import { DEFAULT_PLAYER_MAT_ID } from '@workspace/squabblemon-engine/playerMats';
import { Battle, type OnlineBattlePresentation } from './Battle';
import { useOnlineEffectPresenter } from '../lib/useOnlineEffectPresenter';
import type { PresentationEffect } from './PlayLoop';
import { BattleStartSmoke } from './BattleStartSmoke';
import { CardInspector } from './CardInspector';
import { RulesModal } from './RulesModal';
import { BattleFeedback } from '../battleFeedback';
import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { GamePopupCopy, GamePopupLabel, GamePopupSecondary, GamePopupTitle, RewardFileAction, RewardFilePaper } from './ui/game-popup';
import '../styles/pvp-exit-dialog.css';
import { setBattleMusicMode } from '../musicStore';
import { runWithoutDeckExitGuard, setDeckExitGuard } from '../lib/deckExitGuard';

type BuddyPublicState = Pick<CardInstance, 'buddyForm' | 'buddyGrowthAtRound' | 'buddyEarthExpiresAtRound' | 'buddyBud'>;
type OnlinePublicCard = PublicCard & Partial<BuddyPublicState>;

const buddyBudDefinition: Card = {
  id: 'buddy-bud', name: 'Buddy Bud', type: 'Plant', cost: 0, power: 0,
  ability: 'Buddy Bud', effect: 'Gives +3 Hands to the last eligible friendly card summoned in this district when it sprouts.',
  abilityUpgrades: [], kind: 'token', hazard: true,
};
const definition = (id: string): Card => {
  if (id === 'buddy-bud') return buddyBudDefinition;
  if (id === 'burnt-plate') return { ...buddyBudDefinition, id: 'the-cookout', name: 'Burnt Plate', type: 'Fire', ability: 'Still Smoking', effect: 'At each round end, give a random friendly character here 1 Burn.' };
  const card = cards[id] ?? SUMMON_TEMPLATES[id as keyof typeof SUMMON_TEMPLATES];
  if (!card) throw new Error(`Unknown public multiplayer card: ${id}`);
  return card;
};
export const asCard = (card: OnlinePublicCard): CardInstance => {
  const base = definition(card.cardId);
  return {
    ...base, ...card, ...card.form, id: card.artworkId ?? base.id,
    ...(card.maryElephant ? { cost: 4, power: 4 } : {}),
    hazard: card.hazard ? true : undefined,
    deck: 'online', playedRound: null, lastEffectNote: '',
  };
};

/** Undo only unpresented public changes; this never feeds back into server actions. */
export function onlinePresentationBoards(boards: Match['boards'], pending: readonly PresentationEffect[], known: ReadonlyMap<string, CardInstance>): Match['boards'] {
  const waiting = pending.filter(event => !event.impact);
  if (!waiting.length) return boards;
  const byId = new Map(boards.flat().map(card => [card.instanceId, card]));
  const order = new Map([...known.keys(), ...byId.keys()].map((id, i) => [id, i]));
  for (const event of [...waiting].reverse()) {
    for (const p of [event.source, ...event.targets]) {
      if (!p) continue;
      if (!p.before || p.before.lane === null) { byId.delete(p.cardInstanceId); continue; }
      const base = byId.get(p.cardInstanceId) ?? known.get(p.cardInstanceId);
      byId.set(p.cardInstanceId, { ...(base ?? { ...definition(p.cardId), deck: 'online', playedRound: null }),
        ...p.before, instanceId: p.cardInstanceId, cardId: p.cardId, owner: p.before.owner ?? p.owner });
    }
  }
  return ([0, 1, 2] as Lane[]).map(lane => [...byId.values()].filter(c => c.lane === lane)
    .sort((a, b) => (a.arrivalOrder ?? order.get(a.instanceId) ?? Infinity) - (b.arrivalOrder ?? order.get(b.instanceId) ?? Infinity))) as Match['boards'];
}

export function computeTurnSecondsRemaining(deadline: number | null | undefined, nowMs: number, clockOffsetMs: number): number {
  if (deadline == null) return 0;
  return Math.max(0, Math.min(TURN_SECONDS, Math.ceil((deadline - nowMs - clockOffsetMs) / 1000)));
}

/** A display-only projection. Never simulate online actions or invent an opponent hand. */
export function onlineBattleProjection(room: OnlineRoomView, mappedCards = new WeakMap<PublicCard, CardInstance>()): { match: Match; presentation: Omit<OnlineBattlePresentation, 'status' | 'clockRunning' | 'yourTurn'> } {
  const rival = otherSeat(room.seat);
  const owner = (seat: Seat) => seat === room.seat ? 'player' as const : 'cpu' as const;
  const card = (c: PublicCard): CardInstance => {
    const existing = mappedCards.get(c);
    if (existing) return existing;
    const projected = { ...asCard(c as OnlinePublicCard), owner: owner(c.owner),
      ...(c.smileBomb ? { smileBomb: { ...c.smileBomb, sourceOwner: owner(c.smileBomb.sourceOwner) } } : {}) };
    mappedCards.set(c, projected);
    return projected;
  };
  const scores = room.scores.map(score => ({ ...score, player: score[room.seat], cpu: score[rival],
    winner: score.winner === 'draw' ? 'draw' as const : owner(score.winner) }));
  const match: Match = {
    afterParty: room.roundLimit === 7,
    diceResult: room.diceResult ? { ...room.diceResult, player: room.diceResult[room.seat], cpu: room.diceResult[rival], winner: room.diceResult.winner === "draw" ? "draw" : owner(room.diceResult.winner) } : undefined,
    round: room.round, phase: room.status === 'complete' ? 'complete' : room.activeSeat === room.seat ? 'player' : 'cpu-reveal',
    playerDeck: room.ownDeck.id, cpuDeck: 'online-rival', playerCardIds: room.ownDeck.cards, cpuCardIds: [],
    playerHand: room.hand.map(card), cpuHand: [], boards: room.boards.map(lane => lane.map(card)) as Match['boards'],
    playerMotion: room.motion[room.seat], cpuMotion: room.motion[rival], playerDrawIndex: 0, cpuDrawIndex: 0,
    squabbleUsed: room.squabble[room.seat], squabbleByOwner: { player: room.squabble[room.seat], cpu: room.squabble[rival] },
    plugDiscountLane: { player: null, cpu: null }, cheapBuffsUsed: { player: 0, cpu: 0 },
    effectLog: [], nextEventSequence: (room.events.at(-1)?.sequence ?? 0) + 1,
    timedEffects: [], discountTokens: [], nextDiscountOrder: 1,
    landlordTaxUsed: { player: { 0: false, 1: false, 2: false }, cpu: { 0: false, 1: false, 2: false } },
    sneakerTriggered: { player: false, cpu: false }, lastRevealedCardId: null,
    abilityUpgradeSnapshot: { version: 1, player: [], cpu: [] },
  };
  return { match, presentation: {
    playerMats: room.kumite ? undefined : { player: room.members[room.seat]?.playerMatId ?? DEFAULT_PLAYER_MAT_ID, rival: room.members[rival]?.playerMatId ?? DEFAULT_PLAYER_MAT_ID },
    squabbledIds: new Set([...room.boards.flat().filter(card => card.squabbled).map(card => card.instanceId),
      ...room.events.filter(event => event.type === 'play' && event.note.includes('SQUABBLE') && event.sourceId).map(event => event.sourceId!)]),
    districts: room.districts, scores, costs: Object.fromEntries(room.hand.map(c => [c.instanceId, c.costs])),
    districtMarks: room.districtMarks?.map(mark => ({ ...mark, owner: owner(mark.owner) })),
    covered: new Set(room.boards.flat().filter(c => c.covered).map(c => c.instanceId)), lockedLanes: room.lockedLanes ?? [],
    history: room.events.map(event => ({ ...event, owner: owner(event.owner), cardId: event.cardId ?? '', round: event.round ?? room.round })),
    turnSeconds: TURN_SECONDS, rivalHandCount: room.rivalHandCount,
    playerIdentity: room.members[room.seat] ?? undefined,
    rivalIdentity: room.members[rival] ?? undefined,
    mode: room.kumite ? 'Kumite' : room.ranked ? room.ranked.opponent === 'bot' ? 'Park bot' : 'Ranked' : 'Friend fade',
  } };
}

/** One cache per mounted battle, with no revision-only freshness assumption. */
export function createOnlineBattleProjector() {
  type Input = Omit<OnlineRoomView, 'serverTime' | 'deadline'>;
  let previous: Input | undefined;
  let projection: ReturnType<typeof onlineBattleProjection> | undefined;
  let mappedCards = new WeakMap<PublicCard, CardInstance>();
  return (room: OnlineRoomView) => {
    // The clock consumes these directly below. Every other authoritative field,
    // including same-revision corrections and private hand costs, stays observed.
    const { serverTime, deadline, ...incoming } = room;
    const sameGame = previous?.code === room.code && previous.gameNumber === room.gameNumber && previous.seat === room.seat;
    if (!sameGame) mappedCards = new WeakMap();
    // Query data normally already shares unchanged JSON. Also retain identities
    // after an equivalent reconnect payload instead of repainting every card.
    const input = replaceEqualDeep(sameGame ? previous : undefined, incoming);
    if (input === previous && projection) return projection;
    previous = input;
    projection = onlineBattleProjection({ ...input, serverTime, deadline }, mappedCards);
    return projection;
  };
}

type Props = { room: OnlineRoomView; busy: boolean; connected: boolean; reducedMotion: boolean;
  send: (command: OnlineCommand) => Promise<boolean> | void; onLeave: () => void };
export function MultiplayerBattle({ room, busy, connected, reducedMotion: profileReducedMotion, send, onLeave }: Props) {
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = profileReducedMotion || Boolean(systemReducedMotion);
  const arrivalKey = 'squabblemon_match_arrival:' + room.code + ':' + room.gameNumber;
  const [arrival, setArrival] = useState(() => {
    if (room.status !== 'active' || room.round !== 1 || room.events.length > 0) return false;
    try { return sessionStorage.getItem(arrivalKey) !== 'seen'; } catch { return true; }
  });
  // Share the once-per-game arrival boundary, but play the dust after the
  // versus poster clears so the full animation is visible over the arena.
  const [battleStartEffectVisible, setBattleStartEffectVisible] = useState(arrival && !reducedMotion);
  useEffect(() => {
    if (!arrival) return;
    try { sessionStorage.setItem(arrivalKey, 'seen'); } catch { /* Storage is optional. */ }
    const timer = setTimeout(() => setArrival(false), reducedMotion ? 600 : 2600);
    return () => clearTimeout(timer);
  }, [arrival, arrivalKey, reducedMotion]);
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [inspect, setInspect] = useState<CardInstance | null>(null);
  const [rules, setRules] = useState(false);
  const [surrender, setSurrender] = useState(false);
  const [surrenderFailed, setSurrenderFailed] = useState(false);
  const [submittingSurrender, setSubmittingSurrender] = useState(false);
  const surrenderLock = useRef(false);
  const keepPlayingButton = useRef<HTMLButtonElement>(null);
  const roomIntentLock = useRef(false);
  const [exitBusy, setExitBusy] = useState(false);
  const [exitFailed, setExitFailed] = useState<RoomExitIntent | null>(null);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const [reviewBoard, setReviewBoard] = useState(false);
  const { celebrating, leaveResults } = useBattleResultExit();
  const clockOffset = useRef(room.serverTime - Date.now());
  const [remaining, setRemaining] = useState(() =>
    computeTurnSecondsRemaining(room.deadline, Date.now(), room.serverTime - Date.now()),
  );
  const [preferences, setPreferences] = useFeedbackPreferences();
  const feedback = useRef<BattleFeedback | null>(null);
  const seen = useRef(room.events.at(-1)?.sequence ?? 0);
  const sending = useRef(false);
  useEffect(() => {
    if (room.status !== 'active') return;
    const guard = (proceed: () => void) => {
      pendingNavigation.current = proceed;
      setArrival(false);
      setSurrender(true);
    };
    const clear = setDeckExitGuard(guard);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      clear();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [room.status]);
  useEffect(() => {
    if (room.status === 'complete') {
      setSurrender(false);
      pendingNavigation.current = null;
    }
  }, [room.status]);
  useEffect(() => {
    if (room.status === 'active') setBattleMusicMode(null);
  }, [room.status, room.code, room.gameNumber]);
  useEffect(() => { feedback.current = new BattleFeedback(preferences); return () => feedback.current?.reset(); }, []);
  useEffect(() => { feedback.current?.setPreferences(preferences); }, [preferences]);
  useEffect(() => {
    clockOffset.current = room.serverTime - Date.now();
    setRemaining(computeTurnSecondsRemaining(room.deadline, Date.now(), clockOffset.current));
  }, [room.serverTime, room.deadline, room.status]);
  useEffect(() => {
    if (room.status !== 'active' || room.deadline == null) return;
    const timer = setInterval(() => {
      setRemaining(prev => {
        const next = computeTurnSecondsRemaining(room.deadline, Date.now(), clockOffset.current);
        return prev === next ? prev : next;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [room.status, room.deadline]);
  useEffect(() => {
    const event = room.events.filter(e => e.sequence > seen.current).find(e => e.type === 'play' || e.type === 'ability');
    seen.current = room.events.at(-1)?.sequence ?? seen.current;
    if (event && !document.hidden) feedback.current?.cue(event.note.includes('SQUABBLE') ? 'squabble' : event.type === 'play' ? 'play' : event.kind === 'move' ? 'move' : 'status', reducedMotion);
  }, [room.events, reducedMotion]);
  const rivalSeat = otherSeat(room.seat), rival = room.members[rivalSeat]!;
  const myTurn = room.status === 'active' && room.activeSeat === room.seat;
  useTurnClockCues(remaining, myTurn, room.deadline, room.status === 'active' && connected);
  const interactive = myTurn && connected && !busy && !arrival && remaining > 0;
  useEffect(() => { if (!myTurn || (selected && !room.hand.some(c => c.instanceId === selected))) {
    setSelected(null); setLane(null); setSquabble(false);
  } }, [myTurn, room.hand, selected]);
  const projectRoom = useMemo(createOnlineBattleProjector, []);
  const projected = useMemo(() => projectRoom(room), [projectRoom, room]);
  const { effect: liveEffect, presenting: presentingEffects, pendingEffects, playedSpecialMoves } = useOnlineEffectPresenter(room, projected.presentation.scores, Boolean(reducedMotion) || (room.status !== 'active' && room.status !== 'complete'));
  const remembered = useRef({ key: `${room.code}:${room.gameNumber}`, cards: new Map<string, CardInstance>() });
  const matchKey = `${room.code}:${room.gameNumber}`;
  const visualMatch = useMemo(() => ({ ...projected.match, boards: onlinePresentationBoards(projected.match.boards, pendingEffects,
    remembered.current.key === matchKey ? remembered.current.cards : new Map()) }), [projected.match, pendingEffects, matchKey]);
  useLayoutEffect(() => {
    if (remembered.current.key !== matchKey) remembered.current = { key: matchKey, cards: new Map() };
    for (const card of projected.match.boards.flat()) remembered.current.cards.set(card.instanceId, card);
  }, [projected.match.boards, matchKey]);
  const status = room.status === 'complete' ? 'Fade complete' : !connected ? 'Reconnecting…' : busy ? 'Sending play…' : remaining === 0 ? 'Checking result…' : myTurn ? 'Your turn' : `${rival.name}'s turn`;
  async function act(command: OnlineCommand) {
    if (sending.current || busy || !connected) return;
    sending.current = true;
    feedback.current?.unlockAudio();
    try { if ((await send(command)) !== false) { setSelected(null); setLane(null); setSquabble(false); } }
    finally { sending.current = false; }
  }
  const openExit = () => {
    setArrival(false);
    setSurrenderFailed(false);
    setSurrender(true);
  };
  const keepPlaying = () => {
    pendingNavigation.current = null;
    setSurrender(false);
    setSurrenderFailed(false);
  };
  const returnToHub = () => {
    pendingNavigation.current = null;
    setSurrender(false);
    runWithoutDeckExitGuard(onLeave);
  };
  const confirmSurrender = async () => {
    if (surrenderLock.current || busy || !connected || room.status !== 'active') return;
    surrenderLock.current = true;
    setSubmittingSurrender(true);
    setSurrenderFailed(false);
    try {
      if ((await send({ type: 'surrender' })) === false) setSurrenderFailed(true);
      else {
        pendingNavigation.current = null;
        setSurrender(false);
      }
    } catch {
      setSurrenderFailed(true);
    } finally {
      surrenderLock.current = false;
      setSubmittingSurrender(false);
    }
  };
  /**
   * Every exit from a finished friendly room goes through here. Returning to the
   * lobby keeps the room open; closing it must be confirmed by the server before
   * navigating, or the rival would be left waiting in a room nobody is in.
   */
  async function roomIntent(intent: RoomExitIntent) {
    if (roomIntentLock.current) return;
    roomIntentLock.current = true;
    setExitBusy(true);
    setExitFailed(null);
    try {
      const outcome = await resolveRoomExit(intent, { ranked: Boolean(room.ranked), send });
      setExitFailed(outcome.failed);
      if (outcome.navigate) runWithoutDeckExitGuard(onLeave);
    } finally {
      roomIntentLock.current = false;
      setExitBusy(false);
    }
  }
  /** Back to the room lobby: the room stays open for the next fade. */
  const backToRoom = () => leaveResults(() => { setReviewBoard(false); void roomIntent('lobby'); });
  /** Closing the room on purpose: only leave once the server confirms it closed. */
  const closeRoom = () => leaveResults(() => { void roomIntent('leave'); });
  const exitResults = () => room.kumite || room.ranked ? leaveResults(onLeave) : backToRoom();
  const rank = room.ranked?.result;
  const resultCopy = onlineResultCopy(room);
  const latest = room.events.at(-1);
  return <main className="h-[100dvh] bg-black text-white font-sans flex flex-col relative overflow-hidden game-bg" style={room.kumite ? { '--kumite-platform': `url("${getAssetUrl('assets/kumite/layers/platform.webp')}")` } as CSSProperties : undefined} data-kumite={Boolean(room.kumite)} data-testid="online-battle" data-turn={myTurn ? 'you' : 'rival'} data-round={room.round} data-revision={room.revision} data-status={room.status} data-connected={connected}>
    {room.kumite && <KumiteArena reducedMotion={Boolean(reducedMotion)} platform={false} className="kumite-arena-scene--battle" />}
    {!surrender && arrival && room.status === 'active' && <button type="button" className="pvp-exit-control" data-testid="pvp-exit" onClick={openExit}>Leave battle</button>}
    <AnimatePresence>{arrival && <MatchArrival player={room.members[room.seat]!} rival={rival} label={room.ranked?.opponent === 'bot' ? 'Park Bot found · ranked sparring' : 'Your fade is ready'} onContinue={() => setArrival(false)} />}</AnimatePresence>
    {battleStartEffectVisible && !arrival && room.status === 'active' && !reducedMotion && (
      <BattleStartSmoke onComplete={() => setBattleStartEffectVisible(false)} />
    )}
    {!arrival && <BattleReactions key={`${room.code}:${room.gameNumber}`} room={room} connected={connected} reducedMotion={reducedMotion} />}
    <LayoutGroup><Battle match={visualMatch} playedSpecialMoves={playedSpecialMoves} deck={room.ownDeck} rivalDeck={{ id: 'online-rival', name: rival.name, hero: rival.hero, cards: [] }}
      online={{ ...projected.presentation, status, yourTurn: myTurn, clockRunning: room.status === 'active' && connected, announcementsReady: !arrival && connected }}
      selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
      squabble={squabble} setSquabble={setSquabble} setInspect={setInspect}
      commit={() => selected && lane !== null && void act({ type: 'play', instanceId: selected, lane, squabble })}
      onPlayCard={(instanceId: string, target: Lane, armed: boolean, investment = 0) => void act({ type: 'play', instanceId, lane: target, squabble: armed, investment })}
      endTurn={() => void act({ type: 'end-turn' })}
      presentationPhase={interactive ? 'player-ready' : 'rival-thinking'}
      phaseMessage={`${status}${latest && !myTurn ? ' · ' + latest.note : ''}`}
      activeEffect={liveEffect} activeEffectId={liveEffect?.cardInstanceId ?? null} activeEffectLane={liveEffect?.lane ?? null}
      presentationScores={projected.presentation.scores} timerSeconds={remaining} timerEnabled={room.status === 'active'}
      feedbackPreferences={preferences} setFeedbackPreferences={setPreferences}
      onFeedback={(cue: 'select' | 'lock') => { feedback.current?.unlockAudio(); feedback.current?.cue(cue, reducedMotion); }}
      onShowRules={() => setRules(true)} onExit={() => room.status === 'complete' ? exitResults() : openExit()} />
    </LayoutGroup>
    <AnimatePresence>{inspect && <CardInspector card={projected.match.boards.flat().find(c => c.instanceId === inspect.instanceId) ?? inspect} onClose={() => setInspect(null)} />}{rules && <RulesModal onClose={() => setRules(false)} />}</AnimatePresence>
    {room.status === 'complete' && reviewBoard && (typeof document === 'undefined' ? null : createPortal(<button className="park-result-return" onClick={() => setReviewBoard(false)}>View result</button>, document.body))}
    <Dialog open={room.status === 'complete' && !reviewBoard && !celebrating && !presentingEffects} onOpenChange={open => { if (!open) setReviewBoard(true); }}>
      {room.kumite ? <KumiteResult outcome={room.winner === 'draw' ? 'draw' : room.winner === room.seat ? 'win' : 'loss'} ranked={false} reducedMotion={reducedMotion}
        hero={room.ownDeck.hero} playerName={room.members[room.seat]!.name} final={room.kumite.matchId === 'r3-m1'}
        claimed={room.scores.filter(s => s.winner === room.seat).length} rivalClaimed={room.scores.filter(s => s.winner === rivalSeat).length}
        description={resultCopy.description} timeoutResult={room.reason === 'timeout'}>
        <button className="online-primary" onClick={() => leaveResults(onLeave)}>Back to Kumite</button>
        <button className="online-secondary" onClick={() => setReviewBoard(true)}>Inspect final board</button>
      </KumiteResult> : <ParkResult outcome={room.winner === 'draw' ? 'draw' : room.winner === room.seat ? 'win' : 'loss'} ranked={Boolean(room.ranked)} rank={rank ?? undefined} resultKey={`${room.code}:${room.gameNumber}:${room.seat}`} reducedMotion={reducedMotion}
        title={resultCopy.title} subtitle={resultCopy.subtitle} boardNote={resultCopy.boardNote}
        claimed={room.scores.filter(s => s.winner === room.seat).length} rivalClaimed={room.scores.filter(s => s.winner === rivalSeat).length}
         series={room.ranked ? undefined : <><PersonalFadeRecord room={room.code} rival={rival.name} /><FadeSeriesBoard variant="result" reducedMotion={reducedMotion} gameNumber={room.gameNumber} rivalName={rival.name}
           series={{ you: room.series[room.seat], rival: room.series[rivalSeat], draws: room.series.draws }} /></>}
         description={resultCopy.description}
         opponent={room.ranked?.opponent !== 'bot' ? <PostMatchHomie key={`${room.code}:${room.gameNumber}`} code={room.code} /> : undefined}>
        {!room.ranked && <button className="online-primary" data-testid="button-back-to-room" disabled={exitBusy} onClick={backToRoom}>{exitBusy ? 'Opening the room…' : 'Back to the room'}</button>}
        <button className="online-primary" data-testid="button-leave-room" disabled={exitBusy} onClick={closeRoom}>{room.ranked ? 'Back to Fade Park' : exitBusy ? 'Closing the room…' : 'Leave this room'}</button>
        <button className="online-secondary" onClick={() => setReviewBoard(true)}>Inspect final board</button>
        {exitFailed && <p className="online-exit-error" role="alert" data-testid="room-exit-error">
          {exitFailed === 'leave' ? 'The room could not be closed, so The Opps may still be waiting in it.' : 'The room could not be reopened.'}{' '}
          <button className="online-secondary" data-testid="button-retry-exit" disabled={exitBusy}
            onClick={() => void roomIntent(exitFailed)}>Try again</button>
        </p>}
      </ParkResult>}
    </Dialog>
    <Dialog open={surrender && room.status === 'active'} onOpenChange={open => { if (!open && !submittingSurrender) keepPlaying(); }}>
      <DialogContent className="game-popup reward-street-file game-popup--brick pvp-exit-dialog bg-transparent" data-popup-family="confirmation" data-popup-material="brick" data-popup-tone="destructive"
        style={{ '--popup-brick-wall': `url("${getAssetUrl('assets/progression/brick-ui-v1.webp')}")` } as CSSProperties}
        onOpenAutoFocus={event => { event.preventDefault(); keepPlayingButton.current?.focus(); }}>
        <RewardFilePaper className="pvp-exit-dialog__paper">
          <GamePopupLabel>Before you go</GamePopupLabel>
          <DialogTitle asChild><GamePopupTitle>Leave this fade?</GamePopupTitle></DialogTitle>
          <DialogDescription asChild><GamePopupCopy>Surrendering gives The Opps the win{room.ranked ? ' and records a ranked loss' : ''}. Closing the app or leaving does not pause the server turn clock.</GamePopupCopy></DialogDescription>
          {(!connected || surrenderFailed) && <GamePopupCopy role="alert" className="pvp-exit-dialog__warning">{surrenderFailed ? 'Surrender could not be confirmed.' : 'Connection lost.'} You can return to {room.kumite ? 'Kumite' : room.ranked ? 'Fade Park' : 'friend fades'} without confirming a surrender. The server clock keeps running{room.ranked ? ' and a ranked loss is still possible' : ''}.</GamePopupCopy>}
          <RewardFileAction disabled={busy || !connected || submittingSurrender} onClick={() => void confirmSurrender()}>{submittingSurrender ? 'Surrendering…' : 'Surrender'}</RewardFileAction>
          <GamePopupSecondary ref={keepPlayingButton} disabled={submittingSurrender} onClick={keepPlaying}>Keep playing</GamePopupSecondary>
          {(!connected || surrenderFailed) && <GamePopupSecondary disabled={submittingSurrender} onClick={returnToHub}>Return to {room.kumite ? 'Kumite' : room.ranked ? 'Fade Park' : 'friend fades'} without surrender confirmation</GamePopupSecondary>}
        </RewardFilePaper>
      </DialogContent>
    </Dialog>
  </main>;
}
