import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, deploy, type FighterDefinition } from '@workspace/squabblemon-engine/breakthrough';
import { createBreakthroughRoomForSimulation, projectBreakthroughRoom, tickBreakthroughRoom } from '@workspace/squabblemon-engine/breakthroughRoom';
import { encodeRoomStream, applyRoomStream } from '@workspace/squabblemon-engine/breakthroughRoomStream';
import { onlinePresentation } from './onlinePresentation';
const roster: FighterDefinition[] = Array.from({length:10},(_,i)=>({id:`c${i}`,name:`Card ${i}`,cost:1,hands:3,ability:'none',description:''}));
for (const winning of ['player','opponent','draw'] as const) test(`final stream shows ${winning} winner correctly in both seats`, () => {
  const initial = createBreakthroughRoomForSimulation({roomId:'result-test',ownerFence:1,members:{player:'alice',opponent:'bob'},serverTimeMs:1000,expiresAtMs:200000,game:createGame(roster,{seed:3,durationMs:40000})});
  if (winning !== 'draw') initial.game.players[winning].breaches = 1;
  const end = tickBreakthroughRoom(initial,41000).checkpoint;
  assert.equal(end.terminal?.result.winner, winning);
  for (const side of ['player','opponent'] as const) {
    const before = projectBreakthroughRoom(initial,initial.members[side]);
    const after = projectBreakthroughRoom(end,end.members[side]);
    const delivered = applyRoomStream(before, encodeRoomStream(before,after));
    const shown = onlinePresentation(delivered,roster);
    assert.equal(shown.winner,winning==='draw'?'draw':winning===side?'player':'opponent');
    assert.equal(shown.players.player.breaches, end.game.players[side].breaches);
    assert.equal(shown.status,'complete');
  }
});

for (const winning of ['player','opponent'] as const) test(`double break by ${winning} ends in a win for that account`, () => {
  let game = createGame(roster,{seed:3});
  game = deploy(game,winning,game.players[winning].hand[0],0).state;
  assert.equal(game.units.length,1);
  game.players[winning].breaches = 1;
  game.units[0].position = winning === 'player' ? 0.99999 : 0.00001;
  const initial = createBreakthroughRoomForSimulation({roomId:'double-break',ownerFence:1,members:{player:'alice',opponent:'bob'},serverTimeMs:1000,expiresAtMs:200000,game});
  const end = tickBreakthroughRoom(initial,1050).checkpoint;
  assert.equal(end.game.players[winning].breaches,2);
  assert.equal(end.terminal?.result.winner,winning);
  assert.equal(end.terminal?.result.reason,'Two base breaches');
  for (const seat of ['player','opponent'] as const) {
    const view = projectBreakthroughRoom(end,end.members[seat]);
    const delivered = applyRoomStream(projectBreakthroughRoom(initial,initial.members[seat]),encodeRoomStream(projectBreakthroughRoom(initial,initial.members[seat]),view));
    assert.equal(onlinePresentation(delivered,roster).winner,winning===seat?'player':'opponent');
  }
});
