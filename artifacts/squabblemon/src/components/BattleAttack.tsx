import { CombatSprite, DefeatCross } from './BattleArt';
import { BattleBurst } from './BattleEffects';
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { SpecialMove } from './SpecialMove';
import { readMoveOverrides, specialMoveForEvent, gateSpecialMoveReplay } from '../specialMoves';
import { cards, cardEntryAccent, getCardImage, type Card } from '../data';
import { battleChanges, eventIntensity, isAuraLossDeparture } from '../battleChoreography';
import { getCardWallpaper } from '../lib/cardFinish';
import type { PresentationEffect } from './PlayLoop';

import { DrFadeEntrance } from './DrFadeArt';

type Point = { x: number; y: number; width: number; height: number };

/** Anchor choreography to board cards, including effects that cross district boundaries. */
const SPARK_ANGLES = Array.from({ length: 8 }, (_, index) => index * Math.PI / 4 + Math.PI / 8);
/** Jagged comic-book impact star; deterministic so renders stay stable. */
function impactStar(x: number, y: number, radius: number) {
  return Array.from({ length: 20 }, (_, index) => {
    const angle = index * Math.PI / 10 - Math.PI / 2;
    const r = index % 2 ? radius * (index % 4 === 1 ? .42 : .5) : radius * (index % 6 === 0 ? 1 : .8);
    return `${(x + Math.cos(angle) * r).toFixed(1)},${(y + Math.sin(angle) * r).toFixed(1)}`;
  }).join(' ');
}

type Geometry = { source?: Point; current: Map<string, Point>; before: Map<string, Point> };
const px = (value: number) => `${value}px`;
const hide = (node: Element, hidden: boolean) => {
  if (node instanceof SVGElement) node.style.display = hidden ? 'none' : '';
  else (node as HTMLElement).style.display = hidden ? 'none' : '';
};
const setAttrs = (node: Element | null, attrs: Record<string, string | number>) => {
  if (!node) return;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
};
const beamPath = (source: Point, target: Point) => `M ${source.x} ${source.y} Q ${(source.x + target.x) / 2 + 35} ${(source.y + target.y) / 2} ${target.x} ${target.y}`;

/**
 * Board geometry only exists after React commits the board, so it is written to the
 * choreography DOM directly. Storing it in state added one or two extra full battle
 * commits for every presented effect.
 */
function applyGeometry(root: HTMLElement, geometry: Geometry, sourceId: string) {
  const { source, current, before } = geometry;
  root.querySelectorAll<HTMLElement>('[data-geo="special"]').forEach(node => {
    hide(node, !source);
    if (!source) return;
    node.style.left = px(source.x);
    node.style.top = `clamp(min(24vh, 205px), ${source.y}px, calc(100% - min(24vh, 205px)))`;
  });
  root.querySelectorAll<SVGPathElement>('[data-geo="chain"]').forEach(node => {
    const from = before.get(node.dataset.from!);
    hide(node, !source || !from);
    if (source && from) node.setAttribute('d', ['M', from.x, from.y, 'L', source.x, source.y].join(' '));
  });
  root.querySelectorAll<SVGGElement>('[data-attack-target]').forEach(group => {
    hide(group, !source);
    if (!source) return;
    const id = group.dataset.attackTarget!;
    const target = before.get(id) ?? current.get(id) ?? source;
    const path = beamPath(source, target);
    group.querySelectorAll('[data-geo="beam"]').forEach(node => node.setAttribute('d', path));
    const hit = group.querySelector<SVGGElement>('.attack-hit');
    if (!hit) return;
    hit.style.transformOrigin = `${target.x}px ${target.y}px`;
    setAttrs(hit.querySelector('.attack-shield'), { d: `M ${target.x} ${target.y - 35} l 28 12 v 26 q -4 23 -28 34 q -24 -11 -28 -34 v -26 Z` });
    setAttrs(hit.querySelector('.attack-flash'), { cx: target.x, cy: target.y, r: Math.max(30, target.width * .55) });
    setAttrs(hit.querySelector('.attack-star'), { points: impactStar(target.x, target.y, Math.max(34, target.width * .62)) });
    setAttrs(hit.querySelector('[data-geo="ring-outer"]'), { cx: target.x, cy: target.y, r: Math.max(24, target.width * .45) });
    setAttrs(hit.querySelector('[data-geo="ring-inner"]'), { cx: target.x, cy: target.y, r: Math.max(16, target.width * .3) });
    hit.querySelectorAll('.attack-spark').forEach((line, index) => {
      const angle = SPARK_ANGLES[index], reach = Math.max(46, target.width * .8);
      setAttrs(line, { x1: target.x + Math.cos(angle) * 14, y1: target.y + Math.sin(angle) * 14, x2: target.x + Math.cos(angle) * reach, y2: target.y + Math.sin(angle) * reach });
    });
  });
  root.querySelectorAll<HTMLElement>('[data-geo-change]').forEach(node => {
    const id = node.dataset.geoChange!;
    const point = current.get(id) ?? before.get(id);
    const from = before.get(id);
    const role = node.dataset.geoRole;
    const hidden = !point || (role === 'moved' && !from);
    hide(node, hidden);
    if (hidden) return;
    node.style.left = px(point.x);
    if (role === 'delta') { node.style.top = px(point.y - point.height * .25); return; }
    node.style.top = px(point.y);
    node.style.width = px(point.width);
    node.style.height = px(point.height);
    if (role === 'moved') {
      node.style.setProperty('--move-x', px(from!.x - point.x));
      node.style.setProperty('--move-y', px(from!.y - point.y));
    }
  });
}

export function BattleAttack({ card, effect, impact, replaying = false, audioEnabled = false, playedSpecialMoves = null, speed = 1 }: { card: Card; effect: PresentationEffect; impact: boolean; replaying?: boolean; audioEnabled?: boolean; playedSpecialMoves?: Set<string> | null; speed?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const original = useRef(new Map<string, Point>());
  const sourceId = effect.source?.cardInstanceId ?? effect.cardInstanceId;
  const move = useMemo(() => {
    const clip = specialMoveForEvent(effect, readMoveOverrides());
    if (!clip) return null;
    return gateSpecialMoveReplay(clip, { owner: effect.owner, sourceInstanceId: sourceId, moveId: clip.id }, playedSpecialMoves);
  }, [effect.cardId, effect.type, effect.kind, effect.owner, sourceId, playedSpecialMoves]);
  const changes = battleChanges(effect);
  const intensity = eventIntensity(effect);
  const targetIds = effect.targets.length
    ? effect.targets.filter(target => !isAuraLossDeparture(target)).map(target => target.cardInstanceId)
    : [sourceId];
  // Geometry-bearing nodes only mount/unmount when the source, impact, or clip changes.
  useLayoutEffect(() => {
    const overlay = root.current;
    const arena = overlay?.parentElement;
    if (!overlay || !arena) return;
    // Keep the affected card in view without scrolling the page or hiding the crew.
    const focusIds = new Set(targetIds.length ? targetIds : [sourceId]);
    const scrolled = new Set<Element>();
    const scrolls: { stack: HTMLElement; top: number }[] = [];
    arena.querySelectorAll<HTMLElement>('[data-card-zone="board"][data-instance-id]').forEach(node => {
      const stack = node.closest<HTMLElement>('[data-crowded="true"]');
      if (!stack || scrolled.has(stack) || !focusIds.has(node.dataset.instanceId!)) return;
      const cardBounds = node.getBoundingClientRect();
      const stackBounds = stack.getBoundingClientRect();
      if (cardBounds.top < stackBounds.top || cardBounds.bottom > stackBounds.bottom) {
        scrolls.push({ stack, top: stack.scrollTop + cardBounds.top - stackBounds.top - 4 });
      }
      scrolled.add(stack);
    });
    scrolls.forEach(({ stack, top }) => { stack.scrollTop = top; });
    const measure = () => {
      const bounds = arena.getBoundingClientRect();
      const current = new Map<string, Point>();
      arena.querySelectorAll<HTMLElement>('[data-card-zone="board"][data-instance-id]').forEach(node => {
        const rect = node.getBoundingClientRect();
        current.set(node.dataset.instanceId!, { x: rect.x - bounds.x + rect.width / 2, y: rect.y - bounds.y + rect.height / 2, width: rect.width, height: rect.height });
      });
      if (!original.current.size) original.current = new Map(current);
      const source = original.current.get(sourceId) ?? current.get(sourceId);
      applyGeometry(overlay, { source, current, before: original.current }, sourceId);
    };
    measure();
    // ResizeObserver fires once on observe(). Coalesce it with the follow-up
    // frame instead of forcing two identical board-wide layout reads.
    let frame = 0;
    const scheduleMeasure = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); }); };
    const resize = new ResizeObserver(scheduleMeasure);
    resize.observe(arena);
    scheduleMeasure();
    return () => { resize.disconnect(); cancelAnimationFrame(frame); };
  }, [sourceId, impact, move]);
  const showPortrait = (effect.type === 'ability' && (effect.chain?.total ?? 0) < 2) || intensity === 'squabble';
  const chainFrom = effect.chain?.fromId && effect.chain.fromId !== sourceId ? effect.chain.fromId : null;
  const hidden = { display: 'none' } as const;
  return <div ref={root} className={`battle-choreography kind-${effect.kind} intensity-${intensity} ${impact ? 'is-impact' : 'is-winding-up'} ${replaying ? 'is-replay' : ''}`}
    data-testid="character-attack" data-character={card.id} data-owner={effect.owner} data-impact={impact}
    style={{ '--attack-color': cardEntryAccent(card) } as React.CSSProperties} aria-hidden="true">
    {move && <div className="battle-special-move" data-geo="special" data-move-id={move.id} style={hidden}><SpecialMove clip={move} audioEnabled={audioEnabled} speed={speed} /></div>}
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
      {chainFrom && <path className="chain-link" data-geo="chain" data-from={chainFrom} pathLength="1" style={hidden} />}
      {targetIds.map(id => {
        const self = id === sourceId;
        return <g key={id} data-attack-target={id} style={hidden}>
          {!self && <path className="attack-beam-glow" data-geo="beam" pathLength="1" />}
          {!self && <path className={'attack-beam' + (card.id === 'dr-fade' && effect.targets.some(target => target.cardInstanceId === id && target.owner === effect.owner) ? ' dr-fade-coaching' : '')} data-geo="beam" pathLength="1" />}
          {!self && <path className="attack-beam-core" data-geo="beam" pathLength="1" />}
          {!self && <path className="attack-comet" data-geo="beam" pathLength="1" />}
          {impact && <g className="attack-hit">
            {effect.kind === 'blocked'
              ? <path className="attack-shield" />
              : <><circle className="attack-flash" /><polygon className="attack-star" /><circle data-geo="ring-outer" /><circle data-geo="ring-inner" />{SPARK_ANGLES.map(angle => <line key={angle} className="attack-spark" />)}</>}
          </g>}
        </g>;
      })}
    </svg>
    {impact && changes.map(change => {
      const id = change.cardInstanceId;
      const moved = change.before?.lane !== change.after?.lane && change.before && change.after;
      const neutralDeparture = isAuraLossDeparture(change);
      const destroyed = !!change.before && !change.after && !neutralDeparture;
      const thawed = !!change.after && change.before?.statuses.frozen && !change.after.statuses.frozen;
      const shieldSpent = !!change.after && change.before?.statuses.protected && !change.after.statuses.protected;
      const restored = !!change.after && change.before?.statuses.silenced && !change.after.statuses.silenced;
      // Ongoing aura shifts affect score, but are not a hit or damage animation.
      const permanentEnemyHit = !!change.before && !!change.after
        && change.owner !== effect.owner
        && change.after.powerModifier < change.before.powerModifier;
      const powerLost = destroyed || permanentEnemyHit;
      const powerGained = change.permanentDelta > 0;
      return <React.Fragment key={id}>
        {neutralDeparture && <img className="attack-moving-card" data-testid="neutral-departure" src={getCardImage(cards[change.cardId]?.id ?? change.cardId)} alt="" data-geo-change={id} data-geo-role="moved" style={hidden} />}
        {destroyed && <div className="attack-destroyed-card" data-testid="destroyed-card" data-geo-change={id} data-geo-role="box" style={hidden}><img className="defeated-portrait" src={getCardImage(cards[change.cardId]?.id ?? change.cardId)} alt="" /><DefeatCross /></div>}
        {(powerLost || powerGained) && <div className="attack-material" data-geo-change={id} data-geo-role="box" style={hidden}><BattleBurst kind={powerLost ? 'burn' : 'charge'} /></div>}
        {(thawed || shieldSpent || restored) && <div data-testid="status-release" className={'status-release ' + (thawed ? 'is-thawing is-unlocking' : shieldSpent ? 'is-shattering' : 'is-restoring is-unlocking')} data-geo-change={id} data-geo-role="box" style={hidden}>{thawed || restored ? <><CombatSprite asset="lock-chain-strand" className="unlock-chain" /><CombatSprite asset="lock-chain-strand" className="unlock-chain" /><CombatSprite asset="lock-padlock" className="unlock-padlock" />{thawed && <CombatSprite asset="freeze-rim" className="unlock-ice" />}</> : Array.from({length:6},(_,index)=><i key={index} style={{'--shard-angle':index*60+'deg'} as React.CSSProperties}/>)}</div>}
        {moved && <img className="attack-moving-card" src={getCardImage(cards[change.cardId]?.id ?? change.cardId)} alt="" data-geo-change={id} data-geo-role="moved" style={hidden} />}
        {((change.permanentDelta !== 0 && !neutralDeparture) || change.labels.length > 0) && <div data-testid="battle-power-change" className={`attack-delta ${neutralDeparture ? '' : change.delta < 0 ? 'is-loss' : 'is-gain'}`} data-geo-change={id} data-geo-role="delta" style={neutralDeparture ? { ...hidden, color: '#e5e7eb' } : hidden}>
          {change.delta !== 0 && !neutralDeparture && <strong>{change.delta > 0 ? '+' : '−'}{Math.abs(change.delta)}</strong>}
          {change.labels.map(label => <span key={label}>{label}</span>)}
        </div>}
      </React.Fragment>;
    })}
  </div>;
}
