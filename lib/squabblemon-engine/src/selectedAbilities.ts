import { selectedCards, FAMILY_IDS, fakeMarriage } from './selectedWave';
import {
  isFitnessCharacter,
  isMusicCharacter,
  type MusicTools,
} from './musicIndustryAbilities';
import type { CardInstance, Match, Lane } from './gameEngine';
import type { CreativeMark } from './creativeReworks';
export type SelectedTools = MusicTools & {
  marriage(m: Match, s: CardInstance): Match;
};
const lanes: Lane[] = [0, 1, 2];
const identity = (c: CardInstance) => c.copiedAbilityCardId ?? c.cardId;
const board = (m: Match) =>
  m.boards.flat().filter((c) => !c.hazard && c.kind !== 'support');
const find = (m: Match, id: string) =>
  m.boards.flat().find((c) => c.instanceId === id);
const active = (c: CardInstance) =>
  !c.statuses.silenced && !c.statuses.frozen && !c.statuses.weakened;
const family = (c: CardInstance) =>
  c.type === 'Fire' || FAMILY_IDS.includes(c.cardId);
const homeless = (c: CardInstance) =>
  ['homelessguy', 'homelessyn', 'homelesslegend', 'homelesswiseman'].includes(
    c.cardId,
  ) || c.id.startsWith('homeless-');
const weak = (cs: CardInstance[], t: MusicTools) =>
  [...cs].sort(
    (a, b) =>
      t.power(a) - t.power(b) || a.instanceId.localeCompare(b.instanceId),
  )[0];
const strong = (cs: CardInstance[], t: MusicTools) =>
  [...cs].sort(
    (a, b) =>
      t.power(b) - t.power(a) || a.instanceId.localeCompare(b.instanceId),
  )[0];
const allies = (m: Match, s: CardInstance, local = true) =>
  board(m).filter(
    (c) =>
      c.owner === s.owner &&
      c.instanceId !== s.instanceId &&
      (!local || c.lane === s.lane),
  );
const enemies = (m: Match, s: CardInstance, local = true) =>
  board(m).filter((c) => c.owner !== s.owner && (!local || c.lane === s.lane));
const buff = (
  m: Match,
  id: string,
  n: number,
  t: MusicTools,
  copied = false,
) =>
  t.buff
    ? t.buff(m, id, n, copied)
    : t.modify(m, id, (c) => ({ ...c, powerModifier: c.powerModifier + n }));
const mark = (m: Match, s: CardInstance, key: string) =>
  m.creativeMarks?.find((x) => x.id === `sw:${s.owner}:${key}`);
function put(
  m: Match,
  s: CardInstance,
  key: string,
  patch: Partial<CreativeMark> = {},
): Match {
  const id = `sw:${s.owner}:${key}`;
  return {
    ...m,
    creativeMarks: [
      ...(m.creativeMarks ?? []).filter((x) => x.id !== id),
      {
        id,
        kind: 'sw-ledger',
        source: s,
        owner: s.owner,
        lane: s.lane ?? 0,
        targets: [],
        expires: 99,
        ...patch,
      },
    ],
  };
}
const spent = (m: Match, s: CardInstance, key: string) => !!mark(m, s, key);
const roundSpent = (m: Match, s: CardInstance, key: string) =>
  mark(m, s, key)?.usedRound === m.round;
function consume(m: Match, s: CardInstance, key: string): Match {
  const old = mark(m, s, key);
  return put(m, s, key, {
    ...old,
    amount: (old?.amount ?? 0) + 1,
    usedRound: m.round,
  });
}
const routes = (m: Match, c: CardInstance) =>
  mark(m, c, `route:${c.instanceId}`)?.seen ?? [String(c.lane)];
const destination = (
  m: Match,
  c: CardInstance,
  t: MusicTools,
  unvisited = false,
) =>
  lanes
    .filter(
      (l) =>
        l !== c.lane &&
        t.canMove(m, c, l) &&
        (!unvisited || !routes(m, c).includes(String(l))),
    )
    .sort(
      (a, b) => t.score(m, c.owner, a) - t.score(m, c.owner, b) || a - b,
    )[0];
const room = (m: Match, s: CardInstance, l: Lane) =>
  m.boards[l].filter((c) => c.owner === s.owner && !c.hazard).length < 4;
function moved(
  m: Match,
  c: CardInstance,
  d: Lane | undefined,
  t: MusicTools,
): [Match, boolean] {
  if (d === undefined) return [m, false];
  const old = c.lane;
  m = t.move(m, c, d, 'Route completed.');
  return [m, find(m, c.instanceId)?.lane === d && old !== d];
}
function recovery(m: Match, c: CardInstance, n: number, t: MusicTools): Match {
  return buff(m, c.instanceId, Math.min(n, Math.max(0, -c.powerModifier)), t);
}
function finish(
  before: Match,
  m: Match,
  s: CardInstance,
  t: MusicTools,
  success: boolean,
  targets: string[],
  echoed: boolean,
): Match {
  const note = success
    ? `${s.ability}: ${s.effect}`
    : `${s.ability}: did not take effect.`;
  m = t.modify(m, s.instanceId, (c) => ({
    ...c,
    creativeEntranceSucceeded: echoed ? c.creativeEntranceSucceeded : success,
    lastEffectNote: note,
  }));
  m = t.event(before, m, s, targets, note);
  return success && !echoed ? t.train(m, s.instanceId) : m;
}
export function selectedReveal(
  m: Match,
  s: CardInstance,
  t: SelectedTools,
  echoed = false,
): Match | null {
  const id = identity(s);
  if (!selectedCards[id]) return null;
  const before = m;
  let success = false;
  const targets: string[] = [];
  const local = (filter: (c: CardInstance) => boolean = () => true) =>
    weak(allies(m, s).filter(filter), t);
  const enemy = () => strong(enemies(m, s), t);
  const grant = (c: CardInstance | undefined, n: number) => {
    if (c) {
      m = buff(m, c.instanceId, n, t);
      targets.push(c.instanceId);
      success = true;
    }
  };
  const shield = (c: CardInstance | undefined) => {
    if (c && !c.statuses.protected) {
      m = t.protect(m, s, c.instanceId);
      targets.push(c.instanceId);
      success = true;
    }
  };
  const transfer = (c: CardInstance | undefined, unvisited = false) => {
    if (!c) return false;
    targets.push(c.instanceId);
    let ok;
    [m, ok] = moved(m, c, destination(m, c, t, unvisited), t);
    success = ok;
    return ok;
  };
  const pull = (filter: (c: CardInstance) => boolean) => {
    const c = weak(
      allies(m, s, false).filter(
        (c) =>
          c.lane !== s.lane &&
          filter(c) &&
          t.canMove(m, c, s.lane!) &&
          room(m, c, s.lane!),
      ),
      t,
    );
    if (!c) return undefined;
    targets.push(c.instanceId);
    let ok;
    [m, ok] = moved(m, c, s.lane!, t);
    success = ok;
    return ok ? find(m, c.instanceId) : undefined;
  };
  if (['track-suit-auntie', 'the-favorite-grandchild'].includes(id))
    transfer(s);
  else if (id === 'gym-bag-yn') {
    if (!roundSpent(m, s, id) && transfer(local(isFitnessCharacter)))
      m = consume(m, s, id);
  } else if (id === 'mixtape-cousin') transfer(local(isMusicCharacter));
  else if (id === 'cousin-back-from-college') transfer(local(family));
  else if (id === 'stairwell-sprinter') {
    if (transfer(s, true) && !spent(m, s, `${id}:${s.instanceId}`)) {
      m = consume(m, s, `${id}:${s.instanceId}`);
      grant(find(m, s.instanceId), 1);
    }
  } else if (id === 'delivery-app-cyclist') {
    if (transfer(s) && !spent(m, s, `${id}:${s.instanceId}`)) {
      m = consume(m, s, `${id}:${s.instanceId}`);
      const now = find(m, s.instanceId)!;
      grant(weak(allies(m, now), t), 1);
    }
  } else if (id === 'tour-van-driver') {
    if (!roundSpent(m, s, id)) {
      const c = pull(isMusicCharacter);
      if (c) {
        m = consume(m, s, id);
        grant(c, 1);
        grant(find(m, s.instanceId), 1);
      }
    }
  } else if (id === 'night-bus-driver') pull(() => true);
  else if (id === 'last-set-og') {
    if (
      board(m).some(
        (c) =>
          c.owner === s.owner &&
          isFitnessCharacter(c) &&
          routes(m, c).length === 3,
      )
    ) {
      if (!spent(m, s, id)) {
        m = consume(m, s, id);
        for (const l of lanes)
          grant(
            weak(
              board(m).filter(
                (c) =>
                  c.owner === s.owner && c.lane === l && isFitnessCharacter(c),
              ),
              t,
            ),
            1,
          );
      }
    } else shield(local(isFitnessCharacter));
  } else if (['og-calisthenics', 'one-man-band'].includes(id)) {
    if (!spent(m, s, id)) {
      const eligible =
        id === 'one-man-band' ? isMusicCharacter : isFitnessCharacter;
      const all = board(m).filter((c) => c.owner === s.owner && eligible(c));
      if (lanes.every((l) => all.some((c) => c.lane === l))) {
        for (const l of lanes)
          grant(
            weak(
              all.filter((c) => c.lane === l),
              t,
            ),
            1,
          );
      } else {
        const c = local(eligible);
        grant(c, id === 'one-man-band' ? 2 : 1);
        if (id === 'og-calisthenics') shield(c);
      }
      if (success) m = consume(m, s, id);
    }
  } else if (id === 'studio-couch-yn') grant(local(isMusicCharacter), 1);
  else if (id === 'plate-auntie') {
    const c =
      local((c) => family(c) && c.powerModifier < 0) ??
      local((c) => family(c) && !!c.statuses.burnStacks) ??
      local(family);
    if (c) {
      if (c.powerModifier < 0 || c.statuses.burnStacks) {
        m = recovery(m, c, 2, t);
        m = t.modify(m, c.instanceId, (x) => ({
          ...x,
          statuses: { ...x.statuses, burnStacks: 0 },
        }));
        success = true;
        targets.push(c.instanceId);
      } else grant(c, 1);
    }
  } else if (id === 'community-cook') {
    const eligible = (c: CardInstance) => !spent(m, s, `meal:${c.instanceId}`);
    const c =
      local((c) => eligible(c) && c.powerModifier < 0) ?? local(eligible);
    if (c) {
      m = consume(m, s, `meal:${c.instanceId}`);
      if (c.powerModifier < 0) m = recovery(m, c, 2, t);
      else grant(c, 1);
      if (homeless(c)) shield(find(m, c.instanceId));
      targets.push(c.instanceId);
      success = true;
    }
  } else if (id === 'church-aunties-rival') shield(local(family));
  else if (['gym-spotter-yn', 'black-air-fade-1s'].includes(id)) {
    const c = local(
      (c) =>
        (id !== 'gym-spotter-yn' || isFitnessCharacter(c)) &&
        (id !== 'black-air-fade-1s' || !spent(m, s, `shoes:${c.instanceId}`)),
    );
    if (c) {
      if (id === 'black-air-fade-1s') {
        grant(c, 1);
        m = consume(m, s, `shoes:${c.instanceId}`);
      }
      shield(c);
      m = put(m, s, `ward:${c.instanceId}`, {
        kind: 'sw-ward',
        targets: [c.instanceId],
        expires: m.round,
      });
      success = true;
    }
  } else if (id === 'grill-uncle') {
    const c = enemy();
    if (c) {
      const old = m;
      m = t.burn(m, s, c, 1, s.ability);
      success =
        (find(m, c.instanceId)?.statuses.burnStacks ?? 0) >
        (c.statuses.burnStacks ?? 0);
      targets.push(c.instanceId);
      if (old === m) success = false;
    }
  } else if (['grandma-said-sit-down', 'group-chat-instigator'].includes(id)) {
    const key = `${id}:${s.instanceId}`;
    if (id !== 'grandma-said-sit-down' || !spent(m, s, key)) {
      const c = enemy();
      if (c) {
        m = t.hit(
          m,
          s,
          c,
          id === 'grandma-said-sit-down' &&
            (m.roundMovedIds?.[s.owner]?.length ?? 0) >= 2
            ? 2
            : 1,
          s.ability,
        );
        success =
          !find(m, c.instanceId) ||
          find(m, c.instanceId)!.powerModifier < c.powerModifier;
        targets.push(c.instanceId);
        if (success) {
          if (id === 'grandma-said-sit-down') m = consume(m, s, key);
          else if ((m.roundMovedIds?.[s.owner]?.length ?? 0) >= 2) {
            const remote = strong(
              enemies(m, s, false).filter((x) => x.lane !== s.lane),
              t,
            );
            if (remote) {
              m = t.hit(m, s, remote, 1, s.ability);
              targets.push(remote.instanceId);
            }
          }
        }
      }
    }
  } else if (id === 'bluetooth-unc') {
    const c = local((c) => !!c.statuses.silenced);
    if (c) {
      m = t.modify(m, c.instanceId, (x) => ({
        ...x,
        statuses: { ...x.statuses, silenced: false },
      }));
      success = true;
      targets.push(c.instanceId);
    } else shield(local());
  } else if (['barbershop-heckler', 'booster', 'indian-scammer'].includes(id)) {
    const key = `${id}:${s.instanceId}`;
    if (id === 'barbershop-heckler' || !spent(m, s, key)) {
      const c = enemy();
      if (c) {
        const old = c.powerModifier;
        m = t.trim(m, s, c, id === 'booster' ? 1 : 2);
        const actual = Math.max(
          0,
          old - (find(m, c.instanceId)?.powerModifier ?? old),
        );
        success = actual > 0;
        targets.push(c.instanceId);
        if (success) {
          if (id === 'booster') grant(find(m, s.instanceId), actual);
          else {
            const a = local();
            grant(a, 1);
            if (id === 'indian-scammer') shield(a);
          }
          if (id !== 'barbershop-heckler') m = consume(m, s, key);
        }
      }
    }
  } else if (
    id === 'naija-scammer' &&
    !spent(m, s, id) &&
    room(m, s, s.lane!)
  ) {
    m = t.marriage(m, s);
    m = consume(m, s, id);
    success = true;
    shield(local((c) => c.kind !== 'token'));
  }
  return finish(before, m, s, t, success, targets, echoed);
}
function payout(
  m: Match,
  s: CardInstance,
  key: string,
  target: CardInstance,
  n: number,
  max: number,
  t: MusicTools,
  copied = false,
): Match {
  const old = mark(m, s, key);
  if (roundSpent(m, s, key) || (old?.amount ?? 0) >= max) return m;
  const before = m;
  m = consume(m, s, key);
  m = buff(m, target.instanceId, n, t, copied);
  m = t.train(m, s.instanceId);
  return t.event(
    before,
    m,
    s,
    [target.instanceId],
    `${s.ability}: +${n} Hand${n === 1 ? '' : 's'}.`,
  );
}
export function selectedMoved(
  before: Match,
  m: Match,
  id: string,
  t: MusicTools,
): Match {
  const c = find(m, id),
    old = find(before, id);
  if (!c || !old || c.lane === old.lane) return m;
  if (isFitnessCharacter(c)) {
    m = put(m, c, `route:${id}`, {
      seen: [...new Set([...routes(before, old), String(c.lane)])],
    });
    m = t.event(before, m, c, [id], 'Circuit route recorded.');
  }
  for (const w of (m.creativeMarks ?? []).filter(
    (x) =>
      x.kind === 'sw-ward' && x.expires >= m.round && x.targets.includes(id),
  )) {
    m = { ...m, creativeMarks: m.creativeMarks?.filter((x) => x.id !== w.id) };
    const b = m;
    m = buff(m, id, 1, t);
    m = t.event(
      b,
      m,
      w.source,
      [id],
      `${w.source.ability}: successful move grants +1 Hand.`,
    );
  }
  for (const s of board(m).filter((c) => c.owner === old.owner && active(c))) {
    const kit = identity(s);
    if (
      kit === 'big-sister' &&
      s.lane === c.lane &&
      s.instanceId !== id &&
      family(c)
    )
      m = payout(m, s, kit, c, 1, 3, t);
    if (kit === 'calisthenics-yn' && s.instanceId === id)
      m = payout(m, s, `${kit}:${id}`, s, 1, 2, t);
    if (kit === 'fake-marriage' && s.lane === c.lane && s.instanceId !== id)
      m = payout(m, s, `${kit}:${s.instanceId}`, s, 1, 2, t);
    if (kit === 'jump-rope-menace') {
      const fitnessMoves = (m.roundMovedIds?.[s.owner] ?? []).filter((id) => {
        const x = find(m, id);
        return x && isFitnessCharacter(x);
      });
      if (new Set(fitnessMoves).size >= 2) m = payout(m, s, kit, s, 2, 2, t);
    }
  }
  return m;
}
export function selectedGain(
  before: Match,
  m: Match,
  c: CardInstance,
  t: MusicTools,
  copied = false,
): Match {
  const now = find(m, c.instanceId);
  if (copied || !now || now.powerModifier <= c.powerModifier) return m;
  for (const s of board(m).filter(
    (s) =>
      s.owner === c.owner &&
      s.instanceId !== c.instanceId &&
      s.lane === c.lane &&
      active(s) &&
      identity(s) === 'second-plate-cousin',
  ))
    if (family(c)) m = payout(m, s, 'second-plate-cousin', s, 1, 3, t, true);
  return m;
}
export function selectedDamage(
  before: Match,
  m: Match,
  victim: CardInstance,
  t: MusicTools,
  burn = false,
): Match {
  if (
    !burn ||
    find(m, victim.instanceId)?.powerModifier === victim.powerModifier
  )
    return m;
  for (const s of board(m).filter(
    (s) =>
      s.owner !== victim.owner &&
      s.lane === victim.lane &&
      active(s) &&
      identity(s) === 'grill-uncle',
  ))
    m = payout(m, s, 'grill-uncle', s, 1, 2, t);
  return m;
}
export function selectedResolved(
  before: Match,
  m: Match,
  c: CardInstance,
  t: MusicTools,
  echoed = false,
): Match {
  if (
    echoed ||
    !find(m, c.instanceId)?.creativeEntranceSucceeded ||
    !isMusicCharacter(c)
  )
    return m;
  for (const s of board(m).filter(
    (s) =>
      s.owner === c.owner &&
      s.instanceId !== c.instanceId &&
      s.lane === c.lane &&
      active(s) &&
      identity(s) === 'merch-table-hustler',
  )) {
    const key = 'merch-table-hustler',
      old = mark(m, s, key);
    if (roundSpent(m, s, key) || (old?.amount ?? 0) >= 2) continue;
    const start = m;
    m = consume(m, s, key);
    const order = m.nextDiscountOrder;
    m = {
      ...m,
      nextDiscountOrder: order + 1,
      discountTokens: [
        ...m.discountTokens,
        {
          id: `sw-merch:${s.owner}:${order}`,
          owner: s.owner,
          sourceInstanceId: s.instanceId,
          eligibility: 'selected-music',
          sourceLane: s.lane!,
          createdOrder: order,
          expiresAfterRound: m.round,
        },
      ],
    };
    m = t.train(m, s.instanceId);
    m = t.event(
      start,
      m,
      s,
      [c.instanceId],
      'Tour Money: one local Music discount, minimum 1 Motion.',
    );
  }
  return m;
}
