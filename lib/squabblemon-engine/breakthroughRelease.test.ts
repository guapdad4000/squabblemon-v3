import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame } from './src/breakthrough';
import { anunakiCards } from './src/anunakiWave';
import {
  BREAKTHROUGH_ROSTER,
  BREAKTHROUGH_STARTER_DECKS,
  getBreakthroughLaunchCoverage,
  getBreakthroughLaunchReadiness,
} from './src/breakthroughCatalog';
import {
  BREAKTHROUGH_CARD_RELEASE_CHECKS,
  BREAKTHROUGH_RULE_INPUT_SHA256,
  evaluateBreakthroughRelease,
  isBreakthroughPublicEntryEnabled,
  type BreakthroughCatalogCoverage,
  type BreakthroughFullCatalogEvidence,
} from './src/breakthroughRelease';
import {
  BreakthroughRoomError,
  BreakthroughRoomService,
  createBreakthroughRoom,
  createBreakthroughRoomForSimulation,
} from './src/breakthroughRoom';

const coverage: BreakthroughCatalogCoverage = {
  ruleset: 'reviewed-rules',
  catalogSignature: 'canonical-inputs',
  cards: [
    { cardId: 'fighter', supported: true },
    { cardId: 'action', supported: true },
  ],
};
function proof(
  input: BreakthroughCatalogCoverage = coverage,
): BreakthroughFullCatalogEvidence {
  return {
    evidenceId: 'verified-local-run',
    ruleset: input.ruleset,
    catalogSignature: input.catalogSignature,
    cards: input.cards.map((card) => ({
      cardId: card.cardId,
      checks: [...BREAKTHROUGH_CARD_RELEASE_CHECKS],
    })),
  };
}
test('actual 301-of-311 catalog stays closed with 10 unsupported Anunaki cards, missing evidence and approval', () => {
  const status = getBreakthroughLaunchReadiness();
  assert.equal(status.totalCards, 311);
  assert.equal(status.supportedCards, 301);
  assert.deepEqual(
    [...status.unsupportedCardIds].sort(),
    Object.keys(anunakiCards).sort(),
  );
  assert.equal(status.canLaunch, false);
  assert.equal(isBreakthroughPublicEntryEnabled(), false);
});
test('Anunaki adapters remain a launch blocker even with hypothetical full proof and approval', () => {
  const current = getBreakthroughLaunchCoverage();
  const status = evaluateBreakthroughRelease(current, proof(current), true);
  assert.equal(status.totalCards, 311);
  assert.equal(status.supportedCards, 301);
  assert.equal(status.verifiedCards, 311);
  assert.equal(status.canLaunch, false);
  assert.deepEqual(status.reasons, [
    '10 canonical cards still need concrete Breakthrough effects.',
  ]);
});
test('complete adapter presence never replaces per-card proof or explicit approval', () => {
  const allSupported = {
    ...getBreakthroughLaunchCoverage(),
    cards: getBreakthroughLaunchCoverage().cards.map((card) => ({
      ...card,
      supported: true,
    })),
  };
  const missingProof = evaluateBreakthroughRelease(allSupported, null, true);
  assert.equal(missingProof.supportedCards, 311);
  assert.equal(missingProof.canLaunch, false);
  assert.equal(missingProof.unverifiedCardIds.length, 311);
  assert.equal(
    evaluateBreakthroughRelease(coverage, proof(), false).canLaunch,
    false,
  );
  assert.equal(
    evaluateBreakthroughRelease(coverage, proof(), true).canLaunch,
    true,
  );
});
test('every required gameplay and usability proof is mandatory for every card', () => {
  for (const check of BREAKTHROUGH_CARD_RELEASE_CHECKS) {
    const evidence = proof();
    evidence.cards = evidence.cards.map((card, index) =>
      index
        ? card
        : { ...card, checks: card.checks.filter((value) => value !== check) },
    );
    const status = evaluateBreakthroughRelease(coverage, evidence, true);
    assert.equal(status.canLaunch, false, check);
    assert.deepEqual(status.unverifiedCardIds, ['fighter']);
  }
});
test('new cards, changed printed input or changed rules invalidate older evidence', () => {
  const evidence = proof();
  for (const changed of [
    { ...coverage, ruleset: 'changed-rules' },
    { ...coverage, catalogSignature: 'changed-cost-effect-or-adapter' },
    {
      ...coverage,
      cards: [...coverage.cards, { cardId: 'new-card', supported: true }],
    },
    {
      ...coverage,
      cards: coverage.cards.map((card) => ({ ...card, supported: false })),
    },
  ])
    assert.equal(
      evaluateBreakthroughRelease(changed, evidence, true).canLaunch,
      false,
    );
});
test('duplicate, partial, extra or unnamed proof sets fail closed', () => {
  const evidence = proof();
  for (const changed of [
    { ...evidence, cards: evidence.cards.slice(1) },
    { ...evidence, cards: [evidence.cards[0], evidence.cards[0]] },
    {
      ...evidence,
      cards: [
        ...evidence.cards,
        { ...evidence.cards[0], cardId: 'not-canonical' },
      ],
    },
    { ...evidence, evidenceId: '  ' },
  ])
    assert.equal(
      evaluateBreakthroughRelease(coverage, changed, true).canLaunch,
      false,
    );
  const empty = { ...coverage, cards: [] };
  assert.equal(
    evaluateBreakthroughRelease(empty, proof(empty), true).canLaunch,
    false,
  );
  const duplicate = {
    ...coverage,
    cards: [coverage.cards[0], coverage.cards[0]],
  };
  assert.equal(
    evaluateBreakthroughRelease(duplicate, proof(duplicate), true).canLaunch,
    false,
  );
});
test('public room admission rejects before creating a room; internal simulation still works', () => {
  const deck = BREAKTHROUGH_STARTER_DECKS[0].catalogCardIds;
  const input = {
    roomId: 'not-released',
    members: { player: 'one', opponent: 'two' },
    ownerFence: 1,
    serverTimeMs: 1000,
    expiresAtMs: 300000,
    game: createGame(BREAKTHROUGH_ROSTER, {
      decks: { player: deck, opponent: deck },
    }),
  };
  const before = structuredClone(input);
  assert.throws(
    () => createBreakthroughRoom(input),
    (error) =>
      error instanceof BreakthroughRoomError &&
      error.code === 'mode-unavailable',
  );
  assert.deepEqual(input, before);
  assert.equal(createBreakthroughRoomForSimulation(input).phase, 'active');
});

test('release evidence fingerprints the current engine, adapters and room implementation', () => {
  const inputs = readdirSync(new URL('./src/', import.meta.url)).filter(
    (file) =>
      /^breakthrough.*\.ts$/.test(file) && file !== 'breakthroughRelease.ts',
  );
  assert.deepEqual(
    Object.keys(BREAKTHROUGH_RULE_INPUT_SHA256).sort(),
    inputs.sort(),
    'Every behavior module must participate in the release fingerprint',
  );
  for (const file of inputs) {
    const actual = createHash('sha256')
      .update(readFileSync(new URL(`./src/${file}`, import.meta.url)))
      .digest('hex');
    assert.equal(
      BREAKTHROUGH_RULE_INPUT_SHA256[file],
      actual,
      `${file} changed: refresh release inputs and reverify affected cards.`,
    );
  }
});
test('default room service cannot resume or view private simulation rooms before launch', () => {
  let loads = 0;
  assert.throws(
    () =>
      new BreakthroughRoomService({
        roomId: 'private-fixture',
        ownerFence: 1,
        now: () => 1000,
        store: {
          load: async () => {
            loads++;
            return null;
          },
          commit: async () => true,
        },
      }),
    (error) =>
      error instanceof BreakthroughRoomError &&
      error.code === 'mode-unavailable',
  );
  assert.equal(loads, 0);
});
