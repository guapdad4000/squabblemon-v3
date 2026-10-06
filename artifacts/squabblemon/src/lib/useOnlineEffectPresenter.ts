import { useEffect, useRef, useState } from 'react';
import type { OnlineRoomView, PublicEvent, PublicParticipant, Seat } from '@workspace/squabblemon-engine/multiplayer';
import type { EventParticipant, Lane } from '../gameEngine';
import type { PresentationEffect } from '../components/PlayLoop';

/** PvP plays card effects at double speed (half the solo beat timing), silently. */
export const ONLINE_EFFECT_TIMING = { windupMs: 225, impactMs: 325 } as const;

export function toPresentationEffect(event: PublicEvent, seat: Seat, scores: PresentationEffect['scores']['before']): PresentationEffect | null {
  if (!event.sourceId || event.type === 'pass' || event.type === 'reveal' || event.kind === 'story') return null;
  const owner = (s: Seat) => s === seat ? 'player' as const : 'cpu' as const;
  const participant = (p: PublicParticipant): EventParticipant => {
    const state = (s: PublicParticipant['before']) => s ? { ...s, cardInstanceId: p.cardInstanceId, cardId: p.cardId, owner: owner(p.owner), lastEffectNote: '' } : null;
    return { cardInstanceId: p.cardInstanceId, cardId: p.cardId, owner: owner(p.owner), before: state(p.before), after: state(p.after), ...(p.departureCause ? { departureCause: p.departureCause } : {}) };
  };
  const all = (event.participants ?? []).map(participant);
  const source = all.find(p => p.cardInstanceId === event.sourceId) ?? null;
  const targets = all.filter(p => p !== source);
  const rival = seat === 'player' ? 'cpu' : 'player';
  const seatScores = (list: NonNullable<PublicEvent['scores']>['before']) => list.map(score => ({ lane: score.lane, player: score[seat], cpu: score[rival] }));
  const lane = (source?.after?.lane ?? source?.before?.lane ?? event.lane) as Lane;
  return {
    sequence: event.sequence, round: event.round, type: event.type, timing: 'instant', duration: null,
    source, targets, scores: event.scores ? { before: seatScores(event.scores.before), after: seatScores(event.scores.after) } : { before: scores, after: scores },
    resources: undefined as never, state: undefined as never, replay: undefined as never,
    cardInstanceId: event.sourceId, cardId: source?.cardId ?? event.cardId ?? '', owner: owner(event.owner), lane, kind: event.kind, note: event.note,
    targetIds: targets.map(t => t.cardInstanceId), impact: false,
  };
}

/** Replays newly arrived public events as board effects. Display only; never changes game state. */
export function useOnlineEffectPresenter(room: OnlineRoomView, scores: PresentationEffect['scores']['before'], disabled: boolean) {
  const [effect, setEffect] = useState<PresentationEffect | null>(null);
  const seen = useRef(room.events.at(-1)?.sequence ?? 0);
  const queue = useRef<PresentationEffect[]>([]);
  const running = useRef(false);
  const alive = useRef(true);
  const scoresRef = useRef(scores); scoresRef.current = scores;
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { queue.current = []; setEffect(null); seen.current = room.events.at(-1)?.sequence ?? 0; }, [room.code, room.gameNumber]);
  useEffect(() => {
    const fresh = room.events.filter(e => e.sequence > seen.current);
    seen.current = room.events.at(-1)?.sequence ?? seen.current;
    if (disabled || typeof document === 'undefined' || document.hidden) return;
    queue.current.push(...fresh.flatMap(e => toPresentationEffect(e, room.seat, scoresRef.current) ?? []));
    queue.current = queue.current.slice(-8);
    if (running.current) return;
    running.current = true;
    const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
    void (async () => {
      while (alive.current && queue.current.length) {
        const next = queue.current.shift()!;
        setEffect(next);
        await wait(ONLINE_EFFECT_TIMING.windupMs);
        if (!alive.current) break;
        setEffect({ ...next, impact: true });
        await wait(ONLINE_EFFECT_TIMING.impactMs);
      }
      running.current = false;
      if (alive.current) setEffect(null);
    })();
  }, [room.events, room.seat, disabled]);
  return effect;
}
