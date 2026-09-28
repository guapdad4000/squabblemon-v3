// Full-scope element audit: one deck per element plus the four weak target crews.
// Run: pnpm --filter @workspace/scripts exec tsx src/element-balance-audit.ts [--seeded]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { elementDecks } from './element-balance-audit-decks';
import { runBalanceMatrix, seededLegalBalancePolicy } from '@workspace/squabblemon-engine/balanceLab';


const seeded = process.argv.includes('--seeded');
const report = runBalanceMatrix({
  id: seeded ? 'element-audit-seeded' : 'element-audit-greedy',
  decks: elementDecks,
  districtSeeds: ['element-audit-district-00', 'element-audit-district-01'],
  rotations: [0, 5],
  tiers: [0, 3],
  includeMirrors: false,
  allowSquabble: true,
  minimumSampleSize: 16,
  ...(seeded ? { policy: seededLegalBalancePolicy } : {}),
});
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../results/element-audit');
await mkdir(out, { recursive: true });
await writeFile(path.join(out, `${seeded ? 'seeded' : 'greedy'}.json`), JSON.stringify({ decks: elementDecks, results: report.decks }, null, 2) + '\n');
for (const d of report.decks) console.log(`${d.deckName.padEnd(28)} ${(d.scoreRate * 100).toFixed(1)}%  (${d.games} games)`);
