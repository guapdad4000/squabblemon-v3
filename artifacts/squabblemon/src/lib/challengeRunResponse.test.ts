import test from "node:test";
import assert from "node:assert/strict";
import { challengeRunResponse } from "./challengeRunResponse";
test("bad saved-run responses become retryable errors rather than cabinet crashes", () => {
  for (const value of [
    { error: "unavailable" },
    null,
    [null],
    [{ id: "a", status: "active" }],
  ])
    assert.throws(() => challengeRunResponse(value), /reload/);
  assert.deepEqual(challengeRunResponse([]), []);
  const rows = [
    {
      id: "a",
      status: "complete",
      wins: 2,
      encounterIndex: 1,
      encounter: { rivalDeckId: "block" },
    },
  ];
  assert.equal(challengeRunResponse(rows), rows);
});
