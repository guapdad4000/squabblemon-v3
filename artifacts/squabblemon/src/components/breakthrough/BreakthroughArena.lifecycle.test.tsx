import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { FighterDefinition } from "@workspace/squabblemon-engine/breakthrough";
import BreakthroughArena from "./BreakthroughArena";
import ResultStage from "./ResultStage";
import { getCardImage } from "../../lib/assets";
import { battlePortraitUrl } from "../../lib/battlePortrait";

const roster: FighterDefinition[] = Array.from({ length: 10 }, (_, index) => ({
  id: `clock-fighter-${index}`,
  name: `Clock fighter ${index}`,
  cost: 0,
  hands: 4,
  art: "",
  description: "No ability.",
  ability: "none",
}));
const deck = roster.map((card) => card.id);

async function mount(
  t: TestContext,
  hidden = false,
  options: { reducedMotion?: boolean; art?: string } = {},
) {
  const reducedMotion = options.reducedMotion ?? true;
  const fighterRoster = options.art
    ? roster.map((card) => ({ ...card, art: options.art! }))
    : roster;
  const warmRequests: string[] = [];
  let now = 0;
  let timerId = 0;
  const intervals = new Map<number, () => void>();
  const timeouts = new Map<number, () => void>();
  const captures = new Map<number, ElementStub>();
  const document = Object.assign(new EventTarget(), {
    hidden,
    activeElement: null as ElementStub | null,
    documentElement: { dataset: {} },
  });
  class ElementStub extends EventTarget {
    readonly dataset: Record<string, string> = {};
    isConnected = true;
    constructor(
      readonly tagName = "DIV",
      readonly result = false,
    ) {
      super();
    }
    readonly attributes = new Map<string, string>();
    getAttribute(name: string) {
      return this.attributes.get(name) ?? null;
    }
    hasAttribute(name: string) {
      return this.attributes.has(name);
    }
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
    removeAttribute(name: string) {
      this.attributes.delete(name);
    }
    pause() {}
    load() {}
    style = { setProperty() {} };
    focus() {
      document.activeElement = this;
    }
    matches(selector: string) {
      return selector.split(",").includes(this.tagName.toLowerCase());
    }
    closest(selector: string) {
      return this.result && selector.includes(".bt-finish") ? this : null;
    }
    getClientRects() {
      return [{}];
    }
    contains(node: unknown) {
      return node === this;
    }
    querySelector() {
      return new ElementStub("BUTTON");
    }
    querySelectorAll(selector: string) {
      if (selector === ".bt-lane")
        return [0, 1, 2].map((lane) => ({
          getBoundingClientRect: () => ({
            left: 30 + lane * 100,
            right: 130 + lane * 100,
            top: 80,
            bottom: 600,
          }),
        }));
      return [];
    }
    setPointerCapture(pointerId: number) {
      captures.set(pointerId, this);
    }
    hasPointerCapture(pointerId: number) {
      return captures.get(pointerId) === this;
    }
    releasePointerCapture(pointerId: number) {
      if (this.hasPointerCapture(pointerId)) captures.delete(pointerId);
    }
  }
  const arena = new ElementStub();
  const source = new ElementStub("BUTTON");
  const query = Object.assign(new EventTarget(), { matches: reducedMotion });
  const window = Object.assign(new EventTarget(), { matchMedia: () => query });
  const replacements: Record<string, unknown> = {
    window,
    document,
    Image: class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        warmRequests.push(value);
        this.onload?.();
      }
      decode() {
        return Promise.resolve();
      }
      removeAttribute() {}
    },
    HTMLElement: ElementStub,
    performance: { now: () => now },
    IS_REACT_ACT_ENVIRONMENT: true,
    setInterval: (callback: () => void) => {
      const id = ++timerId;
      intervals.set(id, callback);
      return id;
    },
    clearInterval: (id: number) => intervals.delete(id),
    setTimeout: (callback: () => void) => {
      const id = ++timerId;
      timeouts.set(id, callback);
      return id;
    },
    clearTimeout: (id: number) => timeouts.delete(id),
  };
  const originals = Object.fromEntries(
    Object.keys(replacements).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(replacements))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(
      <BreakthroughArena
        roster={fighterRoster}
        playerDeck={deck}
        opponentDeck={deck}
        identity={{
          name: "Lifecycle player",
          level: 1,
          rank: "Rookie",
          avatarKey: "cornball",
          heroCardId: "cornball",
        }}
        initialSeed={17}
        preferredReducedMotion={reducedMotion}
        onChangeDeck={() => {}}
        onExit={() => {}}
      />,
      {
        createNodeMock: (element) =>
          element.type === "main" ? arena : new ElementStub(),
      },
    );
  });
  t.after(async () => {
    try {
      await act(async () => view.unmount());
      assert.equal(intervals.size, 0, "Unmount releases the practice clock.");
      assert.equal(captures.size, 0, "Unmount releases pointer capture.");
    } finally {
      for (const [key, descriptor] of Object.entries(originals)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  });
  function key(name: string, target = new ElementStub()) {
    const event = new Event("keydown", { cancelable: true });
    Object.defineProperties(event, {
      key: { value: name },
      target: { value: target },
    });
    window.dispatchEvent(event);
  }
  function pointer(extras: Record<string, unknown> = {}) {
    return {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      pointerType: "touch",
      clientX: 80,
      clientY: 700,
      currentTarget: source,
      target: source,
      type: "pointerdown",
      preventDefault() {},
      ...extras,
    };
  }
  return {
    view,
    document,
    warmRequests,
    fighterRoster,
    intervals,
    captures,
    arena,
    source,
    ElementStub,
    key,
    pointer,
    get clock() {
      return view.root.findByProps({ className: "bt-time" }).props[
        "aria-label"
      ];
    },
    get paused() {
      return view.root.findAllByProps({ className: "bt-cover" }).length > 0;
    },
    get menu() {
      return view.root.findAllByProps({ className: "bt-menu" }).length > 0;
    },
    get main() {
      return view.root.findByType("main");
    },
    get firstCard() {
      return view.root.findAll(
        (node) =>
          node.type === "button" &&
          node.props.className?.split(" ").includes("bt-card"),
      )[0]!;
    },
    get playerUnits() {
      return view.root.findAll(
        (node) =>
          node.type === "button" &&
          node.props.className?.split(" ").includes("bt-unit-player"),
      ).length;
    },
    async frame(at: number) {
      now = at;
      await act(async () => {
        for (const callback of [...intervals.values()]) callback();
      });
    },
    async finishPresentation() {
      await act(async () => {
        for (const [id, callback] of [...timeouts]) {
          timeouts.delete(id);
          callback();
        }
      });
    },
    async visibility(value: boolean) {
      document.hidden = value;
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    },
    async resume() {
      await act(async () =>
        view.root
          .findByProps({ className: "bt-cover" })
          .findByProps({ className: "bt-primary" })
          .props.onClick(),
      );
    },
    async hiddenWithQueuedFrame(at: number, deploy = false) {
      const queued = [...intervals.values()];
      await act(async () => {
        document.hidden = true;
        document.dispatchEvent(new Event("visibilitychange"));
        now = at;
        for (const callback of queued) callback();
        if (deploy) key("1");
      });
    },
  };
}

test("an arena mounted in a hidden tab starts paused and never advances before an explicit visible resume", async (t) => {
  const h = await mount(t, true);
  assert.equal(h.main.props["data-presentation-visible"], false);
  assert.equal(h.paused, true);
  assert.equal(h.intervals.size, 0);
  await h.frame(120000);
  assert.equal(h.clock, "180 seconds remaining");
  await h.visibility(false);
  assert.equal(
    h.paused,
    true,
    "Returning to the tab does not silently resume practice.",
  );
  await h.resume();
  await h.frame(121000);
  assert.equal(h.clock, "179 seconds remaining");
});

test("hiding stops the input clock synchronously before a queued tick or keyboard deployment can run", async (t) => {
  const h = await mount(t);
  await h.frame(1000);
  await act(async () => h.firstCard.props.onClick());
  const units = h.playerUnits;
  await h.hiddenWithQueuedFrame(90000, true);
  assert.equal(h.paused, true);
  assert.equal(
    h.clock,
    "179 seconds remaining",
    "A queued callback cannot charge hidden time before React commits.",
  );
  assert.equal(
    h.playerUnits,
    units,
    "An input arriving in that same hide task cannot deploy.",
  );
  await h.visibility(false);
  await h.resume();
  await h.frame(91000);
  assert.equal(h.clock, "178 seconds remaining");
});

test("menu pause and resume exclude the suspended wall clock", async (t) => {
  const h = await mount(t);
  await h.frame(1000);
  await act(async () =>
    h.view.root.findByProps({ className: "bt-menu-trigger" }).props.onClick(),
  );
  assert.equal(h.menu, true);
  assert.equal(h.intervals.size, 0);
  await h.frame(90000);
  assert.equal(h.clock, "179 seconds remaining");
  await act(async () =>
    h.view.root
      .findByProps({ className: "bt-menu" })
      .findByProps({ className: "bt-primary" })
      .props.onClick(),
  );
  await h.frame(91000);
  assert.equal(h.clock, "178 seconds remaining");
});

test("Escape closes the practice menu even when its arena select owns keyboard focus", async (t) => {
  const h = await mount(t);
  await act(async () =>
    h.view.root.findByProps({ className: "bt-menu-trigger" }).props.onClick(),
  );
  assert.equal(h.menu, true);
  await act(async () => h.key("Escape", new h.ElementStub("SELECT")));
  assert.equal(h.menu, false);
});

test("stale drag suppression cannot consume a pointer click on the result surface", async (t) => {
  const h = await mount(t);
  await act(async () => {
    h.main.props.onPointerDownCapture(h.pointer());
    h.firstCard.props.onPointerDown(h.pointer());
  });
  await act(async () =>
    h.main.props.onPointerMove(
      h.pointer({ clientY: 300, type: "pointermove" }),
    ),
  );
  await act(async () =>
    h.main.props.onPointerCancel(h.pointer({ type: "pointercancel" })),
  );
  let prevented = false,
    stopped = false;
  h.main.props.onClickCapture({
    target: new h.ElementStub("BUTTON", true),
    detail: 1,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {
      stopped = true;
    },
  });
  assert.equal(prevented, false);
  assert.equal(stopped, false);
  assert.equal(h.captures.size, 0);
});

test("rematch clears armed and inspection state and keeps a hidden replacement match paused", async (t) => {
  const h = await mount(t);
  await act(async () => {
    h.firstCard.props.onClick();
    h.view.root.findByProps({ className: "bt-squabble " }).props.onClick();
  });
  assert.equal(
    h.view.root.findByProps({ className: "bt-squabble armed" }).props[
      "aria-pressed"
    ],
    true,
  );
  await h.frame(180000);
  await h.finishPresentation();
  const result = h.view.root.findByType(ResultStage);
  await h.visibility(true);
  await act(async () => result.props.rematch());
  assert.equal(h.clock, "180 seconds remaining");
  assert.equal(h.paused, true);
  assert.equal(h.intervals.size, 0);
  assert.equal(
    h.view.root.findAllByProps({ className: "bt-mini-explainer" }).length,
    0,
  );
  assert.equal(
    h.view.root.findAll((node) => node.props.className?.includes("bt-selected"))
      .length,
    0,
  );
  await h.frame(900000);
  assert.equal(h.clock, "180 seconds remaining");
  await h.visibility(false);
  await h.resume();
  assert.equal(
    h.view.root.findByProps({ className: "bt-squabble " }).props[
      "aria-pressed"
    ],
    false,
  );
  await h.frame(901000);
  assert.equal(h.clock, "179 seconds remaining");
});

test("arena startup never speculatively decodes unused effect or health atlases", async (t) => {
  for (const state of [
    { name: "visible full motion", hidden: false, reducedMotion: false },
    { name: "initially hidden", hidden: true, reducedMotion: false },
    { name: "reduced motion", hidden: false, reducedMotion: true },
  ]) {
    await t.test(state.name, async (t) => {
      const h = await mount(t, state.hidden, state);
      assert.deepEqual(h.warmRequests, []);
    });
  }
});

test("compact arena art uses the reviewed derivative without changing roster artwork", async (t) => {
  const original = getCardImage("cornball");
  const compact = battlePortraitUrl(original);
  assert.notEqual(compact, original);
  const h = await mount(t, false, { art: original });
  assert.equal(h.firstCard.findByType("img").props.src, compact);
  assert.equal(
    h.view.root.findByProps({ className: "bt-next-draw" }).findByType("img")
      .props.src,
    compact,
  );
  await act(async () => h.firstCard.props.onClick());
  await act(async () => h.key("1"));
  const unit = h.view.root.findAll(
    (node) =>
      node.type === "button" &&
      node.props.className?.includes("bt-unit-player"),
  )[0];
  assert.ok(unit);
  assert.equal(unit.findAllByType("img")[0]?.props.src, compact);
  assert.ok(h.fighterRoster.every((card) => card.art === original));
});

test("the fire atlas retires only after its named envelope ends and replays for menu and rematch entry", async (t) => {
  const h = await mount(t, false, { reducedMotion: false });
  const fire = () =>
    h.view.root.findAllByProps({ className: "bt-fire-transition" });
  const end = async (animationName: string, child = false) => {
    const current = fire()[0];
    assert.ok(current);
    const node = {};
    await act(async () =>
      current.props.onAnimationEnd({
        animationName,
        currentTarget: node,
        target: child ? {} : node,
      }),
    );
  };
  assert.equal(fire().length, 1);
  await end("bt-b10-fire", true);
  await end("unrelated-animation");
  assert.equal(fire().length, 1);
  await end("bt-fire-finish");
  assert.equal(fire().length, 0);
  await h.frame(1000);
  assert.equal(fire().length, 0, "Clock renders cannot resurrect the atlas.");
  await act(async () =>
    h.view.root.findByProps({ className: "bt-menu-trigger" }).props.onClick(),
  );
  assert.equal(fire().length, 1);
  await act(async () => h.key("Escape"));
  assert.equal(
    fire().length,
    1,
    "Closing the menu retains the existing arena-entry replay.",
  );
  await end("bt-fire-finish");
  await h.frame(180000);
  await h.finishPresentation();
  await act(async () => h.view.root.findByType(ResultStage).props.rematch());
  assert.equal(fire().length, 1);
});

test("document visibility controls presentation separately from paused gameplay and completed results", async (t) => {
  const h = await mount(t);
  assert.equal(h.main.props["data-presentation-visible"], true);
  await h.visibility(true);
  assert.equal(h.main.props["data-presentation-visible"], false);
  await h.visibility(false);
  assert.equal(h.main.props["data-presentation-visible"], true);
  assert.equal(
    h.main.props["data-active"],
    false,
    "Visible pause screens keep gameplay paused.",
  );
  await h.resume();
  await h.frame(180000);
  await h.finishPresentation();
  assert.equal(h.main.props["data-active"], false);
  assert.equal(
    h.main.props["data-presentation-visible"],
    true,
    "Visible result art is allowed to finish.",
  );
  await h.visibility(true);
  assert.equal(h.main.props["data-presentation-visible"], false);
  await h.visibility(false);
  assert.equal(h.main.props["data-presentation-visible"], true);
  assert.equal(h.main.props["data-active"], false);
});

test("compact arena art keeps a future revision source intact", async (t) => {
  const original = getCardImage("cornball").replace(/v=[^&]+/, "v=future-art");
  assert.equal(battlePortraitUrl(original), original);
  const h = await mount(t, false, { art: original });
  assert.equal(h.firstCard.findByType("img").props.src, original);
  assert.ok(h.fighterRoster.every((card) => card.art === original));
});
