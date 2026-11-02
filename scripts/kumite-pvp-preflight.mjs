import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineDirectory = 'lib/squabblemon-engine/src';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const orderedEntries = (value) => Object.entries(value).sort(([a], [b]) => a.localeCompare(b));

/** These require behavioral release proof. Source presence and CLI flags cannot satisfy them. */
const pvpRequirements = [
  {
    id: 'hosted-transport',
    proof: 'Authenticated hosted command/snapshot transport, private seat payloads, measured latency and server-owned clock/ticks.',
  },
  {
    id: 'durable-store-and-lease',
    proof: 'Independent database connections proving atomic checkpoint/journal/outbox writes, retry identity, lease expiry and fenced worker failover.',
  },
  {
    id: 'human-matchmaking-and-lifecycle',
    proof: 'Atomic human pairing/cancel, locked owned decks, ready/start, disconnect grace, surrender/forfeit and rematch recovery.',
  },
  {
    id: 'authoritative-result-receipts',
    proof: 'Separate Breakthrough trophies/records and roadmap receipts, transactional once-only settlement and reviewed anti-farming policy.',
  },
  {
    id: 'authenticated-two-client',
    proof: 'Two authenticated clients completing real matches with simultaneous inputs, packet loss, uncertain acknowledgments and reconnect.',
  },
  {
    id: 'physical-device',
    proof: 'Physical-phone rapid touch/drag, crowded-match presentation, background/resume and complete multi-match performance checks.',
  },
  {
    id: 'staging-deployment',
    proof: 'Matching ready staged revision, API readiness, two-account result settlement and verified feature-disable/fix-forward recovery.',
  },
];

export const help = `Usage: node scripts/kumite-pvp-preflight.mjs [--json] [--output PATH] [--require-ready]

Read-only local source audit; no network calls or account changes.
  --json           Print the JSON report instead of the human summary.
  --output PATH    Also write the JSON report to PATH (creates parent directories).
  --require-ready  Exit 1 while any launch requirement remains blocked/unverified.
  --help           Show this help without loading the engine.

Default audit exits 0 even when blocked. Invalid arguments/audit failures exit 2.
The catalog gate is evaluated by the actual engine. Hosted PvP, database, reward,
two-client, device and staged-deployment proof are explicitly unverified here.
This command cannot certify overall PvP readiness or approve a public launch.
`;

export function parseArguments(args) {
  const options = { json: false, requireReady: false, output: null, help: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!['--json', '--require-ready', '--output', '--help'].includes(arg))
      throw new Error(`Unknown argument: ${arg}`);
    if (seen.has(arg)) throw new Error(`Repeated argument: ${arg}`);
    seen.add(arg);
    if (arg === '--output') {
      const value = args[++index];
      if (!value || value.startsWith('-')) throw new Error('--output requires a file path.');
      options.output = value;
    } else if (arg === '--json') options.json = true;
    else if (arg === '--require-ready') options.requireReady = true;
    else options.help = true;
  }
  return options;
}

/** Bundle live workspace sources, never installed copies or regex-derived card counts. */
async function loadEngineSnapshot(root) {
  const loadedSources = new Map();
  const result = await build({
    absWorkingDir: root,
    stdin: {
      resolveDir: root,
      sourcefile: 'kumite-pvp-preflight-entry.ts',
      contents: `
        import { getBreakthroughLaunchReadiness, getBreakthroughLaunchCoverage,
          BREAKTHROUGH_COMPATIBILITY } from './${engineDirectory}/breakthroughCatalog';
        import { BREAKTHROUGH_PUBLIC_LAUNCH_APPROVED, BREAKTHROUGH_FULL_CATALOG_EVIDENCE,
          BREAKTHROUGH_RULE_INPUT_SHA256, isBreakthroughPublicEntryEnabled }
          from './${engineDirectory}/breakthroughRelease';
        export const snapshot = {
          readiness: getBreakthroughLaunchReadiness(),
          coverage: getBreakthroughLaunchCoverage(),
          compatibility: BREAKTHROUGH_COMPATIBILITY,
          publicLaunchApproved: BREAKTHROUGH_PUBLIC_LAUNCH_APPROVED,
          publicEntryEnabled: isBreakthroughPublicEntryEnabled(),
          fullCatalogEvidence: BREAKTHROUGH_FULL_CATALOG_EVIDENCE,
          declaredRuleInputs: BREAKTHROUGH_RULE_INPUT_SHA256,
        };
      `,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'es2022',
    logLevel: 'silent',
    // Explicit local configuration also permits isolated source-copy freshness tests.
    tsconfigRaw: { compilerOptions: { target: 'es2022' } },
    plugins: [{
      name: 'fingerprint-loaded-sources',
      setup(builder) {
        builder.onLoad({ filter: /\.(?:ts|json)$/ }, async ({ path: filename }) => {
          const contents = await readFile(filename, 'utf8');
          loadedSources.set(filename, sha256(contents));
          return { contents, loader: filename.endsWith('.json') ? 'json' : 'ts' };
        });
      },
    }],
  });
  const { snapshot } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  // Detect changes during bundling instead of publishing a mixed source snapshot.
  for (const [filename, expected] of loadedSources)
    if (sha256(await readFile(filename)) !== expected)
      throw new Error(`Source changed during audit; retry: ${path.relative(root, filename)}`);
  return { snapshot, loadedSources };
}

export async function collectPreflight(root = workspaceRoot) {
  root = path.resolve(root);
  const { snapshot, loadedSources } = await loadEngineSnapshot(root);
  const { readiness, coverage } = snapshot;
  const behaviorNames = (await readdir(path.join(root, engineDirectory)))
    .filter((filename) => /^breakthrough.*\.ts$/.test(filename) && filename !== 'breakthroughRelease.ts')
    .sort();
  const behaviorModules = await Promise.all(behaviorNames.map(async (filename) => {
    const actual = sha256(await readFile(path.join(root, engineDirectory, filename)));
    return { file: filename, sha256: actual,
      declaredSha256: snapshot.declaredRuleInputs[filename] ?? null,
      matchesDeclared: actual === snapshot.declaredRuleInputs[filename] };
  }));
  const unexpectedDeclaredModules = Object.keys(snapshot.declaredRuleInputs)
    .filter((filename) => !behaviorNames.includes(filename)).sort();
  const manifestMatchesSource = behaviorModules.length > 0 && !unexpectedDeclaredModules.length &&
    behaviorModules.every((entry) => entry.matchesDeclared);
  const compatibility = new Map(snapshot.compatibility.map((card) => [card.cardId, card]));
  const unsupportedCards = readiness.unsupportedCardIds.map((cardId) => {
    const canonical = compatibility.get(cardId);
    if (!canonical) throw new Error(`Missing canonical compatibility for ${cardId}.`);
    return { cardId, name: canonical.name, kind: canonical.kind, reason: canonical.reason };
  });
  const requirements = pvpRequirements.map((entry) => ({ ...entry, status: 'unverified' }));
  const cardGateReady = readiness.canLaunch && manifestMatchesSource;
  return {
    schemaVersion: 1,
    mode: 'kumite-breakthrough',
    assessment: 'source inspected',
    sourceRoot: root,
    overall: {
      ready: false,
      status: 'blocked',
      blockerIds: [...(!cardGateReady ? ['card-release-gate'] : []), ...requirements.map((entry) => entry.id)],
    },
    cardGate: {
      ready: cardGateReady,
      engineReadiness: readiness,
      unsupportedCards,
      publicLaunchApproved: snapshot.publicLaunchApproved,
      publicEntryEnabled: snapshot.publicEntryEnabled,
      fullCatalogEvidence: snapshot.fullCatalogEvidence,
    },
    fingerprints: {
      ruleset: coverage.ruleset,
      catalogSignatureSha256: sha256(coverage.catalogSignature),
      behaviorSourceSha256: sha256(JSON.stringify(behaviorModules.map(({ file, sha256: hash }) => [file, hash]))),
      loadedSourceSha256: sha256(JSON.stringify(orderedEntries(Object.fromEntries(
        [...loadedSources].map(([filename, hash]) => [path.relative(root, filename).split(path.sep).join('/'), hash]),
      )))),
      releaseManifestMatchesSource: manifestMatchesSource,
      behaviorModules,
      unexpectedDeclaredModules,
    },
    pvpRequirements: requirements,
    evidenceBoundary: [
      'Counts and card decisions come from the current engine exports; adapter presence is not complete card evidence.',
      'The shared room domain/test store and weekly turn-based Kumite routes do not prove hosted Breakthrough PvP.',
      'This local report runs no database, browser, network, physical-device or deployment checks.',
      'No external proof file or CLI switch can mark these unverified requirements ready.',
    ],
  };
}

export function formatSummary(report) {
  const gate = report.cardGate;
  const cards = gate.engineReadiness;
  return [
    'Kumite Breakthrough PvP: BLOCKED',
    `Evidence: ${report.assessment}; no hosted PvP or deployment validation.`,
    `Catalog: ${cards.supportedCards}/${cards.totalCards} concrete adapters; ${cards.verifiedCards}/${cards.totalCards} complete card proofs.`,
    `Card release gate: ${gate.ready ? 'ready' : 'blocked'}; public approval: ${gate.publicLaunchApproved}; public entry: ${gate.publicEntryEnabled}.`,
    `Full-catalog evidence: ${gate.fullCatalogEvidence === null ? 'null (missing)' : gate.fullCatalogEvidence.evidenceId}.`,
    ...cards.reasons.map((reason) => `  - ${reason}`),
    ...(gate.unsupportedCards.length ? ['Unsupported canonical cards:', ...gate.unsupportedCards.map((card) => `  - ${card.name} (${card.cardId})`)] : []),
    `Ruleset: ${report.fingerprints.ruleset}`,
    `Catalog SHA-256: ${report.fingerprints.catalogSignatureSha256}`,
    `Behavior source SHA-256: ${report.fingerprints.behaviorSourceSha256}`,
    `Release hashes match current source: ${report.fingerprints.releaseManifestMatchesSource}`,
    ...report.fingerprints.behaviorModules.filter((entry) => !entry.matchesDeclared).map((entry) => `  - Stale/missing release hash: ${entry.file}`),
    ...report.fingerprints.unexpectedDeclaredModules.map((filename) => `  - Declared module missing from source: ${filename}`),
    'Hosted PvP requirements (unverified; this audit cannot certify them):',
    ...report.pvpRequirements.map((entry) => `  - ${entry.id}: ${entry.proof}`),
  ].join('\n');
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) { process.stdout.write(help); return 0; }
  const report = await collectPreflight();
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) {
    const filename = path.resolve(options.output);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, json, 'utf8');
  }
  process.stdout.write(options.json ? json : `${formatSummary(report)}\n`);
  return options.requireReady && !report.overall.ready ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = await main(); }
  catch (error) {
    process.stderr.write(`Kumite PvP preflight failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
