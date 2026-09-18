import type { EffectLogEntry, EventParticipant } from './gameEngine';

export function participantPower(state: EventParticipant['before']) {
  return !state || state.statuses.frozen ? 0 : Math.max(0, state.basePower + state.powerModifier);
}

export function battleChanges(event: EffectLogEntry) {
  const participants = new Map<string, EventParticipant>();
  for (const participant of [event.source, ...event.targets]) {
    if (participant) participants.set(participant.cardInstanceId, participant);
  }
  return [...participants.values()].map(participant => {
    const delta = participantPower(participant.after) - participantPower(participant.before);
    const labels: string[] = [];
    if (participant.before && !participant.after) labels.push('Destroyed');
    if (participant.before && participant.after) {
      for (const [key, label] of [['frozen', 'Frozen'], ['silenced', 'Silenced'], ['protected', 'Shielded'], ['blocked', 'Blocked']] as const) {
        if (!participant.before.statuses[key] && participant.after.statuses[key]) labels.push(label);
        if (participant.before.statuses[key] && !participant.after.statuses[key]) labels.push(`${label} cleared`);
      }
      if (participant.before.lane !== participant.after.lane) labels.push('Moved');
    }
    return { ...participant, delta, labels };
  });
}

export function eventIntensity(event: EffectLogEntry): 'routine' | 'takeover' | 'squabble' {
  if (event.type === 'play' && event.note.includes('SQUABBLE')) return 'squabble';
  const takeover = event.scores.after.some(after => {
    const before = event.scores.before.find(score => score.lane === after.lane);
    if (!before) return false;
    const advantage = event.owner === 'player' ? after.player - after.cpu : after.cpu - after.player;
    const previous = event.owner === 'player' ? before.player - before.cpu : before.cpu - before.player;
    return advantage > 0 && previous < 0;
  });
  return takeover ? 'takeover' : 'routine';
}
