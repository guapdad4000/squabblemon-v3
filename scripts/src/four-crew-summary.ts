import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BalanceMatrixReport } from '@workspace/squabblemon-engine/balanceLab';

type Entry = { policy: string; subject: string; opponent: string; report: BalanceMatrixReport };
export function aggregateCrewEvidence(entries: readonly Entry[]) {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = `${entry.policy}/${entry.subject}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return Object.fromEntries([...groups].map(([key, values]) => {
    const rows = values.map(entry => {
      const row = entry.report.decks.find(deck => deck.deckId === entry.subject);
      if (!row) throw new Error(`Missing subject result: ${entry.subject}`);
      return row;
    });
    const games = rows.reduce((n, row) => n + row.games, 0);
    const wins = rows.reduce((n, row) => n + row.wins, 0);
    const draws = rows.reduce((n, row) => n + row.draws, 0);
    const asPlayerGames = rows.reduce((n, row) => n + row.asPlayerGames, 0);
    const asCpuGames = rows.reduce((n, row) => n + row.asCpuGames, 0);
    return [key, {
      games, wins, draws, scoreRate: games ? (wins + draws / 2) / games : null,
      asPlayerScoreRate: asPlayerGames ? rows.reduce((n, row) => n + row.asPlayerGames * row.asPlayerScoreRate, 0) / asPlayerGames : null,
      asCpuScoreRate: asCpuGames ? rows.reduce((n, row) => n + row.asCpuGames * row.asCpuScoreRate, 0) / asCpuGames : null,
      failedMatches: values.reduce((n, entry) => n + entry.report.failedMatches, 0),
      byTier: Object.fromEntries(([0, 3] as const).map(tier => {
        const matchups = values.flatMap(entry => entry.report.matchups.filter(matchup => matchup.tier === tier));
        const count = matchups.reduce((n, row) => n + row.games, 0);
        return [tier, { games: count, scoreRate: count ? matchups.reduce((n, row) => n + row.games * row.deckAScoreRate, 0) / count : null }];
      })),
      byOpponent: Object.fromEntries(values.map(entry => [entry.opponent, entry.report.decks.find(deck => deck.deckId === entry.subject)!.scoreRate])),
      flags: values.flatMap(entry => entry.report.flags),
    }];
  }));
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const dir = path.resolve(root, process.argv[2] ?? 'scripts/results/task126');
  const labels = ['baseline-nerd4', 'candidate-nerd4', 'candidate-nerd3'];
  const files = labels.map(label => JSON.parse(readFileSync(path.join(dir, `${label}.json`), 'utf8')));
  for (const file of files) {
    assert.deepEqual(file.configuration, files[0].configuration, 'Comparison axes must be identical');
    assert.deepEqual(file.subjects, files[0].subjects, 'Rule-only comparisons must preserve all deck identities and order keys');
    assert.deepEqual(file.opponents, files[0].opponents, 'Opponents must be identical');
    assert.equal(file.reports.length, 63, 'Do not summarize incomplete runs');
  }
  const summaries = Object.fromEntries(files.map((file, index) => [labels[index], aggregateCrewEvidence(file.reports)]));
  writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summaries, null, 2) + '\n');
  for (const key of Object.keys(summaries[labels[0]])) {
    console.log(key, ...labels.map(label => {
      const row = summaries[label][key];
      return `${label} ${row.scoreRate === null ? 'n/a' : (row.scoreRate * 100).toFixed(1)}% (${row.games}, failures ${row.failedMatches})`;
    }));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();