import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import ResultStage from "./ResultStage";
import { KumiteMatchMedia } from "../kumite/KumiteMatchMedia";

const actions = {
  rematch: () => {},
  newDeal: () => {},
  onExit: () => {},
};
const base = {
  breaches: [2, 1] as [number, number],
  hands: [12, 8] as [number, number],
  reducedMotion: false,
  ...actions,
};

async function mount(
  t: TestContext,
  winner: string | null,
  reducedMotion = false,
) {
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    "IS_REACT_ACT_ENVIRONMENT",
  );
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <ResultStage {...base} winner={winner} reducedMotion={reducedMotion} />,
    );
  });
  t.after(async () => {
    await act(async () => renderer.unmount());
    if (original)
      Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", original);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });
  return renderer;
}

test("results admit courtyard motion only on the winning side and keep draws static", async (t) => {
  for (const scenario of [
    { winner: "player", active: [true, false] },
    { winner: "opponent", active: [false, true] },
    { winner: null, active: [false, false] },
  ]) {
    await t.test(scenario.winner ?? "draw", async (child) => {
      const view = await mount(child, scenario.winner);
      const media = view.root
        .findAllByType(KumiteMatchMedia)
        .filter((node) => node.props.kind !== "victory");
      assert.deepEqual(
        media.map((node) => node.props.kind),
        ["golden", "crimson"],
      );
      assert.deepEqual(
        media.map((node) => node.props.active),
        scenario.active,
      );
      const courts = view.root.findAll((node) =>
        node.props.className?.startsWith("bt-result-court "),
      );
      assert.deepEqual(
        courts.map((node) => node.props["data-winning"]),
        scenario.active,
      );
      assert.ok(
        view.root.findByProps({ className: "bt-result-courts" }).props[
          "aria-hidden"
        ],
      );
    });
  }
});

test("results pass reduced motion to both courtyards while retaining the winner highlight", async (t) => {
  const view = await mount(t, "opponent", true);
  const media = view.root
    .findAllByType(KumiteMatchMedia)
    .filter((node) => node.props.kind !== "victory");
  assert.deepEqual(
    media.map((node) => node.props.reducedMotion),
    [true, true],
  );
  assert.deepEqual(
    media.map((node) => node.props.active),
    [false, true],
  );
  assert.match(
    view.root.findByType("section").props.className,
    /bt-finish-still/,
  );
});

test("courtyard presentation preserves the result receipt and existing actions", () => {
  let calls = 0;
  const html = renderToStaticMarkup(
    <ResultStage
      {...base}
      winner="player"
      reason="Hands decided"
      breaches={[2, 2]}
      stats={{ damage: 145, deployments: 7 }}
      rematch={() => calls++}
      newDeal={() => calls++}
      onExit={() => calls++}
    />,
  );
  assert.match(html, /role="dialog" aria-modal="true" aria-label="Win"/);
  assert.match(html, /HANDS 12 — 8/);
  assert.match(html, /CPU PRACTICE/);
  assert.match(html, /NO ACCOUNT REWARDS/);
  assert.match(html, /Breakthrough fist trophy/);
  assert.match(html, /DAMAGE/);
  assert.match(html, /145/);
  assert.match(html, /PLAYED/);
  assert.match(html, /RUN IT BACK/);
  assert.match(html, /CHANGE DECK/);
  assert.match(html, /BACK TO KUMITE/);
  assert.equal((html.match(/<button/g) ?? []).length, 3);
  assert.equal(
    calls,
    0,
    "Decorative result rendering cannot invoke actions or grant rewards.",
  );
});

async function interactiveResult(
  t: TestContext,
  options: Partial<Parameters<typeof ResultStage>[0]> = {},
) {
  const listeners = new Set<EventListenerOrEventListenerObject>();
  class FocusDocument extends EventTarget {
    activeElement: unknown = null;
    body = {};
    override addEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: AddEventListenerOptions | boolean,
    ) {
      if (type === "focusin" && callback) listeners.add(callback);
      super.addEventListener(type, callback, options);
    }
    override removeEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: EventListenerOptions | boolean,
    ) {
      if (type === "focusin" && callback) listeners.delete(callback);
      super.removeEventListener(type, callback, options);
    }
  }
  const document = new FocusDocument();
  const focus = (target: unknown) => {
    document.activeElement = target;
    const event = new Event("focusin");
    Object.defineProperty(event, "target", { value: target });
    document.dispatchEvent(event);
  };
  const button = () => ({
    disabled: false,
    visible: true,
    isConnected: true,
    focusCalls: 0,
    focus() {
      this.focusCalls++;
      focus(this);
    },
    getClientRects() {
      return this.visible ? [{}] : [];
    },
  });
  const origin = button();
  document.activeElement = origin;
  const buttons = [button(), button(), button()];
  const node = {
    querySelectorAll: () => buttons.filter((button) => !button.disabled),
    contains: (target: unknown) =>
      target === node || buttons.includes(target as typeof origin),
    focus() {
      focus(node);
    },
  };
  const replacements = { document, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = Object.fromEntries(
    Object.keys(replacements).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(replacements))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  let props = { ...base, winner: "player", ...options };
  let view!: ReactTestRenderer;
  let unmounted = false;
  await act(async () => {
    view = create(<ResultStage {...props} />, {
      createNodeMock: (element) => (element.type === "section" ? node : null),
    });
  });
  async function unmount() {
    if (unmounted) return;
    unmounted = true;
    await act(async () => view.unmount());
  }
  t.after(async () => {
    try {
      await unmount();
      assert.equal(
        listeners.size,
        0,
        "The result releases its modal focus listener.",
      );
    } finally {
      for (const [key, descriptor] of Object.entries(originals)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  });
  return {
    document,
    origin,
    buttons,
    node,
    view,
    get focusListeners() {
      return listeners.size;
    },
    get stage() {
      return view.root.findByType("section");
    },
    key(key: string, shiftKey = false) {
      let prevented = false,
        stopped = false;
      view.root.findByType("section").props.onKeyDown({
        key,
        shiftKey,
        preventDefault() {
          prevented = true;
        },
        stopPropagation() {
          stopped = true;
        },
      });
      return { prevented, stopped };
    },
    async update(next: typeof options) {
      props = { ...props, ...next };
      await act(async () => view.update(<ResultStage {...props} />));
    },
    unmount,
  };
}

test("the result contains keyboard focus, wraps visible actions and restores its origin on close", async (t) => {
  const result = await interactiveResult(t);
  assert.equal(result.document.activeElement, result.buttons[0]);
  assert.equal(result.focusListeners, 1);
  assert.deepEqual(result.key("Tab", true), { prevented: true, stopped: true });
  assert.equal(result.document.activeElement, result.buttons[2]);
  assert.deepEqual(result.key("Tab"), { prevented: true, stopped: true });
  assert.equal(result.document.activeElement, result.buttons[0]);
  result.buttons[1].focus();
  assert.deepEqual(result.key("Tab"), { prevented: false, stopped: true });
  const outside = { target: "behind the result" };
  result.document.activeElement = outside;
  const escaped = new Event("focusin");
  Object.defineProperty(escaped, "target", { value: outside });
  result.document.dispatchEvent(escaped);
  assert.equal(result.document.activeElement, result.buttons[0]);
  await result.unmount();
  assert.equal(result.document.activeElement, result.origin);
  assert.equal(result.focusListeners, 0);
  result.document.activeElement = outside;
  result.document.dispatchEvent(escaped);
  assert.equal(
    result.document.activeElement,
    outside,
    "A closed result cannot steal focus.",
  );
});

test("a result traps focus safely when actions become hidden or disabled", async (t) => {
  const result = await interactiveResult(t);
  result.buttons[0].visible = false;
  result.buttons[1].disabled = true;
  result.node.focus();
  assert.equal(result.key("Tab").prevented, true);
  assert.equal(result.document.activeElement, result.buttons[2]);
  result.buttons[2].visible = false;
  assert.equal(result.key("Tab").prevented, true);
  assert.equal(result.document.activeElement, result.node);
});

test("result owner updates preserve focus and media instances without adding modal listeners", async (t) => {
  const result = await interactiveResult(t);
  result.buttons[2].focus();
  const courts = result.view.root.findAllByType(KumiteMatchMedia);
  await result.update({
    stats: { damage: 166, deployments: 9 },
    reducedMotion: true,
  });
  assert.equal(result.document.activeElement, result.buttons[2]);
  assert.equal(result.focusListeners, 1);
  assert.deepEqual(result.view.root.findAllByType(KumiteMatchMedia), courts);
  assert.deepEqual(
    courts.map((court) => court.props.reducedMotion),
    [true, true, true],
  );
});

test("result actions and gestures cannot bubble into battlefield click or shortcut handlers", async (t) => {
  let rematches = 0,
    newDeals = 0,
    exits = 0,
    battlefieldClicks = 0;
  const result = await interactiveResult(t, {
    rematch: () => rematches++,
    newDeal: () => newDeals++,
    onExit: () => exits++,
  });
  const buttons = result.view.root.findAllByType("button");
  for (const type of ["onClick", "onPointerDown"] as const) {
    let stopped = false;
    if (type === "onClick") buttons[0]!.props.onClick();
    result.stage.props[type]({
      stopPropagation() {
        stopped = true;
      },
    });
    if (!stopped) battlefieldClicks++;
  }
  assert.equal(rematches, 1);
  assert.equal(newDeals, 0);
  assert.equal(exits, 0);
  assert.equal(battlefieldClicks, 0);
  assert.deepEqual(result.key("Escape"), { prevented: true, stopped: true });
  assert.equal(
    newDeals,
    1,
    "Escape invokes the existing change-deck action once.",
  );
  assert.equal(
    result.key("1").stopped,
    true,
    "Arena keyboard shortcuts do not receive result events.",
  );
});

test("the victory artwork uses the visibility-gated image player and receives the saved motion preference", async (t) => {
  const view = await mount(t, "player", true);
  const victory = view.root
    .findAllByType(KumiteMatchMedia)
    .find((node) => node.props.kind === "victory");
  assert.ok(victory);
  assert.equal(victory.props.reducedMotion, true);
  assert.equal(
    view.root.findByProps({ className: "bt-finish-hand bt-win-motion" }).props[
      "aria-label"
    ],
    "Win",
  );
});
