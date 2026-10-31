import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import FlameBaseHealth from "./FlameBaseHealth";

test("health hit art settles only on its own named animation and reduced motion chooses the settled phase", async () => {
  const previous = Object.getOwnPropertyDescriptor(
    globalThis,
    "IS_REACT_ACT_ENVIRONMENT",
  );
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  let view: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      view = create(<FlameBaseHealth lost={0} reducedMotion={false} />);
    });
    assert.ok(view);
    const rendered = view;
    await act(async () =>
      rendered.update(<FlameBaseHealth lost={1} reducedMotion={false} />),
    );
    const phase = () => rendered.root.findByType("i");
    assert.equal(phase().props.className, "bt-flame-art bt-flame-hit-one");
    const node = {};
    await act(async () =>
      phase().props.onAnimationEnd({
        currentTarget: node,
        target: {},
        animationName: "bt-flame-hit-one",
      }),
    );
    await act(async () =>
      phase().props.onAnimationEnd({
        currentTarget: node,
        target: node,
        animationName: "unrelated",
      }),
    );
    assert.equal(phase().props.className, "bt-flame-art bt-flame-hit-one");
    await act(async () =>
      phase().props.onAnimationEnd({
        currentTarget: node,
        target: node,
        animationName: "bt-flame-hit-one",
      }),
    );
    assert.equal(phase().props.className, "bt-flame-art bt-flame-half");
    await act(async () =>
      rendered.update(<FlameBaseHealth lost={2} reducedMotion />),
    );
    assert.equal(phase().props.className, "bt-flame-art bt-flame-empty");
    assert.equal(
      rendered.root.findByType("span").props["aria-label"],
      "0 of 2 base hits remaining",
    );
    await act(async () =>
      rendered.update(<FlameBaseHealth lost={0} reducedMotion={false} />),
    );
    assert.equal(phase().props.className, "bt-flame-art bt-flame-full");
  } finally {
    if (view) await act(async () => view?.unmount());
    if (previous)
      Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", previous);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
