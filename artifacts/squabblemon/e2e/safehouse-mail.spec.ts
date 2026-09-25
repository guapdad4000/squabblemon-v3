import { expect, test, type Page } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture';

async function setup(page: Page, empty = false) {
  // Other local work may trigger Vite reloads; keep this journey on one snapshot.
  await page.routeWebSocket('**', socket => socket.close());
  const bootstrap = profileBootstrap({ id: 'e2e-player', avatarKey: 'kyle' });
  const letter = { id: 'anniversary', title: 'One year on the block.', body: 'You made this city what it is. Thanks for being here. Here’s a little something from all of us.\n\nSee you on the streets.', sender: 'The Squabblemon Team', sentAt: '2026-09-25T12:00:00Z', readAt: null as string | null, claimedAt: null as string | null, gift: { softCurrency: 500, packTickets: 2, styleShards: 50 } };
  let failClaim = true, claims = 0, unavailable = false;
  await page.addInitScript(() => { localStorage.setItem('squabblemon_e2e_user', 'signed-in'); localStorage.removeItem('squabblemon_safehouse_lighting'); });
  await page.route('**/api/player/bootstrap', route => route.fulfill({ json: bootstrap }));
  await page.route('**/api/player/mail**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (unavailable) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    if (route.request().method() === 'GET') return route.fulfill({ json: { messages: empty ? [] : [letter] } });
    if (path.endsWith('/claim') && failClaim) { failClaim = false; return route.fulfill({ status: 409, json: { error: 'Retry delivery' } }); }
    letter.readAt ??= new Date().toISOString();
    const credited = path.endsWith('/claim') && !letter.claimedAt;
    if (credited) { claims++; letter.claimedAt = new Date().toISOString(); bootstrap.profile.softCurrency += 500; }
    return route.fulfill({ json: { mail: letter, credited } });
  });
  await page.goto('/squabblemon/game');
  await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-scene-ready','true',{timeout:60000});
  await expect(page.getByRole('button',{name:'Explore the mail door'})).toHaveAttribute('data-anchor-positioned','true');
  return { letter, claims: () => claims, fail: () => { unavailable = true; } };
}
for (const viewport of [{width:1440,height:900},{width:390,height:844}]) test(`mail door, read, claim retry, persisted state and close at ${viewport.width}px`,async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize(viewport);
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  const state=await setup(page); const door=page.getByRole('button',{name:'Explore the mail door'});
  await expect(door).toContainText('1');
  const scene=page.frames().find(f=>f.url().includes('/scenes/safehouse/'))!;
  await expect.poll(()=>scene.evaluate(()=>(window as any).Squabblemon.getSceneStatus().mail.unread)).toBe(1);
  if(viewport.width===1440) await page.screenshot({path:'/tmp/squabble-safehouse-mail-room.png'});
  await door.click(); const dialog=page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await expect.poll(()=>scene.evaluate(()=>(window as any).Squabblemon.getSceneStatus().mail.opened)).toBe(true);
  await page.getByRole('button',{name:/One year on the block/}).click();
  await expect(dialog).toContainText('0 unread');
  await expect.poll(()=>scene.evaluate(()=>(window as any).Squabblemon.getSceneStatus().mail.unread)).toBe(0);
  await page.screenshot({path:`/tmp/squabble-safehouse-mail-${viewport.width===1440?'delivery':'phone'}.png`});
  await page.getByRole('button',{name:'Claim your gift'}).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t save');
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByRole('button',{name:'Gift claimed ✓'})).toBeDisabled();
  expect(state.claims()).toBe(1);
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-view','room');
  await page.reload(); await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-scene-ready','true',{timeout:60000});
  await door.click(); await page.getByRole('button',{name:/One year on the block/}).click();
  await expect(page.getByRole('button',{name:'Gift claimed ✓'})).toBeDisabled();
  expect(state.claims()).toBe(1); expect(errors).toEqual([]);
});
test('empty mailbox, error recovery and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'}); const state=await setup(page,true);
  await page.getByRole('button',{name:'Explore the mail door'}).click();
  await expect(page.getByText('All quiet on the doorstep.')).toBeVisible();
  const scene=page.frames().find(f=>f.url().includes('/scenes/safehouse/'))!;
  expect(await scene.evaluate(()=>(window as any).Squabblemon.getSceneStatus().reduced)).toBe(true);
  state.fail(); await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t load your mail');
  await page.getByRole('button',{name:'Close mail',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
