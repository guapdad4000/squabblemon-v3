import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView, type Seat, type OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import { createMatch, createCardInstance, type Lane } from '../src/gameEngine';
import { decks } from '../src/data';

/** Deterministic local board; all emitted actions/events use the real online engine. */
export function effectsRoom(): OnlineRoom {
  const now = Date.now();
  const member = (userId: string) => ({ userId, name: userId, ready: false, deck: { ...decks[0], cards: [...decks[0].cards] } });
  let room = joinOnlineRoom(createOnlineRoom(member('You'), 'player', now), member('The Opps'), now);
  room = applyOnlineCommand(applyOnlineCommand(room, 'player', { type: 'ready' }, now), 'cpu', { type: 'ready' }, now);
  const match = createMatch('block', 'combo'); match.round = 3; match.playerMotion = 30; match.cpuMotion = 30;
  match.playerHand = ['roaster', 'folks', 'cornball', 'carmeet', 'hooper'].map((id,i) => createCardInstance(id,'player','fx-hand',i));
  match.cpuHand = ['roaster', 'folks'].map((id,i) => createCardInstance(id,'cpu','fx-hand',i));
  match.boards = ([0,1,2] as Lane[]).map(lane => ['hooper','plug'].map((id,i) => ({ ...createCardInstance(id,'cpu',`fx-lane-${lane}`,i), lane, basePower: lane === 0 ? 1 : 8 }))) as typeof match.boards;
  return { ...room, match };
}
export function effectsView(room: OnlineRoom, seat: Seat = 'player') { return onlineRoomView(room, 'FX-LOCAL', seat === 'player' ? 'You' : 'The Opps', Date.now()); }
export function effectsPlay(room: OnlineRoom, id: string, lane: Lane = 0, squabble = false) {
  const card = room.match!.playerHand.find(card => card.cardId === id)!;
  return applyOnlineCommand(room, 'player', { type: 'play', instanceId: card.instanceId, lane, squabble }, Date.now());
}
