import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { installFadecadeApi, fadecadeBootstrap } from "./fadecade.fixture.ts";
const origin = process.env.UI_ORIGIN ?? "http://127.0.0.1:4198";
assert(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
});
async function ready(page) {
  for (let n = 0; n < 300; n++) {
    const lesson = page.getByRole("button", {
      name: "Back to the battle",
      exact: true,
    });
    if (await lesson.isVisible())
      await lesson.click({ timeout: 600 }).catch(() => {});
    else if (
      await page
        .locator(
          '[data-testid="battle-arena"][data-presentation-phase="player-ready"]',
        )
        .count()
    )
      return;
    else {
      const skip = page
        .getByRole("button", { name: /Fast forward|Continue past/ })
        .first();
      if (await skip.isVisible())
        await skip.click({ timeout: 500 }).catch(() => {});
    }
    await page.waitForTimeout(75);
  }
  throw Error("Player controls did not recover");
}

try {
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
 const page=await context.newPage(); await page.routeWebSocket('**',()=>{});
 const api=await installFadecadeApi(page); let failSave=true;
 await page.route('**/api/player/matches/*/complete',async r=>{
  if(failSave)return r.fulfill({status:503,json:{error:'Interrupted receipt'}});
  await r.fallback();
 });
 await page.goto(origin+'/game/challenges');
 await page.getByRole('button',{name:'Open Straight to the Back road',exact:true}).click();
 await page.getByRole('button',{name:'Start run · 1 entry',exact:true}).click();
 for(let i=0;i<6;i++){await ready(page);await page.getByRole('button',{name:'End Turn',exact:true}).click(); await page.waitForTimeout(350);}
 for(let i=0;i<200 && !await page.getByRole('button',{name:'Retry Save',exact:true}).isVisible();i++){
 const skip=page.getByRole('button',{name:/Fast forward|Continue past/}).first();
 if(await skip.isVisible())await skip.click().catch(()=>{});
 const lesson=page.getByRole('button',{name:'Back to the battle',exact:true});
 if(await lesson.isVisible())await lesson.click().catch(()=>{});
 await page.waitForTimeout(100);
 }

 await page.getByRole('button',{name:'Retry Save',exact:true}).waitFor({timeout:1000});
 assert.equal(await page.getByRole('button',{name:'View run summary',exact:true}).isEnabled(),false);
 failSave=false;await page.reload();
 await page.getByRole('button',{name:'Continue road',exact:true}).click();
 await page.getByRole('button',{name:'Continue fight',exact:true}).click();
 await page.getByRole('button',{name:'View run summary',exact:true}).waitFor({timeout:30000});
 assert.equal(api.requests.completions.length,1);
 await page.getByRole('button',{name:'View run summary',exact:true}).click();
 await page.locator('.fadecade-road-view:not(.is-compact)[data-phase="defeat"]').waitFor();
 assert.equal(api.requests.starts.length,1);
 await page.screenshot({path:'screenshots/release/road-recovered-defeat.png'});
 await page.getByRole('button',{name:'Start run · 1 entry',exact:true}).click();
 await ready(page);
 await page.getByLabel('Battle menu',{exact:true}).click();
 await page.getByRole('button',{name:'Leave battle',exact:true}).click();
 await page.getByRole('button',{name:'End run',exact:true}).click();
 await page.getByRole('button',{name:'End run now',exact:true}).click();
 await page.locator('.fadecade-road-view:not(.is-compact)[data-phase="defeat"]').waitFor();
 assert.equal(api.requests.abandons,1);
 console.log('PASS explicit quit and final checkpoint recovery, save gating, single receipt and defeat');
}finally{await browser.close();}
