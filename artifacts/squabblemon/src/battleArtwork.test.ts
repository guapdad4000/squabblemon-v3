import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { getBattleArtCues, ITEM_ARTWORK, SUMMON_ARTWORK } from '@workspace/squabblemon-engine/battleArtwork';
import { createMatch, createCardInstance, playTurnCard, nextRound, SUMMON_TEMPLATES, type Match, type Owner, type Lane } from './gameEngine';
import { createOnlineRoom, joinOnlineRoom, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { toPresentationEffect } from './lib/useOnlineEffectPresenter';
import { decks } from './data';
import { getCardArtworkId } from './lib/assets';
import { createArtworkReviewMatch } from '../e2e/art-recovery/state';

const blank = (): Match => ({ ...createMatch('block','block'), round:3, boards:[[],[],[]], playerHand:[],cpuHand:[],playerMotion:9,cpuMotion:9 });
const cast = (m:Match,id:string,owner:Owner='player',lane:Lane=0,silenced=false) => {
  const c=createCardInstance(id,owner,'art-cue',m.nextEventSequence);
  c.statuses.silenced=silenced;
  return playTurnCard({...m,phase:owner==='player'?'player':'cpu-reveal',playerMotion:9,cpuMotion:9,[owner==='player'?'playerHand':'cpuHand']:[c]},owner,c.instanceId,lane);
};
const cues = (m:Match) => m.effectLog.flatMap(getBattleArtCues);

test('only resolved summons produce one cue each, no gameplay mutations',()=>{
  const m=createArtworkReviewMatch(), before=JSON.stringify(m);
  const actual=cues(m);
  assert.equal(actual.filter(c=>c.kind==='plant').length,m.boards.flat().filter(c=>c.buddyBud).length);
  assert.equal(actual.filter(c=>c.kind==='guard').length,1);
  assert.equal(new Set(actual.map(c=>c.id)).size,actual.length);
  assert.equal(JSON.stringify(m),before);
  assert.equal(cues(cast(blank(),'buddy','player',0,true)).length,0);
});
test('sprout follows the actual recipient once at maturity',()=>{
  let m=cast(blank(),'buddy');
  const lane=m.boards.flat().find(c=>c.buddyBud)!.lane!;
  m=cast(m,'hooper','player',lane);
  const target=m.boards[lane].find(c=>c.cardId==='hooper')!.instanceId;
  m=nextRound({...m,phase:'resolved',playerHand:[],cpuHand:[]});
  assert.equal(cues(m).filter(c=>c.kind==='sprout').length,0);
  m=nextRound({...m,phase:'resolved',playerHand:[],cpuHand:[]});
  const sprouts=cues(m).filter(c=>c.kind==='sprout');
  assert.equal(sprouts.filter(c=>c.targetId===target).length,1);
  assert.equal(sprouts.find(c=>c.targetId===target)?.label,'+3 Hands');
});
test('Contraband transfers to each new carrier including the third payout',()=>{
  let m=cast(blank(),'inmate-kingpin');
  for (const [index,id] of ['inmate-informant','inmate-crafty','inmate-contraband'].entries()) {
    const prior=m.effectLog.length;
    m=cast(m,id,'player',1);
    const handoff=m.effectLog.slice(prior).flatMap(getBattleArtCues).filter(c=>c.kind==='pass');
    assert.equal(handoff.length,1,`${id} handoff`);
    assert.equal(handoff[0].targetId,m.boards[1].find(c=>c.cardId===id)!.instanceId);
    if(index===2) assert.equal(handoff[0].label,'3 carriers · paid');
  }
});
for(const owner of ['player','cpu'] as const) test(`${owner}: lunch only animates actual healing, not absorbed damage`,()=>{
  let m=blank();
  m.boards[0]=[{...createCardInstance('og',owner,'lunch-target'),lane:0,powerModifier:3}];
  m=cast(m,'abuela',owner);
  const enemy=owner==='player'?'cpu':'player';
  m=cast(m,'inmate-informant',enemy);
  assert.equal(cues(m).filter(c=>c.kind==='heal').length,0);
  m=cast(m,'inmate-informant',enemy);
  const heals=cues(m).filter(c=>c.kind==='heal');
  assert.equal(heals.length,1);assert.equal(heals[0].owner,owner);assert.equal(heals[0].label,'+2 healed');
});
test('every current summon and illustrated item resolves to a readable file; borrowed portraits stay separate',async()=>{
  for(const id of Object.keys(SUMMON_TEMPLATES)) assert.ok(SUMMON_ARTWORK[id],id);
  for(const [id,entry] of Object.entries(SUMMON_ARTWORK)) {
    const dimensions=await sharp(await readFile(`public/assets/characters/${entry.artwork}.webp`)).metadata();
    assert.ok(dimensions.width!>=256 && dimensions.height!>=256,id);
    assert.equal(getCardArtworkId({id:entry.artwork,cardId:id}),entry.artwork);
  }
  for(const id of Object.values(ITEM_ARTWORK)) assert.ok((await sharp(await readFile(`public/assets/items/${id}.webp`)).metadata()).width!>=256,id);
  assert.equal(getCardArtworkId({id:'steward-blue',cardId:'steward'}),'steward-blue');
  assert.equal(getCardArtworkId({id:'cheshire',cardId:'grin'}),'grin');
  assert.equal(getCardArtworkId({id:'cheshire',cardId:'cheshire'}),'cheshire');
});
test('public effects carry only presentation data and rotate ownership for the other seat',()=>{
  const member=(userId:string)=>({userId,name:userId,ready:false,deck:{id:decks[0].id,name:decks[0].name,cards:[...decks[0].cards],hero:decks[0].hero}});
  let room=createOnlineRoom(member('a'),'player',0);
  room=joinOnlineRoom(room,member('b'),0);
  room={...room,match:createArtworkReviewMatch()};
  const view=onlineRoomView(room,'ARTROOM','b',1);
  const event=view.events.find(e=>e.artCues?.some(c=>c.kind==='plant'))!;
  assert.ok(event);
  for(const cue of event.artCues!) assert.deepEqual(Object.keys(cue).sort(),['artwork','fromId','id','kind','label','lane','owner','targetId'].sort());
  assert.equal('replay' in event,false);
  const shown=toPresentationEffect(event,'cpu',[])!;
  assert.equal(shown.artCues?.[0].owner,'cpu');
  assert.equal(shown.replay,undefined);
  const absentSource=toPresentationEffect({...event,sourceId:undefined},'cpu',[]);
  assert.equal(absentSource?.artCues?.length,event.artCues?.length,'Delayed effects survive the summoner leaving the field');
  assert.equal(absentSource?.cardInstanceId,'','No fabricated source identity');
  assert.equal(toPresentationEffect({...event,sourceId:undefined,artCues:[]},'cpu',[]),null);
});
