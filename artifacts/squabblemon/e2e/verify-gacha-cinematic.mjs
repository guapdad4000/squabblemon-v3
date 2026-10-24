import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {settledEntrance} from './gacha-reveal-checks.mjs';
const origin=process.env.UI_ORIGIN??'http://127.0.0.1:4245';
const output=process.env.GACHA_OUTPUT??'/tmp/gacha-cinematic';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/home/falcon/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const report=[];
const rarityOrder=['SuperCommon','Common','Uncommon','Rare','Epic','Legendary','Mythical'];
function receiptRarity(rewards){return rewards.reduce((best,reward)=>rarityOrder.indexOf(reward.rarity)>rarityOrder.indexOf(best)?reward.rarity:best,null)??'Common';}
function receiptRevealOrder(saved){
 if(saved.pullCount!==10)return saved.rewards;
 let highest=-1,rank=rarityOrder.indexOf('Uncommon');
 saved.rewards.forEach((reward,index)=>{const next=rarityOrder.indexOf(reward.rarity);if(next>rank){highest=index;rank=next;}});
 return highest<0?saved.rewards:[...saved.rewards.filter((_,index)=>index!==highest),saved.rewards[highest]];
}
async function readyArt(scope){await scope.locator('img:visible').evaluateAll(async images=>{await Promise.race([Promise.all(images.map(image=>image.decode())),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Visible card image decode timed out')),10000))]);});}
try {
  const cases=[['desktop',{width:1440,height:1000},1],['desktop-ten',{width:1440,height:1000},10],['phone',{width:390,height:844},1],['scene-loss',{width:1440,height:1000},1],['skip-flight',{width:390,height:844},1],['scene-loss-flight',{width:1440,height:1000},1]];
  const caseFilter=process.env.GACHA_CASE;
  const entryDiagnostics=process.env.GACHA_ENTRY_DIAGNOSTICS==='1';
  assert.ok(!caseFilter||cases.some(([label])=>label===caseFilter),`Unknown GACHA_CASE: ${caseFilter}`);
  for(const [label,viewport,count] of cases.filter(([label])=>!caseFilter||label===caseFilter)) {
    const sceneLoss=label==='scene-loss',flightSkip=label==='skip-flight',flightLoss=label==='scene-loss-flight';
    const interrupted=flightSkip||flightLoss,summaryOnly=sceneLoss||flightLoss;
    const context=await browser.newContext({viewport,recordVideo:{dir:output,size:viewport}});
    const page=await context.newPage(),mediaRequests=new Set(),imageRequests=[];page.on('request',request=>{if(request.resourceType()==='image')imageRequests.push({url:request.url(),at:Date.now()});if(request.url().includes('/brand/gacha/'))mediaRequests.add(request.url().split('/').pop());});await page.routeWebSocket('**',socket=>socket.close());const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
    await page.route('**/scenes/gym/scene.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+`\nwindow.__gachaLaunchRead=()=>({z:heavyBagMesh.position.z-(finale?.origin.z??0),scale:heavyBagMesh.scale.x,visible:heavyBagMesh.visible,renders:renderer.info.render.frame});`});});
    await page.route('**/scenes/shared/gpu-quality.js',r=>r.fulfill({contentType:'text/javascript',body:'const q={tier:"low",pixelRatio:1,shadows:false,outlines:false,particleDensity:.35,fps:30};export async function detectGPUQuality(){return q};export function gpuQuality(){return q}'}));
    await page.addInitScript(enabled=>{window.__captureEntryDiagnostics=enabled;localStorage.setItem('squabblemon_battle_speed','1.5');localStorage.setItem('squabblemon_battle_feedback',JSON.stringify({audioEnabled:false,hapticsEnabled:false}));window.__sceneEvents=[];window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.channel==='squabblemon-scene')window.__sceneEvents.push({at:performance.now(),...event.data});});},entryDiagnostics);
    // Observe mutations before the final punch. attributeOldValue retains a
    // short cel even when a busy software renderer batches observer delivery.
    await page.addInitScript(()=>{
      performance.setResourceTimingBufferSize(1500);window.__firstRevealState=null;window.__revealModalAt=null;window.__finaleStages=[];window.__finaleMounts=0;window.__flightSamples=[];window.__landingSamples=[];window.__entranceEvents=[];window.__entryFrames=[];window.__obsoleteWallSeen=false;window.__packJournalWrites=[];
      for(const type of['animationstart','animationend'])document.addEventListener(type,event=>{
        if(event.animationName!=='gacha-card-arrival'||!event.target.closest('.gacha-reveal'))return;
        const reward=document.querySelector('#gym-results-title')?.textContent;
        window.__entranceEvents.push({type,at:performance.now(),elapsed:event.elapsedTime,reward});
        if(type!=='animationstart'||!window.__captureEntryDiagnostics)return;
        const target=event.target,flip=target.closest('.gacha-reveal__flip'),start=performance.now(),thresholds=[0,100,200,300,400,500,650,960],rafTimes=[];
        const capture=(threshold,now)=>{
          const nodes=[target,...flip.querySelectorAll('.gacha-reward-print,.collectible-print,.collector-card,.collector-portrait')];
          window.__entryFrames.push({reward,threshold,elapsed:now-start,rafTimes:[...rafTimes],nodes:nodes.map(node=>{const style=getComputedStyle(node),box=node.getBoundingClientRect();return{className:node.className,opacity:style.opacity,transform:style.transform,display:style.display,visibility:style.visibility,backface:style.backfaceVisibility,overflow:style.overflow,width:box.width,height:box.height,left:box.left,top:box.top,decoded:node instanceof HTMLImageElement?node.complete&&node.naturalWidth>0:undefined,animations:node.getAnimations().map(animation=>({name:animation.animationName,currentTime:animation.currentTime,state:animation.playState}))};})});
        };
        const sample=now=>{rafTimes.push(now-start);while(thresholds.length&&now-start>=thresholds[0])capture(thresholds.shift(),now);if(thresholds.length&&target.isConnected)requestAnimationFrame(sample);};requestAnimationFrame(sample);
      });
      const setItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(this===sessionStorage&&/^squabblemon:pack-(request|reveal):e2e-player$/.test(key))window.__packJournalWrites.push({key,value});
        return setItem.call(this,key,value);
      };
      const mounted=new WeakSet();let lastStage=null;
      const record=(node,stage,via)=>{
        if(!node||!stage||stage==='armed'||node.dataset.active!=='true')return;
        if(!mounted.has(node)){mounted.add(node);window.__finaleMounts++;lastStage=null;}
        if(stage===lastStage)return;lastStage=stage;
        window.__finaleStages.push({stage,via,at:performance.now(),rarity:node.dataset.rarity,speed:node.style.getPropertyValue('--finale-speed'),arrival:node.querySelector('.pack-gym-finale__distance img')?.getAttribute('src')});
        if(stage==='impact')for(const delay of[0,140])setTimeout(()=>{
          if(!node.isConnected||node.dataset.stage!=='impact')return;
          const opacity=selector=>Number(getComputedStyle(node.querySelector(selector)).opacity);
          window.__landingSamples.push({delay,at:performance.now(),landing:opacity('[data-film=landing]'),pov:opacity('[data-film=pov]'),punchCels:[...node.querySelectorAll('.pack-gym-finale__beat')].map(layer=>Number(getComputedStyle(layer).opacity)),oldWall:Boolean(node.querySelector('.pack-gym-finale__wall,img[src*="wall-impact.webp"]'))});
        },delay);
        if(stage==='flight')for(const delay of[200,600])setTimeout(()=>{
          if(!node.isConnected||node.dataset.stage!=='flight')return;
          const backdrop=getComputedStyle(node),scene=document.querySelector('iframe[src*="/scenes/gym/"]');
          const sceneStyle=scene&&getComputedStyle(scene),rect=scene?.getBoundingClientRect();
          const art=[...node.querySelectorAll('.pack-gym-finale__beat,.pack-gym-finale__film,.pack-gym-finale__distance,.pack-gym-finale__foreground')].map(layer=>{
            const style=getComputedStyle(layer);return{className:layer.className,opacity:Number(style.opacity),display:style.display,visibility:style.visibility};
          });
          window.__flightSamples.push({delay,at:performance.now(),background:backdrop.backgroundColor,backgroundImage:backdrop.backgroundImage,art,
            mesh:scene?.contentWindow?.__gachaLaunchRead?.(),sceneVisible:Boolean(sceneStyle&&sceneStyle.display!=='none'&&sceneStyle.visibility!=='hidden'&&Number(sceneStyle.opacity)>0&&rect?.width>0&&rect?.height>0)});
        },delay);
      };
      new MutationObserver(records=>{
        const reveal=document.querySelector('.gacha-reveal');
        if(window.__revealModalAt===null&&document.querySelector('.gacha-reveal-dialog:modal'))window.__revealModalAt=performance.now();
        if(reveal&&!window.__firstRevealState)window.__firstRevealState={at:performance.now(),images:[...reveal.querySelectorAll('img')].map(image=>({src:image.currentSrc||image.src,complete:image.complete,naturalWidth:image.naturalWidth}))};
        if(document.querySelector('.pack-gym-finale__wall,img[src*="wall-impact.webp"]'))window.__obsoleteWallSeen=true;
        for(const mutation of records)if(mutation.type==='attributes'&&mutation.attributeName==='data-stage'&&mutation.target.matches('.pack-gym-finale'))record(mutation.target,mutation.oldValue,'previous-state');
        const current=document.querySelector('.pack-gym-finale');record(current,current?.dataset.stage,'current-state');
      }).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-stage','data-active'],attributeOldValue:true});
    });
    console.log(label,'loading');
    await page.goto(`${origin}/e2e/gacha-cinematic.fixture.html`,{waitUntil:'domcontentloaded'});
    await expect(page.locator('.venue-scene.is-ready')).toBeVisible({timeout:30000});
    if(count===10)await page.getByRole('button',{name:'10 PULL',exact:true}).click();
    await page.getByRole('button',{name:count===10?'Open 10× · 10 tickets':'Open · 1 ticket',exact:true}).click();
    await expect(page.locator('.pack-gym-controls__strike')).toBeVisible();
    await expect(page.locator('.fight-bill')).toBeHidden();
    await expect(page.locator('.pack-gym-finale[data-active=false]')).toHaveAttribute('data-stage','armed');
    assert.deepEqual(await page.evaluate(()=>window.__finaleStages),[],'Prepared artwork stays inert until the final accepted punch');
    const savedBefore=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('squabblemon:pack-reveal:e2e-player')));
    assert.equal(savedBefore.rewards.length,count*6,'The complete receipt exists before any punch');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('squabblemon:pack-request:e2e-player')),null,'Confirmed receipt clears the pending intent');
    const highest=receiptRarity(savedBefore.rewards),ordered=receiptRevealOrder(savedBefore);
    const writesBefore=await page.evaluate(()=>window.__packJournalWrites);
    assert.deepEqual(writesBefore.map(write=>write.key),['squabblemon:pack-request:e2e-player','squabblemon:pack-reveal:e2e-player'],'One request and one issued receipt precede the animation');
    await expect(page.locator('.gacha-stage')).toHaveAttribute('data-omen',highest.toLowerCase());

    await expect(page.getByRole('button',{name:/Mute gym sound|Enable gym sound/})).toHaveCount(0);
    await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,3000))]));
    await page.waitForTimeout(300);
    const room=await page.locator('.gym__arena').boundingBox(), stage=await page.locator('.gacha-stage').boundingBox();
    assert.ok(room&&stage);assert.ok(Math.abs(room.height-stage.height)<2,'The gym must fill the purchased stage');assert.ok(Math.abs(room.width-stage.width)<2,'The gym must use the full stage width');
    await page.screenshot({path:`${output}/${label}-armed.png`});
    for(let hit=1;hit<=(sceneLoss?1:3);hit++){
      await page.locator('.pack-gym-controls__strike').click();
      await page.waitForFunction(n=>window.__sceneEvents.filter(e=>e.type==='hit').length>=n,hit);
      if(hit<3)await page.waitForTimeout(320);
    }
    if(sceneLoss){
      const scene=page.frames().find(frame=>frame.url().includes('/scenes/gym/'));
      assert.ok(scene);
      await scene.evaluate(()=>parent.postMessage({channel:'squabblemon-scene',type:'error'},location.origin));
    }else{
      await expect(page.locator('.pack-gym-finale[data-active=true]')).toBeVisible();
      if(interrupted){
        await expect(page.locator('.pack-gym-finale[data-active=true]')).toHaveAttribute('data-stage','flight');
        await page.waitForTimeout(80);
        if(flightSkip)await page.getByRole('button',{name:'Skip pack animation',exact:true}).click();
        else{
          const scene=page.frames().find(frame=>frame.url().includes('/scenes/gym/'));assert.ok(scene);
          await scene.evaluate(()=>parent.postMessage({channel:'squabblemon-scene',type:'error'},location.origin));
        }
      }
    }
    await expect(page.locator('dialog.gacha-reveal-dialog[open]')).toBeVisible({timeout:8000});
    await expect(page.locator('.pack-gym-finale')).toHaveCount(0);
    if(interrupted){
      await expect(page.locator('.gacha-stage')).toHaveAttribute('data-phase',summaryOnly?'summary':'reveal');
      // Cross the original completion deadline: a stale timer must not reopen,
      // replace, or strand the receipt after the intentional early exit.
      const remainder=await page.evaluate(end=>Math.max(0,end+400-(performance.now()-window.__finaleStages[0].at)),5317);
      await page.waitForTimeout(remainder);
      await expect(page.locator('dialog.gacha-reveal-dialog[open]')).toHaveCount(1);
      await expect(page.locator('.pack-gym-finale')).toHaveCount(0);
      await expect(page.locator('.gacha-stage')).toHaveAttribute('data-phase',summaryOnly?'summary':'reveal');
    }
    const events=await page.evaluate(()=>window.__sceneEvents.filter(e=>e.type==='hit'||e.type==='complete'));
    assert.equal(events.filter(e=>e.type==='hit').length,sceneLoss?1:3);assert.equal(events.filter(e=>e.type==='complete').length,sceneLoss?0:1);
    const finale=await page.evaluate(()=>({mounts:window.__finaleMounts,revealAt:window.__revealModalAt,stages:window.__finaleStages,flightSamples:window.__flightSamples,landingSamples:window.__landingSamples,obsoleteWallSeen:window.__obsoleteWallSeen}));
    await writeFile(`${output}/${label}-stages.json`,JSON.stringify({label,viewport,highest,...finale},null,2));
    assert.equal(finale.obsoleteWallSeen,false,'No removed side-view wall cel is mounted during any beat');
    assert.ok(!mediaRequests.has('wall-impact.webp'),'The removed wall cel is never preloaded or requested');
    if(!sceneLoss){
      assert.equal(finale.mounts,1,'One cinematic follows the one accepted completion');
      const stages=finale.stages.map(event=>event.stage);
      const expected=interrupted?['compression','contact','release','flight']:['compression','contact','release','flight','flight-pov','impact'];
      assert.deepEqual(stages.filter(stage=>stage!=='done'&&(!interrupted?stage!=='settle':true)),expected,'Every cel/flight/landing stage appears in order; completion has no required painted settle hold');
      if(stages.includes('settle'))assert.equal(stages.filter(stage=>stage!=='done').at(-1),'settle');
      assert.ok(finale.stages.every(event=>event.rarity===highest),'Every cinematic stage uses the saved receipt omen');
      assert.ok(finale.stages.every(event=>event.speed==='1'),'The cinema stays at 1x despite the saved 1.5x battle speed');
      assert.equal(await page.evaluate(()=>localStorage.getItem('squabblemon_battle_speed')),'1.5','Opening a pack does not overwrite the player battle preference');
      if(!interrupted){
        const stageAt=name=>finale.stages.find(event=>event.stage===name).at;
        const meshDuration=stageAt('flight-pov')-stageAt('flight');
        assert.ok(meshDuration>=750&&meshDuration<=1100,`Actual mesh flight keeps its new 900ms pace (measured ${meshDuration}ms)`);
        assert.ok(stageAt('impact')-stageAt('flight-pov')>=1000,'POV travel breathes for at least 1.0s at 1x');
        assert.ok(finale.revealAt-stageAt('compression')>=5100,'The complete impact sequence cannot collapse back into a slideshow');
        assert.ok(finale.revealAt-stageAt('impact')>=2500,'The shared landing retains its natural 2.667s duration');
        assert.equal(finale.landingSamples.length,2,'The direct landing handoff and former 120ms flash interval were sampled');
        for(const sample of finale.landingSamples){assert.equal(sample.landing,1);assert.equal(sample.pov,0);assert.equal(sample.oldWall,false);assert.ok(sample.punchCels.every(opacity=>opacity===0),'Opening punch cels never flash over the landing movie');}
        assert.equal(finale.flightSamples.length,2,'Two sustained live-flight samples were observed');
        const distance={SuperCommon:16,Common:20,Uncommon:23,Rare:26,Epic:30,Legendary:34,Mythical:38}[highest];
        const [early,late]=finale.flightSamples.map(sample=>sample.mesh);
        assert.ok(early?.visible&&late?.visible,'The actual mesh remains visible throughout launch');
        assert.ok(-early.z/distance>.15,'The actual bag departs promptly within the first200ms');
        assert.ok(-late.z/distance>.48&&-late.z/distance<.80,'The bag covers most of its visible departure before the POV');
        assert.ok(late.z<early.z-distance*.20&&late.scale<early.scale&&late.renders>early.renders,'The real rendered bag travels away and shrinks during the shorter flight');
        for(const sample of finale.flightSamples){
          assert.equal(sample.background,'rgba(0, 0, 0, 0)','The live mesh is not covered by an opaque finale root');
          assert.equal(sample.backgroundImage,'none');assert.ok(sample.sceneVisible,'The actual gym iframe remains visible during mesh flight');
          assert.ok(sample.art.length>=6);assert.ok(sample.art.every(layer=>layer.display==='none'||layer.visibility==='hidden'||layer.opacity<=.001),'No opaque impact/POV/arrival still covers the actual 3D flight');
        }
      }
      if(!summaryOnly){
        await expect(page.locator('.gacha-reveal__caption h3')).toHaveText(ordered[0].name);
        await expect(page.locator('.gacha-reveal')).toHaveAttribute('data-rarity',ordered[0].rarity.toLowerCase());
        const arrival=await page.locator('.gacha-reveal__arena').getAttribute('src');
        assert.equal(arrival,finale.stages.at(-1).arrival,'The cinematic hands its exact arena still to the reveal');
      }
    }else assert.equal(finale.mounts,0,'Scene failure exposes the saved haul directly');
    let firstEntrance=null,nextEntrance=null;
    if(!summaryOnly){
      firstEntrance=await settledEntrance(page.locator('.gacha-reveal__flip'),{contain:true});
      assert.ok(firstEntrance.width>=(viewport.width>=1400?350:280),'The settled card remains large and readable');
      await page.waitForTimeout(250);
    }
    const firstPrintWarmup=await page.evaluate(async rewards=>{
      // This module already belongs to Shop's loaded graph. Reading its exact
      // URL list does not warm or decode another image, or delay the cinematic.
      const {packRewardArtworkSources}=await import('/src/lib/packRewardArtwork.ts');
      const reveal=window.__firstRevealState;
      return{timeOrigin:performance.timeOrigin,reveal,resources:packRewardArtworkSources(rewards).map(source=>{
        const url=new URL(source,location.href).href;
        const entries=performance.getEntriesByName(url,'resource');
        const entry=entries.find(entry=>entry.startTime<reveal.at)??entries[0];
        return{url,kind:/collector-v2|card-wordmark|card-name-tag/.test(url)?'print':'portrait',startTime:entry?.startTime??null,responseEnd:entry?.responseEnd??null,beforeReveal:Boolean(entry&&entry.startTime<reveal.at)};
      })};
    },savedBefore.rewards);
    assert.ok(firstPrintWarmup.resources.some(resource=>resource.kind==='print'),'The first printed faces include authored print layers');
    firstPrintWarmup.imageRequests=imageRequests.map(request=>({...request,relativeAt:request.at-firstPrintWarmup.timeOrigin,beforeReveal:request.at<firstPrintWarmup.timeOrigin+firstPrintWarmup.reveal.at}));
    // ResourceTiming is observational: inline/cache/module-backed resources may
    // lack an entry. Never turn nonblocking warming into a presentation gate.
    await writeFile(`${output}/${label}-art-warmup.json`,JSON.stringify(firstPrintWarmup,null,2));
    await readyArt(page.locator('.gacha-reveal'));
    await page.screenshot({path:`${output}/${label}-reveal.png`});
    const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('squabblemon:pack-reveal:e2e-player')));
    assert.deepEqual(saved,savedBefore,'Cinematics and reveal do not reorder or mutate the stored receipt');
    assert.deepEqual(await page.evaluate(()=>window.__packJournalWrites),writesBefore,'Presentation, skip, or scene failure must not reserve or issue another opening');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('squabblemon:pack-request:e2e-player')),null);
    if(!summaryOnly){
      await page.getByRole('button',{name:'Next card',exact:true}).click();
      const characterIntro=page.getByRole('button',{name:'Show my card · Skip intro',exact:true});
      assert.equal(await characterIntro.count(),0,'A newly owned styled character shows its real print immediately, without a three-second intro or Skip action');
      assert.equal(await page.locator('.gacha-reveal__flip .gacha-reward-print').count(),1,'Next exposes the actual issued card on the same transition');
      await expect(page.locator('.gacha-reveal__flip')).toHaveCount(1);await expect(page.locator('.gacha-reveal__caption')).toHaveCount(1);
      nextEntrance=await settledEntrance(page.locator('.gacha-reveal__flip'));
      // WAAPI finished state precedes dispatch of the matching DOM event.
      // Await the exact events rather than sampling that separate queue early.
      await expect.poll(()=>page.evaluate(()=>window.__entranceEvents.filter(event=>event.type==='animationend').map(event=>event.reward)),{timeout:4000}).toEqual([`1 / ${count*6}`,`2 / ${count*6}`]);
      const naturalEntries=await page.evaluate(()=>window.__entranceEvents);
      assert.deepEqual(naturalEntries.filter(event=>event.type==='animationstart').map(event=>event.reward),[`1 / ${count*6}`,`2 / ${count*6}`],'Each real card starts a separate entrance');
      assert.deepEqual(naturalEntries.filter(event=>event.type==='animationend').map(event=>event.reward),[`1 / ${count*6}`,`2 / ${count*6}`],'Each real card entrance finishes without a lingering effect');
      assert.ok(nextEntrance.animations.some(animation=>animation.name==='gacha-card-arrival'),'The next issued card replays its finite entrance');
      await expect(page.locator('.gacha-reveal__caption h3')).toHaveText(ordered[1].name);
      await expect(page.locator('.gacha-reveal')).toHaveAttribute('data-rarity',ordered[1].rarity.toLowerCase());
      await page.getByRole('button',{name:`View all ${count*6}`,exact:true}).click();
    }
    await expect(page.locator('.gacha-reveal__item')).toHaveCount(count*5);
    await expect(page.locator('.gacha-reveal__resources > button')).toHaveCount(count);
    await expect(page.locator('.gacha-reveal__guarantee')).toHaveCount(count===10?1:0);
    if(count===10){
      const headliner=page.locator('.gacha-reveal__item').filter({has:page.locator('.gacha-reveal__guarantee')});
      await expect(headliner).toHaveAttribute('aria-label',`Inspect ${ordered.at(-1).name}`);
      assert.equal(await page.locator('.gacha-reveal__item').last().getAttribute('aria-label'),`Inspect ${ordered.at(-1).name}`);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await readyArt(page.locator('.gacha-reveal'));
    await page.screenshot({path:`${output}/${label}-haul.png`});
    const entranceEvents=await page.evaluate(()=>window.__entranceEvents);
    const entryFrames=await page.evaluate(()=>window.__entryFrames);
    if(entryDiagnostics)await writeFile(`${output}/${label}-entry-diagnostics.json`,JSON.stringify({entranceEvents,entryFrames},null,2));
    await page.reload();
    await expect(page.locator('dialog.gacha-reveal-dialog[open]')).toBeVisible();
    assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('squabblemon:pack-reveal:e2e-player'))),saved,'Refresh resumes the exact receipt, including resource values and order');
    assert.deepEqual(await page.evaluate(()=>window.__packJournalWrites),[],'Receipt recovery never creates another payment intent or receipt');
    await page.getByRole('button',{name:'Close rewards',exact:true}).click();
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('squabblemon:pack-reveal:e2e-player')),null);
    assert.deepEqual(errors,[]);
    report.push({label,viewport,pullCount:count,threeAcceptedPunches:!sceneLoss,oneCompletion:!sceneLoss,sceneLossFallsBackToSavedHaul:sceneLoss||flightLoss,skippedDuringFlight:flightSkip,sceneLostDuringFlight:flightLoss,noLateTransitionAfterInterruption:interrupted,singleJournalIssue:true,savedRewardCount:saved.rewards.length,receiptRarity:highest,battleSpeedPreference:1.5,cinematicSpeed:1,finaleStages:finale.stages,liveFlightSamples:finale.flightSamples,directLandingSamples:finale.landingSamples,noRemovedWallCel:true,exactReceiptPreserved:true,firstAndNextCaption:!summaryOnly,firstEntrance,nextEntrance,entranceEvents,firstPrintWarmup,newStyledCardImmediate:!summaryOnly,refreshResume:true,sceneErrors:errors});
    await writeFile(`${output}/integration.json`,JSON.stringify(report,null,2));
    }finally{
      await context.close();
      await (await page.video()).saveAs(`${output}/${label}-opening.webm`);
    }
  }
  await writeFile(`${output}/integration.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
