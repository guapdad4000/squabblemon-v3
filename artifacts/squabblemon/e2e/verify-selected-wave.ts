import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { cardCatalog } from '../src/data';
const output = '../deliverables/selected-wave-2026-10-08/screenshots';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 960 }],
    ['phone', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() =>
      localStorage.setItem('squabblemon_e2e_user', 'signed-in'),
    );
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const owned = cardCatalog.map((c) => c.catalogId);
    const fixture = {
      profile: {
        id: 'collection-performance',
        displayName: 'Collector',
        avatarKey: 'cornball',
        onboardingStep: 'complete',
        starterDeckId: 'block',
        streetRep: 0,
        xp: 0,
        level: 1,
        softCurrency: 500,
        packTickets: 3,
        styleShards: 0,
        packPity: 0,
        deckSlots: 4,
        cosmeticCurrency: 0,
        collectionProgress: 0,
        storyChapter: 0,
        storyNode: 0,
        tutorialCompleted: true,
        starterRewardClaimed: true,
        ageConfirmedAt: new Date(0).toISOString(),
        termsAcceptedAt: new Date(0).toISOString(),
        settings: { reducedMotion: false, turnTimerEnabled: false },
        ownedCardIds: owned,
        cardProgression: {},
        discoveredCardIds: owned,
        ownedVariants: [],
        equippedVariants: {},
        unlockedCosmeticIds: [],
        unlockedCharacterIds: [],
        savedDecks: [],
        storyProgress: {},
        inbox: [],
        packHistory: [],
        lastActiveAt: new Date(0).toISOString(),
      },
      missions: [],
      collectionRoad: [],
      nextAction: {
        id: 'play',
        eyebrow: 'Training',
        title: 'Test your idea',
        description: 'Build a gang',
        destination: 'play',
        rewardLabel: null,
      },
      packConfig: {
        id: 'street-pack',
        name: 'Street Pack',
        oddsVersion: 'e2e-v1',
        softCurrencyCost: 500,
        ticketCost: 1,
        rewardsPerPack: 3,
        pityLimit: 10,
        odds: [],
      },
    };
    await page.route('**/api/**', (route) =>
      route.fulfill({
        json: route.request().url().endsWith('/player/bootstrap')
          ? fixture
          : {
              chapters: [],
              nodes: [],
              pending: [],
              items: [],
              messages: [],
              ids: [],
              state: 'claimed',
              reward: {},
            },
      }),
    );

    for (const [id, power, cost] of [
      ['gym-bag-yn', 2, 2],
      ['community-cook', 3, 2],
      ['grandma-said-sit-down', 5, 4],
      ['one-man-band', 5, 4],
      ['naija-scammer', 4, 3],
      ['black-air-fade-1s', 0, 1],
      ['og-calisthenics', 5, 4],
    ]) {
      await page.goto('http://127.0.0.1:4198/game/collection?card=' + id);
      const card = page.locator(
        '[data-collection-discovery-card-id="' + id + '"]',
      );
      await card.scrollIntoViewIfNeeded();
      await card.click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      const hands = dialog
        .locator('.dossier-stat')
        .filter({
          has: page.locator('.dossier-stat__label', { hasText: 'Hands' }),
        })
        .locator('.dossier-stat__value');
      assert.equal(await hands.innerText(), String(power));
      if (cost !== undefined)
        assert.equal(
          await dialog
            .locator('.dossier-stat')
            .filter({
              has: page.locator('.dossier-stat__label', { hasText: 'Motion' }),
            })
            .locator('.dossier-stat__value')
            .innerText(),
          String(cost),
        );
      await dialog.locator('img').evaluateAll((images) =>
        Promise.all(
          images.map((img) =>
            img.decode().catch(() => {
              throw Error('Image failed ' + img.src);
            }),
          ),
        ),
      );
      await page.waitForTimeout(500);
      await page.screenshot({ path: output + '/' + name + '-' + id + '.png' });
      await page
        .getByRole('button', { name: 'Close card details', exact: true })
        .click();
    }
    assert.deepEqual(errors, []);
    results.push({
      name,
      checks: 'Selected card stats, decoded inspector, no page exceptions',
    });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  output + '/verification.json',
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
