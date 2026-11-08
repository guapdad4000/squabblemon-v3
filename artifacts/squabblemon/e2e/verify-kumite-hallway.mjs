import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const origin=process.env.KUMITE_ORIGIN??'http://127.0.0.1:5178';
const output=process.env.KUMITE_OUTPUT??'/tmp/kumite-hallway-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const evidence=[];
try {
 for (const [name,width,height] of [['desktop',1440,900],['phone',390,844],['small-phone',320,568],['landscape',844,390],['tablet',768,1024]]) {
  const page=await browser.newPage({viewport:{width,height}});
  page.setDefaultTimeout(20000);
  const errors=[],requests=[],media=[];
  page.on('request', r => { if (r.resourceType()==='image' && /poster-(idle|exit)/.test(r.url())) media.push(r.url()); });
  page.on('pageerror',e=>errors.push(e.message));let search=null;
  await page.route('**/api/kumite/**',route=>{
   const now=Date.now();
   return route.fulfill({json:route.request().url().endsWith('/winners')?{winners:[],serverTime:now}:{serverTime:now,tournament:{id:'review-week',weekLabel:'Review week',status:'registration',registrationOpensAt:now-86400000,startsAt:now+69590000,endsAt:now+160000000,capacity:8,poolCount:1,poolSize:8,pools:[],finals:[],champion:null,entrants:[]},registration:null,currentMatch:null,rules:{roundHours:6,turnSeconds:75,deckSize:10,minimumEntrants:2},progression:{completedMatches:24,matchWins:18,championships:3,rewards:[]},records:{scope:'Review',fastestFight:null,recentWinners:[],handThrowers:[]}}});
  });
  await page.route('**/api/breakthrough{,/**}',route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(path.endsWith('/standings')) return route.fulfill({json:{season:'fixture',total:42,updatedAt:new Date().toISOString(),leaders:Array.from({length:20},(_,i)=>({name:i===0?'Redline Ren':`Fighter ${i+1}`,avatarKey:'nabu',position:i+1,trophies:500-i*10,wins:25-i,games:30,isYou:false,automated:i===0})),you:{name:'Gold Gloves',avatarKey:'nabu',position:28,trophies:206,wins:18,games:20,isYou:true,automated:false}}});
   if(req.method()==='POST')requests.push({path,body:req.postDataJSON()});
   if(path.endsWith('/search'))search={...req.postDataJSON(),status:'waiting',roomId:null};
   if(path.endsWith('/cancel'))search={...search,status:'cancelled'};
   return route.fulfill({json:path==='/api/breakthrough'?{search,record:{trophies:206,wins:18,losses:2,draws:0}}:search});
  });
  await page.goto(`${origin}/e2e/kumite-hallway.fixture.html${name==='small-phone'?'?reduced':''}`);
  await page.getByRole('button',{name:'Enter Kumite',exact:true}).waitFor();
  const inspect=async(stage)=>{
   await page.evaluate(async()=>{await document.fonts.ready;for(const image of document.images)image.loading="eager";await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
   const broken=await page.locator('img').evaluateAll(images=>images.filter(i=>!i.naturalWidth).map(i=>i.src));assert.deepEqual(broken,[],`${stage} artwork loads`);
   const geometry=await page.evaluate(()=>({width:innerWidth,body:document.body.scrollWidth,main:document.querySelector('main').scrollWidth,client:document.querySelector('main').clientWidth}));
   assert(geometry.body<=width && geometry.main<=geometry.client+1,`${name} ${stage}: ${JSON.stringify(geometry)}`);
   const backdrop=await page.locator(stage==='hub'?'.kumite-environment img':'.bt-flyer-lobby__alley img').boundingBox();
   assert(backdrop.width>=width && backdrop.height>=height,`${stage} background fills viewport`);
   await page.screenshot({path:`${output}/${name}-${stage}.png`});return geometry;
  };
  await page.waitForTimeout(550);const hub=await inspect('hub');
  const poster=page.locator('.km-poster img');
  if(name==='phone') {
   await page.setViewportSize({width,height:320});
   await page.locator('.km-hall__sign').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
   assert((await poster.getAttribute('src')).includes('still'),'offscreen animation stops');
   await page.setViewportSize({width,height});
   await page.getByRole('link',{name:'Find opponent — Breakthrough'}).scrollIntoViewIfNeeded();await page.waitForTimeout(150);
  }
  if(name==='desktop') {
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
   assert((await poster.getAttribute('src')).includes('still'),'OS motion change stops loop');
   await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(100);
  }
  if(name==='small-phone') { assert(!(await poster.getAttribute('src')).includes('idle'));assert.equal(media.length,0,'reduced motion does not fetch animation'); }
  else {
   await page.getByRole('button',{name:'Pause poster animation'}).click();
   assert((await poster.getAttribute('src')).includes('still'));
   await page.getByRole('button',{name:'Play poster animation'}).click();
   assert((await poster.getAttribute('src')).includes('idle'));
  }
  await page.getByRole('link',{name:'Find opponent — Breakthrough'}).focus();const entered=Date.now();await page.keyboard.press('Enter');
  if(name==='desktop') {
   assert.equal(await page.locator('.km-poster').getAttribute('data-exiting'),'true');
   assert.equal(await page.locator('.km-poster').evaluate(n=>getComputedStyle(n,'::before').opacity),'0');
   await page.waitForTimeout(1600);await page.screenshot({path:`${output}/desktop-poster-peel.png`});
  }
  await page.locator('[data-testid="breakthrough-online-lobby"]').waitFor();await page.locator('.km-flyer-wipe').waitFor({state:'detached'});
  const transitionMs=Date.now()-entered;assert(transitionMs<(name==='small-phone'?1500:7000));
  if(name==='desktop') assert(transitionMs>=2800,'play only final half before navigation');
  const lobby=await inspect('lobby');
  const rail=page.locator('.compact-deck-picker__rail');
  const next=page.getByRole('button',{name:'Next decks'});
  const previous=page.getByRole('button',{name:'Previous decks'});
  await next.click();await page.waitForTimeout(450);assert(await rail.evaluate(n=>n.scrollLeft)>0,'desktop and touch arrow scroll');
  await previous.click();await page.waitForTimeout(450);
  await page.getByRole('heading',{name:'WORLDWIDE.'}).scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'UNROLL TOP 20 ↓'}).click();
  assert.equal(await page.getByRole('list',{name:'Kumite worldwide leaders'}).locator('li').count(),20);
  await page.getByRole('button',{name:'FOLD THE RANKS ↑'}).click();
  await page.screenshot({path:`${output}/${name}-standings.png`});

  const second=page.getByRole('group',{name:'Choose your Breakthrough deck'}).locator('.compact-deck-picker__deck').nth(1);
  console.log(name,"select");await second.click();await second.focus();assert.equal(await second.getAttribute('aria-pressed'),'true');
  console.log(name,'search');await page.getByRole('button',{name:'FIND OPPONENT →'}).scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${name}-deck-picker.png`});await page.getByRole('button',{name:'FIND OPPONENT →'}).click();await page.locator('.km-search[data-phase="searching"]').waitFor();
  assert.equal(requests.filter(r=>r.path.endsWith('/search')).length,1);assert.equal(requests.find(r=>r.path.endsWith('/search')).body.deckId,'review-1');
  console.log(name,'cancel');await page.getByRole('button',{name:'Back out of opponent search'}).click();await page.locator('[data-testid="breakthrough-online-lobby"]').waitFor();
  assert.equal(await page.getByRole('group',{name:'Choose your Breakthrough deck'}).locator('.compact-deck-picker__deck').nth(1).getAttribute('aria-pressed'),'true');
  console.log(name,'return');await page.getByRole('link',{name:'← KUMITE'}).click();await page.getByRole('button',{name:'Enter Kumite',exact:true}).click();await page.getByRole('button',{name:'Sign up',exact:true}).waitFor();
  if(name==='desktop') {
   await page.route('**/poster-exit.webp',route=>route.request().resourceType()==='image'?route.abort():route.continue());
   await page.route('**/api/breakthrough/standings',route=>route.fulfill({status:503,json:{error:'Standings temporarily unavailable'}}));
   await page.goto(`${origin}/e2e/kumite-hallway.fixture.html`);
   await page.getByRole('link',{name:'Find opponent — Breakthrough'}).click();
   await page.locator('[data-testid="breakthrough-online-lobby"]').waitFor();
   await page.getByRole('heading',{name:'WORLDWIDE.'}).scrollIntoViewIfNeeded();
   await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
   assert(await page.getByRole('button',{name:'FIND OPPONENT →'}).isEnabled(),'rank error does not block play');
   await page.unroute('**/api/breakthrough/standings');
   await page.getByRole('button',{name:'Retry',exact:true}).click();
   await page.getByRole('button',{name:'UNROLL TOP 20 ↓'}).waitFor();
  }
  assert.deepEqual(errors,[]);evidence.push({name,width,height,hub,lobby,transitionMs,animationRequests:media.length,searchRequests:requests.filter(r=>r.path.endsWith('/search')).length,cancelRequests:requests.filter(r=>r.path.endsWith('/cancel')).length,errors});await page.close();
 }
 await writeFile(`${output}/evidence.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
} finally {await browser.close();}
