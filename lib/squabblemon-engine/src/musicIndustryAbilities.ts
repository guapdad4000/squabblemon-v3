import type { CardInstance, CharacterDistrictMark, Lane, Match, Owner } from './gameEngine';
import type { CreativeMark, CreativeTools } from './creativeReworks';
import { FITNESS_CHARACTER_IDS, MUSIC_CHARACTER_IDS, musicIndustryWaveCards } from './musicIndustryWave';

export type MusicTools = CreativeTools & {
  returnAlly(m: Match, source: CardInstance, target: CardInstance): Match;
  echo(m: Match, source: CardInstance): Match;
  buff?(m: Match, id: string, amount: number, copiedGain?: boolean): Match;
  laneOpen(m: Match, owner: Owner, lane: Lane): boolean;
  removeBonus?(m: Match, target: CardInstance, amount: number): Match;
};
export type MusicEntranceOutcome = 'resolved' | 'cancelled' | 'delayed' | 'none';
const lanes: Lane[] = [0, 1, 2];
const musicIds = new Set(MUSIC_CHARACTER_IDS);
const fitnessIds = new Set(FITNESS_CHARACTER_IDS);
const identity = (c: CardInstance) => c.copiedAbilityCardId ?? c.cardId;
const character = (c: CardInstance) => !c.hazard && (c.kind ?? 'character') === 'character';
export const isMusicCharacter = (c: CardInstance) => character(c) && musicIds.has(c.cardId);
export const isFitnessCharacter = (c: CardInstance) => character(c) && fitnessIds.has(c.cardId);
const board = (m: Match) => m.boards.flat().filter(character);
const find = (m: Match, id: string) => board(m).find(c => c.instanceId === id);
const active = (c?: CardInstance): c is CardInstance => !!c && !c.statuses.silenced && !c.statuses.frozen && !c.statuses.weakened;
const musical = (m: Match, s: CardInstance, local = false) => board(m).filter(c => c.owner === s.owner && c.instanceId !== s.instanceId && isMusicCharacter(c) && (!local || c.lane === s.lane));
const otherAllies = (m: Match, s: CardInstance, local = true) => board(m).filter(c => c.owner === s.owner && c.instanceId !== s.instanceId && (!local || c.lane === s.lane));
const enemies = (m: Match, s: CardInstance, lane = s.lane) => board(m).filter(c => c.owner !== s.owner && c.lane === lane);
const sorted = (cs: CardInstance[], t: MusicTools, high = false) => [...cs].sort((a, b) => (high ? -1 : 1) * (t.power(a) - t.power(b)) || a.instanceId.localeCompare(b.instanceId));
const marks = (m: Match, kind?: string) => (m.creativeMarks ?? []).filter(x => x.kind.startsWith('mi-') && x.expires >= m.round && (!kind || x.kind === `mi-${kind}`));
const remove = (m: Match, id: string): Match => ({ ...m, creativeMarks: (m.creativeMarks ?? []).filter(x => x.id !== id) });
const update = (m: Match, id: string, patch: Partial<CreativeMark>): Match => ({ ...m, creativeMarks: (m.creativeMarks ?? []).map(x => x.id === id ? { ...x, ...patch } : x) });
const buff = (m: Match, id: string, n: number, t: MusicTools) => t.buff ? t.buff(m, id, n) : t.modify(m, id, c => ({ ...c, powerModifier: c.powerModifier + n }));
function put(m: Match, s: CardInstance, kind: string, targets: string[] = [], lane = s.lane ?? 0, patch: Partial<CreativeMark> = {}): Match {
  const k = `mi-${kind}`;
  return { ...m, creativeMarks: [...(m.creativeMarks ?? []).filter(x => !(x.kind === k && x.owner === s.owner)), { id: `${k}:${s.owner}:${s.instanceId}:${m.nextEventSequence}`, kind: k, source: s, owner: s.owner, lane, targets, expires: m.round + 1, ...patch }] };
}
const ledger = (m: Match, s: CardInstance, kit: string) => marks(m, `ledger-${kit}`).find(x => x.owner === s.owner);
function spend(m: Match, s: CardInstance, kit: string, patch: Partial<CreativeMark> = {}): Match {
  const old = ledger(m, s, kit);
  return put(m, s, `ledger-${kit}`, old?.targets ?? [], old?.lane ?? s.lane ?? 0, { ...old, expires: 99, ...patch });
}
const spentThisRound = (m: Match, s: CardInstance, kit: string) => ledger(m, s, kit)?.usedRound === m.round;
const hasSpent = (m: Match, s: CardInstance, kit: string) => !!ledger(m, s, kit);
const legalDistricts = (m: Match, s: CardInstance, t: MusicTools) => lanes.filter(l => l !== s.lane && t.canMove(m, s, l)).sort((a, b) => t.score(m, s.owner, a) - t.score(m, s.owner, b) || a - b);
function finish(before: Match, m: Match, s: CardInstance, t: MusicTools, succeeded: boolean, note: string, targets: string[] = [], echoed = false): Match {
  m = t.modify(m, s.instanceId, c => ({ ...c, ...(!echoed ? { creativeEntranceSucceeded: succeeded } : {}), lastEffectNote: succeeded ? note : `${s.ability}: did not take effect.` }));
  m = t.event(before, m, s, targets, succeeded ? note : `${s.ability}: did not take effect.`);
  return succeeded && !echoed ? t.train(m, s.instanceId) : m;
}
const mechanicalChange = (before: Match, after: Match) => {
  const oldBoard = board(before), newBoard = board(after);
  if (oldBoard.length !== newBoard.length || oldBoard.some(old => {
    const now = newBoard.find(c => c.instanceId === old.instanceId);
    if (!now || now.lane !== old.lane || now.powerModifier !== old.powerModifier) return true;
    return Object.keys(old.statuses).some(key => key === 'protected'
      ? !old.statuses.protected && now.statuses.protected
      : old.statuses[key as keyof typeof old.statuses] !== now.statuses[key as keyof typeof now.statuses]);
  })) return true;
  if (before.playerMotion !== after.playerMotion || before.cpuMotion !== after.cpuMotion) return true;
  if (JSON.stringify([before.playerHand.map(c => c.instanceId), before.cpuHand.map(c => c.instanceId)]) !== JSON.stringify([after.playerHand.map(c => c.instanceId), after.cpuHand.map(c => c.instanceId)])) return true;
  if (after.discountTokens.some(token => !before.discountTokens.some(old => old.id === token.id))) return true;
  const visible = (m: Match) => (m.creativeMarks ?? []).filter(x => !x.kind.includes('ledger')).map(x => JSON.stringify([x.kind, x.owner, x.lane, x.targets, x.expires, x.amount, x.origin, x.seen, x.pending, x.ready]));
  const oldMarks = visible(before);
  return visible(after).some(mark => !oldMarks.includes(mark));
};
const damaged = (before: Match, after: Match, victim: CardInstance, t: MusicTools) => {
  const current = find(after, victim.instanceId);
  if (!find(before, victim.instanceId)) return false;
  if (!current) return (after.laneDamage ?? []).some(x => x.instanceId === victim.instanceId && !(before.laneDamage ?? []).includes(x));
  return current.powerModifier < victim.powerModifier && t.power(current) < t.power(victim);
};

/** Entrance kits return null only when the source is outside this module. */
export function musicReveal(m: Match, s: CardInstance, t: MusicTools, echoed = false): Match | null {
  const id = identity(s);
  if (!musicIndustryWaveCards[id]) return null;
  const before = m;
  if (!active(s)) return finish(before, m, s, t, false, '');
  const targets: string[] = [];
  let succeeded = false;
  if (id === 'the-opening-act') {
    const destination = lanes.filter(l => l !== s.lane && t.laneOpen(m, s.owner, l)).sort((a,b) => t.score(m, s.owner, a) - t.score(m, s.owner, b) || a-b)[0];
    if (!hasSpent(m, s, 'soundcheck') && destination !== undefined) {
      m = put(m, s, 'soundcheck', [], destination);
      succeeded = true;
    }
  } else if (id === 'the-dj') {
    const target = sorted(musical(m, s, true).filter(c => c.cost <= 3 && !c.statuses.locked && !c.statuses.frozen && musicCanMove(m, c.instanceId)), t)[0];
    if (target && !hasSpent(m, s, 'spinback')) {
      const oldOrder = m.nextDiscountOrder;
      m = spend(m, s, 'spinback');
      m = t.returnAlly(m, s, target);
      succeeded = (s.owner === 'player' ? m.playerHand : m.cpuHand).some(c => c.instanceId === target.instanceId);
      if (succeeded) {
        m = { ...m, discountTokens: m.discountTokens.map(x => x.createdOrder >= oldOrder && x.targetInstanceId === target.instanceId ? { ...x, expiresAfterRound: m.round + 1 } : x) };
        targets.push(target.instanceId);
      } else m = remove(m, ledger(m, s, 'spinback')!.id);
    }
  } else if (id === 'the-hype-man') {
    const target = sorted(musical(m, s).filter(active), t)[0];
    if (target && target.lane !== null) { m = put(m, s, 'call', [target.instanceId], target.lane); targets.push(target.instanceId); succeeded = true; }
  } else if (id === 'the-manager-nice') {
    m = put(m, s, 'rider'); succeeded = true;
  } else if (id === 'the-janky-promoter') {
    const enemy: Owner = s.owner === 'player' ? 'cpu' : 'player';
    const destination = lanes.filter(l => l !== s.lane && t.laneOpen(m, enemy, l)).sort((a, b) => t.score(m, enemy, a) - t.score(m, enemy, b) || a - b)[0];
    if (destination !== undefined) { m = put(m, s, 'booking', [], destination); succeeded = true; }
  } else if (id === 'the-battle-rapper') {
    const target = sorted(enemies(m, s), t, true)[0];
    if (target) {
      const original = target.powerModifier;
      m = original > 0 ? t.trim(m, s, target, 2) : t.hit(m, s, target, -2, 'Diss Track');
      const actual = find(m, target.instanceId);
      succeeded = actual ? actual.powerModifier < original : damaged(before, m, target, t);
      if (succeeded && actual) {
        const existing = marks(m, 'diss').find(x => x.owner === s.owner && x.targets.includes(actual.instanceId));
        if (!existing) {
          const k = `mi-diss:${s.owner}:${actual.instanceId}`;
          m = { ...m, creativeMarks: [...(m.creativeMarks ?? []), { id: k, kind: 'mi-diss', source: s, owner: s.owner, lane: actual.lane!, targets: [actual.instanceId], expires: m.round + 1 }] };
        }
      }
      targets.push(target.instanceId);
    }
  } else if (id === 'the-manager-evil') {
    const signed = ledger(m, s, 'clients')?.targets ?? [];
    const target = sorted(musical(m, s, true).filter(c => !signed.includes(c.instanceId)), t, true)[0];
    if (target && !marks(m, 'contract').some(x => x.owner === s.owner)) {
      m = spend(m, s, 'clients', { targets: [...signed, target.instanceId] });
      m = put(m, s, 'contract', [target.instanceId], target.lane!);
      m = buff(m, target.instanceId, 3, t); targets.push(target.instanceId); succeeded = true;
    }
  } else if (id === 'the-og-rap-legend') {
    if (!hasSpent(m, s, 'torch')) {
      const historical = new Set(m.entranceHistory ?? []);
      const eligible = musical(m, s).filter(c => active(c) && c.cost <= 3 && c.effect.includes('On Reveal:') && historical.has(c.instanceId) && c.creativeEntranceSucceeded === true && !(identity(c) === 'the-dj' && hasSpent(m, s, 'spinback')) && !(identity(c) === 'the-opening-act' && hasSpent(m, s, 'soundcheck')));
      const apprentice = sorted(eligible, t)[0];
      // Spend before the echo, so a copied Legend cannot recursively re-enter the reprise.
      m = spend(m, s, 'torch');
      if (apprentice) {
        m = t.echo(m, apprentice); const live = find(m, apprentice.instanceId);
        if (live) m = t.protect(m, s, live.instanceId);
        targets.push(apprentice.instanceId); succeeded = true;
      }
      for (const lane of lanes.filter(x => x !== s.lane)) {
        const target = sorted(musical(m, s).filter(c => c.lane === lane), t)[0];
        if (target) { m = buff(m, target.instanceId, 1, t); targets.push(target.instanceId); succeeded = true; }
      }
      if (!succeeded) m = remove(m, ledger(m, s, 'torch')!.id);
    }
  } else if (id === 'fitness-girl') {
    const destination = legalDistricts(m, s, t)[0];
    if (destination !== undefined) {
      m = t.move(m, s, destination, 'Active Recovery: relocated.');
      const live = find(m, s.instanceId);
      if (live?.lane === destination) {
        const local = otherAllies(m, live);
        const target = sorted(local.filter(c => (c.recoverableDamage ?? 0) > 0), t)[0] ?? sorted(local.filter(c => c.statuses.burnStacks > 0), t)[0];
        if (target) {
          const healed = Math.min(2, target.recoverableDamage ?? 0);
          const burnt = target.statuses.burnStacks > 0;
          m = t.modify(m, target.instanceId, c => ({ ...c, recoverableDamage: Math.max(0, (c.recoverableDamage ?? 0) - healed), statuses: { ...c.statuses, burnStacks: 0 }, burnSource: undefined }));
          if (healed) m = buff(m, target.instanceId, healed, t);
          targets.push(target.instanceId); succeeded = healed > 0 || burnt;
        }
        // Relocating is itself a real effect, even when there is nobody to recover.
        succeeded = true;
      }
    }
  } else if (id === 'personal-trainer') {
    const trained = ledger(m, s, 'trainees')?.targets ?? [];
    const target = sorted(otherAllies(m, s).filter(c => !trained.includes(c.instanceId)), t)[0];
    if (target && target.lane !== null) {
      m = spend(m, s, 'trainees', { targets: [...trained, target.instanceId] });
      m = put(m, s, 'circuit', [target.instanceId], target.lane, { origin: target.lane, seen: [String(target.lane)], amount: 0 });
      targets.push(target.instanceId); succeeded = true;
    }
  } else {
    // Passive bodies have no entrance. Deployment does not invent an ability success or upgrade.
    return m;
  }
  return finish(before, m, s, t, succeeded, `${s.ability}: ${s.effect.replace(/^On Reveal:\s*/, '')}`, targets, echoed);
}

/** Called only after an actual ability resolution. Replayed entrances retain identity and caps. */
export function musicResolved(before: Match, m: Match, source: CardInstance, t: MusicTools, echoed = false): Match {
  // Older crews need no Music success snapshot or board serialization.
  if (echoed || !isMusicCharacter(source) || !source.effect.includes('On Reveal:') || !active(source)) return m;
  const succeeded = musicIndustryWaveCards[identity(source)] ? find(m, source.instanceId)?.creativeEntranceSucceeded === true : mechanicalChange(before, m);
  if (isMusicCharacter(source)) m = t.modify(m, source.instanceId, c => ({ ...c, creativeEntranceSucceeded: succeeded }));
  if (!succeeded || !isMusicCharacter(source)) return m;
  const entrant = find(m, source.instanceId);
  const originalLane = entrant?.lane ?? source.lane;
  if (originalLane === null) return m;
  for (const x of marks(m, 'soundcheck').filter(x => x.owner === source.owner && x.lane === originalLane && x.source.instanceId !== source.instanceId)) {
    const start = m;
    m = remove(m, x.id);
    if (!hasSpent(m, x.source, 'soundcheck')) {
      m = spend(m, x.source, 'soundcheck');
      const key = source.owner === 'player' ? 'playerMotion' : 'cpuMotion';
      const old = m[key]; m = t.refund(m, source.owner, 1);
      if (m[key] > old) { m = t.train(m, x.source.instanceId); m = t.event(start, m, x.source, [source.instanceId], 'Soundcheck: a successful performance refunded 1 Motion.'); }
    }
  }
  for (const rapper of board(m).filter(c => c.owner === source.owner && c.instanceId !== source.instanceId && identity(c) === 'the-rapper' && active(c))) {
    const local = rapper.lane === originalLane;
    const kit = local ? 'bars-local' : 'bars-wide';
    if (spentThisRound(m, rapper, kit)) continue;
    const target = sorted(local ? enemies(m, rapper) : board(m).filter(c => c.owner === source.owner && c.lane === originalLane), t, local)[0];
    if (!target) continue;
    const start = m;
    m = spend(m, rapper, kit, { usedRound: m.round });
    if (local) m = t.hit(m, rapper, target, -1, 'Sixteen Bars'); else m = buff(m, target.instanceId, 1, t);
    if (!local || damaged(start, m, target, t)) m = t.train(m, rapper.instanceId);
    m = t.event(start, m, rapper, [target.instanceId], local ? 'Sixteen Bars: local diss attempted (one per round).' : 'Sixteen Bars: another stage earned +1 Hand (one per round).');
  }
  return musicAfterAction(before, m, t);
}

/** Placement facts arrive from the engine, rather than being guessed from presentation copy. */
export function musicAfterPlay(before: Match, m: Match, id: string, t: MusicTools, placed?: CardInstance, entranceOutcome: MusicEntranceOutcome = 'resolved'): Match {
  if (!(m.creativeMarks ?? []).some(x => x.kind.startsWith('mi-'))
    && !before.boards.some(cs => cs.some(c => identity(c) === 'fitness-bro'))) return m;
  const entrant = find(m, id) ?? placed;
  if (!entrant || !character(entrant)) return m;
  for (const bro of board(before).filter(c => c.owner === entrant.owner && identity(c) === 'fitness-bro' && active(c) && c.instanceId !== id && c.lane !== entrant.lane)) {
    if (active(find(m, bro.instanceId))) m = spend(m, bro, 'rep-ready', { usedRound: m.round });
  }
  if (isMusicCharacter(entrant)) {
    for (const x of marks(before, 'rider').filter(x => x.owner === entrant.owner && x.source.instanceId !== id)) {
      if (!marks(m).some(mark => mark.id === x.id)) continue;
      const start = m; m = remove(m, x.id);
      const manager = find(m, x.source.instanceId);
      if (!active(manager)) continue;
      if (entranceOutcome === 'cancelled' || entranceOutcome === 'delayed') {
        const key = entrant.owner === 'player' ? 'playerMotion' : 'cpuMotion';
        const old = m[key]; m = t.refund(m, entrant.owner, 1);
        if (m[key] > old) m = t.train(m, manager.instanceId);
        m = t.event(start, m, manager, [id], 'Read the Contract: the blocked performance refunded 1 Motion.');
      } else if (find(m, id)) {
        const old = find(m, id)!.statuses.protected;
        m = t.protect(m, manager, id);
        if (!old && find(m, id)?.statuses.protected) m = t.train(m, manager.instanceId);
        m = t.event(start, m, manager, [id], 'Read the Contract: protected the insured artist after the entrance.');
      }
    }
    for (const x of marks(before, 'call').filter(x => x.owner === entrant.owner && x.source.instanceId !== id && !x.targets.includes(id) && x.lane !== entrant.lane)) {
      if (!marks(m).some(mark => mark.id === x.id)) continue;
      const caller = find(m, x.targets[0]), hypeman = find(m, x.source.instanceId), responder = find(m, id);
      if (!active(caller) || !active(hypeman) || !responder) continue;
      const start = m; m = remove(m, x.id);
      m = buff(m, caller.instanceId, 1, t); m = buff(m, responder.instanceId, 1, t); m = t.protect(m, hypeman, caller.instanceId);
      m = t.train(m, hypeman.instanceId);
      m = t.event(start, m, hypeman, [caller.instanceId, id], 'Say It Back: caller and responder gained +1 each; caller Protected.');
    }
  }
  m = bookingArrival(before, m, entrant, t);
  return musicAfterAction(before, m, t);
}

function bookingArrival(before: Match, m: Match, entrant: CardInstance, t: MusicTools): Match {
  for (const x of marks(before, 'booking').filter(x => x.owner !== entrant.owner && x.lane === entrant.lane)) {
    if (!marks(m).some(mark => mark.id === x.id)) continue;
    const target = find(m, entrant.instanceId);
    if (!target) continue;
    const start = m; m = remove(m, x.id);
    m = t.hit(m, x.source, target, -1, 'Wrong Address');
    if (damaged(start, m, target, t)) {
      const survivor = find(m, target.instanceId);
      if (survivor) m = t.status(m, x.source, survivor, 'weakened', 'Wrong Address: arrival Weakened.');
      if (active(find(m, x.source.instanceId))) m = t.train(m, x.source.instanceId);
    }
    m = t.event(start, m, x.source, [target.instanceId], 'Wrong Address: the public booking tried 1 damage; Weaken requires actual damage.');
  }
  return m;
}

export function musicMoved(before: Match, m: Match, id: string, t: MusicTools): Match {
  if (!marks(m).length && !marks(before).length) return m;
  const old = find(before, id), moved = find(m, id);
  if (!old || !moved || old.lane === moved.lane || moved.lane === null) return m;
  for (const x of marks(m, 'circuit').filter(x => x.targets.includes(id))) {
    const seen = x.seen ?? [String(x.origin)];
    if (seen.includes(String(moved.lane))) continue;
    const trainer = find(m, x.source.instanceId);
    if (!active(trainer)) continue;
    const start = m;
    const next = [...seen, String(moved.lane)];
    if (next.length >= 3) {
      m = remove(m, x.id); m = buff(m, id, 2, t); m = t.protect(m, trainer, id);
    } else { m = update(m, x.id, { seen: next, amount: 1, lane: moved.lane }); m = buff(m, id, 2, t); }
    m = t.train(m, trainer.instanceId);
    m = t.event(start, m, trainer, [id], next.length >= 3 ? 'Circuit Training: third district reached; +2 Hands and Protection.' : 'Circuit Training: first new district; +2 Hands.');
  }
  return musicAfterAction(before, bookingArrival(before, m, moved, t), t);
}

export function musicDamage(before: Match, m: Match, source: Pick<CardInstance, 'instanceId' | 'owner'>, victim: CardInstance, t: MusicTools, burn = false): Match {
  if ((!isMusicCharacter(victim) && !isFitnessCharacter(victim)) || source.owner === victim.owner || !character(victim) || victim.lane === null || !damaged(before, m, victim, t)) return m;
  for (const celebrity of board(before).filter(c => c.owner === victim.owner && c.instanceId !== victim.instanceId && identity(c) === 'the-local-celebrity' && c.lane !== victim.lane && active(c))) {
    const live = find(m, celebrity.instanceId);
    if (!isMusicCharacter(victim) || !active(live) || spentThisRound(m, live, 'celebrity')) continue;
    const start = m;
    m = spend(m, live, 'celebrity', { usedRound: m.round });
    if (t.canMove(m, live, victim.lane)) {
      m = t.move(m, live, victim.lane, 'Everybody Watching: followed the story.');
      if (find(m, live.instanceId)?.lane === victim.lane) {
        m = buff(m, live.instanceId, 1, t); m = t.train(m, live.instanceId);
      }
    }
    m = t.event(start, m, live, [victim.instanceId, live.instanceId], 'Everybody Watching: tried to follow real enemy damage; +1 requires a successful move.');
  }
  if (!find(m, victim.instanceId) && isFitnessCharacter(victim)) {
    for (const demon of board(before).filter(c => c.owner === victim.owner && c.instanceId !== victim.instanceId && identity(c) === 'demon-trainer' && active(c))) {
      const live = find(m, demon.instanceId);
      const progress = ledger(m, demon, 'demon');
      if (!active(live) || (progress?.amount ?? 0) >= 2 || progress?.usedRound === m.round) continue;
      const start = m;
      m = spend(m, live, 'demon', { amount: (progress?.amount ?? 0) + 1, usedRound: m.round });
      m = buff(m, live.instanceId, 2, t);
      const enemy = sorted(enemies(m, live, victim.lane), t, true)[0];
      if (enemy) m = t.hit(m, live, enemy, -1, 'No Days Off');
      m = t.train(m, live.instanceId);
      m = t.event(start, m, live, [live.instanceId, ...(enemy ? [enemy.instanceId] : [])], 'No Days Off: an enemy defeated a real athlete; +2 Hands and one revenge shot.');
    }
  }
  return m;
}

/** Observe each real gain immediately, even if a later hit erases it in the same action. */
export function musicGain(before: Match, m: Match, previous: CardInstance, t: MusicTools): Match {
  if (!marks(before, 'diss').length) return m;
  const target = find(m, previous.instanceId);
  if (!target || target.powerModifier <= previous.powerModifier) return m;
  for (const x of marks(before, 'diss').filter(x => x.targets.includes(target.instanceId))) {
    if (!marks(m, 'diss').some(live => live.id === x.id)) continue;
    const start = m; m = remove(m, x.id);
    m = t.status(m, x.source, find(m, target.instanceId)!, 'silenced', 'Diss Track: the next gain drew a Rebuttal.');
    if (!previous.statuses.silenced && find(m, target.instanceId)?.statuses.silenced && active(find(m, x.source.instanceId))) m = t.train(m, x.source.instanceId);
    m = t.event(start, m, x.source, [target.instanceId], 'Diss Track: a real Hands gain spent its Receipt and attempted Silence.');
  }
  return m;
}

/** Boundary fallback for older effects that replace state directly; only pre-existing receipts count. */
export function musicAfterAction(before: Match, m: Match, t: MusicTools): Match {
  for (const x of marks(m, 'diss').filter(x => marks(before, 'diss').some(old => old.id === x.id))) {
    const old = find(before, x.targets[0]), target = find(m, x.targets[0]);
    if (!old || !target || target.powerModifier <= old.powerModifier) continue;
    const start = m; m = remove(m, x.id);
    m = t.status(m, x.source, target, 'silenced', 'Diss Track: the next gain drew a Rebuttal.');
    if (!old.statuses.silenced && find(m, target.instanceId)?.statuses.silenced && active(find(m, x.source.instanceId))) m = t.train(m, x.source.instanceId);
    m = t.event(start, m, x.source, [target.instanceId], 'Diss Track: a real Hands gain spent its Receipt and attempted Silence.');
  }
  return m;
}

export function musicCanMove(m: Match, id: string): boolean { return !marks(m, 'contract').some(x => x.targets.includes(id)); }
export function musicCleansed(m: Match, id: string, _t?: MusicTools): Match {
  return { ...m, creativeMarks: (m.creativeMarks ?? []).filter(x => !(x.kind === 'mi-contract' && x.targets.includes(id))) };
}

export function musicRoundEnd(m: Match, t: MusicTools): Match {
  const beforeRoundEnd = m;
  for (const contract of marks(m, 'contract').filter(x => x.expires === m.round || m.round >= t.roundLimit(m))) {
    const start = m; m = remove(m, contract.id);
    const client = find(m, contract.targets[0]), manager = find(m, contract.source.instanceId);
    if (client && active(manager)) {
      const royalty = Math.min(2, Math.max(0, client.powerModifier));
      if (royalty) {
        m = t.removeBonus ? t.removeBonus(m, client, royalty) : t.modify(m, client.instanceId, c => ({ ...c, powerModifier: c.powerModifier - royalty }));
        const paid = Math.max(0, client.powerModifier - (find(m, client.instanceId)?.powerModifier ?? client.powerModifier));
        if (paid) { m = buff(m, manager.instanceId, paid, t); m = t.train(m, manager.instanceId); }
      }
      m = t.event(start, m, manager, [client.instanceId, manager.instanceId], `360 Deal: contract ended; transferred ${royalty} remaining bonus Hands.`);
    } else m = t.event(start, m, contract.source, contract.targets, '360 Deal: contract expired without royalties.');
  }
  for (const bro of board(m).filter(c => identity(c) === 'fitness-bro' && active(c))) {
    const progress = ledger(m, bro, 'reps');
    if ((progress?.amount ?? 0) >= 3 || progress?.usedRound === m.round || ledger(m, bro, 'rep-ready')?.usedRound !== m.round) continue;
    const start = m, reps = (progress?.amount ?? 0) + 1;
    m = spend(m, bro, 'reps', { amount: reps, usedRound: m.round }); m = buff(m, bro.instanceId, 2, t);
    if (reps === 3) m = t.protect(m, bro, bro.instanceId);
    m = t.train(m, bro.instanceId);
    m = t.event(start, m, bro, [bro.instanceId], `One More Rep: ${reps}/3 earned; +2 Hands${reps === 3 ? ' and Protection' : ''}.`);
  }
  return musicAfterAction(beforeRoundEnd, m, t);
}
export function musicRoundStart(m: Match, _t?: MusicTools): Match {
  if (!m.creativeMarks?.some(x => x.expires < m.round)) return m;
  return { ...m, creativeMarks: m.creativeMarks.filter(x => x.expires >= m.round) };
}

export function musicDistrictMarks(m: Match): CharacterDistrictMark[] {
  const labels: Record<string, string> = { 'mi-soundcheck': 'next different Music deployment with a successful entrance refunds 1 Motion', 'mi-call': 'different Music deployment elsewhere: +1 to caller and responder; Protect caller', 'mi-rider': 'next Music deployment: denial refund or Protection', 'mi-booking': 'next enemy play or move here: 1 damage, then Weaken only if hit lands', 'mi-diss': 'target’s next positive Hands gain: one Silence attempt', 'mi-contract': 'client cannot move; up to 2 bonus Hands become royalties at expiry', 'mi-circuit': 'visit all three districts: first new district +2; third +2 and Protection' };
  const visible = marks(m).filter(x => labels[x.kind]).map(x => ({ owner: x.owner, lane: x.lane, text: `${x.source.ability} · ${labels[x.kind]} · through R${x.expires}${x.targets.length ? ': ' + x.targets.map(id => find(m, id)?.name ?? 'departed character').join(', ') : ''}` }));
  for (const bro of board(m).filter(c => identity(c) === 'fitness-bro')) visible.push({ owner: bro.owner, lane: bro.lane!, text: `One More Rep · ${ledger(m, bro, 'reps')?.amount ?? 0}/3${active(bro) ? '' : ' · disabled'}` });
  return visible;
}
