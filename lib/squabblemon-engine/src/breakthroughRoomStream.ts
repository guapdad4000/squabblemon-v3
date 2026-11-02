import type { BreakthroughRoomView } from './breakthroughRoom';
/** Per-connection, per-seat baseline. Reconnect and missing/out-of-order frames request a snapshot.
 * Clients cache immutable card definitions/art by ruleset; only IDs and live overrides travel here. */
type Collections = 'units' | 'statuses' | 'hazards';
type Header = Omit<BreakthroughRoomView, Collections | 'events'>;
type Patch<T extends { id: string | number }> = {
  put: T[];
  remove: T['id'][];
  change: (Partial<T> & Pick<T, 'id'>)[];
  order?: T['id'][];
};
export type RoomStreamFrame =
  | { kind: 'snapshot'; view: BreakthroughRoomView }
  | {
      kind: 'delta';
      roomId: string;
      side: BreakthroughRoomView['side'];
      ruleset: string;
      baseRevision: number;
      revision: number;
      header: Partial<Header>;
      units: Patch<BreakthroughRoomView['units'][number]>;
      statuses: Patch<BreakthroughRoomView['statuses'][number]>;
      hazards: Patch<BreakthroughRoomView['hazards'][number]>;
      events: BreakthroughRoomView['events'];
      retainedEventIds: number[];
    };
const copy = <T>(v: T): T => structuredClone(v);
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function patch<T extends { id: string | number }>(
  before: T[],
  after: T[],
): Patch<T> {
  const old = new Map(before.map((v) => [v.id, v])),
    next = new Set(after.map((v) => v.id));
  const result: Patch<T> = {
    put: [],
    remove: before.filter((v) => !next.has(v.id)).map((v) => v.id),
    change: [],
  };
  for (const item of after) {
    const previous = old.get(item.id);
    if (!previous) result.put.push(copy(item));
    else if (!equal(previous, item)) {
      // Removing an optional field needs a complete replacement, not an undefined JSON value.
      if (Object.keys(previous).some((key) => !(key in item)))
        result.put.push(copy(item));
      else {
        const changes = Object.fromEntries(
          Object.entries(item).filter(
            ([key, value]) =>
              key === 'id' || !equal(value, previous[key as keyof T]),
          ),
        );
        result.change.push(changes as Partial<T> & Pick<T, 'id'>);
      }
    }
  }
  const natural = [
    ...before.filter((v) => next.has(v.id)).map((v) => v.id),
    ...after.filter((v) => !old.has(v.id)).map((v) => v.id),
  ];
  if (
    !equal(
      natural,
      after.map((v) => v.id),
    )
  )
    result.order = after.map((v) => v.id);
  return result;
}
export function encodeRoomStream(
  previous: BreakthroughRoomView | null,
  next: BreakthroughRoomView,
): RoomStreamFrame {
  if (
    !previous ||
    previous.roomId !== next.roomId ||
    previous.side !== next.side ||
    previous.ruleset !== next.ruleset ||
    next.revision < previous.revision
  )
    return { kind: 'snapshot', view: copy(next) };
  const {
    units: _u,
    statuses: _s,
    hazards: _h,
    events: _e,
    ...nextHeader
  } = next;
  const header = Object.fromEntries(
    Object.entries(nextHeader).filter(
      ([key, value]) =>
        !equal(value, previous[key as keyof BreakthroughRoomView]),
    ),
  ) as Partial<Header>;
  const seen = new Set(previous.events.map((e) => e.id));
  const delta: RoomStreamFrame = {
    kind: 'delta',
    roomId: next.roomId,
    side: next.side,
    ruleset: next.ruleset,
    baseRevision: previous.revision,
    revision: next.revision,
    header,
    units: patch(previous.units, next.units),
    statuses: patch(previous.statuses, next.statuses),
    hazards: patch(previous.hazards, next.hazards),
    events: copy(next.events.filter((e) => !seen.has(e.id))),
    retainedEventIds: next.events.map((e) => e.id),
  };
  const snapshot: RoomStreamFrame = { kind: 'snapshot', view: copy(next) };
  return JSON.stringify(delta).length < JSON.stringify(snapshot).length
    ? delta
    : snapshot;
}
function apply<T extends { id: string | number }>(
  items: T[],
  p: Patch<T>,
): T[] {
  const removed = new Set(p.remove),
    values = new Map(
      items.filter((v) => !removed.has(v.id)).map((v) => [v.id, copy(v)]),
    );
  for (const v of p.put) values.set(v.id, copy(v));
  for (const v of p.change) {
    const old = values.get(v.id);
    if (!old) throw new Error('Room stream requires a fresh snapshot');
    values.set(v.id, { ...old, ...copy(v) });
  }
  return p.order
    ? p.order.map((id) => {
        const value = values.get(id);
        if (!value) throw new Error('Room stream requires a fresh snapshot');
        return value;
      })
    : [...values.values()];
}
export function applyRoomStream(
  previous: BreakthroughRoomView | null,
  frame: RoomStreamFrame,
): BreakthroughRoomView {
  if (frame.kind === 'snapshot') return copy(frame.view);
  if (
    !previous ||
    previous.roomId !== frame.roomId ||
    previous.side !== frame.side ||
    previous.ruleset !== frame.ruleset ||
    previous.revision !== frame.baseRevision
  )
    throw new Error('Room stream requires a fresh snapshot');
  const events = new Map(
    [...previous.events, ...frame.events].map((e) => [e.id, e]),
  );
  if (frame.retainedEventIds.some((id) => !events.has(id)))
    throw new Error('Room stream requires a fresh snapshot');
  return {
    ...copy(previous),
    ...copy(frame.header),
    revision: frame.revision,
    units: apply(previous.units, frame.units),
    statuses: apply(previous.statuses, frame.statuses),
    hazards: apply(previous.hazards, frame.hazards),
    events: frame.retainedEventIds.map((id) => copy(events.get(id)!)),
  };
}
