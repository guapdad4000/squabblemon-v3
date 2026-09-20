import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCK_EXPANSION } from '../../../lib/squabblemon-engine/src/blockExpansion';
import { cardCatalog, cards, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, createMatchFromEngineCards, createDistrictSnapshot, playCard, playTurnCard, pass, revealCpuTurn, nextRound, canAffordSelection, verifyMatchTranscript, DISTRICT_CATALOG, type Match, type Owner, type Lane, type PlayerMove } from './gameEngine';
import { generateStreetPack } from '../../api-server/src/lib/collectionEconomy';

const unit = (id: string, owner: Owner, index: number, lane: Lane = 0) => ({ ...createCardInstance(id, owner, 'expansion', index), lane });
function setup(id: string, owner: Owner = 'player') {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  const source = unit(id, owner, 0);
  const low = { ...unit('cornball', owner, 1), basePower: 2, type: 'Normal' };
  const other = { ...unit('plug', owner, 2), basePower: 4, type: 'Fire' };
  const foe = { ...unit('hooper', enemy, 3), basePower: 8 };
  const m: Match = { ...createMatch('vibes', 'vibes'), round: 5, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerMotion: 9, cpuMotion: 9, playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [],
    boards: [[low, other, foe], [unit('cornball', owner, 4, 1)], [unit('plug', owner, 5, 2)]] };
  return {m, source, owner, enemy, low, other, foe};
}

test('the expansion uses the current six-tier rarity ladder with pack access and three training tiers', () => {
  assert.equal(BLOCK_EXPANSION.length, 20);
  assert.deepEqual(['Common','Uncommon','Epic','Rare','Legendary','Mythical'].map(r => BLOCK_EXPANSION.filter(c => c[3] === r).length), [8,2,1,4,1,4]);
  validateCardAbilityUpgrades();
  for (const [id, artworkId, name, rarity] of BLOCK_EXPANSION) {
    const card = cardCatalog.find(c => c.engineId === id)!;
    assert.equal(card.name, name); assert.equal(card.artworkId, artworkId); assert.equal(card.rarity, rarity);
    assert.equal(cards[id].abilityUpgrades.length, 3);
    const owned = cardCatalog.filter(c => c.engineId !== id).map(c => c.catalogId);
    const pack = generateStreetPack({ownedCardIds:owned, discoveredCardIds:owned, ownedVariants:[], pity:0}, () => 0);
    assert.equal(pack.rewards[0].cardId, artworkId); assert.equal(pack.rewards[0].isNew, true);
  }
  assert(cards.leroy && cards.ogdominican && cards.bigzoey);
  assert(!cards.neondragon && !cards.rooftoprunner && !cards.echoqueen);
});

for (const owner of ['player','cpu'] as const) test(`all twenty reveal abilities resolve for ${owner}`, () => {
  for (const [id] of BLOCK_EXPANSION) {
    const {m, source, low, other, foe} = setup(id, owner);
    if (id === 'bodegacat') m.boards[0] = [foe];
    if (id === 'laundry' || id === 'nightmedic') {
      low.statuses = {...low.statuses, frozen:true, silenced:true};
      other.statuses = {...other.statuses, frozen:true};
    }
    const after = playCard(m, owner, source.instanceId, 0);
    const get = (c: typeof source) => after.boards.flat().find(a => a.instanceId === c.instanceId)!;
    const self = get(source), ally = get(low), second = get(other), enemy = get(foe);
    const selfBoosts: Record<string,number> = {bodegacat:1,dogwalker:2,dancecaptain:3,midnightmayor:3,leroy:1};
    if (id in selfBoosts) assert.equal(self.powerModifier, selfBoosts[id], id);
    if (id === 'mural') { assert.equal(self.powerModifier, 0); assert.equal(enemy.statuses.locked, true); }
    if (id === 'crossingguard') { assert.equal(ally.statuses.protected,true); assert.equal(after.timedEffects.at(-1)?.targetInstanceId, low.instanceId); }
    if (id === 'laundry' || id === 'nightmedic') {
      assert.equal(ally.statuses.frozen,false); assert.equal(ally.statuses.silenced,false);
      assert.equal(ally.powerModifier,id === 'laundry' ? 1 : 0);
      assert.equal(second.statuses.frozen,id === 'laundry');
    }
    if (id === 'busker') { assert.equal(ally.powerModifier,1); assert.equal(second.powerModifier,1); }
    if (id === 'cornercoach' || id === 'bigzoey') assert.equal(ally.powerModifier,2);
    if (id === 'nightcashier') assert.equal(after[owner === 'player' ? 'playerMotion' : 'cpuMotion'],8);
    if (id === 'chessregular') assert.equal(enemy.statuses.burnStacks, 2);
    if (id === 'bigzoey') assert.equal(enemy.powerModifier,-2);
    if (id === 'leroy') assert.equal(enemy.powerModifier,-2);
    if (id === 'piratedj' || id === 'partytitan') {
      assert.equal(after.boards[1][0].powerModifier,1); assert.equal(after.boards[2][0].powerModifier,1);
      assert.equal(ally.powerModifier,id === 'partytitan' ? 1 : 0);
    }
    if (id === 'subwaymagician') { assert.equal(enemy.statuses.weakened,true); assert.notEqual(self.lane,0); }
    if (id === 'ogdominican') { assert.notEqual(self.lane,0); assert.equal(self.powerModifier,2); }
    if (id === 'conductor') { assert.notEqual(ally.lane,0); assert.equal(ally.powerModifier,3); assert.equal(self.lane,0); }
  }
});

test('conditional expansion abilities do not award free Hands when their condition is missed', () => {
  for (const id of ['dogwalker','gardener','dancecaptain','leroy','laundry','busker','cornercoach','piratedj','nightmedic','conductor','bigzoey','partytitan','chessregular']) {
    const {m,source} = setup(id); m.boards = [[],[],[]];
    const after = playCard(m,'player',source.instanceId,0);
    assert.equal(after.boards.flat().find(c => c.instanceId === source.instanceId)?.powerModifier,0,id);
  }
  const {m,source} = setup('nightcashier'); m.round=3;
  assert.equal(playCard(m,'player',source.instanceId,0).playerMotion,7);
});

test('Mural Apprentice Locks when supported or gains a Hand when Lock cannot fire', () => {
  const { m, source, low } = setup('mural');
  const empty = { ...m, boards: [[low], [], []] } as Match;
  const revealed = playCard(empty, 'player', source.instanceId, 0);
  assert.equal(revealed.boards[0].find(c => c.instanceId === source.instanceId)?.powerModifier, 1);
  const alone = { ...m, boards: [[], [], []] } as Match;
  assert.equal(playCard(alone, 'player', source.instanceId, 0).boards[0][0].powerModifier, 1);
});

test('new roster gangs replay identical complete fades through authoritative reward verification', () => {
  for (const offset of [0,5,10]) {
    const ids=BLOCK_EXPANSION.slice(offset,offset+10).map(c=>c[0]);
    const locations=createDistrictSnapshot(`expansion-${offset}`);
    // Use the actual starter rival recipe selected by the verifier.
    const rival=createMatch('vibes','vibes');
    let m=createMatchFromEngineCards('expansion',ids,'vibes',rival.cpuCardIds,undefined,undefined,undefined,locations);
    const start=m, moves: PlayerMove[]=[];
    while(m.phase!=='complete') {
      for(const card of [...m.playerHand]) {
        const lane=([0,1,2] as Lane[]).find(l=>canAffordSelection(m,'player',card.instanceId,l));
        if(lane===undefined)continue;
        moves.push({cardInstanceId:card.instanceId,lane,squabble:false,endTurn:false});m=playTurnCard(m,'player',card.instanceId,lane);
      }
      moves.push({cardInstanceId:null,lane:null,squabble:false,endTurn:true});m=nextRound(revealCpuTurn(pass(m,'player')));
    }
    assert.deepEqual(verifyMatchTranscript('expansion','vibes',moves,start.abilityUpgradeSnapshot,ids,locations),m);
  }
});

test('every expansion ability obeys freeze and silence', () => {
  for (const status of ['frozen','silenced'] as const) for (const [id] of BLOCK_EXPANSION) {
    const {m,source} = setup(id); source.statuses[status] = true;
    const before = structuredClone(m.boards);
    const after = playCard(m,'player',source.instanceId,0);
    assert.deepEqual(after.boards.map(board => board.filter(c => c.instanceId !== source.instanceId)),before,`${id}: ${status}`);
    assert.equal(after.boards.flat().find(c => c.instanceId === source.instanceId)?.powerModifier,0);
  }
});

test('County Jail blocks movement and its conditional Hands; hostile reveals respect protection', () => {
  for (const id of ['ogdominican','conductor']) {
    const {m,source,low} = setup(id);
    m.districtSnapshot = {version:1, locations:['county-jail','time-square','magic-city'].map(id => DISTRICT_CATALOG.find(d => d.id === id)!) as NonNullable<Match['districtSnapshot']>['locations']};
    const initial = createMatch('vibes','vibes',undefined,undefined,m.districtSnapshot);
    m.districtRuntime = {...initial.districtRuntime!, detainedCardIds: id === 'conductor' ? [low.instanceId] : []};
    const after = playCard(m,'player',source.instanceId,0);
    const traveler = after.boards[0].find(c => c.instanceId === (id === 'conductor' ? low.instanceId : source.instanceId))!;
    assert.equal(traveler.powerModifier,0,id);
  }
  for (const id of ['chessregular','subwaymagician','bigzoey','leroy']) {
    const {m,source,foe} = setup(id);
    const guard = unit('wifey','cpu',6); guard.statuses.protected=true;
    m.boards[0] = m.boards[0].filter(c => c.instanceId !== foe.instanceId).concat(guard);
    const after = playCard(m,'player',source.instanceId,0);
    const target = after.boards.flat().find(c => c.instanceId === guard.instanceId)!;
    assert.equal(target.powerModifier,0,id); assert.equal(target.statuses.silenced,false,id);
    assert.equal(target.statuses.weakened,false,id); assert.equal(target.statuses.locked,false,id);
  }
});
