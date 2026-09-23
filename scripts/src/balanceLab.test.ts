import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { balanceLabExitCode, runBalanceLabCli } from './balance-lab';
import {
  countBalanceMatrixMatches,
  createBalanceMatrixConfig,
  createDefaultBalanceDecks,
  isSuccessfulBalanceAbilityEvent,
  runBalanceMatrix,
  runHighRiskComboProbe,
  runPairedCardSwaps,
  seededDeckRotation,
  simulateBalanceMatch,
  firstLegalBalancePolicy,
  seededLegalBalancePolicy,
  type BalancePolicy,
} from '@workspace/squabblemon-engine/balanceLab';
import {
  createCardInstance,
  createMatch,
  playCard,
  type EffectLogEntry,
  type Match,
} from '@workspace/squabblemon-engine/gameEngine';

function playAbilityEvent(cardId: string, setup?: (match: Match) => Match): EffectLogEntry {
  const source = createCardInstance(cardId, 'player', 'balance-lab-test', 0);
  const initial = createMatch('vibes', 'vibes');
  const ready = setup?.({ ...initial, playerMotion: 20, playerHand: [source] })
    ?? { ...initial, playerMotion: 20, playerHand: [source] };
  const played = playCard(ready, 'player', source.instanceId, 0);
  const event = [...played.effectLog].reverse().find((entry) => entry.type === 'ability'
    && entry.cardId === cardId && !entry.abilityMetadata);
  assert.ok(event, 'expected ' + cardId + ' to emit an ability event');
  return event;
}

test('the CLI gate fails on blocker flags but ignores review-only reports', () => {
  assert.equal(balanceLabExitCode({ flags: [] }), 0);
  assert.equal(balanceLabExitCode({ flags: [{ severity: 'review' }] }), 0);
  assert.equal(balanceLabExitCode({ flags: [{ severity: 'blocker' }] }), 2);
});

test('ability success classification rejects real no-effect engine outcomes', () => {
  const noCleanse = playAbilityEvent('rastamon');
  assert.match(noCleanse.note, /found no status to cleanse/i);
  assert.equal(isSuccessfulBalanceAbilityEvent(noCleanse), false);

  const noSupport = playAbilityEvent('techbro');
  assert.match(noSupport.note, /needs another friendly card/i);
  assert.equal(isSuccessfulBalanceAbilityEvent(noSupport), false);

  const noEnemy = playAbilityEvent('cornball');
  assert.match(noEnemy.note, /found no enemies/i);
  assert.equal(isSuccessfulBalanceAbilityEvent(noEnemy), false);
});

test('ability success classification preserves mechanical fallbacks and real effects', () => {
  const frozenAlly = {
    ...createCardInstance('snow', 'player', 'balance-lab-test', 1),
    lane: 0 as const,
    statuses: {
      ...createCardInstance('snow', 'player', 'balance-lab-test', 1).statuses,
      frozen: true,
    },
  };
  const cleansed = playAbilityEvent('rastamon', (match) => ({
    ...match,
    boards: [[frozenAlly], [], []] as Match['boards'],
  }));
  assert.match(cleansed.note, /cleansed an ally/i);
  assert.equal(isSuccessfulBalanceAbilityEvent(cleansed), true);

  const fallback = playAbilityEvent('mural');
  assert.match(fallback.note, /needs another friendly type/i);
  assert.equal(isSuccessfulBalanceAbilityEvent(fallback), true, 'Fresh Color still grants its fallback +1 Hands');

  const revealed = playAbilityEvent('promoter', (match) => ({
    ...match,
    cpuHand: [createCardInstance('plug', 'cpu', 'balance-lab-test', 2)],
  }));
  assert.match(revealed.note, /Guest List revealed/i);
  assert.equal(isSuccessfulBalanceAbilityEvent(revealed), true, 'revealing a hand card is a successful non-mutating effect');
});

test('the CLI writes both reports before returning its intentional blocker exit', async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), 'squabblemon-balance-cli-'));
  try {
    const result = await runBalanceLabCli(['--smoke', '--out-dir', outputDirectory]);
    const [json, markdown] = await Promise.all([
      readFile(result.jsonPath, 'utf8'),
      readFile(result.markdownPath, 'utf8'),
    ]);
    const report = JSON.parse(json) as {
      mode: string;
      matrix: { matchCount: number };
      deterministicFingerprint: string;
    };

    assert.equal(result.exitCode, 2);
    assert.equal(result.blockerCount > 0, true);
    assert.equal(report.mode, 'smoke');
    assert.equal(report.matrix.matchCount, countBalanceMatrixMatches(createBalanceMatrixConfig('smoke')));
    assert.match(report.deterministicFingerprint, /^[0-9a-f]{8}$/);
    assert.match(markdown, /deterministic balance lab/i);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test('seeded deck rotations are reproducible permutations', () => {
  const source = createDefaultBalanceDecks()[0].cardIds;
  const first = seededDeckRotation(source, 'balance-seed', 3);
  const repeated = seededDeckRotation(source, 'balance-seed', 3);
  const changed = seededDeckRotation(source, 'balance-seed', 4);
  assert.deepEqual(first, repeated);
  assert.deepEqual([...first].sort(), [...source].sort());
  assert.notDeepEqual(first, changed);
});

test('the full command covers every deck pairing with mirrored seats and both tiers', () => {
  const config = createBalanceMatrixConfig('full');
  assert.equal(config.decks.length, 11);
  assert.equal(config.decks.filter((deck) => deck.id.startsWith('focus-')).length, 11);
  assert.equal(config.districtSeeds.length, 2);
  assert.deepEqual(config.rotations, [0, 5]);
  assert.deepEqual(config.tiers, [0, 3]);
  assert.equal(countBalanceMatrixMatches(config), 880);
});

test('task 118 archetype shells are ten-card, unique and deterministic', () => {
  const decks = createDefaultBalanceDecks();
  for (const id of ['focus-earth-tax', 'focus-detective', 'focus-wiz', 'focus-wonderland',
    'focus-fire-guap', 'focus-poison-entry', 'focus-cellblock', 'focus-demario-luigion']) {
    const deck = decks.find((candidate) => candidate.id === id);
    assert.ok(deck, `missing ${id}`);
    assert.equal(deck.cardIds.length, 10);
    assert.equal(new Set(deck.cardIds).size, 10);
  }
  const [a, b] = decks;
  for (const policy of [firstLegalBalancePolicy, seededLegalBalancePolicy]) {
    const result = simulateBalanceMatch({
      deckA: a, deckB: b, districtSeed: 'task-118-policy', rotation: 3, tier: 3,
      seat: 'a-player', policy, allowSquabble: false,
    });
    assert.equal(result.winner === 'player' || result.winner === 'cpu' || result.winner === 'draw', true);
  }
});

test('the matrix mirrors seats, tiers and deck order deterministically', () => {
  const decks = createDefaultBalanceDecks().slice(0, 2);
  const config = {
    id: 'ci-smoke', decks, districtSeeds: ['ci-district'], rotations: [0, 2], tiers: [0, 3] as const,
    includeMirrors: false, allowSquabble: true, minimumSampleSize: 1,
  };
  const first = runBalanceMatrix(config);
  const repeated = runBalanceMatrix(config);
  assert.deepEqual(first, repeated);
  assert.equal(first.matchCount, 8);
  assert.equal(first.seat.games, 8);
  assert.deepEqual(first.tiers.map(({ tier, games }) => [tier, games]), [[0, 4], [3, 4]]);
  assert.equal(first.decks.every((deck) => deck.asPlayerGames === deck.asCpuGames), true);
});

test('the matrix groups deterministic engine or policy failures instead of aborting the run', () => {
  const decks = createDefaultBalanceDecks().slice(0, 2);
  const throwingPolicy: BalancePolicy = () => { throw new Error('synthetic deterministic failure'); };
  const report = runBalanceMatrix({
    id: 'failure-capture', decks, districtSeeds: ['failure-seed'], rotations: [0], tiers: [0],
    includeMirrors: false, policy: throwingPolicy,
  });
  assert.equal(report.matchCount, 2);
  assert.equal(report.successfulMatches, 0);
  assert.equal(report.failedMatches, 2);
  assert.equal(report.failures[0].count, 2);
  assert.match(report.flags[0].code, /engine-simulation-failure/);
});

test('a custom side-neutral policy hook drives both owners to a complete match', () => {
  const [deckA, deckB] = createDefaultBalanceDecks();
  const calls = { player: 0, cpu: 0 };
  const firstLegalPolicy: BalancePolicy = ({ owner, legalPlays }) => {
    calls[owner] += 1;
    return legalPlays.find((option) => !option.squabble) ?? null;
  };
  const result = simulateBalanceMatch({
    deckA, deckB, districtSeed: 'policy-hook', rotation: 1, tier: 0, seat: 'a-player',
    policy: firstLegalPolicy, allowSquabble: false,
  });
  assert.equal(result.plays > 0, true);
  assert.equal(result.passes, 12);
  assert.equal(calls.player > 0, true);
  assert.equal(calls.cpu > 0, true);
});

test('paired card swaps hold seeds, rotations, seats and tiers constant', () => {
  const decks = createDefaultBalanceDecks();
  const baseDeck = decks[0];
  const removeCardId = baseDeck.cardIds[0];
  const addCardId = Object.keys(
    Object.fromEntries(decks.flatMap((deck) => deck.cardIds.map((cardId) => [cardId, true]))),
  ).find((cardId) => !baseDeck.cardIds.includes(cardId))!;
  const summaries = runPairedCardSwaps({
    experiments: [{ id: 'ci-swap', name: 'CI swap', baseDeck, removeCardId, addCardId }],
    opponents: [decks[1]], districtSeeds: ['ci-swap-district'], rotations: [0], tiers: [0, 3],
    allowSquabble: false,
  });
  assert.equal(summaries[0].pairedCases, 4);
  assert.equal(Number.isFinite(summaries[0].delta), true);
  assert.equal(Number.isFinite(summaries[0].standardError), true);
});

test('high-risk echo probes are owner symmetric and exercise the real resolution path', () => {
  const spec = { id: 'ci-counter-echo', firstCardId: 'counter', echoCardId: 'tayaty' as const };
  const player = runHighRiskComboProbe(spec, 3, 'player');
  const cpu = runHighRiskComboProbe(spec, 3, 'cpu');
  assert.equal(player.motionCost, cpu.motionCost);
  assert.equal(player.finalSwing, cpu.finalSwing);
  assert.equal(player.effectNotes.some((note) => /Mirror|Act Up/i.test(note)), true);
});
