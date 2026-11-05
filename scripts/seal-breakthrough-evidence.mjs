/** Combine actual acceptance outputs. This records evidence; it never runs or approves a launch. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [mechanicsPath,presentationPath,outputPath]=process.argv.slice(2);
assert(mechanicsPath&&presentationPath&&outputPath,'Pass mechanics, presentation, and output paths');
const mechanics=JSON.parse(readFileSync(mechanicsPath,'utf8'));
const presentation=JSON.parse(readFileSync(presentationPath,'utf8'));
assert.deepEqual(presentation.errors,[]);
const rendered=new Map(presentation.cards.map(c=>[c.cardId,c]));
assert.equal(rendered.size,presentation.cards.length);
assert.equal(rendered.size,mechanics.cards.length);
const required=['activation','targeting','rejected-input','interaction','lifecycle','last-stand','deterministic-replay'];
for(const card of mechanics.cards){
 assert(card.scenarios>=4,card.cardId);
 assert.deepEqual(card.checks,required);
 assert.deepEqual(rendered.get(card.cardId)?.checks,['presentation']);
}
assert.equal(mechanics.catalogSha256,createHash('sha256').update(mechanics.catalogSignature).digest('hex'));
const evidence={evidenceId:mechanics.evidenceId,ruleset:mechanics.ruleset,catalogSignature:mechanics.catalogSignature,
 cards:mechanics.cards.map(({cardId,checks})=>({cardId,checks:[...checks,'presentation']}))};
writeFileSync(outputPath,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({evidenceId:evidence.evidenceId,cards:evidence.cards.length,sha256:mechanics.catalogSha256}));
