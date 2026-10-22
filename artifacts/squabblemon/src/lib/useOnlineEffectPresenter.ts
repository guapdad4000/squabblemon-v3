import { completeDefeatBeat, DEFEAT_CONTACT_MS } from './battleMediaEvents';
import { readMoveOverrides, specialMoveForEvent } from '../specialMoves';
import { useEffect, useRef, useState } from 'react';
import type { OnlineRoomView, PublicEvent, PublicParticipant, Seat } from '@workspace/squabblemon-engine/multiplayer';
import type { EventParticipant, Lane } from '../gameEngine';
import type { PresentationEffect } from '../components/PlayLoop';

/** Routine PvP effects are brief; knockouts finish the full impact and ghost silently. */
export const ONLINE_EFFECT_TIMING = { windupMs: 225, impactMs: 325 } as const;
export const onlineEffectImpactMs = (effect: PresentationEffect) => completeDefeatBeat(effect,
  ONLINE_EFFECT_TIMING.impactMs, Math.max(DEFEAT_CONTACT_MS, specialMoveForEvent(effect, readMoveOverrides())?.durationMs ?? 0));

export function toPresentationEffect(event: PublicEvent, seat: Seat, scores: PresentationEffect['scores']['before']): PresentationEffect | null {
  if ((!event.sourceId && !event.artCues?.length) || event.type === 'pass' || event.type === 'reveal' || event.kind === 'story') return null;
  const owner = (s: Seat) => s === seat ? 'player' as const : 'cpu' as const;
  const participant = (p: PublicParticipant): EventParticipant => {
    const state = (s: PublicParticipant['before']) => s ? { ...s, cardInstanceId: p.cardInstanceId, cardId: p.cardId, owner: owner(s.owner ?? p.owner), lastEffectNote: '' } : null;
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
    cardInstanceId: event.sourceId ?? '', cardId: source?.cardId ?? event.cardId ?? '', owner: owner(event.owner), lane, kind: event.kind, note: event.note,
    targetIds: targets.map(t => t.cardInstanceId), impact: false,
    artCues: event.artCues?.map(cue => ({ ...cue, owner: owner(cue.owner) })),
  };
}

/** Replays newly arrived public events as board effects. Display only; never changes game state. */
export function useOnlineEffectPresenter(room: OnlineRoomView, scores: PresentationEffect['scores']['before'], disabled: boolean) {
  const [effect, setEffect] = useState<PresentationEffect | null>(null);
  const seen = useRef(room.events.at(-1)?.sequence ?? 0);
  const queue = useRef<PresentationEffect[]>([]);
  const running = useRef(false);
  const generation = useRef(0);
  const alive = useRef(true);
  const scoresRef = useRef(scores); scoresRef.current = scores;
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  useEffect(() => { generation.current++; running.current = false; queue.current = []; setEffect(null); seen.current = room.events.at(-1)?.sequence ?? 0; }, [room.code, room.gameNumber]);
  useEffect(() => {
    const fresh = room.events.filter(e => e.sequence > seen.current);
    seen.current = room.events.at(-1)?.sequence ?? seen.current;
    if (disabled || typeof document === 'undefined' || document.hidden) { generation.current++; running.current = false; queue.current = []; setEffect(null); return; }
    queue.current.push(...fresh.flatMap(e => toPresentationEffect(e, room.seat, scoresRef.current) ?? []));
    queue.current = queue.current.slice(-8);
    if (running.current) return;
    running.current = true;
    const currentGeneration = generation.current;
    const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
    void (async () => {
      while (alive.current && currentGeneration === generation.current && queue.current.length) {
        const next = queue.current.shift()!;
        setEffect(next);
        await wait(ONLINE_EFFECT_TIMING.windupMs);
        if (!alive.current || currentGeneration !== generation.current) return;
        setEffect({ ...next, impact: true });
        await wait(onlineEffectImpactMs(next));
      }
      if (currentGeneration !== generation.current) return;
      running.current = false;
      if (alive.current) setEffect(null);
    })();
  }, [room.events, room.seat, disabled]);
  return { effect, presenting: !disabled && (effect !== null || queue.current.length > 0 || room.events.some(e => e.sequence > seen.current && toPresentationEffect(e, room.seat, scores) !== null)) };
}
