import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cards } from '@workspace/squabblemon-engine/data';
import {
  createDefaultBalanceDecks, greedyBalancePolicy, seededLegalBalancePolicy, simulateBalanceMatch,
  type BalanceDeck, type BalanceMatchResult,
} from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import { elementDecks } from './element-balance-audit-decks';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(root, process.argv[3] ?? 'scripts/results/diner-focused-air-electric-sets');
const defaults = createDefaultBalanceDecks();
const diner = defaults.find(deck => deck.id === 'starter-squabblehouse-shift')!;
const opponents: Record<string, BalanceDeck> = {
  air: elementDecks.find(deck => deck.id === 'element-air')!,
  electric: elementDecks.find(deck => deck.id === 'element-electric')!,
  inmate: defaults.find(deck => deck.id === 'focus-cellblock')!,
  blood: {
    id: 'focused-red-set', name: 'Blood / Red Set',
    cardIds: ['triple-og-red', 'block-spinner', 'redside1', 'ganger-red', 'cane-corso-red',
      'initiation', 'guap', 'folks', 'cognac', 'bustdown'],
  },
  crip: {
    id: 'focused-blue-set', name: 'Crip / Blue Set',
    cardIds: ['triple-og-blue', 'look-out', 'blueside1', 'ganger-blue', 'blue-nose-pit',
      'initiation', 'waterboy', 'alchy', 'cognac', 'bustdown'],
  },
};
const policies = { greedy: greedyBalancePolicy, 'seeded-legal': seededLegalBalancePolicy };
const cases = Object.keys(policies).flatMap(policy =>
  ['diner-focused-fresh-a', 'diner-focused-fresh-b'].flatMap(seed =>
    [0, 5].flatMap(rotation => ([0, 3] as const).flatMap(tier =>
      (['a-player', 'b-player'] as const).map(seat => ({
        policy: policy as keyof typeof policies, seed, rotation, tier, seat,
        key: [policy, seed, rotation, tier, seat].join('|'),
      }))))));

function sourceHash(): string {
  const files = [fileURLToPath(import.meta.url), path.join(root, 'scripts/src/element-balance-audit-decks.ts')];
  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.ts')) files.push(file);
    }
  }
  visit(path.join(root, 'lib/squabblemon-engine/src'));
  const hash = createHash('sha256');
  for (const file of files.sort()) hash.update(path.relative(root, file)).update('\0').update(readFileSync(file)).update('\0');
  return hash.digest('hex');
}

type Scenario = typeof cases[number];
type Trace = {
  round: number; cardId: string; type: string; note: string;
  targets: { cardId: string; beforePower: number | null; afterPower: number | null }[];
};
type Row = { scenario: Scenario; result: BalanceMatchResult; dinerEvents: Trace[] };
const rate = (rows: Row[]) => {
  const wins = rows.filter(row => row.result.logicalWinner === 'a').length;
  const losses = rows.filter(row => row.result.logicalWinner === 'b').length;
  const draws = rows.filter(row => row.result.logicalWinner === 'draw').length;
  return { games: rows.length, wins, losses, draws, scoreRate: rows.length ? (wins + draws / 2) / rows.length : null };
};

const key = process.argv[2];
if (!opponents[key]) throw new Error(`Choose one opponent: ${Object.keys(opponents).join(', ')}`);
for (const deck of [diner, ...Object.values(opponents)]) {
  if (!deck || deck.cardIds.length !== 10 || new Set(deck.cardIds).size !== 10
    || deck.cardIds.some(id => !cards[id] || cards[id].kind === 'token' || cards[id].hazard)) throw new Error('Invalid playable ten-card crew');
}
if (cases.length !== 32 || new Set(cases.map(item => item.key)).size !== 32) throw new Error('Invalid focused schedule');
mkdirSync(output, { recursive: true });
const destination = path.join(output, `${key}.json`);
if (existsSync(destination)) throw new Error(`Preserve prior evidence: ${destination} exists`);
const fingerprint = sourceHash();
const started = Date.now();
const rows: Row[] = [];
const failures: { scenario: Scenario; message: string }[] = [];
for (const scenario of cases) {
  try {
    let dinerEvents: Trace[] = [];
    const result = simulateBalanceMatch({
      deckA: diner, deckB: opponents[key], districtSeed: scenario.seed,
      rotation: scenario.rotation, tier: scenario.tier, seat: scenario.seat,
      policy: policies[scenario.policy], allowSquabble: true,
      observeComplete: match => {
        const owner = scenario.seat === 'a-player' ? 'player' : 'cpu';
        dinerEvents = match.effectLog.filter(event => event.owner === owner && diner.cardIds.includes(event.cardId))
          .map(event => ({
            round: event.round, cardId: event.cardId, type: event.type, note: event.note,
            targets: event.targets.map(target => ({
              cardId: target.cardId, beforePower: target.before?.power ?? null, afterPower: target.after?.power ?? null,
            })),
          }));
      },
    });
    if (result.deckAId !== diner.id || result.deckBId !== opponents[key].id
      || result.seat !== scenario.seat || result.tier !== scenario.tier || result.rotation !== scenario.rotation
      || result.districtSeed !== scenario.seed || !['a', 'b', 'draw'].includes(result.logicalWinner)) throw new Error('Result axes mismatch');
    rows.push({ scenario, result, dinerEvents });
  } catch (error) {
    failures.push({ scenario, message: error instanceof Error ? error.stack ?? error.message : String(error) });
  }
}
if (sourceHash() !== fingerprint) throw new Error('Engine or runner changed during execution');
if (rows.length + failures.length !== cases.length) throw new Error('Incomplete attempted schedule');
const accepted = failures.length === 0;
const summary = accepted ? {
  all: rate(rows),
  greedy: rate(rows.filter(row => row.scenario.policy === 'greedy')),
  seeded: rate(rows.filter(row => row.scenario.policy === 'seeded-legal')),
  base: rate(rows.filter(row => row.scenario.tier === 0)),
  upgraded: rate(rows.filter(row => row.scenario.tier === 3)),
  first: rate(rows.filter(row => row.scenario.seat === 'a-player')),
  second: rate(rows.filter(row => row.scenario.seat === 'b-player')),
} : null;
writeFileSync(destination, JSON.stringify({
  generatedAt: new Date().toISOString(), sourceHash: fingerprint,
  balanceVersion: CARD_BALANCE_VERSION, rulesVersion: ONLINE_RULES_VERSION,
  status: accepted ? 'complete' : 'blocked', planned: cases.length, elapsedMs: Date.now() - started,
  diner, opponent: opponents[key], summary, failures, rows,
  note: 'Quick directional screen of these exact crews, not optimized archetypes or player win rates. Draws are half a point. Event counts are descriptive, not ability reliability.',
}), { flag: 'wx' });
console.log(JSON.stringify({ opponent: key, status: accepted ? 'complete' : 'blocked', elapsedMs: Date.now() - started, summary, failures: failures.length }));
if (!accepted) process.exitCode = 2;