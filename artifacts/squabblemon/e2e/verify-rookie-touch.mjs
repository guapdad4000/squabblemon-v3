import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.UI_ORIGIN??'http://127.0.0.1:43249';
const engine=process.env.TOUCH_BROWSER??'chromium';
const browser=await(engine==='webkit'?webkit:chromium).launch();
const output=process.env.TUTORIAL_PROOF_DIR??'screenshots/tutorial-touch';await mkdir(output,{recursive:true});
const results=[];
try{for(const [width,height] of [[390,844],[320,568],[820,1180],[1180,820],[768,1024],[1024,768],[844,390]]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/e2e/rookie-road.fixture.html');await page.getByTestId('fade-spotlight').waitFor();let taps=0,firstCost=false;
 while(await page.getByTestId('match-sig').count()){
  assert(taps<40,'Tutorial must progress, '+width+'x'+height);
  const lesson=page.getByTestId('mechanic-lesson');if(await lesson.isVisible().catch(()=>false)){await page.getByTestId('button-dismiss-mechanic-lesson').tap();continue;}
  const spotlight=page.getByTestId('fade-spotlight');const target=await spotlight.getAttribute('data-coach-target');assert(target,'Coach retains target');const control=page.locator(target);assert.equal(await control.count(),1,'Exact tutorial control');
  if(taps===0){assert(target.startsWith('#hand-tray '));assert((await spotlight.textContent()).includes('costs 2 Motion'));firstCost=true;await page.screenshot({path:output+'/'+engine+'-first-card-'+width+'x'+height+'.png'});}
  const before=await page.getByTestId('match-sig').textContent();await control.tap({timeout:5000});taps++;
  await page.waitForFunction(previous=>document.querySelector('[data-testid="match-sig"]')?.textContent!==previous,before,{timeout:5000});
 }
 await page.getByTestId('battle-result-screen').waitFor();await page.getByTestId('button-complete-tutorial').tap();await page.getByTestId('rookie-post-fight-handoff').waitFor();assert.deepEqual(errors,[]);assert(firstCost);await page.screenshot({path:output+'/'+engine+'-complete-'+width+'x'+height+'.png'});results.push({width,height,taps,firstTwoMotionCardSelected:true,fourRoundsCompleted:true,handoffReached:true});console.log(JSON.stringify(results.at(-1)));await page.close();
 }await writeFile(output+'/'+engine+'-verification.json',JSON.stringify({engine,complete:true,results},null,2));
}finally{await browser.close();}
