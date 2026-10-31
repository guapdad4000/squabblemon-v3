import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.ARCADE_BASE_URL??'http://127.0.0.1:4257';
const out=process.env.REVIEW_OUTPUT??'/home/falcon/Documents/New project 9/output/raid-cinema-review/after/native-choices';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--enable-unsafe-swiftshader']});
const reports=[];
try{
 for(const mode of ['precinct','kumite']){
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/e2e/boss-raid.fixture.html?reset=1&choices=1&reduced=1&raid=${mode}`);
  const select=async name=>page.getByRole('button',{name:`Select ${name}`,exact:true}).click();
  const lane=async index=>page.locator('.raid-lane-label').nth(index).click();
  const quote=async()=>Number((await page.getByRole('button',{name:/PLAY CARD/}).textContent()).match(/· (\d+) ⚡/)[1]);
  const cardCost=async id=>page.evaluate(id=>window.__raid.match.playerHand.find(card=>card.cardId===id).cost,id);
  const play=async id=>{await page.getByRole('button',{name:/PLAY CARD/}).click();await page.waitForFunction(id=>!window.__raid.match.playerHand.some(card=>card.cardId===id),id);};
  await select('Homeless Guy');await page.getByRole('combobox',{name:'Extra Motion investment'}).selectOption('2');await lane(0);
  assert.equal(await quote(),await cardCost('homelessguy')+3);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await select('The Dice Game');await lane(0);
  assert.equal(await quote(),await cardCost('the-dice-game')+2,'default Dice wager and RICO both appear');
  await page.getByRole('combobox',{name:'Dice wager'}).selectOption('3');
  assert.equal(await quote(),await cardCost('the-dice-game')+4);
  await play('the-dice-game');
  assert.equal(await page.evaluate(()=>window.__raid.match.diceResult.wager),3);
  assert.ok(await page.evaluate(()=>window.__raid.used.includes('tax:0')));
  await select('The Concert');await page.getByRole('combobox',{name:'Concert mode'}).selectOption('1');await lane(1);
  assert.equal(await quote(),await cardCost('the-concert'),'Concert mode is not an additional Motion fee');
  await play('the-concert');
  assert.equal(await page.evaluate(()=>window.__raid.match.boards[1].find(c=>c.owner==='player').powerModifier),-1);
  assert.equal(await page.evaluate(()=>window.__raid.match.boards[1].find(c=>c.owner==='cpu').powerModifier),3);
  await select('Cornball');assert.equal(await page.getByRole('combobox').count(),0);
  await page.getByRole('checkbox',{name:'Squabble · ×2 Hands'}).check();await lane(0);
  const plainCost=await cardCost('cornball');assert.equal(await quote(),plainCost,'Squabble doubles Hands, not Motion; RICO is already spent');
  const before=await page.evaluate(()=>window.__raid.match.playerMotion);await play('cornball');
  assert.equal(await page.evaluate(()=>window.__raid.match.playerMotion),before-plainCost);
  await select('Homeless Guy');await page.getByRole('combobox',{name:'Extra Motion investment'}).selectOption('2');await lane(0);
  assert.equal(await quote(),await cardCost('homelessguy')+2);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.collector-portrait')].map(i=>i.decode()));});
  await page.screenshot({path:`${out}/${mode}-native-choices.png`,fullPage:true});
  assert.deepEqual(errors,[]);reports.push({mode,RICOOnce:true,DiceDefaultAndThree:true,ConcertMosh:true,SquabbleNativePrice:true,HomelessValidChoice:true,ordinaryChoiceReset:true});
  await page.close();
 }
 await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
}finally{await browser.close();}
