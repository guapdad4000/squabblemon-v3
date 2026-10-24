import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture.ts';
import { accountRewardStatus } from '../../../lib/squabblemon-engine/src/accountRewards.ts';
import { cardCatalog, STORY_ONLY_CARD_IDS, isKumiteExclusiveCard } from '../../../lib/squabblemon-engine/src/data.ts';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4245';
const output = process.env.MONTHLY_LOGIN_OUTPUT ?? 'screenshots/monthly-login/daily';
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
const report = [];
try {
  for (const [width, height] of [[1440,960],[390,844],[320,568],[844,390]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];page.on('pageerror', error => errors.push(error.message));
    await page.routeWebSocket('**', socket => socket.close());
    const player = `monthly-arrival-${width}`, date = '2026-10-30', now = new Date(`${date}T12:00:00Z`);
    const receipts = [{ key: 'first-login', title: 'First', softCurrency: 0, packTickets: 0, styleShards: 0 }];
    if (width === 844) for (let i = 1; i <= 29; i++) {
      const day = `2026-10-${String(i).padStart(2, '0')}`;
      receipts.push({ key: `login:${day}`, date: day, streak: i, title: 'Saved', softCurrency: 0, packTickets: 0, styleShards: 0 });
    }
    if (width === 390) receipts.push({ key: 'monthly-login:2026-10:Common', date: '2026-10-15', cardId: 'snow-bunny', cardName: 'Old card receipt', cardRarity: 'Common', isNewCard: true, title: 'Saved', softCurrency: 0, packTickets: 0, styleShards: 0 });
    let status = accountRewardStatus(1, new Date('2025-01-01Z'), receipts, now);
    const bootstrap = profileBootstrap({ id: player });bootstrap.profile.ownedCardIds = [];
    let claims = 0, committed = false, issued = [];
    await page.route('**/api/**', async route => {
      if (!new URL(route.request().url()).pathname.endsWith('/rewards/account/claim')) return route.fulfill({ json: status });
      claims++;
      let rewards = [];
      if (!committed) {
        rewards = status.pending.map(value => {
          if (!value.cardRarity) return value;
          const card = cardCatalog.find(card => card.rarity === value.cardRarity && !STORY_ONLY_CARD_IDS.includes(card.catalogId) && !isKumiteExclusiveCard(card.catalogId));
          return { ...value, cardId: card.catalogId, cardName: card.name, isNewCard: width !== 320, ...(width === 320 ? { styleShards: 5, shardRarity: 'Common' } : {}) };
        });
        issued = rewards;receipts.push(...rewards);committed = true;
        bootstrap.profile.ownedCardIds = [...new Set(rewards.flatMap(reward => reward.cardId ? [reward.cardId] : []))];
        status = accountRewardStatus(1, new Date('2025-01-01Z'), receipts, now);
        if (width === 390) return route.fulfill({ status: 503, json: { error: 'Committed response lost' } });
      }
      return route.fulfill({ json: { rewards, status, bootstrap } });
    });
    await page.goto(`${origin}/e2e/daily-arrival.fixture.html?player=${player}`, { waitUntil: 'domcontentloaded' });
    const popup = page.locator('.daily-arrival');await expect(popup).toHaveAttribute('open', '');
    assert.equal(await popup.locator('.account-check-in-calendar li').count(), 7);
    assert.equal(await popup.locator('.monthly-login-track li').count(), 7);
    await expect(popup.locator('.monthly-login-track')).toContainText('Resets Nov 1 · UTC');
    const fit = await popup.evaluate(el => { const r = el.getBoundingClientRect();return { fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, noHorizontalScroll: el.scrollWidth <= el.clientWidth + 1 }; });
    assert.ok(fit.fits && fit.noHorizontalScroll);
    await popup.getByRole('button', { name: 'Collect check-in', exact: true }).click();
    if (width === 390) { await expect(popup.getByRole('alert')).toContainText('Couldn’t confirm');await popup.getByRole('button', { name: 'Retry check-in', exact: true }).click(); }
    await expect(popup).toHaveAttribute('data-receipt', 'true');
    const cards = issued.filter(reward => reward.cardId), shown = popup.locator('.daily-arrival__cards li');
    assert.equal(await shown.count(), cards.length);
    for (const card of cards) await expect(shown.filter({ hasText: card.cardName })).toBeVisible();
    if (width === 320) {
      await expect(shown).toContainText('Duplicate · +5 Common Style Shards');
      assert.equal(await popup.locator('.daily-arrival__loot').getByText('Style Shards', { exact: true }).count(), 0, 'Matching shards do not inflate Universal totals');
    } else await expect(shown.first()).toContainText('Super Common card saved');
    if (width === 390) {
      await expect(popup).toContainText('Already collected');await expect(popup).not.toContainText('Old card receipt');assert.equal(claims, 2);
    } else assert.equal(claims, 1);
    await page.waitForFunction(() => [...document.querySelectorAll('.daily-arrival__cards img')].every(image => image.complete && image.naturalWidth > 0));
    await popup.locator('.daily-arrival__cards').scrollIntoViewIfNeeded();await page.screenshot({ path: join(output, `monthly-daily-${width}.png`) });
    await popup.getByRole('button', { name: 'Let’s play', exact: true }).click();await expect(popup).not.toHaveAttribute('open', '');
    const recruitsBuddy = claims === 1 && cards.some(card => card.cardId === 'buddy' && card.isNewCard);
    assert.equal(await page.evaluate(() => Boolean(window.__dailyReceipt())), recruitsBuddy, 'Only an actually new Buddy recruits; empty-response recovery never replays it');
    await page.reload({ waitUntil: 'domcontentloaded' });await page.waitForTimeout(2400);await expect(popup).not.toHaveAttribute('open', '');
    assert.deepEqual(errors, []);report.push({ width, height, fit, cards: cards.length, claims, lostResponseRecovered: width === 390, matchingDuplicate: width === 320, noReplay: true, recruitsBuddy, errors });await page.close();
    console.log(`${width}×${height}: monthly Daily art, saved cards, duplicate currency and recovery passed.`);
  }
} finally { await browser.close();await writeFile(join(output, 'verification.json'), JSON.stringify(report, null, 2)); }
