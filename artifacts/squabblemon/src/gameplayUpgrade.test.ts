import { completeEngineCrew } from '@workspace/squabblemon-engine/data';
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { activities, draftOffers, eventWeek, makeActivityEncounter, validateDraft } from '@workspace/squabblemon-engine/activities';
import { advanceCareer, availableCareerChoices } from '@workspace/squabblemon-engine/career';
import { crewInsights, battleAchievements, coachBattle } from '@workspace/squabblemon-engine/insights';
import { selectTrainingRival } from '@workspace/squabblemon-engine/training';
import { cards, catalogCardByEngineId } from './data';
import { createLocalPracticeMatch } from './lib/localPracticeMatch';
import { createStoryMatch, createCardInstance, createMatch, chooseCpuPlay, playCard, pass, nextRound, verifyStoryMatchTranscript, getMatchWinner, type Match, type Lane } from './gameEngine';

const roster = completeEngineCrew(['cornball','earthy','pinaynurse','nguyen','edgar','bikelife','abuela']);
test('local preview preserves every selected activity, crew and event rule', () => {
  const week = '2026-09-07';
  const draftPicks = draftOffers(week).map(offer => offer[0]);
  for (const activity of activities) {
    const match = createLocalPracticeMatch({
      deckId: 'local-crew', catalogCardIds: roster.map(id => cards[id].id),
      activity: activity.id, week, draftPicks, seed: 'preview-test',
    });
    assert.equal(match.storyEncounter?.activity?.kind, activity.id);
    assert.deepEqual(match.playerCardIds, activity.id === 'draft' ? draftPicks : roster);
    if (activity.id === 'freeze') assert(match.cpuCardIds.includes('snow'));
    if (activity.id === 'boss') assert.equal(match.storyEncounter?.phases?.length, 3);
    if (activity.id === 'neighborhood') assert(match.storyEncounter?.modifiers);
  }
});

test('local training maps catalog upgrades and equal-footing events use base tiers', () => {
  const crew = ['snow', ...roster.slice(0, 9)];
  for (const activity of ['freeze', 'fair', 'boss'] as const) {
    const match = createLocalPracticeMatch({
      deckId: 'local-crew', catalogCardIds: crew.map(id => cards[id].id), activity,
      progression: { 'snow-bunny': { xp: 2800, level: 8, moveTier: 3 } },
    });
    const snow = match.abilityUpgradeSnapshot.player.find(card => card.cardId === 'snow')!;
    assert.equal(snow.upgradeIds.length, activity === 'freeze' ? 3 : 0);
    assert(match.abilityUpgradeSnapshot.cpu.every(card => card.upgradeIds.length === 0));
  }
});

test('local preview rejects an incomplete draft', () => {
  assert.throws(() => createLocalPracticeMatch({
    deckId: 'draft', catalogCardIds: [], activity: 'draft', draftPicks: ['cornball'],
  }), /ten draft offers/);
});

test('weekly drafts are stable, unique, have a cheap opening and reject forged picks', () => {
  assert.equal(eventWeek(new Date('2026-09-13T23:59:00Z')), '2026-09-07');
  const offers = draftOffers('2026-09-07');
  assert.equal(new Set(offers.flat()).size, 30);
  assert(offers[0].every(id => cards[id].cost <= 2));
  assert(validateDraft('2026-09-07', offers.map(o => o[0])));
  assert(!validateDraft('2026-09-07', Array(10).fill('cornball')));
  assert(!validateDraft('2026-09-07', offers.map(o => o[0]).reverse()));
});
test('rival rotation stays in band and avoids the previous eligible recipe', () => {
  const previous = selectTrainingRival('my-crew', roster, {}, 'first');
  assert.notEqual(selectTrainingRival('my-crew', roster, {}, 'second', previous), previous);
  const rivals = new Set(Array.from({length:12}, (_,i) => selectTrainingRival('my-crew', roster, {}, `seed-${i}`)));
  assert(rivals.size >= 2);
});
test('every activity issues a legal mixed roster and exactly replays six moves', () => {
  for (const activity of activities) {
    const encounter = makeActivityEncounter(activity.id, 'test-seed', 'block', '2026-09-07');
    assert.equal(new Set(encounter.enemy.cardIds).size,10);
    assert(encounter.enemy.cardIds.every(id => cards[id]));
    assert(existsSync(`public/${encounter.battlefieldAssetId}`), encounter.battlefieldAssetId);
    assert(existsSync(`public/${encounter.enemy.portraitAssetId}`), encounter.enemy.portraitAssetId);
    let match = createStoryMatch(encounter, roster, 'test-crew');
    const moves = Array.from({length:6}, () => ({cardInstanceId:null,lane:null,squabble:false}));
    for (const move of moves) { match = pass(match, 'player'); const choice = chooseCpuPlay(match); match = nextRound(choice ? playCard(match,'cpu',choice.instanceId,choice.lane) : pass(match,'cpu')); }
    const replay = verifyStoryMatchTranscript(encounter, roster, moves, 'test-crew', match.abilityUpgradeSnapshot);
    assert.deepEqual(replay, match, activity.id);
    if (activity.normalized) assert(match.abilityUpgradeSnapshot.player.every(c => c.upgradeIds.length === 0));
  }
});
test('rival planning cannot inspect private player cards even through Promoter', () => {
  const base = {...createMatch('block','combo'), phase:'cpu-reveal' as const, round:3, cpuMotion:6, cpuHand:[createCardInstance('promoter','cpu','test',0),createCardInstance('edgar','cpu','test',1)]};
  assert.deepEqual(chooseCpuPlay({...base,playerHand:[createCardInstance('techbro','player','hidden',0)]}),chooseCpuPlay({...base,playerHand:[createCardInstance('cornball','player','hidden',0)]}));
});
test('Nurse now supports a healthy ally and Edgar/Abuela have their tuned bodies', () => {
  const nurse = createCardInstance('pinaynurse','player','test',0), ally = {...createCardInstance('edgar','player','test',1),lane:0 as Lane};
  const m = playCard({...createMatch('block','block'), playerMotion:2, playerHand:[nurse],boards:[[ally],[],[]]},'player',nurse.instanceId,0);
  assert.equal(m.boards[0][0].powerModifier,1);
  assert.equal(cards.edgar.power,2); assert.equal(cards.abuela.power,4); assert.equal(cards.abuela.cost,4);
  assert.equal(battleAchievements(m).cleansed,false);
});
test('crew guidance uses actual opening order and explains conditional support', () => {
  const advice = crewInsights(roster.map(id => catalogCardByEngineId[id].catalogId));
  assert(advice.opening >= 2); assert(advice.tips.some(t => t.includes('Nguyen')));
  assert.equal(advice.curve.reduce((a,b)=>a+b),10);
  assert.equal(crewInsights(completeEngineCrew(['techbro','landlord','hooper','baby','og','cornball','earthy'])).opening,0);
});
test('career goals require actual cleanse, a changed roster, and wins for mastery', () => {
  const nurse = createCardInstance('pinaynurse','player','test',0);
  const ally = {...createCardInstance('edgar','player','test',1),lane:0 as Lane}; ally.statuses.frozen = true;
  let m: Match = {...createMatch('block','block'),playerMotion:2,playerHand:[nurse],boards:[[ally],[],[]]};
  m = playCard(m,'player',nurse.instanceId,0);
  assert(battleAchievements(m).cleansed);
  const career = advanceCareer({},m,[],[]);
  assert.equal(availableCareerChoices(career.progress),1);
  assert.equal(availableCareerChoices({...career.progress,choices:['young-bull']}),0);
  assert.match(coachBattle(m),/removed a status/);
  const encounter = makeActivityEncounter('auto','x','block','2026-09-07',['cornball']);
  assert(battleAchievements({...m,storyEncounter:encounter}).changedCrew);
  const won: Match = {...m,round:6,phase:'complete',boards:[[...m.boards[0]],[{...ally,instanceId:'second-lane',lane:1,statuses:{...ally.statuses,frozen:false}}],[]]};
  assert.equal(getMatchWinner(won),'player');
  let state = advanceCareer({},won,['pinay-nurse'],[]);
  for (let i=1;i<5;i++) state = advanceCareer(state.progress,won,['pinay-nurse'],state.cosmetics);
  assert(state.cosmetics.includes('mastery:pinay-nurse'));
  assert.equal(state.cosmetics.length,1);
});
