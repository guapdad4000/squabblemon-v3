import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createOnlineRoom, joinOnlineRoom, onlineRoomView, type OnlineCommand } from '@workspace/squabblemon-engine/multiplayer';
import { starterRecipes } from '../src/data';
import { KumiteWaitingRoom } from '../src/components/kumite/KumiteWaitingRoom';
import '../src/index.css';

const now = Date.now();
const recipe = starterRecipes[0];
const deck = { id: recipe.id, name: 'Locked review gang', hero: recipe.hero, cards: recipe.catalogCardIds };
const member = (userId: string, name: string) => ({ userId, name, deck, ready: false });
const assigned = joinOnlineRoom(createOnlineRoom(member('review-one', 'Review Fighter'), 'player', now), member('review-two', 'Assigned Opponent'), now);
assigned.kumite = { tournamentId: 'review-week', matchId: 'review-quarterfinal', roundDeadline: now + 6 * 3600000 };
const initialRoom = onlineRoomView(assigned, 'ABCDEF123456', 'review-one', now);
// Review actual Kumite character art independently of the locked-deck behavior.
initialRoom.members.player!.hero = 'franklin-duke';
initialRoom.members.cpu!.hero = 'chonk-lee';
const evidence = { commands: [] as OnlineCommand[], leaves: 0, setConnected: (_value: boolean) => {} };
Object.assign(window, { kumiteWaitingReview: evidence });

function Review() {
  const [room, setRoom] = useState(initialRoom);
  const [connected, setConnected] = useState(true);
  evidence.setConnected = setConnected;
  const send = async (command: OnlineCommand) => {
    evidence.commands.push(command);
    if (command.type === 'ready') setRoom(current => ({ ...current, members: { ...current.members, player: { ...current.members.player!, ready: true } } }));
    return true;
  };
  return <KumiteWaitingRoom room={room} connected={connected} busy={false} send={send} onLeave={() => { evidence.leaves++; }} />;
}
createRoot(document.getElementById('root')!).render(<Review />);
