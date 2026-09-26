import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { installFadecadeApi } from './fadecade.fixture.ts';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});
 await page.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
 await page.routeWebSocket('**',()=>{});
 await installFadecadeApi(page,{activeRun:true});
 await page.goto('http://127.0.0.1:4198/game/challenges');
 await page.getByRole('button',{name:'Continue road',exact:true}).click();
 const road=page.locator('.fadecade-road-view:not(.is-compact)');
 await road.locator('.fadecade-sprite--walk').waitFor();
 assert.match(await road.locator('.fadecade-sprite').evaluate(e=>getComputedStyle(e).animationName),/run-frames/);
 await road.locator('.fadecade-sprite--idle').waitFor();
 await page.getByRole('button',{name:'End run',exact:true}).click();
 await page.getByRole('button',{name:'End run now',exact:true}).click();
 await road.locator('.fadecade-sprite--defeat').waitFor();
 assert.match(await road.locator('.fadecade-sprite').evaluate(e=>getComputedStyle(e).animationName),/fadecade-fall/);
 await page.waitForTimeout(1000);
 await page.screenshot({path:'screenshots/release/road-quit-phone.png'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS phone walking sprite, arrival, animated defeat and viewport fit');
}finally{await browser.close();}
