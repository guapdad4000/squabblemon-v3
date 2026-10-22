import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMatch, createCardInstance, playTurnCard, type Lane } from '../src/gameEngine';
import { GameGlyph } from '../src/components/venue/GameGlyph';
import { SquabbleSigil } from '../src/components/SquabbleSigil';
import { BattleAttack } from '../src/components/BattleAttack';
import { CardView } from '../src/components/CardView';
import { BattleFxImage, BATTLE_MEDIA } from '../src/components/BattleFxImage';
import { fireAttackTargetIds, squabbledCardIds } from '../src/lib/battleMediaEvents';

test('Motion glyph uses the supplied orb with a static server fallback',()=>{
  const html=renderToStaticMarkup(<GameGlyph name="motion"/>);
  assert.match(html,/motion-orb-still\.webp/);assert.doesNotMatch(html,/motion-bolt/);
});
test('every supplied animation has a reduced-motion/SSR still and ignores input',()=>{
  for(const kind of Object.keys(BATTLE_MEDIA) as (keyof typeof BATTLE_MEDIA)[]){
    const html=renderToStaticMarkup(<BattleFxImage kind={kind}/>);
    assert.ok(html.includes(`${kind}-still.webp`));assert.match(html,/aria-hidden="true"/);
    assert.match(html,/data-media-animated="false"/);
  }
});
test('persistent flame follows actual Burn stacks, retaining the stack count',()=>{
  const card=createCardInstance('hooper','cpu','lane-0',0);
  const render=()=>renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><CardView card={card} isBoard boardPresentation="combat" inspectable={false}/></QueryClientProvider>);
  assert.doesNotMatch(render(),/data-battle-media="burn-flame"/);
  card.statuses.burnStacks=2;
  const html=render();assert.match(html,/data-battle-media="burn-flame"/);assert.match(html,/Burning: 2 burn stacks/);
  card.statuses.burnStacks=0;assert.doesNotMatch(render(),/data-battle-media="burn-flame"/);
});
test('Fire visuals select actual hostile hits and Burn, excluding buffs and blocked targets',()=>{
  const before=createMatch('block','combo');before.playerMotion=20;
  before.playerHand=[createCardInstance('folks','player','hand',1)];
  const blocked={...createCardInstance('hooper','cpu','lane-0',0),lane:0 as Lane};blocked.statuses.protected=true;
  const enemy={...createCardInstance('plug','cpu','lane-0',1),lane:0 as Lane};
  const ally={...createCardInstance('hooper','player','lane-0',2),lane:0 as Lane};
  before.boards=[[blocked,enemy,ally],[],[]];
  const after=playTurnCard(before,'player',before.playerHand[0].instanceId,0);
  const event=after.effectLog.find(e=>e.type==='ability'&&e.cardId==='folks')!;assert.ok(event);
  const targets=fireAttackTargetIds(event);
  assert.ok(targets.has(enemy.instanceId));assert.ok(!targets.has(ally.instanceId));
  const stopped={...event,targets:event.targets.map(t=>t.cardInstanceId===blocked.instanceId?{...t,after:t.before}:t)};
  assert.ok(!fireAttackTargetIds(stopped).has(blocked.instanceId));
  assert.equal(fireAttackTargetIds({...event,kind:'water'}).size,0);
});
test('movement review uses an actual engine relocation event',()=>{
  const before=createMatch('block','combo');before.playerMotion=20;
  before.playerHand=[createCardInstance('carmeet','player','hand',1)];
  const after=playTurnCard(before,'player',before.playerHand[0].instanceId,0);
  const event=after.effectLog.find(e=>e.type==='ability'&&e.cardId==='carmeet')!;assert.ok(event);
  assert.ok(event.source?.before&&event.source.after&&event.source.before.lane!==event.source.after.lane);
});

test('Squabble aura uses the recorded play, not temporary power or the armed preview',()=>{
  const before=createMatch('block','combo');before.playerMotion=20;
  const fighter=createCardInstance('hooper','player','hand',8);before.playerHand=[fighter];
  const resolved=playTurnCard(before,'player',fighter.instanceId,0,true);
  const play=resolved.effectLog.find(e=>e.type==='play'&&e.cardInstanceId===fighter.instanceId)!;
  const ids=squabbledCardIds(JSON.parse(JSON.stringify(resolved.effectLog)));
  assert.ok(ids.has(fighter.instanceId));
  assert.ok(!squabbledCardIds(resolved.effectLog,play.sequence-1).has(fighter.instanceId));
  assert.ok(squabbledCardIds(resolved.effectLog,play.sequence).has(fighter.instanceId));
  const render=(played:boolean,covered=false)=>renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><CardView card={resolved.boards[0][0]} isBoard squabblePlayed={played} covered={covered} boardPresentation="combat"/></QueryClientProvider>);
  assert.match(render(true),/data-battle-media="squabble-aura"/);
  assert.match(render(true),/SQUABBLE: base Hands doubled/);
  assert.doesNotMatch(render(false),/data-battle-media="squabble-aura"/);
  assert.doesNotMatch(render(true,true),/data-battle-media="squabble-aura"/);
  const armed=renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><CardView card={fighter} squabble/></QueryClientProvider>);
  assert.doesNotMatch(armed,/data-battle-media="squabble-aura"/);
  assert.ok(squabbledCardIds([{...play,owner:'cpu'}]).has(fighter.instanceId));
});

test('Squabble art has an idle PNG, an interactive flame, and a one-shot spent pose without a count',()=>{
  const idle=renderToStaticMarkup(<SquabbleSigil/>);
  assert.match(idle,/squabble-idle\.png/);assert.match(idle,/squabble-ready-still\.webp/);
  assert.doesNotMatch(idle,/×2|x2|squabble-button\.webm/);
  const spent=renderToStaticMarkup(<SquabbleSigil spent/>);
  assert.match(spent,/squabble-spent-atlas\.webp/);assert.match(spent,/data-squabble-art="spent"/);
  assert.doesNotMatch(spent,/squabble-ready|squabble-idle|×2/);
});

test('supplied contact follows actual hostile damage, excluding windup, buffs, fire and neutral departures',()=>{
  const before=createMatch('block','combo');before.playerMotion=20;
  const attacker=createCardInstance('roaster','player','hand',1);before.playerHand=[attacker];
  const enemy={...createCardInstance('hooper','cpu','lane-0',0),lane:0 as Lane};
  before.boards=[[enemy],[],[]];
  const resolved=playTurnCard(before,'player',attacker.instanceId,0);
  const event=resolved.effectLog.find(e=>e.type==='ability'&&e.cardId==='roaster')!;assert.ok(event);
  const effect={...event,targetIds:event.targets.map(t=>t.cardInstanceId)};
  const render=(entry=effect,impact=true)=>renderToStaticMarkup(<BattleAttack card={attacker} effect={entry} impact={impact}/>);
  assert.match(render(),/class="attack-contact-media"/);
  assert.doesNotMatch(render(effect,false),/class="attack-contact-media"/);
  assert.doesNotMatch(render({...effect,kind:'fire'}),/class="attack-contact-media"/);
  assert.doesNotMatch(render({...effect,targets:effect.targets.map(t=>({...t,after:t.before}))}),/class="attack-contact-media"/);
  assert.doesNotMatch(render({...effect,targets:effect.targets.map(t=>({...t,owner:'player'}))}),/class="attack-contact-media"/);
  const removed={...effect,targets:effect.targets.map(t=>({...t,after:null}))};
  assert.match(render(removed),/class="attack-contact-media"/);
  assert.doesNotMatch(render({...removed,targets:removed.targets.map(t=>({...t,departureCause:'transformation' as const}))}),/class="attack-contact-media"/);
});
