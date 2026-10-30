import { ONLINE_BATTLE_SPEED } from '../battleSpeed';
import { completeDefeatBeat, DEFEAT_CONTACT_MS } from './battleMediaEvents';
import { gateSpecialMoveReplay, getMovePlayKey, readMoveOverrides, specialMoveForEvent } from '../specialMoves';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { OnlineRoomView, PublicEvent, PublicParticipant, Seat } from '@workspace/squabblemon-engine/multiplayer';
import type { EventParticipant, Lane } from '../gameEngine';
import type { PresentationEffect } from '../components/PlayLoop';

/** Wall-clock timings: the server clock is independent of decorative playback. */
export const ONLINE_EFFECT_TIMING = { windupMs: 225, impactMs: 325 } as const;
export function onlineEffectPlan(effect: PresentationEffect, played: Set<string> | null = null) {
  const candidate = specialMoveForEvent(effect, readMoveOverrides());
  const key = candidate ? { owner: effect.owner, sourceInstanceId: effect.cardInstanceId, moveId: candidate.id } : null;
  const clip = key ? gateSpecialMoveReplay(candidate, key, played) : null;
  const contactMs = Math.max(DEFEAT_CONTACT_MS, (clip?.durationMs ?? 0) - ONLINE_EFFECT_TIMING.windupMs * ONLINE_BATTLE_SPEED);
  const normalMs = Math.max(ONLINE_EFFECT_TIMING.impactMs * ONLINE_BATTLE_SPEED,
    (clip?.durationMs ?? 0) - ONLINE_EFFECT_TIMING.windupMs * ONLINE_BATTLE_SPEED);
  return { impactMs: Math.ceil(completeDefeatBeat(effect, normalMs, contactMs) / ONLINE_BATTLE_SPEED),
    contactMs, playKey: clip && key ? getMovePlayKey(key) : null };
}
export const onlineEffectImpactMs = (effect: PresentationEffect) => onlineEffectPlan(effect).impactMs;

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
    tabletChanged: Boolean(event.tabletPlaced?.length || event.tabletConsumed?.length),
    targetIds: targets.map(t => t.cardInstanceId), impact: false,
    artCues: event.artCues?.map(cue => ({ ...cue, owner: owner(cue.owner) })),
  };
}

/** Replays public events in order. Only the visual board is held; commands and clocks stay live. */
export function useOnlineEffectPresenter(room: OnlineRoomView, scores: PresentationEffect['scores']['before'], disabled: boolean) {
  const key = `${room.code}:${room.gameNumber}`;
  const [playback, setPlayback] = useState(() => ({ key, pending: [] as PresentationEffect[], impact: false }));
  const seen = useRef(room.events.at(-1)?.sequence ?? 0);
  const playedSpecialMoves = useRef(new Set<string>());
  const latest = useRef(room); latest.current = room;
  const first = playback.key === key && !disabled ? playback.pending[0] : undefined;
  const effect = useMemo(() => first ? { ...first, impact: playback.impact,
    defeatContactMs: onlineEffectPlan(first, playedSpecialMoves.current).contactMs } : null, [first, playback.impact]);
  // Include newly received events before the layout effect runs: no one-frame
  // disappearance of a defeated target between the snapshot and its animation.
  const pendingEffects = useMemo(() => {
    if (disabled || playback.key !== key || (typeof document !== 'undefined' && document.hidden)) return [];
    const fresh = room.events.filter(e => e.sequence > seen.current)
      .flatMap(e => toPresentationEffect(e, room.seat, scores) ?? []);
    return [...(effect ? [effect, ...playback.pending.slice(1)] : []), ...fresh];
  }, [disabled, key, playback, effect, room.events, room.seat, scores]);
  useLayoutEffect(() => {
    const last = room.events.at(-1)?.sequence ?? 0;
    if (playback.key !== key) {
      seen.current = last;
      playedSpecialMoves.current.clear();
      setPlayback({ key, pending: [], impact: false });
      return;
    }
    const fresh = room.events.filter(e => e.sequence > seen.current);
    seen.current = last;
    if (disabled || (typeof document !== 'undefined' && document.hidden)) {
      setPlayback(p => p.pending.length ? { key, pending: [], impact: false } : p);
      return;
    }
    const incoming = fresh.flatMap(e => toPresentationEffect(e, room.seat, scores) ?? []);
    if (incoming.length) setPlayback(p => ({ ...p, pending: [...p.pending, ...incoming] }));
  }, [room.events, room.seat, key, disabled, playback.key, scores]);
  useEffect(() => {
    if (!first) return;
    const plan = onlineEffectPlan(first, playedSpecialMoves.current);
    const timer = window.setTimeout(() => {
      if (!playback.impact) setPlayback(p => ({ ...p, impact: true }));
      else {
        if (plan.playKey) playedSpecialMoves.current.add(plan.playKey);
        setPlayback(p => ({ ...p, pending: p.pending.slice(1), impact: false }));
      }
    }, playback.impact ? plan.impactMs : ONLINE_EFFECT_TIMING.windupMs);
    return () => window.clearTimeout(timer);
  }, [first, playback.impact, key]);
  useEffect(() => {
    const hide = () => {
      if (!document.hidden) return;
      seen.current = latest.current.events.at(-1)?.sequence ?? seen.current;
      setPlayback(p => ({ ...p, pending: [], impact: false }));
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  return { effect, pendingEffects, playedSpecialMoves: playedSpecialMoves.current,
    presenting: !disabled && pendingEffects.length > 0 };
}
