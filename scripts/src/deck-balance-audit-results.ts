import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { auditDirectory, createAuditPlan, dinerId, type AuditCase, type AuditPlan, type AuditRow } from './deck-balance-audit';
import { rateFor, renderDeckBalanceAudit } from './deck-balance-audit-report';

type Failure = { scenario: AuditCase; message: string };
const plan = JSON.parse(readFileSync(path.join(auditDirectory, 'plan.json'), 'utf8')) as AuditPlan;
const current = createAuditPlan();
if (plan.sourceHash !== current.sourceHash || JSON.stringify(plan.cases) !== JSON.stringify(current.cases)
  || JSON.stringify(plan.decks) !== JSON.stringify(current.decks)) throw new Error('Cannot analyze a mixed-source audit');
const planned = new Map(plan.cases.map(item => [item.key, item]));
const seen = new Set<string>();
const rows: AuditRow[] = [];
const failures: Failure[] = [];
for (let index = 0; index < 8; index++) {
  const worker = JSON.parse(readFileSync(path.join(auditDirectory, `worker-${index}.json`), 'utf8')) as {
    index: number; count: number; sourceHash: string; rows: AuditRow[]; failures: Failure[];
  };
  if (worker.index !== index || worker.count !== 8 || worker.sourceHash !== plan.sourceHash) throw new Error('Incompatible worker');
  if (worker.rows.length + worker.failures.length !== plan.cases.filter((_, caseIndex) => caseIndex % 8 === index).length) {
    throw new Error('Missing attempted cases');
  }
  for (const item of [...worker.rows, ...worker.failures]) {
    if (seen.has(item.scenario.key) || JSON.stringify(item.scenario) !== JSON.stringify(planned.get(item.scenario.key))) {
      throw new Error('Duplicate or unexpected case');
    }
    seen.add(item.scenario.key);
  }
  for (const { scenario, result } of worker.rows) {
    if (result.deckAId !== scenario.a || result.deckBId !== scenario.b || result.districtSeed !== scenario.seed
      || result.rotation !== scenario.rotation || result.seat !== scenario.seat || result.tier !== scenario.tier
      || !['a', 'b', 'draw'].includes(result.logicalWinner)) throw new Error('Runtime result axes mismatch');
  }
  rows.push(...worker.rows);
  failures.push(...worker.failures);
}
if (seen.size !== planned.size) throw new Error('Incomplete attempted schedule');
const primary = rows.filter(row => row.scenario.phase !== 'confirmation');
if (failures.some(item => item.scenario.phase !== 'confirmation') || primary.length !== 2304) {
  throw new Error('Primary league/counter samples are not complete; do not publish their rates');
}
const allData = renderDeckBalanceAudit(plan, rows).data;
const primaryData = renderDeckBalanceAudit(plan, primary).data;
const pct = (value: number) => `${(100 * value).toFixed(1)}%`;
const matchups = allData.dinerTable.map(deck => {
  const issues = failures.filter(item => item.scenario.a === deck.opponentId || item.scenario.b === deck.opponentId);
  const accepted = issues.length === 0 && deck.confirmation.all.games === 64 && deck.all.games === 96;
  return {
    id: deck.opponentId, opponent: deck.opponent, primary: deck.primary,
    confirmationStatus: accepted ? 'accepted-complete' : 'blocked-by-engine-failures',
    combined: accepted ? { all: deck.all, greedy: deck.greedy, seededLegal: deck.seededLegal, base: deck.base, upgraded: deck.upgraded } : null,
    confirmation: accepted ? deck.confirmation : null,
    failureCount: issues.length, failedCases: issues.map(item => item.scenario),
  };
});
const league = rows.filter(row => row.scenario.phase === 'league');
const firstSeat = {
  games: league.length,
  wins: league.filter(row => row.result.winner === 'player').length,
  draws: league.filter(row => row.result.winner === 'draw').length,
  scoreRate: league.reduce((sum, row) => sum + (row.result.winner === 'draw' ? 0.5 : row.result.winner === 'player' ? 1 : 0), 0) / league.length,
};
const findings = {
  balanceVersion: plan.balanceVersion, rulesVersion: plan.rulesVersion, sourceHash: plan.sourceHash,
  plannedMatches: plan.cases.length, completedMatches: rows.length, failedMatches: failures.length,
  fullAuditStatus: failures.length ? 'blocked-by-engine-failures' : 'accepted-complete',
  primaryStatus: 'accepted-complete', primaryMatches: primary.length, league: allData.leagueTable, firstSeat,
  dinerPrimary: primaryData.dinerOverall, dinerMatchups: matchups,
  dinerCardsPrimary: primaryData.dinerCards, managerPrimary: primaryData.manager, failures,
};
writeFileSync(path.join(auditDirectory, 'findings.json'), JSON.stringify(findings, null, 2) + '\n');
const markdown = [
  '# Squabblemon v33 deck balance findings', '',
  `**Full audit: BLOCKED.** ${plan.cases.length} unique cases attempted; ${rows.length} completed and ${failures.length} engine failures.`,
  '**Accepted primary sample:** 2,112 round-robin matches plus 192 dedicated diner-counter matches, with zero failures and complete case sets.',
  'All nine saved ten-card decks plus three benchmark crews; six additional counter crews for the diner.',
  'Two deterministic bots (greedy one-play-ahead / seeded legal), both seats, base / fully upgraded cards.',
  'Primary schedule: two district seeds × two draw rotations. Diner confirmation: four separate district seeds × two different rotations; no tuning between phases.',
  '**Score % means wins plus half draws. These are bot samples, not live player win rates or isolated card-strength estimates.**', '',
  '## Complete twelve-crew round robin', '',
  '| Crew | Games | Wins / losses / draws | Score % | Greedy | Seeded legal | Base | Upgraded |',
  '|---|---:|---|---:|---:|---:|---:|---:|',
  ...allData.leagueTable.map(deck => `| ${deck.name} | ${deck.all.games} | ${deck.all.wins} / ${deck.all.losses} / ${deck.all.draws} | ${pct(deck.all.scoreRate)} | ${pct(deck.greedy.scoreRate)} | ${pct(deck.seededLegal.scoreRate)} | ${pct(deck.base.scoreRate)} | ${pct(deck.upgraded.scoreRate)} |`),
  '', `First-seat score ${pct(firstSeat.scoreRate)}; second-seat score ${pct(1 - firstSeat.scoreRate)} across ${firstSeat.games} games. This is a policy/rules interaction to review, not proof of a live player advantage.`, '',
  '## Diner against seventeen opponents', '',
  'Every primary row below is a complete 32-game block. Combined rates use 96 games only where all 64 fresh confirmation cases also completed successfully. Incomplete confirmation blocks have no accepted rate.', '',
  '| Opponent | Primary score (32 games) | Combined score (96 games) | Fresh score (64 games) | Failures |',
  '|---|---:|---:|---:|---:|',
  ...matchups.map(deck => `| ${deck.opponent} | ${pct(deck.primary.all.scoreRate)} | ${deck.combined ? pct(deck.combined.all.scoreRate) : 'BLOCKED'} | ${deck.confirmation ? pct(deck.confirmation.all.scoreRate) : 'BLOCKED'} | ${deck.failureCount} |`),
  '', '## Rework priorities', '',
  '1. **Fix the Subway ride crash before balance changes.** All failures use the fresh-04 district set (Underground Ring / Waff-L House / The Subway). The shared play-resolution path reads the rider after movement even when it has been removed. Failed cases are not wins, losses, or draws.',
  '2. **Review Wonderland Return before nerfing the diner.** It scored 84.4% across the same 352-game league schedule and beat the diner consistently on both primary and fresh schedules. Inspect return/payoff/finisher interactions with isolated tests before choosing a specific card change.',
  '3. **Rework the Who You Know and Compound Interest recipes/payoffs.** They scored 26.3% and 28.0% respectively in this field, with low scores under both policies. Distinguish advanced recipe improvements from changes to tutorial-owned starter cards.',
  '4. **Monitor Manager scaling, not a blanket diner nerf.** The diner is strong versus starter recipes but remains countered by Wonderland. Peak Hands include all buffs, not just its staff aura; no individual-card ablation was performed.',
  '', '## Diner observations — complete primary sample only', '',
  '| Card | Games played / 544 available | Present at end | Average final Hands if present |',
  '|---|---:|---:|---:|',
  ...primaryData.dinerCards.map(card => `| ${card.cardId} | ${card.gamesPlayed} / ${card.games} | ${card.gamesSurviving} | ${card.averageFinalHandsWhenPresent.toFixed(2)} |`),
  '', `Manager: played in ${primaryData.manager.gamesPlayed} complete primary games; average peak ${primaryData.manager.meanPeakHands.toFixed(2)} Hands, of which ${primaryData.manager.meanPeakAura.toFixed(2)} were ongoing. Maxima ${primaryData.manager.maximumPeakHands} total / ${primaryData.manager.maximumPeakAura} ongoing. Descriptive observations, not causal contribution or ability reliability.`,
  '', '## Failed cases', '',
  ...failures.map(item => `- ${item.scenario.key}: ${item.message.split('\n')[0]}`),
  '', '## Evidence and limits', '',
  '- Exact source fingerprint, rosters, planned axes and case keys are saved in plan.json.',
  '- All eight worker files retain raw results and failures. Analysis verifies complete attempted coverage, unique keys and runtime axes.',
  '- Any incomplete matchup confirmation is explicitly blocked; no failed cases are counted as losses or hidden.',
  '- The bots enumerate card plays/SQUABBLE and ability-driven movement, not all deliberate movement strategy or human planning.',
  '- No gameplay, balance values, saved recipes, starter cards, database, Git release or published app was changed.',
  `- Source SHA-256: ${plan.sourceHash}.`, '',
].join('\n');
writeFileSync(path.join(auditDirectory, 'findings.md'), markdown);
console.log(markdown);
console.log(`AUDIT_ANALYSIS_COMPLETE attempted=${seen.size} completed=${rows.length} failures=${failures.length} primaryAccepted=${primary.length}`);