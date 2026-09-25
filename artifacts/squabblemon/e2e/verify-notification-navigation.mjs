import { chromium, expect } from '@playwright/test';
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4273';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args:['--no-sandbox'] });
const errors = [];
try {
 for (const width of [1440,390]) {
  const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  let read = false;
  const letter = () => ({id:'specific-letter',title:'Open THIS letter',body:'The right letter',sender:'Buddy',sentAt:'2026-09-25',readAt:read?'2026-09-25':null,claimedAt:null,gift:{softCurrency:0,packTickets:0,styleShards:0}});
  await context.route('**/api/**', route => {
   const p = new URL(route.request().url()).pathname;
   if (p.endsWith('/specific-letter/read')) {read=true; return route.fulfill({json:{mail:letter(),credited:false}});}
   return route.fulfill({json:p.endsWith('/payments/catalog')?{enabled:false,offers:[]}:p.endsWith('/mail')?{messages:[letter()]}:p.endsWith('/daily-clout')?{date:'2026-09-25',available:true,amount:50,attemptsRemaining:2,resetsAt:'2026-09-26'}:p.endsWith('/account')?{pending:[],growth:{ready:false}}:p.endsWith('/starter-mythic')?{state:'claimed',chapters:[]}:{}});
  });
  const fixtureHtml = await (await context.request.get(base+'/e2e/notification-navigation.fixture.html')).text();
  await context.route('**/game**', route => route.request().resourceType()==='document' ? route.fulfill({contentType:'text/html',body:fixtureHtml}) : route.continue());
  await page.goto(base+'/e2e/notification-navigation.fixture.html');
  await page.evaluate(() => sessionStorage.setItem('squabblemon:navigation:collection-tab:notification-navigation','"road"'));
  const bell=page.getByRole('button',{name:/Notifications,/});
  await bell.click();
  const rows=page.locator('.notification-item').filter({hasText:'New card ·'});
  const target = await rows.last().innerText();
  await rows.last().click();
  await expect(page.getByTestId('button-view-catalog')).toHaveAttribute('aria-pressed','true');
  const outlined=page.locator('[data-notification-focus="true"]');
  await expect(outlined).toHaveCount(1);
  const id=await outlined.getAttribute('data-notification-id');
  await expect(outlined.getByRole('img',{name:'New item',exact:true})).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(outlined.getByRole('img',{name:'New item',exact:true})).toBeVisible();
  expect(await outlined.evaluate(el=>getComputedStyle(el).outlineWidth)).toBe('4px');
  await page.screenshot({path:`/tmp/notification-card-${width}.png`});
  // Scroll out of the inner catalog, not just the outer page.
  await page.locator('.collection-stage__body').evaluate(el => {el.scrollTop=0;});
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('squabblemon:seen:v1:notification-navigation')||'[]').includes(id),id)).toBe(true);
  await expect(page.locator(`[data-notification-id="${id}"]`).getByRole('img',{name:'New item',exact:true})).toHaveCount(0);
  await bell.click(); await expect(page.locator('.notification-item').filter({hasText:target.split('\n').filter(Boolean).find(x=>x.includes('New card'))})).toHaveCount(0);
  await page.getByRole('button',{name:'Close notifications'}).click();
  await page.reload(); await bell.click();
  await expect(page.locator('.notification-item').filter({hasText:target.split('\n').filter(Boolean).find(x=>x.includes('New card'))})).toHaveCount(0);
  // Exact letter opens and its server receipt removes the bell notice.
  await page.locator('.notification-item').filter({hasText:'Open THIS letter'}).click();
  await expect(page.getByText('The right letter')).toBeVisible();
  await expect.poll(()=>read).toBe(true);
  await page.getByRole('button',{name:'Close mail',exact:true}).click();
  await bell.click(); await expect(page.locator('.notification-item').filter({hasText:'Open THIS letter'})).toHaveCount(0);
  await page.locator('.notification-item').filter({hasText:/New style · KYLE · Sticker pack/}).click();
  await expect(page.getByRole('button',{name:'01 / Sticker pack'})).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('squabblemon:seen:v1:notification-navigation')||'[]').includes('style:style:kyle:stickers'))).toBe(true);
  // Repeat a bell link on the same collection route and acknowledge by clicking away.
  await bell.click();
  await page.locator('.notification-item').filter({hasText:'New card ·'}).first().click();
  const clickedCard = page.locator('[data-notification-focus="true"]');
  await expect(clickedCard).toHaveCount(1);
  const clickId = await clickedCard.getAttribute('data-notification-id');
  await page.waitForTimeout(800);
  await expect(clickedCard.getByRole('img',{name:'New item',exact:true})).toBeVisible();
  await page.getByRole('heading',{name:'The collection.'}).click();
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('squabblemon:seen:v1:notification-navigation')||'[]').includes(id),clickId)).toBe(true);
  // Back-to-back navigation without time to view must not consume a new card.
  await bell.click(); await page.locator('.notification-item').filter({hasText:'New card ·'}).first().click();
  const quick = page.locator('[data-notification-focus="true"]');
  await expect(quick).toHaveCount(1);
  const quickId = await quick.getAttribute('data-notification-id');
  await page.getByRole('button',{name:'Home',exact:true}).click();
  expect(await page.evaluate(id=>JSON.parse(localStorage.getItem('squabblemon:seen:v1:notification-navigation')||'[]').includes(id),quickId)).toBe(false);
  await bell.click();
  await page.locator('.notification-item').filter({hasText:/New finish · Kyle/i}).click();
  await expect(page.getByRole('dialog',{name:/Kyle.*card details/i})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('squabblemon:seen:v1:notification-navigation')||'[]').includes('style:kyle:tagged'))).toBe(true);
  await page.getByRole('button',{name:'Close card details'}).click();
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await bell.click(); await page.locator('.notification-item').filter({hasText:'In the store · Down the rabbit hole'}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Down the rabbit hole'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('squabblemon:seen:v1:notification-navigation')||'[]').includes('offer:wonder-pack'))).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await bell.click(); await page.locator('.notification-item').filter({hasText:'Bounty available · Specific bounty 19'}).click();
  await expect(page.locator('[data-mission-id="test-19"]')).toBeInViewport();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('squabblemon:seen:v1:notification-navigation')||'[]').some(id=>id.startsWith('mission:test-19:')))).toBe(true);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('squabblemon:seen:v1:notification-navigation')||'[]').some(id=>id.startsWith('mission:test-0:')))).toBe(false);
  // Missing target must remain unread.
  await page.evaluate(()=>history.pushState({},'', '/game/collection?card=missing&notification=card:missing'));
  await page.waitForTimeout(900);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('squabblemon:seen:v1:notification-navigation')||'[]').includes('card:missing'))).toBe(false);
  // Acknowledgement in another tab clears the existing tab without a reload.
  const second = await context.newPage();
  await second.goto(base+'/e2e/notification-navigation.fixture.html');
  await second.getByRole('button',{name:/Notifications,/}).click();
  await second.getByRole('button',{name:'Clear all',exact:true}).click();
  await bell.click();
  await expect(page.locator('.notification-item').filter({hasText:'New card ·'})).toHaveCount(0);
  await expect(page.locator('.notification-item')).toHaveCount(0);
  await context.close();
 }
 expect(errors).toEqual([]);
 console.log('PASS: exact card navigation, saved-tab override, visible highlight, delayed scroll-away receipt, reload persistence, exact mail, cosmetics and finish previews, exact offers and bounties, unseen bounty protection, cross-tab receipts, missing-target protection, desktop/mobile, no page errors.');
} finally {await browser.close();}
