import test from 'node:test';
import assert from 'node:assert/strict';
import {cards, cardCatalog} from '../../../lib/squabblemon-engine/src/data';
import {createCardInstance} from '../../../lib/squabblemon-engine/src/gameEngine';
test('support body corrections agree across catalog, battle, and both owners',()=>{
 const budgets={icecream:4,stud:5,stonersr:3,luigion:3,demario:3,'inmate-kingpin':2,homelesslegend:5,'one-man-band':4,'the-dj':2,'the-manager-nice':3,'the-janky-promoter':4,redside1:2,redside5:2,blueside2:1,blueside3:3,blueside4:3,blueside5:2,'ganger-blue':2,'ganger-red':3,'cane-corso-red':3,'blue-nose-pit':3,'look-out':1,'second-plate-cousin':3,'grill-uncle':4,'grandma-said-sit-down':5,foodz:3,pinaynurse:2,rastamon:2,streamer:3,vibe:3,snow:3,fein:2,gothkid:3,counter:3,simmy:5,homelessguy:4,sherlock:2,watson:2,'the-battle-rapper':3,'the-local-celebrity':4};
 for(const [id,power] of Object.entries(budgets)){
  assert.equal(cards[id].power,power,id);
  assert.equal(cardCatalog.find(c=>c.id===cards[id].id)?.power,power,id+' catalog');
  for(const owner of ['player','cpu'] as const) assert.equal(createCardInstance(id,owner).basePower,power,id+' battle');
 }
 assert.equal(cards.blueside1.cost,2,'immune remote damage body pays 2 Motion');
 assert.equal(createCardInstance('blueside1','cpu').cost,2);
 assert.match(cards.icecream.effect,/\+2-Hand Treat/);
 assert.match(cards['inmate-kingpin'].effect,/Contraband/);
 assert.match(cards.demario.effect,/Mushroom/);
});
