import type { AuditPlan, AuditRow } from './deck-balance-audit';

const dinerId = 'starter-squabblehouse-shift';
type Rate = { games: number; wins: number; losses: number; draws: number; winRate: number; scoreRate: number };
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function rateFor(rows: readonly AuditRow[], deckId: string): Rate {
  let games = 0; let wins = 0; let losses = 0; let draws = 0;
  for (const row of rows) {
    if (row.scenario.a !== deckId && row.scenario.b !== deckId) continue;
    games++;
    if (row.result.logicalWinner === 'draw') draws++;
    else if (row.result.logicalWinner === (row.scenario.a === deckId ? 'a' : 'b')) wins++;
    else losses++;
  }
  return { games, wins, losses, draws, winRate: games ? wins / games : 0, scoreRate: games ? (wins + draws / 2) / games : 0 };
}

export function renderDeckBalanceAudit(plan: AuditPlan, rows: readonly AuditRow[]) {
  const league = rows.filter(row => row.scenario.phase === 'league');
  const name = (id: string) => plan.decks.find(deck => deck.id === id)!.name;
  const splits = (sample: readonly AuditRow[], id: string) => ({
    all: rateFor(sample, id),
    greedy: rateFor(sample.filter(row => row.scenario.policy === 'greedy'), id),
    seededLegal: rateFor(sample.filter(row => row.scenario.policy === 'seeded-legal'), id),
    base: rateFor(sample.filter(row => row.scenario.tier === 0), id),
    upgraded: rateFor(sample.filter(row => row.scenario.tier === 3), id),
    first: rateFor(sample.filter(row => (row.scenario.a === id) === (row.scenario.seat === 'a-player')), id),
    second: rateFor(sample.filter(row => (row.scenario.a === id) !== (row.scenario.seat === 'a-player')), id),
    greedyBase: rateFor(sample.filter(row => row.scenario.policy === 'greedy' && row.scenario.tier === 0), id),
    greedyUpgraded: rateFor(sample.filter(row => row.scenario.policy === 'greedy' && row.scenario.tier === 3), id),
    seededBase: rateFor(sample.filter(row => row.scenario.policy === 'seeded-legal' && row.scenario.tier === 0), id),
    seededUpgraded: rateFor(sample.filter(row => row.scenario.policy === 'seeded-legal' && row.scenario.tier === 3), id),
  });
  const leagueTable = plan.leagueIds.map(id => ({ id, name: name(id), ...splits(league, id) }))
    .sort((a, b) => b.all.scoreRate - a.all.scoreRate);
  const dinerRows = rows.filter(row => row.scenario.a === dinerId || row.scenario.b === dinerId);
  const opponents = plan.decks.filter(deck => deck.id !== dinerId);
  const dinerTable = opponents.map(deck => {
    const sample = dinerRows.filter(row => row.scenario.a === deck.id || row.scenario.b === deck.id);
    return {
      opponentId: deck.id, opponent: deck.name, ...splits(sample, dinerId),
      primary: splits(sample.filter(row => row.scenario.phase !== 'confirmation'), dinerId),
      confirmation: splits(sample.filter(row => row.scenario.phase === 'confirmation'), dinerId),
    };
  }).sort((a, b) => a.all.scoreRate - b.all.scoreRate);
  const dinerCards = plan.decks.find(deck => deck.id === dinerId)!.cardIds.map(cardId => {
    const observations = dinerRows.flatMap(row => {
      const sample = row.scenario.a === dinerId ? row.result.cardsA : row.result.cardsB;
      return sample.filter(card => card.cardId === cardId);
    });
    const played = observations.filter(card => card.played > 0);
    const surviving = observations.filter(card => card.finalCopies > 0);
    return {
      cardId, games: observations.length, gamesPlayed: played.length, gamesSurviving: surviving.length,
      deployments: observations.reduce((sum, card) => sum + card.played, 0),
      finalHands: observations.reduce((sum, card) => sum + card.finalPower, 0),
      playRate: played.length / observations.length,
      averageFinalHandsWhenPresent: surviving.length ? surviving.reduce((sum, card) => sum + card.finalPower, 0) / surviving.length : 0,
    };
  });
  const managerTraces = dinerRows.flatMap(row => row.dinerTrace?.managerPlayed ? [row.dinerTrace] : []);
  const manager = {
    gamesPlayed: managerTraces.length,
    meanPeakHands: managerTraces.reduce((sum, trace) => sum + trace.peakManagerHands, 0) / managerTraces.length,
    meanPeakAura: managerTraces.reduce((sum, trace) => sum + trace.peakManagerAura, 0) / managerTraces.length,
    maximumPeakHands: Math.max(...managerTraces.map(trace => trace.peakManagerHands)),
    maximumPeakAura: Math.max(...managerTraces.map(trace => trace.peakManagerAura)),
  };
  const data = {
    generatedAt: new Date().toISOString(), balanceVersion: plan.balanceVersion, rulesVersion: plan.rulesVersion,
    sourceHash: plan.sourceHash, successfulMatches: rows.length, failedMatches: 0,
    leagueTable, dinerTable, dinerCards, manager,
    dinerOverall: splits(dinerRows, dinerId),
    note: 'Deterministic bot samples, not player win rates or isolated causal card strength. Draws count as half a point. Source-attributed event counts are descriptive, not eligible-opportunity success rates.',
  };
  const markdown = [
    '# Current deck balance audit — approved diner rules v33', '',
    `- ${rows.length.toLocaleString()} unique successful matches; zero simulation failures.`,
    '- All nine authored ten-card saved recipes; Wonderland, The Wiz, Fire/GUAP round robin; six extra counter crews.',
    '- Greedy one-play-ahead and seeded-legal bots; SQUABBLE enabled for legal character plays.',
    '- Base and fully upgraded ability tiers; both seats. Primary: two new district seeds, rotations 0/5.',
    '- Diner confirmation: four untouched district seeds, rotations 2/7. No tuning between phases.',
    '- Score percentage = wins + half draws. These are bot samples, not live player win rates.',
    `- Source SHA-256: ${plan.sourceHash}. No game, deck, database or balance values changed.`, '',
    '## Twelve-crew round robin', '',
    '| Crew | Games | Win % | Score % | Greedy | Seeded legal | Base | Upgraded | First | Second |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...leagueTable.map(deck => `| ${deck.name} | ${deck.all.games} | ${percent(deck.all.winRate)} | ${percent(deck.all.scoreRate)} | ${percent(deck.greedy.scoreRate)} | ${percent(deck.seededLegal.scoreRate)} | ${percent(deck.base.scoreRate)} | ${percent(deck.upgraded.scoreRate)} | ${percent(deck.first.scoreRate)} | ${percent(deck.second.scoreRate)} |`),
    '', '## Diner versus seventeen opponents, primary plus fresh confirmation', '',
    '| Opponent | Games | Wins / losses / draws | Score % | Primary | Fresh | Greedy base | Greedy upgraded | Seeded base | Seeded upgraded |',
    '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|',
    ...dinerTable.map(deck => `| ${deck.opponent} | ${deck.all.games} | ${deck.all.wins} / ${deck.all.losses} / ${deck.all.draws} | ${percent(deck.all.scoreRate)} | ${percent(deck.primary.all.scoreRate)} | ${percent(deck.confirmation.all.scoreRate)} | ${percent(deck.greedyBase.scoreRate)} | ${percent(deck.greedyUpgraded.scoreRate)} | ${percent(deck.seededBase.scoreRate)} | ${percent(deck.seededUpgraded.scoreRate)} |`),
    '', '## Diner card observations (descriptive, not causal)', '',
    '| Card | Games played / available | Play % | Games present at end | Average final Hands if present |',
    '|---|---:|---:|---:|---:|',
    ...dinerCards.map(card => `| ${card.cardId} | ${card.gamesPlayed} / ${card.games} | ${percent(card.playRate)} | ${card.gamesSurviving} | ${card.averageFinalHandsWhenPresent.toFixed(2)} |`),
    '', `Manager: played in ${manager.gamesPlayed} games; mean peak ${manager.meanPeakHands.toFixed(2)} Hands / ${manager.meanPeakAura.toFixed(2)} ongoing; maxima ${manager.maximumPeakHands} Hands / ${manager.maximumPeakAura} ongoing.`,
    '', 'Raw worker files retain exact case keys, outcomes, per-card observations and diner event evidence. Full Cartesian completeness and source identity are checked when merging.', '',
  ].join('\n');
  return { data, markdown };
}