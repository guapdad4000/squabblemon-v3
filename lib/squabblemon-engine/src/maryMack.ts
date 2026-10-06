import type { CardInstance, Lane, Match, Owner } from './gameEngine';
import type { CreativeMark } from './creativeReworks';
import type { StreetLegendsTools } from './streetLegendsAbilities';

type MaryReturn = CreativeMark & { kind: 'sl-mary-return'; shieldExpiresAtRound?: number };
const lanes: Lane[] = [0, 1, 2];
const mary = (c: CardInstance) => (c.copiedAbilityCardId ?? c.cardId) === 'ms-mary-mack';
const active = (c: CardInstance) => !c.statuses.silenced && !c.statuses.frozen && !c.statuses.weakened;
const find = (m: Match, id: string) => m.boards.flat().find(c => c.instanceId === id);

/** Count the settled board once, so simultaneous Marys see the same enemy census. */
export function maryMackRoundEnd(m: Match, t: StreetLegendsTools): Match {
  const sources = m.boards.flat().filter(c => mary(c) && !c.hazard && !c.maryElephant && !c.maryTransformUsed
    && c.maryCollectionRound !== m.round && active(c));
  if (!sources.length) return m;
  const count: Record<Owner, number> = { player: 0, cpu: 0 };
  for (const cs of m.boards) for (const c of cs) if (!c.hazard) count[c.owner]++;
  for (const initial of sources) {
    const source = find(m, initial.instanceId);
    if (!source || !active(source)) continue;
    const before = m, previous = source.maryCents ?? 0;
    const cents = Math.min(15, previous + count[source.owner === 'player' ? 'cpu' : 'player'] * 3);
    m = t.modify(m, source.instanceId, c => ({ ...c, maryCents: cents, maryCollectionRound: m.round,
      lastEffectNote: `15 Cents: ${cents}¢ / 15¢.` }));
    if (cents > previous) m = t.train(m, source.instanceId);
    const charged = find(m, source.instanceId)!;
    const canReturn = cents === 15 && m.round < t.roundLimit(m);
    if (canReturn) {
      const mark: MaryReturn = { id: `sl-mary-return:${source.instanceId}`, kind: 'sl-mary-return',
        owner: source.owner, lane: source.lane!, source: { ...charged, maryTransformUsed: true },
        targets: [], amount: m.round + 1, expires: 99,
        shieldExpiresAtRound: m.timedEffects.filter(e => (e.targetInstanceId === source.instanceId || (e.kind === 'wifey-protection' && e.sourceInstanceId === source.instanceId)) && ['church-protection', 'salon-protection', 'wifey-protection'].includes(e.kind)).reduce((end, e) => Math.max(end, e.expiresAtRound), 0) || undefined };
      m = { ...m, boards: m.boards.map(cs => cs.filter(c => c.instanceId !== source.instanceId)) as Match['boards'],
        creativeMarks: [...(m.creativeMarks ?? []), mark] };
    }
    if (cents > previous || canReturn) m = t.maryEvent(before, m, source, [],
      `15 Cents: collected ${cents - previous}¢ (${cents}¢ / 15¢).${canReturn ? ` Disappeared; elephant returns in round ${m.round + 1}.` : cents === 15 ? ' Final round: Mary stays to score.' : ''}`);
  }
  return m;
}

/** A delayed form arrival is neither a paid play nor a move; location locks cannot stop it. */
export function maryMackRoundStart(m: Match, t: StreetLegendsTools): Match {
  const pending = (m.creativeMarks ?? []).filter((mark): mark is MaryReturn => mark.kind === 'sl-mary-return' && (mark.amount ?? Infinity) <= m.round);
  for (const mark of pending) {
    const destination = lanes.filter(lane => m.boards[lane].filter(c => !c.hazard && c.owner === mark.owner).length < 4)
      .sort((a, b) => t.score(m, mark.owner, a) - t.score(m, mark.owner, b) || a - b)[0];
    if (destination === undefined) continue; // Keep her pending rather than discard her or overfill a lane.
    const before = m;
    const source: CardInstance = { ...mark.source, lane: destination, cost: 4, power: 4,
      basePower: mark.source.basePower + 1, maryCents: 15, maryElephant: true, maryTransformUsed: true,
      moved: false, statuses: { ...mark.source.statuses, blocked: false,
        protected: mark.source.statuses.protected && !(mark.shieldExpiresAtRound !== undefined && mark.shieldExpiresAtRound <= m.round) }, lastEffectNote: '15 Cents: elephant landed; all enemies here lose 1 Hand.' };
    m = { ...m, creativeMarks: (m.creativeMarks ?? []).filter(x => x.id !== mark.id) };
    m = t.maryLand(m, source, destination);
    const targets: string[] = [];
    for (const target of [...m.boards[destination]].filter(c => !c.hazard && c.owner !== mark.owner)) {
      const landed = find(m, source.instanceId), victim = find(m, target.instanceId);
      if (!landed || !active(landed)) break;
      if (victim) { targets.push(victim.instanceId); m = t.hit(m, landed, victim, -1, '15 Cents: elephant slam, −1 Hand.'); }
    }
    m = t.maryEvent(before, m, source, targets, '15 Cents: elephant returned at 4 Motion / 4 Hands, keeping invested Hands. Location locks bypassed; each enemy here targeted for −1 Hand.', true);
  }
  return m;
}
