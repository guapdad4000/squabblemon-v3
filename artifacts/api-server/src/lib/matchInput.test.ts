import assert from "node:assert/strict";
import test from "node:test";
import { CompletePlayerMatchBody } from "@workspace/api-zod";

const endRound = { cardInstanceId: null, lane: null, squabble: false };

test("match completion input accepts a four-round story transcript", () => {
  assert.doesNotThrow(() => CompletePlayerMatchBody.parse({ moves: Array.from({ length: 4 }, () => endRound) }));
  assert.throws(() => CompletePlayerMatchBody.parse({ moves: [] }));
});
