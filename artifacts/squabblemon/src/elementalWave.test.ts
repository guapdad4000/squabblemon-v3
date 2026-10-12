import assert from 'node:assert/strict';
import test from 'node:test';
import { ELEMENTAL_WAVE as retiredPrototype } from '../../../lib/squabblemon-engine/src/elementalWave';
import { ELEMENTAL_BOND_WAVE } from '../../../lib/squabblemon-engine/src/elementalBondWave';
import { cards, cardCatalog, validateCardAbilityUpgrades } from './data';
import { choosePackCardFromTier } from '@workspace/squabblemon-engine/packRules';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, playTurnCard, type Match, type Lane } from './gameEngine';

// The old Puddle/Rain Caller prototype was never the shipped roster. Actual
// per-ability behavior is also covered by elementalRedesign and elementDecks.
test('all sixteen shipped elemental identities retain acquisition and training; prototypes do not leak into packs',()=>{
 assert.equal(ELEMENTAL_BOND_WAVE.length,16);
 for(const [id,catalogId,name,rarity,element] of ELEMENTAL_BOND_WAVE){
  const card=cardCatalog.find(c=>c.engineId===id)!;
  assert.ok(card,id);assert.equal(card.catalogId,catalogId);assert.equal(card.name,name);assert.equal(card.type,element);assert.equal(card.rarity,rarity);
  validateCardAbilityUpgrades({[id]:cards[id]});assert.equal(card.abilityUpgrades.length,3);
  assert(card.acquisitionSources.includes('Street Packs'));
  const tier=cardCatalog.filter(c=>c.rarity===rarity);
  assert.equal(choosePackCardFromTier({rarity,tier,pulledCardIds:new Set(),ownedCardIds:new Set(tier.filter(c=>c.engineId!==id).map(c=>c.catalogId)),protectNew:true,rng:()=>0}).engineId,id);
 }
 for(const [id] of retiredPrototype) assert.equal(cards[id],undefined,id+' must not create a second collectible identity');
});
for(const owner of ['player','cpu'] as const) for(const tier of [0,1,2,3]) test(`${owner} tier ${tier}: shipped elemental plays are immutable, serializable and deterministic`,()=>{
 for(const [id] of ELEMENTAL_BOND_WAVE){
  const rival=owner==='player'?'cpu':'player';
  const source=createCardInstance(id,owner,'element-source',1);
  const ally={...createCardInstance('cornball',owner,'element-ally',2),lane:0 as Lane,basePower:10};
  const foe={...createCardInstance('hooper',rival,'element-foe',3),lane:0 as Lane,basePower:15};
  ally.statuses.frozen=true;
  const ids=ELEMENTAL_BOND_WAVE.map(row=>row[0]);
  const before:Match={...createMatch('block','block'),round:3,phase:owner==='player'?'player':'cpu-reveal',boards:[[ally,foe],[],[]],playerHand:[],cpuHand:[],[owner==='player'?'playerHand':'cpuHand']:[source],playerMotion:9,cpuMotion:9,
   abilityUpgradeSnapshot:createAbilityUpgradeSnapshot(ids,ids,{[owner]:{[id]:{xp:4500,level:10,moveTier:tier}}})};
  const saved=JSON.stringify(before);
  const after=playTurnCard(before,owner,source.instanceId,0);
  assert.equal(JSON.stringify(before),saved,id);
  assert.deepEqual(after,playTurnCard(JSON.parse(saved),owner,source.instanceId,0),id);
  assert.deepEqual(JSON.parse(JSON.stringify(after)),after,id);
  assert(after.boards.flat().some(c=>c.instanceId===source.instanceId),id);
  assert(after.boards.flat().every(c=>Number.isFinite(c.powerModifier)),id);
  assert(after.effectLog.length>before.effectLog.length,id);
 }
});
