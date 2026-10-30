import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Profiler } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  KumiteMatchMedia,
  type KumiteMatchMediaKind,
} from "./KumiteMatchMedia";
import "../../lib/battleMediaPlayback";

class TrackedTarget extends EventTarget {
  readonly listeners = new Map<
    string,
    Set<EventListenerOrEventListenerObject>
  >();
  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ) {
    if (callback) {
      const listeners =
        this.listeners.get(type) ??
        new Set<EventListenerOrEventListenerObject>();
      listeners.add(callback);
      this.listeners.set(type, listeners);
    }
    super.addEventListener(type, callback, options);
  }
  override removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ) {
    if (callback) this.listeners.get(type)?.delete(callback);
    super.removeEventListener(type, callback, options);
  }
  get listenerCount() {
    return [...this.listeners.values()].reduce(
      (sum, listeners) => sum + listeners.size,
      0,
    );
  }
}

class MediaNode extends TrackedTarget {
  readonly dataset: Record<string, string> = {
    mediaAnimated: "false",
    mediaPlaying: "false",
    mediaRetired: "false",
  };
  readonly attributes = new Map<string, string>();
  readonly sourceWrites: string[] = [];
  hidden = false;
  readonly style = { visibility: "" };
  reportedSrc?: string;
  complete = true;
  naturalWidth = 1;
  get currentSrc() {
    const source = this.reportedSrc ?? this.getAttribute("src");
    return source ? new URL(source, "https://squabblemon.test/").href : "";
  }
  paused = true;
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  initialized = false;
  nextPlay?: () => Promise<void>;
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === "src") this.sourceWrites.push(value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  pause() {
    this.pauseCalls++;
    this.paused = true;
  }
  load() {
    this.loadCalls++;
  }
  play() {
    this.playCalls++;
    this.paused = false;
    return this.nextPlay?.() ?? Promise.resolve();
  }
}

type Owner = {
  kind: KumiteMatchMediaKind;
  active: boolean;
  reducedMotion: boolean;
  elapsed: number;
  phase: "searching" | "reconnecting" | "matched" | "connecting" | "cancelled";
  encounter: string;
};

async function mount(
  t: TestContext,
  initial: Partial<Owner> = {},
  gates: {
    hidden?: boolean;
    osMotion?: boolean;
    documentMotion?: boolean;
  } = {},
) {
  let intersect:
    | ((entries: { target: unknown; isIntersecting: boolean }[]) => void)
    | undefined;
  let preferences: (() => void) | undefined;
  let commits = 0;
  let completions = 0;
  let preferenceObservers = 0;
  const observed = new Set<MediaNode>();
  const query = Object.assign(new TrackedTarget(), {
    matches: gates.osMotion ?? false,
  });
  const window = Object.assign(new TrackedTarget(), {
    matchMedia: () => query,
  });
  const document = Object.assign(new TrackedTarget(), {
    hidden: gates.hidden ?? false,
    baseURI: "https://squabblemon.test/",
    documentElement: {
      dataset: {
        reduceMotion: String(gates.documentMotion ?? false),
        reducedMotion: "false",
      },
    },
  });
  let node = new MediaNode();
  const nodes = [node];
  let owner: Owner = {
    kind: "monochrome",
    active: true,
    reducedMotion: false,
    elapsed: 0,
    phase: "searching",
    encounter: "first-search",
    ...initial,
  };
  const replacements: Record<string, unknown> = {
    window,
    document,
    IS_REACT_ACT_ENVIRONMENT: true,
    IntersectionObserver: class {
      constructor(callback: typeof intersect) {
        intersect = callback;
      }
      observe(value: MediaNode) {
        observed.add(value);
      }
      unobserve(value: MediaNode) {
        observed.delete(value);
      }
      disconnect() {
        observed.clear();
      }
    },
    MutationObserver: class {
      constructor(callback: () => void) {
        preferences = callback;
      }
      observe() {
        preferenceObservers++;
      }
      disconnect() {
        preferenceObservers--;
      }
    },
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

  let renderer!: ReactTestRenderer;
  let unmounted = false;
  let complete = () => {
    completions++;
  };
  const render = () => (
    <Profiler id="match-media" onRender={() => commits++}>
      <section data-phase={owner.phase}>
        <span>{owner.elapsed}</span>
        <KumiteMatchMedia
          key={owner.encounter}
          kind={owner.kind}
          active={owner.active}
          reducedMotion={owner.reducedMotion}
          onComplete={complete}
        />
      </section>
    </Profiler>
  );
  const flush = async () => {
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
  };
  await act(async () => {
    renderer = create(render(), {
      createNodeMock: (element) => {
        if (element.type !== "img" && element.type !== "video") return null;
        if (!node.initialized) {
          const props = element.props as { src?: string; poster?: string };
          if (props.src) node.attributes.set("src", props.src);
          if (props.poster) node.attributes.set("poster", props.poster);
          node.initialized = true;
        }
        return node;
      },
    });
  });
  await flush();

  async function unmount() {
    if (unmounted) return;
    unmounted = true;
    await act(async () => renderer.unmount());
    await flush();
  }
  t.after(async () => {
    try {
      await unmount();
      assert.equal(
        observed.size,
        0,
        "Unmount releases every media visibility subscription.",
      );
      assert.equal(
        preferenceObservers,
        0,
        "Unmount releases the shared preference observer.",
      );
      assert.equal(
        document.listenerCount,
        0,
        "Unmount removes document playback listeners.",
      );
      assert.equal(
        query.listenerCount,
        0,
        "Unmount removes OS motion listeners.",
      );
      for (const mediaNode of nodes)
        assert.equal(
          mediaNode.listenerCount,
          0,
          "Unmount removes media load, error and animation listeners.",
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
    query,
    renderer,
    get node() {
      return node;
    },
    get src() {
      return node.getAttribute("src");
    },
    get observers() {
      return observed.size;
    },
    get commits() {
      return commits;
    },
    get completions() {
      return completions;
    },
    async visible(value: boolean) {
      await act(async () =>
        intersect?.([{ target: node, isIntersecting: value }]),
      );
    },
    async hidden(value: boolean) {
      document.hidden = value;
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    },
    async osMotion(value: boolean) {
      query.matches = value;
      await act(async () => {
        query.dispatchEvent(new Event("change"));
      });
    },
    async documentMotion(
      value: boolean,
      alias: "reduceMotion" | "reducedMotion" = "reduceMotion",
    ) {
      document.documentElement.dataset[alias] = String(value);
      await act(async () => preferences?.());
    },
    async event(type: string, name?: string, target: unknown = node) {
      const event = new Event(type);
      if (name) Object.defineProperty(event, "animationName", { value: name });
      Object.defineProperty(event, "target", { value: target });
      await act(async () => {
        node.dispatchEvent(event);
      });
    },
    async callback(callback: () => void) {
      complete = callback;
      await act(async () => renderer.update(render()));
      await flush();
    },
    async update(next: Partial<Owner>) {
      if (
        (next.encounter && next.encounter !== owner.encounter) ||
        (next.kind && next.kind !== owner.kind)
      ) {
        node = new MediaNode();
        nodes.push(node);
      }
      owner = { ...owner, ...next };
      await act(async () => renderer.update(render()));
      await flush();
    },
    unmount,
  };
}

test("opaque videos acquire an animated source only while visible and all motion preferences allow it", async (t) => {
  const view = await mount(t);
  const video = view.renderer.root.findByType("video");
  assert.equal(video.props.preload, "none");
  assert.equal(video.props.muted, true);
  assert.equal(video.props.playsInline, true);
  assert.equal(video.props.tabIndex, -1);
  assert.match(
    view.node.getAttribute("poster") ?? "",
    /monochrome-brushstroke-split-still-v1\.webp$/,
  );
  assert.equal(
    view.src,
    null,
    "Offscreen media does not acquire a moving source.",
  );
  assert.equal(view.observers, 1);
  const commits = view.commits;

  await view.visible(true);
  assert.match(view.src ?? "", /monochrome-brushstroke-split-v1\.mp4$/);
  assert.equal(view.node.playCalls, 1);
  assert.equal(view.node.dataset.mediaPlaying, "false");
  await view.event("loadeddata");
  assert.equal(view.node.dataset.mediaPlaying, "true");
  await view.hidden(true);
  assert.equal(view.src, null);
  assert.equal(view.node.paused, true);
  assert.ok(view.node.loadCalls > 0, "Hiding unloads the video decoder.");
  await view.hidden(false);
  assert.match(view.src ?? "", /\.mp4$/);
  await view.osMotion(true);
  assert.equal(view.src, null);
  await view.osMotion(false);
  assert.match(view.src ?? "", /\.mp4$/);
  for (const alias of ["reduceMotion", "reducedMotion"] as const) {
    await view.documentMotion(true, alias);
    assert.equal(view.src, null);
    await view.documentMotion(false, alias);
    assert.match(view.src ?? "", /\.mp4$/);
  }
  await view.visible(false);
  assert.equal(view.src, null);
  assert.equal(
    view.commits,
    commits,
    "Visibility and preferences do not rerender the owner.",
  );
  await view.update({ reducedMotion: true });
  assert.equal(view.src, null);
  assert.equal(
    view.observers,
    0,
    "The local reduced-motion prop gates playback independently.",
  );
  await view.update({ reducedMotion: false });
  assert.equal(view.src, null);
  await view.visible(true);
  assert.match(view.src ?? "", /\.mp4$/);
});

test("inactive background videos keep a poster and pause and unload when their phase ends", async (t) => {
  const view = await mount(t, {
    kind: "color",
    active: false,
    phase: "matched",
  });
  assert.equal(view.observers, 0);
  assert.equal(view.src, null);
  assert.equal(view.node.playCalls, 0);
  assert.match(
    view.node.getAttribute("poster") ?? "",
    /brushstroke-fire-split-still-v1\.webp$/,
  );
  await view.update({ active: true });
  assert.equal(view.src, null);
  await view.visible(true);
  assert.match(view.src ?? "", /brushstroke-fire-split-v1\.mp4$/);
  const loads = view.node.loadCalls;
  await view.update({ active: false, phase: "cancelled" });
  assert.equal(view.src, null);
  assert.equal(view.node.paused, true);
  assert.ok(view.node.loadCalls > loads);
  assert.equal(view.observers, 0);
  await view.hidden(true);
  await view.hidden(false);
  assert.equal(
    view.src,
    null,
    "A cancelled phase cannot revive its background video.",
  );
});

test("a play promise interrupted by intentional hiding does not permanently poison a looping video", async (t) => {
  const view = await mount(t);
  let rejectPlay!: (reason: Error) => void;
  view.node.nextPlay = () =>
    new Promise<void>((_resolve, reject) => {
      rejectPlay = reject;
    });
  await view.visible(true);
  await view.hidden(true);
  await act(async () =>
    rejectPlay(
      Object.assign(new Error("Playback was intentionally interrupted."), {
        name: "AbortError",
      }),
    ),
  );
  view.node.nextPlay = undefined;
  await view.hidden(false);
  assert.match(view.src ?? "", /monochrome-brushstroke-split-v1\.mp4$/);
  assert.equal(view.node.dataset.mediaAnimated, "true");
});

test("failed animated alpha art falls back once and stays latched through visibility and owner rerenders", async (t) => {
  const view = await mount(t, { kind: "streak" });
  assert.match(view.src ?? "", /white-crack-streak-still-v1\.webp$/);
  await view.visible(true);
  assert.match(view.src ?? "", /white-crack-streak-v1\.webp$/);
  await view.event("load");
  assert.equal(view.node.dataset.mediaPlaying, "true");
  await view.event("error");
  assert.match(view.src ?? "", /white-crack-streak-still-v1\.webp$/);
  assert.equal(view.node.hidden, false);
  await view.visible(false);
  await view.visible(true);
  await view.update({ elapsed: 9 });
  await view.update({ active: false });
  await view.update({ active: true, phase: "reconnecting" });
  await view.visible(true);
  assert.match(view.src ?? "", /white-crack-streak-still-v1\.webp$/);
  assert.equal(
    view.node.sourceWrites.filter((src) =>
      /white-crack-streak-v1\.webp$/.test(src),
    ).length,
    1,
  );
  await view.event("error");
  assert.equal(
    view.node.hidden,
    true,
    "A failed still removes only its decorative element.",
  );
});

test("the finite found burst starts its CSS lifetime on load and retires only on its own named completion", async (t) => {
  const view = await mount(t, { kind: "burst", phase: "matched" });
  const commits = view.commits;
  await view.visible(true);
  assert.match(view.src ?? "", /ink-cross-slash-burst-v1\.webp$/);
  assert.equal(
    view.node.dataset.mediaPlaying,
    "false",
    "Source admission is not proof that a frame has loaded.",
  );
  assert.equal(view.completions, 0);
  await view.event("loadeddata");
  assert.equal(view.node.dataset.mediaPlaying, "false");
  await view.event("load");
  assert.equal(view.node.dataset.mediaPlaying, "true");
  assert.equal(view.completions, 0);
  await view.event("animationend", "another-animation");
  await view.event("animationend", "km-found-burst-life", new EventTarget());
  await view.event("animationcancel", "km-found-burst-life");
  assert.equal(view.node.dataset.mediaRetired, "false");
  assert.equal(view.completions, 0);
  assert.equal(view.observers, 1);
  await view.event("animationend", "km-found-burst-life");
  assert.equal(view.node.dataset.mediaRetired, "true");
  assert.equal(view.node.dataset.mediaPlaying, "false");
  assert.match(view.src ?? "", /ink-cross-slash-burst-still-v1\.webp$/);
  assert.equal(
    view.observers,
    0,
    "Completed finite media releases its playback observer.",
  );
  assert.equal(view.completions, 1);
  await view.hidden(true);
  await view.hidden(false);
  await view.visible(true);
  await view.event("animationend", "km-found-burst-life");
  assert.match(view.src ?? "", /ink-cross-slash-burst-still-v1\.webp$/);
  assert.equal(
    view.completions,
    1,
    "Presentation completion is delivered exactly once.",
  );
  assert.equal(view.commits, commits);
});

test("elapsed ticks and matched-to-connecting updates preserve the encounter and never replay its burst", async (t) => {
  const view = await mount(t, { kind: "burst", phase: "matched" });
  await view.visible(true);
  await view.event("load");
  const node = view.node;
  const writes = [...node.sourceWrites];
  for (let elapsed = 1; elapsed <= 8; elapsed++)
    await view.update({
      elapsed,
      phase: elapsed < 4 ? "matched" : "connecting",
    });
  assert.equal(view.node, node);
  assert.deepEqual(node.sourceWrites, writes);
  assert.equal(node.dataset.mediaPlaying, "true");
  assert.equal(view.observers, 1);
  await view.event("animationend", "km-found-burst-life");
  const retiredWrites = [...node.sourceWrites];
  await view.update({ elapsed: 20, phase: "connecting" });
  assert.deepEqual(node.sourceWrites, retiredWrites);
  assert.equal(node.dataset.mediaRetired, "true");
  assert.equal(view.completions, 1);
  await view.update({
    encounter: "next-authoritative-match",
    phase: "matched",
    elapsed: 0,
  });
  assert.notEqual(view.node, node);
  assert.equal(view.node.dataset.mediaRetired, "false");
  assert.equal(
    view.completions,
    1,
    "A new encounter has not completed its new burst.",
  );
  await view.visible(true);
  assert.match(view.src ?? "", /ink-cross-slash-burst-v1\.webp$/);
});

test("an interrupted or cancelled burst settles permanently instead of resuming when gates reopen", async (t) => {
  const view = await mount(t, { kind: "burst", phase: "matched" });
  await view.visible(true);
  await view.event("load");
  await view.hidden(true);
  assert.equal(view.node.dataset.mediaRetired, "true");
  assert.equal(view.completions, 1);
  assert.match(view.src ?? "", /ink-cross-slash-burst-still-v1\.webp$/);
  await view.hidden(false);
  await view.update({ reducedMotion: true });
  await view.update({ reducedMotion: false, phase: "connecting" });
  await view.visible(true);
  assert.match(view.src ?? "", /ink-cross-slash-burst-still-v1\.webp$/);
  assert.equal(
    view.node.sourceWrites.filter((src) =>
      /ink-cross-slash-burst-v1\.webp$/.test(src),
    ).length,
    1,
  );
  await view.update({ active: false, phase: "cancelled" });
  assert.equal(view.observers, 0);
  await view.update({ active: true });
  await view.visible(true);
  assert.equal(view.node.dataset.mediaRetired, "true");
  assert.equal(
    view.completions,
    1,
    "Interruptions and reopened gates cannot complete twice.",
  );
});

test("an initially hidden burst defers its first play and reduced motion before playback skips that encounter", async (t) => {
  const view = await mount(
    t,
    { kind: "burst", phase: "matched" },
    { hidden: true },
  );
  await view.visible(true);
  assert.match(view.src ?? "", /ink-cross-slash-burst-still-v1\.webp$/);
  assert.equal(view.node.dataset.mediaRetired, "false");
  assert.equal(
    view.completions,
    0,
    "An initially hidden encounter waits for its first visible playback.",
  );
  await view.hidden(false);
  assert.match(view.src ?? "", /ink-cross-slash-burst-v1\.webp$/);
  assert.equal(view.node.dataset.mediaPlaying, "false");
  await view.update({ reducedMotion: true });
  assert.equal(view.node.dataset.mediaRetired, "true");
  assert.equal(view.completions, 1);
  assert.match(view.src ?? "", /ink-cross-slash-burst-still-v1\.webp$/);
  await view.update({ reducedMotion: false });
  assert.equal(view.observers, 0);
  await view.visible(true);
  assert.match(view.src ?? "", /ink-cross-slash-burst-still-v1\.webp$/);
});

test("initial motion preferences complete the skipped burst once without requesting moving media", async (t) => {
  const cases = [
    { name: "component preference", owner: { reducedMotion: true }, gates: {} },
    { name: "OS preference", owner: {}, gates: { osMotion: true } },
    {
      name: "saved document preference",
      owner: {},
      gates: { documentMotion: true },
    },
  ];
  for (const scenario of cases)
    await t.test(scenario.name, async (child) => {
      const view = await mount(
        child,
        { kind: "burst", phase: "matched", ...scenario.owner },
        scenario.gates,
      );
      await view.visible(true);
      assert.equal(view.completions, 1);
      assert.equal(view.node.dataset.mediaRetired, "true");
      assert.equal(view.node.dataset.mediaAnimated, "false");
      assert.equal(
        view.node.sourceWrites.filter((src) =>
          /ink-cross-slash-burst-v1\.webp$/.test(src),
        ).length,
        0,
      );
      await view.osMotion(false);
      await view.documentMotion(false);
      await view.update({
        reducedMotion: false,
        phase: "connecting",
        elapsed: 2,
      });
      await view.visible(true);
      assert.equal(view.completions, 1);
      assert.equal(view.node.dataset.mediaAnimated, "false");
    });
});

test("a failed burst load completes its presentation once and cannot strand or replay its encounter", async (t) => {
  const view = await mount(t, { kind: "burst", phase: "matched" });
  await view.visible(true);
  assert.equal(view.node.dataset.mediaPlaying, "false");
  await view.event("error");
  assert.equal(view.completions, 1);
  assert.equal(view.node.dataset.mediaRetired, "true");
  assert.match(view.src ?? "", /ink-cross-slash-burst-still-v1\.webp$/);
  await view.event("error");
  await view.hidden(true);
  await view.hidden(false);
  await view.event("animationend", "km-found-burst-life");
  await view.update({ elapsed: 4, phase: "connecting" });
  await view.visible(true);
  assert.equal(view.completions, 1);
  assert.equal(
    view.node.sourceWrites.filter((src) =>
      /ink-cross-slash-burst-v1\.webp$/.test(src),
    ).length,
    1,
  );
});

test("unmount releases media observers and listeners and late events cannot touch retired artwork", async (t) => {
  const view = await mount(t, { kind: "streak" });
  await view.visible(true);
  await view.event("load");
  const node = view.node;
  await view.unmount();
  const writes = [...node.sourceWrites];
  assert.equal(view.src, null, "Unmount releases the animated image source.");
  assert.equal(view.observers, 0);
  assert.equal(node.listenerCount, 0);
  assert.equal(view.document.listenerCount, 0);
  assert.equal(view.query.listenerCount, 0);
  await view.event("load");
  await view.event("error");
  await view.event("animationend", "km-found-burst-life");
  await view.visible(true);
  await view.hidden(true);
  await view.hidden(false);
  assert.deepEqual(node.sourceWrites, writes);
});

test("an older interrupted play rejection cannot disable the replacement playback after tab return", async (t) => {
  const view = await mount(t);
  let rejectInterruptedPlay!: (reason: Error) => void;
  view.node.nextPlay = () =>
    new Promise<void>((_resolve, reject) => {
      rejectInterruptedPlay = reject;
    });
  await view.visible(true);
  await view.hidden(true);
  view.node.nextPlay = undefined;
  await view.hidden(false);
  await view.event("loadeddata");
  assert.equal(view.node.playCalls, 2);
  assert.equal(view.node.dataset.mediaPlaying, "true");
  await act(async () =>
    rejectInterruptedPlay(
      Object.assign(new Error("The earlier play was interrupted by pause()."), {
        name: "AbortError",
      }),
    ),
  );
  assert.match(
    view.src ?? "",
    /monochrome-brushstroke-split-v1\.mp4$/,
    "An obsolete play attempt cannot unload the replacement decoder.",
  );
  assert.equal(view.node.dataset.mediaAnimated, "true");
  assert.equal(view.node.dataset.mediaPlaying, "true");
  assert.equal(view.node.paused, false);
});

test("unmount pauses and unloads a pending video and ignores its later play rejection", async (t) => {
  const view = await mount(t, { kind: "color", phase: "matched" });
  let rejectPlay!: (reason: Error) => void;
  view.node.nextPlay = () =>
    new Promise<void>((_resolve, reject) => {
      rejectPlay = reject;
    });
  await view.visible(true);
  assert.match(view.src ?? "", /brushstroke-fire-split-v1\.mp4$/);
  const node = view.node;
  const pauses = node.pauseCalls;
  const loads = node.loadCalls;
  const writes = [...node.sourceWrites];
  await view.unmount();
  assert.equal(view.src, null);
  assert.equal(node.paused, true);
  assert.ok(node.pauseCalls > pauses);
  assert.ok(node.loadCalls > loads);
  assert.equal(view.observers, 0);
  assert.equal(node.listenerCount, 0);
  await act(async () => rejectPlay(new Error("A detached video cannot play.")));
  await view.event("loadeddata");
  await view.event("error");
  await view.visible(true);
  await view.hidden(true);
  await view.hidden(false);
  assert.equal(view.src, null);
  assert.deepEqual(node.sourceWrites, writes);
});

test("changing the completion callback preserves the burst and delivers completion to the current callback once", async (t) => {
  const view = await mount(t, { kind: "burst", phase: "matched" });
  await view.visible(true);
  await view.event("load");
  const writes = [...view.node.sourceWrites];
  let newCompletions = 0;
  await view.callback(() => newCompletions++);
  assert.equal(view.completions, 0);
  assert.equal(newCompletions, 0);
  assert.equal(view.node.dataset.mediaRetired, "false");
  assert.equal(view.node.dataset.mediaPlaying, "true");
  assert.deepEqual(view.node.sourceWrites, writes);
  await view.event("animationend", "km-found-burst-life");
  assert.equal(view.completions, 0);
  assert.equal(newCompletions, 1);
  await view.callback(() => newCompletions++);
  await view.event("animationend", "km-found-burst-life");
  assert.equal(newCompletions, 1);
});

test("a failed searching asset does not poison a new kind and old-node load/error events are inert", async (t) => {
  const view = await mount(t, { kind: "monochrome" });
  await view.visible(true);
  await view.event("error");
  const old = view.node;
  assert.equal(view.observers, 0);
  await view.update({ kind: "color", phase: "matched" });
  assert.equal(old.listenerCount, 0);
  await view.visible(true);
  assert.match(view.src ?? "", /brushstroke-fire-split-v1\.mp4$/);
  old.dispatchEvent(new Event("loadeddata"));
  old.dispatchEvent(new Event("error"));
  assert.equal(view.node.hidden, false);
  assert.equal(view.node.dataset.mediaAnimated, "true");
  await view.event("loadeddata");
  assert.equal(view.node.dataset.mediaPlaying, "true");
});

test("a retired burst cannot retire a replacement looping asset", async (t) => {
  const view = await mount(t, { kind: "burst", phase: "matched" });
  await view.visible(true);
  await view.event("load");
  await view.event("animationend", "km-found-burst-life");
  await view.update({ kind: "streak", phase: "searching" });
  await view.visible(true);
  assert.match(view.src ?? "", /white-crack-streak-v1\.webp$/);
  assert.equal(view.node.dataset.mediaRetired, "false");
});

test("a queued video error after intentional unload leaves its poster and next play usable", async (t) => {
  const view = await mount(t);
  await view.visible(true);
  await view.hidden(true);
  await view.event("error");
  assert.equal(view.node.hidden, false);
  await view.hidden(false);
  await view.event("loadeddata");
  assert.match(view.src ?? "", /monochrome-brushstroke-split-v1\.mp4$/);
  assert.equal(view.node.dataset.mediaPlaying, "true");
});

test("a failed initial still stays invisible without preventing a healthy animated image from loading", async (t) => {
  const view = await mount(t, { kind: "streak" });
  await view.event("error");
  assert.equal(view.node.style.visibility, "hidden");
  assert.equal(
    view.node.hidden,
    false,
    "The element retains observable geometry.",
  );
  await view.visible(true);
  assert.match(view.src ?? "", /white-crack-streak-v1\.webp$/);
  await view.event("load");
  assert.equal(view.node.style.visibility, "");
  assert.equal(view.node.hidden, false);
  await view.hidden(true);
  assert.equal(view.node.style.visibility, "hidden");
});

test("stale still and old-kind resource events cannot start or fail the currently requested burst", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const view = await mount(t, { kind: "burst", phase: "matched" });
  await view.visible(true);
  view.node.reportedSrc =
    "/assets/kumite/matchmaking/ink-cross-slash-burst-still-v1.webp";
  await view.event("load");
  await view.event("error");
  await view.event("animationend", "km-found-burst-life");
  assert.equal(view.completions, 0);
  assert.equal(view.node.dataset.mediaPlaying, "false");
  assert.match(view.src ?? "", /ink-cross-slash-burst-v1\.webp$/);
  await act(async () => t.mock.timers.tick(2920));
  assert.equal(
    view.completions,
    0,
    "A stale still load does not begin the finite lifetime.",
  );
  view.node.reportedSrc = undefined;
  view.node.complete = false;
  await view.event("load");
  assert.equal(view.node.dataset.mediaPlaying, "false");
  view.node.complete = true;
  await view.event("load");
  assert.equal(view.node.dataset.mediaPlaying, "true");
  await act(async () => t.mock.timers.tick(2920));
  assert.equal(view.completions, 1);
});

test("a pending play promise is shared across repeated allowed-gate notifications", async (t) => {
  const view = await mount(t);
  let resolvePlay!: () => void;
  view.node.nextPlay = () => {
    view.node.paused = true;
    return new Promise<void>((resolve) => {
      resolvePlay = resolve;
    });
  };
  await view.visible(true);
  await view.visible(true);
  await view.documentMotion(false);
  assert.equal(view.node.playCalls, 1);
  await act(async () => {
    view.node.paused = false;
    resolvePlay();
  });
  await view.hidden(true);
  view.node.nextPlay = undefined;
  await view.hidden(false);
  assert.equal(view.node.playCalls, 2);
});

test("synchronous play failures fall back to the poster and release decorative work", async (t) => {
  const view = await mount(t);
  view.node.nextPlay = () => {
    throw new Error("Playback is unavailable.");
  };
  await view.visible(true);
  assert.equal(view.src, null);
  assert.equal(view.node.hidden, false);
  assert.equal(view.observers, 0);
  assert.equal(view.node.paused, true);
});

test("a hidden or cancelled burst settles even when its moving image never loaded", async (t) => {
  for (const mode of ["hidden", "inactive", "reduced"] as const)
    await t.test(mode, async (child) => {
      const view = await mount(child, { kind: "burst", phase: "matched" });
      await view.visible(true);
      assert.equal(view.node.dataset.mediaPlaying, "false");
      if (mode === "hidden") await view.hidden(true);
      else if (mode === "inactive")
        await view.update({ active: false, phase: "cancelled" });
      else await view.osMotion(true);
      assert.equal(view.completions, 1);
      assert.equal(view.observers, 0);
      await view.hidden(false);
      await view.osMotion(false);
      await view.update({ active: true });
      await view.visible(true);
      assert.equal(view.node.dataset.mediaRetired, "true");
      assert.equal(view.completions, 1);
      assert.equal(
        view.node.sourceWrites.filter((src) =>
          /ink-cross-slash-burst-v1\.webp$/.test(src),
        ).length,
        1,
      );
    });
});

test("the burst finishes after its authored lifetime even when CSS never emits animationend", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const view = await mount(t, { kind: "burst", phase: "matched" });
  await view.visible(true);
  await view.event("load");
  await view.event("animationcancel", "km-found-burst-life");
  await act(async () => t.mock.timers.tick(2919));
  assert.equal(view.completions, 0);
  await act(async () => t.mock.timers.tick(1));
  assert.equal(view.completions, 1);
  assert.equal(view.observers, 0);
  assert.equal(view.node.dataset.mediaRetired, "true");
  await act(async () => t.mock.timers.tick(20_000));
  await view.event("animationend", "km-found-burst-life");
  assert.equal(view.completions, 1);
});

test("a load stall has a bounded escape only after visible admission", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const view = await mount(
    t,
    { kind: "burst", phase: "matched" },
    { hidden: true },
  );
  await view.visible(true);
  await act(async () => t.mock.timers.tick(20_000));
  assert.equal(view.completions, 0);
  await view.hidden(false);
  await act(async () => t.mock.timers.tick(9999));
  assert.equal(view.completions, 0);
  await act(async () => t.mock.timers.tick(1));
  assert.equal(view.completions, 1);
  assert.equal(view.observers, 0);
  assert.equal(view.node.dataset.mediaRetired, "true");
});

test("burst timers are cleared on hide, reduced motion, cancellation and unmount", async (t) => {
  for (const mode of ["hidden", "reduced", "inactive", "unmount"] as const)
    await t.test(mode, async (child) => {
      child.mock.timers.enable({ apis: ["setTimeout"] });
      const view = await mount(child, { kind: "burst", phase: "matched" });
      await view.visible(true);
      await view.event("load");
      if (mode === "hidden") await view.hidden(true);
      else if (mode === "reduced") await view.documentMotion(true);
      else if (mode === "inactive") await view.update({ active: false });
      else await view.unmount();
      const completions = view.completions;
      const writes = [...view.node.sourceWrites];
      await act(async () => child.mock.timers.tick(30_000));
      assert.equal(view.completions, completions);
      assert.deepEqual(view.node.sourceWrites, writes);
      assert.equal(view.observers, 0);
    });
});

test("unknown runtime media kinds render no decorative resource", async () => {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <KumiteMatchMedia kind={"unavailable" as KumiteMatchMediaKind} />,
    );
  });
  assert.equal(renderer.toJSON(), null);
  await act(async () => renderer.unmount());
});

test("victory art decodes only while visible and motion is allowed, retaining its approved still otherwise", async (t) => {
  const view = await mount(t, { kind: "victory" });
  assert.match(view.src ?? "", /results\/win-w-still\.webp$/);
  await view.visible(true);
  assert.match(view.src ?? "", /results\/win-w\.webp$/);
  await view.hidden(true);
  assert.match(view.src ?? "", /results\/win-w-still\.webp$/);
  await view.hidden(false);
  await view.update({ reducedMotion: true });
  assert.match(view.src ?? "", /results\/win-w-still\.webp$/);
  assert.equal(view.observers, 0);
});
