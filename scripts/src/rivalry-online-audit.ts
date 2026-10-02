import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { getMatchWinner, type Owner } from '@workspace/squabblemon-engine/gameEngine';
import { listLegalBalancePlays, evaluateBalanceState, greedyBalancePolicy } from '@workspace/squabblemon-engine/balanceLab';
import { root, sourceHash } from './all-decks-ranking';
import { chainBalancePolicy, pairedSeededPolicy } from './rivalry-audit-policies';
import { createRivalryRoom, applyRivalryCommand, rivalryRecipes, type RivalryCommand } from './rivalry-online-model';
import { allRankingDecks } from './all-decks-ranking-decks';
const label = process.argv[2];
assert(label && /^[a-z0-9-]+$/.test(label));
const output = `${root}/scripts/results/crip-followup/${label}.json`;
assert(!existsSync(output));
const hash = sourceHash();
const runnerHash = createHash('sha256');
for (const path of ['./rivalry-online-audit.ts', './rivalry-online-model.ts', './rivalry-audit-policies.ts']) runnerHash.update(readFileSync(new URL(path, import.meta.url)));
for (const [side, id] of [['blue', 'focused-blue-set'], ['red', 'focused-red-set']] as const) {
  assert.deepEqual(rivalryRecipes[side], allRankingDecks().find(d => d.id === id)!.cardIds);
  assert(!rivalryRecipes[side].includes('guap'));
}
type OnlineAuditRow = {
  seed: string; flow: 'online-alternating' | 'fixed-opener'; policy: string; tier: number;
  first: 'blue' | 'red'; openingSeat: Owner; blueOpens: boolean; winner: 'blue' | 'red' | 'draw';
  openers: { round: number; side: string }[]; plays: number;
  played: { owner: Owner; card: string | undefined; round: number }[];
};
const rows: OnlineAuditRow[] = [];
const holdout = process.argv.includes('--base-holdout');
const seedPrefix = process.argv.find(arg => arg.startsWith('--seed-prefix='))?.slice('--seed-prefix='.length);
assert(seedPrefix === undefined || /^[a-z0-9-]+$/.test(seedPrefix), 'invalid seed prefix');
const seeds = Array.from({ length: holdout ? 16 : 4 }, (_, i) =>
  `${seedPrefix ?? (holdout ? 'rivalry-online-base-confirm' : 'rivalry-online')}-${i}`);
const flows = holdout ? ['online-alternating'] as const : ['online-alternating', 'fixed-opener'] as const;
const tiers = holdout ? [0] : [0, 1, 2, 3];
for (const seed of seeds) {
  for (const flow of flows) for (const policyName of ['greedy', 'paired-seeded', 'chain'])
    for (const tier of tiers) for (const first of ['blue', 'red'] as const) for (const openingSeat of ['player', 'cpu'] as const) {
      const settings = { seed, tier, first, openingSeat };
      let room = createRivalryRoom(settings);
      const policy = policyName === 'greedy' ? greedyBalancePolicy : policyName === 'chain' ? chainBalancePolicy : pairedSeededPolicy(`${seed}:${tier}`);
      const commands: RivalryCommand[] = [], openers: {round: number; side: string}[] = [];
      let roundSeen = 0;
      while (room.status !== 'complete') {
        const match = room.match!, owner = room.activeSeat;
        if (roundSeen !== match.round) {
          roundSeen = match.round;
          openers.push({ round: match.round, side: owner === 'player' ? match.playerDeck : match.cpuDeck });
          const expected: Owner = flow === 'fixed-opener' || match.round % 2 === 1 ? openingSeat : openingSeat === 'player' ? 'cpu' : 'player';
          assert.equal(owner, expected);
        }
        const legalPlays = listLegalBalancePlays(match, owner, true);
        const choice = policy({ match, owner, legalPlays, actionIndex: commands.length, seed: `${seed}:${tier}`, evaluate: evaluateBalanceState });
        const command: RivalryCommand = choice ? { kind: 'play', owner, id: choice.instanceId, lane: choice.lane, squabble: choice.squabble } : { kind: 'pass', owner };
        const next = applyRivalryCommand(room, command);
        if (choice) assert.deepEqual(next.match, choice.preview, 'multiplayer play must match canonical preview');
        if (flow === 'fixed-opener' && next.status !== 'complete' && next.match!.round !== match.round) {
          next.activeSeat = openingSeat;
          next.match = { ...next.match!, phase: openingSeat === 'player' ? 'player' : 'cpu-reveal' };
        }
        room = next; commands.push(command); assert(commands.length < 100);
      }
      const match = room.match!, winner = getMatchWinner(match)!;
      const blueOwner = first === 'blue' ? 'player' : 'cpu';
      rows.push({ seed, flow, policy: policyName, tier, first, openingSeat, blueOpens: openingSeat === blueOwner,
        winner: winner === 'draw' ? 'draw' : winner === blueOwner ? 'blue' : 'red', openers,
        plays: commands.filter(c => c.kind === 'play').length,
        played: match.effectLog.filter(e => e.type === 'play').map(e => ({ owner: e.owner, card: e.cardId, round: e.replay.before.round })) });
    }
  console.log(`${label}: ${seed}, ${rows.length} games`);
}
assert.equal(rows.length, seeds.length * flows.length * 3 * tiers.length * 2 * 2);
assert.equal(sourceHash(), hash);
const score = (group: typeof rows) => ({ games: group.length, score: group.reduce((n, r) => n + (r.winner === 'blue' ? 1 : r.winner === 'draw' ? .5 : 0), 0) / group.length });
const summary = flows.map(flow => {
  const group = rows.filter(r => r.flow === flow);
  return { flow, all: score(group), policies: Object.fromEntries(['greedy', 'paired-seeded', 'chain'].map(p => [p, score(group.filter(r => r.policy === p))])),
    opening: Object.fromEntries([true, false].map(first => [String(first), score(group.filter(r => r.blueOpens === first))])),
    tiers: Object.fromEntries(tiers.map(t => [t, score(group.filter(r => r.tier === t))])) };
});
mkdirSync(`${root}/scripts/results/crip-followup`, { recursive: true });
writeFileSync(output, JSON.stringify({ hash, schedule: { seeds, flows, tiers }, runnerHash: runnerHash.digest('hex'), excludedCardIds: ['guap'], recipes: rivalryRecipes, summary, rows }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary));
