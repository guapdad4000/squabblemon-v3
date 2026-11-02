import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const origin = process.env.DESIGN_ORIGIN ?? 'http://127.0.0.1:5194';
const output = process.env.DESIGN_OUTPUT ?? '/tmp/kumite-design-states';
mkdirSync(output, { recursive:true });
const browser = await chromium.launch({ headless:true });
const report = [];
async function capture(page, name, width) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(image => {
      const r=image.getBoundingClientRect(); return r.width && r.height && r.top<innerHeight && r.bottom>0;
    }).map(image => image.decode()));
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} has no horizontal overflow`);
  await page.screenshot({path:`${output}/${name}-${width}.png`,fullPage:true,animations:'disabled'});
}
try {
  for (const [width,height] of [[320,568],[390,844],[844,390],[1440,960]]) {
    const page = await browser.newPage({ viewport:{width,height}, reducedMotion:'reduce' });
    const errors=[], posts=[];
    page.on('pageerror', e=>errors.push(e.message));
    page.on('request', r=>{if(r.method()==='POST') posts.push(r.url());});
    await page.goto(`${origin}/e2e/anunaki-event.fixture.html?ready`);
    const opener=page.getByRole('button',{name:/follow the ancient text/i});
    await opener.focus(); await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('.anunaki-roadmap__step').count(),24);
    await capture(page,'event-ready',width);
    await page.getByRole('button',{name:'Claim reward',exact:true}).click();
    await page.getByText('Reward collected.',{exact:true}).waitFor();
    assert.match(await page.locator('.anunaki-roadmap__step').first().innerText(),/COLLECTED/);
    await capture(page,'event-claimed',width);
    await page.keyboard.press('Escape');
    assert.equal(await opener.evaluate(e=>document.activeElement===e),true,'dialog restores focus');
    await page.goto(`${origin}/e2e/kumite-practice.fixture.html?empty`);
    await page.getByRole('heading',{name:'CHOOSE YOUR CREW'}).waitFor();
    await page.getByRole('button',{name:'TRY AGAIN'}).click();
    assert.match(await page.getByRole('alert').innerText(),/ten-card crew/);
    await capture(page,'practice-empty',width);
    await page.getByRole('button',{name:'BACK TO KUMITE'}).click();
    assert.equal(await page.evaluate(()=>document.body.dataset.exited),'true');
    if(width===390 || width===1440) {
      await page.goto(`${origin}/e2e/kumite-practice.fixture.html`);
      for(let round=0;round<6;round++) {
        const end=page.getByRole('button',{name:'END TURN →',exact:true});
        await end.waitFor({timeout:30000});
        await end.click();
        // The real engine result waits for each visible round animation.
        await page.waitForFunction(()=>!!document.querySelector('.kumite-practice-result') || [...document.querySelectorAll('button')].some(b=>b.textContent==='END TURN →'&&!b.disabled),null,{timeout:30000});
        if(await page.locator('.kumite-practice-result').count()) break;
      }
      await page.getByRole('heading',{name:'ROUND FINISHED'}).waitFor({timeout:30000});
      await capture(page,'practice-result',width);
      await page.getByRole('button',{name:'TRY AGAIN'}).click();
      await page.getByRole('button',{name:'END TURN →',exact:true}).waitFor();
    }
    assert.deepEqual(posts,[],'local practice never sends reward or match writes');
    assert.deepEqual(errors,[]);
    report.push({width,height,eventClaim:true,focusRestored:true,practiceError:true,practiceResult:width===390||width===1440,localWrites:0,overflow:false,pageErrors:0});
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
