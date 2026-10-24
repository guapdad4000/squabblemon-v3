import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PackReward } from '@workspace/api-client-react';
import { catalogCardById } from '../data';
import { styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import { GachaRevealSequence, RewardCard } from './GachaRevealSequence';
const card = catalogCardById.buddy;
const base: PackReward = { kind:'card',cardId:card.catalogId,name:card.name,rarity:card.rarity,variantId:null,amount:1,isNew:false };
const duplicate: PackReward = {...base,kind:'styleShards',amount:35,shardRarity:'Legendary'};
const render = (rewards:PackReward[],phase='summary',extra={}) => renderToStaticMarkup(<GachaRevealSequence phase={phase} rewards={rewards} revealIndex={0} pullSize={1} preview={false} onReveal={()=>{}} onSummary={()=>{}} onFinish={()=>{}} {...extra}/>);
test('haul retains every reward, exact duplicate value and one inspection target per real card',()=>{
 const html=render([base,duplicate,{...base,kind:'variant',variantId:'buddy:chrome'}]);
 assert.equal((html.match(/class="gacha-reveal__item"/g)??[]).length,3);
 assert.equal((html.match(new RegExp(`aria-label="Inspect ${card.name}"`,'g'))??[]).length,3);
 assert.equal((html.match(/data-layered-card="true"/g)??[]).length,3);
 assert.match(html,/\+35 Legendary Style Shards/);
 assert.doesNotMatch(html,/Full fighter reveal complete|depth-reveal|knockout-impact/);
});
test('monthly receipt displays every awarded currency and guaranteed identity without changing reward order',()=>{
 const html=render([base,duplicate],'summary',{rareHighlightReward:duplicate,seasonRewards:[{seasonId:'2026-10',threshold:10,softCurrency:100,packTickets:2,styleShards:25}]});
 assert.match(html,/\+100 Clout · \+2 Street Pack tickets · \+25 Universal Style Shards/);
 assert.equal((html.match(/GUARANTEED RARE\+/g)??[]).length,1);
 assert.ok(html.indexOf('data-reward-count="2"')<html.indexOf('+35 Legendary'));
});
test('full print and empty closed phase preserve their contracts',()=>{
 assert.match(renderToStaticMarkup(<RewardCard reward={duplicate} large/>),/data-layered-card="true"/);
 assert.equal(render([base],'idle'),'');
 const html=render([base],'reveal');assert.match(html,/1 \/ 1/);assert.match(html,/View haul/);assert.doesNotMatch(html,/Meet the haul|A familiar face/);
});

test('cinematic handoff keeps the exact film landing arena without replaying the impact foreground',()=>{
 for(const pullSize of [1,4,9,10]){
  const html=render([base,duplicate],'reveal',{pullSize});
  const arena='single-arrival-wall-v2';
  assert.match(html,new RegExp(`class="gacha-reveal__arena"[^>]*src="[^" ]*brand/gacha/cinematic-v2/${arena}\\.webp"`));
  assert.ok(!html.includes('class="gacha-reveal__foreground"'), 'the smoke transition already owns the impact; do not flash it again');
  assert.doesNotMatch(html,/layered-venue|gatcha-bg|depth-reveal/);
  assert.equal((html.match(/data-layered-card="true"/g)??[]).length,1,'the flying card remains the actual approved print');
 }
 const haul=render([base,duplicate],'summary',{pullSize:10});
 assert.match(haul,/single-arrival-wall-v2\.webp/);assert.doesNotMatch(haul,/class="gacha-reveal__foreground"/);
});

test('a first-time styled character reveals its full print without the three-second banner gate', () => {
  assert.ok(styleSetFor(base.cardId), 'fixture has a character unlock banner');
  const html = render([{ ...base, isNew: true }], 'reveal');
  assert.match(html, /data-layered-card="true"/);
  assert.match(html, /class="character-unlock" data-intro="false"/);
  assert.match(html, /Character banner unlocked/);
  assert.doesNotMatch(html, /Show my card · Skip intro/);
});

test('preparation mounts the same first print during the smoke without showing the haul', () => {
  const html = render([base, duplicate], 'knockout', { preparing: true });
  assert.match(html, /data-preparing="true" data-view="single"/);
  assert.equal((html.match(/data-layered-card="true"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /class="gacha-reveal__grid"/);
  assert.equal(render([base], 'knockout'), '');
});
