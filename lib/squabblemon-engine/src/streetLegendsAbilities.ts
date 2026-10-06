import type { CardInstance, CharacterDistrictMark, Lane, Match, Owner } from './gameEngine';
import type { CreativeMark, CreativeTools } from './creativeReworks';
import { streetLegendsCards } from './streetLegendsWave';

export type StreetLegendsTools = CreativeTools & {
  buff(m: Match, id: string, amount: number, copiedGain?: boolean): Match;
  hostile(m: Match, source: CardInstance, target: CardInstance, apply: (m: Match, actual: CardInstance) => Match): Match;
  damage(m: Match, target: CardInstance, amount: number, note: string): Match;
  unlock(m: Match, id: string): Match;
  maryLand(m: Match, card: CardInstance, lane: Lane): Match;
  maryEvent(before: Match, after: Match, source: CardInstance, targets: string[], note: string, landing?: boolean): Match;
};
type StreetMark = CreativeMark & { kind: `sl-${string}` };
const lanes: Lane[] = [0, 1, 2];
const identity = (c: CardInstance) => c.copiedAbilityCardId ?? c.cardId;
const active = (c: CardInstance | undefined): c is CardInstance => !!c && !c.statuses.silenced && !c.statuses.frozen && !c.statuses.weakened;
const board = (m: Match) => m.boards.flat().filter(c => !c.hazard && (c.kind ?? 'character') === 'character');
const find = (m: Match, id: string) => board(m).find(c => c.instanceId === id);
const marks = (m: Match): StreetMark[] => (m.creativeMarks ?? []).filter((x): x is StreetMark => x.kind.startsWith('sl-') && x.expires >= m.round);
const remove = (m: Match, id: string): Match => ({ ...m, creativeMarks: (m.creativeMarks ?? []).filter(x => x.id !== id) });
const replace = (m: Match, mark: StreetMark, scope: 'owner' | 'lane' | 'target' = 'owner'): Match => ({ ...m, creativeMarks: [...(m.creativeMarks ?? []).filter(x => !(x.kind === mark.kind && x.owner === mark.owner && (scope === 'owner' || (scope === 'lane' && x.lane === mark.lane) || (scope === 'target' && x.targets.some(id => mark.targets.includes(id)))))), mark] });
const sorted = (cs: CardInstance[], t: CreativeTools, strong = false) => [...cs].sort((a, b) => (strong ? -1 : 1) * (t.power(a) - t.power(b)) || a.instanceId.localeCompare(b.instanceId));
const allies = (m: Match, s: CardInstance, local = true) => board(m).filter(c => c.owner === s.owner && c.instanceId !== s.instanceId && (!local || c.lane === s.lane));
const enemies = (m: Match, s: CardInstance, local = true) => board(m).filter(c => c.owner !== s.owner && (!local || c.lane === s.lane));
const open = (m: Match, c: CardInstance, t: CreativeTools) => lanes.filter(l => t.canMove(m, c, l) && m.boards[l].filter(x => !x.hazard && x.owner === c.owner).length < 4).sort((a, b) => t.score(m, c.owner, a) - t.score(m, c.owner, b) || a - b);
const ledger = (m: Match, owner: Owner, key: string) => marks(m).find(x => x.id === `sl-ledger:${owner}:${key}`);
const once = (m: Match, s: CardInstance, key: string): Match => replace(m, { id: `sl-ledger:${s.owner}:${key}`, kind: `sl-ledger-${key}`, source: s, owner: s.owner, lane: s.lane!, targets: [], expires: 99, amount: 1 });
const used = (m: Match, s: CardInstance, key: string) => !!ledger(m, s.owner, `${key}:${s.instanceId}`);
const use = (m: Match, s: CardInstance, key: string) => once(m, s, `${key}:${s.instanceId}`);
const mark = (s: CardInstance, kind: StreetMark['kind'], m: Match, targets: string[] = [], lane: Lane = s.lane!): StreetMark => ({ id: `${kind}:${s.owner}:${s.instanceId}:${lane}`, kind, source: s, owner: s.owner, lane, targets, expires: m.round + 1 });
const meaningful = (before: Match, after: Match) => {
  const state = (m: Match) => board(m).map(c => {
    const old = find(before, c.instanceId), now = find(after, c.instanceId);
    const spentProtection = old?.statuses.protected && now && !now.statuses.protected;
    return [c.instanceId, c.lane, c.powerModifier, { ...c.statuses, blocked: false, protected: spentProtection ? false : c.statuses.protected }];
  });
  return JSON.stringify(state(before)) !== JSON.stringify(state(after)) || marks(after).some(x => !x.kind.startsWith('sl-ledger-') && !marks(before).some(old => JSON.stringify(old) === JSON.stringify(x)));
};

export function streetLegendsReveal(m: Match, s: CardInstance, t: StreetLegendsTools, echoed = false): Match | null {
  if (!Object.hasOwn(streetLegendsCards, identity(s))) return null;
  const before = m, id = identity(s), targets: string[] = [];
  let detail = 'No eligible target or legal route.';
  const add = (c: CardInstance, amount: number) => { targets.push(c.instanceId); m = t.buff(m, c.instanceId, amount); };
  if (id === 'boo-boo-the-fool') {
    if (!used(m, s, 'decoy')) { m = replace(use(m, s, 'decoy'), mark(s, 'sl-decoy', m)); detail = 'A public Decoy waits here through next round.'; }
    else detail = 'This Boo Boo already booked his one Decoy.';
  } else if (id === 'mr-mc-hands') {
    for (const candidate of sorted(enemies(m, s), t, true).slice(0, 2)) { const live = find(m, candidate.instanceId); if (live) { targets.push(live.instanceId); m = t.hit(m, s, live, -2, 'All These Hands: 2 damage.'); } }
    detail = targets.length ? `Rapid strikes targeted ${targets.length} different enemies; defenses apply.` : detail;
  } else if (id === 'lash-tech') {
    const target = sorted(enemies(m, s), t, true)[0];
    let landed = false;
    if (target) {
      targets.push(target.instanceId);
      m = t.hostile(m, s, target, (state, actual) => {
        const result = t.damage(state, actual, 1, 'Lash Out: 1 damage.');
        const survivor = find(result, actual.instanceId);
        landed = !survivor || survivor.powerModifier < actual.powerModifier;
        return result;
      });
      if (landed) {
        const client = sorted(allies(m, s), t)[0];
        if (client) add(client, 2);
        detail = 'A real hit landed; the weakest other local ally receives +2 Hands.';
      } else detail = 'The hit was blocked or fully absorbed; no ally boost.';
    }
  } else if (id === 'ms-mary-mack') {
    detail = 'At round end, collect 3¢ per enemy card toward 15¢; no immediate slam.';
  } else if (id === 'pimp-swookie') {
    const target = sorted(enemies(m, s), t, true)[0];
    if (target) { targets.push(target.instanceId); m = t.hostile(m, s, target, (state, actual) => { const changed = t.modify(state, actual.instanceId, c => ({ ...c, statuses: { ...c.statuses, weakened: true }, lastEffectNote: 'Say the Whole Name: Weakened; next gain reduced by up to 2.' })); return replace(t.disruption(state, changed, s, actual.instanceId), mark(s, 'sl-name-check', state, [actual.instanceId], actual.lane!)); }); detail = 'Weaken and one next-gain Name Check targeted the strongest enemy.'; }
  } else if (id === 'og-uncle-harley-davidson' || id === 'gas-station-window-wiper') {
    const destination = open(m, s, t)[0];
    if (destination !== undefined) { m = t.move(m, s, destination, s.ability + ': taking the open road.'); const arrived = find(m, s.instanceId); if (arrived?.lane === destination) {
      targets.push(s.instanceId); detail = 'A real arrival completed.';
      if (id === 'og-uncle-harley-davidson') { add(arrived, 1); const guest = sorted(allies(m, arrived), t)[0]; if (guest) add(guest, 2); }
      else { const foe = sorted(enemies(m, arrived), t, true)[0]; if (foe) { targets.push(foe.instanceId); m = t.hit(m, arrived, foe, -1, "You Ain't Ask: 1 damage after arrival."); } }
    } }
  } else if (id === 'suga-mama') {
    const target = sorted(allies(m, s, false), t)[0];
    if (target) { add(target, 2); m = t.cleanse(m, target.instanceId); const client = find(m, target.instanceId); if (client && t.score(m, client.owner, client.lane!) < t.score(m, client.owner === 'player' ? 'cpu' : 'player', client.lane!)) m = t.protect(m, s, client.instanceId); detail = 'The weakest ally received +2 and Cleanse; a trailing client receives Protection.'; }
  } else if (id === 'side-chick') {
    const baby = sorted(enemies(m, s, false).filter(c => c.cardId === 'baby'), t, true)[0];
    const target = baby ?? sorted(enemies(m, s), t, true)[0];
    if (target) { targets.push(target.instanceId); if (baby) m = t.hostile(m, s, baby, (state, actual) => { let result = t.damage(state, actual, 3, 'Not Your Family: 3 damage.'); const survivor = find(result, actual.instanceId); if (survivor) result = t.disruption(result, t.modify(result, survivor.instanceId, c => ({ ...c, statuses: { ...c.statuses, weakened: true }, lastEffectNote: 'Not Your Family: Weakened.' })), s, survivor.instanceId); return result; }); else m = t.hit(m, s, target, -1, 'Not Your Family: no enemy Baby Momma; 1 damage.'); detail = baby ? 'Enemy Baby Momma targeted for 3 and Weaken in one defended package.' : 'No enemy Baby Momma; strongest local enemy targeted for 1.'; }
  } else if (id === 'parole-officer') {
    const target = sorted(enemies(m, s), t, true)[0];
    if (target) { targets.push(target.instanceId); m = t.hostile(m, s, target, (state, actual) => replace(state, mark(s, 'sl-curfew', state, [actual.instanceId], actual.lane!), 'target')); }
    m = replace(m, mark(s, 'sl-check-in', m), 'lane'); detail = 'Public Check-In watches actual movement here; targeted Curfew lasts through next round.';
  } else if (id === 'work-hubby') {
    const target = sorted(allies(m, s), t)[0];
    if (target && !used(m, s, 'lunch')) { targets.push(target.instanceId); m = t.protect(m, s, target.instanceId); m = replace(use(m, s, 'lunch'), mark(s, 'sl-lunch', m, [target.instanceId])); detail = 'Protection and one next-gain Lunch Bond issued.'; }
  } else if (id === 'he-just-a-friend') {
    const target = sorted(enemies(m, s), t, true)[0];
    if (target && t.power(target) > t.power(s)) { const destination = open(m, target, t)[0]; if (destination !== undefined) { targets.push(target.instanceId); m = t.enemyMove(m, s, target, destination); if (find(m, target.instanceId)?.lane === destination) { add(s, 2); detail = 'The stronger rival arrived elsewhere; gained +2 Hands.'; } } }
    else { const ally = sorted(allies(m, s), t)[0]; if (ally) { targets.push(ally.instanceId); m = t.protect(m, s, ally.instanceId); detail = 'No stronger local rival; Protection given to the weakest ally.'; } }
  } else if (id === 'crazy-ex-boyfriend') {
    if (m.round >= t.roundLimit(m)) { const foe = sorted(enemies(m, s), t, true)[0]; if (foe) { targets.push(foe.instanceId); m = t.hit(m, s, foe, -2, 'You Up?: final-round 2 damage.'); detail = 'Final-round message targeted the strongest local enemy.'; } }
    else { const target = sorted(enemies(m, s, false), t, true)[0]; if (target && !used(m, s, 'chase')) { m = replace(use(m, s, 'chase'), mark(s, 'sl-chase', m, [target.instanceId], target.lane!)); targets.push(target.instanceId); detail = 'One public chase booked for next round start.'; } }
  } else if (id === 'uncle-sam') {
    const eligible = enemies(m, s).filter(c => c.powerModifier > 0).sort((a, b) => b.powerModifier - a.powerModifier || a.instanceId.localeCompare(b.instanceId));
    const target = eligible[0];
    if (target) { targets.push(target.instanceId); const prior = target.powerModifier; m = t.trim(m, s, target, 3); const current = find(m, target.instanceId); const taken = current ? Math.max(0, Math.min(3, prior - current.powerModifier)) : 0; if (taken) add(s, taken); detail = `Confiscated ${taken} actual removable bonus Hands.`; }
    else { m = replace(m, mark(s, 'sl-audit', m)); detail = 'No removable local bonus; one public +1 Motion Audit posted.'; }
  } else if (id === 'apartment-maintenance-sage') {
    const client = sorted(allies(m, s), t)[0];
    if (client) { targets.push(client.instanceId); m = t.unlock(t.cleanse(m, client.instanceId), client.instanceId); const live = find(m, client.instanceId); const destination = live && open(m, live, t)[0]; if (live && destination !== undefined) { m = t.move(m, live, destination, 'I GOT A KEY FOR THAT: route reopened.'); if (find(m, live.instanceId)?.lane === destination) m = t.protect(m, s, live.instanceId); } detail = 'The client was cleansed and its timed movement restriction removed; a real arrival earns Protection.'; }
  } else if (id === 'bail-bonds-auntie') {
    const client = sorted(allies(m, s), t)[0];
    if (client && !used(m, s, 'bail')) { targets.push(client.instanceId); m = replace(use(m, s, 'bail'), mark(s, 'sl-bail', m, [client.instanceId])); detail = 'One Bail Bond protects a client by redirecting the next targeted ability.'; }
  }
  const succeeded = meaningful(before, m) && id !== 'ms-mary-mack';
  if (!echoed && id !== 'ms-mary-mack') m = t.modify(m, s.instanceId, c => ({ ...c, creativeEntranceSucceeded: succeeded }));
  m = t.event(before, m, s, targets, `${s.ability}: ${detail}`);
  return !echoed && succeeded ? t.train(m, s.instanceId) : m;
}

/** Withheld growth never becomes damage, a heal debt, or an on-hit trigger. */
export function streetLegendsPreventGain(m: Match, target: CardInstance, amount: number): { match: Match; amount: number } {
  const check = marks(m).find(x => x.kind === 'sl-name-check' && x.owner !== target.owner && x.targets.includes(target.instanceId));
  return check ? { match: remove(m, check.id), amount: Math.max(0, amount - 2) } : { match: m, amount };
}

export function streetLegendsGain(before: Match, m: Match, target: CardInstance, t: StreetLegendsTools, copied = false): Match {
  if (copied || !marks(m).some(x => x.kind === 'sl-lunch')
    || !find(m, target.instanceId) || find(m, target.instanceId)!.powerModifier <= target.powerModifier) return m;
  for (const bond of marks(m).filter(x => x.kind === 'sl-lunch' && x.targets.includes(target.instanceId))) {
    const hubby = find(m, bond.source.instanceId); if (!active(hubby)) continue;
    const start = m; m = remove(m, bond.id); m = t.buff(m, hubby.instanceId, 1, true); m = t.train(m, hubby.instanceId);
    m = t.event(start, m, hubby, [hubby.instanceId], 'Lunch Break Loyalty: the client grew; Work Hubby gained +1 Hand.');
  }
  return m;
}

function arrival(m: Match, id: string, moved: boolean, t: StreetLegendsTools): Match {
  if (!marks(m).some(x => x.kind === 'sl-decoy' || (moved && x.kind === 'sl-check-in'))) return m;
  const entrant = find(m, id); if (!entrant) return m;
  for (const watch of marks(m).filter(x => x.owner !== entrant.owner && x.lane === entrant.lane && (x.kind === 'sl-decoy' || (moved && x.kind === 'sl-check-in' && x.usedRound !== m.round)))) {
    const live = find(m, id); if (!live) break;
    const start = m;
    m = watch.kind === 'sl-decoy' ? remove(m, watch.id) : { ...m, creativeMarks: (m.creativeMarks ?? []).map(x => x.id === watch.id ? { ...x, usedRound: m.round } : x) };
    const prior = live.powerModifier;
    m = t.hit(m, watch.source, live, watch.kind === 'sl-decoy' ? -1 : -2, watch.kind === 'sl-decoy' ? 'Wrong Address: Decoy dealt 1.' : 'Violation: Check-In dealt 2 after movement.');
    const current = find(m, id); const landed = !current || current.powerModifier < prior;
    const source = find(m, watch.source.instanceId);
    if (landed && active(source)) {
      if (watch.kind === 'sl-decoy') { const destination = open(m, source, t)[0]; if (destination !== undefined) { m = t.move(m, source, destination, 'Wrong Address: fooled you; escaping.'); if (find(m, source.instanceId)?.lane === destination) m = t.buff(m, source.instanceId, 1); } }
      m = t.train(m, source.instanceId);
    }
    m = t.event(start, m, watch.source, [id, ...(source ? [source.instanceId] : [])], watch.kind === 'sl-decoy' ? 'Wrong Address: one Decoy spent; a real hit can fund Boo Boo’s escape.' : 'Violation: this district’s first enemy movement checked this round.');
  }
  return m;
}
export const streetLegendsMoved = (_before: Match, m: Match, id: string, t: StreetLegendsTools) => arrival(m, id, true, t);
export const streetLegendsArrival = (m: Match, id: string, t: StreetLegendsTools) => arrival(m, id, false, t);
export function streetLegendsAfterPlay(_before: Match, m: Match, id: string, t: StreetLegendsTools, entranceSucceeded = false): Match {
  const entrant = find(m, id); if (!entrant) return m;
  const credit = marks(m).find(x => x.kind === 'sl-bail-credit' && x.owner === entrant.owner && entrant.type === 'Poison' && entrant.lane !== x.lane);
  if (!credit) return m;
  const start = m; m = remove(m, credit.id);
  if (entranceSucceeded) { m = t.refund(m, entrant.owner, 1); const auntie = find(m, credit.source.instanceId); if (active(auntie)) m = t.train(m, auntie.instanceId); }
  return t.event(start, m, credit.source, [id], entranceSucceeded ? 'Sign Here: a successful cross-district Poison entrance refunded 1 Motion.' : 'Sign Here: credit spent on an unsuccessful entrance; no refund.');
}
export function streetLegendsRoundStart(m: Match, t: StreetLegendsTools): Match {
  for (const chase of marks(m).filter(x => x.kind === 'sl-chase' && m.round > (x.source.playedRound ?? m.round))) {
    const start = m; m = remove(m, chase.id);
    const source = find(m, chase.source.instanceId), victim = find(m, chase.targets[0]);
    if (active(source) && victim) { if (source.lane !== victim.lane && open(m, source, t).includes(victim.lane!)) m = t.move(m, source, victim.lane!, 'You Up?: arrived for the one booked chase.'); const arrived = find(m, source.instanceId), target = find(m, victim.instanceId); if (active(arrived) && target && arrived.lane === target.lane) { m = t.hit(m, arrived, target, -2, 'You Up?: 2 damage after arrival.'); if (meaningful(start, m)) m = t.train(m, arrived.instanceId); } }
    m = t.event(start, m, chase.source, chase.targets, 'You Up?: the one booked chase resolved; failed arrivals do not hit.');
  }
  return { ...m, creativeMarks: (m.creativeMarks ?? []).filter(x => !x.kind.startsWith('sl-') || x.expires >= m.round) };
}
export function streetLegendsCanMove(m: Match, id: string): boolean { return !marks(m).some(x => x.kind === 'sl-curfew' && x.targets.includes(id)); }
export function streetLegendsCleansed(m: Match, id: string): Match { return { ...m, creativeMarks: (m.creativeMarks ?? []).filter(x => !((x.kind === 'sl-curfew' || x.kind === 'sl-name-check') && x.targets.includes(id))) }; }
export function streetLegendsTax(m: Match, owner: Owner, lane: Lane, card: CardInstance): number { return !card.hazard && (card.kind ?? 'character') === 'character' && marks(m).some(x => x.kind === 'sl-audit' && x.owner !== owner && x.lane === lane) ? 1 : 0; }
export function streetLegendsPaidAudit(m: Match, owner: Owner, lane: Lane, card: CardInstance): Match { return streetLegendsTax(m, owner, lane, card) ? { ...m, creativeMarks: (m.creativeMarks ?? []).filter(x => !(x.kind === 'sl-audit' && x.owner !== owner && x.lane === lane && x.expires >= m.round)) } : m; }
export function streetLegendsIntercept(m: Match, target: CardInstance): { match: Match; interceptor?: CardInstance } {
  const bond = marks(m).find(x => x.kind === 'sl-bail' && x.owner === target.owner && x.targets.includes(target.instanceId) && x.source.instanceId !== target.instanceId && active(find(m, x.source.instanceId)));
  if (!bond) return { match: m };
  return { match: remove(m, bond.id), interceptor: find(m, bond.source.instanceId) };
}
export function streetLegendsFinishIntercept(before: Match, m: Match, auntie: CardInstance, t: StreetLegendsTools): Match {
  const current = find(m, auntie.instanceId);
  const harmful = !current || current.powerModifier < auntie.powerModifier || (['locked', 'frozen', 'weakened', 'silenced'] as const).some(k => !auntie.statuses[k] && current.statuses[k]) || current.statuses.burnStacks > auntie.statuses.burnStacks || !!current && streetLegendsCanMove(before, auntie.instanceId) && !streetLegendsCanMove(m, auntie.instanceId);
  if (harmful) m = replace(m, mark(auntie, 'sl-bail-credit', m));
  return t.event(before, m, auntie, [auntie.instanceId], harmful ? 'Sign Here: Auntie took the hostile ability; one cross-district Poison credit armed.' : 'Sign Here: redirected ability was blocked; no credit armed.');
}
export function streetLegendsDistrictMarks(m: Match): CharacterDistrictMark[] {
  const labels: Record<string, string> = { 'sl-decoy': 'Decoy · next enemy arrival: 1 damage', 'sl-name-check': 'Name Check · next Hands gain reduced by up to 2', 'sl-curfew': 'Curfew · target cannot move', 'sl-check-in': 'Check-In · first enemy movement here each round: 2 damage', 'sl-lunch': 'Lunch Bond · next client gain rewards Work Hubby', 'sl-chase': 'You Up? · one chase at next round start', 'sl-audit': 'Audit · next enemy character here: +1 Motion', 'sl-bail': 'Bail Bond · next targeted ability redirected to Auntie', 'sl-bail-credit': 'Bond credit · next Poison in another district: successful entrance refunds 1 Motion' };
  const maryMarks: CharacterDistrictMark[] = marks(m).filter(x => x.kind === 'sl-mary-return').map(x => ({ owner: x.owner, lane: x.lane, artworkId: x.source.id, text: `15¢ · elephant landing from R${x.amount}` }));
  return [...maryMarks, ...marks(m).filter(x => labels[x.kind]).map(x => ({ owner: x.owner, lane: x.lane, artworkId: x.source.id, text: `${labels[x.kind]}${x.kind === 'sl-check-in' && x.usedRound === m.round ? ' · spent this round' : ''} · through R${x.expires}` }))];
}
