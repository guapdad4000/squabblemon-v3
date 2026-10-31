import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PlayerBootstrap } from "@workspace/api-client-react";
import { createArcadeRun, type ArcadeKind, type GirlRun } from "@workspace/squabblemon-engine/arcadeGames";
import { createWaffleRun } from "@workspace/squabblemon-engine/waffleRun";
import ArcadeGame, { type ArcadeGameStatus } from "./ArcadeGames";
import { WaffleRunGame, type WaffleRunStatus } from "./WaffleRunGame";
import { arcadeClockAt, arcadeNow, scheduleArcadeReset, useArcadeClock, useArcadeNow } from "./arcadeClock";

const localNow = Date.UTC(2026, 9, 20, 10);
const serverNow = localNow + 45_000;
const bootstrap = { profile: { id: "clock-test", settings: { reducedMotion: false } } } as PlayerBootstrap;
const earned = { softCurrency: 0, packTickets: 0, styleShards: 0 };
const cleanupByTest = new WeakMap<TestContext, (() => Promise<void>)[]>();

function environment(t: TestContext) {
  t.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: localNow });
  const document = Object.assign(new EventTarget(), { hidden: false, visibilityState: "visible" });
  const window = new EventTarget();
  const replacements: Record<string, unknown> = {
    document, window, localStorage: { getItem: () => "off", setItem() {} },
    Image: class { src = ""; decode() { return Promise.resolve(); } },
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = Object.fromEntries(Object.keys(replacements).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const cleanups: (() => Promise<void>)[] = [];
  cleanupByTest.set(t, cleanups);
  t.after(async () => {
    for (const cleanup of cleanups) await cleanup();
    for (const key of Object.keys(replacements)) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  // Unexpected fetches must never reach a real server from this harness.
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected test request"); });
  return document;
}

function arcadeStatus(kind: ArcadeKind, pattern = false): ArcadeGameStatus {
  const run = createArcadeRun(kind, "run-1", "2026-10-20", 7, serverNow);
  if (run.kind === "girl-fade" && pattern) {
    run.box.stage = "pattern";
    run.box.pattern = ["left", "up", "right"];
    run.box.opensAt = serverNow + 2200;
    run.box.deadline = serverNow + 15_000;
  }
  return { kind, period: "2026-10-20", attemptsRemaining: 1, resetsAt: new Date(serverNow + 86_400_000).toISOString(), serverNow, run, earned };
}
function waffleStatus(phase: "hopping" | "battle" | "learning" | "ended" = "hopping"): WaffleRunStatus {
  const run = createWaffleRun("waffle-1", "2026-10-20", 7, serverNow);
  run.phase = phase;
  return { date: run.day, attemptsRemaining: 1, resetsAt: new Date(serverNow + 86_400_000).toISOString(), serverNow, run, earned };
}
async function mount(t: TestContext, status: ArcadeGameStatus | WaffleRunStatus, strict = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, refetchOnMount: false } } });
  const key = "kind" in status ? ["arcade-game", status.kind, bootstrap.profile.id] : ["waffle-run", bootstrap.profile.id];
  client.setQueryData(key, status);
  let renderer!: ReactTestRenderer;
  await act(async () => {
    const cabinet = <QueryClientProvider client={client}>
      {"kind" in status
        ? <ArcadeGame kind={status.kind} bootstrap={bootstrap} onExit={() => {}} />
        : <WaffleRunGame bootstrap={bootstrap} onExit={() => {}} />}
    </QueryClientProvider>;
    renderer = create(strict ? <StrictMode>{cabinet}</StrictMode> : cabinet);
  });
  cleanupByTest.get(t)!.push(async () => { await act(async () => renderer.unmount()); client.clear(); });
  return { renderer, client, key };
}
async function tick(t: TestContext, milliseconds: number) {
  await act(async () => { t.mock.timers.tick(milliseconds); });
}

test("server offset is retained across wall-clock ticks, for clocks ahead and behind the device", (t) => {
  environment(t);
  for (const offset of [-120_000, 45_000]) {
    const clock = arcadeClockAt(localNow + offset);
    assert.equal(arcadeNow(clock), localNow + offset);
    t.mock.timers.tick(150);
    assert.equal(arcadeNow(clock), localNow + offset + 150);
    t.mock.timers.setTime(localNow);
  }
});

test("daily reset is server-timed, fires once, catches up on visibility and cancels on unmount", (t) => {
  const document = environment(t);
  const clock = arcadeClockAt(serverNow);
  let resets = 0;
  const cleanup = scheduleArcadeReset(clock, new Date(serverNow + 1000).toISOString(), () => resets++);
  t.mock.timers.tick(999);
  assert.equal(resets, 0);
  t.mock.timers.tick(1);
  assert.equal(resets, 1);
  document.dispatchEvent(new Event("visibilitychange"));
  t.mock.timers.tick(5000);
  assert.equal(resets, 1);
  cleanup();
  const cancel = scheduleArcadeReset(clock, new Date(arcadeNow(clock) + 1000).toISOString(), () => resets++);
  cancel();
  t.mock.timers.tick(1000);
  assert.equal(resets, 1);
  const resume = scheduleArcadeReset(clock, new Date(arcadeNow(clock) + 1000).toISOString(), () => resets++);
  // A suspended tab can resume after its timeout should have run.
  t.mock.timers.setTime(Date.now() + 2000);
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(resets, 2);
  resume();
});

test("reset hook deduplicates a stale reset response and schedules the next day", async (t) => {
  const document = environment(t);
  let resets = 0;
  const refetch = () => { resets++; };
  let status = { serverNow, resetsAt: new Date(serverNow + 1000).toISOString() };
  function Cabinet() { useArcadeClock(status, refetch); return null; }
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<Cabinet />); });
  await tick(t, 1000);
  assert.equal(resets, 1);
  status = { ...status, serverNow: serverNow + 1000 };
  await act(async () => { renderer.update(<Cabinet />); });
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(resets, 1);
  status = { serverNow: serverNow + 1000, resetsAt: new Date(serverNow + 2000).toISOString() };
  await act(async () => { renderer.update(<Cabinet />); });
  await tick(t, 1000);
  assert.equal(resets, 2);
  await act(async () => renderer.unmount());
});

test("clock widgets keep 120/150 ms resolution, use fresh server samples and stop when inactive", async (t) => {
  const document = environment(t);
  let clock = arcadeClockAt(serverNow);
  let active = true;
  let resolution = 120;
  let renders = 0;
  function Widget() { renders++; return <span>{useArcadeNow(clock, resolution, active)}</span>; }
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(<Widget />); });
  const read = () => Number(renderer.root.findByType("span").children[0]);
  assert.equal(read(), serverNow);
  await tick(t, 119);
  assert.equal(read(), serverNow);
  await tick(t, 1);
  assert.equal(read(), serverNow + 120);
  clock = arcadeClockAt(serverNow + 10_000);
  resolution = 150;
  await act(async () => { renderer.update(<Widget />); });
  assert.equal(read(), serverNow + 10_000);
  await tick(t, 150);
  assert.equal(read(), serverNow + 10_150);
  t.mock.timers.setTime(Date.now() + 5000);
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  assert.equal(read(), serverNow + 15_150);
  active = false;
  await act(async () => { renderer.update(<Widget />); });
  const inactiveRenders = renders;
  await tick(t, 6000);
  assert.equal(renders, inactiveRenders);
  await act(async () => renderer.unmount());
});

test("Girl Fade ticks only its active fight, not the cabinet/title/footer (6 seconds)", async (t) => {
  environment(t);
  const { renderer } = await mount(t, arcadeStatus("girl-fade", true));
  const cabinet = renderer.root.findByType("main").props;
  const title = renderer.root.findByProps({ className: "arc-run-title" }).props;
  const footer = renderer.root.findByProps({ className: "arc-run-footer" }).props;
  let previousFight = renderer.root.findByProps({ className: "girl-arena" }).props;
  let fightRenders = 0;
  for (let frame = 0; frame < 50; frame++) {
    await tick(t, 120);
    assert.equal(renderer.root.findByType("main").props, cabinet);
    assert.equal(renderer.root.findByProps({ className: "arc-run-title" }).props, title);
    assert.equal(renderer.root.findByProps({ className: "arc-run-footer" }).props, footer);
    const current = renderer.root.findByProps({ className: "girl-arena" }).props;
    if (current !== previousFight) fightRenders++;
    previousFight = current;
  }
  assert.equal(fightRenders, 50);
  t.diagnostic("6,000 ms / 120 ms: 50 active fight renders, 0 cabinet/title/footer renders.");
});

test("ready Girl Fade, Block Takeover and non-hopping Waffle phases have no idle clock renders", async (t) => {
  environment(t);
  for (const status of [arcadeStatus("girl-fade"), arcadeStatus("block-takeover"), waffleStatus("battle"), waffleStatus("learning"), waffleStatus("ended")]) {
    const { renderer } = await mount(t, status);
    const before = renderer.root.findByType("main").props;
    for (let frame = 0; frame < 40; frame++) {
      await tick(t, 150);
      assert.equal(renderer.root.findByType("main").props, before);
    }
    await act(async () => renderer.unmount());
  }
});

test("Waffle plate controls preserve cooldown, watched labels and 150 ms cadence without cabinet renders", async (t) => {
  const document = environment(t);
  const status = waffleStatus();
  const { renderer } = await mount(t, status);
  const cabinet = renderer.root.findByType("main").props;
  const scoreboard = renderer.root.findByProps({ className: "wr-score" }).props;
  const plates = () => renderer.root.findAllByProps({ className: "wr-plate" });
  assert.equal(plates()[1].props.disabled, true);
  await tick(t, 150);
  assert.equal(plates()[1].props.disabled, true);
  await tick(t, 150);
  assert.equal(plates()[1].props.disabled, false);
  assert.equal(plates()[2].props.disabled, false);
  assert.equal(plates()[3].props.disabled, true);
  assert.equal(plates()[1].props["data-watched"], true);
  let changes = 2;
  let previous = plates()[0].props;
  for (let frame = 2; frame < 40; frame++) {
    await tick(t, 150);
    assert.equal(renderer.root.findByType("main").props, cabinet);
    assert.equal(renderer.root.findByProps({ className: "wr-score" }).props, scoreboard);
    if (plates()[0].props !== previous) changes++;
    previous = plates()[0].props;
  }
  assert.equal(changes, 40);
  assert.equal(plates()[5].props["data-watched"], true);
  assert.equal(plates()[5].props["aria-label"], "Hop to plate 6 · staff watching");
  t.mock.timers.setTime(localNow + 9800);
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  assert.equal(plates()[2].props["data-watched"], true);
  assert.equal(renderer.root.findByType("main").props, cabinet);
  t.diagnostic("6,000 ms / 150 ms: 40 plate-control renders, 0 cabinet/scoreboard renders.");
});

test("Girl Fade opens inputs and submits the same queued directions once at the server deadline, including hidden tabs", async (t) => {
  const document = environment(t);
  const status = arcadeStatus("girl-fade", true);
  const run = status.run as GirlRun;
  run.box.opensAt = serverNow + 240;
  run.box.deadline = serverNow + 720;
  const requests: { revision: number; action: unknown }[] = [];
  t.mock.method(globalThis, "fetch", (_url: unknown, options: RequestInit) => {
    requests.push(JSON.parse(String(options.body)));
    return new Promise<Response>(() => {});
  });
  const { renderer } = await mount(t, status);
  const left = () => renderer.root.findByProps({ "aria-label": "Box left" });
  assert.equal(left().props.disabled, true);
  await tick(t, 120);
  assert.equal(left().props.disabled, true);
  await tick(t, 120);
  assert.equal(left().props.disabled, false);
  await act(async () => left().props.onClick());
  document.hidden = true;
  document.visibilityState = "hidden";
  await tick(t, 360);
  assert.equal(requests.length, 0);
  await tick(t, 120);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].revision, run.revision);
  assert.deepEqual(requests[0].action, { type: "pattern", directions: ["left"] });
  await tick(t, 600);
  assert.equal(requests.length, 1);
});

test("Waffle audio remains gesture-unlockable after StrictMode setup/cleanup replay and closes on exit", async (t) => {
  environment(t);
  const contexts: { closes: number; resumes: number }[] = [];
  class Context {
    state = "suspended";
    closes = 0;
    resumes = 0;
    constructor() { contexts.push(this); }
    resume() { this.resumes++; this.state = "running"; return Promise.resolve(); }
    close() { this.closes++; this.state = "closed"; return Promise.resolve(); }
  }
  Object.assign(window, { AudioContext: Context });
  const { renderer } = await mount(t, waffleStatus(), true);
  const enable = renderer.root.findByProps({ "aria-label": "Enable Waffle Run sounds" });
  await act(async () => enable.props.onClick());
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].resumes, 1);
  renderer.root.findByType("main").props.onPointerDownCapture();
  renderer.root.findByType("main").props.onClickCapture();
  renderer.root.findByType("main").props.onKeyDownCapture();
  assert.equal(contexts.length, 1);
  await act(async () => renderer.unmount());
  assert.equal(contexts[0].closes, 1);
});

test("off-grid Girl Fade response keeps the original 120 ms cabinet grid when a pattern becomes active", async (t) => {
  environment(t);
  const status = arcadeStatus("girl-fade");
  const { renderer, client, key } = await mount(t, status);
  await tick(t, 180);
  const next = arcadeStatus("girl-fade", true);
  next.serverNow += 180;
  (next.run as GirlRun).revision++;
  (next.run as GirlRun).box.opensAt = serverNow + 2380;
  await act(async () => { client.setQueryData(key, next); t.mock.timers.tick(0); });
  const left = () => renderer.root.findByProps({ "aria-label": "Box left" });
  assert.equal(left().props.disabled, true);
  await tick(t, 60); // The next tick remains at 240, not 300.
  for (let now = 240; now < 2280; now += 120) await tick(t, 120);
  assert.equal(left().props.disabled, true);
  await tick(t, 120);
  assert.equal(left().props.disabled, false, "opens at 2400 ms, not a delayed 2460 ms");
});

test("off-grid Waffle response retains the original 150 ms grid for the 260 ms cooldown", async (t) => {
  environment(t);
  const status = waffleStatus();
  const { renderer, client, key } = await mount(t, status);
  await tick(t, 150);
  await tick(t, 30);
  const next = waffleStatus();
  next.serverNow += 180;
  next.run!.revision++;
  next.run!.phaseStartedAt = serverNow + 180;
  await act(async () => { client.setQueryData(key, next); t.mock.timers.tick(0); });
  const target = () => renderer.root.findAllByProps({ className: "wr-plate" })[1];
  assert.equal(target().props.disabled, true);
  await tick(t, 120);
  assert.equal(target().props.disabled, true);
  await tick(t, 150);
  assert.equal(target().props.disabled, false, "opens at 450 ms, not a delayed 480 ms");
});
