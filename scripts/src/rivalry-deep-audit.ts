import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  greedyBalancePolicy, seededLegalBalancePolicy, simulateBalanceMatch,
  type BalanceMatchResult, type BalancePolicy, type BalanceTier,
} from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import { allRankingDecks } from './all-decks-ranking-decks';
import { root, sourceHash } from './all-decks-ranking';
import { chainBalancePolicy, pairedSeededPolicy } from './rivalry-audit-policies';

const mode = process.argv[2], label = process.argv[3];
assert(['field', 'decisions', 'tier2', 'chain', 'outliers'].includes(mode));
assert(label && /^[a-z0-9-]+$/.test(label));
const output = `${root}/scripts/results/crip-followup/${label}.json`;
assert(!existsSync(output), 'Never overwrite earlier evidence');
const hash = sourceHash();
const runnerHash = createHash('sha256').update(readFileSync(new URL(import.meta.url)))
  .update(readFileSync(new URL('./rivalry-audit-policies.ts', import.meta.url))).digest('hex');
const decks = allRankingDecks();
for (const deck of decks) assert(!deck.cardIds.includes('guap'), `${deck.id}: forbidden GUAP`);
const blue = decks.find(deck => deck.id === 'focused-blue-set')!;
const red = decks.find(deck => deck.id === 'focused-red-set')!;
const crews = (mode === 'field' || mode === 'outliers') ? [blue, red] : [blue];
const seeds = Array.from({ length: mode === 'tier2' ? 12 : mode === 'field' ? 2 : 4 }, (_, i) => `rivalry-deep-${mode}-${i}`);
const tiers: BalanceTier[] = mode === 'tier2' ? [1, 2, 3] : (mode === 'field' || mode === 'outliers') ? [0, 3] : [0, 1, 2, 3];
const rotations = mode === 'field' ? [0] : [0, 5];
const policyNames = mode === 'chain' ? ['chain', 'greedy'] : mode === 'decisions' ? ['greedy', 'seeded', 'paired-seeded'] : ['greedy', 'paired-seeded'];
type CardStat = { id: string; played: number; upgrades: number; noEffect: number; baseEvents: number; finalPower: number };
type Action = { owner: string; deck: string; round: number; card: string | null; lane: number | null; squabble: boolean; motion: number; legal: number; delta: number; hand: string[]; otherBest?: string; };
type Row = { crew: string; opponent: string; policy: string; seed: string; rotation: number; tier: BalanceTier; seat: 'a-player' | 'b-player';
  result: Omit<BalanceMatchResult, 'cardsA' | 'cardsB'>; cardsA: CardStat[]; cardsB: CardStat[];
  actions?: Action[]; voluntaryPasses: Record<string, number>; counterfactualChoices: number };
const outlierIds = ['element-electric', 'starter-squabblehouse-shift', 'starter-combo'];
const opponentsFor = (crew: typeof blue) => mode === 'field' ? decks.filter(deck => deck.id !== crew.id)
  : mode === 'outliers' ? decks.filter(deck => outlierIds.includes(deck.id)) : [red];
const rows: Row[] = [];
for (const crew of crews) for (const opponent of opponentsFor(crew)) {
  for (const policyName of policyNames) for (const seed of seeds) for (const rotation of rotations) for (const tier of tiers) for (const seat of ['a-player', 'b-player'] as const) {
    const base: BalancePolicy = policyName === 'greedy' ? greedyBalancePolicy : policyName === 'seeded' ? seededLegalBalancePolicy
      : policyName === 'chain' ? chainBalancePolicy : pairedSeededPolicy(`${seed}:${rotation}:${tier}`);
    const actions: Action[] = [], voluntaryPasses: Record<string, number> = {};
    let counterfactualChoices = 0;
    const policy: BalancePolicy = context => {
      const chosen = base(context), { match, owner, legalPlays, evaluate } = context;
      const deck = owner === 'player' ? match.playerDeck : match.cpuDeck;
      if (!chosen && legalPlays.length) voluntaryPasses[deck] = (voluntaryPasses[deck] ?? 0) + 1;
      if (mode !== 'field') {
        const greedy = policyName === 'chain' ? greedyBalancePolicy(context) : undefined;
        if (policyName === 'chain' && (greedy?.instanceId !== chosen?.instanceId || greedy?.lane !== chosen?.lane || greedy?.squabble !== chosen?.squabble)) counterfactualChoices++;
        actions.push({ owner, deck, round: match.round, card: chosen?.cardId ?? null, lane: chosen?.lane ?? null,
          squabble: chosen?.squabble ?? false, motion: owner === 'player' ? match.playerMotion : match.cpuMotion,
          legal: legalPlays.length, delta: chosen ? evaluate(chosen.preview, owner) - evaluate(match, owner) : 0,
          hand: (owner === 'player' ? match.playerHand : match.cpuHand).map(card => card.cardId),
          ...(policyName === 'chain' ? { otherBest: greedy?.cardId ?? 'pass' } : {}) });
      }
      return chosen;
    };
    const result = simulateBalanceMatch({ deckA: crew, deckB: opponent, districtSeed: seed, rotation, tier, seat, policy, allowSquabble: true });
    const { cardsA, cardsB, ...compact } = result;
    const summarizeCards = (cards: typeof cardsA) => cards.map(card => ({ id: card.cardId, played: card.played,
      upgrades: card.abilityEvidence.upgradeAppliedEvents, noEffect: card.abilityEvidence.baseNoObservedEffectEvents,
      baseEvents: card.abilityEvidence.baseEvents, finalPower: card.finalPower }));
    rows.push({ crew: crew.id, opponent: opponent.id, policy: policyName, seed, rotation, tier, seat,
      result: compact, cardsA: summarizeCards(cardsA), cardsB: summarizeCards(cardsB),
      ...(mode !== 'field' ? { actions } : {}), voluntaryPasses, counterfactualChoices });
  }
  console.log(`${label}: ${crew.id} vs ${opponent.id}, ${rows.length} games`);
}
const expected = crews.reduce((n, crew) => n + opponentsFor(crew).length, 0)
  * policyNames.length * seeds.length * rotations.length * tiers.length * 2;
assert.equal(rows.length, expected);
assert.equal(sourceHash(), hash, 'Engine/roster changed during audit');
const score = (group: Row[]) => ({ games: group.length, score: group.reduce((sum, row) => sum + (row.result.logicalWinner === 'a' ? 1 : row.result.logicalWinner === 'draw' ? 0.5 : 0), 0) / group.length });
const summary = crews.map(crew => {
  const group = rows.filter(row => row.crew === crew.id);
  return { crew: crew.id, all: score(group),
    policies: Object.fromEntries(policyNames.map(p => [p, score(group.filter(row => row.policy === p))])),
    tiers: Object.fromEntries(tiers.map(t => [t, score(group.filter(row => row.tier === t))])),
    seats: Object.fromEntries(['a-player', 'b-player'].map(s => [s, score(group.filter(row => row.seat === s))])),
    opponents: Object.fromEntries([...new Set(group.map(row => row.opponent))].map(o => [o, score(group.filter(row => row.opponent === o))])) };
});
mkdirSync(`${root}/scripts/results/crip-followup`, { recursive: true });
writeFileSync(output, JSON.stringify({ mode, hash, runnerHash, version: CARD_BALANCE_VERSION, excludedCardIds: ['guap'],
  schedule: { seeds, rotations, tiers, policies: policyNames, seats: ['a-player', 'b-player'] }, decks, summary, rows }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary));
