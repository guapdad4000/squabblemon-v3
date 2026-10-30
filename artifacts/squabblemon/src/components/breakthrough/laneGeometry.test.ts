import assert from "node:assert/strict";
import { test } from "node:test";
import { trackPosition } from "./laneGeometry";

test("fighters and effect anchors use the same center-based track at both bases and contact", () => {
  for (const position of [0, 0.22, 0.5, 0.78, 1]) {
    const style = trackPosition(position) as Record<string, unknown>;
    assert.equal(style["--bt-position"], position);
    assert.equal(
      style.bottom,
      "calc(var(--bt-track-edge) + var(--bt-track-span) * var(--bt-position))",
    );
    assert.equal(style.top, undefined);
    assert.equal(style.transform, undefined);
  }
});

test("overshoot is clamped to the base while separate anchors cannot mutate each other", () => {
  const home = trackPosition(-0.01) as Record<string, unknown>;
  const away = trackPosition(1.01) as Record<string, unknown>;
  assert.equal(home["--bt-position"], 0);
  assert.equal(away["--bt-position"], 1);
  home["--bt-position"] = 0.5;
  assert.equal(
    (trackPosition(-0.01) as Record<string, unknown>)["--bt-position"],
    0,
  );
  assert.equal(away["--bt-position"], 1);
});
