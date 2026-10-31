import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import React, { type MouseEvent, type PointerEvent } from "react";
import { act, create } from "react-test-renderer";
import { useDeploymentDrag } from "./useDeploymentDrag";

type DragApi = ReturnType<typeof useDeploymentDrag>;
type Drop = [string, 0 | 1 | 2, boolean];

/** Hook-level pointer/capture model; browser dispatch and visual layout require browser checks. */
async function harness(t: TestContext) {
  const captures = new Map<number, CaptureSurface>();
  const properties = new Map<string, string>();
  class CaptureSurface {
    setPointerCapture(pointer: number) {
      captures.set(pointer, this);
    }
    hasPointerCapture(pointer: number) {
      return captures.get(pointer) === this;
    }
    releasePointerCapture(pointer: number) {
      if (this.hasPointerCapture(pointer)) captures.delete(pointer);
    }
  }
  const source = new CaptureSurface();
  const arena = Object.assign(new CaptureSurface(), {
    style: {
      setProperty: (key: string, value: string) => properties.set(key, value),
    },
    querySelectorAll: () =>
      [0, 1, 2].map((lane) => ({
        getBoundingClientRect: () => ({
          left: 30 + lane * 100,
          right: 130 + lane * 100,
          top: 80,
          bottom: 600,
        }),
      })),
  });
  const drops: Drop[] = [],
    starts: string[] = [];
  let clears = 0,
    api!: DragApi;
  let state = { active: true, matchKey: 1 };
  const priorAct = Object.getOwnPropertyDescriptor(
    globalThis,
    "IS_REACT_ACT_ENVIRONMENT",
  );
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  function Probe({ active, matchKey }: typeof state) {
    api = useDeploymentDrag({
      active,
      matchKey,
      arena: { current: arena as unknown as HTMLElement },
      onStart: (card) => starts.push(card),
      onClear: () => {
        clears++;
      },
      onDrop: (...drop) => drops.push(drop),
    });
    return null;
  }
  let renderer!: ReturnType<typeof create>,
    mounted = true;
  await act(async () => {
    renderer = create(React.createElement(Probe, state));
  });
  async function unmount() {
    if (mounted) {
      await act(async () => renderer.unmount());
      mounted = false;
    }
  }
  t.after(async () => {
    await unmount();
    if (priorAct)
      Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", priorAct);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });
  function pointer(extras: Record<string, unknown> = {}) {
    let prevented = false;
    return Object.assign(
      {
        pointerId: 1,
        button: 0,
        isPrimary: true,
        pointerType: "touch",
        clientX: 80,
        clientY: 700,
        currentTarget: source,
        target: source,
        type: "pointermove",
        preventDefault() {
          prevented = true;
        },
        get prevented() {
          return prevented;
        },
      },
      extras,
    ) as unknown as PointerEvent<HTMLButtonElement> & { prevented: boolean };
  }
  async function down(card: string, squabble = false, extras = {}) {
    await act(async () => {
      api.pointerDownCapture();
      api.pointerDown(pointer(extras), card, squabble);
    });
  }
  async function move(x = 80, y = 300) {
    await act(async () => api.pointerMove(pointer({ clientX: x, clientY: y })));
  }
  async function up(x = 80, y = 300) {
    const event = pointer({ clientX: x, clientY: y, type: "pointerup" });
    await act(async () => api.pointerUp(event));
    return event;
  }
  async function cancel(extras = {}) {
    await act(async () =>
      api.pointerCancel(pointer({ type: "pointercancel", ...extras })),
    );
  }
  async function update(next: Partial<typeof state>) {
    state = { ...state, ...next };
    await act(async () => renderer.update(React.createElement(Probe, state)));
  }
  function click(detail = 1) {
    let prevented = false,
      stopped = false;
    api.clickCapture({
      detail,
      preventDefault() {
        prevented = true;
      },
      stopPropagation() {
        stopped = true;
      },
    } as unknown as MouseEvent<HTMLElement>);
    return { prevented, stopped };
  }
  return {
    get api() {
      return api;
    },
    get clears() {
      return clears;
    },
    source,
    arena,
    captures,
    drops,
    starts,
    properties,
    pointer,
    down,
    move,
    up,
    cancel,
    update,
    click,
    unmount,
  };
}

test("drag capture moves to the persistent arena and release coordinates choose the final lane", async (t) => {
  const h = await harness(t);
  await h.down("first", true);
  assert.equal(h.captures.get(1), h.source);
  await h.move(80, 300);
  assert.equal(h.captures.get(1), h.arena);
  assert.deepEqual(h.api.drag, { cardId: "first", lane: 0 });
  assert.equal(h.properties.get("--bt-drag-x"), "80px");
  assert.equal(h.properties.get("--bt-drag-y"), "300px");
  const released = await h.up(280, 450);
  assert.equal(released.prevented, true);
  assert.deepEqual(h.drops, [["first", 2, true]]);
  assert.equal(h.captures.size, 0);
  assert.equal(h.api.drag, null);
  assert.equal(h.clears, 1);
  assert.deepEqual(h.click(), { prevented: true, stopped: true });
  assert.deepEqual(h.click(), { prevented: false, stopped: false });
});

test("rapid same-lane drags reuse one pointer and ignore stale capture-loss from preceding cards", async (t) => {
  const h = await harness(t);
  for (const id of ["first", "second", "third"]) {
    await h.down(id);
    // Prior arena release arrives after the fresh card already owns this pointer.
    await h.cancel({ type: "lostpointercapture", target: h.arena });
    await h.move();
    // Transfer from the card must not cancel the persistent field's gesture.
    await h.cancel({ type: "lostpointercapture", target: h.source });
    // A stale capture-loss from the field is also harmless while it still owns capture.
    await h.cancel({ type: "lostpointercapture", target: h.arena });
    await h.up();
  }
  assert.deepEqual(h.drops, [
    ["first", 0, false],
    ["second", 0, false],
    ["third", 0, false],
  ]);
  assert.deepEqual(h.starts, ["first", "second", "third"]);
  assert.equal(h.clears, 3);
  assert.equal(h.captures.size, 0);
});

test("a fresh press recovers a missed release immediately and never deploys the abandoned gesture", async (t) => {
  const h = await harness(t);
  await h.down("abandoned");
  await h.move();
  await h.down("replacement", true);
  await h.move();
  await h.up();
  assert.deepEqual(h.drops, [["replacement", 0, true]]);
  assert.deepEqual(h.starts, ["abandoned", "replacement"]);
  assert.equal(h.clears, 2);
});

test("tap jitter preserves accessible clicks while a drag suppresses only its associated pointer click", async (t) => {
  const h = await harness(t);
  await h.down("tap");
  const released = await h.up(83, 697);
  assert.equal(released.prevented, false);
  assert.equal(h.starts.length, 0);
  assert.equal(h.drops.length, 0);
  assert.deepEqual(h.click(), { prevented: false, stopped: false });
  await h.down("drag");
  await h.move();
  await h.up();
  assert.deepEqual(h.click(0), { prevented: false, stopped: false });
  assert.deepEqual(h.click(), { prevented: true, stopped: true });
  await h.down("fresh-tap");
  await h.up(80, 700);
  assert.deepEqual(h.click(), { prevented: false, stopped: false });
});

test("outside releases, pointer cancellation, pause, rematch and unmount release capture without deploying", async (t) => {
  const h = await harness(t);
  await h.down("outside");
  await h.move();
  await h.up(80, 700);
  await h.down("cancelled");
  await h.move();
  await h.cancel();
  await h.down("paused");
  await h.move();
  await h.update({ active: false });
  assert.equal(h.captures.size, 0);
  assert.equal(h.api.drag, null);
  await h.down("inactive");
  assert.equal(h.captures.size, 0);
  await h.update({ active: true });
  await h.down("reset");
  await h.move();
  await h.update({ matchKey: 2 });
  assert.equal(h.captures.size, 0);
  assert.equal(h.api.drag, null);
  await h.down("unmount");
  await h.move();
  await h.unmount();
  assert.equal(h.captures.size, 0);
  assert.deepEqual(h.drops, []);
});

test("secondary buttons and pointers cannot seize or complete a primary deployment gesture", async (t) => {
  const h = await harness(t);
  await h.down("right-button", false, { button: 2 });
  await h.down("secondary-touch", false, { isPrimary: false });
  assert.equal(h.captures.size, 0);
  await h.down("primary");
  await h.down("other-pointer", false, { pointerId: 2 });
  await act(async () =>
    h.api.pointerUp(h.pointer({ pointerId: 2, clientY: 300 })),
  );
  assert.equal(h.captures.get(1), h.source);
  assert.equal(h.drops.length, 0);
  await h.move();
  await h.up();
  assert.deepEqual(h.drops, [["primary", 0, false]]);
});
