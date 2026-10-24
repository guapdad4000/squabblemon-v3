import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4245';
const out = process.env.REVIEW_OUTPUT ?? '/tmp/bag-arrival-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] });
const report=[];
try {
 for(const [width,height,reduced] of [[1440,1000,false],[390,844,false],[320,568,true],[844,390,true]]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:reduced?'reduce':'no-preference'});
  const errors=[], saved=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path.endsWith('/notifications/receipts')) {
    if(route.request().method()==='POST') saved.push(...route.request().postDataJSON().ids);
    return route.fulfill({json:{ids:[...new Set(saved)]}});
   }
   if(path.includes('/mail')) return route.fulfill({json:{messages:[]}});
   if(path.endsWith('/daily-clout')) return route.fulfill({json:{available:false,attemptsRemaining:0,date:'2026-10-24'}});
   return route.fulfill({json:{pending:[],growth:{ready:false}}});
  });
  await page.goto(`${origin}/e2e/bag-arrival.fixture.html?player=arrival-${width}${reduced?'&reduced':''}`);
  await page.waitForTimeout(900);await expect(page.locator('[data-bag-reward-arrival]')).toHaveCount(0);
  await page.locator('#focus-control').focus();
  await page.evaluate(()=>{window.__bagBlocker(true);window.__bagGain()});
  await expect(page.locator('#pending-bag')).toHaveText('3');await page.waitForTimeout(900);
  await expect(page.locator('[data-bag-reward-arrival]')).toHaveCount(0);
  await page.evaluate(()=>window.__bagBlocker(false));
  const arrival=page.locator('[data-bag-reward-arrival]');await expect(arrival).toBeVisible();
  await expect(arrival).toContainText('+500 Clout');await expect(arrival).toContainText('+2 Tickets');await expect(arrival).toContainText('+15 Universal Shards');
  assert.equal(await arrival.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  assert.ok(await arrival.locator('aside').evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth}));
  await expect(page.locator('#focus-control')).toBeFocused();
  if(reduced) await expect(arrival.locator('.bag-arrival__flight')).toHaveCount(0);
  else await expect(arrival.locator('.bag-arrival__flight>i')).toHaveCount(6);
  await page.screenshot({path:`${out}/arrival-${width}x${height}.png`});
  await expect(arrival).toHaveCount(0,{timeout:6000});await expect(page.locator('#pending-bag')).toHaveText('0');
  assert.equal(saved.filter(id=>id.startsWith('bag:')).length,3);
  await page.evaluate(()=>{window.__bagRefresh();window.__bagSpend()});await page.waitForTimeout(900);await expect(arrival).toHaveCount(0);
  await page.reload();await page.waitForTimeout(1000);await expect(arrival).toHaveCount(0);
  // Leaving before completion preserves pending notices for return to Safehouse.
  await page.evaluate(()=>window.__bagGain());await expect(arrival).toBeVisible();
  await page.evaluate(()=>window.__bagHome(false));await expect(arrival).toHaveCount(0);await page.waitForTimeout(3800);
  await expect(page.locator('#pending-bag')).toHaveText('3');
  await page.evaluate(()=>window.__bagHome(true));await expect(arrival).toBeVisible();
  await page.evaluate(()=>window.__bagBlocker(true));await expect(arrival).toHaveCount(0);await expect(page.locator('#pending-bag')).toHaveText('3');
  await page.evaluate(()=>{window.__bagBlocker(false);window.__bagRewardQueue(true)});await page.waitForTimeout(900);await expect(arrival).toHaveCount(0);
  await page.evaluate(()=>window.__bagRewardQueue(false));await expect(arrival).toBeVisible();
  await expect(arrival).toHaveCount(0,{timeout:6000});await expect(page.locator('#pending-bag')).toHaveText('0');
  // Bell clear cancels the same pending gain; switching accounts never presents old funds.
  await page.evaluate(()=>{window.__bagHome(false);window.__bagGain()});await expect(page.locator('#pending-bag')).toHaveText('3');
  await page.getByRole('button',{name:'Clear bag notices'}).click();await page.evaluate(()=>window.__bagHome(true));await page.waitForTimeout(900);await expect(arrival).toHaveCount(0);
  await page.evaluate(()=>window.__bagSwitchPlayer());await page.waitForTimeout(900);await expect(arrival).toHaveCount(0);
  assert.deepEqual(errors,[]);report.push({width,height,reduced,initialBalanceSilent:true,blockers:true,aggregate:true,sameBellReceipts:true,leaveAndReturn:true,noRepeatOnReload:true,accountIsolation:true});await page.close();console.log(`PASS reward arrival ${width}x${height}`);
 }
} finally {await browser.close();await writeFile(`${out}/arrival.json`,JSON.stringify(report,null,2));}
