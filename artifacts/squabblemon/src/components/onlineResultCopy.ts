import type { OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';

export function onlineResultCopy(room: Pick<OnlineRoomView, 'reason' | 'activeSeat' | 'seat'>) {
  if (room.reason === 'timeout') {
    const forfeited = room.activeSeat === room.seat;
    return forfeited
      ? {
          title: 'YOUR CLOCK EXPIRED.',
          subtitle: 'You forfeited the fade.',
          description: 'Your turn ran out before you ended it. The rival wins by forfeit, even if you led in districts.',
          boardNote: 'District totals show the final board, not the reason for this loss.',
        }
      : {
          title: 'RIVAL TIMED OUT.',
          subtitle: 'You won by forfeit.',
          description: 'The rival did not end their turn before their clock expired. You win regardless of the district totals.',
          boardNote: 'District totals show the final board, not the reason for this win.',
        };
  }
  return {
    description: room.reason === 'surrender' ? 'The fade ended by surrender.' : 'Six rounds. Three districts.',
  };
}