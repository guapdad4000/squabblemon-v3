import { CombatSprite, DefeatCross } from './BattleArt';
import { BattleBurst } from './BattleEffects';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SpecialMove } from './SpecialMove';
import { readMoveOverrides, specialMoveForEvent, gateSpecialMoveReplay } from '../specialMoves';
import { cards, cardEntryAccent, getCardImage, type Card } from '../data';
import { battleChanges, eventIntensity } from '../battleChoreography';
import { getCardWallpaper } from '../lib/cardFinish';
import type { PresentationEffect } from './PlayLoop';

import { DrFadeEntrance } from './DrFadeArt';

type Point = { x: number; y: number; width: number; height: number };
type Geometry = { source?: Point; current: Map<string, Point>; before: Map<string, Point> };

/** Anchor choreography to board cards, including effects that cross district boundaries. */
export function BattleAttack({ card, effect, impact, replaying = false, audioEnabled = false, playedSpecialMoves = null }: { card: Card; effect: PresentationEffect; impact: boolean; replaying?: boolean; audioEnabled?: boolean; playedSpecialMoves?: Set<string> | null }) {
  const root = useRef<HTMLDivElement>(null);
  const original = useRef(new Map<string, Point>());
  const [geometry, setGeometry] = useState<Geometry>({ current: new Map(), before: new Map() });
  const sourceId = effect.source?.cardInstanceId ?? effect.cardInstanceId;
  const move = useMemo(() => {
    const clip = specialMoveForEvent(effect, readMoveOverrides());
    if (!clip) return null;
    return gateSpecialMoveReplay(clip, { owner: effect.owner, sourceInstanceId: sourceId, moveId: clip.id }, playedSpecialMoves);
  }, [effect.cardId, effect.type, effect.kind, effect.owner, sourceId, playedSpecialMoves]);
  useLayoutEffect(() => {
    const arena = root.current?.parentElement;
    if (!arena) return;
    // Keep the affected card in view without scrolling the page or hiding the crew.
    const focusIds = new Set(effect.targetIds.length ? effect.targetIds : [sourceId]);
    const scrolled = new Set<Element>();
    arena.querySelectorAll<HTMLElement>('[data-card-zone="board"][data-instance-id]').forEach(node => {
      const stack = node.closest<HTMLElement>('[data-crowded="true"]');
      if (!stack || scrolled.has(stack) || !focusIds.has(node.dataset.instanceId!)) return;
      const cardBounds = node.getBoundingClientRect();
      const stackBounds = stack.getBoundingClientRect();
      if (cardBounds.top < stackBounds.top || cardBounds.bottom > stackBounds.bottom) {
        stack.scrollTop += cardBounds.top - stackBounds.top - 4;
      }
      scrolled.add(stack);
    });
    const measure = () => {
      const bounds = arena.getBoundingClientRect();
      const current = new Map<string, Point>();
      arena.querySelectorAll<HTMLElement>('[data-card-zone="board"][data-instance-id]').forEach(node => {
        const rect = node.getBoundingClientRect();
        current.set(node.dataset.instanceId!, { x: rect.x - bounds.x + rect.width / 2, y: rect.y - bounds.y + rect.height / 2, width: rect.width, height: rect.height });
      });
      if (!original.current.size) original.current = new Map(current);
      setGeometry({ source: original.current.get(sourceId) ?? current.get(sourceId), current, before: original.current });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(arena);
    const frame = requestAnimationFrame(measure);
    return () => { resize.disconnect(); cancelAnimationFrame(frame); };
  }, [sourceId, impact]);
  const changes = battleChanges(effect);
  const intensity = eventIntensity(effect);
  const targetIds = effect.targets.length ? effect.targets.map(target => target.cardInstanceId) : [sourceId];
  const source = geometry.source;
  const showPortrait = (effect.type === 'ability' && (effect.chain?.total ?? 0) < 2) || intensity === 'squabble';
  return <div ref={root} className={`battle-choreography kind-${effect.kind} intensity-${intensity} ${impact ? 'is-impact' : 'is-winding-up'} ${replaying ? 'is-replay' : ''}`}
    data-testid="character-attack" data-character={card.id} data-owner={effect.owner} data-impact={impact}
    style={{ '--attack-color': cardEntryAccent(card) } as React.CSSProperties} aria-hidden="true">
    {move && source && <div className="battle-special-move" data-move-id={move.id} style={{ left: source.x, top: `clamp(min(24vh, 205px), ${source.y}px, calc(100% - min(24vh, 205px)))` }}><SpecialMove clip={move} audioEnabled={audioEnabled} /></div>}
    {card.id === 'dr-fade' && effect.type === 'ability' && !effect.abilityMetadata?.upgradeId
      && <DrFadeEntrance key={effect.sequence} cueId={effect.sequence}
        squabble={!!effect.source?.after && effect.source.after.powerModifier >= effect.source.after.basePower} />}
    {showPortrait && card.id !== 'dr-fade' && <div className="attack-caption">
      <img className="attack-caption__scene" src={getCardWallpaper(card.type)} alt="" />
      <img className="attack-caption__fighter" src={getCardImage(card.id)} alt="" />
      <div><span>{intensity === 'squabble' ? 'SQUABBLE · DOUBLE HANDS' : card.name}</span>
        <strong>{effect.abilityMetadata?.upgradeName ?? card.ability}</strong></div>
    </div>}
    <svg className="attack-paths" width="100%" height="100%">
      {source && effect.chain?.fromId && effect.chain.fromId !== sourceId && geometry.before.has(effect.chain.fromId) && <path className="chain-link" d={['M', geometry.before.get(effect.chain.fromId)!.x, geometry.before.get(effect.chain.fromId)!.y, 'L', source.x, source.y].join(' ')} pathLength="1" />}
      {source && targetIds.map(id => {
        const target = geometry.before.get(id) ?? geometry.current.get(id) ?? source;
        const self = id === sourceId;
        const path = `M ${source.x} ${source.y} Q ${(source.x + target.x) / 2 + 35} ${(source.y + target.y) / 2} ${target.x} ${target.y}`;
        return <g key={id} data-attack-target={id}>
          {!self && <path className={'attack-beam' + (card.id === 'dr-fade' && effect.targets.some(target => target.cardInstanceId === id && target.owner === effect.owner) ? ' dr-fade-coaching' : '')} d={path} pathLength="1" />}
          {impact && <g className="attack-hit" style={{ transformOrigin: `${target.x}px ${target.y}px` }}>
            {effect.kind === 'blocked'
              ? <path className="attack-shield" d={`M ${target.x} ${target.y - 35} l 28 12 v 26 q -4 23 -28 34 q -24 -11 -28 -34 v -26 Z`} />
              : <><circle cx={target.x} cy={target.y} r={Math.max(24, target.width * .45)} /><circle cx={target.x} cy={target.y} r={Math.max(16, target.width * .3)} /></>}
          </g>}
        </g>;
      })}
    </svg>
    {impact && changes.map(change => {
      const point = geometry.current.get(change.cardInstanceId) ?? geometry.before.get(change.cardInstanceId);
      if (!point) return null;
      const from = geometry.before.get(change.cardInstanceId);
      const moved = from && change.before?.lane !== change.after?.lane && change.before && change.after;
      const destroyed = !!change.before && !change.after;
      const thawed = !!change.after && change.before?.statuses.frozen && !change.after.statuses.frozen;
      const shieldSpent = !!change.after && change.before?.statuses.protected && !change.after.statuses.protected;
      const restored = !!change.after && change.before?.statuses.silenced && !change.after.statuses.silenced;
      const powerLost = destroyed || (!!change.before && !!change.after && change.after.basePower + change.after.powerModifier < change.before.basePower + change.before.powerModifier);
      const powerGained = !!change.before && !!change.after && change.after.basePower + change.after.powerModifier > change.before.basePower + change.before.powerModifier;
      return <React.Fragment key={change.cardInstanceId}>
        {destroyed && <div className="attack-destroyed-card" data-testid="destroyed-card" style={{ left: point.x, top: point.y, width: point.width, height: point.height }}><img className="defeated-portrait" src={getCardImage(cards[change.cardId]?.id ?? change.cardId)} alt="" /><DefeatCross /></div>}
        {(powerLost || powerGained) && <div className="attack-material" style={{ left: point.x, top: point.y, width: point.width, height: point.height }}><BattleBurst kind={powerLost ? 'burn' : 'charge'} /></div>}
        {(thawed || shieldSpent || restored) && <div data-testid="status-release" className={'status-release ' + (thawed ? 'is-thawing is-unlocking' : shieldSpent ? 'is-shattering' : 'is-restoring is-unlocking')} style={{ left: point.x, top: point.y, width: point.width, height: point.height }}>{thawed || restored ? <><CombatSprite asset="lock-chain-strand" className="unlock-chain" /><CombatSprite asset="lock-chain-strand" className="unlock-chain" /><CombatSprite asset="lock-padlock" className="unlock-padlock" />{thawed && <CombatSprite asset="freeze-rim" className="unlock-ice" />}</> : Array.from({length:6},(_,index)=><i key={index} style={{'--shard-angle':index*60+'deg'} as React.CSSProperties}/>)}</div>}
        {moved && <img className="attack-moving-card" src={getCardImage(cards[change.cardId]?.id ?? change.cardId)} alt=""
          style={{ left: point.x, top: point.y, width: point.width, height: point.height, '--move-x': `${from.x - point.x}px`, '--move-y': `${from.y - point.y}px` } as React.CSSProperties} />}
        {(change.delta !== 0 || change.labels.length > 0) && <div data-testid="battle-power-change" className={`attack-delta ${change.delta < 0 ? 'is-loss' : 'is-gain'}`} style={{ left: point.x, top: point.y - point.height * .25 }}>
          {change.delta !== 0 && <strong>{change.delta > 0 ? '+' : '−'}{Math.abs(change.delta)}</strong>}
          {change.labels.map(label => <span key={label}>{label}</span>)}
        </div>}
      </React.Fragment>;
    })}
  </div>;
}
