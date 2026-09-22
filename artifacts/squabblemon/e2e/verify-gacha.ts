import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { cardCatalog, ROOKIE_CORE_IDS, ROOKIE_FOUNDATION_IDS } from '../src/data';

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const origin = process.env.GACHA_ORIGIN ?? 'http://127.0.0.1:4193/game';

async function run(width: number, height: number) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  const cards = ['Rare', 'Epic'].map((rarity) => cardCatalog.find((card) => card.rarity === rarity)!);
  const supportingCards = cardCatalog
    .filter((card) =>
      ['SuperCommon', 'Common', 'Uncommon'].includes(card.rarity)
      && !cards.some((featured) => featured.catalogId === card.catalogId))
    .slice(0, 7);
  let calls = 0;
  let ticketBalance = 12;
  let cloutBalance = 500;
  const openings = new Map<string, any>();
  const requests: any[] = [];
  const owned = [...ROOKIE_FOUNDATION_IDS];
  const duplicateCard = cardCatalog.find((card) => card.catalogId === owned.find(id => cardCatalog.find(c => c.catalogId === id)?.rarity === 'Common'))!;
  function bootstrap() {
    return {
      profile: {
        id: 'gacha-fixture',
        displayName: 'Rookie',
        avatarKey: 'hooper',
        onboardingStep: 'complete',
        starterDeckId: 'foundation-v1',
        streetRep: 68,
        xp: 400,
        level: 3,
        softCurrency: cloutBalance,
        packTickets: ticketBalance,
        styleShards: 250,
        deckSlots: 4,
        cardProgression: {},
        ownedVariants: [],
        collectionProgress: owned.length,
        packPity: 4,
        cosmeticCurrency: 0,
        storyChapter: 1,
        storyNode: 2,
        tutorialCompleted: true,
        starterRewardClaimed: true,
        ageConfirmedAt: new Date(0).toISOString(),
        termsAcceptedAt: new Date(0).toISOString(),
        settings: { reducedMotion: false, turnTimerEnabled: false },
        ownedCardIds: owned,
        discoveredCardIds: owned,
        equippedVariants: {},
        unlockedCosmeticIds: [],
        savedDecks: [
          {
            id: 'crew',
            name: 'My gang',
            cardIds: [...ROOKIE_CORE_IDS],
            heroCardId: 'hooper',
            recipeId: null,
            valid: true,
            issues: [],
          },
        ],
        storyProgress: {},
        inbox: [],
        packHistory: [...openings.values()],
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
        oddsVersion: 'fixture',
        softCurrencyCost: 200,
        ticketCost: 1,
        rewardsPerPack: 6,
        pityLimit: 10,
        odds: [{ label: 'Fixture card', detail: 'Test data only', chance: 100 }],
      },
    };
  }
  async function shot(name: string) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images)
          .filter((image) => !image.complete)
          .map(
            (image) =>
              new Promise((resolve) => {
                image.onload = resolve;
                image.onerror = resolve;
                setTimeout(resolve, 2000);
              }),
          ),
      );
    });
    // Capture the settled artwork, after the short reward entrance finishes.
    if (name === 'reveal' || name === 'haul') await page.waitForTimeout(700);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${name}: page overflow`,
    );
    await page.screenshot({ path: `../../screenshots/gacha-${name}-${width}.png` });
  }
  async function goto(query = '') {
    await page.goto(`${origin}/shop${query}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.market-tabs').waitFor();
  }
  async function assertHaulGrid(expectedItems: number) {
    const grid = page.locator('.gacha-results[data-phase="summary"] .gym-results__grid');
    await grid.waitFor();
    assert.equal(await grid.evaluate((element) => getComputedStyle(element).display), 'grid', 'Full haul must use a grid');
    assert.equal(await grid.locator('.gym-results__item').count(), expectedItems);
    const geometry = await grid.evaluate((element) => {
      const viewportWidth = document.documentElement.clientWidth;
      const rects = Array.from(element.children).map((child) => child.getBoundingClientRect());
      return {
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        offscreen: rects.some((rect) => rect.left < -0.5 || rect.right > viewportWidth + 0.5),
        columns: new Set(rects.map((rect) => Math.round(rect.left))).size,
      };
    });
    assert(geometry.scrollWidth <= geometry.clientWidth + 1, `Full haul must not be horizontally scrollable: ${JSON.stringify(geometry)}`);
    assert.equal(geometry.offscreen, false, 'Every haul card must remain inside the viewport horizontally');
    if (width <= 700) assert.equal(geometry.columns, 3, 'Portrait mobile haul must use three columns');
    if (height > 550) {
      const gap = await grid.evaluate(element => {
        const description = element.parentElement!.querySelector(':scope > p')!;
        return element.getBoundingClientRect().top - description.getBoundingClientRect().bottom;
      });
      assert(gap <= 24, 'Haul cards must follow the description without a large empty spacer');
    }
    const lastReward = grid.locator('.gym-results__item').last();
    await lastReward.scrollIntoViewIfNeeded();
    await lastReward.click({ trial: true });
    const returnAction = page.getByRole('button', { name: /^Back to gacha/ });
    await returnAction.scrollIntoViewIfNeeded();
    await returnAction.click({ trial: true });
    await page.locator('.gacha-results').evaluate(element => { element.scrollTop = 0; });
  }
  async function assertPunchingFits() {
    const geometry = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.gacha-stage');
      const controls = document.querySelector<HTMLElement>('.gacha-stage__ringside');
      const actions = document.querySelector<HTMLElement>('.gacha-stage__punch-actions');
      const arena = document.querySelector<HTMLElement>('.gacha-stage .gym__arena');
      if (!stage || !controls || !actions || !arena) return null;
      const stageRect = stage.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      return {
        viewportHeight: innerHeight,
        stageBottom: stageRect.bottom,
        controlsBottom: controlsRect.bottom,
        actionsBottom: actionsRect.bottom,
        controlsRatio: controlsRect.height / stageRect.height,
        sceneGap: controlsRect.top - arena.getBoundingClientRect().bottom,
      };
    });
    assert(geometry, 'Punching stage controls must exist');
    assert(geometry.stageBottom <= geometry.viewportHeight + 2, 'Punching stage must fit the viewport');
    assert(geometry.controlsBottom <= geometry.viewportHeight + 2, 'Punching control bar must fit the viewport');
    assert(geometry.actionsBottom <= geometry.viewportHeight + 2, 'Final punching actions must be visible');
    if (width <= 700) assert(geometry.controlsRatio < .38, 'Punching HUD must not create a giant lower spacer');
    assert(geometry.sceneGap <= 12, 'The bag scene must meet the controls without an empty strip');
  }
  try {
    await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    await page.route('**/api/player/**', async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: bootstrap() });
      if (path.endsWith('/packs/open')) {
        calls++;
        const body = req.postDataJSON();
        requests.push(body);
        let opening = openings.get(body.idempotencyKey);
        if (!opening) {
          const openingCost = body.pullCount === 10
            ? body.paymentMethod === 'ticket' ? 9 : 1800
            : body.paymentMethod === 'ticket' ? 1 : 200;
          if (body.paymentMethod === 'ticket') ticketBalance -= openingCost;
          else cloutBalance -= openingCost;
          const cardReward = (card: (typeof cardCatalog)[number]) => ({
            kind: 'card',
            cardId: card.catalogId,
            variantId: null,
            name: card.name,
            rarity: card.rarity,
            isNew: true,
            amount: 1,
          });
          const duplicateReward = {
            kind: 'styleShards',
            cardId: duplicateCard.catalogId,
            variantId: null,
            name: 'Duplicate converted',
            rarity: duplicateCard.rarity,
            isNew: false,
            amount: 25,
          };
          const rewards = body.pullCount === 10
            ? [
                cardReward(cards[0]),
                duplicateReward,
                ...Array.from({ length: 57 }, (_, index) => cardReward(supportingCards[index % supportingCards.length])),
                cardReward(cards[1]),
              ]
            : [
                cardReward(cards[0]),
                ...supportingCards.slice(0, 4).map(cardReward),
                duplicateReward,
              ];
          opening = {
            id: body.idempotencyKey,
            paymentMethod: body.paymentMethod,
            cost: openingCost,
            pullCount: body.pullCount ?? 1,
            oddsVersion: 'fixture',
            pityBefore: 4,
            pityAfter: 5,
            createdAt: new Date().toISOString(),
            rewards,
          };
          openings.set(body.idempotencyKey, opening);
        }
        // The server awards the first pack, but its reply is interrupted.
        if (calls === 1) return route.fulfill({ status: 503, json: { error: 'Interrupted response' } });
        return route.fulfill({ json: { opening, bootstrap: bootstrap() } });
      }
      return route.fulfill({ status: 404, json: { error: `Unexpected request: ${path}` } });
    });

    await goto();
    assert.deepEqual(await page.locator('.market-tabs button').allTextContents(), ['Gotcha', 'Training', 'Fade Market']);
    assert.equal(await page.getByRole('button', { name: 'Gotcha', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.locator('.venue-scene.is-ready').waitFor();
    await page.waitForTimeout(700);
    await shot('stage');
    assert.equal(await page.locator('.gacha-stage__ticket-choice').count(), 2, 'only the two selected-pull payment choices should show');
    assert.equal(await page.locator('.gacha-stage__payment').count(), 0, 'the old stacked payment rows should be gone');
    const ticketHeights = await page.locator('.gacha-stage__ticket-choice img').evaluateAll((images) =>
      images.map((image) => image.getBoundingClientRect().height));
    const minimumTicketHeight = width <= 700 ? 40 : height <= 550 ? 60 : 110;
    assert(ticketHeights.every((ticketHeight) => ticketHeight >= minimumTicketHeight), 'ticket artwork should own the purchase surface');
    if (width <= 700) {
      const dock = await page.locator('.gym__offer').boundingBox();
      assert(dock && dock.height <= height * .5, 'Mobile purchase dock must leave most of the scene visible');
      const payments = await page.locator('.gacha-stage__ticket-choice').evaluateAll(buttons =>
        buttons.map(button => button.getBoundingClientRect().height));
      assert(payments.every(buttonHeight => buttonHeight >= 44), 'Compact payment controls retain touch targets');
    }
    assert.equal(await page.locator('.gacha-results').isVisible(), false, 'Closed reveal must remain hidden');
    await page.getByRole('button', { name: 'Training', exact: true }).click();
    await page.locator('.market').waitFor();
    assert(page.url().includes('view=training'));
    await page.goBack();
    await page.locator('.gacha-stage').waitFor();
    await goto('?card=hooper');
    await page.locator('.market').waitFor();
    await goto('?item=street-pack-ticket');
    await page.locator('.market').waitFor();
    await goto('?view=market');
    await page.locator('.market').waitFor();
    await goto();
    await page.locator('.venue-scene.is-ready').waitFor();
    await page.getByRole('button', { name: 'Drop rates', exact: true }).click();
    await page.getByRole('heading', { name: 'The odds.', exact: true }).waitFor();
    await shot('odds');
    await page.keyboard.press('Escape');
    const openTicket = page.getByRole('button', { name: 'Open · 1 ticket', exact: true });
    await openTicket.scrollIntoViewIfNeeded();
    await shot('checkout');
    await openTicket.click();
    await page.getByRole('alert').waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.venue-scene.is-ready').waitFor();
    const retry = page.getByRole('button', { name: 'Retry this opening', exact: true });
    await retry.click();
    await page.locator('.gacha-stage[data-phase="punching"]').waitFor();
    assert.equal(calls, 2);
    assert.equal(ticketBalance, 11);
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(await page.getByRole('button', { name: /^Snap the jab/ }).count(), 1);
    assert.equal(await page.locator('.gacha-stage__bag-cue').isVisible(), true, 'the bag tap cue should be visible');
    await page.frameLocator('iframe[title="Interactive heavy bag"]').locator('#webgl-container').click();
    await page.getByRole('progressbar', { name: 'Rounds to reveal' }).waitFor();
    await page.locator('.gacha-stage__rounds .is-landed').waitFor();
    assert.equal(await page.getByRole('button', { name: /^Throw the hook/ }).count(), 1);
    await assertPunchingFits();
    await shot('punching');
    await page.getByRole('button', { name: 'Auto rush', exact: true }).click();
    await page.getByRole('heading', { name: 'The crowd gets louder.', exact: true }).waitFor();
    await shot('reveal');
    await page.getByRole('button', { name: 'Next reveal', exact: true }).click();
    await page.getByRole('button', { name: 'Reveal all', exact: true }).click();
    await shot('haul');
    await assertHaulGrid(6);
    await page.getByRole('button', { name: `Inspect ${duplicateCard.name}`, exact: true })
      .filter({ has: page.locator('.gym-reward__conversion') }).click();
    const conversion = page.locator('.gym-reward__conversion');
    await conversion.waitFor();
    assert.match(await conversion.innerText(), /Already on your gang[\s\S]*\+25 Style Shards/i);
    assert.equal(await page.locator('.gym-reward--duplicate .collector-card').count(), 1);
    await page.getByRole('button', { name: 'Reveal all', exact: true }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Meet the haul.', exact: true }).waitFor();
    assert.equal(calls, 2, 'Restoring the reveal must not purchase another pack');
    await page.getByRole('button', { name: `Inspect ${cards[0].name}`, exact: true }).click();
    await page.getByRole('heading', { name: 'The crowd gets louder.', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.gacha-stage[data-phase="idle"]').waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('squabblemon:pack-reveal:gacha-fixture')), null);
    await page.getByRole('button', { name: 'Your openings', exact: true }).click();
    assert.equal(await page.locator('.gym-history article').count(), 1);
    await page.getByRole('button', { name: 'Close pack information', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Open · 200 Clout', exact: true }).click();
    await page.getByRole('heading', { name: 'Meet the haul.', exact: true }).waitFor();
    assert.equal(cloutBalance, 300);
    assert.equal(await page.locator('.gacha-results .gym-reward').first().evaluate(element => getComputedStyle(element).animationName), 'none');
    await page.getByRole('button', { name: 'Back to gacha', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('.venue-scene.is-ready').waitFor();
    await page.getByRole('button', { name: 'Open · 1 ticket', exact: true }).click();
    await page.getByRole('button', { name: 'Skip animation & reveal', exact: true }).click();
    await page.getByRole('heading', { name: 'The crowd gets louder.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close rewards', exact: true }).click();
    await page.getByRole('button', { name: /^10 pull/i }).click();
    await page.getByRole('button', { name: 'Open 10× · 9 tickets', exact: true }).click();
    await page.locator('.gacha-stage[data-phase="tenPunching"]').waitFor();
    await page.getByRole('button', { name: /^Triple jab/ }).click();
    await page.getByRole('button', { name: /^Triple hook/ }).waitFor();
    await assertPunchingFits();
    await page.getByRole('button', { name: /^Triple hook/ }).click();
    await page.getByRole('button', { name: /^Launch the finisher/ }).waitFor();
    await page.getByRole('button', { name: /^Launch the finisher/ }).click();
    await page.getByRole('heading', { name: 'The crowd gets louder.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next reveal', exact: true }).click();
    await conversion.waitFor();
    // Use the real 60-reward haul to reach the penultimate reveal; avoid replaying
    // the same next-button transition 57 times for every viewport.
    await page.getByRole('button', { name: 'Reveal all', exact: true }).click();
    await page.locator('.gym-results__item').nth(58).click();
    await page.getByRole('button', { name: 'Reveal the headliner', exact: true }).click();
    await page.getByRole('heading', { name: 'The whole gym stands.', exact: true }).waitFor();
    await page.getByText(/GUARANTEED RARE\+/).waitFor();
    await page.getByRole('button', { name: 'View the haul', exact: true }).click();
    await assertHaulGrid(60);
    await shot('haul-ten');
    await page.locator('.gym-results__item').last().click();
    await page.getByRole('heading', { name: 'The whole gym stands.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'View the haul', exact: true }).click();
    await page.getByRole('button', { name: 'Back to gacha · 10× earned', exact: true }).click();
    await page.locator('.gacha-stage[data-phase="idle"]').waitFor();
    ticketBalance = 0;
    cloutBalance = 0;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open · 1 ticket', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Open · 1 ticket', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Open · 200 Clout', exact: true }).isDisabled(), true);
    assert.equal(calls, 5);
    assert.deepEqual(errors, []);
    console.log(
      `${width}px: recovery, three-round boxing, duplicate conversion, ten-pull headliner, reveal, refresh and reduced motion passed.`,
    );
  } catch (error) {
    await page.screenshot({ path: `../../screenshots/gacha-debug-${width}.png` });
    console.log({ errors, url: page.url(), body: (await page.locator('body').innerText()).slice(-4500) });
    throw error;
  } finally {
    await browser.close();
  }
}

if (process.env.GACHA_VIEWPORTS) {
  for (const viewport of process.env.GACHA_VIEWPORTS.split(',')) {
    const [width, height] = viewport.split('x').map(Number);
    assert(width > 0 && height > 0, `Invalid gacha viewport: ${viewport}`);
    await run(width, height);
  }
} else if (process.env.GACHA_COMPACT) {
  await run(844, 390);
} else {
  await run(1440, 900);
  await run(390, 844);
  await run(471, 1020);
}
