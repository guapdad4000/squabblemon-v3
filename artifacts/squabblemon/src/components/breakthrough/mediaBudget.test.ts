import assert from "node:assert/strict";
import test from "node:test";
import { checkBreakthroughMedia } from "../../../scripts/check-breakthrough-media.mjs";
test("reduced-motion deliveries match approved source pixels and alpha within the static media budget", async () => {
  const result = await checkBreakthroughMedia();
  assert.equal(result.assets, 17);
  assert.equal(result.pixelAndAlphaParity, true);
  assert.ok(result.stillBytes <= 1048576);
});
