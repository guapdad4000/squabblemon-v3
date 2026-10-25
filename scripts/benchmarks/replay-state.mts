import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
const current = await import(process.env.REPLAY_ENGINE!);
const baseline = await import(process.env.REPLAY_BASELINE!);
function workload(engine: typeof current) {
  let match = engine.createMatch('vibes', 'vibes');
  match = { ...match, boards: [[], [], []], playerHand: [], cpuHand: [], playerMotion: 100 };
  for (let i = 0; i < 72; i++) {
    const card = engine.createCardInstance('cornball', i % 2 ? 'cpu' : 'player', 'loaded-board', i);
    card.lane = i % 3 as 0|1|2; match.boards[card.lane].push(card);
  }
  for (let i = 0; i < 24; i++) {
    const card = engine.createCardInstance('cornball', 'player', 'subsequent-plays', i);
    match = engine.playCard({ ...match, phase: 'player', playerMotion: 100, playerHand: [card] }, 'player', card.instanceId, i % 3 as 0|1|2);
  }
  return match;
}
function snapshotNodes(match: any) {
  const seen = new Set<object>();
  function walk(value: any) { if (!value || typeof value !== 'object' || seen.has(value)) return; seen.add(value); for (const child of Object.values(value)) walk(child); }
  for (const event of match.effectLog) walk(event.replay);
  return seen.size;
}
const old = workload(baseline), next = workload(current);
assert.deepEqual(JSON.parse(JSON.stringify(next)), JSON.parse(JSON.stringify(old)));
const archive = current.compactMatchReplay(next);
assert.deepEqual(JSON.parse(JSON.stringify(current.restoreMatchReplay(JSON.parse(JSON.stringify(archive))))), JSON.parse(JSON.stringify(next)));
const timings: Record<string, number[]> = { baseline: [], current: [] };
for (let i = 0; i < 9; i++) {
  for (const [name, engine] of (i % 2 ? [['current', current], ['baseline', baseline]] : [['baseline', baseline], ['current', current]]) as [string, typeof current][]) {
    globalThis.gc?.(); const start = performance.now(); workload(engine); timings[name].push(performance.now() - start);
  }
}
const median = (samples: number[]) => [...samples].sort((a,b) => a-b)[Math.floor(samples.length/2)];
console.log(JSON.stringify({ node: process.version, workload: '72 populated-board cards + 24 same-round cornball plays, no rendering/network, unlimited board', events: next.effectLog.length, finalCards: next.boards.flat().length, parity: 'exact JSON full match including every replay frame', snapshotNodes: { baseline: snapshotNodes(old), current: snapshotNodes(next) }, bytes: { full: JSON.stringify(next).length, archive: JSON.stringify(archive).length }, medianMs: { baseline: median(timings.baseline), current: median(timings.current) }, samplesMs: timings }, null, 2));
