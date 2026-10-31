import test from 'node:test';
import assert from 'node:assert/strict';
import { ANUNAKI_RAID_LOANER, applyAnunakiRaidAction, createAnunakiRaid } from '../../../lib/squabblemon-engine/src/anunakiRaid';
import { createCardInstance } from '../../../lib/squabblemon-engine/src/gameEngine';
const initial = () => createAnunakiRaid('test', 'standard', ANUNAKI_RAID_LOANER);
const quietCpu = (r: ReturnType<typeof initial>) => { r.match.cpuHand = []; r.match.cpuDrawIndex = r.match.cpuCardIds.length; return r; };
test('training loaner uses real cards and the archive creates a temporary tablet on play', () => {
 let r = createAnunakiRaid('loaner', 'training', ANUNAKI_RAID_LOANER);
 r = applyAnunakiRaidAction(r, { type:'play', instanceId:r.match.playerHand[0].instanceId, lane:0 });
 assert(r.match.ancientTablets?.some(t => t.owner === 'player' && t.lane === 0)); assert.equal(r.revision, 1);
});
test('large boundary damage enters final phase directly and advertises a fresh three-round charge', () => {
 let r = quietCpu(initial()); r.hp = 80; r.phase = 'descent'; r.protection = false;
 const fighter = createCardInstance('enlil','player','test',0); fighter.lane = 0; fighter.powerModifier = 25; r.match.boards[0].push(fighter);
 r = applyAnunakiRaidAction(r, {type:'blast'});
 assert.equal(r.phase, 'heaven'); assert.equal(r.charge, 0); assert.equal(r.status, 'active'); assert.equal(r.protection, true);
});
test('archive tablet and gate interrupt the final charge, and conduit reduces the announced strike', () => {
 let r = quietCpu(initial()); r.hp = 50; r.phase = 'heaven'; r.protection = true; r.charge = 2;
 for (const lane of [1,2] as const) { const c = createCardInstance('enlil','player','test-'+lane,0); c.lane=lane; c.powerModifier=3; r.match.boards[lane].push(c); }
 r.match.ancientTablets = [{owner:'player',lane:0}]; r = applyAnunakiRaidAction(r,{type:'blast'});
 assert.equal(r.lastBlast?.interrupted,true); assert.equal(r.lastBlast?.reduced,true); assert.equal(r.charge,0); assert.equal(r.protection,false); assert.equal(r.match.ancientTablets?.length,0);
});
test('three unbroken charges end the run', () => { let r = quietCpu(initial()); r.hp=50; r.phase='heaven'; r.protection=true; r.charge=2; r=applyAnunakiRaidAction(r,{type:'blast'}); assert.equal(r.status,'lost'); assert.equal(r.charge,3); assert.throws(()=>applyAnunakiRaidAction(r,{type:'blast'})); });
test('six-round boundary ends the raid instead of leaving an unplayable match', () => { let r=quietCpu(initial()); r.match.round=6; r=applyAnunakiRaidAction(r,{type:'blast'}); assert.equal(r.status,'lost'); assert.equal(r.match.phase,'complete'); });

test('a fully legal standard victory is reachable with an owned starter recipe', async () => {
 const { starterRecipes } = await import('../../../lib/squabblemon-engine/src/data');
 const recipe = starterRecipes.find(deck => deck.name === 'RECEIPTS'); assert.ok(recipe);
 const ids = [...recipe.catalogCardIds.slice(1), recipe.catalogCardIds[0]];
 let raid = createAnunakiRaid('starter-standard', 'standard', ids);
 const actionSnapshots: unknown[] = [];
 const retain = () => {
  assert.equal(raid.match.effectLog.length, 0, 'raid UI does not need presentation film history');
  assert.ok(Buffer.byteLength(JSON.stringify(raid)) < 100_000, 'a full raid state stays below 100 kB');
  actionSnapshots.push(JSON.parse(JSON.stringify(raid)));
  // Simulate a real persistence round trip: symbol flags do not survive JSON.
  raid = JSON.parse(JSON.stringify(raid));
 };
 const plan: Array<Array<[string,0|1|2]>> = [
  [['Plug',0]], [['Closet Nerd',1]], [['Snow Bunny',2],['Bus Pass',0]],
  [['Baby Momma',2],['Soul Food',1]], [['Hooper',0],['Cognac Bottle',0]],
  [['All Jokes Roaster',1],['Cornball',0]],
 ];
 for (const round of plan) {
  for (const [name,lane] of round) { const card = raid.match.playerHand.find(item=>item.name===name); assert.ok(card, `${name} is actually in hand`); raid=applyAnunakiRaidAction(raid,{type:'play',instanceId:card.instanceId,lane}); retain(); }
  raid=applyAnunakiRaidAction(raid,{type:'blast'});
  retain();
  if(raid.status !== 'active') break;
 }
 assert.equal(raid.status,'won'); assert.equal(raid.hp,0);
 assert.ok(Buffer.byteLength(JSON.stringify(actionSnapshots)) < 1_000_000, 'all exact action snapshots stay below 1 MB');
});

test('ascended rewards resolve to an owned equippable mat and animated reaction', async () => {
 const { playerMatById, ownsPlayerMat } = await import('../../../lib/squabblemon-engine/src/playerMats');
 const { ownedReactions, reactionById, resolveReactionTray } = await import('../../../lib/squabblemon-engine/src/reactions');
 const unlocks = ['player-mat:anunaki-raid-ascended','anunaki-raid:reaction'];
 assert(ownsPlayerMat({unlockedCosmeticIds:unlocks}, 'anunaki-raid-ascended'));
 assert.equal(playerMatById('anunaki-raid-ascended')?.assetId, 'assets/player-mats/v4/anunaki-raid-ascended.webp');
 assert(ownedReactions(unlocks).includes('reaction:anu:raid:v1'));
 assert.deepEqual(resolveReactionTray(['reaction:anu:raid:v1'], unlocks), ['reaction:anu:raid:v1']);
 assert.match(reactionById('reaction:anu:raid:v1')?.animatedWebp ?? '', /respect-animated\.webp$/);
 assert(!ownedReactions([]).includes('reaction:anu:raid:v1'));
});
