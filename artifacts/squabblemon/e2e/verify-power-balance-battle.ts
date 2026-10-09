import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const out='../deliverables/power-cards-blockbusters/screenshots';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try {
  for(const [name,viewport] of [['desktop',{width:1440,height:960}],['phone',{width:390,height:844}]] as const){
    const page=await browser.newPage({viewport,reducedMotion:'reduce'}), errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4198/e2e/blockbusters.fixture.html?card=the-concert');
    await page.getByTestId('battle-arena').waitFor();
    const card=page.locator('[data-card-zone="hand"][data-card-id="the-concert"]');
    await card.scrollIntoViewIfNeeded();await card.click();
    await page.getByTestId('lane-0').click();
    const enemy=page.locator('[data-card-zone="board"][data-card-id="cornball"]');
    const enemyPowerBefore=Number(await enemy.getAttribute('data-card-power'));
    const choice=page.locator('#concert-choice');await choice.click();
    await page.getByRole('option',{name:'Rivals −3 · allies −1',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#concert-choice')?.textContent?.includes('Rivals −3'));
    await page.screenshot({path:`${out}/${name}-concert-choice.png`});
    await page.getByTestId('button-lock').click();
    await card.waitFor({state:'detached'});
    assert.equal(await page.locator('[data-card-zone="board"][data-card-id="bouncer"]').count(),1);
    await page.waitForTimeout(600);
    const enemyPowerAfter=await enemy.count() ? Number(await enemy.getAttribute('data-card-power')) : 0;
    const state=page.getByTestId('blockbuster-state');
    const enemyModifier=await state.getAttribute('data-enemy-hands-modifier');
    assert(enemyModifier === 'destroyed' || Number(enemyModifier) < 0, 'Selected damage mode resolves against the actual opponent');
    assert((await state.getAttribute('data-last-effect'))?.includes('enemies take 3 damage'));
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`${out}/${name}-concert-resolved.png`});
    results.push({name,choice:'Rivals -3, allies -1',enemyPowerBefore,enemyPowerAfter,enemyModifier,allySurvived:true,pageErrors:errors});
    await page.close();
  }
}finally{await browser.close();}
await writeFile(`${out}/battle-verification.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
