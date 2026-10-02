import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { cards } from '@workspace/squabblemon-engine/data';
import { BALANCE_LAB_SCHEMA_VERSION } from '@workspace/squabblemon-engine/balanceLab';
import {
  loadRankingPlan, root, validateRankingResult, verifyIncrementalRows,
  type RankingCase, type RankingPlan, type RankingRow, type RankingShard,
} from './all-decks-ranking';

export const REPORT_VERSION = 2;
export const splits = ['all', 'greedy', 'seeded', 'base', 'upgraded', 'first', 'second'] as const;
type Split = typeof splits[number];
export type Rate = { games: number; wins: number; losses: number; draws: number; winRate: number; scoreRate: number };
type Counts = Pick<Rate, 'wins' | 'losses' | 'draws'>;
type SplitCounts = Record<Split, Counts>;
type SplitRates = Record<Split, Rate>;
const emptyCounts = (): Counts => ({ wins: 0, losses: 0, draws: 0 });
const emptySplits = (): SplitCounts => Object.fromEntries(splits.map(split => [split, emptyCounts()])) as SplitCounts;
const caseKey = (item: Omit<RankingCase, 'key'>): string =>
  [item.a, item.b, item.policy, item.seed, item.rotation, item.tier, item.seat].join('|');

/** Independently reconstruct the full Cartesian schedule, not just its total size. */
export function validateCoverage(plan: RankingPlan): number {
  assert(plan.decks.length >= 2, 'Need at least two decks');
  assert.equal(new Set(plan.decks.map(deck => deck.id)).size, plan.decks.length, 'Duplicate deck IDs');
  if (plan.excludedCardIds !== undefined) {
    assert(Array.isArray(plan.excludedCardIds), 'Invalid excluded card IDs');
    assert.equal(new Set(plan.excludedCardIds).size, plan.excludedCardIds.length, 'Repeated excluded card IDs');
    for (const id of plan.excludedCardIds) {
      assert(typeof id === 'string' && cards[id], `Unknown excluded card ${id}`);
      for (const deck of plan.decks) assert(!deck.cardIds.includes(id), `${deck.id}: excluded card ${id}`);
    }
  }
  const { schedule } = plan;
  for (const values of [schedule.seeds, schedule.rotations, schedule.tiers, schedule.seats, schedule.policies]) {
    assert(values.length > 0 && new Set<string | number>(values).size === values.length, 'Empty or repeated schedule axis');
  }
  assert.deepEqual([...schedule.policies].sort(), ['greedy', 'seeded-legal']);
  assert.deepEqual([...schedule.tiers].sort(), [0, 3]);
  assert.deepEqual([...schedule.seats].sort(), ['a-player', 'b-player']);
  assert.equal(schedule.allowSquabble, true);
  const expected: RankingCase[] = [];
  for (let a = 0; a < plan.decks.length; a++) for (let b = a + 1; b < plan.decks.length; b++) {
    for (const policy of schedule.policies) for (const seed of schedule.seeds)
      for (const rotation of schedule.rotations) for (const tier of schedule.tiers) for (const seat of schedule.seats) {
        const item = { a: plan.decks[a].id, b: plan.decks[b].id, policy, seed, rotation, tier, seat };
        expected.push({ key: caseKey(item), ...item });
      }
  }
  assert.deepEqual(plan.cases, expected, 'Incomplete or unequal Cartesian coverage');
  return schedule.policies.length * schedule.seeds.length * schedule.rotations.length * schedule.tiers.length * schedule.seats.length;
}

/** Merge only complete, ordered, modulo-assigned evidence from a single build. */
export function mergeRankingShards(plan: RankingPlan, shards: RankingShard[], count = 7): RankingRow[] {
  validateCoverage(plan);
  assert(Number.isSafeInteger(count) && count > 0, 'Invalid worker count');
  assert.equal(shards.length, count, 'Missing or extra workers');
  const indices = new Set<number>();
  const rows: RankingRow[] = [];
  for (const shard of shards) {
    assert(Number.isInteger(shard.index) && shard.index >= 0 && shard.index < count, 'Invalid worker index');
    assert(!indices.has(shard.index), 'Duplicate worker index');
    indices.add(shard.index);
    assert.equal(shard.count, count, 'Mixed worker counts');
    assert.equal(shard.sourceHash, plan.sourceHash, 'Mixed source hash');
    assert(Number.isFinite(shard.elapsedMs) && shard.elapsedMs >= 0, 'Invalid elapsed time');
    assert(Array.isArray(shard.failures) && shard.failures.length === 0, 'Failed matches; refusing to rank');
    assert(Array.isArray(shard.rows), 'Missing worker rows');
    const expectedIndices = plan.cases.map((_, index) => index).filter(index => index % count === shard.index);
    assert.deepEqual(shard.rows.map(row => row.caseIndex), expectedIndices, 'Missing, extra, repeated, unordered or wrong-worker cases');
    for (const row of shard.rows) {
      validateRankingResult(plan.cases[row.caseIndex], row.result);
      rows.push(row);
    }
  }
  rows.sort((a, b) => a.caseIndex - b.caseIndex);
  assert.equal(rows.length, plan.cases.length, 'Incomplete merged results');
  return rows;
}

function addOutcome(counts: Counts, outcome: 'a' | 'b' | 'draw', side: 'a' | 'b'): void {
  if (outcome === 'draw') counts.draws++;
  else if (outcome === side) counts.wins++;
  else counts.losses++;
}

function activeSplits(scenario: RankingCase, side: 'a' | 'b'): Split[] {
  const first = scenario.seat === (side === 'a' ? 'a-player' : 'b-player');
  return ['all', scenario.policy === 'greedy' ? 'greedy' : 'seeded',
    scenario.tier === 0 ? 'base' : 'upgraded', first ? 'first' : 'second'];
}

function rates(counts: Counts): Rate {
  const games = counts.wins + counts.losses + counts.draws;
  assert(games > 0, 'No samples for rate');
  return { games, ...counts, winRate: counts.wins / games, scoreRate: (counts.wins + counts.draws / 2) / games };
}

function splitRates(counts: SplitCounts): SplitRates {
  return Object.fromEntries(splits.map(split => [split, rates(counts[split])])) as SplitRates;
}

type Matchup = { opponentId: string; opponentName: string } & SplitRates;
export type RankedDeck = {
  rank: number; tied: boolean; deckId: string; name: string; cardIds: string[]; cardNames: string[];
  matchups: Matchup[]; worstMatchups: Matchup[]; bestMatchups: Matchup[];
} & SplitRates;

function compareScore(a: Rate, b: Rate): number {
  return (b.wins * 2 + b.draws) * a.games - (a.wins * 2 + a.draws) * b.games;
}

function rankedLeaders(ranking: RankedDeck[], split: Split) {
  const sorted = [...ranking].sort((a, b) => compareScore(a[split], b[split]) || a.deckId.localeCompare(b.deckId));
  let rank = 1;
  return sorted.map((deck, index) => {
    if (index > 0 && compareScore(sorted[index - 1][split], deck[split]) !== 0) rank = index + 1;
    return { rank, deckId: deck.deckId, name: deck.name, ...deck[split] };
  });
}

/** Aggregation is deliberately usable with small synthetic complete schedules. */
export function aggregateRanking(plan: RankingPlan, shards: RankingShard[], count = 7) {
  const perPair = validateCoverage(plan);
  const rows = mergeRankingShards(plan, shards, count);
  const reusedMatches = rows.filter(row => row.reusedFrom !== undefined).length;
  const freshMatches = rows.length - reusedMatches;
  if (plan.evidenceReuse) {
    assert.equal(reusedMatches, plan.evidenceReuse.reusedGames, 'Reused match count mismatch');
    assert.equal(freshMatches, plan.evidenceReuse.rerunGames, 'Fresh match count mismatch');
    for (const row of rows) if (row.reusedFrom !== undefined) {
      assert.equal(row.reusedFrom, plan.evidenceReuse.sourceHash, 'Wrong reused source hash');
    }
  } else {
    assert.equal(reusedMatches, 0, 'Reused evidence without provenance');
  }
  const totals = new Map(plan.decks.map(deck => [deck.id, emptySplits()]));
  const pairs = new Map(plan.decks.map(deck => [deck.id,
    new Map(plan.decks.filter(other => other.id !== deck.id).map(other => [other.id, emptySplits()]))]));
  for (const row of rows) {
    const scenario = plan.cases[row.caseIndex];
    for (const side of ['a', 'b'] as const) {
      const id = scenario[side];
      const opponent = scenario[side === 'a' ? 'b' : 'a'];
      for (const split of activeSplits(scenario, side)) {
        addOutcome(totals.get(id)![split], row.result.logicalWinner, side);
        addOutcome(pairs.get(id)!.get(opponent)![split], row.result.logicalWinner, side);
      }
    }
  }
  const expectedGames = (plan.decks.length - 1) * perPair;
  const ranking: RankedDeck[] = plan.decks.map(deck => {
    const allRates = splitRates(totals.get(deck.id)!);
    for (const split of splits) assert.equal(allRates[split].games, split === 'all' ? expectedGames : expectedGames / 2,
      `${deck.id}: unequal ${split} samples`);
    const matchups: Matchup[] = plan.decks.filter(other => other.id !== deck.id).map(other => {
      const samples = splitRates(pairs.get(deck.id)!.get(other.id)!);
      assert.equal(samples.all.games, perPair, 'Unequal matchup coverage');
      return { opponentId: other.id, opponentName: other.name, ...samples };
    });
    const ordered = [...matchups].sort((a, b) => compareScore(a.all, b.all) || a.opponentId.localeCompare(b.opponentId));
    return { rank: 0, tied: false, deckId: deck.id, name: deck.name, cardIds: [...deck.cardIds],
      cardNames: deck.cardIds.map(id => { assert(cards[id], `Unknown card ${id}`); return cards[id].name; }),
      ...allRates, matchups,
      bestMatchups: ordered.filter(item => compareScore(item.all, ordered[0].all) === 0),
      worstMatchups: ordered.filter(item => compareScore(item.all, ordered.at(-1)!.all) === 0) };
  });
  ranking.sort((a, b) => compareScore(a.all, b.all) || a.deckId.localeCompare(b.deckId));
  for (let index = 0; index < ranking.length; index++) {
    const deck = ranking[index];
    deck.rank = index > 0 && compareScore(deck.all, ranking[index - 1].all) === 0 ? ranking[index - 1].rank : index + 1;
    deck.tied = ranking.some(other => other !== deck && compareScore(deck.all, other.all) === 0);
  }
  const totalWins = ranking.reduce((sum, deck) => sum + deck.all.wins, 0);
  const totalLosses = ranking.reduce((sum, deck) => sum + deck.all.losses, 0);
  const totalDraws = ranking.reduce((sum, deck) => sum + deck.all.draws, 0);
  assert.equal(totalWins, totalLosses, 'Not zero sum: wins != losses');
  assert.equal(totalWins + totalDraws / 2, rows.length, 'Not zero sum: total score != matches');
  for (const split of ['greedy', 'seeded', 'base', 'upgraded'] as const) {
    assert.equal(ranking.reduce((sum, deck) => sum + deck[split].wins - deck[split].losses, 0), 0,
      `${split}: non-zero-sum attribution`);
  }
  const top = ranking.slice(0, 10);
  return {
    ranking,
    diner: ranking.find(deck => deck.deckId === 'starter-squabblehouse-shift') ?? null,
    topStarters: ranking.filter(deck => deck.deckId.startsWith('starter-')),
    leaders: Object.fromEntries((['greedy', 'seeded', 'base', 'upgraded'] as const).map(split => [split, rankedLeaders(ranking, split)])),
    top10HeadToHead: { deckIds: top.map(deck => deck.deckId), names: top.map(deck => deck.name),
      matrix: top.map(deck => top.map(other => deck.deckId === other.deckId ? null :
        deck.matchups.find(item => item.opponentId === other.deckId)!.all)) },
    checks: { complete: true, deckCount: plan.decks.length, matches: rows.length, freshMatches, reusedMatches, gamesPerDeck: expectedGames,
      gamesPerPair: perPair, matchupRows: ranking.reduce((sum, deck) => sum + deck.matchups.length, 0),
      totalWins, totalLosses, totalDraws, totalScore: totalWins + totalDraws / 2, centeredScoreSum: totalWins - totalLosses, errors: [] },
  };
}

const limitations = [
  'Automated fixed-build samples, not human play or optimized deck strength.',
  'Only two fresh district seeds; no claims of statistical significance or general optimality.',
  'Movement actions are not optimized; ability-driven movement still runs.',
  'Universe: 9 saved recipes, 15 focused default builds, 9 element builds, 2 Red/Blue sets, and 2 workshop crews.',
  'Boss NPCs, custom player decks, and one-off ablations are excluded.',
  'Rank uses (wins + 0.5 draws) / games. Ties share competition rank; deck-ID order is only a stable display order, not greater strength.',
];
const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;
const md = (value: string): string => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
const csv = (value: string | number | boolean): string => `"${String(value).replaceAll('"', '""')}"`;

function markdown(summary: ReturnType<typeof aggregateRanking>, plan: RankingPlan, count: number): string {
  const lines = ['# All-decks fixed-build ranking', '', ...limitations.map(line => `- ${line}`), '',
    `Build hash: ${plan.sourceHash}. Balance version: ${plan.balanceVersion}; rules version: ${plan.rulesVersion}; report version: ${REPORT_VERSION}.`,
    `Complete evidence: ${summary.checks.matches} matches, ${summary.checks.deckCount} decks, ${count} workers; ${summary.checks.gamesPerDeck} games/deck, ${summary.checks.gamesPerPair} games/pair. Errors: 0.`,
     `Evidence execution: ${summary.checks.freshMatches} fresh matches; ${summary.checks.reusedMatches} reused matches.`,
     ...(plan.excludedCardIds?.includes('guap') ? [
       'GUAP (guap) is excluded from these balance-test builds. Redneck Evil (redneck-evil) replaces GUAP in the same card slots in Wonderland Return, Fire Pressure, Fire, and Blood / Red Set. Deck IDs and draw-order keys are retained; this is a deck-composition change, not a gameplay balance change.',
     ] : []),
     ...(plan.excludedCardIds?.length ? [`Excluded card IDs: ${plan.excludedCardIds.join(', ')}.`] : []),
     ...(plan.evidenceReuse ? [
       `Reused evidence: ${plan.evidenceReuse.reusedGames} matches from ${md(plan.evidenceReuse.sourceDirectory)} (source hash ${plan.evidenceReuse.sourceHash}; plan hash ${plan.evidenceReuse.sourcePlanHash}; cache hash ${plan.evidenceReuse.cacheHash}). ${plan.evidenceReuse.rerunGames} matches were rerun for changed builds. Reuse applies only when both complete deck definitions are unchanged.`,
       `Source worker hashes: ${plan.evidenceReuse.sourceWorkerHashes.join(', ')}.`,
     ] : []),
    'Score sum equals match count; centered win/loss sum is zero. Each policy, tier and seat split has half the samples.', '',
    '## Full ranking', '', '| Rank | Deck | W/L/D | Score | Win | Greedy | Seeded legal | Base | Upgraded | First | Second |',
    '|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const deck of summary.ranking) lines.push(`| ${deck.rank}${deck.tied ? ' (tie)' : ''} | ${md(deck.name)} | ${deck.all.wins}/${deck.all.losses}/${deck.all.draws} | ${percent(deck.all.scoreRate)} | ${percent(deck.all.winRate)} | ${splits.slice(1).map(split => percent(deck[split].scoreRate)).join(' | ')} |`);
  lines.push('', '## Diner', '');
  const diner = summary.diner;
  lines.push(diner ? `${md(diner.name)}: rank ${diner.rank}${diner.tied ? ' (tie)' : ''}, ${diner.all.wins}/${diner.all.losses}/${diner.all.draws} W/L/D; score ${percent(diner.all.scoreRate)}, win ${percent(diner.all.winRate)}.` : 'No diner in this synthetic universe.');
  lines.push('', '## Top saved starter recipes', '');
  for (const deck of summary.topStarters) lines.push(`- Rank ${deck.rank}: ${md(deck.name)} — ${percent(deck.all.scoreRate)} score (${deck.all.wins}/${deck.all.losses}/${deck.all.draws} W/L/D).`);
  lines.push('', '## Policy and tier leader lists', '');
  for (const [split, leaders] of Object.entries(summary.leaders)) {
    lines.push(`### ${split}`, '', ...leaders.map(deck => `- ${deck.rank}. ${md(deck.name)} — ${percent(deck.scoreRate)} score; ${deck.wins}/${deck.losses}/${deck.draws} W/L/D (${deck.games} games).`), '');
  }
  lines.push('## Top 10 head-to-head score matrix', '', '| Deck | ' + summary.top10HeadToHead.names.map(md).join(' | ') + ' |',
    '|---|' + summary.top10HeadToHead.names.map(() => '---:|').join(''));
  summary.top10HeadToHead.matrix.forEach((row, index) =>
    lines.push(`| ${md(summary.top10HeadToHead.names[index])} | ${row.map(rate => rate ? percent(rate.scoreRate) : '—').join(' | ')} |`));
  lines.push('', '## Full directed matchup rates and decklists', '');
  for (const deck of summary.ranking) {
    lines.push(`### ${md(deck.name)} (${deck.deckId})`, '',
      `Cards: ${deck.cardNames.map((name, index) => `${md(name)} (${deck.cardIds[index]})`).join(', ')}.`, '',
      `Best: ${deck.bestMatchups.map(item => md(item.opponentName)).join(', ')}. Worst: ${deck.worstMatchups.map(item => md(item.opponentName)).join(', ')}.`, '',
      '| Opponent | Games | W/L/D | Win | Score |', '|---|---:|---|---:|---:|');
    for (const item of deck.matchups) lines.push(`| ${md(item.opponentName)} | ${item.all.games} | ${item.all.wins}/${item.all.losses}/${item.all.draws} | ${percent(item.all.winRate)} | ${percent(item.all.scoreRate)} |`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

export function writeRankingReport(directory: string, count = 7): void {
  const destinations = ['summary.json', 'report.md', 'ranking.csv', 'decklists.csv'];
  for (const file of destinations) assert(!existsSync(path.join(directory, file)), 'Refusing to overwrite prior summaries');
  const plan = loadRankingPlan(directory);
  assert.equal(plan.decks.length, 37);
  assert.equal(plan.cases.length, 10656);
  const files = readdirSync(directory).filter(file => /^worker-.*\.json$/.test(file)).sort();
  assert.equal(files.length, count, 'Missing or extra worker files');
  assert.deepEqual(new Set(files), new Set(Array.from({ length: count }, (_, index) => `worker-${index}.json`)), 'Unexpected worker filenames');
  const raw = files.map(file => readFileSync(path.join(directory, file), 'utf8'));
  const shards = raw.map((text, index) => {
    const shard = JSON.parse(text) as RankingShard;
    assert.equal(`worker-${shard.index}.json`, files[index], 'Filename/worker index mismatch');
    return shard;
  });
  const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
  if (plan.evidenceReuse) {
    const cached = readFileSync(path.join(directory, 'reused-evidence.json'), 'utf8');
    assert.equal(sha256(cached), plan.evidenceReuse.cacheHash, 'Reused evidence cache hash mismatch');
    verifyIncrementalRows(plan, shards.flatMap(shard => shard.rows), JSON.parse(cached) as RankingRow[]);
  }
  const aggregated = aggregateRanking(plan, shards, count);
  assert.equal(aggregated.checks.gamesPerDeck, 576);
  assert(aggregated.diner, 'Missing dedicated diner row');
  const summary = { reportVersion: REPORT_VERSION, generatedAt: new Date().toISOString(),
    planGeneratedAt: plan.generatedAt, sourceHash: plan.sourceHash, balanceVersion: plan.balanceVersion,
    rulesVersion: plan.rulesVersion, telemetrySchemaVersion: BALANCE_LAB_SCHEMA_VERSION,
    reporterHash: sha256(readFileSync(path.join(root, 'scripts/src/all-decks-ranking-report.ts'), 'utf8')),
    planHash: sha256(readFileSync(path.join(directory, 'plan.json'), 'utf8')),
    workerCount: count, workers: shards.map((shard, index) => ({ index: shard.index, count: shard.count,
      sourceHash: shard.sourceHash, rows: shard.rows.length, failures: shard.failures.length,
      elapsedMs: shard.elapsedMs, evidenceHash: sha256(raw[index]) })),
    schedule: plan.schedule, excludedCardIds: plan.excludedCardIds ?? [],
    ...(plan.evidenceReuse ? { evidenceReuse: plan.evidenceReuse } : {}), limitations, ...aggregated };
  const metrics = ['games', 'wins', 'losses', 'draws', 'winRate', 'scoreRate'] as const;
  const rankingCsv = [
    ['rank', 'tied', 'deckId', 'name', ...splits.flatMap(split => metrics.map(metric => `${split}_${metric}`))].map(csv).join(','),
    ...summary.ranking.map(deck => [deck.rank, deck.tied, deck.deckId, deck.name,
      ...splits.flatMap(split => metrics.map(metric => deck[split][metric]))].map(csv).join(',')),
  ].join('\n') + '\n';
  const decklistsCsv = [
    ['rank', 'deckId', 'deckName', ...Array.from({ length: 10 }, (_, index) => [`card${index + 1}Id`, `card${index + 1}Name`]).flat()].map(csv).join(','),
    ...summary.ranking.map(deck => [deck.rank, deck.deckId, deck.name,
      ...deck.cardIds.flatMap((id, index) => [id, deck.cardNames[index]])].map(csv).join(',')),
  ].join('\n') + '\n';
  const contents = [JSON.stringify(summary, null, 2) + '\n', markdown(aggregated, plan, count), rankingCsv, decklistsCsv];
  // All validation and formatting completes before any summary is created.
  destinations.forEach((file, index) => writeFileSync(path.join(directory, file), contents[index], { flag: 'wx' }));
  console.log(`ALL_DECKS_REPORT_COMPLETE matches=${summary.checks.matches} decks=${summary.checks.deckCount} errors=0`);
}

function main(args: string[]): void {
  assert(args.length === 2 && args[0], 'Usage: all-decks-ranking-report.ts <workspace-relative-output-directory> <count>');
  assert(!path.isAbsolute(args[0]), 'Output directory must be workspace-relative');
  const directory = path.resolve(root, args[0]);
  assert(!path.relative(root, directory).startsWith('..'), 'Output directory must be inside the workspace');
  writeRankingReport(directory, Number(args[1]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));