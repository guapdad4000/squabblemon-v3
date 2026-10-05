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
  const owned = [...new Set([...ROOKIE_MENTOR_CORE_IDS, ...ROOKIE_CORE_IDS])];
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
        savedDecks: [{id:'second-crew',name:'Second gang',cardIds:owned.slice(-10),heroCardId:owned.at(-1),recipeId:null,valid:true,issues:[]},
          {
            id: 'crew',
            name: 'My gang',
            cardIds: owned.slice(0, 10),
            heroCardId: owned[0],
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
    let friendPending = true;
    const socialFixture = () => ({self:{friendCode:'ME1234',displayName:'Rookie',level:3,avatarKey:'hooper'},homies:[],incomingRequests:friendPending ? [{id:'request-1',player:{friendCode:'FR1234',displayName:'Test Homie',level:2,avatarKey:'hooper'},createdAt:new Date().toISOString()}] : [],outgoingRequests:[],blocked:[],invitations:[{id:'11111111-1111-4111-8111-111111111111',roomCode:'ABCDEF123456',direction:'incoming',player:{friendCode:'FR1234',displayName:'Test Homie',level:2,avatarKey:'hooper'},status:'pending',expiresAt:'2026-10-05T12:10:00Z'}],counts:{requests:1,invitations:1}});
    await page.clock.install({ time: new Date('2026-10-05T12:00:00Z') });
    await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    await page.route('**/api/**', async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (path === '/api/social') return route.fulfill({json:socialFixture()});
      if (path === '/api/social/requests/request-1/respond') { friendPending = false; return route.fulfill({json:socialFixture()}); }
      if (path.endsWith('/notifications/receipts')) return route.fulfill({json:{ids:[]}});
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
    let documentLoads = 0;
    page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentLoads++; });
    const visit = async (path: string) => { await page.evaluate(path => history.pushState(null, '', path), `/game${path}`); };
    const friendPopup = page.getByRole('dialog', {name:'A new homie?'});
    await friendPopup.waitFor();
    await page.screenshot({path:`../../screenshots/friend-request-popup-${width}.png`});
    await friendPopup.getByRole('button', {name:'Later · keep it in my inbox'}).click();
    const fadePopup = page.getByRole('dialog', {name:'You got called out.'});
    await fadePopup.waitFor();
    await page.screenshot({path:`../../screenshots/friendly-fade-popup-${width}.png`});
    await fadePopup.getByRole('button', {name:'Later · keep it in my inbox'}).click();
    await page.getByRole('button', {name:/Notifications,/}).click();
    const inbox = page.getByRole('dialog', {name:'On your radar'});
    await inbox.getByText('Test Homie sent a friend request').waitFor();
    await inbox.getByText('Test Homie wants a Friendly Fade').waitFor();
    await page.screenshot({path:`../../screenshots/notification-dropdown-${width}.png`});
    await inbox.getByRole('button', {name:'Close notifications'}).click();
    await page.getByRole('button', {name:/Notifications,/}).click();
    await inbox.locator('.notification-item').filter({hasText:'Test Homie sent a friend request'}).click();
    await friendPopup.waitFor();
    await friendPopup.getByRole('button', {name:'Add homie'}).click();
    await friendPopup.waitFor({state:'hidden'});
    assert.equal(friendPending, false);
    if (process.env.SOCIAL_ONLY === '1') { assert.deepEqual(errors, []); assert.equal(documentLoads, 0); console.log(`PASS social popups ${width}: individual queue, Later, inbox reopening, direct acceptance, no reload`); return; }
    for (const destination of ['/collection?card=hooper', '/decks', '/collection?card=dr-fade']) {
      await visit(destination);
      await page.waitForTimeout(650);
      if (destination.includes('card=')) { const cardId = new URLSearchParams(destination.split('?')[1]).get('card'); await page.locator(`[data-collection-discovery-card-id="${cardId}"]`).click(); const inspector = page.locator('[role=dialog]').filter({visible:true}).last(); await inspector.waitFor(); await page.keyboard.press('Escape'); }
      await visit('');
      await page.locator('.safehouse .venue-scene.is-ready').waitFor();
      assert.equal(await page.locator('.safehouse').getAttribute('data-scene-ready'), 'true');
    }
    const roomFrame = page.frameLocator('iframe[title="Interactive safehouse"]');
    await roomFrame.locator('body').evaluate(() => window.parent.postMessage({channel:'squabblemon-scene',type:'error'}, location.origin));
    await page.locator('.safehouse .venue-scene.is-error').waitFor();
    await page.locator('.safehouse .venue-scene.is-ready').waitFor();
    assert.equal(documentLoads, 0, 'scene recovery reloads only the iframe');
    await visit('/training');
    const picker = page.locator('.compact-deck-picker').first();
    await picker.waitFor();
    await picker.getByRole('button', {name:/My gang/}).click();
    await visit('');
    await page.locator('.safehouse .venue-scene.is-ready').waitFor();
    await visit('/training');
    await page.locator('.compact-deck-picker').first().getByRole('button', {name:/My gang/}).waitFor();
    assert.equal(await page.locator('.compact-deck-picker').first().getByRole('button', {name:/My gang/}).getAttribute('aria-pressed'), 'true');
    await visit('/decks/crew');
    await page.getByRole('button', {name:'Auto build',exact:true}).click();
    await page.getByText('Auto-built around your cover.',{exact:false}).waitFor();
    assert.equal(await page.locator('.deck-slot').count(), 10);
    await page.getByRole('button', {name:'Undo last change',exact:true}).click();
    await visit('/shop');
    await page.locator('.venue-scene.is-ready').waitFor({state:'attached'});
    await page.getByRole('button',{name:'10 PULL',exact:true}).click();
    await page.getByRole('button',{name:'Open 10× · 10 tickets',exact:true}).click();
    await page.getByRole('alert').filter({visible:true}).waitFor();
    await page.evaluate(() => {
      for (const asset of ['GangBackdrop-old.js','Home-old.js','DeckEditor-old.js']) {
        const event = new Event('vite:preloadError', {cancelable:true}) as Event & {payload:Error};
        event.payload = new Error(`Failed to fetch dynamically imported module: /assets/${asset}`);
        window.dispatchEvent(event);
      }
    });
    await page.waitForTimeout(500);
    assert.equal(documentLoads, 0, 'menus and missing chunks must never reload the page');
    await page.getByRole('button',{name:'Retry this 10-pull',exact:true}).click();
    await page.locator('.gacha-stage[data-phase="tenPunching"]').waitFor();
    await page.getByRole('button',{name:'Auto rush',exact:true}).click();
    await page.locator('.gacha-results').waitFor();
    assert.equal(documentLoads, 0, 'ten-pull reveal keeps the document alive');
    assert.equal(ticketBalance, 2);
    assert.deepEqual(requests[0], requests[1]);
    await page.screenshot({path:`../../screenshots/menu-continuity-${width}.png`});
    assert.deepEqual(errors, []);
    console.log(`PASS menu continuity ${width}: social dropdown, repeated Safehouse returns, remembered mini deck, auto build/undo, ten-pull retry and reveal without reload`);
  } finally { await browser.close(); }
}
const [width, height] = (process.env.FLOW_VIEWPORT ?? '390x844').split('x').map(Number);
await run(width,height);
