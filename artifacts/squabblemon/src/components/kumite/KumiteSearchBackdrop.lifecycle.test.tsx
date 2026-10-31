import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { KumiteSearchBackdrop } from "./KumiteSearchBackdrop";
import {
  KumiteMatchMedia,
  type KumiteMatchMediaKind,
} from "./KumiteMatchMedia";

test("assignment shows courts, arena entry alone starts the burst, and consumed entry cannot replay", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(
    globalThis,
    "IS_REACT_ACT_ENVIRONMENT",
  );
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  let view!: ReactTestRenderer;
  let entering = false;
  let completions = 0;
  let ready = () => {
    completions++;
  };
  const render = () => (
    <KumiteSearchBackdrop
      assigned
      searching={false}
      entering={entering}
      reducedMotion={false}
      onEntryComplete={ready}
    />
  );
  await act(async () => {
    view = create(render());
  });
  t.after(async () => {
    await act(async () => view.unmount());
    if (previous)
      Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", previous);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });
  const media = (kind: KumiteMatchMediaKind) =>
    view.root
      .findAllByType(KumiteMatchMedia)
      .filter((n) => n.props.kind === kind);
  assert.equal(
    media("burst").length,
    0,
    "Assignment must not create an entry burst.",
  );
  assert.equal(
    media("streak").length,
    0,
    "The parked streak is not part of Kumite.",
  );
  assert.equal(media("golden").length, 1);
  assert.equal(media("crimson").length, 1);
  assert.equal(media("color")[0].props.active, false);

  entering = true;
  await act(async () => view.update(render()));
  const burst = media("burst")[0];
  assert.ok(burst);
  assert.equal(burst.props.active, true);
  assert.equal(media("golden").length, 0);
  assert.equal(media("color")[0].props.active, true);
  await act(async () => view.update(render()));
  assert.equal(
    media("burst")[0],
    burst,
    "Ordinary owner renders preserve the current burst.",
  );

  await act(async () => {
    burst.props.onComplete();
  });
  assert.equal(media("burst").length, 0);
  assert.equal(
    media("golden").length,
    0,
    "Finishing entry must never return to the courts.",
  );
  assert.equal(media("crimson").length, 0);
  assert.equal(
    media("color")[0].props.active,
    true,
    "Keep energy behind a pending arena import.",
  );
  assert.equal(completions, 1);
  await act(async () => view.update(render()));
  assert.equal(
    completions,
    1,
    "Ordinary renders cannot repeat entry readiness.",
  );

  ready = () => {
    completions++;
  };
  await act(async () => view.update(render()));
  assert.equal(
    completions,
    1,
    "Changing an owner callback must not repeat consumed readiness.",
  );

  entering = false;
  await act(async () => view.update(render()));
  assert.equal(media("golden").length, 1);
  entering = true;
  await act(async () => view.update(render()));
  assert.equal(
    media("burst").length,
    0,
    "A consumed entry cannot re-arm inside the same encounter.",
  );
  assert.equal(media("golden").length, 0);
  assert.equal(media("streak").length, 0);
  assert.equal(media("color")[0].props.active, true);
  assert.equal(
    completions,
    2,
    "A later owner entry can reuse presentation readiness without replaying media.",
  );
});
