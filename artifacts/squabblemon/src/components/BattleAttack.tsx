import { isDefeatMediaReady, warmDefeatMedia } from '../lib/battleDefeatMedia';
import { battlePortraitUrl } from '../lib/battlePortrait';
import { CombatSprite } from './BattleArt';
import { BattleBurst } from './BattleEffects';
import { BattleFxImage } from './BattleFxImage';
import { DEFEAT_CONTACT_MS, burnApplicationTargetIds, hasDefeatedCard } from '../lib/battleMediaEvents';
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { cancelFrame, frame } from 'framer-motion';
import { SpecialMove } from './SpecialMove';
import { readMoveOverrides, specialMoveForEvent, gateSpecialMoveReplay } from '../specialMoves';
import { cards, cardEntryAccent, getCardImage, type Card } from '../data';
import { getCardArtworkId } from '../lib/assets';
import { battleChanges, eventIntensity, isNeutralDeparture } from '../battleChoreography';
import { getCardWallpaper } from '../lib/cardFinish';
import type { PresentationEffect } from './PlayLoop';

import { DrFadeEntrance } from './DrFadeArt';
import './battle-attack-polish.css';

type Point = { x: number; y: number; width: number; height: number };

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
  });
  root.querySelectorAll<HTMLElement>('[data-impact-target]').forEach(shell => {
    hide(shell, !source);
    if (!source) return;
    const target = before.get(shell.dataset.impactTarget!) ?? current.get(shell.dataset.impactTarget!) ?? source;
    const extent = Math.max(64, target.width * .8 + 18);
    shell.style.left = px(target.x - extent); shell.style.top = px(target.y - extent);
    shell.style.width = px(extent * 2); shell.style.height = px(extent * 2);
    const hit = shell.querySelector<SVGSVGElement>('.attack-hit')!;
    hit.setAttribute('viewBox', `${-extent} ${-extent} ${extent * 2} ${extent * 2}`);
    setAttrs(hit.querySelector('.attack-shield'), { d: `M ${0} ${0 - 35} l 28 12 v 26 q -4 23 -28 34 q -24 -11 -28 -34 v -26 Z` });

  });
  root.querySelectorAll<HTMLElement>('[data-geo-change]').forEach(node => {
    const id = node.dataset.geoChange!;
    const role = node.dataset.geoRole;
    const point = role === 'departure' ? before.get(id) : current.get(id) ?? before.get(id);
    const from = before.get(id);
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

export function BattleAttack({ card, effect, impact, replaying = false, audioEnabled = false, playedSpecialMoves = null, speed = 1, showCaption = true }: { card: Card; effect: PresentationEffect; impact: boolean; replaying?: boolean; audioEnabled?: boolean; playedSpecialMoves?: Set<string> | null; speed?: number; showCaption?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const original = useRef(new Map<string, Point>());
  const originalArea = useRef({ width: 0, height: 0 });
  const defeatAnchors = useRef(new Map<string, { x: number; y: number }>());
  const sourceId = effect.source?.cardInstanceId ?? effect.cardInstanceId;
  const move = useMemo(() => {
    const clip = specialMoveForEvent(effect, readMoveOverrides());
    if (!clip) return null;
    return gateSpecialMoveReplay(clip, { owner: effect.owner, sourceInstanceId: sourceId, moveId: clip.id }, playedSpecialMoves);
  }, [effect.sequence, effect.cardId, effect.type, effect.kind, effect.owner, sourceId, playedSpecialMoves]);
  const defeatMedia = useRef<'atlas' | 'fallback' | null>(null);
  const hasDefeat = hasDefeatedCard(effect);
  useEffect(() => { if (hasDefeat) void warmDefeatMedia(); }, [hasDefeat]);
  // Decide once at contact. A slow image arriving halfway through the beat must
  // not replace a moving fallback with a frozen late frame or restart the KO.
  if (impact && hasDefeat && !defeatMedia.current) defeatMedia.current = isDefeatMediaReady() ? 'atlas' : 'fallback';
  const useDefeatAtlas = defeatMedia.current === 'atlas';
  const changes = battleChanges(effect);
  const intensity = eventIntensity(effect);
  const burnTargets = burnApplicationTargetIds(effect);
  const targetIds = effect.targets.length
    ? effect.targets.filter(target => !isNeutralDeparture(target)).map(target => target.cardInstanceId)
    : [sourceId];
  // Geometry-bearing nodes only mount/unmount when the source, impact, or clip changes.
  useLayoutEffect(() => {
    const overlay = root.current;
    const arena = overlay?.parentElement;
    if (!overlay || !arena) return;
    // Capture pre-impact positions even when a self-only departure has no beam.
    // Otherwise only empty events can skip geometry while retaining caption/flash.
    const hasUpcomingGeometry = !impact && changes.some(change => change.permanentDelta !== 0 || change.labels.length > 0);
    if (!hasUpcomingGeometry && !overlay.querySelector('[data-geo="special"], [data-geo="chain"], [data-geo="beam"], [data-impact-target], [data-geo-change]')) return;
    // Keep the affected card in view without scrolling the page or hiding the crew.
    const focusIds = new Set(targetIds.length ? targetIds : [sourceId]);
    const measuredIds = new Set([sourceId, ...targetIds, ...changes.map(change => change.cardInstanceId)]);
    if (effect.chain?.fromId) measuredIds.add(effect.chain.fromId);
    let scrolledInitial = false;
    let measuredWidth = 0, measuredHeight = 0;
    let pending: Geometry | null = null;
    let disposed = false;
    const paint = () => {
      if (!disposed && pending) applyGeometry(overlay, pending, sourceId);
      pending = null;
    };
    const measure = () => {
      if (disposed) return;
      // Reuse rectangles within a pass, including shared defeat zones/samples.
      const rectangles = new Map<Element, DOMRect>();
      const rectFor = (element: Element) => {
        let rect = rectangles.get(element);
        if (!rect) { rect = element.getBoundingClientRect(); rectangles.set(element, rect); }
        return rect;
      };
      const boardNodes = arena.querySelectorAll<HTMLElement>('[data-card-zone="board"][data-instance-id]');
      if (!scrolledInitial) {
        scrolledInitial = true;
        const scrolled = new Set<Element>();
        const scrolls: { stack: HTMLElement; top: number }[] = [];
        boardNodes.forEach(node => {
          const stack = node.closest<HTMLElement>('[data-crowded="true"]');
          if (!stack || scrolled.has(stack) || !focusIds.has(node.dataset.instanceId!)) return;
          const cardBounds = rectFor(node);
          const stackBounds = rectFor(stack);
          if (cardBounds.top < stackBounds.top || cardBounds.bottom > stackBounds.bottom) {
            scrolls.push({ stack, top: stack.scrollTop + cardBounds.top - stackBounds.top - 4 });
          }
          scrolled.add(stack);
        });
        scrolls.forEach(({ stack, top }) => { stack.scrollTop = top; });
        // Scroll snapping can move the cards; only a real scroll invalidates them.
        if (scrolls.length) rectangles.clear();
      }
      const bounds = rectFor(arena);
      measuredWidth = bounds.width; measuredHeight = bounds.height;
      const current = new Map<string, Point>();
      boardNodes.forEach(node => {
        if (!measuredIds.has(node.dataset.instanceId!)) return;
        const rect = rectFor(node);
        current.set(node.dataset.instanceId!, { x: rect.x - bounds.x + rect.width / 2, y: rect.y - bounds.y + rect.height / 2, width: rect.width, height: rect.height });
      });
      if (!original.current.size) {
        original.current = new Map(current);
        originalArea.current = { width: bounds.width, height: bounds.height };
      }
      const resized = originalArea.current.width !== bounds.width || originalArea.current.height !== bounds.height;
      for (const participant of [effect.source, ...effect.targets]) {
        if (!participant?.before || participant.after || participant.departureCause) continue;
        const zone = arena.querySelector<HTMLElement>(`[data-testid="lane-${participant.before.lane}-${participant.owner}-zone"]`);
        const zoneBox = zone ? rectFor(zone) : undefined;
        if (!zoneBox || !zoneBox.width || !zoneBox.height) continue;
        const previous = original.current.get(participant.cardInstanceId);
        if (previous && !defeatAnchors.current.has(participant.cardInstanceId)) {
          defeatAnchors.current.set(participant.cardInstanceId, { x: (previous.x + bounds.left - zoneBox.left) / zoneBox.width, y: (previous.y + bounds.top - zoneBox.top) / zoneBox.height });
        }
        if (previous && !resized) continue;
        const sample = zone?.querySelector<HTMLElement>('[data-card-zone="board"]') ?? boardNodes[0];
        const size = sample ? rectFor(sample) : undefined;
        const width = size?.width ?? Math.min(96, zoneBox.width), height = size?.height ?? width * 1.4;
        const anchor = defeatAnchors.current.get(participant.cardInstanceId) ?? { x: .5, y: Math.min(zoneBox.height, height) / (2 * zoneBox.height) };
        defeatAnchors.current.set(participant.cardInstanceId, anchor);
        original.current.set(participant.cardInstanceId, { x: zoneBox.left + zoneBox.width * anchor.x - bounds.left, y: zoneBox.top + zoneBox.height * anchor.y - bounds.top, width, height });
      }
      const source = original.current.get(sourceId) ?? current.get(sourceId);
      pending = { source, current, before: original.current };
      frame.render(paint);
    };
    // Join Motion's shared read phase: every board reads before overlay writes,
    // instead of forcing layout inside each React commit and each independent RAF.
    const scheduleMeasure = () => { frame.read(measure); };
    scheduleMeasure();
    const resize = new ResizeObserver(entries => {
      const box = entries[0]?.borderBoxSize?.[0];
      if (!box || box.inlineSize !== measuredWidth || box.blockSize !== measuredHeight) scheduleMeasure();
    });
    resize.observe(arena, { box: 'border-box' });
    return () => { disposed = true; resize.disconnect(); cancelFrame(measure); cancelFrame(paint); pending = null; };
  }, [sourceId, impact, move]);
  const showPortrait = (effect.type === 'ability' && (effect.chain?.total ?? 0) < 2) || intensity === 'squabble';
  const chainFrom = effect.chain?.fromId && effect.chain.fromId !== sourceId ? effect.chain.fromId : null;
  const hidden = { display: 'none' } as const;
  return <div ref={root} className={`battle-choreography battle-choreography--legible kind-${effect.kind} intensity-${intensity} ${impact ? 'is-impact' : 'is-winding-up'} ${replaying ? 'is-replay' : ''}`}
    data-mary-landing={effect.source?.after?.maryElephant && !effect.source?.before ? true : undefined}
    data-testid="character-attack" data-character={card.id} data-owner={effect.owner} data-impact={impact}
    style={{ '--attack-color': cardEntryAccent(card), '--defeat-delay': `${effect.defeatContactMs ?? Math.max(DEFEAT_CONTACT_MS, move?.durationMs ?? 0)}ms` } as React.CSSProperties} aria-hidden="true">
    {move && <div className="battle-special-move" data-geo="special" data-move-id={move.id} style={hidden}><SpecialMove clip={move} audioEnabled={audioEnabled} speed={speed} /></div>}
    {card.id === 'dr-fade' && effect.type === 'ability' && !effect.abilityMetadata?.upgradeId
      && <DrFadeEntrance key={effect.sequence} cueId={effect.sequence} speed={speed}
        squabble={!!effect.source?.after && effect.source.after.powerModifier >= effect.source.after.basePower} />}
    {showCaption && showPortrait && card.id !== 'dr-fade' && <div className="attack-caption">
      <img className="attack-caption__scene" src={getCardWallpaper(card.type)} alt="" />
      <img className="attack-caption__fighter" src={battlePortraitUrl(getCardImage(effect.source?.after?.maryElephant ? 'ms-mary-mack-elephant' : getCardArtworkId({ ...card, cardId: effect.source?.after?.cardId ?? effect.cardId })))} alt="" />
      <div className="attack-caption__copy"><span>{intensity === 'squabble' ? 'SQUABBLE · DOUBLE HANDS' : card.name}</span>
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
        </g>;
      })}
    </svg>
    {impact && effect.kind === 'blocked' && targetIds.map(id => <div key={id} className="attack-hit-shell" data-impact-target={id} style={hidden}>
      <svg className="attack-hit" width="100%" height="100%"><path className="attack-shield" /></svg>
    </div>)}
    {impact && changes.map(change => {
      const id = change.cardInstanceId;
      const moved = change.before?.lane !== change.after?.lane && change.before && change.after;
      const neutralDeparture = isNeutralDeparture(change);
      const destroyed = !!change.before && !change.after && !neutralDeparture;
      const thawed = !!change.after && change.before?.statuses.frozen && !change.after.statuses.frozen;
      const shieldSpent = !!change.after && change.before?.statuses.protected && !change.after.statuses.protected;
      const restored = !!change.after && change.before?.statuses.silenced && !change.after.statuses.silenced;
      // Ongoing aura shifts affect score, but are not a hit or damage animation.
      const permanentEnemyHit = !!change.before && !!change.after
        && change.owner !== effect.owner
        && change.after.powerModifier < change.before.powerModifier;
      const burnDamage = !!change.before && !!change.after
        && change.before.statuses.burnStacks > change.after.statuses.burnStacks
        && change.after.lastEffectNote.startsWith('BURN:')
        && change.after.basePower + change.after.powerModifier < change.before.basePower + change.before.powerModifier;
      const powerLost = destroyed || permanentEnemyHit || burnDamage;
      const showContact = powerLost || burnTargets.has(id);
      const powerGained = change.permanentDelta > 0;
      return <React.Fragment key={id}>
        {neutralDeparture && <img className="attack-moving-card" data-testid="neutral-departure" src={battlePortraitUrl(getCardImage((change.after ?? change.before)?.maryElephant ? 'ms-mary-mack-elephant' : cards[change.cardId]?.id ?? change.cardId))} alt="" data-geo-change={id} data-geo-role="moved" style={hidden} />}
        {destroyed && <div className={`attack-destroyed-card ${useDefeatAtlas ? 'has-tombstone' : 'has-defeat-fallback'}`} data-defeat-media={defeatMedia.current} data-testid="destroyed-card" data-geo-change={id} data-geo-role="box" style={hidden}><img className="defeated-portrait" src={battlePortraitUrl(getCardImage((change.after ?? change.before)?.maryElephant ? 'ms-mary-mack-elephant' : cards[change.cardId]?.id ?? change.cardId))} alt="" />{useDefeatAtlas ? <span className="defeat-tombstone" data-defeat-playback="once" /> : <span className="defeat-fallback-final" data-defeat-playback="once">KO</span>}</div>}
        {(showContact || powerGained) && <div className="attack-material" data-geo-change={id} data-geo-role="box" style={hidden}><span className={destroyed ? useDefeatAtlas ? "attack-contact-media is-finisher" : undefined : showContact ? "attack-contact-media" : undefined}>{destroyed && !useDefeatAtlas ? <BattleBurst kind="burn" /> : !showContact && <BattleBurst kind="charge" />}</span></div>}
        {(thawed || shieldSpent || restored) && <div data-testid="status-release" className={'status-release ' + (thawed ? 'is-thawing is-unlocking' : shieldSpent ? 'is-shattering' : 'is-restoring is-unlocking')} data-geo-change={id} data-geo-role="box" style={hidden}>{thawed || restored ? <><CombatSprite asset="lock-chain-strand" className="unlock-chain" /><CombatSprite asset="lock-chain-strand" className="unlock-chain" /><CombatSprite asset="lock-padlock" className="unlock-padlock" />{thawed && <CombatSprite asset="freeze-rim" className="unlock-ice" />}</> : Array.from({length:6},(_,index)=><i key={index} style={{'--shard-angle':index*60+'deg'} as React.CSSProperties}/>)}</div>}
        {moved && <>
          <div className="attack-movement-dust is-departure" data-geo-change={id} data-geo-role="departure" style={hidden}><BattleFxImage kind="movement-dust" /></div>
          <div className="attack-movement-dust" data-geo-change={id} data-geo-role="box" style={hidden}><BattleFxImage kind="movement-dust" /></div>
          <img className="attack-moving-card" src={battlePortraitUrl(getCardImage((change.after ?? change.before)?.maryElephant ? 'ms-mary-mack-elephant' : cards[change.cardId]?.id ?? change.cardId))} alt="" data-geo-change={id} data-geo-role="moved" style={hidden} />
        </>}
        {((change.permanentDelta !== 0 && !neutralDeparture) || change.labels.length > 0) && <div data-testid="battle-power-change" className={`attack-delta ${neutralDeparture ? '' : change.delta < 0 ? 'is-loss' : 'is-gain'}`} data-geo-change={id} data-geo-role="delta" style={neutralDeparture ? { ...hidden, color: '#e5e7eb' } : hidden}>
          {change.delta !== 0 && !neutralDeparture && <strong>{change.delta > 0 ? '+' : '−'}{Math.abs(change.delta)}</strong>}
          {change.labels.map(label => <span key={label}>{label}</span>)}
        </div>}
      </React.Fragment>;
    })}
  </div>;
}
