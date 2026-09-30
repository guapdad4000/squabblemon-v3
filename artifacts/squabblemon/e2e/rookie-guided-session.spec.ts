import { expect, test, type Page } from '@playwright/test';
import type { MatchCompletion, PlayerBootstrap } from '@workspace/api-client-react';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { rookieDistricts, rookieEncounter } from '@workspace/squabblemon-engine/rookie';
import { completedTutorialMilestones, getTutorialMilestones } from '../../api-server/src/lib/tutorialMilestones';
import { ROOKIE_DECK_ID, ROOKIE_FOUNDATION_ID, ROOKIE_FOUNDATION_IDS, ROOKIE_MENTOR_CORE_IDS, catalogIdsToEngineIds } from '../src/data';
import { getMatchWinner, verifyStoryMatchTranscript, type TranscriptMove } from '../src/gameEngine';

const encounter = rookieEncounter();
const districts = rookieDistricts();

type JourneyStep = 'tutorial' | 'reward' | 'complete';

function playerBootstrap(step: JourneyStep, savedCards = ROOKIE_MENTOR_CORE_IDS): PlayerBootstrap {
  const completed = step !== 'tutorial';
  const claimed = step === 'complete';
  const savedDeck = {
    id: ROOKIE_DECK_ID,
    name: 'My First Gang',
    cardIds: [...savedCards],
    heroCardId: savedCards.includes('dr-fade') ? 'dr-fade' : savedCards[0],
    recipeId: null,
    valid: true,
    issues: [],
  };
  return {
    profile: {
      id: 'e2e-guided-rookie',
      displayName: 'ROOKIE',
      avatarKey: 'rookie',
      onboardingStep: step,
      starterDeckId: ROOKIE_FOUNDATION_ID,
      streetRep: 0,
      xp: 0,
      level: 1,
      softCurrency: claimed ? 250 : 0,
      packTickets: claimed ? 1 : 0,
      styleShards: 0,
      packPity: 0,
      deckSlots: 3,
      cosmeticCurrency: 0,
      collectionProgress: ROOKIE_FOUNDATION_IDS.length,
      storyChapter: 1,
      storyNode: 0,
      tutorialCompleted: completed,
      starterRewardClaimed: claimed,
      ageConfirmedAt: '2026-09-08T00:00:00.000Z',
      termsAcceptedAt: '2026-09-08T00:00:00.000Z',
      settings: { reducedMotion: true, turnTimerEnabled: false },
      ownedCardIds: [...ROOKIE_FOUNDATION_IDS],
      discoveredCardIds: [...ROOKIE_FOUNDATION_IDS],
      ownedVariants: [],
      equippedVariants: {},
      cardProgression: {},
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      savedDecks: [savedDeck],
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: '2026-09-08T00:00:00.000Z',
    },
    missions: [{
      id: 'rookie-road',
      title: 'Rookie Road',
      description: 'Finish your first session',
      cadence: 'onboarding',
      progress: completed ? 1 : 0,
      goal: 1,
      status: completed ? 'claimable' : 'active',
      rewardAmount: 100,
      rewardCurrency: 'softCurrency',
      resetAt: null,
    }],
    nextAction: {
      id: step === 'complete' ? 'enter-story' : `onboarding-${step}`,
      eyebrow: step === 'complete' ? 'Chapter One' : 'Rookie Road',
      title: step === 'complete' ? 'Enter the story' : 'Finish setup',
      description: step === 'complete' ? 'Your gang is ready.' : 'Complete the next Rookie Road step.',
      destination: step === 'complete' ? 'story' : 'onboarding',
      rewardLabel: null,
    },
    packConfig: {
      id: 'street-pack',
      name: 'Street Pack',
      oddsVersion: 'e2e-guided-v1',
      softCurrencyCost: 500,
      ticketCost: 1,
      rewardsPerPack: 3,
      pityLimit: 10,
      odds: [],
    },
    tenPullConfig: {
      id: 'e2e-ten-pull',
      name: 'Practice Ten Pull',
      oddsVersion: 'e2e-guided-v1',
      pullCount: 10,
      ticketCost: 9,
      softCurrencyCost: 1800,
      rewardsPerPull: 3,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}

type MatchRequest = {
  mode: 'practice' | 'tutorial' | 'story';
  playerDeckId: string;
  rivalDeckId: string;
};

async function installDisposableAccountApi(page: Page) {
  let step: JourneyStep = 'tutorial';
  let deckCards = [...ROOKIE_MENTOR_CORE_IDS];
  let verifiedMatchId: string | null = null;
  let startRequest: MatchRequest | null = null;
  let completion: MatchCompletion | null = null;
  let rejectedTranscript: string | null = null;
  let movesReceived: TranscriptMove[] = [];
  let bootstrapRequests = 0;
  let completionRequests = 0;
  const onboardingActions: string[] = [];

  const bootstrap = () => playerBootstrap(step, deckCards);
  await page.route('**/api/player/**', async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname.endsWith('/bootstrap')) {
      bootstrapRequests++;
      return route.fulfill({ json: bootstrap() });
    }

    if (request.method() === 'PUT' && /\/decks\/[^/]+$/.test(url.pathname)) {
      const body = request.postDataJSON() as { cardIds: string[] };
      deckCards = [...body.cardIds];
      return route.fulfill({ json: bootstrap() });
    }

    if (request.method() === 'POST' && url.pathname.endsWith('/matches')) {
      startRequest = request.postDataJSON() as MatchRequest;
      if (startRequest.mode !== 'tutorial' || startRequest.playerDeckId !== ROOKIE_DECK_ID) {
        return route.fulfill({ status: 400, json: { error: 'This journey expects the saved Rookie Road deck.' } });
      }
      const playerCards = catalogIdsToEngineIds(deckCards);
      const matchUpgrades = createAbilityUpgradeSnapshot(playerCards, encounter.enemy.cardIds);
      verifiedMatchId = 'server-issued-rookie-road-v2-match';
      return route.fulfill({
        status: 201,
        json: {
          id: verifiedMatchId,
          mode: 'tutorial',
          playerDeckId: ROOKIE_DECK_ID,
          rivalDeckId: encounter.enemy.deckId,
          storyNodeId: null,
          contentVersion: null,
          encounterSnapshot: encounter,
          abilityUpgradeSnapshot: matchUpgrades,
          districtSnapshot: districts,
          status: 'active',
          createdAt: '2026-09-08T00:00:00.000Z',
        },
      });
    }

    const completeMatch = url.pathname.match(/\/matches\/([^/]+)\/complete$/);
    if (request.method() === 'POST' && completeMatch) {
      completionRequests++;
      const body = request.postDataJSON() as { moves: TranscriptMove[] };
      movesReceived = body.moves;
      if (!verifiedMatchId || completeMatch[1] !== verifiedMatchId) {
        rejectedTranscript = 'The completion request did not reference the issued match.';
        return route.fulfill({ status: 404, json: { error: rejectedTranscript } });
      }

      try {
        const playerCards = catalogIdsToEngineIds(deckCards);
        const matchUpgrades = createAbilityUpgradeSnapshot(playerCards, encounter.enemy.cardIds);
        const verified = verifyStoryMatchTranscript(
          encounter,
          playerCards,
          body.moves,
          ROOKIE_DECK_ID,
          matchUpgrades,
          districts,
        );
        const milestones = getTutorialMilestones(verified);
        if (!completedTutorialMilestones(milestones)) {
          throw new Error(`Guided tutorial milestones missing: ${JSON.stringify(milestones)}`);
        }
        if (verified.round !== 4 || getMatchWinner(verified) !== 'player') {
          throw new Error(`Expected a verified four-round rookie win; got round ${verified.round}, winner ${getMatchWinner(verified)}.`);
        }

        step = 'reward';
        const current = bootstrap();
        completion = {
          profile: current.profile,
          missions: current.missions,
          nextAction: current.nextAction,
          reward: {
            id: 'rookie-road-tutorial',
            label: 'Tutorial complete',
            xp: 0,
            streetRep: 0,
            softCurrency: 0,
            packTickets: 0,
            descriptions: ['Your first guided fade is verified.'],
            storyRewards: [],
            cardXp: [],
          },
          alreadyCompleted: false,
          campaign: null,
          story: null,
        };
        return route.fulfill({ json: completion });
      } catch (error) {
        rejectedTranscript = error instanceof Error ? error.message : String(error);
        return route.fulfill({ status: 400, json: { error: rejectedTranscript } });
      }
    }

    if (request.method() === 'POST' && url.pathname.endsWith('/onboarding')) {
      const { action } = request.postDataJSON() as { action: string };
      onboardingActions.push(action);
      if (action === 'complete-tutorial') {
        if (!completion) return route.fulfill({ status: 409, json: { error: 'A verified Rookie Road match is required.' } });
        step = 'reward';
      } else if (action === 'claim-reward') {
        if (step !== 'reward') return route.fulfill({ status: 409, json: { error: 'Finish the first session before claiming the reward.' } });
        step = 'complete';
      } else {
        return route.fulfill({ status: 400, json: { error: `Unexpected onboarding action: ${action}` } });
      }
      return route.fulfill({ json: bootstrap() });
    }

    return route.fulfill({
      status: 404,
      json: { error: `Unmocked player API request: ${request.method()} ${url.pathname}` },
    });
  });

  return {
    startRequest: () => startRequest,
    completion: () => completion,
    rejectedTranscript: () => rejectedTranscript,
    movesReceived: () => movesReceived,
    onboardingStep: () => step,
    bootstrapRequests: () => bootstrapRequests,
    completionRequests: () => completionRequests,
    onboardingActions: () => onboardingActions,
  };
}

async function clickCurrentCoachTarget(page: Page) {
  const spotlight = page.getByTestId('fade-spotlight');
  await expect(spotlight).toBeVisible();
  const selector = await spotlight.getAttribute('data-coach-target');
  expect(selector, 'Dr. Fade should point at a real in-game control').toBeTruthy();
  await expect(page.locator(selector!)).toBeVisible();
  await page.locator(selector!).click();
}

/** Geometry of the coach feedback actually on screen: guidance strip, reading cue, Dr. Fade spotlight. */
async function assertCoachFeedbackReadable(page: Page, label: string) {
  const report = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    // Method syntax stays self-contained when tsx serializes this browser callback.
    const geometry = {
      box(el: Element | null) { return el ? el.getBoundingClientRect() : null; },
      visible(r: DOMRect | null) { return !!r && r.width > 0 && r.height > 0; },
      overlap(a: DOMRect, b: DOMRect) { return a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1; },
      inView(r: DOMRect) { return r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1; },
      topmost(el: Element) { const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === el || el.contains(h)); },
    };
    const { box, visible, overlap, inView, topmost } = geometry;
    const problems: string[] = [];
    const guidance = document.querySelector('.battle-guidance');
    const frame = box(guidance?.querySelector('.dr-fade-coach-frame') ?? null);
    const copy = guidance?.querySelector(':scope > .min-w-0') ?? null;
    if (!guidance || !visible(box(guidance))) problems.push('guidance strip missing');
    if (frame && visible(frame) && copy) {
      for (const el of copy.querySelectorAll('[data-testid="battle-phase-status"], .battle-guidance-kicker, [data-testid="battle-guidance"], .guided-reading-cue h3, .guided-reading-cue__body')) {
        const r = el.getBoundingClientRect();
        if (visible(r) && overlap(frame, r)) problems.push(`coach portrait overlaps ${el.className || el.getAttribute('data-testid')}`);
      }
    }
    const status = document.querySelector('[data-testid="battle-phase-status"]');
    if (!status) problems.push('phase status missing');
    else if (!inView(status.getBoundingClientRect()) || !topmost(status)) problems.push('phase status covered or off-screen');
    const tip = document.querySelector('[data-testid="fade-spotlight"] .fade-tip');
    if (tip && visible(box(tip))) {
      const t = tip.getBoundingClientRect();
      if (!inView(t)) problems.push('spotlight tip off-screen');
      const portrait = tip.querySelector(':scope > img.dr-fade-portrait');
      if (!portrait) problems.push('spotlight coach portrait missing');
      const text = tip.querySelectorAll('h2, p, .fade-eyebrow');
      const pr = box(portrait);
      if (pr && visible(pr)) for (const el of text) { const r = el.getBoundingClientRect(); if (visible(r) && overlap(pr, r)) problems.push(`spotlight portrait overlaps ${el.tagName}`); }
      for (const b of tip.querySelectorAll('button')) { const r = b.getBoundingClientRect(); if (visible(r) && (!inView(r) || !topmost(b))) problems.push(`spotlight control unreachable: ${b.textContent}`); }
    }
    for (const id of ['button-continue-guided-reading', 'button-lock', 'button-next-round', 'button-resolving']) {
      const b = document.querySelector(`[data-testid="${id}"]`);
      const r = box(b);
      if (b && visible(r) && (!inView(r!) || !topmost(b))) problems.push(`${id} unreachable`);
    }
    return { problems, cue: !!document.querySelector('[data-testid="guided-reading-cue"]'), spotlight: !!tip, phase: document.querySelector('[data-testid="battle-arena"]')?.getAttribute('data-presentation-phase') };
  });
  expect(report.problems, `${label}: coach feedback must be bounded and reachable (${JSON.stringify(report)})`).toEqual([]);
  return report;
}

type ReadingEvidence = {
  plugFeedback: string[];
  lessonSources: string[];
  cornballHeld: boolean;
  readingCues: string[];
  rivalVoiceChecked: boolean;
};

async function waitForDecisionOrResult(page: Page, evidence: ReadingEvidence) {
  await expect.poll(async () => {
    const firstSighting = page.getByRole('button', { name: 'Back to the battle' });
    if (await firstSighting.isVisible().catch(() => false)) {
      evidence.lessonSources.push(await page.getByTestId('effect-causality').innerText());
      const geometry = await page.getByTestId('mechanic-lesson').evaluate(root => {
        const image = root.querySelector('.mechanic-lesson-portrait')!.getBoundingClientRect();
        const copy = root.querySelector('.mechanic-lesson-copy')!.getBoundingClientRect();
        return image.right <= copy.left || image.left >= copy.right || image.bottom <= copy.top;
      });
      expect(geometry, 'The real first-sighting portrait must not cover the explanation').toBe(true);
      const dismissBox = await firstSighting.boundingBox();
      const viewport = page.viewportSize()!;
      expect(dismissBox && dismissBox.y >= 0 && dismissBox.y + dismissBox.height <= viewport.height, 'First-sighting dismiss control is reachable').toBe(true);
      // The modal unmounts during its click. Do not wait indefinitely for an
      // element that no longer exists while the presentation advances.
      await firstSighting.click({ noWaitAfter: true, timeout: 3000 }).catch(async error => {
        if (await firstSighting.isVisible().catch(() => false)) throw error;
      });
      return 'transitioning';
    }
    const cue = page.getByTestId('guided-reading-cue');
    if (await cue.isVisible().catch(() => false)) {
      const text = await cue.innerText();
      evidence.readingCues.push(text);
      const firstRivalCue = await cue.getAttribute('data-cue-kind') === 'event' && !evidence.rivalVoiceChecked;
      if (firstRivalCue) {
        await expect.poll(() => page.evaluate(() =>
          (window as typeof window & { __rivalReadingAudio: HTMLAudioElement[] }).__rivalReadingAudio.length,
        )).toBe(1);
      }
      const phase = await page.getByTestId('battle-arena').getAttribute('data-presentation-phase');
      if (/Cornball/i.test(text) && phase === 'effects' && !evidence.cornballHeld) {
        await page.waitForTimeout(2600);
        await expect(cue).toHaveText(text, { useInnerText: true });
        await expect(page.getByTestId('battle-phase-status')).toContainText('Effects resolve');
        await expect(page.getByTestId('button-fast-forward')).toHaveCount(0);
        evidence.cornballHeld = true;
      }
      await page.getByTestId('button-continue-guided-reading').click();
      if (firstRivalCue) {
        await expect.poll(() => page.evaluate(() => {
          const audio = (window as typeof window & { __rivalReadingAudio: HTMLAudioElement[] }).__rivalReadingAudio[0];
          return { paused: audio.paused, released: !audio.hasAttribute('src') };
        })).toEqual({ paused: true, released: true });
        evidence.rivalVoiceChecked = true;
      }
      return 'transitioning';
    }
    if (await page.getByTestId('button-complete-tutorial').isVisible().catch(() => false)) return 'result';
    const arena = page.getByTestId('battle-arena');
    if (await arena.isVisible().catch(() => false) && await arena.getAttribute('data-presentation-phase') === 'player-ready') return 'decision';
    return 'transitioning';
  }, { timeout: 90_000 }).not.toBe('transitioning');
}

test('real Rookie Road route issues and verifies the guided four-round fade', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  // Observe the real audio elements without replacing play, pause, or the media decoder.
  await page.addInitScript({ content: `(() => {
    const NativeAudio = window.Audio;
    window.__rivalReadingAudio = [];
    window.Audio = function (src) {
      const audio = new NativeAudio(src);
      if (typeof src === 'string' && src.includes('/expanded-rival-reading-pause.')) {
        window.__rivalReadingAudio.push(audio);
      }
      return audio;
    };
    window.Audio.prototype = NativeAudio.prototype;
  })()` });
  const api = await installDisposableAccountApi(page);
  const evidence: ReadingEvidence = { plugFeedback: [], lessonSources: [], cornballHeld: false, readingCues: [], rivalVoiceChecked: false };

  await page.goto('/squabblemon/sign-up');
  await page.getByRole('button', { name: 'Create disposable test account' }).click();
  await expect(page.getByTestId('dr-fade-welcome')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Build with Dr. Fade' }).click();
  await expect(page.getByTestId('deck-roster-grid')).toBeVisible();

  // Follow the real four-step deck lesson: choose a slot, plan a recruit,
  // confirm the swap, then save the lineup for the actual guided fade.
  for (let step = 0; step < 4; step += 1) await clickCurrentCoachTarget(page);
  await expect(page.getByTestId('rookie-fight-brief')).toBeVisible();
  await page.getByTestId('button-start-guided-fight').click();

  await expect.poll(() => api.startRequest()).toMatchObject({
    mode: 'tutorial',
    playerDeckId: ROOKIE_DECK_ID,
  });
  await expect(page.getByTestId('battle-arena')).toBeVisible();
  await waitForDecisionOrResult(page, evidence);

  // Rules/help is a real control during the coached turn, not a harness modal.
  await page.locator('details.battle-tools > summary').click();
  await page.getByTestId('button-rules-battle').click();
  const rules = page.getByRole('dialog');
  await expect(rules.getByRole('heading', { name: 'Know the streets.' })).toBeVisible();
  await expect(rules.getByText(/claim at least two of the three/i)).toBeVisible();
  await page.getByTestId('button-rules-modal').click();
  await page.locator('details.battle-tools > summary').click();

  const committedActions: string[] = [];
  for (let actionIndex = 0; actionIndex < 20; actionIndex += 1) {
    const completionButton = page.getByTestId('button-complete-tutorial');
    await waitForDecisionOrResult(page, evidence);
    if (await completionButton.isVisible().catch(() => false)) break;

    const arena = page.getByTestId('battle-arena');
    const focus = await arena.getAttribute('data-tutorial-focus');
    const stepMarker = page.locator('[data-testid^="tutorial-step-"]');
    const stepId = await stepMarker.getAttribute('data-testid');
    expect(stepId, 'The real tutorial step marker should identify each coached action').toBeTruthy();
    expect(['card', 'district', 'play', 'squabble', 'end-turn', 'free']).toContain(focus);

    if (focus === 'card' || focus === 'district') {
      await clickCurrentCoachTarget(page);
    } else if (focus === 'squabble') {
      await page.getByTestId('button-squabble').click();
    } else if (focus === 'play') {
      await expect(page.getByTestId('button-lock')).toBeEnabled();
      committedActions.push(stepId!);
      const boardPlugs = page.locator('[data-card-zone="board"][data-card-id="plug"]');
      const plugsBefore = await boardPlugs.count();
      await page.getByTestId('button-lock').click();
      // Identify the real Plug play by the board, not by an assumed popup.
      if (!evidence.plugFeedback.length) {
        await expect.poll(() => boardPlugs.count(), { timeout: 8000 }).toBeGreaterThan(plugsBefore);
        const during = await assertCoachFeedbackReadable(page, 'During the real Plug play');
        evidence.plugFeedback.push(`during:${during.phase}`);
        await page.screenshot({ path: testInfo.outputPath('guided-plug-feedback-during.png') });
        await waitForDecisionOrResult(page, evidence);
        const after = await assertCoachFeedbackReadable(page, 'Immediately after the real Plug play');
        evidence.plugFeedback.push(`after:${after.phase}`);
        await page.screenshot({ path: testInfo.outputPath('guided-plug-feedback-after.png') });
      }
    } else if (focus === 'end-turn') {
      await expect(page.getByTestId('button-next-round')).toBeEnabled();
      committedActions.push(stepId!);
      await page.getByTestId('button-next-round').click();
    } else {
      throw new Error(`Unexpected tutorial state before the four-round result: ${stepId}`);
    }
  }

  await expect(page.getByTestId('button-complete-tutorial')).toBeEnabled({ timeout: 90_000 });
  expect(api.rejectedTranscript(), 'The server-side transcript verifier must accept the actual clicks').toBeNull();
  expect(api.completion()).not.toBeNull();
  expect(api.completionRequests()).toBe(1);
  // Current behavior: the real first sightings are triggered by other cards' effects (observed: Wifey),
  // not by Plug. Require that real lessons were exercised; Plug's own feedback is proven separately.
  expect(evidence.lessonSources.length, 'Real first-sighting mechanic lessons were exercised').toBeGreaterThan(0);
  expect(evidence.plugFeedback, 'The real Plug play and its immediate coach feedback were checked').toHaveLength(2);
  expect(evidence.cornballHeld, 'The actual rival Cornball ability must wait for Continue, including reduced motion').toBe(true);
  expect(evidence.rivalVoiceChecked, 'The first rival cue plays the recorded voice line and stops on Continue').toBe(true);
  expect(await page.evaluate(() =>
    (window as typeof window & { __rivalReadingAudio: HTMLAudioElement[] }).__rivalReadingAudio.length,
  ), 'The rival pause line plays only once per match').toBe(1);
  expect(evidence.readingCues.filter(text => /Round recap/i.test(text))).toHaveLength(3);
  expect(api.movesReceived().filter(move => move.endTurn)).toHaveLength(4);
  expect(api.movesReceived().filter(move => !move.endTurn)).toHaveLength(3);
  expect(committedActions.filter(id => id?.endsWith('_play_card') || id?.endsWith('_play_squabble'))).toHaveLength(3);
  // The third round names its coached pass "bank Motion"; it still commits
  // through the real End Turn control and is verified as an endTurn move.
  expect(committedActions).toHaveLength(7);
  await expect(page.getByTestId('tutorial-final-debrief')).toContainText('Claims: You');
  const teachBack = page.getByTestId('rookie-teach-back');
  await teachBack.locator('summary').click();
  await expect(teachBack.locator('fieldset')).toHaveCount(5);
  // The questions check the goal, turn, score causality, end state and next step.
  for (const [index, choice] of [1, 1, 1, 0, 0].entries()) {
    await teachBack.locator('fieldset').nth(index).locator('input').nth(choice).check();
  }
  await expect(teachBack).toContainText('5 of 5 answered · 5 correct');

  await page.getByTestId('button-inspect-final-board').click();
  await expect(page.getByTestId('final-board-review')).toBeVisible();
  await expect(page.getByTestId('battle-phase-status')).toContainText('Match complete');
  await expect(page.locator('.broadcast-overlay')).toHaveCount(0);
  await page.locator('[data-card-zone="board"][data-card-id="plug"]').first().click();
  await expect(page.getByRole('dialog', { name: /Plug battle details/i })).toBeVisible();

  // A real reconnect refetch returns the newly saved reward step. It must not
  // replace an open card or the tutorial result with the next lesson.
  const readsBefore = api.bootstrapRequests();
   // Ensure the bootstrap query is stale regardless of the journey's speed.
   // Age Date only; do not fast-forward any battle or presentation timers.
   await page.clock.setFixedTime(new Date(Date.now() + 31_000));
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(50);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => api.bootstrapRequests(), { timeout: 10_000 }).toBeGreaterThan(readsBefore);
  await page.waitForTimeout(1800);
  await expect(page.getByRole('dialog', { name: /Plug battle details/i })).toBeVisible();
  await expect(page.getByTestId('rookie-post-fight-handoff')).toHaveCount(0);
  await expect(page.getByTestId('rookie-reward-primer')).toHaveCount(0);
  expect(api.onboardingActions()).toEqual([]);
  await page.getByTestId('button-close-inspector').click();
  await page.screenshot({ path: testInfo.outputPath('guided-final-board.png') });
  await page.getByRole('button', { name: 'View result', exact: true }).click();
  await expect(page.getByTestId('battle-result-screen')).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(page.getByTestId('button-complete-tutorial')).toBeEnabled();
  expect(api.completionRequests()).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('guided-stable-result.png') });

  await page.getByTestId('button-complete-tutorial').click();
  await expect(page.getByTestId('rookie-post-fight-handoff')).toBeVisible();
  await expect(page.getByTestId('rookie-post-fight-handoff')).toContainText('run a no-pressure practice fade, or head into Chapter One.');
  await page.getByRole('button', { name: 'See reward & next steps' }).click();
  await expect.poll(() => api.onboardingActions()).toEqual(['complete-tutorial']);
  await expect(page.getByTestId('rookie-reward-primer')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByTestId('rookie-reward-primer')).toContainText('no-pressure practice fade');
  await expect(page.getByTestId('button-practice-another-fade')).toBeVisible();
  await expect(page.getByTestId('button-claim-reward-enter-story')).toBeVisible();
  await page.getByTestId('button-practice-another-fade').click();
  await expect(page.getByTestId('rookie-practice-brief')).toContainText('No win is required');
  await expect(page.getByTestId('button-start-practice-fade')).toBeVisible();
  await page.getByRole('button', { name: 'Back to reward choices' }).click();
  await expect(page.getByTestId('rookie-reward-primer')).toBeVisible();
  await page.getByTestId('button-claim-reward-enter-story').click();
  await expect.poll(() => api.onboardingStep()).toBe('complete');
  await expect(page).toHaveURL(/\/game\/story(?:[/?#]|$)/);
});

test('coaching stays reachable by keyboard and does not cover targets in portrait or short landscape', async ({ page }) => {
  await page.goto('/squabblemon/e2e/rookie-road.fixture.html');
  const arena = page.getByTestId('battle-arena');
  await expect(arena).toBeVisible({ timeout: 30_000 });
  for (const size of [{ width: 350, height: 620 }, { width: 740, height: 360 }, { width: 1280, height: 760 }]) {
    await page.setViewportSize(size);
    await expect(page.getByTestId('fade-spotlight')).toBeVisible();
    const accessible = await page.locator('details.battle-tools > summary').evaluate(el => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return el === top || el.contains(top);
    });
    expect(accessible, `Battle menu must be clickable at ${size.width}×${size.height}`).toBe(true);
    await page.locator('details.battle-tools > summary').click();
    await expect(page.getByTestId('button-rules-battle')).toBeVisible();
    await page.locator('details.battle-tools > summary').click();
  }
  await page.getByTestId('card-plug').focus();
  await page.keyboard.press('Enter');
  await expect(arena).toHaveAttribute('data-tutorial-focus', 'district');
  await expect(page.getByRole('region', { name: 'Dr. Fade’s guide' })).toContainText('district');
  await expect(page.getByRole('button', { name: 'Reopen coach tip' }).or(page.getByRole('button', { name: 'Hide coach tip' }))).toBeVisible();
});