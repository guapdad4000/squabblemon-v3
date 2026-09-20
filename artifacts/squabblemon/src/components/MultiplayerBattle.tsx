import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cards, getCardImage } from '../data';
import { SUMMON_TEMPLATES, type CardInstance, type Lane, type Match } from '../gameEngine';
import { otherSeat, TURN_SECONDS, type OnlineCommand, type OnlineRoomView, type PublicCard, type Seat } from '@workspace/squabblemon-engine/multiplayer';
import { Battle, type OnlineBattlePresentation } from './Battle';
import { CardInspector } from './CardInspector';
import { RulesModal } from './RulesModal';
import { BattleFeedback } from '../battleFeedback';
import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

const definition = (id: string) => cards[id] ?? SUMMON_TEMPLATES[id as keyof typeof SUMMON_TEMPLATES];
export const asCard = (card: PublicCard): CardInstance => ({
  ...definition(card.cardId), ...card, id: card.artworkId ?? definition(card.cardId).id,
  deck: 'online', playedRound: null, lastEffectNote: '',
});

/** A display-only projection. Never simulate online actions or invent an opponent hand. */
export function onlineBattleProjection(room: OnlineRoomView): { match: Match; presentation: Omit<OnlineBattlePresentation, 'status' | 'clockRunning' | 'yourTurn'> } {
  const rival = otherSeat(room.seat);
  const owner = (seat: Seat) => seat === room.seat ? 'player' as const : 'cpu' as const;
  const card = (c: PublicCard): CardInstance => ({ ...asCard(c), owner: owner(c.owner),
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
  useEffect(() => {
    if (!arrival) return;
    try { sessionStorage.setItem(arrivalKey, 'seen'); } catch { /* Storage is optional. */ }
    const timer = setTimeout(() => setArrival(false), reducedMotion ? 350 : 1200);
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
  const result = room.winner === 'draw' ? 'Draw. Run it back.' : room.winner === room.seat ? 'You own the park.' : 'Next fade is yours.';
  const rank = room.ranked?.result;
  const latest = room.events.at(-1);
  return <main className="h-[100dvh] bg-black text-white font-sans flex flex-col relative overflow-hidden game-bg" data-testid="online-battle" data-turn={myTurn ? 'you' : 'rival'} data-round={room.round} data-revision={room.revision} data-status={room.status} data-connected={connected}>
    {arrival && <div className="park-arrival" role="status" data-testid="match-arrival"><span className="park-eyebrow">{room.ranked ? 'Fade Park · match found' : 'Friend fade · ready'}</span><div><section><img src={getCardImage(room.members[room.seat]!.hero)} alt="" /><strong>{room.members[room.seat]!.name}</strong></section><b>VS</b><section><img src={getCardImage(rival.hero)} alt="" /><strong>{rival.name}</strong></section></div><p>{room.ranked?.opponent === 'bot' ? 'Park Bot · ranked sparring' : 'Live 1v1'} · Three districts. One fade.</p></div>}
    <LayoutGroup><Battle match={projected.match} deck={room.ownDeck} rivalDeck={{ id: 'online-rival', name: rival.name, hero: rival.hero, cards: [] }}
      online={{ ...projected.presentation, status, yourTurn: myTurn, clockRunning: room.status === 'active' && connected }}
      selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={lane} setSelectedLane={setLane}
      squabble={squabble} setSquabble={setSquabble} setInspect={setInspect}
      commit={() => selected && lane !== null && void act({ type: 'play', instanceId: selected, lane, squabble })}
      onPlayCard={(instanceId: string, target: Lane, armed: boolean) => void act({ type: 'play', instanceId, lane: target, squabble: armed })}
      endTurn={() => void act({ type: 'end-turn' })}
      presentationPhase={interactive ? 'player-ready' : 'rival-thinking'}
      phaseMessage={`${status}${latest && !myTurn ? ' · ' + latest.note : ''}`}
      presentationScores={projected.presentation.scores} timerSeconds={remaining} timerEnabled={room.status === 'active'}
      feedbackPreferences={preferences} setFeedbackPreferences={setPreferences}
      onFeedback={(cue: 'select' | 'lock') => { feedback.current?.unlockAudio(); feedback.current?.cue(cue, reducedMotion); }}
      onShowRules={() => setRules(true)} onExit={() => room.status === 'complete' ? onLeave() : setSurrender(true)} />
    </LayoutGroup>
    <AnimatePresence>{inspect && <CardInspector card={projected.match.boards.flat().find(c => c.instanceId === inspect.instanceId) ?? inspect} onClose={() => setInspect(null)} />}{rules && <RulesModal onClose={() => setRules(false)} />}</AnimatePresence>
    {room.status === 'complete' && reviewBoard && <button className="park-result-return" onClick={() => setReviewBoard(false)}>View result</button>}
    <Dialog open={room.status === 'complete' && !reviewBoard} onOpenChange={open => { if (!open) setReviewBoard(true); }}>
      <DialogContent className="park-result" aria-describedby="park-result-description">
        <span className="park-eyebrow">{room.ranked ? 'Fade Park · ranked result' : 'Friend fade · result'}</span>
        <DialogTitle className="park-result-title">{room.ranked ? result : room.winner === room.seat ? 'You won the fade.' : room.winner === 'draw' ? 'Draw. Run it back.' : `${rival.name} wins.`}</DialogTitle>
        <div className="park-result-portraits" aria-hidden="true"><img src={getCardImage(room.members[room.seat]!.hero)} alt="" /><b>VS</b><img src={getCardImage(rival.hero)} alt="" /></div>
        <DialogDescription id="park-result-description">{room.reason === 'timeout' ? 'The turn clock expired.' : room.reason === 'surrender' ? 'The fade ended by surrender.' : 'Six rounds. Three districts.'} You claimed {room.scores.filter(s => s.winner === room.seat).length}; your rival claimed {room.scores.filter(s => s.winner === rivalSeat).length}.</DialogDescription>
        {rank && <div className="park-result-rank" data-testid="ranked-result"><strong>{rank.delta >= 0 ? '+' : ''}{rank.delta} RP</strong><span>{rank.tier} · {rank.after} RP{rank.bot ? ' · Park bot' : ''}</span></div>}
        {!room.ranked && <button className="online-primary" disabled={busy || !connected || room.rematch[room.seat]} onClick={() => void act({ type: 'rematch' })}>{room.rematch[room.seat] ? 'Rematch requested…' : room.rematch[rivalSeat] ? 'Accept rematch' : 'Ask for a rematch'}</button>}
        <button className="online-primary" onClick={onLeave}>{room.ranked ? 'Back to Fade Park' : 'Back to friend fades'}</button>
        <button className="online-secondary" onClick={() => setReviewBoard(true)}>Inspect final board</button>
      </DialogContent>
    </Dialog>
    <Dialog open={surrender} onOpenChange={setSurrender}><DialogContent><DialogTitle>Leave this fade?</DialogTitle><DialogDescription>Surrendering gives your rival the win{room.ranked ? ' and records a ranked loss' : ''}. Closing the app does not pause the turn clock.</DialogDescription><button className="online-primary" disabled={busy || !connected} onClick={() => { setSurrender(false); void act({ type: 'surrender' }); }}>Surrender</button><button className="online-secondary" onClick={() => setSurrender(false)}>Keep playing</button></DialogContent></Dialog>
  </main>;
}
