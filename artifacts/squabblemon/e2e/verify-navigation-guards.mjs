import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true});
try{
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
await page.routeWebSocket('**',()=>{});
await page.route('**/api/**',r=>r.fulfill({json:{}}));
await page.goto('http://127.0.0.1:4198/game/collection');
await page.getByTestId('button-view-collection-road').click();
const body=page.locator('.collection-stage__body');
await body.evaluate(el=>{el.scrollTop=300;});
await page.waitForTimeout(200);
const offset=await body.evaluate(el=>el.scrollTop);
assert(offset>0);
await page.locator('.city-header__identity').click();
await page.waitForURL('**/game/settings');
await page.evaluate(async()=>{
 const {setDeckExitGuard}=await import('/src/lib/deckExitGuard.ts');
 window.clearTestGuard=setDeckExitGuard(proceed=>{window.resumeTestNavigation=proceed;});
});
await page.locator('.city-header .game-back-button').click();
await page.waitForFunction(()=>!!window.resumeTestNavigation);
assert.match(page.url(),/\/game\/settings$/,'Unsaved deck guard must keep current route');
await page.evaluate(()=>{window.clearTestGuard();window.resumeTestNavigation();});
await page.waitForURL('**/game/collection');
await page.waitForTimeout(500);
assert.equal(await body.evaluate(el=>el.scrollTop),offset);
assert.equal(await page.getByTestId('button-view-collection-road').getAttribute('aria-pressed'),'true');
await page.goForward();
await page.waitForURL('**/game/settings');
console.log('PASS guarded Back, scroll restoration, tab restoration and browser Forward');
}finally{await browser.close();}
