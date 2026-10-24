import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { profileBootstrap } from './fighter-id.fixture';
import { planShopPurchase, type ShopRequest } from '@workspace/squabblemon-engine/economy';
const base = process.env.TRAINING_REVIEW_URL ?? 'http://127.0.0.1:4319';
const out = process.env.MARKET_LIFETIME_OUTPUT ?? '/tmp/market-lifetime';
await mkdir(out,{recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/google-chrome',args:['--no-sandbox']});
const report:unknown[] = [];
const initial = profileBootstrap({id:'training-lifetime-a',softCurrency:5000});
const journal = `squabblemon.shop.pending.v1:${initial.profile.id}`;
const nextRequest:ShopRequest = {itemId:'tagged-style',cardId:'kyle',idempotencyKey:'16cd92ec-6f16-41ba-8652-98ce19064b09'};
try {
  for (const scenario of ['unmounted-during-payoff','account-change-before-response','newer-journal-success','newer-journal-terminal'] as const) {
    const page = await browser.newPage({viewport:{width:1000,height:900}});
    const errors:string[] = [], requests:ShopRequest[] = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.routeWebSocket('**',socket=>socket.close());
    let release!:()=>void;
    const held = new Promise<void>(resolve=>{release=resolve;});
    let delivered = false;
    await page.route('**/api/player/shop/purchases',async route=>{
      const request = route.request().postDataJSON() as ShopRequest;
      requests.push(request);
      if(scenario !== 'unmounted-during-payoff') await held;
      if(scenario === 'newer-journal-terminal') await route.fulfill({status:400,json:{error:'Terminal fixture response'}});
      else {
        const planned = planShopPurchase(initial.profile,request);
        await route.fulfill({json:{receipt:planned.receipt,bootstrap:{...initial,profile:{...initial.profile,...planned.wallet}}}});
      }
      delivered = true;
    });
    try {
      await page.goto(`${base}/e2e/market-lifetime.fixture.html?item=training&card=kyle`,{waitUntil:'domcontentloaded'});
      const action = page.locator('[data-training-purchase]');
      await expect(action).toBeEnabled();
      await action.click();
      await expect.poll(()=>requests.length).toBe(1);
      await expect(page.locator('.training-session')).toBeVisible();
      const original = requests[0];
      if(scenario==='unmounted-during-payoff') {
        await expect.poll(()=>delivered).toBe(true);
        await page.waitForTimeout(80);
        await page.evaluate(()=> (window as any).__marketLifetime.hide());
        await expect(page.getByTestId('training-left')).toBeVisible();
      } else if(scenario==='account-change-before-response') {
        await page.evaluate(()=> (window as any).__marketLifetime.switchAccount('training-lifetime-b'));
        await expect(page.locator('.training-club__wallet')).toHaveAccessibleName('7,300 Clout available');
        release();
      } else {
        await page.evaluate(({journal,request})=>sessionStorage.setItem(journal,JSON.stringify(request)),{journal,request:nextRequest});
        release();
      }
      await expect.poll(()=>delivered).toBe(true);
      await page.waitForTimeout(2600);
      const state = await page.evaluate(journal=>({...(window as any).__marketLifetime.snapshot(),pending:JSON.parse(sessionStorage.getItem(journal)??'null'),other:sessionStorage.getItem('squabblemon.shop.pending.v1:training-lifetime-b')}),journal);
      if(scenario==='unmounted-during-payoff') {
        expect(state.bootstrap).toEqual(initial); expect(state.pending).toEqual(original); expect(state.notifications).toEqual([]);
        // Remount then recover exactly the same accepted request, without a second grant.
        await page.evaluate(()=> (window as any).__marketLifetime.show());
        await expect(action).toContainText('Recover session');
        await action.click();
        await expect(page.locator('.training-club__receipt')).toContainText('Spent 100 Clout');
        expect(requests[1]).toEqual(original);
        const recovered = await page.evaluate(journal=>({...(window as any).__marketLifetime.snapshot(),pending:sessionStorage.getItem(journal)}),journal);
        expect(recovered.bootstrap.profile.softCurrency).toBe(4900);expect(recovered.pending).toBe(null);expect(recovered.notifications).toHaveLength(1);
      } else if(scenario==='account-change-before-response') {
        expect(state.bootstrap.profile.id).toBe('training-lifetime-b');expect(state.bootstrap.profile.softCurrency).toBe(7300);
        expect(state.pending).toEqual(original);expect(state.other).toBe(null);expect(state.notifications).toEqual([]);
        await expect(action).toBeEnabled();
      } else {
        expect(state.pending).toEqual(nextRequest);expect(state.bootstrap).toEqual(initial);expect(state.notifications).toEqual([]);
        await expect(page.getByRole('link',{name:'Recover purchase'})).toHaveAttribute('href','/game/style?view=finishes&item=tagged-style&card=kyle');
      }
      expect(errors).toEqual([]);
      report.push({scenario,passed:true,requests:requests.length});
      await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
    } finally {await page.close();}
  }
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
