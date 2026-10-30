import { ANUNAKI_CLIENT_CAPABILITY, OnlineError, type OnlineMember, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { isAnunakiCardId } from '@workspace/squabblemon-engine/anunakiWave';

/** Old clients omit this header. An advertised capability is only a presentation compatibility signal. */
export const hasAnunakiClient = (header: string | undefined): boolean =>
  !!header?.split(',').some(value => value.trim() === ANUNAKI_CLIENT_CAPABILITY);
export const memberHasAnunaki = (member: OnlineMember): boolean => member.deck.cards.some(isAnunakiCardId);
export const compatibleMembers = (a: OnlineMember, b: OnlineMember): boolean =>
  !(memberHasAnunaki(a) || memberHasAnunaki(b)) || (!!a.supportsAnunaki && !!b.supportsAnunaki);
export const roomHasAnunaki = (room: OnlineRoom): boolean => {
  if (memberHasAnunaki(room.members.player) || !!room.members.cpu && memberHasAnunaki(room.members.cpu)) return true;
  const match = room.match;
  if (!match) return false;
  // A summoned, transformed or copied fighter can survive independently of a
  // current deck. Include recent public event participants, even after a card
  // has left the board, because online presentation reconstructs them by ID.
  if ([...(match.playerHand ?? []), ...(match.cpuHand ?? []), ...(match.boards ?? []).flat()].some(card => isAnunakiCardId(card.cardId) || isAnunakiCardId(card.id))) return true;
  return (match.effectLog ?? []).slice(-24).some(event => isAnunakiCardId(event.cardId)
    || !!event.source && isAnunakiCardId(event.source.cardId)
    || (event.targets ?? []).some(target => isAnunakiCardId(target.cardId)));
};
export const requireRoomCapability = (room: OnlineRoom, supportsAnunaki: boolean): void => {
  if (!supportsAnunaki && roomHasAnunaki(room))
    throw new OnlineError('This fade needs the latest game. Refresh the page and reconnect.', 409);
};
