import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { BalanceDeck, BalanceMatrixReport, BalancePolicy } from '@workspace/squabblemon-engine/balanceLab';

/** Immutable pre-task rules; no runtime/player registry is changed by this offline experiment. */
export const BASELINE_COMMIT = '4a229154818fe27c1c61d5bc110e3d1c6397e7cb';
export const CONTROL_CREW = ['counter', 'gamer', 'gothkid', 'nerd', 'redpill', 'buddy', 'wifey', 'pinaynurse', 'plug', 'bustdown'];
export const COMPARISON_AXES = {
  seeds: ['task118-full-district-00', 'task118-full-district-01'],
  rotations: [0, 5], tiers: [0, 3] as const, seats: 'mirrored', squabble: true,
};
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;

async function main() {
  const rules = option('--rules', 'candidate');
  if (!['baseline', 'candidate'].includes(rules)) throw new Error('--rules must be baseline or candidate');
  const cost = Number(option('--nerd-cost', '4'));
  if (cost !== 3 && cost !== 4) throw new Error('--nerd-cost must be 3 or 4');
  let source = path.join(root, 'lib/squabblemon-engine/src');
  if (rules === 'baseline') {
    const extraction = path.join(root, '.cache/task126-pinned');
    mkdirSync(extraction, { recursive: true });
    const archive = execFileSync('git', ['archive', BASELINE_COMMIT, 'lib/squabblemon-engine/src'], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', extraction], { input: archive });
    source = path.join(extraction, 'lib/squabblemon-engine/src');
  }
  const lab: typeof import('@workspace/squabblemon-engine/balanceLab') = await import(pathToFileURL(path.join(source, 'balanceLab.ts')).href);
  const data: typeof import('@workspace/squabblemon-engine/data') = await import(pathToFileURL(path.join(source, 'data.ts')).href);
  // Process-local cost toggle isolates composition and Nerd cost, not a shipping card change.
  data.cards.nerd.cost = cost;
  const out = path.resolve(root, option('--out-dir', 'scripts/results/task126'));
  mkdirSync(out, { recursive: true });
  const label = `${rules}-nerd${cost}`;
  if (args.includes('--full')) {
    const report = lab.runBalanceLab('full', (done, total) => {
      if (done % 80 === 0) process.stderr.write(`${label} full ${done}/${total}\n`);
    });
    writeFileSync(path.join(out, `${label}-full.json`), JSON.stringify(report) + '\n');
    console.log(JSON.stringify({ label, fingerprint: report.deterministicFingerprint, matrix: report.matrix.decks, flags: report.flags }));
    // Preserve the ordinary lab gate semantics, including inherited blockers.
    process.exitCode = report.flags.some(flag => flag.severity === 'blocker') ? 2 : 0;
    return;
  }
  const defaults = lab.createDefaultBalanceDecks();
  const deck = (id: string) => {
    const found = defaults.find(value => value.id === id);
    if (!found) throw new Error(`Missing experiment deck ${id}`);
    return found;
  };
  const originalCounter = deck('focus-counterplay');
  const subjects: BalanceDeck[] = [
    deck('focus-cellblock'), deck('focus-detective'), deck('focus-demario-luigion'), originalCounter,
    { id: 'control-coherent', name: 'Coherent Counterplay', orderKey: originalCounter.id, cardIds: CONTROL_CREW },
    { id: 'dark-splash', name: 'Dark control splash', cardIds: ['nerd', 'gamer', 'buddy', 'gothkid', 'redpill', 'snow', 'roaster', 'plug', 'wifey', 'counter'] },
    { id: 'echo-splash', name: 'Nerd / setup echo splash', cardIds: ['nerd', 'tayaty', 'oz', 'scammer', 'demario', 'luigion', 'watson', 'sherlock', 'plug', 'wifey'] },
  ];
  const opponents = ['focus-fire-guap', 'focus-wave7-legends', 'focus-air-bond'].map(deck);
  if (args.includes('--sequence-only')) {
    const cases = [];
    for (const opponent of opponents) for (const districtSeed of COMPARISON_AXES.seeds)
      for (const rotation of COMPARISON_AXES.rotations) for (const tier of COMPARISON_AXES.tiers)
        for (const seat of ['a-player', 'b-player'] as const) {
          const owner = seat === 'a-player' ? 'player' : 'cpu';
          const nerdDeployments: { round: number; cost: number; motionBefore: number; motionAfter: number; notes: string[] }[] = [];
          const policy: BalancePolicy = context => {
            const chosen = lab.greedyBalancePolicy(context);
            if (context.owner === owner && chosen?.cardId === 'nerd') {
              nerdDeployments.push({
                round: context.match.round, cost: chosen.cost,
                motionBefore: owner === 'player' ? context.match.playerMotion : context.match.cpuMotion,
                motionAfter: owner === 'player' ? chosen.preview.playerMotion : chosen.preview.cpuMotion,
                notes: chosen.preview.effectLog.slice(context.match.effectLog.length).filter(event => event.type === 'ability').map(event => event.note),
              });
            }
            return chosen;
          };
          const result = lab.simulateBalanceMatch({
            deckA: subjects[4], deckB: opponent, districtSeed, rotation, tier, seat, policy, allowSquabble: true,
          });
          cases.push({ opponent: opponent.id, districtSeed, rotation, tier, seat, winner: result.logicalWinner, nerdDeployments });
        }
    writeFileSync(path.join(out, `${label}-sequence.json`), JSON.stringify({ configuration: COMPARISON_AXES, cases }) + '\n');
    console.log(`${label}: ${cases.length} controlled sequencing cases`);
    return;
  }
  const policies: [string, BalancePolicy][] = [
    ['greedy', lab.greedyBalancePolicy], ['first-legal', lab.firstLegalBalancePolicy], ['seeded-legal', lab.seededLegalBalancePolicy],
  ];
  const reports: { policy: string; subject: string; opponent: string; report: BalanceMatrixReport }[] = [];
  const checkpoint = path.join(out, `${label}-checkpoint.json`);
  if (args.includes('--resume') && existsSync(checkpoint)) reports.push(...JSON.parse(readFileSync(checkpoint, 'utf8')));
  for (const [policyName, policy] of policies) for (const subject of subjects) for (const opponent of opponents) {
    if (reports.some(entry => entry.policy === policyName && entry.subject === subject.id && entry.opponent === opponent.id)) continue;
    const report = lab.runBalanceMatrix({
      id: `${subject.id}-vs-${opponent.id}`, decks: [subject, opponent],
      districtSeeds: COMPARISON_AXES.seeds,
      rotations: COMPARISON_AXES.rotations, tiers: COMPARISON_AXES.tiers, includeMirrors: false,
      // Same SQUABBLE setting across policies; policy is the only sensitivity variable.
      allowSquabble: true, minimumSampleSize: 16, policy,
    });
    reports.push({ policy: policyName, subject: subject.id, opponent: opponent.id, report });
    writeFileSync(checkpoint, JSON.stringify(reports) + '\n');
    process.stderr.write(`${label}: ${reports.length}/63 ${policyName} ${subject.id}\n`);
  }
  const combos = ['nerd', 'demario', 'luigion', 'watson', 'sherlock'].flatMap(firstCardId =>
    ([0, 3] as const).flatMap(tier => (['player', 'cpu'] as const).map(owner =>
      lab.runHighRiskComboProbe({ id: `${firstCardId}-tayaty`, firstCardId, echoCardId: 'tayaty' }, tier, owner))));
  writeFileSync(path.join(out, `${label}.json`), JSON.stringify({
    schemaVersion: 1, baselineCommit: BASELINE_COMMIT, rules, nerdCost: cost, subjects, opponents,
    configuration: COMPARISON_AXES,
    reports, combos, humanPlaytest: 'pending',
  }) + '\n');
  console.log(`${label}: ${reports.reduce((sum, entry) => sum + entry.report.successfulMatches, 0)} completed; ${reports.reduce((sum, entry) => sum + entry.report.failedMatches, 0)} failed`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}