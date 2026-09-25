import { MatchArrival } from './MatchArrival';
import { ParkResult } from './ParkResult';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutGroup, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cards, type Card } from '../data';
import { SUMMON_TEMPLATES, type CardInstance, type Lane, type Match } from '../gameEngine';
import { otherSeat, TURN_SECONDS, type OnlineCommand, type OnlineRoomView, type PublicCard, type Seat } from '@workspace/squabblemon-engine/multiplayer';
import { Battle, type OnlineBattlePresentation } from './Battle';
import { BattleStartSmoke } from './BattleStartSmoke';
import { CardInspector } from './CardInspector';
import { RulesModal } from './RulesModal';
import { BattleFeedback } from '../battleFeedback';
import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { setBattleMusicMode } from '../musicStore';

type BuddyPublicState = Pick<CardInstance, 'buddyForm' | 'buddyGrowthAtRound' | 'buddyEarthExpiresAtRound' | 'buddyBud'>;
type OnlinePublicCard = PublicCard & Partial<BuddyPublicState>;

const buddyBudDefinition: Card = {
  id: 'buddy-bud', name: 'Buddy Bud', type: 'Plant', cost: 0, power: 0,
  ability: 'Buddy Bud', effect: 'Gives +3 Hands to the last eligible friendly card summoned in this district when it sprouts.',
  abilityUpgrades: [], kind: 'token', hazard: true,
};
const definition = (id: string): Card => {
  if (id === 'buddy-bud') return buddyBudDefinition;
  const card = cards[id] ?? SUMMON_TEMPLATES[id as keyof typeof SUMMON_TEMPLATES];
  if (!card) throw new Error(`Unknown public multiplayer card: ${id}`);
  return card;
};
export const asCard = (card: OnlinePublicCard): CardInstance => {
  const base = definition(card.cardId);
  return {
    ...base, ...card, ...card.form, id: card.artworkId ?? base.id,
    hazard: card.hazard ? true : undefined,
    deck: 'online', playedRound: null, lastEffectNote: '',
  };
};

/** A display-only projection. Never simulate online actions or invent an opponent hand. */
export function onlineBattleProjection(room: OnlineRoomView): { match: Match; presentation: Omit<OnlineBattlePresentation, 'status' | 'clockRunning' | 'yourTurn'> } {
  const rival = otherSeat(room.seat);
  const owner = (seat: Seat) => seat === room.seat ? 'player' as const : 'cpu' as const;
  const card = (c: PublicCard): CardInstance => ({ ...asCard(c as OnlinePublicCard), owner: owner(c.owner),
    ...(c.smileBomb ? { smileBomb: { ...c.smileBomb, sourceOwner: owner(c.smileBomb.sourceOwner) } } : {}) });
  const scores = room.scores.map(score => ({ ...score, player: score[room.seat], cpu: score[rival],
    winner: score.winner === 'draw' ? 'draw' as const : owner(score.winner) }));
  const match: Match = {
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
    districts: room.districts, scores, costs: Object.fromEntries(room.hand.map(c => [c.instanceId, c.costs])),
    districtMarks: room.districtMarks?.map(mark => ({ ...mark, owner: owner(mark.owner) })),
    covered: new Set(room.boards.flat().filter(c => c.covered).map(c => c.instanceId)), lockedLanes: room.lockedLanes ?? [],
    history: room.events.map(event => ({ ...event, owner: owner(event.owner), cardId: event.cardId ?? '', round: event.round ?? room.round })),
    turnSeconds: TURN_SECONDS, rivalHandCount: room.rivalHandCount,
    mode: room.ranked ? room.ranked.opponent === 'bot' ? 'Park bot' : 'Ranked' : 'Friend fade',
  } };
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
  const [reviewBoard, setReviewBoard] = useState(false);
  const [now, setNow] = useState(Date.now);
  const clockOffset = useRef(room.serverTime - Date.now());
  const [preferences, setPreferences] = useFeedbackPreferences();
  const feedback = useRef<BattleFeedback | null>(null);
  const seen = useRef(room.events.at(-1)?.sequence ?? 0);
  const sending = useRef(false);
  useEffect(() => {
    if (room.status === 'active') setBattleMusicMode(null);
  }, [room.status, room.code, room.gameNumber]);
  useEffect(() => { feedback.current = new BattleFeedback(preferences); return () => feedback.current?.reset(); }, []);
  useEffect(() => { feedback.current?.setPreferences(preferences); }, [preferences]);
  useEffect(() => { clockOffset.current = room.serverTime - Date.now(); }, [room.serverTime]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const event = room.events.filter(e => e.sequence > seen.current).find(e => e.type === 'play' || e.type === 'ability');
    seen.current = room.events.at(-1)?.sequence ?? seen.current;
    if (event && !document.hidden) feedback.current?.cue(event.note.includes('SQUABBLE') ? 'squabble' : event.type === 'play' ? 'play' : event.kind === 'move' ? 'move' : 'status', reducedMotion);
  }, [room.events, reducedMotion]);
  const rivalSeat = otherSeat(room.seat), rival = room.members[rivalSeat]!;
  const remaining = Math.max(0, Math.min(TURN_SECONDS, Math.ceil(((room.deadline ?? now) - now - clockOffset.current) / 1000)));
  const myTurn = room.status === 'active' && room.activeSeat === room.seat;
  const interactive = myTurn && connected && !busy && !arrival && remaining > 0;
  useEffect(() => { if (!myTurn || (selected && !room.hand.some(c => c.instanceId === selected))) {
    setSelected(null); setLane(null); setSquabble(false);
  } }, [myTurn, room.hand, selected]);
  const projected = useMemo(() => onlineBattleProjection(room), [room]);
  const status = room.status === 'complete' ? 'Fade complete' : !connected ? 'Reconnecting…' : busy ? 'Sending play…' : remaining === 0 ? 'Checking result…' : myTurn ? 'Your turn' : `${rival.name}'s turn`;
  async function act(command: OnlineCommand) {
    if (sending.current || busy || !connected) return;
    sending.current = true;
    feedback.current?.unlockAudio();
    try { if ((await send(command)) !== false) { setSelected(null); setLane(null); setSquabble(false); } }
    finally { sending.current = false; }
  }
  const rank = room.ranked?.result;
  const latest = room.events.at(-1);
  return <main className="h-[100dvh] bg-black text-white font-sans flex flex-col relative overflow-hidden game-bg" data-testid="online-battle" data-turn={myTurn ? 'you' : 'rival'} data-round={room.round} data-revision={room.revision} data-status={room.status} data-connected={connected}>
    <AnimatePresence>{arrival && <MatchArrival player={room.members[room.seat]!} rival={rival} label={room.ranked?.opponent === 'bot' ? 'Park Bot found · ranked sparring' : 'Your fade is ready'} onContinue={() => setArrival(false)} />}</AnimatePresence>
    {battleStartEffectVisible && !arrival && room.status === 'active' && !reducedMotion && (
      <BattleStartSmoke onComplete={() => setBattleStartEffectVisible(false)} />
    )}
    <LayoutGroup><Battle match={projected.match} deck={room.ownDeck} rivalDeck={{ id: 'online-rival', name: rival.name, hero: rival.hero, cards: [] }}
      online={{ ...projected.presentation, status, yourTurn: myTurn, clockRunning: room.status === 'active' && connected, announcementsReady: !arrival && connected }}
      selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
      squabble={squabble} setSquabble={setSquabble} setInspect={setInspect}
      commit={() => selected && lane !== null && void act({ type: 'play', instanceId: selected, lane, squabble })}
      onPlayCard={(instanceId: string, target: Lane, armed: boolean, investment = 0) => void act({ type: 'play', instanceId, lane: target, squabble: armed, investment })}
      endTurn={() => void act({ type: 'end-turn' })}
      presentationPhase={interactive ? 'player-ready' : 'rival-thinking'}
      phaseMessage={`${status}${latest && !myTurn ? ' · ' + latest.note : ''}`}
      presentationScores={projected.presentation.scores} timerSeconds={remaining} timerEnabled={room.status === 'active'}
      feedbackPreferences={preferences} setFeedbackPreferences={setPreferences}
      onFeedback={(cue: 'select' | 'lock') => { feedback.current?.unlockAudio(); feedback.current?.cue(cue, reducedMotion); }}
      onShowRules={() => setRules(true)} onExit={() => room.status === 'complete' ? onLeave() : setSurrender(true)} />
    </LayoutGroup>
    <AnimatePresence>{inspect && <CardInspector card={projected.match.boards.flat().find(c => c.instanceId === inspect.instanceId) ?? inspect} onClose={() => setInspect(null)} />}{rules && <RulesModal onClose={() => setRules(false)} />}</AnimatePresence>
    {room.status === 'complete' && reviewBoard && (typeof document === 'undefined' ? null : createPortal(<button className="park-result-return" onClick={() => setReviewBoard(false)}>View result</button>, document.body))}
    <Dialog open={room.status === 'complete' && !reviewBoard} onOpenChange={open => { if (!open) setReviewBoard(true); }}>
      <ParkResult outcome={room.winner === 'draw' ? 'draw' : room.winner === room.seat ? 'win' : 'loss'} ranked={Boolean(room.ranked)} rank={rank ?? undefined} reducedMotion={reducedMotion}
        claimed={room.scores.filter(s => s.winner === room.seat).length} rivalClaimed={room.scores.filter(s => s.winner === rivalSeat).length}
        description={room.reason === 'timeout'
          ? room.winner === room.seat
            ? "Your rival's turn clock expired. You win by forfeit."
            : 'Your turn clock expired. You forfeited the fade.'
          : room.reason === 'surrender' ? 'The fade ended by surrender.' : 'Six rounds. Three districts.'}
        timeoutResult={room.reason === 'timeout'}>
        {!room.ranked && <button className="online-primary" disabled={busy || !connected || room.rematch[room.seat]} onClick={() => void act({ type: 'rematch' })}>{room.rematch[room.seat] ? 'Rematch requested…' : room.rematch[rivalSeat] ? 'Accept rematch' : 'Ask for a rematch'}</button>}
        <button className="online-primary" onClick={onLeave}>{room.ranked ? 'Back to Fade Park' : 'Back to friend fades'}</button>
        <button className="online-secondary" onClick={() => setReviewBoard(true)}>Inspect final board</button>
      </ParkResult>
    </Dialog>
    <Dialog open={surrender} onOpenChange={setSurrender}><DialogContent className="street-dialog"><DialogTitle>Leave this fade?</DialogTitle><DialogDescription>Surrendering gives your rival the win{room.ranked ? ' and records a ranked loss' : ''}. Closing the app does not pause the turn clock.</DialogDescription><button className="online-primary" disabled={busy || !connected} onClick={() => { setSurrender(false); void act({ type: 'surrender' }); }}>Surrender</button><button className="online-secondary" onClick={() => setSurrender(false)}>Keep playing</button></DialogContent></Dialog>
  </main>;
}
