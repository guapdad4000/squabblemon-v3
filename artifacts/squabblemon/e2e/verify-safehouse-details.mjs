import {chromium,expect} from '@playwright/test';
import {profileBootstrap} from './fighter-id.fixture.ts';
import {mkdir} from 'node:fs/promises';
const output=process.env.REVIEW_OUTPUT??'/tmp/squabble-details';await mkdir(output,{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.routeWebSocket('**',s=>s.close());await page.addInitScript(()=>{localStorage.setItem('squabblemon_e2e_user','signed-in');localStorage.removeItem('squabblemon_safehouse_lighting')});
let runs=[];
const state=profileBootstrap({id:'e2e-player',displayName:'HOME COURT',settings:{reducedMotion:true,turnTimerEnabled:false}});
await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;return r.fulfill({json:path.endsWith('/bootstrap')?state:path.endsWith('/challenges/runs')?runs:{messages:[]}})});
async function open(){await page.goto('http://localhost:4199/squabblemon/game');await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-scene-ready','true',{timeout:60000});await expect(page.getByRole('button',{name:'Explore the television'})).toHaveAttribute('data-anchor-positioned','true');}
async function shot(name){await page.waitForTimeout(800);await page.screenshot({path:`${output}/${name}.png`});console.log(name)}
try{
 await open();let frame=page.frames().find(f=>f.url().includes('/scenes/safehouse/'));
 await expect.poll(()=>frame.evaluate(()=>window.Squabblemon.getSceneStatus().arcade.status)).toBe('new');await shot('01-room');
 for(const [name,label] of [['02-bag','your inventory bag'],['03-training','the heavy bag'],['04-garden','buddy’s plants'],['05-shelf','your portrait shelf'],['06-arcade-new','the arcade machine']]){await page.getByRole('button',{name:`Explore ${label}`}).click();await shot(name);await page.getByRole('button',{name:'Back to the room',exact:true}).click();}
 runs=[{id:'saved-road',status:'active',wins:7,encounterIndex:7,encounter:{rivalDeckId:'starter-balanced',boss:false},entryDate:'2026-09-25'}];await open();frame=page.frames().find(f=>f.url().includes('/scenes/safehouse/'));await expect.poll(()=>frame.evaluate(()=>window.Squabblemon.getSceneStatus().arcade)).toEqual({status:'continue',wins:7});await page.getByRole('button',{name:'Explore the arcade machine'}).click();await shot('07-arcade-continue');
 await page.getByRole('link',{name:'Enter the Fadecade',exact:true}).click();await expect(page).toHaveURL(/game\/challenges/);
 // Closed runs must not be offered as resumable.
 runs=[{id:'ended-road',status:'settled',wins:7}];await open();frame=page.frames().find(f=>f.url().includes('/scenes/safehouse/'));await expect.poll(()=>frame.evaluate(()=>window.Squabblemon.getSceneStatus().arcade.status)).toBe('new');
 await page.setViewportSize({width:390,height:844});await shot('08-phone');
 if(errors.length)throw new Error(errors.join('\n'));console.log('Verified new / active / ended saves, arcade navigation, desktop and phone; no runtime errors.');
}finally{await browser.close()}
