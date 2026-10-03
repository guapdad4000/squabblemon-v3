import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { cardCatalog, ROOKIE_CORE_IDS, ROOKIE_MENTOR_CORE_IDS } from '../src/data';
import { STREET_PACK_DISCLOSURES, STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const origin = process.env.GACHA_ORIGIN ?? 'http://127.0.0.1:4195/game';

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
  const owned = [...ROOKIE_MENTOR_CORE_IDS];
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
        oddsVersion: 'street-pack-v7',
        softCurrencyCost: STREET_PACK_RULES.single.softCurrencyCost,
        ticketCost: STREET_PACK_RULES.single.ticketCost,
        rewardsPerPack: STREET_PACK_RULES.single.rewards,
        pityLimit: STREET_PACK_RULES.pityLimit,
        odds: STREET_PACK_DISCLOSURES,
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
    await page.screenshot({ path: `../../screenshots/gacha-${name}-${width}.png`, fullPage:name.startsWith('banner-') });
  }
  async function goto(query = '') {
    await page.goto(`${origin}/shop${query}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.market-tabs').waitFor();
  }
  try {
    await page.clock.install({ time: new Date('2026-10-05T12:00:00Z') });
    await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    await page.route('**/api/player/**', async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (path.endsWith('/packs/welcome')) return route.fulfill({ json: { available: false } });
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: bootstrap() });
      if (path.endsWith('/packs/open')) {
        calls++;
        const body = req.postDataJSON();
        requests.push(body);
        let opening = openings.get(body.idempotencyKey);
        if (!opening) {
          const openingCost = body.pullCount === 10
            ? body.paymentMethod === 'ticket' ? STREET_PACK_RULES.ten.ticketCost : STREET_PACK_RULES.ten.softCurrencyCost
            : body.paymentMethod === 'ticket' ? STREET_PACK_RULES.single.ticketCost : STREET_PACK_RULES.single.softCurrencyCost;
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
            amount: STREET_PACK_RULES.duplicateStyleShards,
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
            oddsVersion: `street-pack-v7:banner-${body.bannerId}-v1`,
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
    await page.locator('.pull-feature__arrows').waitFor();
    await page.locator('.venue-scene.is-ready').waitFor({state:'attached'});
    assert.match(await page.locator('.fight-bill__title').innerText(), /FADE[\s\S]*RECRUITMENT/);
    assert.equal(await page.locator('.gym__arena').evaluate(el => getComputedStyle(el).visibility), 'visible');
    const originalPoster = await page.locator('.fight-bill').boundingBox();
    for (const [id, name] of [['standard', 'Street Pack'], ['inmates','Inmates'], ['oz','Oz'], ['wonderland','Wonderland'], ['red-blue','Red & Blue']]) {
      if (id !== 'standard') await page.getByRole('button', {name:'Next banner',exact:true}).click();
      if (id !== 'standard') await page.waitForFunction(() => { const image = document.querySelector<HTMLImageElement>('.pull-feature__backdrop img'); return image?.complete && image.naturalWidth > 0; });
      assert.equal(await page.locator('.pull-feature').getAttribute('data-banner'), id);
      if (id !== 'standard') {
        await page.locator('.pull-feature__cast img').first().waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.pull-feature__cast img')].every(img => img.complete && img.naturalWidth > 0));
        assert.match(await page.locator('.pull-feature__boost').innerText(), /1.5×/);
      }
      const poster = await page.locator('.fight-bill').boundingBox();
      assert(poster && originalPoster && Math.abs(poster.width-originalPoster.width) < 1 && Math.abs(poster.height-originalPoster.height) < 1, 'every banner matches original poster dimensions');
      const arrows = await page.locator('.pull-feature__arrows').boundingBox();
      assert(arrows && Math.abs(arrows.width-poster.width) < 20, 'arrows belong to poster rather than page');
      await shot(`banner-${id}`);
    }
    assert.equal(await page.locator('.pull-banner-tabs').count(), 0);
    const surface = await page.locator('.pull-feature').evaluate(el => ({border: getComputedStyle(el).borderWidth, background: getComputedStyle(el).backgroundColor}));
    assert.deepEqual(surface, {border:'0px',background:'rgba(0, 0, 0, 0)'});
    await page.getByRole('button', {name:'Next banner', exact:true}).click();
    assert.equal(await page.locator('.pull-feature').getAttribute('data-banner'), 'standard');
    await page.getByRole('button', {name:'Previous banner', exact:true}).click();
    assert.equal(await page.locator('.pull-feature').getAttribute('data-banner'), 'red-blue');
    await page.getByRole('button', {name:'Drop rates', exact:true}).click();
    assert.match(await page.locator('.pull-banner-roster').innerText(), /CLUE COOKY/);
    assert.match(await page.locator('.pull-banner-roster').innerText(), /RED PUNCH/);
    await page.getByRole('button', {name:'Close pack information', exact:true}).click();
    const purchaseBanner = process.env.GACHA_PURCHASE_BANNER === 'standard' ? 'standard' : 'red-blue';
    if (purchaseBanner === 'standard') await page.getByRole('button', {name:'Next banner',exact:true}).click();
    await page.getByRole('button', {name:'Open · 1 ticket', exact:true}).click();
    await page.getByRole('alert').filter({visible:true}).waitFor();
    assert.equal(requests[0].bannerId, purchaseBanner);
    assert.equal(await page.getByRole('navigation', {name:'Pull banners'}).getByRole('button').first().isDisabled(), true);
    await page.reload();
    await page.locator('.pull-feature__arrows').waitFor();
    assert.equal(await page.locator('.pull-feature').getAttribute('data-banner'), purchaseBanner);
    await page.locator('.venue-scene.is-ready').waitFor({state:'attached'});
    await page.getByRole('button', {name:/Retry/}).first().click();
    await page.waitForFunction(() => !!sessionStorage.getItem('squabblemon:pack-reveal:gacha-fixture'));
    await page.locator('.gacha-stage[data-phase="punching"]').waitFor();
    assert.equal(await page.locator('.pull-feature').isVisible(), false);
    assert.equal(await page.locator('.gym__arena').evaluate(el => getComputedStyle(el).visibility), 'visible');
    await page.frameLocator('iframe[title="Interactive heavy bag"]').locator('#webgl-container').click();
    await page.getByRole('button', {name:/^Throw the hook/}).waitFor();
    await page.getByRole('button', {name:/^Throw the hook/}).click();
    await page.waitForFunction(() => document.querySelectorAll('.gacha-stage__rounds .is-landed').length === 2);
    await shot('banner-bag-two-hits');
    await page.locator('.gacha-stage__strike').click();
    await page.getByRole('heading', {name:'The crowd gets louder.',exact:true}).waitFor();
    await shot('banner-bag-reveal');
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(ticketBalance, 11);
    assert.deepEqual(errors, []);
    console.log(`PASS banners ${width}x${height}: original poster, focus artwork, arrow wraparound, no overflow, focused retry, and three-hit bag reveal`);
  } catch (error) {
    console.log({errors, url:page.url(), body:(await page.locator('body').innerText()).slice(0,2000)});
    await page.screenshot({path:`../../screenshots/banner-debug-${width}.png`});
    throw error;
  } finally { await browser.close(); }
}
for (const size of (process.env.GACHA_VIEWPORTS ?? '1440x900,390x844,320x700').split(',')) {
  const [width, height] = size.split('x').map(Number);
  await run(width, height);
}
