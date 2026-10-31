import { fileURLToPath } from 'node:url';
import { summarizeChapterTickets } from './lib/story/ticketLedger';
import assert from 'node:assert/strict';
import test from 'node:test';
import { access } from 'node:fs/promises';
import { storyContent, validateStoryContent, isStoryPuzzleSolution, ticketsForStars } from '@workspace/squabblemon-engine/story';
import { createStoryMatch } from './gameEngine';
import { ANUNAKI_STORY_CHAPTERS, ANUNAKI_EVENT_MILESTONES, anunakiClaimKey, anunakiEventStatus } from '@workspace/squabblemon-engine/anunakiEvent';
import { EARNED_DECK_COVERS, equippedDeckCover, validateCosmeticLoadout } from '@workspace/squabblemon-engine/cosmetics';
const publicFile = (asset: string) => fileURLToPath(new URL(`../public/${asset}`, import.meta.url));
const chapters=ANUNAKI_STORY_CHAPTERS.map(id=>storyContent.chapters.find(chapter=>chapter.id===id)!);
const crew=['cornball','roaster','rastamon','oink','wifey','snow','plug','baby','buspass','soulfood'];
test('Anunaki delivers eight sequential accessible chapters, 56 nodes, 32 fights and eight solvable puzzles',async()=>{
  validateStoryContent(storyContent);
  assert.deepEqual(chapters[0].prerequisites,[]);
  const all=chapters.flatMap(chapter=>chapter.nodes);
  assert.equal(all.length,56);assert.equal(all.filter(node=>node.kind==='battle').length,32);
  assert.equal(all.filter(node=>!!node.puzzle).length,8);
  for(const [i,chapter] of chapters.entries()){
    assert.equal(chapter.nodes.length,7);
    assert.deepEqual(chapter.prerequisites,i?[chapters[i-1].id]:[]);
    assert(chapter.nodes.every(node=>!node.optional),'mastery never blocks the story graph');
    for(const node of chapter.nodes){
      for(const asset of [node.cinematic.environmentAssetId,node.cinematic.posterAssetId])await access(publicFile(asset));
      const lines=node.kind==='battle'?[...node.preDialogue,...node.postDialogue]:node.scenes;
      for(const line of lines)await access(publicFile(line.portraitAssetId));
      if(node.puzzle){assert(isStoryPuzzleSolution(node.puzzle,node.puzzle.solution));assert(!isStoryPuzzleSolution(node.puzzle,node.puzzle.pieces.map(piece=>piece.id)));}
      if(node.kind==='battle'){
        const match=createStoryMatch(node.encounter,crew,'anunaki-foundation');
        const loan=node.encounter.modifiers?.reinforcements?.find(item=>item.owner==='player');
        assert(loan && match.playerHand.some(card=>card.cardId===loan.cardId),`${node.id} delivers its temporary ally without ownership`);
      }
    }
  }
});
test('Anunaki authored economy remains 3200 Clout and eight tickets before the roadmap',()=>{
 const rewards=chapters.flatMap(c=>c.nodes.flatMap(n=>n.rewards));
 assert.equal(rewards.filter(r=>r.kind==='pack-ticket').reduce((n,r)=>n+r.amount,0),8);
 assert.equal(rewards.filter(r=>r.kind==='currency'&&r.id==='clout').reduce((n,r)=>n+r.amount,0),3200);
 for(const chapter of chapters)for(const node of chapter.nodes)if(node.kind==='battle')assert.equal(ticketsForStars(3,node.id),0);
 assert.equal(ticketsForStars(3,'welcome-to-the-block'),1);
 const ledger=summarizeChapterTickets(chapters[0],Object.fromEntries(chapters[0].nodes.map(node=>[node.id,{stars:3,cleared:true}])));
 assert.equal(ledger.perfectTicketsAvailable,0);assert.equal(ledger.perfectTicketsEarned,0);assert.equal(ledger.ticketsAvailable,1);assert.equal(ledger.perfectClears,4);
 assert(rewards.every(r=>r.kind!=='card'),'banner fighters are never granted by campaign node rewards');
});
test('24 milestones use only Anunaki progress, real stars, and preserve all old claim identities',()=>{
 const no=anunakiEventStatus(['welcome-to-the-block'],['block-party','red-side-tapes'],[],[],[]);
 assert(no.milestones.every(step=>step.state==='locked'));
 const battles=chapters.flatMap(c=>c.nodes.filter(n=>n.kind==='battle').map(n=>n.id));
 const full=anunakiEventStatus(battles,ANUNAKI_STORY_CHAPTERS,[],[],[],true,battles.map(nodeId=>({nodeId,stars:3})));
 assert.equal(full.milestones.length,24);assert(full.milestones.every(step=>step.state==='ready'));
 assert.equal(full.milestones.filter(step=>step.optional).length,8);
 for(const id of ['first-contact','ancient-signal','yakub-mat','time-machine-fuel','yakub','laboratory-supplies','yakub-stickers','caucus-mountaineer','ancient-cache','anu-mat','divine-reserves','anu','anu-stickers'] as const){
  const saved=anunakiEventStatus([],[],[anunakiClaimKey(id)],[],[]);
  assert.equal(saved.milestones.find(step=>step.id===id)?.state,'claimed');
 }
 assert.equal(ANUNAKI_EVENT_MILESTONES.filter(m=>m.reward.kind==='tickets').reduce((n,m)=>n+(m.reward.kind==='tickets'?m.reward.amount:0),0),6);
});
test('earned covers require permanent ownership, work without the featured fighter and reject arbitrary assets',async()=>{
 for(const cover of EARNED_DECK_COVERS){await access(publicFile(cover.image));assert.match(validateCosmeticLoadout({ownedCardIds:[]},{deckCoverId:cover.id})!,/Earn/);const owner={ownedCardIds:[],unlockedCosmeticIds:[cover.id],settings:{cosmetics:{deckCoverId:cover.id}}};assert.equal(validateCosmeticLoadout(owner,{deckCoverId:cover.id}),null);assert.equal(equippedDeckCover(owner)?.id,cover.id);}
 assert(validateCosmeticLoadout({ownedCardIds:[],unlockedCosmeticIds:['https://bad']},{deckCoverId:'https://bad'}));
});
