import { getDistrictResults, getMatchDistricts, getMatchWinner, type EffectLogEntry, type Match } from '../gameEngine';
import { cards } from '../data';

const claim = (you: number, rival: number) => you === rival ? 'tied (neither side claims it)' : you > rival ? 'yours' : 'rival’s';
const label = (lane: number, match: Match) => getMatchDistricts(match)[lane]?.name ?? `District ${lane + 1}`;

/** The engine event contains complete before/after frames. Never infer a score from card art or a preview. */
export function describeTutorialEvent(event: EffectLogEntry, match: Match): string {
  const actor = event.owner === 'player' ? 'You' : 'Rival';
  const card = cards[event.cardId]?.name ?? event.cardId;
  const changes: string[] = [];
  const motionBefore = event.resources.before[event.owner === 'player' ? 'playerMotion' : 'cpuMotion'];
  const motionAfter = event.resources.after[event.owner === 'player' ? 'playerMotion' : 'cpuMotion'];
  if (motionBefore !== motionAfter) changes.push(`${actor} Motion ${motionBefore} → ${motionAfter}`);
  for (const participant of [event.source, ...event.targets]) {
    if (!participant) continue;
    const name = cards[participant.cardId]?.name ?? participant.cardId;
    const before = participant.before, after = participant.after;
    if (before?.lane !== after?.lane && after?.lane != null && before?.lane != null) {
      changes.push(`${name} moved ${label(before.lane, match)} → ${label(after.lane, match)}`);
    }
    if (before && after && before.power !== after.power) changes.push(`${name} Hands ${before.power} → ${after.power}`);
    if (after) for (const key of ['frozen', 'silenced', 'weakened', 'protected', 'locked', 'boosted', 'blocked'] as const) {
      if (before?.statuses[key] !== after.statuses[key]) changes.push(`${name} ${key} ${after.statuses[key] ? 'on' : 'off'}`);
    }
  }
  if (event.type === 'play' && event.note.includes('SQUABBLE') && event.source?.after) {
    const base = event.source.after.basePower;
    changes.push(`SQUABBLE added ${base} Base Hands (from ${base} to ${base * 2} before other changes)`);
  }
  for (const score of event.scores.after) {
    const old = event.scores.before[score.lane], name = label(score.lane, match);
    if (!old || score.player === old.player && score.cpu === old.cpu) continue;
    changes.push(`${name}: You ${old.player} → ${score.player}, Rival ${old.cpu} → ${score.cpu}; ${claim(score.player, score.cpu)}`);
  }
  return `${card}: ${event.note} ${changes.length ? changes.join(' · ') : 'Scores did not change on this step; the card may have set up a later effect or its effect was blocked.'}`;
}

export function describeTutorialBoard(match: Match): string {
  const results = getDistrictResults(match);
  const you = results.filter(result => result.winner === 'player').length;
  const rival = results.filter(result => result.winner === 'cpu').length;
  const verdict = getMatchWinner(match);
  return `${results.map(result => `${label(result.lane, match)}: You ${result.player}, Rival ${result.cpu} — ${claim(result.player, result.cpu)}`).join(' · ')}. Claims: You ${you}, Rival ${rival}. ${
    verdict === 'player' ? 'You won by claiming at least two districts.' :
    verdict === 'cpu' ? 'The rival won by claiming at least two districts.' :
    verdict === 'draw' ? 'Neither side claimed two districts, so this is a draw.' :
    'Only district claims at the finish decide the winner, not total Hands across the board.'
  }`;
}

export function tutorialNextAdjustment(match: Match): string {
  const results = getDistrictResults(match);
  const candidate = results.filter(result => result.winner !== 'player')
    .sort((a, b) => Math.abs(a.player - a.cpu) - Math.abs(b.player - b.cpu))[0];
  return candidate
    ? `Next time, contest ${label(candidate.lane, match)}: it finished You ${candidate.player} to Rival ${candidate.cpu}. Check its rule and bring an affordable card that can swing this district.`
    : 'You held every district. Next time, try spending less Motion on your safest lead and protect another lane.';
}