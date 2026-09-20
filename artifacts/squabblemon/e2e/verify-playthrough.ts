import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {storyContent} from '@workspace/squabblemon-engine/story';
const origin=process.env.PLAYTHROUGH_ORIGIN??'http://127.0.0.1:4193';
const chapters=storyContent.chapters.map(c=>({...c,status:'available',completedNodes:0,totalNodes:c.nodes.length,completedRequiredNodes:0,totalRequiredNodes:c.nodes.filter(n=>!n.optional).length,stars:0,bossStatus:'locked'}));
const nodes=storyContent.chapters.flatMap(c=>c.nodes.map((n,i)=>({chapterId:c.id,nodeId:n.id,title:n.title,kind:n.kind,optional:n.optional,status:i<3?'available':'locked',mapPosition:n.mapPosition,prerequisites:[...n.prerequisites],rewards:[...n.rewards],cleared:false,stars:0,attempts:0,wins:0,lastOutcome:null,dialogueSeen:[],bossHighestPhase:0,firstClearedAt:null,lastPlayedAt:null})));
const campaign={contentVersion:storyContent.version,chapters,nodes,recommendedNodeId:nodes[0].nodeId,totalStars:0,completedNodes:0};
const report={checks:[] as string[],errors:[] as string[],complete:false,failure:''};
const browser=await chromium.launch({channel:'msedge',headless:true});let activePage;
async function drag(page,locator,dx,dy,inspect=false){
 const b=await locator.boundingBox();assert.ok(b);const x=b.x+b.width*.6,y=b.y+b.height*.4,cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8,id:1}]});await page.waitForTimeout(20);}
 if(inspect){assert.equal(await locator.getAttribute('data-tilting'),'true');assert.notEqual(await locator.locator('.collector-frame').evaluate(e=>getComputedStyle(e).transform),'none');}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
async function visible(control,width,height){const b=await control.boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,JSON.stringify(b));assert.ok(b.height>=44);assert.equal(await control.evaluate(e=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}),true);}
try{
 for(const [name,width,height,touch] of [['phone',390,844,true],['small-phone',320,740,true],['landscape',844,390,true],['tablet',820,1180,true],['desktop',1440,960,false]] as const){
  if(process.env.PLAYTHROUGH_SIZES && !process.env.PLAYTHROUGH_SIZES.split(',').includes(name))continue;
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});await context.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
  const page=activePage=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(`${name}: ${e.message}`));
  await page.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().endsWith('/story')?campaign:route.request().url().includes('multiplayer')?{rooms:[]}:{})}));
  const shot=async(part:string)=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,part+' overflow');await page.screenshot({path:`../../screenshots/playthrough-${part}-${name}.jpg`,type:'jpeg',quality:82});};
  await page.goto(origin+'/game/shop');await page.locator('.venue-scene.is-ready').waitFor();
  const back=page.getByRole('link',{name:'Back to safehouse',exact:true}),menu=page.getByRole('button',{name:'Open game navigation',exact:true});
  await visible(back,width,height);assert.equal(await menu.count(),1);await visible(menu,width,height);
  await page.locator('.game-route-stage').evaluate(e=>e.scrollTop=e.scrollHeight);await visible(back,width,height);
  await menu.click();await page.getByRole('dialog',{name:'Squabble Express'}).waitFor();await visible(page.getByRole('button',{name:'Close game navigation'}),width,height);await shot('city-line');
  await page.getByRole('button',{name:'Close game navigation'}).click();await page.getByRole('button',{name:'Training',exact:true}).click();await page.locator('.training-studio').waitFor();await visible(back,width,height);await visible(menu,width,height);await shot('training');
  await page.locator('.market').evaluate(e=>e.scrollTop=e.scrollHeight);await visible(back,width,height);await back.click();await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor();
  await page.goto(origin+'/game/story');await page.locator('.story-atlas__node').first().waitFor();const pan=page.locator('.story-atlas__pan'),backdrop=page.locator('.story-atlas__viewport');
  const fixed=await backdrop.boundingBox(),before=await pan.evaluate(e=>[e.scrollLeft,e.scrollTop]);
  if(touch)await drag(page,pan,-120,-60);else{await pan.focus();await page.keyboard.press('ArrowDown');await page.waitForTimeout(180);}
  assert.deepEqual(await backdrop.boundingBox(),fixed);if(width<900)assert.notDeepEqual(await pan.evaluate(e=>[e.scrollLeft,e.scrollTop]),before,'Nodes move over stationary backdrop');await shot('story');
  await page.goto(origin+'/game/collection');await page.getByTestId('collection-card-control').first().click();const card=page.getByTestId('card-inspector');await card.waitFor();
  if(touch)await drag(page,card,-50,22,true);else{const b=await card.boundingBox();await page.mouse.move(b!.x+20,b!.y+40);assert.equal(await card.getAttribute('data-tilting'),'true');}
  await shot('card');await page.getByRole('button',{name:'Close card details'}).click();await visible(back,width,height);
  await page.goto(origin+'/game/online');await page.locator('.fight-night').waitFor();await shot('fight');await visible(page.getByRole('link',{name:'Back to safehouse',exact:true}),width,height);
  report.checks.push(`${name}: shop readiness, persistent exits, City Line, training, fixed map, card tilt and fight lobby pass`);console.log(report.checks.at(-1));await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});await context.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
 const page=activePage=await context.newPage();page.setDefaultTimeout(22000);await page.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:'{}'}));
 await page.route('**/scenes/gym/scene.js',route=>route.abort());await page.goto(origin+'/game/shop');await visible(page.getByRole('link',{name:'Back to safehouse',exact:true}),390,844);
 await page.getByText('The lights went out.',{exact:true}).waitFor();await page.unroute('**/scenes/gym/scene.js');await page.getByRole('button',{name:'Reload scene',exact:true}).click();await page.locator('.venue-scene.is-ready').waitFor();report.checks.push('Blocked gym script: accessible exit, bounded loading timeout, successful scene retry');
 await page.goto(origin+'/game/collection');await page.getByTestId('collection-card-control').first().click();const card=page.getByTestId('card-inspector');await card.waitFor();await drag(page,card,-35,10);assert.equal(await card.getAttribute('data-tilting'),null);assert.equal(await card.locator('.collector-frame').evaluate(e=>getComputedStyle(e).animationName),'none');report.checks.push('Reduced motion disables tilt and entrance animation');await context.close();assert.deepEqual(report.errors,[]);report.complete=true;
}catch(error){report.failure=String(error.stack??error);await activePage?.screenshot({path:'../../screenshots/playthrough-failure.jpg',type:'jpeg',quality:80}).catch(()=>{});throw error;}
finally{await browser.close();await writeFile('../../screenshots/playthrough-verification.json',JSON.stringify(report,null,2));}
