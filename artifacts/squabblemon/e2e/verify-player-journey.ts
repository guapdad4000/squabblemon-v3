import assert from 'node:assert/strict';
import { chromium, expect, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cards, catalogCardById, ROOKIE_MENTOR_CORE_IDS, ROOKIE_DECK_ID, ROOKIE_FOUNDATION_IDS, ROOKIE_FOUNDATION_ID, catalogIdsToEngineIds } from '../src/data';
import { createStoryMatch, verifyStoryMatchTranscript, getMatchWinner, type Match } from '../src/gameEngine';
import { rookieDistricts, rookieEncounter } from '@workspace/squabblemon-engine/rookie';
import { getTutorialMilestones } from '../../api-server/src/lib/tutorialMilestones';
import homeLessons from '../src/lib/safehouseTour.json';

const output = process.env.ROOKIE_OUTPUT ?? '/tmp/squabblemon-rookie-journey';
await mkdir(output, { recursive: true });
const port = process.env.ROOKIE_PORT ?? '4197', origin = 'http://127.0.0.1:' + port + '/squabblemon';
const server = spawn(process.execPath, ['../../node_modules/vite/bin/vite.js', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', port], { env: { ...process.env, PORT: port, BASE_PATH: '/squabblemon/', VITE_E2E_AUTH: 'true' }, stdio: 'ignore', windowsHide: true });
async function clickCoach(page: Page) {
  const guide = page.getByTestId('fade-spotlight');
  await guide.waitFor();
  // The scene-reveal and hide-tip controls are not lesson advancement.
  const next = guide.locator('button.venue-button');
  const nextCount = await next.count();
  assert.ok(nextCount <= 1, 'A coach step must expose at most one primary next action');
  if (nextCount) { await next.click(); return; }
  const selector = await guide.getAttribute('data-coach-target');
  assert.ok(selector);
  const target = page.locator(selector).first();
  if (selector === '.safehouse-room-actions') await target.getByRole('button', { name: 'Build your gang', exact: true }).click();
  else await target.click({ timeout: 12000 });
}
async function run(width: number, height: number) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE, headless: true });
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors: string[] = [], unexpectedRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let step = 'tutorial', collected = false, tested = false, failSave = true, claims = 0, started = 0;
  let draft = { id: ROOKIE_DECK_ID, name: 'My First Gang', cardIds: [...ROOKIE_MENTOR_CORE_IDS], heroCardId: 'dr-fade', recipeId: null, valid: true, issues: [] };
  let issued: Match | null = null;
  let plannedRecruit: string | null = null;
  const saveAttempts: unknown[] = [];
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
    // Keep this isolated HTTP journey on its loaded candidate; unrelated shared
    // worktree edits must not let Vite reload a live, unsaved tutorial battle.
    await page.routeWebSocket('**', socket => socket.close());
    await page.route('**/api/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: bootstrap() });
      if (req.method() === 'GET') {
        const reads: Record<string, unknown> = {
          '/api/player/mail': { messages: [] },
          '/api/player/challenges/runs': [],
          '/api/events/patches': [],
          '/api/player/notifications/receipts': { ids: [] },
          '/api/player/rewards/account': { date: '2026-10-25', pending: [], growth: { ready: false } },
          '/api/player/rewards/starter-mythic': { state: 'claimed', ownsCard: true, chapters: [] },
          '/api/player/rewards/john-henry': { state: 'claimed', ownsCard: true, chapters: [] },
          '/api/player/shop/daily-clout': { date: '2026-10-25', available: false, amount: 50, attemptsRemaining: 0, resetsAt: '2026-10-26T00:00:00Z' },
          '/api/social': { self: { friendCode: 'ROOKIE1', displayName: 'Rookie', avatarKey: 'hooper', level: 1 }, homies: [], incomingRequests: [], outgoingRequests: [], blocked: [], invitations: [], counts: { requests: 0, invitations: 0 } },
        };
        if (Object.hasOwn(reads, path)) return route.fulfill({ json: reads[path] });
      }
      if (path.endsWith('/story')) return route.fulfill({ status: 503, json: { error: 'Campaign tested by the database suite' } });
      if (path.endsWith('/onboarding')) {
        const body = req.postDataJSON();
        if (body.action === 'choose-starter') { assert.equal(body.starterDeckId, ROOKIE_FOUNDATION_ID); collected = true; }
        if (body.action === 'complete-tutorial') { assert.ok(tested); step = 'reward'; }
        if (body.action === 'claim-reward') { assert.ok(tested); step = 'complete'; claims++; }
        return route.fulfill({ json: bootstrap() });
      }
      if (req.method() === 'PUT' && path.includes('/decks/')) {
        saveAttempts.push(req.postDataJSON());
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
      unexpectedRequests.push(`${req.method()} ${path}`);
      return route.fulfill({ status: 404, json: { error: 'Unexpected request' } });
    });
    await page.goto(origin + '/e2e/rookie-review-scroll.fixture.html?screen=late-review');
    await expect(page.getByTestId('rookie-reward-primer')).toBeVisible();
    await page.evaluate(() => (window as any).__rookieReviewTest.savedBattleArrives());
    await expect(page.getByTestId('rookie-lesson-complete')).toBeVisible();
    await page.getByTestId('button-review-setup-lesson').click();
    await expect(page.locator('.deck-workbench')).toBeVisible();
    await page.evaluate(() => (window as any).__rookieReviewTest.refreshSavedBattle());
    await expect(page.locator('.deck-workbench')).toBeVisible();
    await expect(page.getByTestId('rookie-lesson-complete')).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue from your saved practice fade', exact: true }).click();
    await expect(page.getByTestId('rookie-lesson-complete')).toBeVisible();
    await page.goto(origin + '/e2e/rookie-review-scroll.fixture.html?screen=late-review');
    await page.getByTestId('button-review-setup-lesson').click();
    await page.evaluate(() => (window as any).__rookieReviewTest.savedBattleArrives());
    await expect(page.locator('.deck-workbench')).toBeVisible();
    await expect(page.getByTestId('rookie-lesson-complete')).toHaveCount(0);
    console.log(`${width}px: late saved-battle receipt opens the review once; deliberate setup navigation before or after arrival survives refresh.`);
    await page.goto(origin + '/game/onboarding');
    await page.getByTestId('rookie-welcome').waitFor();
    assert.equal(await page.locator('vite-error-overlay').count(), 0);
    await page.screenshot({ path: path.join(output, 'rookie-welcome-' + width + '.png') });
    await page.getByRole('button', { name: 'Show me around' }).click();
    for (const [index, lesson] of homeLessons.entries()) {
      const guide = page.getByTestId('fade-spotlight');
      await expect(guide.locator('.fade-eyebrow')).toHaveText(`DR. FADE / HOME ${index + 1} / ${homeLessons.length}`);
      await expect(guide).toHaveAttribute('data-coach-target', lesson.target);
      await expect(guide.getByRole('heading', { name: lesson.title, exact: true })).toBeVisible();
      if (index === 1) await page.screenshot({ path: path.join(output, 'rookie-home-' + width + '.png') });
      await clickCoach(page);
    }
    await page.getByTestId('dr-fade-welcome').waitFor();
    await page.waitForFunction(() => { const images = [...document.querySelectorAll<HTMLImageElement>('.dr-fade-welcome__card img')]; return images.length > 0 && images.every(img => img.complete && img.naturalWidth > 0); });
    const mentorCard = page.getByTestId('dr-fade-welcome').locator(`[data-card-id="${cards.drfade.id}"]`);
    await expect(mentorCard).toHaveAttribute('data-card-cost', String(cards.drfade.cost));
    await expect(mentorCard).toHaveAttribute('data-card-power', String(cards.drfade.power));
    await expect(page.getByTestId('dr-fade-welcome').locator('.dr-fade-welcome__copy')).toContainText(`Play him for ${cards.drfade.cost} Motion. He brings ${cards.drfade.power} Hands`);
    await expect(page.getByTestId('dr-fade-welcome').locator('.dr-fade-welcome__lesson')).toContainText(`${cards.drfade.power * 2} base Hands`);
    await page.screenshot({ path: path.join(output, 'dr-fade-welcome-' + width + '.png'), fullPage: true });
    await page.getByRole('button', { name: 'Build with Dr. Fade' }).click();
    for (let step = 1; step <= 3; step++) {
      await expect(page.getByTestId('fade-spotlight').locator('.fade-eyebrow')).toHaveText(`DR. FADE / YOUR GANG ${step} / 4`);
      if (step === 2) {
        const target = await page.getByTestId('fade-spotlight').getAttribute('data-coach-target');
        assert.ok(target);
        plannedRecruit = await page.locator(target).getAttribute('data-guide-recruit');
        assert.ok(plannedRecruit && ROOKIE_FOUNDATION_IDS.includes(plannedRecruit));
        assert.ok(!draft.cardIds.includes(plannedRecruit), 'The coached recruit must replace a slot with a new owned card');
      }
      if (step === 3) {
        await expect(page.getByTestId('planned-card-swap')).toContainText('Swap plan · slot 6');
        await expect(page.getByTestId('planned-card-swap')).toContainText(catalogCardById[plannedRecruit!].name);
      }
      await clickCoach(page);
    }
    await expect(page.getByTestId('fade-spotlight').locator('.fade-eyebrow')).toHaveText('DR. FADE / YOUR GANG 4 / 4');
    await page.screenshot({ path: path.join(output, 'rookie-deck-' + width + '.png') });
    await clickCoach(page);
    await page.getByRole('alert').waitFor();
    assert.equal(started, 0, 'A failed save must not start the match');
    await clickCoach(page);
    assert.equal(draft.cardIds[5], plannedRecruit);
    assert.equal(saveAttempts.length, 2);
    assert.deepEqual(saveAttempts[0], saveAttempts[1], 'Save retry must preserve the exact planned crew');
    await expect(page.getByTestId('rookie-fight-brief')).toBeVisible();
    assert.equal(started, 0, 'Saving the crew cannot bypass the fight briefing');
    await page.getByTestId('button-start-guided-fight').click();
    console.log(`${width}px: reached guided fight after ${homeLessons.length} Home lessons and exact saved-crew retry.`);
    let clicks = 0, rivalReadingPauses = 0, roundRecaps = 0;
    for (let attempt = 0; attempt < 550; attempt++) {
      if (await page.getByRole('heading', { name: 'Something went wrong' }).count()) throw Error(await page.locator('body').innerText());
      if (await page.getByTestId('status-match-result').count() || await page.getByRole('heading', { name: 'You built this gang.' }).count()) break;
      if (await page.getByTestId('fade-spotlight').count()) {
        if (clicks === 1) await page.screenshot({ path: path.join(output, 'rookie-battle-' + width + '.png') });
        await clickCoach(page); clicks++;
      } else {
        const continuePlay = page.getByTestId('button-continue-guided-reading');
        if (await continuePlay.count()) {
          const kind = await page.getByTestId('guided-reading-cue').getAttribute('data-cue-kind');
          assert.ok(kind === 'event' || kind === 'round', 'Every coached reading gate must identify its purpose');
          if (kind === 'event') rivalReadingPauses++; else roundRecaps++;
          await continuePlay.click();
        }
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
    await expect(page.getByTestId('rookie-post-fight-handoff')).toBeVisible();
    assert.equal(tested, true, 'The shared engine must verify the actual battle before reward handoff');
    await page.getByRole('button', { name: 'See reward & next steps', exact: true }).click();
    await page.getByRole('heading', { name: 'You built this gang.' }).waitFor();
    await page.screenshot({ path: path.join(output, 'rookie-receipt-' + width + '.png') });
    await page.reload();
    await page.getByRole('heading', { name: 'You built this gang.' }).waitFor();
    await page.getByRole('button', { name: 'Claim reward & enter Chapter One' }).click();
    await page.waitForURL('**/game/story');
    assert.equal(started, 1, 'Only one match is required');
    assert.ok(rivalReadingPauses > 0, 'The actual narrated rival-reading pause must be acknowledged');
    assert.equal(roundRecaps, 3, 'Each boundary of the four-round lesson must show its recap before advancing');
    assert.equal(claims, 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedRequests, [], 'Every API request must be part of the declared isolated journey');
    await writeFile(path.join(output, `rookie-${width}.json`), JSON.stringify({ width, height, lateReceiptRecovery: true, homeSteps: homeLessons.length, rivalReadingPauses, roundRecaps, plannedRecruit, verified: tested, started, claims, errors, unexpectedRequests }, null, 2));
    console.log(width + 'px: home tour, guided swap, failed-save recovery, verified win, reload and one-time reward passed.');
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'rookie-debug-' + width + '.png'), fullPage: true });
    console.log(JSON.stringify({ errors, step, tested, started, claims, unexpectedRequests, text: (await page.locator('body').innerText()).slice(-3500) }));
    throw error;
  } finally { await browser.close(); }
}
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error(`Rookie fixture server exited (${server.exitCode})`);
    try { if ((await fetch(origin + '/', { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Rookie fixture server must become ready before browser checks');
  for (const [w,h] of process.env.ROOKIE_SIZE === 'desktop' ? [[1280,900]] : process.env.ROOKIE_SIZE === 'small' ? [[320,740]] : [[390,844],[1280,900]]) await run(w,h);
} finally { server.kill(); }
