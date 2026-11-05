import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const output=process.env.BT_POLISH_OUTPUT??'/tmp/bt-polish-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});const evidence=[];
try {
 for (const guest of [false,true]) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:5178/e2e/breakthrough-live-polish.fixture.html${guest?'?guest':''}`);
  await page.getByRole('button',{name:'FIND OPPONENT →'}).click();
  await page.locator('.km-search[data-phase="searching"]').waitFor();
  await page.screenshot({path:`${output}/search-${guest?'guest':'host'}.png`});
  await page.locator('.km-search[data-phase="matched"]').waitFor();
  assert((await page.locator('.km-search-opponent').innerText()).includes(guest?'Gold Gloves':'Night Shift'));
  await page.screenshot({path:`${output}/found-${guest?'guest':'host'}.png`});
  await page.locator('.bt-unit-player').first().waitFor();
  const samples=await page.locator('.bt-unit-player').first().evaluate(el=>new Promise(resolve=>{
    const rows=[];const start=performance.now();function frame(){rows.push({t:performance.now(),y:el.getBoundingClientRect().y});if(performance.now()-start<1200)requestAnimationFrame(frame);else resolve(rows)}requestAnimationFrame(frame);
  }));
  let stationary=0,moving=0;for(let i=1;i<samples.length;i++){if(Math.abs(samples[i].y-samples[i-1].y)<.005)stationary++;else moving++;}
  assert(moving>stationary,JSON.stringify({moving,stationary}));
  await page.getByRole('button',{name:'QA: Finish double break'}).click();
  await page.getByRole('dialog',{name:'Win',exact:true}).waitFor();
  await page.getByText('+20 TROPHIES · 120 TOTAL',{exact:true}).waitFor();
  assert((await page.locator('.bt-finish-score').innerText()).includes('Two base breaches'));
  await page.waitForFunction(()=>['.bt-finish-score','.bt-trophy-summary','.bt-finish-actions'].every(s=>getComputedStyle(document.querySelector(s)).opacity==='1'));
  await page.screenshot({path:`${output}/double-break-win-${guest?'guest':'host'}.png`});
  await page.getByRole('button',{name:'BACK TO KUMITE ←',exact:true}).click();
  await page.getByRole('button',{name:'FIND OPPONENT →'}).click();
  await page.locator('.km-search[data-phase="searching"]').waitFor();
  assert.deepEqual(errors,[]);
  evidence.push({seat:guest?'opponent':'player',result:'win',trophies:20,moving,stationary,samples:samples.length,errors});await page.close();
 }
 await writeFile(`${output}/evidence.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await browser.close();}
