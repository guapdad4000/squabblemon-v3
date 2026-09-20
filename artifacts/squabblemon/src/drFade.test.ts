import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardById, ROOKIE_MENTOR_CORE_IDS, ROOKIE_FOUNDATION_IDS, ROOKIE_DECK_ID, catalogIdsToEngineIds, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, playCard, getEffectiveCardPower, getMatchWinner, getDistrictResults, createGuidedTutorialTranscript, verifyStoryMatchTranscript, type Match, type Lane, type Owner } from './gameEngine';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { rookieEncounter, rookieDistricts } from '@workspace/squabblemon-engine/rookie';
import { getTutorialMilestones } from '../../api-server/src/lib/tutorialMilestones';

function fixture(owner: Owner = 'player') {
  const rival = owner === 'player' ? 'cpu' : 'player';
  const fade = createCardInstance('drfade', owner, 'lesson', 0);
  const target = (id: string, side: Owner, lane: Lane, power: number, n: number) =>
    ({ ...createCardInstance(id, side, 'lesson', n), type: 'Normal', basePower: power, power, lane });
  const enemy = target('cornball', rival, 0, 7, 1);
  const weakerEnemy = target('plug', rival, 0, 4, 2);
  const ally = target('cornball', owner, 1, 2, 3);
  const strongerAlly = target('hooper', owner, 2, 5, 4);
  const localAlly = target('cornball', owner, 0, 1, 5);
  const match: Match = { ...createMatch('block','combo'), phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerMotion: 9, cpuMotion: 9, playerHand: owner === 'player' ? [fade] : [], cpuHand: owner === 'cpu' ? [fade] : [],
    boards: [[enemy,weakerEnemy,localAlly],[ally],[strongerAlly]] };
  return { match, fade, enemy, weakerEnemy, ally, strongerAlly, localAlly };
}
const power = (m: Match, id: string) => getEffectiveCardPower(m.boards.flat().find(c => c.instanceId === id)!);

test('Dr. Fade is the guaranteed 4 Motion / 6 Hands Light Legendary with a valid upgrade path', () => {
  assert.equal(catalogCardById['dr-fade'].rarity,'Legendary');
  assert.equal(cards.drfade.cost,4); assert.equal(cards.drfade.power,6); assert.equal(cards.drfade.type,'Light');
  assert.ok(ROOKIE_FOUNDATION_IDS.includes('dr-fade'));
  assert.equal(ROOKIE_MENTOR_CORE_IDS.length,10);
  assert.ok(ROOKIE_MENTOR_CORE_IDS.slice(0,5).includes('dr-fade'));
  validateCardAbilityUpgrades({ drfade: cards.drfade });
});

for (const owner of ['player','cpu'] as const) test('First Lesson selects the strongest enemy and weakest distant ally for ' + owner, () => {
  const f=fixture(owner), before=JSON.stringify(f.match);
  const resolved=playCard(f.match,owner,f.fade.instanceId,0);
  assert.equal(power(resolved,f.enemy.instanceId),5); assert.equal(power(resolved,f.weakerEnemy.instanceId),4);
  assert.equal(power(resolved,f.ally.instanceId),4); assert.equal(power(resolved,f.strongerAlly.instanceId),5);
  assert.equal(power(resolved,f.localAlly.instanceId),1);
  assert.equal(JSON.stringify(f.match),before);
  const event=resolved.effectLog.find(e=>e.cardId==='drfade'&&e.type==='ability')!;
  assert.deepEqual(new Set(event.targets.map(t=>t.cardInstanceId)),new Set([f.enemy.instanceId,f.ally.instanceId]));
});

test('protection blocks the punch while coaching still resolves',()=>{
  const f=fixture(); f.enemy.statuses={...f.enemy.statuses,protected:true};
  f.match.timedEffects.push({id:'cover',kind:'church-protection',sourceInstanceId:'church',targetInstanceId:f.enemy.instanceId,owner:'cpu',lane:0,startsAtRound:1,expiresAtRound:7,expiration:'match-complete'});
  const resolved=playCard(f.match,'player',f.fade.instanceId,0);
  assert.equal(power(resolved,f.enemy.instanceId),7); assert.equal(power(resolved,f.ally.instanceId),4);
});
for (const status of ['silenced','frozen'] as const) test(status+' Dr. Fade cannot fire his ability',()=>{
  const f=fixture(); f.fade.statuses={...f.fade.statuses,[status]:true};
  const resolved=playCard(f.match,'player',f.fade.instanceId,0);
  assert.equal(power(resolved,f.enemy.instanceId),7); assert.equal(power(resolved,f.ally.instanceId),2);
});
test('empty districts and hazard tokens cannot manufacture coaching value',()=>{
  const f=fixture(); const hazard={...f.ally,hazard:true};
  const resolved=playCard({...f.match,boards:[[],[hazard],[]]},'player',f.fade.instanceId,0);
  assert.equal(power(resolved,f.fade.instanceId),6); assert.equal(power(resolved,hazard.instanceId),0);
});
test('SQUABBLE doubles only Dr. Fade base Hands; the ability remains +2 / -2',()=>{
  const f=fixture();const resolved=playCard(f.match,'player',f.fade.instanceId,0,true);
  assert.equal(power(resolved,f.fade.instanceId),12);
  assert.equal(power(resolved,f.enemy.instanceId),5);assert.equal(power(resolved,f.ally.instanceId),4);
});
test('all three upgrades add bounded effects to the actual successful targets',()=>{
  const f=fixture(); f.match.abilityUpgradeSnapshot=createAbilityUpgradeSnapshot(['drfade'],[],{player:{drfade:{xp:2800,level:8,moveTier:3}}});
  const resolved=playCard(f.match,'player',f.fade.instanceId,0);
  assert.equal(power(resolved,f.fade.instanceId),7);assert.equal(power(resolved,f.enemy.instanceId),4);assert.equal(power(resolved,f.ally.instanceId),5);
});
test('every offered recruit preserves a legal tutorial win and the Dr. Fade SQUABBLE payoff',()=>{
  for(const recruit of ROOKIE_FOUNDATION_IDS.filter(id=>!ROOKIE_MENTOR_CORE_IDS.includes(id))){
    const crew=[...ROOKIE_MENTOR_CORE_IDS];crew[5]=recruit;
    const ids=catalogIdsToEngineIds(crew);
    const moves=createGuidedTutorialTranscript(undefined,rookieDistricts(),rookieEncounter(),ids,ROOKIE_DECK_ID);
    const resolved=verifyStoryMatchTranscript(rookieEncounter(),ids,moves,ROOKIE_DECK_ID,undefined,rookieDistricts());
    assert.equal(getMatchWinner(resolved),'player',recruit+': '+JSON.stringify(getDistrictResults(resolved)));
    assert.deepEqual(getTutorialMilestones(resolved),{playerCardPlayed:true,bankedMotionAfterPlay:true,squabbleUsed:true});
    const fadePlay=resolved.effectLog.find(e=>e.type==='play'&&e.cardId==='drfade');
    assert.equal(fadePlay?.round,4,recruit); assert.match(fadePlay!.note,/SQUABBLE/);
    assert.ok(resolved.effectLog.some(e=>e.cardId==='drfade'&&e.type==='ability'&&e.targets.some(t=>t.owner==='player')),recruit+': distant ally coached');
  }
});
