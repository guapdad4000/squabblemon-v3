import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import { ROOKIE_CORE_IDS, ROOKIE_FOUNDATION_IDS, ROOKIE_FOUNDATION_ID, ROOKIE_DECK_ID, catalogIdsToEngineIds, decks } from '../src/data';
import { createMatchFromEngineCards, verifyMatchTranscript, type Match } from '../src/gameEngine';

const origin = process.env.JOURNEY_ORIGIN ?? 'http://127.0.0.1:4182/squabblemon';
async function completeBattle(page: Page, testSwap = false) {
  for (let round = 1; round <= 6; round++) {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (await page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]').count()) break;
      const next = page.getByRole('button', { name: /^Continue past / });
      if (await next.count()) await next.click({ timeout: 500 }).catch(() => {});
      const skip = page.getByTestId('button-fast-forward');
      if (await skip.count()) await skip.click({ timeout: 500 }).catch(() => {});
      await page.waitForTimeout(70);
    }
    if (testSwap && round <= 2) {
      const cardId = round === 1 ? 'cornball' : 'nail-tech';
      await page.getByTestId('hand-tray').locator(`[data-card-id="${cardId}"]`).click();
      await page.getByRole('button', { name: /^Deploy / }).first().click();
      await page.getByTestId('button-lock').click();
      await page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]').waitFor();
      await page.getByTestId('button-next-round').click();
    } else await page.getByTestId('button-next-round').click();
    // Wait until this round has resolved before searching for the next ready state.
    await page.waitForTimeout(150);
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await page.getByTestId('status-match-result').count()) return;
    const skip = page.getByTestId('button-fast-forward');
    if (await skip.count()) await skip.click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(70);
  }
  throw new Error('Match result did not appear');
}

async function run(width: number, height: number) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let step = 'tutorial', tested = false, failSave = false, claims = 0;
  let draft = { id: ROOKIE_DECK_ID, name: 'My First Crew', cardIds: [...ROOKIE_CORE_IDS], heroCardId: 'hooper', recipeId: null, valid: true, issues: [] };
  let issued: Match | null = null;
  let issuedMode = '';
  let started = 0;
  function bootstrap() { return {
    profile: { id: 'journey-test', displayName: 'Rookie', avatarKey: 'hooper', onboardingStep: step, starterDeckId: ['reward','complete'].includes(step) ? ROOKIE_FOUNDATION_ID : null,
      streetRep: 0, xp: 0, level: 1, softCurrency: 0, packTickets: 0, styleShards: 0, packPity: 0, deckSlots: 4, cosmeticCurrency: 0, collectionProgress: 17,
      storyChapter: 1, storyNode: 0, tutorialCompleted: step !== 'tutorial', starterRewardClaimed: step === 'complete', ageConfirmedAt: new Date(0).toISOString(), termsAcceptedAt: new Date(0).toISOString(),
      settings: { reducedMotion: true, turnTimerEnabled: false }, ownedCardIds: ROOKIE_FOUNDATION_IDS, discoveredCardIds: ROOKIE_FOUNDATION_IDS, cardProgression: {}, ownedVariants: [], equippedVariants: {},
      unlockedCosmeticIds: [], savedDecks: ['reward','complete'].includes(step) ? [draft] : [], storyProgress: {}, inbox: [], packHistory: [], lastActiveAt: new Date(0).toISOString() },
    missions: [], nextAction: { id: tested ? 'rookie-tested' : `onboarding-${step}`, eyebrow: 'Rookie Road', title: 'Build your crew', description: 'Test your idea', destination: 'onboarding', rewardLabel: null },
    packConfig: { id: 'street-pack', name: 'Street Pack', oddsVersion: 'test', softCurrencyCost: 200, ticketCost: 1, rewardsPerPack: 3, pityLimit: 10, odds: [] }, collectionRoad: [],
  }; }
  try {
    await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    await page.route('**/api/player/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: bootstrap() });
      if (path.endsWith('/story')) return route.fulfill({ status: 503, json: { error: 'Story not part of this fixture' } });
      if (path.endsWith('/onboarding')) {
        const body = req.postDataJSON();
        if (body.action === 'complete-tutorial') step = 'crew';
        if (body.action === 'choose-starter') { assert.equal(body.starterDeckId, ROOKIE_FOUNDATION_ID); step = 'reward'; }
        if (body.action === 'claim-reward') { assert.ok(tested); step = 'complete'; claims++; }
        return route.fulfill({ json: bootstrap() });
      }
      if (req.method() === 'PUT' && path.includes('/decks/')) {
        if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { error: 'Save interrupted. Retry your deck.' } }); }
        draft = { ...draft, ...req.postDataJSON() };
        return route.fulfill({ json: bootstrap() });
      }
      if (path.endsWith('/matches')) {
        const body = req.postDataJSON(); issuedMode = body.mode; started++;
        const roster = body.playerDeckId === ROOKIE_DECK_ID ? catalogIdsToEngineIds(draft.cardIds) : decks.find(deck => deck.id === body.playerDeckId)!.cards;
        issued = createMatchFromEngineCards(body.playerDeckId, [...roster], body.rivalDeckId, decks.find(deck => deck.id === body.rivalDeckId)!.cards);
        return route.fulfill({ json: { id: '11111111-1111-4111-8111-111111111111', mode: body.mode, playerDeckId: body.playerDeckId, rivalDeckId: body.rivalDeckId, storyNodeId: null, contentVersion: null, encounterSnapshot: null, abilityUpgradeSnapshot: issued.abilityUpgradeSnapshot, status: 'active', createdAt: new Date().toISOString() } });
      }
      if (path.endsWith('/complete')) {
        assert.ok(issued);
        const verified = verifyMatchTranscript(issued.playerDeck, issued.cpuDeck, req.postDataJSON().moves, issued.abilityUpgradeSnapshot, issued.playerCardIds);
        assert.equal(verified.phase, 'complete');
        if (issuedMode === 'tutorial') step = 'crew'; else tested = true;
        const state = bootstrap();
        return route.fulfill({ json: { ...state, reward: { id: 'test-reward', label: 'Match saved', xp: 0, streetRep: 0, softCurrency: 0, packTickets: 0, descriptions: [], cardXpRewards: [], storyRewards: [] }, alreadyCompleted: false, campaign: null, story: null } });
      }
      return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' } });
    });
    await page.goto(`${origin}/game/onboarding`);
    await page.getByRole('button', { name: 'Start Tutorial', exact: true }).click();
    await completeBattle(page);
    await page.getByTestId('button-complete-tutorial').click();
    await page.getByRole('button', { name: 'Open my card collection' }).click();
    await page.getByRole('button', { name: 'Try Nail Tech', exact: true }).click();
    await page.getByLabel('Deck name', { exact: true }).fill('My Mixed Crew');
    await page.getByRole('button', { name: 'Save deck', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Deck saved.' }).waitFor();
    assert.equal(draft.cardIds[5], 'nail-tech');
    assert.deepEqual(draft.cardIds.slice(0,5), ROOKIE_CORE_IDS.slice(0,5));
    await page.reload();
    assert.equal(await page.getByLabel('Deck name', { exact: true }).inputValue(), 'My Mixed Crew');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `../../screenshots/player-workshop-${width}.png`, fullPage: true });
    failSave = true;
    await page.getByRole('button', { name: 'Save & test crew' }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(started, 1, 'Failed save must not start a match');
    await page.getByRole('button', { name: 'Save & test crew' }).click();
    await completeBattle(page, true);
    await page.getByTestId('button-change-deck').click();
    await page.getByRole('heading', { name: 'You built this crew.' }).waitFor();
    assert.match(await page.locator('body').innerText(), /Nail Tech:/);
    await page.reload();
    await page.getByRole('heading', { name: 'You built this crew.' }).waitFor();
    await page.getByRole('button', { name: 'Claim reward & enter Chapter One' }).click();
    await page.waitForURL('**/game/story');
    assert.equal(claims, 1);
    await page.goto(`${origin}/game/play`);
    await page.getByRole('button', { name: /My Mixed Crew/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`${width}px: tutorial, swap, save, reload, failed-save recovery, verified custom match, recap, reward, and deck selection passed.`);
  } catch (error) { console.log(JSON.stringify({errors,body:await page.locator("body").innerText(), phase:await page.getByTestId("battle-arena").getAttribute("data-presentation-phase"), engine:await page.getByTestId("battle-arena").getAttribute("data-engine-phase")})); await page.screenshot({path:"../../screenshots/rookie-regression-debug.png",fullPage:true}); throw error; } finally { await browser.close(); }
}
if(process.env.JOURNEY_WIDTH !== 'desktop') await run(390, 844);
await run(1280, 900);
