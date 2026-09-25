import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
let claimed = false, claims = 0, date = '2026-09-25';
const daily = () => ({ date, available: !claimed, amount: 50, attemptsRemaining: 2, resetsAt: '2026-09-26T00:00:00Z' });
await page.route('**/api/**', route => {
 const path = new URL(route.request().url()).pathname;
 if (path.endsWith('/daily-clout/claim')) { claimed = true; claims++; return route.fulfill({ json: { claimed: true, status: daily() } }); }
 const json = path.endsWith('/daily-clout') ? daily() : path.endsWith('/mail') ? { messages: [{ id:'letter',title:'A gift for you',sender:'Buddy',readAt:null,claimedAt:null,gift:{softCurrency:10,packTickets:0,styleShards:0} }] } : path.endsWith('/account') ? { pending: [], growth: { ready: false } } : path.endsWith('/starter-mythic') ? { state: 'locked' } : {};
 return route.fulfill({ json });
});
try {
 for (const width of [1440, 768, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('http://127.0.0.1:4198/e2e/notifications.fixture.html');
  await expect(page.getByRole('button', { name: 'Claim free' })).toBeEnabled();
  const sizes = await page.locator('.city-header').evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.width);
  await page.screenshot({ path: `/tmp/notifications-${width}.png` });
 }
 await page.getByRole('button',{name:'Inspect Kyle'}).click();
 await expect(page.getByRole('button',{name:'Inspect Kyle'}).locator('.attention-mark')).toHaveCount(0);
 await page.reload();
 await expect(page.getByRole('button',{name:'Inspect Kyle'}).locator('.attention-mark')).toHaveCount(0);
 await page.getByRole('button',{name:/Notifications,/}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Mark new items as seen'}).click();
 await expect(page.getByRole('button',{name:/Your free 50 Clout is ready/})).toBeVisible();
 await expect(page.getByRole('button',{name:/A gift for you/})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'Claim free'}).click();
 await expect(page.getByRole('button',{name:'Claimed',exact:true})).toBeDisabled();
 expect(claims).toBe(1);
 await page.getByRole('button',{name:/Notifications,/}).click();
 await expect(page.getByRole('button',{name:/Your free 50 Clout is ready/})).toHaveCount(0);
 await page.keyboard.press('Escape');
 claimed = false; date = '2026-09-26';
 await page.reload();
 await page.getByRole('button',{name:/Notifications,/}).click();
 await expect(page.getByRole('button',{name:/Straight to the Back/})).toBeVisible();
 await expect(page.getByRole('button',{name:/Your free 50 Clout is ready/})).toBeVisible();
 await page.goto('http://127.0.0.1:4198/e2e/notifications.fixture.html?player=second-player');
 await expect(page.getByRole('button',{name:'Inspect Kyle'}).locator('.attention-mark')).toHaveCount(1);
 console.log('PASS: responsive header, persistent item reads, sticky rewards/mail, accessible dialog dismissal, daily claim state.');
} finally { await browser.close(); }
