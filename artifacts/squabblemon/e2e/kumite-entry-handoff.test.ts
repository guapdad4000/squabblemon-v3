import assert from "node:assert/strict";
import test from "node:test";
import { createKumitePreviewEntry } from "./kumite-entry-handoff";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
test("loading and cosmetic completion cannot start a hidden practice clock; visibility admits exactly once", async () => {
  const module = deferred<string>();
  const mounted: string[] = [];
  let visible = false;
  const entry = createKumitePreviewEntry({
    load: () => module.promise,
    visible: () => visible,
    mount: (value) => mounted.push(value),
    fail: (error) => {
      throw error;
    },
  });
  entry.enter();
  module.resolve("arena");
  await flush();
  assert.deepEqual(mounted, [], "Preloading must not mount the simulation.");
  entry.presentationComplete();
  assert.deepEqual(
    mounted,
    [],
    "Hidden completion is cosmetic readiness only.",
  );
  visible = true;
  entry.visibilityChanged();
  entry.visibilityChanged();
  entry.presentationComplete();
  assert.deepEqual(mounted, ["arena"]);
});
test("cancel and a new search invalidate stale import success and late cosmetic completion", async () => {
  const old = deferred<string>(),
    next = deferred<string>();
  const mounted: string[] = [];
  let attempts = 0;
  const entry = createKumitePreviewEntry({
    load: () => (++attempts === 1 ? old.promise : next.promise),
    visible: () => true,
    mount: (value) => mounted.push(value),
    fail: (error) => {
      throw error;
    },
  });
  entry.enter();
  await flush();
  entry.presentationComplete();
  entry.cancel();
  old.resolve("cancelled");
  await flush();
  entry.presentationComplete();
  assert.deepEqual(mounted, []);
  entry.enter();
  await flush();
  next.resolve("current");
  await flush();
  assert.deepEqual(mounted, []);
  entry.presentationComplete();
  assert.deepEqual(mounted, ["current"]);
});
test("a failed import is recoverable and stale failures cannot replace a newer attempt", async () => {
  const old = deferred<string>(),
    next = deferred<string>();
  const errors: unknown[] = [],
    mounted: string[] = [];
  let attempts = 0;
  const entry = createKumitePreviewEntry({
    load: () => {
      attempts++;
      return attempts === 1
        ? old.promise
        : attempts === 2
          ? next.promise
          : Promise.resolve("recovered");
    },
    visible: () => true,
    mount: (value) => mounted.push(value),
    fail: (error) => errors.push(error),
  });
  entry.enter();
  await flush();
  entry.cancel();
  entry.enter();
  await flush();
  old.reject(new Error("stale"));
  await flush();
  assert.equal(errors.length, 0);
  next.reject(new Error("network"));
  await flush();
  assert.equal(errors.length, 1);
  entry.presentationComplete();
  assert.deepEqual(mounted, []);
  entry.enter();
  await flush();
  entry.presentationComplete();
  assert.deepEqual(mounted, ["recovered"]);
  assert.equal(errors.length, 1);
});

test("duplicate entry requests preserve pending cosmetic readiness and load only once", async () => {
  const module = deferred<string>();
  const mounted: string[] = [];
  let loads = 0;
  let visible = false;
  const entry = createKumitePreviewEntry({
    load: () => {
      loads++;
      return module.promise;
    },
    visible: () => visible,
    mount: (value) => mounted.push(value),
    fail: (error) => {
      throw error;
    },
  });
  entry.enter();
  entry.enter();
  await flush();
  assert.equal(loads, 1, "Repeated clicks must reuse an in-flight entry.");
  entry.presentationComplete();
  entry.enter();
  module.resolve("arena");
  await flush();
  entry.enter();
  assert.equal(loads, 1);
  assert.deepEqual(mounted, []);
  visible = true;
  entry.visibilityChanged();
  entry.visibilityChanged();
  assert.deepEqual(
    mounted,
    ["arena"],
    "Repeated entry must not erase a finished burst while loading or hidden.",
  );
});
