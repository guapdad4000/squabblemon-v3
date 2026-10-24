import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import type { PackOpening } from '@workspace/api-client-react';
import { planShopPurchase, type ShopRequest } from '@workspace/squabblemon-engine/economy';
import { profileBootstrap } from './fighter-id.fixture';
const base=process.env.TRAINING_REVIEW_URL??'http://127.0.0.1:4319';
const out=process.env.PURCHASE_RECOVERY_OUTPUT??'/tmp/purchase-recovery';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/google-chrome',args:['--no-sandbox']});
const report:unknown[]=[];
const initial=profileBootstrap({id:'recovery-player-a',softCurrency:5000,packTickets:7,settings:{reducedMotion:true,turnTimerEnabled:true}});
const journal=`squabblemon.shop.pending.v1:${initial.profile.id}`;
const original:ShopRequest={itemId:'ticket',idempotencyKey:'16cd92ec-6f16-41ba-8652-98ce19064b09'};
const newer:ShopRequest={itemId:'training',cardId:'kyle',idempotencyKey:'16cd92ec-6f16-41ba-8652-98ce19064b10'};
const scenarios=['ticket-lost-response','ticket-unmount','ticket-account-change','ticket-newer-success','ticket-newer-terminal','pack-account-change','pack-unmount','pack-newer-request','pack-newer-opening'] as const;
try {
  for(const scenario of scenarios){
    if(process.env.PURCHASE_RECOVERY_CASES && !process.env.PURCHASE_RECOVERY_CASES.split(',').includes(scenario)) continue;
    const ticket=scenario.startsWith('ticket');
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await page.routeWebSocket('**',socket=>socket.close());
    await page.addInitScript(({ticket,journal,original})=>{
      if(ticket)sessionStorage.setItem(journal,JSON.stringify(original));
      (window as any).__lateSounds=[];
      HTMLMediaElement.prototype.play=function(){(window as any).__lateSounds.push(this.currentSrc||this.src);return Promise.resolve();};
    },{ticket,journal,original});
    const errors:string[]=[],requests:any[]=[];page.on('pageerror',error=>errors.push(error.message));
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
    let completed=false,commits=0,current=initial;
    const ledger=new Map<string,unknown>();
    let opening:PackOpening|undefined;
    const newerPackRequest={idempotencyKey:'pack-b-newer-request',paymentMethod:'ticket',pullCount:7,bannerId:'standard'};
    const newerPackOpening:PackOpening={id:'pack-b-saved-opening',oddsVersion:'street-pack-v1',paymentMethod:'ticket',cost:1,pullCount:1,pityBefore:0,pityAfter:1,createdAt:'2026-10-24T12:01:00.000Z',rewards:[{kind:'softCurrency',cardId:null,variantId:null,name:'Clout',rarity:null,isNew:false,amount:72}]};
    await page.route('**/api/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path.endsWith('/shop/purchases')){
        const request=route.request().postDataJSON() as ShopRequest;requests.push(request);
        if(scenario!=='ticket-lost-response')await gate;
        if(scenario==='ticket-newer-terminal'){await route.fulfill({status:409,json:{error:'Terminal saved request'}});completed=true;return;}
        if(!ledger.has(request.idempotencyKey)){
          const planned=planShopPurchase(current.profile,request);commits++;
          current={...current,profile:{...current.profile,...planned.wallet}};
          ledger.set(request.idempotencyKey,{receipt:planned.receipt,bootstrap:current});
        }
        if(scenario==='ticket-lost-response'&&requests.length===1)await route.fulfill({status:503,json:{error:'Committed response lost'}});
        else await route.fulfill({json:ledger.get(request.idempotencyKey)});
        completed=true;return;
      }
      if(path.endsWith('/packs/open')){
        const request=route.request().postDataJSON();requests.push(request);await gate;
        opening={id:request.idempotencyKey,oddsVersion:'street-pack-v1',paymentMethod:'softCurrency',cost:200,pullCount:1,pityBefore:initial.packConfig.pityLimit-1,pityAfter:0,createdAt:'2026-10-24T12:00:00.000Z',rewards:[{kind:'softCurrency',cardId:null,variantId:null,name:'Clout',rarity:null,isNew:false,amount:30}]};
        await route.fulfill({json:{opening,bootstrap:{...initial,profile:{...initial.profile,softCurrency:4830,packHistory:[opening]}}}});completed=true;return;
      }
      if(path.endsWith('/packs/welcome'))return route.fulfill({json:{available:false,supportsFlexibleBatches:true,serverNow:Date.now()}});
      if(path.endsWith('/bootstrap'))return route.fulfill({json:current});
      return route.fulfill({status:503,json:{error:`Isolated recovery fixture: ${path}`}});
    });
    try {
      await page.goto(`${base}/e2e/purchase-recovery.fixture.html?view=packs`,{waitUntil:'domcontentloaded'});
      const recover=page.getByRole('button',{name:'Recover ticket purchase',exact:true});
      if(ticket){
        await expect(recover).toBeVisible();await expect(recover).toBeEnabled();
        if(scenario==='ticket-lost-response'){
          await page.screenshot({path:`${out}/ticket-recovery-phone.png`});
          expect((await recover.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
          expect(await recover.evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toContain('gradient');
        }
        await recover.click();
      }else await page.getByRole('button',{name:/^Open.*Clout$/}).click();
      await expect.poll(()=>requests.length).toBe(1);
      if(scenario==='ticket-lost-response'){
        await expect(page.locator('.legacy-ticket-recovery [role=alert]')).toContainText('Not confirmed');
        expect(await page.evaluate(journal=>JSON.parse(sessionStorage.getItem(journal)!),journal)).toEqual(original);
        await recover.click();await expect(page.locator('.legacy-ticket-recovery')).toHaveCount(0);
      }else{
        if(scenario.endsWith('unmount'))await page.evaluate(()=> (window as any).__purchaseRecovery.hide());
        else if(scenario.endsWith('account-change')){
          await page.evaluate(()=> (window as any).__purchaseRecovery.switchAccount());
          await expect.poll(()=>page.evaluate(()=> (window as any).__purchaseRecovery.snapshot().bootstrap.profile.id)).toBe('recovery-player-b');
        }else if(scenario.startsWith('pack-newer')) {
          await page.evaluate(({scenario,newerPackRequest,newerPackOpening})=>{
            // A has already been recovered and consumed elsewhere; B now owns this account's journal.
            sessionStorage.removeItem('squabblemon:pack-request:recovery-player-a');
            if(scenario==='pack-newer-request') sessionStorage.setItem('squabblemon:pack-request:recovery-player-a',JSON.stringify(newerPackRequest));
            else sessionStorage.setItem('squabblemon:pack-reveal:recovery-player-a',JSON.stringify(newerPackOpening));
          },{scenario,newerPackRequest,newerPackOpening});
        }else await page.evaluate(({journal,newer})=>sessionStorage.setItem(journal,JSON.stringify(newer)),{journal,newer});
        const soundsBefore=await page.evaluate(()=> (window as any).__lateSounds.length);
        release();await expect.poll(()=>completed).toBe(true);await page.waitForTimeout(150);
        if(!ticket)expect(await page.evaluate(()=> (window as any).__lateSounds.length)).toBe(soundsBefore);
      }
      const state=await page.evaluate(journal=>({...(window as any).__purchaseRecovery.snapshot(),pending:JSON.parse(sessionStorage.getItem(journal)??'null'),saved:JSON.parse(sessionStorage.getItem('squabblemon:pack-reveal:recovery-player-a')??'null'),newSaved:sessionStorage.getItem('squabblemon:pack-reveal:recovery-player-b'),packPending:JSON.parse(sessionStorage.getItem('squabblemon:pack-request:recovery-player-a')??'null')}),journal);
      if(scenario==='ticket-lost-response'){
        expect(requests).toEqual([original,original]);expect(commits).toBe(1);expect(state.pending).toBe(null);
        expect(state.bootstrap.profile.softCurrency).toBe(4800);expect(state.bootstrap.profile.packTickets).toBe(8);expect(state.notifications).toHaveLength(1);
      }else{
        expect(state.notifications).toEqual([]);
        if(scenario.endsWith('account-change')){expect(state.bootstrap.profile.id).toBe('recovery-player-b');expect(state.bootstrap.profile.softCurrency).toBe(7300);}
        else expect(state.bootstrap).toEqual(initial);
        if(ticket)expect(state.pending).toEqual(scenario.startsWith('ticket-newer')?newer:original);
        else if(scenario==='pack-newer-request'){
          expect(state.packPending).toEqual(newerPackRequest);expect(state.saved).toBe(null);
          await expect(page.locator('.gacha-stage')).toHaveAttribute('data-phase','idle');
          await expect(page.getByRole('button',{name:'Retry this opening'})).toBeVisible();
        }else if(scenario==='pack-newer-opening'){
          expect(state.saved).toEqual(newerPackOpening);expect(state.packPending).toBe(null);
          await expect(page.locator('.gacha-stage')).toHaveAttribute('data-phase','summary');
          await expect(page.locator('.gacha-reveal-dialog')).toBeVisible();
          await expect(page.locator('.pack-gym-finale')).toHaveCount(0);
        }else{expect(state.saved).toEqual(opening);expect(state.newSaved).toBe(null);}
      }
      expect(errors).toEqual([]);report.push({scenario,passed:true,requests:requests.length,commits});
      await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
    }finally{await page.close();}
  }
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
