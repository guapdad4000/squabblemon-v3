(() => {
  'use strict';
  const {CARDS:BASE_CARDS,TOKENS,DECKS:BASE_DECKS,BUILDS,DISTRICTS,TYPES} = window.SQPLAY;
  const roster = window.SQUABBLEMON || {};
  const TYPE_COLORS = {Fire:'#ef704e',Water:'#70b9de',Plant:'#91c96c',Rock:'#c1a06d',Electric:'#e6cf48',Air:'#b8d0d7',Dark:'#a17ec9',Normal:'#ded6c4',Poison:'#bb7fbf'};
  const $ = id => document.getElementById(id);
  const els = {
    lobby:$('lobbyScreen'), battle:$('battleScreen'), build:$('buildSelect'), buildNote:$('buildNote'), deckGrid:$('deckGrid'), rival:$('rivalSelect'),
    start:$('startBtn'), startMeta:$('startMeta'), viewDeck:$('viewDeckBtn'), export:$('exportBtn'), themeToggle:$('themeToggle'), phone:$('phone'),
    lanes:$('lanes'), hand:$('hand'), round:$('roundLabel'), seed:$('seedLabel'), hype:$('hypeNow'), lock:$('lockBtn'), lockSub:$('lockSub'),
    clout:$('cloutLabel'), squabble:$('squabbleBtn'), hint:$('hint'), deckLeft:$('deckLeft'), playerDeckName:$('playerDeckName'), cpuDeckName:$('cpuDeckName'), cpuDeckShort:$('cpuDeckShort'), patchRibbon:$('patchRibbon'), toast:$('eventToast'),
    deckOverlay:$('deckOverlay'), deckOverlayTitle:$('deckOverlayTitle'), deckOverlayPlan:$('deckOverlayPlan'), fullDeck:$('fullDeck'), inspectOverlay:$('inspectOverlay'), inspectSheet:$('inspectSheet'),
    result:$('resultOverlay'), resultMark:$('resultMark'), resultTitle:$('resultTitle'), resultSummary:$('resultSummary'), resultScores:$('resultScores'), rematch:$('rematchBtn'), lobbyBtn:$('lobbyBtn'), feedbackGrid:$('feedbackGrid')
  };

  const LOCAL_SPRITES = {
    "Rastamon": "assets/characters/rastamon.webp",
    "Officer Oink": "assets/characters/officer-oink.webp",
    "Snitch": "assets/characters/snitch.webp",
    "Techbro Rich": "assets/characters/techbro-rich.webp",
    "Bikelife YN": "assets/characters/bikelife-yn.webp",
    "Boss Babe": "assets/characters/boss-babe.webp",
    "Ganger Blue": "assets/characters/ganger-blue.webp",
    "Ganger Red": "assets/characters/ganger-red.webp",
    "Wifey": "assets/characters/wifey.webp",
    "Cracked Head": "assets/characters/cracked-head.webp",
    "Live Streamer": "assets/characters/live-streamer.webp",
    "Gamer": "assets/characters/gamer.webp",
    "Gamer Unemployed": "assets/characters/gamer-unemployed.webp",
    "Plug": "assets/characters/plug.webp",
    "Scammer": "assets/characters/scammer.webp",
    "All Jokes Roaster": "assets/characters/all-jokes-roaster.webp",
    "Closet Nerd": "assets/characters/closet-nerd.webp",
    "Hooper": "assets/characters/hooper.webp",
    "Baby Momma": "assets/characters/baby-momma.webp",
    "Snow Bunny": "assets/characters/snow-bunny.webp"
  };
  const nameToMon = {};
  for(const mon of Object.values(roster)) nameToMon[mon.name] = mon;

  const config = { playerDeck:'vibes', rivalDeck:'combo', build:'rc1', theme:'concrete' };
  let game = null;
  let inspectTimer = null;

  const clone = o => JSON.parse(JSON.stringify(o));
  const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const shuffle = arr => { const out=[...arr]; for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; };
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const uid = (p='x') => `${p}-${Math.random().toString(36).slice(2,9)}-${Date.now().toString(36).slice(-4)}`;
  const storageGet = (k,fallback=null) => { try { const v=localStorage.getItem(k); return v===null?fallback:v; } catch { return fallback; } };
  const storageSet = (k,v) => { try { localStorage.setItem(k,v); return true; } catch { return false; } };

  function getBuildData(buildId){
    const cards = clone(BASE_CARDS), decks = clone(BASE_DECKS);
    if(buildId==='a1') decks.vibes.cards = decks.vibes.cards.map(x=>x==='smoker'?'techy':x);
    if(buildId==='a2' || buildId==='rc1') decks.vibes.cards = decks.vibes.cards.map(x=>x==='functional'?'nerd':x);
    if(buildId==='c1' || buildId==='rc1') decks.crashout.cards = decks.crashout.cards.map(x=>x==='functional'?'roaster':x);
    if(buildId==='b2'){
      cards.rastamon.effectText = 'On Reveal: Cleanse another friendly card here. If anything was removed, give that card +2 Power. If nothing was removed, give your lowest-Power other friendly card here +1 Power.';
      cards.rastamon.patchB2 = true;
    }
    if(buildId==='c2'){
      cards.babyMomma.effectText = 'On Reveal: If your opponent has more cards on their board than you, gain +2 Power. If they have at least 2 more cards on their board than you, the next enemy card played at this district gets -2 Power when it reveals.';
      cards.babyMomma.patchC2 = true;
    }
    return {cards,decks};
  }

  function spriteFor(card){ return LOCAL_SPRITES[card.name] || nameToMon[card.name]?.sprite || ''; }
  function loreFor(card){ return nameToMon[card.name]?.lore || `${card.archetype} field operative.`; }

  function makeCard(def, originalOwner, serial){
    return {
      ...clone(def), uid:`${originalOwner}-${def.id}-${serial}-${uid('c')}`, originalOwner, originDeck:null, owner:originalOwner,
      power:def.basePower, originalBasePower:def.basePower, positivePower:0, negativePower:0, poison:false, frozenUntil:0,
      permanentSilence:false, revealed:false, playedRound:0, arrival:0, triggerCount:0, simpleExtra:0, onceUsed:false, moveBuffs:0,
      lastMoveRound:0, copiedEffectId:null, copiedAbilityName:null, generated:!!def.token, knownToPlayer:false
    };
  }

  function makePlayer(deckId, side, cards, decks){
    const defs=decks[deckId].cards.map((id,i)=>{ const c=makeCard(cards[id],side,i+1); c.originDeck=deckId; return c; });
    const deck=shuffle(defs), hand=deck.splice(0,4);
    if(!hand.some(c=>c.cost===1)){
      const idx=deck.findIndex(c=>c.cost===1); if(idx>=0){ const [c]=deck.splice(idx,1); deck.push(hand.pop()); hand.unshift(c); }
    }
    if(!hand.some(c=>c.cost<=2)){
      const idx=deck.findIndex(c=>c.cost<=2); if(idx>=0){ const [c]=deck.splice(idx,1); deck.push(hand.pop()); hand.push(c); }
    }
    return { side, deckId, deck, hand, history:[], lastEligibleOnReveal:null, nextDiscounts:[], bossDiscount:false, hype:1, playedIdsThisRound:new Set(), queued:[], metrics:newMetrics() };
  }

  function newMetrics(){ return {hypeSpent:0,cardsPlayed:0,generatedCards:0,controlValue:0,movementValue:0,engineValue:0,disruptionValue:0,comebackValue:0,sustainValue:0,scalingValue:0,infoValue:0,typePower:0,districtPower:0,preventedValue:0,discountsUsed:0,poisonTicks:0,silences:0,cleanses:0,protections:0,moves:0,passRounds:0,round6Swing:0}; }

  function makeLane(d){ return {district:d,revealed:false,cards:[[],[]],arrivalCounter:0,moveLockUntil:[0,0],playLimitRound:[0,0],playLimitMax:[Infinity,Infinity],nextPenalty:[0,0],homieUsedRound:[0,0],wifeyUsedRound:[0,0]}; }

  function startGame(rematch=false){
    const {cards,decks}=getBuildData(config.build);
    const rivalId=config.rivalDeck==='random'?shuffle(Object.keys(decks).filter(x=>x!==config.playerDeck))[0]:config.rivalDeck;
    const seed=rand(100000,999999);
    const districts=shuffle(DISTRICTS).slice(0,3);
    game={cards,decks,build:config.build,seed,round:1,maxRounds:6,clout:1,squabbled:false,firstPriority:Math.random()<.5?0:1,selectedHand:null,selectedBoard:null,resolving:false,round5Total:null,feedback:null,
      players:[makePlayer(config.playerDeck,0,cards,decks),makePlayer(rivalId,1,cards,decks)],lanes:districts.map(makeLane),events:[],startedAt:Date.now()};
    game.players.forEach(p=>p.hype=1);
    updateDistrictReveal();
    els.lobby.classList.remove('active'); els.result.classList.remove('open'); els.battle.classList.add('active');
    els.playerDeckName.textContent=decks[config.playerDeck].short; els.cpuDeckName.textContent=decks[rivalId].name; els.cpuDeckShort.textContent=decks[rivalId].archetype.toUpperCase();
    els.patchRibbon.textContent=BUILDS[config.build].name; els.seed.textContent=`#${seed}`;
    els.clout.textContent='×1'; els.squabble.classList.remove('used');
    render(); toast(`${decks[config.playerDeck].short} vs ${decks[rivalId].short}`);
  }

  function updateDistrictReveal(){ game.lanes.forEach((l,i)=>l.revealed=game.round>=i+1); }
  function activeEffectId(c){return c.copiedEffectId||c.effectId;}
  function allBoardCards(side){return game.lanes.flatMap(l=>l.cards[side]).filter(c=>c.revealed);}
  function cardPos(card){for(let li=0;li<3;li++)for(let side=0;side<2;side++)if(game.lanes[li].cards[side].includes(card))return{lane:game.lanes[li],laneIndex:li,side};return null;}
  function hasActiveEffect(c,e){return !!(c&&c.revealed&&!isSilenced(c)&&activeEffectId(c)===e);}
  function baseLocationDisabled(lane){return lane.cards[0].some(c=>c.revealed&&!c.permanentSilence&&activeEffectId(c)==='cloudNine')||lane.cards[1].some(c=>c.revealed&&!c.permanentSilence&&activeEffectId(c)==='cloudNine');}
  function staticLocationBonus(card,lane,side){
    if(!lane.revealed||baseLocationDisabled(lane))return 0; const d=lane.district; let b=0;
    if(d.types?.includes(card.type))b+=d.bonus||0; if(d.debuffCardBonus&&card.hasDebuff)b+=d.debuffCardBonus; if(d.lateBonus&&card.playedRound>=4)b+=d.lateBonus; if(d.lowCostBonus&&card.cost<=3)b+=d.lowCostBonus;
    if(d.firstBonus){const first=[...lane.cards[side]].filter(c=>c.revealed).sort((a,b)=>a.arrival-b.arrival)[0];if(first===card)b+=d.firstBonus;}
    if(d.speedBonus&&card.speed>=170)b+=d.speedBonus; if(d.soloBonus&&lane.cards[side].filter(c=>c.revealed).length===1)b+=d.soloBonus;
    if(d.cheapLeaderBonus){const cs=lane.cards[side].filter(c=>c.revealed);if(cs.length){const m=Math.min(...cs.map(c=>c.cost));if(card.cost===m)b+=d.cheapLeaderBonus;}}
    if(d.fastestBonus){const cs=lane.cards[side].filter(c=>c.revealed);if(cs.length){const m=Math.max(...cs.map(c=>c.speed));if(card.speed===m)b+=d.fastestBonus;}}
    return b;
  }
  function rawPower(card,lane,side){let p=card.power+staticLocationBonus(card,lane,side);const e=activeEffectId(card);if(e==='guts'&&(card.poison||game.round<=card.frozenUntil||card.negativePower>0))p+=3;if(e==='truant'){const other=[...game.players[side].playedIdsThisRound].some(id=>id!==card.uid);if(other)p-=3;}return Math.max(0,p);}
  function closetTarget(lane,closetSide){const enemy=1-closetSide,cs=lane.cards[enemy].filter(c=>c.revealed);return [...cs].sort((a,b)=>rawPower(b,lane,enemy)-rawPower(a,lane,enemy)||a.arrival-b.arrival)[0]||null;}
  function isSilenced(card){if(card.permanentSilence)return true;const pos=cardPos(card);if(!pos)return false;const enemy=1-pos.side;const closets=pos.lane.cards[enemy].filter(c=>c.revealed&&!c.permanentSilence&&activeEffectId(c)==='unaware');return closets.some(()=>closetTarget(pos.lane,enemy)===card);}
  function effectivePower(card,lane,side){let p=card.power+staticLocationBonus(card,lane,side);if(!isSilenced(card)){const e=activeEffectId(card);if(e==='guts'&&(card.poison||game.round<=card.frozenUntil||card.negativePower>0))p+=3;if(e==='truant'){const other=[...game.players[side].playedIdsThisRound].some(id=>id!==card.uid);if(other)p-=3;}}return Math.max(0,p);}
  function laneScore(li,side){const l=game.lanes[li];return l.cards[side].filter(c=>c.revealed).reduce((s,c)=>s+effectivePower(c,l,side),0);}
  function totalPower(side){return [0,1,2].reduce((s,i)=>s+laneScore(i,side),0);}
  function laneWins(){let a=0,b=0;for(let i=0;i<3;i++){const x=laneScore(i,0),y=laneScore(i,1);if(x>y)a++;else if(y>x)b++;}return[a,b];}
  function highest(cards,lane,side){return [...cards].filter(c=>c.revealed).sort((a,b)=>effectivePower(b,lane,side)-effectivePower(a,lane,side)||a.arrival-b.arrival)[0];}
  function lowest(cards,lane,side){return [...cards].filter(c=>c.revealed).sort((a,b)=>effectivePower(a,lane,side)-effectivePower(b,lane,side)||a.arrival-b.arrival)[0];}
  function afflicted(card){return !!(card.poison||game.round<=card.frozenUntil||card.permanentSilence||card.negativePower>0);}
  function getWifey(lane,side,target){if(lane.wifeyUsedRound[side]===game.round)return null;return lane.cards[side].find(c=>c!==target&&hasActiveEffect(c,'sideEye'))||null;}
  function getHomie(lane,side){if(lane.homieUsedRound[side]===game.round)return null;return lane.cards[side].find(c=>hasActiveEffect(c,'clockIn'))||null;}
  function timelineAmp(lane){return lane.revealed&&!baseLocationDisabled(lane)&&lane.district.debuffAmp?lane.district.debuffAmp:0;}
  function applyBuff(target,amount,source,metric='engineValue'){
    if(!target||amount<=0)return 0;target.power+=amount;target.positivePower+=amount;const side=target.owner;
    if(source?.owner===side&&source.uid!==target.uid){const pos=cardPos(target);if(pos&&hasActiveEffect(target,'simple')&&target.simpleExtra<4){const extra=Math.min(amount,4-target.simpleExtra);target.power+=extra;target.positivePower+=extra;target.simpleExtra+=extra;game.players[side].metrics.scalingValue+=extra;}}
    if(metric)game.players[side].metrics[metric]=(game.players[side].metrics[metric]||0)+amount; return amount;
  }
  function applyReduction(source,lane,targets,amount,metric='disruptionValue',targeted=true){
    const sourceSide=source.owner,enemy=1-sourceSide,alive=targets.filter(Boolean).filter(c=>c.owner===enemy);if(!alive.length||amount>=0)return 0;
    const homie=getHomie(lane,enemy);if(homie){lane.homieUsedRound[enemy]=game.round;const v=Math.abs(amount)*alive.length;game.players[enemy].metrics.preventedValue+=v;game.players[enemy].metrics.sustainValue+=v;game.players[enemy].metrics.protections++;return 0;}
    let total=0;for(const target of alive){if(targeted){const w=getWifey(lane,enemy,target);if(w){lane.wifeyUsedRound[enemy]=game.round;game.players[enemy].metrics.preventedValue+=Math.abs(amount);game.players[enemy].metrics.sustainValue+=Math.abs(amount);game.players[enemy].metrics.protections++;continue;}}
      const adjusted=amount-timelineAmp(lane),before=target.power;target.power=Math.max(0,target.power+adjusted);const actual=target.power-before;if(actual<0){target.negativePower+=Math.abs(actual);total+=Math.abs(actual);}}
    game.players[sourceSide].metrics[metric]+=total;return total;
  }
  function cleanse(card,side){if(!card)return{removed:false,value:0};let removed=false,value=0;if(card.negativePower>0){value+=card.negativePower;card.power+=card.negativePower;card.negativePower=0;removed=true;}if(card.poison){card.poison=false;value+=1;removed=true;}if(game.round<=card.frozenUntil){card.frozenUntil=0;value+=1;removed=true;}if(card.permanentSilence){card.permanentSilence=false;value+=2;removed=true;}if(removed){game.players[side].metrics.cleanses++;game.players[side].metrics.sustainValue+=value;}return{removed,value};}

  function moveCard(card,from,to,reason='move'){
    const side=card.owner,fromLane=game.lanes[from],toLane=game.lanes[to];if(from===to||toLane.cards[side].length>=4||game.round<=toLane.moveLockUntil[side]||game.round<=card.frozenUntil)return false;
    const idx=fromLane.cards[side].indexOf(card);if(idx<0)return false;fromLane.cards[side].splice(idx,1);toLane.cards[side].push(card);card.arrival=++toLane.arrivalCounter;game.players[side].metrics.moves++;game.players[side].metrics.movementValue+=Math.max(1,card.basePower*.5);
    if(hasActiveEffect(card,'scrapScramble')){const t=lowest(toLane.cards[1-side],toLane,1-side);if(t){t.poison=true;game.players[side].metrics.disruptionValue+=1;}}
    logEvent('move',{card:card.name,from,to,reason});return true;
  }
  function addToken(side,tokenId){const p=game.players[side];if(p.hand.length>=7)return;const c=makeCard(TOKENS[tokenId],side,`tok${game.round}${p.metrics.generatedCards}`);c.originDeck=p.deckId;p.hand.push(c);p.metrics.generatedCards++;p.metrics.engineValue+=c.basePower;logEvent('token',{side,card:c.name});}

  function onCardRevealedTriggers(card,li){
    const side=card.owner,p=game.players[side],lane=game.lanes[li];if(lane.nextPenalty[side]>0){const val=lane.nextPenalty[side];lane.nextPenalty[side]=0;applyReduction({owner:1-side},lane,[card],-val,'disruptionValue',true);}
    if(card.cost<=2){
      for(const g of lane.cards[side].filter(c=>c.revealed&&c!==card&&hasActiveEffect(c,'tryhard')&&c.triggerCount<3)){g.triggerCount++;applyBuff(card,1,g,'engineValue');applyBuff(g,1,g,'engineValue');}
      for(const s of allBoardCards(side).filter(c=>hasActiveEffect(c,'followerFrenzy')&&c.triggerCount<3)){s.triggerCount++;if(s.triggerCount<=2)applyBuff(s,1,s,'engineValue');if(s.triggerCount===3)addToken(side,'stan');}
    }
    for(let i=0;i<3;i++){if(i===li)continue;for(const b of game.lanes[i].cards[side].filter(c=>c.revealed&&hasActiveEffect(c,'networkBoost')&&c.triggerCount<2)){b.triggerCount++;applyBuff(b,1,b,'engineValue');if(b.triggerCount===2)p.bossDiscount=true;}}
  }

  function resolveOnReveal(card,li,effectOverride=null,repeated=false){
    if(isSilenced(card))return;const side=card.owner,enemy=1-side,p=game.players[side],lane=game.lanes[li],allies=lane.cards[side],foes=lane.cards[enemy],effect=effectOverride||activeEffectId(card);
    const winning=()=>laneScore(li,side)>laneScore(li,enemy),losing=()=>laneScore(li,side)<laneScore(li,enemy);
    switch(effect){
      case 'naturalCure':{
        const t=allies.filter(c=>c!==card&&afflicted(c)).sort((a,b)=>effectivePower(a,lane,side)-effectivePower(b,lane,side))[0];const r=cleanse(t,side);if(r.removed)applyBuff(t,2,card,'sustainValue');else if(card.patchB2){const low=lowest(allies.filter(c=>c!==card),lane,side);if(low)applyBuff(low,1,card,'sustainValue');}
        break;}
      case 'download':{const t=highest(foes,lane,enemy);if(t){const a=Math.min(3,t.positivePower);if(a>0)applyBuff(card,a,card,'engineValue');}break;}
      case 'waveCheck':{const cand=[];for(let i=0;i<3;i++)if(i!==li)for(const c of game.lanes[i].cards[side])if(c.revealed&&game.round>c.frozenUntil)cand.push({c,i});cand.sort((a,b)=>effectivePower(a.c,game.lanes[a.i],side)-effectivePower(b.c,game.lanes[b.i],side));const pick=cand.find(()=>lane.cards[side].length<4&&game.round>lane.moveLockUntil[side]);if(pick&&moveCard(pick.c,pick.i,li,'waveCheck')){applyBuff(pick.c,1,card,'movementValue');applyBuff(card,1,card,'movementValue');}break;}
      case 'ratio':{const t=highest(foes,lane,enemy);if(t){const played=foes.some(c=>c.playedRound===game.round);applyReduction(card,lane,[t],played?-3:-2,'disruptionValue',true);}break;}
      case 'tantrum':if(losing())applyBuff(card,4,card,'comebackValue');else if(winning()){const before=card.power;card.power=Math.max(0,card.power-2);card.negativePower+=before-card.power;}break;
      case 'hustle':addToken(side,'scrap');break;
      case 'killerInstinct':{const t=highest(foes,lane,enemy);if(t){const w=getWifey(lane,enemy,t);if(w){lane.wifeyUsedRound[enemy]=game.round;game.players[enemy].metrics.sustainValue+=2;}else{t.permanentSilence=true;p.metrics.silences++;p.metrics.disruptionValue+=2;applyReduction(card,lane,[t],-2,'disruptionValue',false);}}break;}
      case 'vcFlex':if(p.hype>0){p.hype-=1;p.metrics.hypeSpent+=1;applyBuff(card,2,card,'engineValue');}break;
      case 'connections':p.nextDiscounts.push({originLane:li,amount:1});break;
      case 'imposter':{const t=highest(foes,lane,enemy);if(t){const nb=Math.min(7,t.basePower),d=nb-card.basePower;card.basePower=nb;card.power=Math.max(0,card.power+d);card.copiedEffectId=activeEffectId(t);card.copiedAbilityName=t.abilityName;p.metrics.engineValue+=Math.max(0,d);}break;}
      case 'cornerCheck':applyReduction(card,lane,foes.filter(c=>c.revealed),-1,'controlValue',false);if(winning())lane.moveLockUntil[enemy]=Math.max(lane.moveLockUntil[enemy],game.round+1);break;
      case 'tagTeam':{const blue=allBoardCards(side).find(c=>c.id==='gangerBlue');if(blue){applyBuff(card,2,card,'engineValue');applyBuff(blue,2,card,'engineValue');}else if(foes.some(c=>c.playedRound===game.round))applyBuff(card,2,card,'engineValue');break;}
      case 'remix':{const last=p.lastEligibleOnReveal;if(last&&!['imposter','remix'].includes(last.effectId))resolveOnReveal(card,li,last.effectId,true);break;}
      case 'ankleBreaker':if(losing()){const t=highest(foes,lane,enemy);if(t)applyReduction(card,lane,[t],-2,'comebackValue',true);applyBuff(card,2,card,'comebackValue');}break;
      case 'civicPressure':applyReduction(card,lane,foes.filter(c=>c.revealed),-1,'controlValue',false);lane.playLimitRound[enemy]=game.round+1;lane.playLimitMax[enemy]=1;lane.moveLockUntil[enemy]=Math.max(lane.moveLockUntil[enemy],game.round+1);break;
      case 'scare':{if(foes.filter(c=>c.revealed).length>=3){const t=lowest(foes,lane,enemy);const opts=[0,1,2].filter(i=>i!==li&&game.lanes[i].cards[enemy].length<4&&game.round>game.lanes[i].moveLockUntil[enemy]);if(t&&opts.length){opts.sort((a,b)=>(laneScore(a,enemy)-laneScore(a,side))-(laneScore(b,enemy)-laneScore(b,side)));moveCard(t,li,opts[0],'forced');p.metrics.disruptionValue+=1;}}break;}
      case 'scrapScramble':{const t=lowest(foes,lane,enemy);if(t){t.poison=true;p.metrics.disruptionValue+=1;}break;}
      case 'coldShoulder':{const t=highest(foes,lane,enemy);if(t){const w=getWifey(lane,enemy,t);if(w){lane.wifeyUsedRound[enemy]=game.round;game.players[enemy].metrics.sustainValue+=1;}else{t.frozenUntil=Math.max(t.frozenUntil,game.round+1);p.metrics.controlValue+=1.5;}}break;}
      case 'coffeeBreak':if(game.round>=5){applyBuff(card,3,card,'comebackValue');const t=allies.filter(c=>afflicted(c)).sort((a,b)=>effectivePower(a,lane,side)-effectivePower(b,lane,side))[0];cleanse(t,side);}break;
      case 'mamaBear':{
        if(card.patchC2){const mine=allBoardCards(side).length,theirs=allBoardCards(enemy).length;if(theirs>mine)applyBuff(card,2,card,'comebackValue');if(theirs>=mine+2)lane.nextPenalty[enemy]=Math.max(lane.nextPenalty[enemy],2);}
        else{if(foes.filter(c=>c.revealed).length>allies.filter(c=>c.revealed).length)applyBuff(card,2,card,'comebackValue');lane.nextPenalty[enemy]=Math.max(lane.nextPenalty[enemy],2);}break;}
      case 'scrapToken':if(losing())applyBuff(card,2,card,'engineValue');break;
      case 'stanToken':if(allBoardCards(side).some(c=>hasActiveEffect(c,'followerFrenzy')))applyBuff(card,1,card,'engineValue');break;
    }
    if(!repeated&&['naturalCure','download','waveCheck','ratio','tantrum','hustle','killerInstinct','vcFlex','connections','cornerCheck','tagTeam','ankleBreaker','civicPressure','scare','scrapScramble','coldShoulder','coffeeBreak','mamaBear','scrapToken','stanToken'].includes(effect))p.lastEligibleOnReveal={effectId:effect};
  }

  function typeResult(a,b){const aa=TYPES[a.type],bb=TYPES[b.type],as=aa?.strong?.includes(b.type),bs=bb?.strong?.includes(a.type);if(as&&!bs)return 1;if(bs&&!as)return-1;return 0;}
  function resolveTypeClashes(){
    for(let li=0;li<3;li++){const lane=game.lanes[li],a=lane.cards[0].filter(c=>c.revealed&&c.playedRound===game.round).sort((x,y)=>y.speed-x.speed),b=lane.cards[1].filter(c=>c.revealed&&c.playedRound===game.round).sort((x,y)=>y.speed-x.speed);
      for(let n=0;n<Math.min(a.length,b.length);n++){const x=a[n],y=b[n],r=typeResult(x,y);if(r>0){x.power+=2;x.positivePower+=2;game.players[0].metrics.typePower+=2;toast(`${x.name} TYPE CLASH +2`);}else if(r<0){y.power+=2;y.positivePower+=2;game.players[1].metrics.typePower+=2;toast(`${y.name} TYPE CLASH +2`);}else if(x.speed>y.speed){x.power+=1;x.positivePower+=1;game.players[0].metrics.typePower+=1;}else if(y.speed>x.speed){y.power+=1;y.positivePower+=1;game.players[1].metrics.typePower+=1;}else{const z=game.firstPriority===0?x:y;z.power+=1;z.positivePower+=1;game.players[z.owner].metrics.typePower+=1;}}
    }
  }

  function resolveEndRound(){
    for(let side=0;side<2;side++)for(let li=0;li<3;li++){const lane=game.lanes[li];for(const card of [...lane.cards[side]]){if(!card.revealed||isSilenced(card))continue;const e=activeEffectId(card);
      if(e==='soberUp'&&card.triggerCount<3){const t=lane.cards[side].filter(c=>c.revealed&&afflicted(c)).sort((a,b)=>effectivePower(a,lane,side)-effectivePower(b,lane,side))[0];if(t){const r=cleanse(t,side);if(r.removed){card.triggerCount++;applyBuff(card,1,card,'sustainValue');}}}
      if(e==='rooted'&&card.triggerCount<3){const others=lane.cards[side].filter(c=>c.revealed&&c!==card),t=lowest(others,lane,side);if(t){const plant=others.some(c=>c.type==='Plant');const amt=plant?2:1;card.triggerCount++;applyBuff(t,amt,card,'scalingValue');}}
    }}
    const end=[];for(let side=0;side<2;side++)for(let li=0;li<3;li++)for(const card of game.lanes[li].cards[side])if(card.revealed&&!isSilenced(card))end.push(card);end.sort((a,b)=>b.speed-a.speed);
    for(const card of end){const pos=cardPos(card);if(!pos)continue;const {lane,laneIndex:li,side}=pos,enemy=1-side,e=activeEffectId(card);
      if(e==='sideSwitcher'&&!card.onceUsed&&laneScore(li,side)<laneScore(li,enemy)){const eligible=lane.cards[enemy].filter(c=>c.revealed&&c.basePower<=4).sort((a,b)=>effectivePower(a,lane,enemy)-effectivePower(b,lane,enemy)),t=eligible[0];if(t){const ai=lane.cards[side].indexOf(card),bi=lane.cards[enemy].indexOf(t);lane.cards[side][ai]=t;lane.cards[enemy][bi]=card;const old=card.owner;card.owner=t.owner;t.owner=old;card.onceUsed=true;game.players[side].metrics.disruptionValue+=Math.max(1,t.basePower-card.basePower);toast('SIDE SWITCHER!');}}
      if(e==='logoutGhost'&&!card.onceUsed){const own=lane.cards[side].filter(c=>c.revealed).length,opp=lane.cards[enemy].filter(c=>c.revealed).length;if(opp>own){const opts=[0,1,2].filter(j=>j!==li&&game.lanes[j].cards[side].length<4&&game.round>game.lanes[j].moveLockUntil[side]);opts.sort((a,b)=>game.lanes[a].cards[enemy].length-game.lanes[b].cards[enemy].length);if(opts.length&&moveCard(card,li,opts[0],'logout')){card.onceUsed=true;applyBuff(card,2,card,'movementValue');toast('LOGOUT GHOST +2');}}}
    }
    for(let li=0;li<3;li++){const lane=game.lanes[li];if(lane.revealed&&!baseLocationDisabled(lane)&&lane.district.growth){for(let side=0;side<2;side++){const t=lowest(lane.cards[side],lane,side);if(t){t.power+=1;t.positivePower+=1;game.players[side].metrics.districtPower+=1;}}}}
    for(let side=0;side<2;side++)for(const c of allBoardCards(side))if(c.poison){const before=c.power;c.power=Math.max(0,c.power-1);const v=before-c.power;c.negativePower+=v;game.players[1-side].metrics.disruptionValue+=v;game.players[1-side].metrics.poisonTicks+=v;}
  }

  function effectiveCost(player,card,li){if(card.cost===0)return{cost:0,discount:null,boss:false};let cost=card.cost,discount=null,boss=false;const idx=player.nextDiscounts.findIndex(d=>d.originLane!==li);if(idx>=0){cost=Math.max(1,cost-player.nextDiscounts[idx].amount);discount=idx;}if(player.bossDiscount&&card.cost>=4){cost=Math.max(1,cost-1);boss=true;}return{cost,discount,boss};}
  function consumeDiscount(p,ci){const used={discount:null,boss:false};if(ci.discount!==null){used.discount=p.nextDiscounts.splice(ci.discount,1)[0];p.metrics.discountsUsed++;}if(ci.boss){p.bossDiscount=false;used.boss=true;p.metrics.discountsUsed++;}return used;}
  function restoreDiscount(p,used){if(used?.discount)p.nextDiscounts.push(used.discount);if(used?.boss)p.bossDiscount=true;}

  function canQueue(side,card,li){const p=game.players[side],lane=game.lanes[li],existing=lane.cards[side].length;if(existing>=4)return false;const queuedHere=p.queued.filter(q=>q.li===li).length;if(lane.playLimitRound[side]===game.round&&queuedHere>=lane.playLimitMax[side])return false;const ci=effectiveCost(p,card,li);return ci.cost<=p.hype;}
  function queueCard(side,card,li){const p=game.players[side];if(!canQueue(side,card,li))return false;const ci=effectiveCost(p,card,li),used=consumeDiscount(p,ci);p.hype-=ci.cost;p.hand=p.hand.filter(c=>c.uid!==card.uid);card.playedRound=game.round;card.revealed=false;card.owner=side;card.arrival=++game.lanes[li].arrivalCounter;game.lanes[li].cards[side].push(card);const q={card,li,costPaid:ci.cost,discountUsed:used};p.queued.push(q);p.playedIdsThisRound.add(card.uid);p.metrics.cardsPlayed++;p.metrics.hypeSpent+=ci.cost;return true;}
  function unqueuePlayer(card){const p=game.players[0],q=p.queued.find(x=>x.card===card);if(!q)return;const lane=game.lanes[q.li],idx=lane.cards[0].indexOf(card);if(idx>=0)lane.cards[0].splice(idx,1);p.queued=p.queued.filter(x=>x!==q);p.hand.push(card);p.hype+=q.costPaid;p.metrics.cardsPlayed--;p.metrics.hypeSpent-=q.costPaid;p.playedIdsThisRound.delete(card.uid);restoreDiscount(p,q.discountUsed);card.playedRound=0;render();}

  function locationPreview(card,li,side){const lane=game.lanes[li];if(!lane.revealed||baseLocationDisabled(lane))return 0;const d=lane.district;let b=0;if(d.types?.includes(card.type))b+=d.bonus||0;if(d.debuffCardBonus&&card.hasDebuff)b+=d.debuffCardBonus;if(d.lateBonus&&game.round>=4)b+=d.lateBonus;if(d.lowCostBonus&&card.cost<=3)b+=d.lowCostBonus;if(d.speedBonus&&card.speed>=170)b+=d.speedBonus;if(d.firstBonus&&lane.cards[side].length===0)b+=d.firstBonus;if(d.soloBonus&&lane.cards[side].length===0)b+=2.8;if(d.cheapLeaderBonus)b+=1;if(d.fastestBonus&&card.speed>=170)b+=1;return b;}
  function estimateEffect(card,li,side){const lane=game.lanes[li],enemy=1-side,diff=laneScore(li,side)-laneScore(li,enemy),foes=lane.cards[enemy].filter(c=>c.revealed),allies=lane.cards[side].filter(c=>c.revealed),enemyMax=foes.length?Math.max(...foes.map(c=>effectivePower(c,lane,enemy))):0,aff=allies.filter(afflicted).length,e=card.effectId;switch(e){case'naturalCure':return aff?4:card.patchB2?1:.1;case'download':return Math.min(3,Math.max(0,...foes.map(c=>c.positivePower)))+.5;case'waveCheck':return allBoardCards(side).length?2:0;case'ratio':return foes.length?3:0;case'unaware':return enemyMax>=6?3:1;case'tantrum':return diff<0?5:diff>0?-2:1;case'soberUp':return aff?2.5:.5;case'truant':return game.round<=3?2:0;case'tryhard':return game.round<=3?3:1;case'hustle':return 2.5;case'killerInstinct':return foes.length?Math.min(5,2+enemyMax*.4):0;case'rooted':return game.round<=3?3:1;case'vcFlex':return 1.5;case'connections':return game.round<=4?2.5:.5;case'imposter':return enemyMax>=5?4:1;case'cloudNine':return lane.revealed?1.5:.3;case'simple':return game.round<=3?2:.5;case'cornerCheck':return foes.length?3.5:1;case'tagTeam':return allBoardCards(side).some(c=>c.id==='gangerBlue')?4:foes.some(c=>c.playedRound===game.round)?2:1;case'sideSwitcher':return diff<0&&foes.some(c=>c.basePower<=4)?3:.5;case'remix':return game.players[side].lastEligibleOnReveal?3:0;case'rideOut':return game.round<=3?2:1;case'ankleBreaker':return diff<0&&foes.length?4:.5;case'followerFrenzy':return game.round<=3?3:1;case'civicPressure':return foes.length?4:2;case'tattle':return game.round<=4?1.8:.5;case'scare':return foes.length>=3?4:0;case'scrapScramble':return foes.length?2.5:.5;case'sideEye':return allies.length?2.5:1;case'networkBoost':return game.round<=3?3:1;case'coldShoulder':return foes.length?2.8:.5;case'coffeeBreak':return game.round>=5?4:0;case'mamaBear':return card.patchC2?(allBoardCards(enemy).length>allBoardCards(side).length?4:1):(foes.length>allies.length?4:1.5);case'logoutGhost':return game.round<=4?2.5:1;case'guts':return 1.5;default:return 0;}}
  function archetypeBias(deckId,card,li,side){const lane=game.lanes[li],enemy=1-side,my=laneScore(li,side),opp=laneScore(li,enemy),diff=my-opp;let b=0;if(deckId==='block'){if(lane.cards[enemy].length)b+=1.5;if(['oink','gangerBlue','snowBunny','smoker'].includes(card.id))b+=Math.min(2,lane.cards[enemy].length);}if(deckId==='slide'){if(lane.cards[side].length>=3)b-=1.5;if(diff>7)b-=2;if(['bikelife','eGirl','vibe'].includes(card.id)&&game.round<=3)b+=1;}if(deckId==='combo'){if(['gamer','streamer','bossBabe','earthy','suburban'].includes(card.id)&&game.round<=3)b+=2;if(card.cost<=2)b+=.7;}if(deckId==='receipts'){if(lane.cards[enemy].length)b+=1.2;if(opp>=6)b+=1;}if(deckId==='crashout'){if(['dysfunctional','hooper'].includes(card.id)&&diff<0)b+=3;if(card.id==='nine5Homegirl'&&game.round<5)b-=4;if(card.id==='babyMomma'&&estimateEffect(card,li,side)>=4)b+=2;}if(deckId==='vibes'){if(['wifey','nine5'].includes(card.id)&&lane.cards[side].length)b+=1.5;if(['earthy','suburban'].includes(card.id)&&game.round<=3)b+=1.5;}if(deckId==='compound'){if(['earthy','suburban','gamer','streamer','bossBabe','gamerUnemployed'].includes(card.id)&&game.round<=3)b+=2;if(diff>8)b-=1.5;}return b;}
  function cpuTurn(){const p=game.players[1];let safety=10;while(safety--&&p.hand.length){let best=null;for(const c of p.hand){for(let li=0;li<3;li++){if(!canQueue(1,c,li))continue;const ci=effectiveCost(p,c,li),diff=laneScore(li,1)-laneScore(li,0);let s=c.basePower+locationPreview(c,li,1)+estimateEffect(c,li,1)+archetypeBias(p.deckId,c,li,1);if(diff<0&&diff>-10)s+=2.2;if(diff>8)s-=2.5;if(game.lanes[li].cards[0].length)s+=.8;s+=Math.random()*.8;s/=Math.max(.8,ci.cost||.7);if(!best||s>best.s)best={c,li,s};}}if(!best||best.s<1.05)break;queueCard(1,best.c,best.li);if(p.hype<=0)break;}if(!p.queued.length)p.metrics.passRounds++;applySnitchKnowledge();}
  function applySnitchKnowledge(){for(let li=0;li<3;li++){const has=game.lanes[li].cards[0].some(c=>hasActiveEffect(c,'tattle'));if(!has)continue;const first=game.players[1].queued.find(q=>q.li===li)?.card;if(first){first.knownToPlayer=true;game.players[0].metrics.infoValue++;toast(`SNITCH: ${first.name} spotted in ${game.lanes[li].district.name}`);}}}

  function playerMoveBikelife(card,targetLi){const pos=cardPos(card);if(!pos||pos.side!==0||!hasActiveEffect(card,'rideOut')||card.lastMoveRound===game.round||card.moveBuffs>=3)return false;if(moveCard(card,pos.laneIndex,targetLi,'rideOut')){card.lastMoveRound=game.round;card.moveBuffs++;applyBuff(card,1,card,'movementValue');game.selectedBoard=null;toast('RIDE OUT +1');render();return true;}return false;}

  async function lockIn(){
    if(!game||game.resolving)return;game.resolving=true;els.lock.classList.remove('ready');game.selectedHand=null;game.selectedBoard=null;
    cpuTurn();render();await wait(450);
    const all=[...game.players[0].queued.map(q=>({...q,side:0})),...game.players[1].queued.map(q=>({...q,side:1}))].sort((a,b)=>b.card.speed-a.card.speed||(a.side===game.firstPriority?-1:1));
    for(const item of all){item.card.revealed=true;onCardRevealedTriggers(item.card,item.li);resolveOnReveal(item.card,item.li);logEvent('reveal',{side:item.side,card:item.card.name,lane:item.li});render();popCard(item.card.uid);await wait(260);}
    resolveTypeClashes();render();await wait(260);resolveEndRound();render();
    if(game.round===5)game.round5Total=[totalPower(0),totalPower(1)];
    game.players.forEach(p=>{p.queued=[];p.playedIdsThisRound.clear();});
    if(game.round>=6){finishGame();return;}
    game.round++;game.firstPriority=1-game.firstPriority;updateDistrictReveal();for(const p of game.players){p.hype=game.round;if(p.deck.length&&p.hand.length<7)p.hand.push(p.deck.shift());}
    game.resolving=false;render();toast(`ROUND ${game.round}`);
  }

  function finishGame(forcedWinner=null){const wins=laneWins(),tp=[totalPower(0),totalPower(1)];let winner=forcedWinner;if(winner===null){if(wins[0]>wins[1])winner=0;else if(wins[1]>wins[0])winner=1;else if(tp[0]>tp[1])winner=0;else if(tp[1]>tp[0])winner=1;}
    if(game.round5Total){game.players[0].metrics.round6Swing=tp[0]-game.round5Total[0];game.players[1].metrics.round6Swing=tp[1]-game.round5Total[1];}
    game.resolving=false;game.finishedAt=Date.now();game.winner=winner;game.finalScores=[0,1,2].map(i=>[laneScore(i,0),laneScore(i,1)]);game.finalPower=tp;game.finalWins=wins;saveLog();
    els.resultMark.textContent=winner===0?'W':winner===1?'L':'T';els.resultTitle.textContent=winner===0?'YOU WON THE ROOM':winner===1?'THE OPPS GOT IT':'DEAD EVEN';els.resultSummary.textContent=`${game.decks[game.players[0].deckId].short} ${wins[0]} districts · ${game.decks[game.players[1].deckId].short} ${wins[1]} · Clout ×${game.clout}`;
    els.resultScores.innerHTML=game.finalScores.map((s,i)=>`<div><small>${game.lanes[i].district.name}</small><b>${s[0]} — ${s[1]}</b></div>`).join('');els.result.classList.add('open');
  }

  function logEvent(type,data={}){game?.events.push({round:game.round,type,...data});}
  function saveLog(){
    const log={version:'0.3-playtest',build:BUILDS[game.build].name,seed:game.seed,theme:config.theme,playerDeck:game.decks[game.players[0].deckId].name,rivalDeck:game.decks[game.players[1].deckId].name,winner:game.winner,clout:game.clout,locations:game.lanes.map(l=>l.district.name),scores:game.finalScores,totalPower:game.finalPower,districtWins:game.finalWins,durationSec:Math.round((game.finishedAt-game.startedAt)/1000),metrics:game.players.map(p=>p.metrics),events:game.events,feedback:null,timestamp:new Date().toISOString()};
    const logs=JSON.parse(storageGet('sq-playtest-logs','[]')||'[]');logs.push(log);storageSet('sq-playtest-logs',JSON.stringify(logs.slice(-100)));game.logIndex=logs.length-1;
  }
  function setFeedback(value){game.feedback=value;[...els.feedbackGrid.querySelectorAll('button')].forEach(b=>b.classList.toggle('active',b.dataset.feedback===value));const logs=JSON.parse(storageGet('sq-playtest-logs','[]')||'[]');if(logs.length){logs[logs.length-1].feedback=value;storageSet('sq-playtest-logs',JSON.stringify(logs));}}
  function exportLogs(){const logs=storageGet('sq-playtest-logs','[]')||'[]';const blob=new Blob([logs],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`squabblemon-playtest-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}

  function cardHTML(card,{hand=false,queued=false,known=false,boardSelected=false}={}){
    const type=TYPE_COLORS[card.type]||'#ddd',statuses=[];if(card.poison)statuses.push('POISON');if(game&&game.round<=card.frozenUntil)statuses.push('FROZEN');if(game&&isSilenced(card))statuses.push('SILENCED');const image=spriteFor(card);
    return `<div class="card ${hand?'hand-card':''} ${queued?'queued':''} ${known?'known':''} ${boardSelected?'selected-board':''}" data-uid="${card.uid}" style="--type:${type}">${image?`<img src="${image}" alt="${card.name}" draggable="false">`:''}<div class="type-stripe"></div><div class="cost">${card.cost}</div><div class="power">${card.power}</div>${statuses.length?`<div class="card-status">${statuses.map(s=>`<span>${s}</span>`).join('')}</div>`:''}<div class="card-name">${card.name}</div></div>`;
  }
  function render(){if(!game)return;els.round.textContent=`${game.round} / 6`;els.hype.textContent=game.players[0].hype;els.clout.textContent=`×${game.clout}`;els.deckLeft.textContent=`${game.players[0].deck.length} LEFT`;
    renderLanes();renderHand();els.squabble.classList.toggle('used',game.squabbled);els.squabble.disabled=game.squabbled||game.round<3||game.resolving;els.lock.disabled=game.resolving;els.lock.classList.toggle('ready',game.players[0].queued.length>0);els.lockSub.textContent=game.players[0].queued.length?`${game.players[0].queued.length} QUEUED`:'PASS ROUND';
    if(game.selectedBoard)els.hint.textContent='TAP A DISTRICT TO MOVE BIKELIFE';else if(game.selectedHand)els.hint.textContent='TAP A DISTRICT · TAP SELECTED CARD AGAIN TO INSPECT';else els.hint.textContent='SELECT A CARD, THEN TAP A DISTRICT';
  }
  function renderLanes(){els.lanes.innerHTML=game.lanes.map((lane,li)=>{const ps=laneScore(li,0),es=laneScore(li,1),selectable=game.selectedHand&&canQueue(0,game.selectedHand,li),moveTarget=game.selectedBoard&&cardPos(game.selectedBoard)?.laneIndex!==li&&game.lanes[li].cards[0].length<4&&game.round>game.lanes[li].moveLockUntil[0];
      const eCards=lane.cards[1].map(c=>cardHTML(c,{queued:!c.revealed,known:c.knownToPlayer})).join(''),pCards=lane.cards[0].map(c=>cardHTML(c,{queued:!c.revealed,boardSelected:game.selectedBoard===c})).join('');
      return `<div class="lane ${selectable?'selectable':''} ${moveTarget?'move-target':''}" data-lane="${li}"><div class="field enemy-field">${eCards}</div><div class="location ${lane.revealed?'':'locked'}"><div class="location-index">DISTRICT 0${li+1}</div><div class="location-name">${lane.revealed?lane.district.name:'CLASSIFIED'}</div><div class="location-rule">${lane.revealed?lane.district.rule:'REVEALS ROUND '+(li+1)}</div><div class="score-line"><span class="score ${ps>es?'winning':''}">${ps}</span><i>VS</i><span class="score enemy ${es>ps?'winning':''}">${es}</span></div></div><div class="field player-field">${pCards}</div></div>`;
    }).join('');
    els.lanes.querySelectorAll('.lane').forEach(el=>el.addEventListener('click',e=>{const cardEl=e.target.closest('.card');if(cardEl)return;const li=Number(el.dataset.lane);if(game.selectedBoard){playerMoveBikelife(game.selectedBoard,li);return;}if(game.selectedHand&&queueCard(0,game.selectedHand,li)){game.selectedHand=null;render();}}));
    els.lanes.querySelectorAll('.player-field .card').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const c=findCard(el.dataset.uid);if(!c)return;if(!c.revealed){unqueuePlayer(c);return;}if(hasActiveEffect(c,'rideOut')&&c.lastMoveRound!==game.round&&c.moveBuffs<3){game.selectedBoard=game.selectedBoard===c?null:c;game.selectedHand=null;render();}else inspectCard(c);}));
    els.lanes.querySelectorAll('.enemy-field .card').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const c=findCard(el.dataset.uid);if(c&&(c.revealed||c.knownToPlayer))inspectCard(c);}));
  }
  function renderHand(){const p=game.players[0];els.hand.innerHTML=p.hand.map(c=>{const affordable=[0,1,2].some(li=>canQueue(0,c,li));return cardHTML(c,{hand:true}).replace('hand-card"',`hand-card ${game.selectedHand===c?'selected':''} ${affordable?'':'unaffordable'}"`);}).join('');els.hand.querySelectorAll('.hand-card').forEach(el=>{let press=null;el.addEventListener('pointerdown',()=>{press=setTimeout(()=>{const c=findCard(el.dataset.uid);inspectCard(c);press=null;},520)});['pointerup','pointerleave','pointercancel'].forEach(ev=>el.addEventListener(ev,()=>{if(press){clearTimeout(press);press=null;}}));el.addEventListener('click',()=>{const c=findCard(el.dataset.uid);if(!c)return;if(game.selectedHand===c){inspectCard(c);return;}game.selectedHand=c;game.selectedBoard=null;render();});});}
  function findCard(id){if(!game)return null;for(const p of game.players){const x=[...p.hand,...p.deck,...p.queued.map(q=>q.card)].find(c=>c.uid===id);if(x)return x;}for(const l of game.lanes)for(const side of [0,1]){const x=l.cards[side].find(c=>c.uid===id);if(x)return x;}return null;}
  function popCard(id){const el=document.querySelector(`[data-uid="${CSS.escape(id)}"]`);if(el){el.classList.add('pop');setTimeout(()=>el.classList.remove('pop'),600);}}
  function toast(text){els.toast.textContent=text;els.toast.classList.remove('show');void els.toast.offsetWidth;els.toast.classList.add('show');}
  function wait(ms){return new Promise(r=>setTimeout(r,ms));}

  function inspectCard(c){if(!c)return;const mon=nameToMon[c.name];const color=TYPE_COLORS[c.type]||'#ddd';els.inspectSheet.innerHTML=`<button class="x" data-close="inspectOverlay">×</button><div class="sheet-eyebrow">${c.archetype.toUpperCase()} // ${c.keywords.join(' · ')||'NO KEYWORD'}</div><div class="inspect-layout"><div class="inspect-card">${cardHTML(c)}</div><div class="inspect-info"><h3>${c.name}</h3><span class="pill type" style="--type:${color}">${c.type}</span><span class="pill">${c.cost} HYPE</span><span class="pill">${c.basePower} BASE POWER</span><span class="pill">SPD ${c.speed}</span><p>${mon?.lore||''}</p></div></div><div class="ability-box"><small>${isSilenced(c)?'SILENCED // PRINTED ABILITY':'ABILITY'}</small><strong>${c.copiedAbilityName||c.abilityName}</strong><p>${c.effectText}</p></div>`;els.inspectOverlay.classList.add('open');bindCloseButtons();}

  function buildLobby(){
    els.build.innerHTML=Object.values(BUILDS).map(b=>`<option value="${b.id}">${b.name}</option>`).join('');els.build.value=config.build;els.buildNote.textContent=BUILDS[config.build].note;
    els.deckGrid.innerHTML=Object.values(BASE_DECKS).map((d,i)=>`<button class="deck-choice ${d.id===config.playerDeck?'active':''}" data-deck="${d.id}" style="--deck-accent:${['#8b263d','#77b7dd','#d9c04a','#a583c9','#f0774f','#93c76c','#d7ff46'][i]}"><strong>${d.name}</strong><span>${d.archetype.toUpperCase()}</span><em>${d.accent}</em></button>`).join('');
    els.rival.innerHTML=`<option value="random">RANDOM STARTER</option>`+Object.values(BASE_DECKS).map(d=>`<option value="${d.id}">${d.name}</option>`).join('');els.rival.value=config.rivalDeck;updateStartMeta();
    els.deckGrid.querySelectorAll('.deck-choice').forEach(b=>b.addEventListener('click',()=>{config.playerDeck=b.dataset.deck;els.deckGrid.querySelectorAll('.deck-choice').forEach(x=>x.classList.toggle('active',x===b));updateStartMeta();}));
  }
  function updateStartMeta(){els.startMeta.textContent=`${BUILDS[config.build].short} // ${BASE_DECKS[config.playerDeck].short}`;}
  function openDeckOverlay(){const {cards,decks}=getBuildData(config.build),d=decks[config.playerDeck];els.deckOverlayTitle.textContent=d.name;els.deckOverlayPlan.textContent=d.plan;els.fullDeck.innerHTML=d.cards.map(id=>{const c=makeCard(cards[id],0,id);return cardHTML(c);}).join('');els.deckOverlay.classList.add('open');els.fullDeck.querySelectorAll('.card').forEach((el,i)=>el.addEventListener('click',()=>{const c=makeCard(cards[d.cards[i]],0,i);inspectCard(c);}));}
  function bindCloseButtons(){document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).classList.remove('open'));}
  function callSquabble(){if(!game||game.squabbled||game.round<3)return;const diff=totalPower(0)-totalPower(1),cpuAccept=Math.random()<(diff<4?.82:.58);game.squabbled=true;if(cpuAccept){game.clout*=2;toast('THE OPPS STOOD ON IT · CLOUT ×2');}else{toast('THE OPPS DUCKED · YOU TAKE THE ROOM');game.clout*=1;game.players[1].metrics.passRounds++;setTimeout(()=>finishGame(0),700);}render();}

  els.build.addEventListener('change',()=>{config.build=els.build.value;els.buildNote.textContent=BUILDS[config.build].note;updateStartMeta();});
  els.rival.addEventListener('change',()=>config.rivalDeck=els.rival.value);
  els.themeToggle.addEventListener('click',e=>{const b=e.target.closest('button[data-theme]');if(!b)return;config.theme=b.dataset.theme;document.body.dataset.theme=config.theme;els.phone.dataset.cardTheme=config.theme;els.themeToggle.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));storageSet('sq-theme',config.theme);});
  els.start.addEventListener('click',()=>startGame());els.viewDeck.addEventListener('click',openDeckOverlay);els.export.addEventListener('click',exportLogs);els.lock.addEventListener('click',lockIn);els.squabble.addEventListener('click',callSquabble);els.rematch.addEventListener('click',()=>{els.result.classList.remove('open');startGame(true);});els.lobbyBtn.addEventListener('click',()=>{els.result.classList.remove('open');els.battle.classList.remove('active');els.lobby.classList.add('active');});els.feedbackGrid.addEventListener('click',e=>{const b=e.target.closest('button[data-feedback]');if(b)setFeedback(b.dataset.feedback);});
  [els.deckOverlay,els.inspectOverlay].forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

  config.theme=storageGet('sq-theme','concrete')||'concrete';document.body.dataset.theme=config.theme;els.phone.dataset.cardTheme=config.theme;[...els.themeToggle.querySelectorAll('button')].forEach(x=>x.classList.toggle('active',x.dataset.theme===config.theme));
  buildLobby();bindCloseButtons();
})();
