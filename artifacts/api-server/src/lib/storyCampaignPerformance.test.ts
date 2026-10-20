import assert from "node:assert/strict";
import test from "node:test";
import type { PlayerStoryNodeRecord } from "@workspace/db";
import { storyContent } from "@workspace/squabblemon-engine/story";
import { buildStoryCampaign } from "./storyService";
import { buildStoryCampaignReference } from "./storyCampaignReference.fixture";

const contentNodes = storyContent.chapters.flatMap(chapter =>
  chapter.nodes.map(node => ({ chapter, node })),
);
const fixedDate = new Date("2026-10-12T12:00:00.000Z");

function progress(index: number, cleared: boolean): PlayerStoryNodeRecord {
  const { chapter, node } = contentNodes[index]!;
  return {
    id: `fixture-${index}`,
    clerkUserId: "campaign-performance-fixture",
    chapterId: chapter.id,
    nodeId: node.id,
    cleared,
    stars: index % 4,
    attempts: index % 5,
    wins: cleared ? 1 : 0,
    lastOutcome: cleared ? "win" : index % 2 ? "loss" : null,
    dialogueSeen: [`${node.id}:intro`],
    bossProgress: { highestPhase: index % 3, completedObjectiveIds: [`objective-${index}`] },
    firstClearedAt: cleared ? fixedDate : null,
    lastPlayedAt: index % 2 ? fixedDate : null,
    createdAt: fixedDate,
    updatedAt: fixedDate,
  };
}

function assertSameCampaign(rows: PlayerStoryNodeRecord[]) {
  const before = structuredClone(rows);
  const expected = buildStoryCampaignReference(rows);
  const actual = buildStoryCampaign(rows);
  assert.deepEqual(actual, expected);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), "field and array ordering stay identical");
  assert.deepEqual(rows, before, "building a response must not mutate stored progress");
}

test("campaign indexing preserves the entire reference response for all progression shapes", () => {
  assert.equal(new Set(storyContent.chapters.map(chapter => chapter.id)).size, storyContent.chapters.length);
  assert.equal(new Set(contentNodes.map(({ node }) => node.id)).size, contentNodes.length);
  assertSameCampaign([]);
  assertSameCampaign(contentNodes.map((_, index) => progress(index, true)));
  assertSameCampaign(contentNodes.flatMap(({ node }, index) => node.optional ? [] : [progress(index, true)]));
  assertSameCampaign(contentNodes.flatMap(({ node }, index) => node.optional ? [progress(index, true)] : []));
  assertSameCampaign(contentNodes.map((_, index) => progress(index, false)));
  for (let seed = 0; seed < 12; seed++) {
    assertSameCampaign(contentNodes.flatMap((_, index) =>
      (index * 17 + seed) % 5 ? [progress(index, (index + seed) % 3 === 0)] : [],
    ).reverse());
  }
  const first = progress(0, true);
  assertSameCampaign([
    first,
    { ...first, cleared: false, stars: 0 },
    { ...first, nodeId: "unknown-future-node", chapterId: "unknown-future-chapter" },
  ]);
});

test("campaign indexes remain request-local and reflect fresh progress", () => {
  const empty = buildStoryCampaign([]);
  const complete = buildStoryCampaign(contentNodes.map((_, index) => progress(index, true)));
  const freshEmpty = buildStoryCampaign([]);
  assert.notEqual(complete.completedNodes, empty.completedNodes);
  assert.deepEqual(freshEmpty, empty);
  assert.notEqual(freshEmpty, empty);
  assert.notEqual(freshEmpty.nodes, empty.nodes);
  assert.notEqual(freshEmpty.chapters, empty.chapters);
});

/** Count synchronous array predicate visits, not elapsed time or production latency. */
function measurePredicateVisits<T>(run: () => T) {
  const methods = ["find", "filter", "some"] as const;
  const counts = { find: 0, filter: 0, some: 0 };
  const descriptors = methods.map(name => [name, Object.getOwnPropertyDescriptor(Array.prototype, name)!] as const);
  try {
    for (const [name, descriptor] of descriptors) {
      const original = descriptor.value as (...args: unknown[]) => unknown;
      Object.defineProperty(Array.prototype, name, {
        ...descriptor,
        value: function (this: unknown[], callback: (...args: unknown[]) => unknown, thisArg?: unknown) {
          return original.call(this, (value: unknown, index: number, array: unknown[]) => {
            counts[name]++;
            return callback.call(thisArg, value, index, array);
          });
        },
      });
    }
    return { value: run(), counts, total: counts.find + counts.filter + counts.some };
  } finally {
    for (const [name, descriptor] of descriptors) Object.defineProperty(Array.prototype, name, descriptor);
  }
}

test("campaign serialization eliminates repeated chapter/node scans", t => {
  const rows = contentNodes.flatMap((_, index) => index % 3 ? [progress(index, index % 2 === 0)] : []);
  const before = measurePredicateVisits(() => buildStoryCampaignReference(rows));
  const after = measurePredicateVisits(() => buildStoryCampaign(rows));
  assert.deepEqual(after.value, before.value);
  assert(after.total < before.total / 2, `expected less than half the predicate work: ${before.total} -> ${after.total}`);
  assert(after.counts.find < before.counts.find);
  assert(after.counts.filter < before.counts.filter);
  assert(after.counts.some < before.counts.some);
  t.diagnostic(`Campaign ${storyContent.chapters.length} chapters/${contentNodes.length} nodes: find/filter/some predicate visits ${before.total} -> ${after.total}; exact response equality.`);
});
