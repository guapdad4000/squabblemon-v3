import { ANUNAKI_EVENT_GAMEPLAY_READY, ANUNAKI_EVENT_MILESTONES } from '@workspace/squabblemon-engine/anunakiEvent';
import { ANUNAKI_BANNER_GAMEPLAY_READY, ANUNAKI_BANNER_CARD_IDS } from '@workspace/squabblemon-engine/anunakiBanner';
import { anunakiCards } from '@workspace/squabblemon-engine/anunakiWave';

/** Explicit release additions to the frozen pre-Anunaki catalog, in roster order. */
const eventIds = ANUNAKI_EVENT_MILESTONES.filter(milestone => milestone.reward.kind === 'card').map(milestone => milestone.reward.id);
export const releasedAnunakiIds = Object.keys(anunakiCards).filter(id =>
  (ANUNAKI_EVENT_GAMEPLAY_READY && eventIds.includes(id as typeof eventIds[number])) ||
  (ANUNAKI_BANNER_GAMEPLAY_READY && (ANUNAKI_BANNER_CARD_IDS as readonly string[]).includes(id)));
