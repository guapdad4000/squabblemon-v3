// Full-scope element audit: one deck per element plus the four weak target crews.
// Run: pnpm --filter @workspace/scripts exec tsx src/element-balance-audit.ts [--seeded] [--quick] [--out-dir=PATH] [--label=LABEL]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import {
  countBalanceMatrixMatches,
  runBalanceMatrix,
  seededLegalBalancePolicy,
} from '@workspace/squabblemon-engine/balanceLab';
import { elementDecks } from './element-balance-audit-decks';
import { parseElementBalanceAuditArgs } from './element-balance-audit-cli';

let options: ReturnType<typeof parseElementBalanceAuditArgs> | undefined;
try {
  options = parseElementBalanceAuditArgs(process.argv.slice(2));
} catch (error: unknown) {
  console.error(`Invalid element balance audit arguments: ${error instanceof Error ? error.message : String(error)}`);
  console.error('Usage: tsx src/element-balance-audit.ts [--seeded] [--quick] [--out-dir=PATH] [--label=LABEL]');
  process.exitCode = 2;
}

if (options) {
  const seeded = options.seeded;
  const districtSeeds = options.quick
    ? ['element-audit-district-00']
    : ['element-audit-district-00', 'element-audit-district-01'];
  const rotations = options.quick ? [0] : [0, 5];
  const tiers = [0, 3] as const;
  const policyName = seeded ? 'seeded-legal' : 'greedy';
  const label = options.label ?? `element-balance-v${CARD_BALANCE_VERSION}`;
  const policy = seeded ? seededLegalBalancePolicy : undefined;
  const matchCount = countBalanceMatrixMatches({
    id: seeded ? 'element-audit-seeded' : 'element-audit-greedy',
    decks: elementDecks,
    districtSeeds,
    rotations,
    tiers,
    includeMirrors: false,
  });

  console.log(
    `Starting ${options.quick ? 'quick ' : ''}element balance audit "${label}" ` +
    `(${policyName}; ${elementDecks.length} decks; ${matchCount} matches; ` +
    `cards v${CARD_BALANCE_VERSION}, rules v${ONLINE_RULES_VERSION}).`,
  );
  const progressInterval = Math.max(1, Math.ceil(matchCount * 0.05));
  let nextProgress = progressInterval;
  const report = runBalanceMatrix({
    id: seeded ? 'element-audit-seeded' : 'element-audit-greedy',
    decks: elementDecks,
    districtSeeds,
    rotations,
    tiers,
    includeMirrors: false,
    allowSquabble: true,
    minimumSampleSize: 16,
    ...(policy ? { policy } : {}),
    onProgress: (completed, total) => {
      if (completed >= nextProgress || completed === total) {
        console.log(`Progress: ${completed}/${total} matches`);
        while (nextProgress <= completed) nextProgress += progressInterval;
      }
    },
  });

  const defaultOutDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../results/element-audit');
  const outDir = path.resolve(options.outDir ?? defaultOutDir);
  const reportPath = path.join(outDir, `${label}-${policyName}${options.quick ? '-quick' : ''}.json`);
  const output = {
    metadata: {
      label,
      cardBalanceVersion: CARD_BALANCE_VERSION,
      rulesVersion: ONLINE_RULES_VERSION,
      policy: policyName,
      quick: options.quick,
      schedule: { districtSeeds, rotations, tiers, includeMirrors: false, bothSeats: true },
      matchCount: report.matchCount,
      successfulMatches: report.successfulMatches,
      failedMatches: report.failedMatches,
    },
    decks: elementDecks,
    results: {
      decks: report.decks,
      matchups: report.matchups,
      cards: report.cards,
      failures: report.failures,
      flags: report.flags,
      seat: report.seat,
      tiers: report.tiers,
      matchCount: report.matchCount,
      successfulMatches: report.successfulMatches,
      failedMatches: report.failedMatches,
    },
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(output, null, 2)}\n`);
  for (const deck of report.decks) {
    console.log(`${deck.deckName.padEnd(28)} ${(deck.scoreRate * 100).toFixed(1)}%  (${deck.games} games)`);
  }
  if (report.failedMatches > 0) {
    console.error(`Audit failed: ${report.failedMatches}/${report.matchCount} simulations failed.`);
    for (const failure of report.failures) {
      console.error(`  ${failure.count} failure(s): ${failure.message}`);
      for (const example of failure.examples) {
        console.error(
          `    ${example.deckAId} vs ${example.deckBId}; seed=${example.districtSeed}; ` +
          `rotation=${example.rotation}; tier=${example.tier}; seat=${example.seat}`,
        );
      }
    }
    console.error(`Full failure summary written to ${reportPath}`);
    process.exitCode = 1;
  } else {
    console.log(`Completed ${report.matchCount} matches with no failures. Report: ${reportPath}`);
  }
}