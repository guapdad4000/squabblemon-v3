import { chromium, expect } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture.ts';
import { planShopPurchase } from '@workspace/squabblemon-engine/economy';
import { CARD_XP_CAP } from '@workspace/squabblemon-engine/cardProgression';
import { mkdir, writeFile } from 'node:fs/promises';

// Real Shop -> Market, production styles/providers, isolated HTTP ledger. No live purchases.
const base = process.env.TRAINING_REVIEW_URL ?? 'http://127.0.0.1:4319';
const out = process.env.TRAINING_REVIEW_OUTPUT ?? '/tmp/training-studio-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox'] });
const report = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]]) {
    if (process.env.TRAINING_REVIEW_VIEWPORT && process.env.TRAINING_REVIEW_VIEWPORT !== name) continue;
    const page = await browser.newPage({ baseURL: base, viewport: { width, height }, hasTouch: width < 800 });
    await page.routeWebSocket('**', socket => socket.close());
    const errors = [], requests = [], ledger = new Map();
    page.on('pageerror', error => errors.push(error.message));
    let current = profileBootstrap({ id: `training-review-${name}`, softCurrency: 5000,
      cardProgression: { kyle: { xp: 0, level: 1, moveTier: 0 }, rastamon: { xp: 0, level: 1, moveTier: 0 } } });
    const journal = `squabblemon.shop.pending.v1:${current.profile.id}`;
    let loseResponse = false, gate = null;
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/shop/purchases')) {
        const request = route.request().postDataJSON();
        requests.push(request);
        if (gate) await gate;
        if (!ledger.has(request.idempotencyKey)) {
          const planned = planShopPurchase(current.profile, request);
          current = { ...current, profile: { ...current.profile, ...planned.wallet } };
          ledger.set(request.idempotencyKey, structuredClone({ receipt: planned.receipt, bootstrap: current }));
        }
        if (loseResponse) { loseResponse = false; return route.fulfill({ status: 503, json: { error: 'Committed response lost' } }); }
        return route.fulfill({ json: ledger.get(request.idempotencyKey) });
      }
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: current });
      if (path.endsWith('/mail')) return route.fulfill({ json: { messages: [] } });
      if (path.endsWith('/notifications/receipts')) return route.fulfill({ json: { ids: route.request().method() === 'POST' ? route.request().postDataJSON().ids : [] } });
      if (path.endsWith('/account')) return route.fulfill({ json: { pending: [], growth: { ready: false, tasks: [], totalPlants: 0 } } });
      if (path.endsWith('/starter-mythic')) return route.fulfill({ json: { state: 'claimed', chapters: [] } });
      return route.fulfill({ status: 503, json: { error: `Isolated Training fixture: ${path}` } });
    });
    const open = async (query = '') => {
      await page.goto(`/e2e/payment-store.fixture.html?view=training${query}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.training-club__ticket')).toBeVisible();
    };
    const passes = page.getByRole('navigation', { name: 'Training sessions' });
    const action = page.locator('[data-training-purchase]');
    const ticket = page.locator('.training-club__ticket');
    const receipt = page.locator('.training-club__receipt');
    const session = page.locator('.training-session');
    const select = item => page.locator(`[data-training-offer="${item}"]`).click();
    const saved = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), journal);
    const checks = [];
    try {
      await open();
      await expect(passes.getByRole('button')).toHaveCount(3);
      expect(await passes.locator('button').evaluateAll(buttons => buttons.map(button => button.dataset.trainingOffer))).toEqual(['training', 'training-intensive', 'move-training']);
      await expect(page.locator('.market-checkout,.market-offers,.market-layout,.market-footnote')).toHaveCount(0);
      await expect(page.locator('.training-club__wallet')).toHaveAccessibleName('5,000 Clout available');
      await page.locator('.training-studio img').evaluateAll(images => Promise.all(images.map(img => img.decode().catch(() => {}))));
      await page.evaluate(() => document.fonts.ready);
      expect(await page.locator('.training-studio img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await passes.locator('button').evaluateAll(buttons => buttons.every(el => el.scrollWidth <= el.clientWidth + 1))).toBe(true);
      const geometry = await page.locator('.training-studio').evaluate(el => {
        const rect = selector => { const r = el.querySelector(selector).getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height }; };
        return { stage: { clientHeight:el.clientHeight,scrollHeight:el.scrollHeight }, fighter:rect('.training-club__fighter > img'), ticket:rect('.training-club__ticket'), passes:rect('.training-club__passes'), borders:[...el.querySelectorAll('.training-club__passes > button,.training-club__ticket')].map(e => getComputedStyle(e).borderTopWidth), titleFont:getComputedStyle(el.querySelector('h1')).fontFamily };
      });
      expect(geometry.borders).toEqual(['0px', '0px', '0px', '0px']);
      if (width > 800) { expect(geometry.fighter.height).toBeGreaterThanOrEqual(300); expect(geometry.ticket.width).toBeGreaterThan(450); }
      await page.screenshot({ path: `${out}/${name}-training-club.png` });
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
      expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await ticket.screenshot({ path: `${out}/${name}-coaching-ticket.png` });
      checks.push('Exactly three paper passes; decoded original artwork; readable full-size portrait/ticket; no old panel wrappers, x-overflow or inaccessible purchase action.');

      // Normal HTTP purchase: original animated character remains visible during confirmation.
      await action.click();
      await expect(session).toBeVisible();
      await expect(action).toBeDisabled();
      await action.evaluate(button => { button.click(); button.click(); });
      const sprite = session.locator('.training-session__sprite');
      await expect(sprite).toHaveCSS('animation-name', 'inmate-workout');
      await expect(sprite).toHaveCSS('background-image', /inmate-quick-sheet\.webp/);
      const frameA = await sprite.evaluate(el => getComputedStyle(el).backgroundPosition);
      await page.waitForTimeout(240);
      expect(await sprite.evaluate(el => getComputedStyle(el).backgroundPosition)).not.toBe(frameA);
      await session.screenshot({ path: `${out}/${name}-animated-reps.png` });
      await expect(receipt).toContainText('Reps complete');
      await expect(receipt).toContainText('Spent 100 Clout');
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ itemId:'training', cardId:'kyle' });
      expect(current.profile.cardProgression.kyle).toMatchObject({ xp:100,level:2,moveTier:0 });
      await expect(page.locator('.training-club__wallet')).toHaveAccessibleName('4,900 Clout available');
      checks.push('Normal training sends one HTTP request despite repeated taps; original sprite advances; confirmed 100 XP and 100 Clout receipt update from server bootstrap.');

      await select('move-training');
      await action.click();
      await expect(session.locator('.training-session__sprite--moves')).toBeVisible();
      await expect(session.locator('.training-session__sprite')).toHaveCSS('background-image', /inmate-moves-sheet\.webp/);
      await expect(receipt).toContainText('Move learned');
      expect(current.profile.cardProgression.kyle.moveTier).toBe(1);
      checks.push('Eligible move purchase preserves boxing sprite and shows actual unlocked move.');

      // Commit in the mock ledger, then lose the first response and reload with conflicting URL intent.
      await select('training-intensive');
      await page.locator('#shop-card').click();
      await page.getByRole('option', { name:'Rastamon', exact:true }).click();
      loseResponse = true;
      await action.click();
      await expect(ticket.getByRole('alert')).toContainText('Purchase not confirmed');
      await expect(session).toHaveCount(0);
      await expect(receipt).toHaveCount(0);
      const failed = structuredClone(requests.at(-1));
      expect(failed).toMatchObject({ itemId:'training-intensive',cardId:'rastamon' });
      expect(await saved()).toEqual(failed);
      const balanceAfterCommit = current.profile.softCurrency;
      await open('&item=training&card=kyle');
      await expect(page.locator('[data-training-offer="training-intensive"]')).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('#shop-card')).toHaveAttribute('data-value','rastamon');
      await expect(page.locator('#shop-card')).toBeDisabled();
      await expect(action).toContainText('Recover session');
      await action.click();
      await expect(receipt).toContainText('Spent 225 Clout');
      expect(requests.at(-1)).toEqual(failed);
      expect(current.profile.softCurrency).toBe(balanceAfterCommit);
      expect(current.profile.cardProgression.rastamon.xp).toBe(250);
      expect(ledger.size).toBe(3);
      expect(requests).toHaveLength(4);
      expect(await saved()).toBeNull();
      checks.push('Committed/lost response recovers after reload with identical item, card and key; conflicting URL cannot redirect the purchase; ledger charges once.');

      const foreign = { itemId:'player-mat', idempotencyKey:'45f3c28b-5e48-4cac-8a60-94bf4f1b38bd' };
      await page.evaluate(({ key, value }) => sessionStorage.setItem(key,JSON.stringify(value)), { key:journal,value:foreign });
      await action.click();
      await expect(ticket.getByRole('link',{name:/Recover purchase/})).toHaveAttribute('href','/game/style?view=mats');
      await expect(action).toBeDisabled();
      expect(requests).toHaveLength(4);
      expect(await saved()).toEqual(foreign);
      checks.push('Foreign journal inserted after mount is preserved, blocks HTTP training, and points to the actual mat recovery counter.');
      await page.evaluate(key => sessionStorage.removeItem(key),journal);

      // Exact near-cap quote, with both preference paths covered across two layouts.
      current.profile.cardProgression.kyle = { xp:CARD_XP_CAP - 10,level:9,moveTier:3 };
      current.profile.settings.reducedMotion = name === 'desktop';
      await page.emulateMedia({ reducedMotion:name === 'phone' ? 'reduce' : 'no-preference' });
      await open('&item=training-intensive&card=kyle');
      await expect(ticket.locator('.training-club__lesson')).toContainText('+10 XP');
      await expect(action).toContainText('9 Clout');
      const beforeCap = current.profile.softCurrency;
      let release;
      gate = new Promise(resolve => { release=resolve; });
      await action.click();
      await expect(session).toHaveAttribute('data-reduced-motion','true');
      await expect(session.locator('.training-session__sprite')).toHaveCSS('animation-name','none');
      const releasedAt = Date.now(); release(); gate=null;
      await expect(receipt).toContainText('Spent 9 Clout',{ timeout:1500 });
      const reducedReceiptMs = Date.now() - releasedAt;
      expect(reducedReceiptMs).toBeLessThan(1500);
      expect(current.profile.softCurrency).toBe(beforeCap - 9);
      expect(current.profile.cardProgression.kyle.xp).toBe(CARD_XP_CAP);
      checks.push(`${name === 'desktop' ? 'Profile' : 'System'} reduced motion uses static sprite/no forced hold; near-cap intensive quote grants exactly 10 XP for 9 Clout.`);

      await open('&item=move-training&card=kyle');
      await expect(ticket).toContainText('All three moves learned');
      await expect(ticket).toContainText('All three move tiers are already active.');
      await expect(action).toBeDisabled();
      await action.evaluate(button => button.click());
      expect(requests).toHaveLength(5);
      await select('training');
      await expect(action).toBeDisabled();
      await expect(ticket).toContainText('This character is already at maximum level.');
      expect(requests).toHaveLength(5);
      checks.push('All three move tiers and maximum XP disable purchase, with truthful cap explanation and no HTTP request.');
      expect(errors).toEqual([]);
      report.push({ name,width,height,geometry,requests,ledgerGrants:ledger.size,reducedReceiptMs,checks,errors });
      console.log(`${name}: layout, animation, HTTP purchase, same-key recovery, fresh foreign journal, XP cap, max moves and reduced motion PASS`);
    } catch (error) {
      await page.screenshot({ path:`${out}/${name}-failure.png` }).catch(()=>{});
      await writeFile(`${out}/${name}-failure.json`,JSON.stringify({ error:String(error),requests,errors,url:page.url(),text:await ticket.innerText().catch(()=>null) },null,2));
      throw error;
    } finally { await page.close(); }
  }
} finally { await browser.close(); await writeFile(`${out}/report.json`, JSON.stringify(report,null,2)); }
