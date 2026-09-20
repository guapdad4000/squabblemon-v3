import assert from 'node:assert/strict';
import { chromium, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { ROOKIE_MENTOR_CORE_IDS, ROOKIE_CORE_IDS, ROOKIE_DECK_ID, ROOKIE_FOUNDATION_IDS, ROOKIE_FOUNDATION_ID, catalogIdsToEngineIds } from '../src/data';
import { createStoryMatch, verifyStoryMatchTranscript, getMatchWinner, type Match } from '../src/gameEngine';
import { rookieDistricts, rookieEncounter } from '@workspace/squabblemon-engine/rookie';
import { getTutorialMilestones } from '../../api-server/src/lib/tutorialMilestones';

const port = '4197', origin = 'http://127.0.0.1:' + port + '/squabblemon';
const server = spawn(process.execPath, ['../../node_modules/vite/bin/vite.js', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', port], { env: { ...process.env, PORT: port, BASE_PATH: '/squabblemon/', VITE_E2E_AUTH: 'true' }, stdio: 'ignore', windowsHide: true });
async function clickCoach(page: Page) {
  const guide = page.getByTestId('fade-spotlight');
  await guide.waitFor();
  const next = guide.getByRole('button');
  if (await next.count()) { await next.click(); return; }
  const selector = await guide.getAttribute('data-coach-target');
  assert.ok(selector);
  const target = page.locator(selector).first();
  await target.click({ timeout: 12000 });
}
async function run(width: number, height: number) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let step = 'tutorial', collected = false, tested = false, failSave = true, claims = 0, started = 0;
  let draft = { id: ROOKIE_DECK_ID, name: 'My First Gang', cardIds: [...ROOKIE_MENTOR_CORE_IDS], heroCardId: 'dr-fade', recipeId: null, valid: true, issues: [] };
  let issued: Match | null = null;
  const districts = rookieDistricts(), encounter = rookieEncounter();
  function bootstrap() { return {
    profile: { id: 'rookie-browser', displayName: 'Rookie', avatarKey: 'hooper', onboardingStep: step, starterDeckId: collected ? ROOKIE_FOUNDATION_ID : null,
      streetRep: 0, xp: 0, level: 1, softCurrency: 0, packTickets: 0, styleShards: 0, packPity: 0, deckSlots: 4, cosmeticCurrency: 0, collectionProgress: collected ? ROOKIE_FOUNDATION_IDS.length : 0,
      storyChapter: 1, storyNode: 0, tutorialCompleted: tested, starterRewardClaimed: step === 'complete', ageConfirmedAt: new Date(0).toISOString(), termsAcceptedAt: new Date(0).toISOString(),
      settings: { reducedMotion: true, turnTimerEnabled: false }, ownedCardIds: collected ? ROOKIE_FOUNDATION_IDS : [], discoveredCardIds: ROOKIE_FOUNDATION_IDS, cardProgression: {}, ownedVariants: [], equippedVariants: {},
      unlockedCosmeticIds: [], savedDecks: collected ? [draft] : [], storyProgress: {}, inbox: [], packHistory: [], lastActiveAt: new Date(0).toISOString() },
    missions: [], nextAction: { id: tested ? 'rookie-tested' : 'onboarding-' + step, eyebrow: 'Rookie Road', title: 'Build your gang', description: 'Learn together', destination: 'onboarding', rewardLabel: null },
    packConfig: { id: 'street-pack', name: 'Street Pack', oddsVersion: 'test', softCurrencyCost: 200, ticketCost: 1, rewardsPerPack: 3, pityLimit: 10, odds: [] }, collectionRoad: [],
  }; }
  try {
    await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    await page.route('**/api/player/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: bootstrap() });
      if (path.endsWith('/story')) return route.fulfill({ status: 503, json: { error: 'Campaign tested by the database suite' } });
      if (path.endsWith('/onboarding')) {
        const body = req.postDataJSON();
        if (body.action === 'choose-starter') { assert.equal(body.starterDeckId, ROOKIE_FOUNDATION_ID); collected = true; }
        if (body.action === 'complete-tutorial') { assert.ok(tested); step = 'reward'; }
        if (body.action === 'claim-reward') { assert.ok(tested); step = 'complete'; claims++; }
        return route.fulfill({ json: bootstrap() });
      }
      if (req.method() === 'PUT' && path.includes('/decks/')) {
        if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { error: 'Save interrupted. Retry your deck.' } }); }
        draft = { ...draft, ...req.postDataJSON() };
        return route.fulfill({ json: bootstrap() });
      }
      if (path.endsWith('/matches')) {
        started++;
        assert.equal(req.postDataJSON().playerDeckId, ROOKIE_DECK_ID);
        issued = createStoryMatch(encounter, catalogIdsToEngineIds(draft.cardIds), ROOKIE_DECK_ID, undefined, districts);
        return route.fulfill({ json: { id: '11111111-1111-4111-8111-111111111111', mode: 'tutorial', playerDeckId: ROOKIE_DECK_ID, rivalDeckId: encounter.enemy.deckId, encounterSnapshot: encounter, districtSnapshot: districts, abilityUpgradeSnapshot: issued.abilityUpgradeSnapshot, status: 'active', createdAt: new Date().toISOString() } });
      }
      if (path.endsWith('/complete')) {
        assert.ok(issued);
        const verified = verifyStoryMatchTranscript(encounter, catalogIdsToEngineIds(draft.cardIds), req.postDataJSON().moves, ROOKIE_DECK_ID, issued.abilityUpgradeSnapshot, districts);
        assert.equal(getMatchWinner(verified), 'player');
        assert.deepEqual(getTutorialMilestones(verified), { playerCardPlayed: true, bankedMotionAfterPlay: true, squabbleUsed: true });
        const mentor = verified.effectLog.find(event => event.type === 'play' && event.cardId === 'drfade');
        assert.equal(mentor?.round, 4); assert.match(mentor!.note, /SQUABBLE/);
        tested = true; step = 'reward';
        return route.fulfill({ json: { ...bootstrap(), reward: { id: 'test-reward', label: 'Lesson saved', xp: 0, streetRep: 0, softCurrency: 0, packTickets: 0, descriptions: [], cardXpRewards: [], storyRewards: [] }, alreadyCompleted: false, campaign: null, story: null } });
      }
      return route.fulfill({ status: 404, json: { error: 'Unexpected request' } });
    });
    await page.goto(origin + '/game/onboarding');
    await page.getByTestId('rookie-welcome').waitFor();
    assert.equal(await page.locator('vite-error-overlay').count(), 0);
    await page.screenshot({ path: '../../screenshots/rookie-welcome-' + width + '.png' });
    await page.getByRole('button', { name: 'Show me around' }).click();
    for (let index = 0; index < 6; index++) {
      if (index === 1) await page.screenshot({ path: '../../screenshots/rookie-home-' + width + '.png' });
      await clickCoach(page);
      await page.waitForTimeout(250);
    }
    await page.getByTestId('dr-fade-welcome').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.dr-fade-art img')].every(img => img.complete && img.naturalWidth > 0));
    assert.ok(await page.getByTestId('dr-fade-welcome').getByText('6', { exact: true }).count());
    await page.screenshot({ path: '../../screenshots/dr-fade-welcome-' + width + '.png', fullPage: true });
    await page.getByRole('button', { name: 'Build with Dr. Fade' }).click();
    await page.locator('[data-guide-slot="5"]').waitFor();
    await clickCoach(page);
    await clickCoach(page);
    await page.screenshot({ path: '../../screenshots/rookie-deck-' + width + '.png' });
    await clickCoach(page);
    await page.getByRole('alert').waitFor();
    assert.equal(started, 0, 'A failed save must not start the match');
    await clickCoach(page);
    assert.equal(draft.cardIds[5], 'nail-tech');
    let clicks = 0;
    for (let attempt = 0; attempt < 550; attempt++) {
      if (await page.getByRole('heading', { name: 'Something went wrong' }).count()) throw Error(await page.locator('body').innerText());
      if (await page.getByTestId('status-match-result').count() || await page.getByRole('heading', { name: 'You built this gang.' }).count()) break;
      if (await page.getByTestId('fade-spotlight').count()) {
        if (clicks === 1) await page.screenshot({ path: '../../screenshots/rookie-battle-' + width + '.png' });
        await clickCoach(page); clicks++;
      } else {
        const lesson = page.getByTestId('button-dismiss-mechanic-lesson');
        if (await lesson.count()) await lesson.click();
        const skip = page.getByRole('button', { name: /^Continue past / });
        if (await skip.count()) await skip.click({ timeout: 500 }).catch(() => {});
        const fast = page.getByTestId('button-fast-forward');
        if (await fast.count()) await fast.click({ timeout: 500 }).catch(() => {});
      }
      await page.waitForTimeout(100);
    }
    if (await page.getByTestId('status-match-result').count()) {
      assert.equal(await page.getByRole('button', { name: 'Continue Chapter', exact: true }).count(), 0, 'Tutorial must use the tutorial result actions');
      await page.getByTestId('button-complete-tutorial').click();
    }
    await page.getByRole('heading', { name: 'You built this gang.' }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'You built this gang.' }).waitFor();
    await page.getByRole('button', { name: 'Claim reward & enter Chapter One' }).click();
    await page.waitForURL('**/game/story');
    assert.equal(started, 1, 'Only one match is required');
    assert.equal(claims, 1);
    assert.deepEqual(errors, []);
    console.log(width + 'px: home tour, guided swap, failed-save recovery, verified win, reload and one-time reward passed.');
  } catch (error) {
    await page.screenshot({ path: '../../screenshots/rookie-debug-' + width + '.png', fullPage: true });
    console.log(JSON.stringify({ errors, text: (await page.locator('body').innerText()).slice(-3500) }));
    throw error;
  } finally { await browser.close(); }
}
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  for (const [w,h] of process.env.ROOKIE_SIZE === 'desktop' ? [[1280,900]] : process.env.ROOKIE_SIZE === 'small' ? [[320,740]] : [[390,844],[1280,900]]) await run(w,h);
} finally { server.kill(); }
