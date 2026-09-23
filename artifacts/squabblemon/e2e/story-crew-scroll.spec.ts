import { expect, test, type Page, type Request } from '@playwright/test';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { createDistrictSnapshot } from '@workspace/squabblemon-engine/districts';
import {
  ROOKIE_CORE_IDS,
  ROOKIE_FOUNDATION_IDS,
  catalogIdsToEngineIds,
  completeEngineCrew,
} from '@workspace/squabblemon-engine/data';

const NODE_ID = 'receipts-on-camera';
const STORY_CONTENT_VERSION = 5;
const SELECTED_DECK_ID = 'camera-crew';
const viewports = [
  { width: 745, height: 807 },
  { width: 899, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
] as const;

const decks = [
  {
    id: 'home-crew',
    name: 'Home Crew',
    cardIds: [...ROOKIE_CORE_IDS],
    heroCardId: 'hooper',
    recipeId: null,
    valid: true,
    issues: [],
  },
  {
    id: SELECTED_DECK_ID,
    name: 'Camera Crew',
    cardIds: [...ROOKIE_CORE_IDS],
    heroCardId: 'cornball',
    recipeId: null,
    valid: true,
    issues: [],
  },
];

function bootstrap(): PlayerBootstrap {
  return {
    profile: {
      id: 'story-scroll-player',
      displayName: 'Rookie',
      avatarKey: 'hooper',
      onboardingStep: 'complete',
      starterDeckId: 'foundation-v1',
      streetRep: 68,
      xp: 400,
      level: 3,
      softCurrency: 2500,
      packTickets: 3,
      styleShards: 250,
      packPity: 0,
      deckSlots: 4,
      cosmeticCurrency: 0,
      collectionProgress: ROOKIE_FOUNDATION_IDS.length,
      storyChapter: 1,
      storyNode: 2,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: new Date(0).toISOString(),
      termsAcceptedAt: new Date(0).toISOString(),
      settings: { reducedMotion: true, turnTimerEnabled: false },
      ownedCardIds: [...ROOKIE_FOUNDATION_IDS],
      discoveredCardIds: [...ROOKIE_FOUNDATION_IDS],
      ownedVariants: [],
      equippedVariants: {},
      cardProgression: {},
      unlockedCosmeticIds: [],
      savedDecks: decks,
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: new Date(0).toISOString(),
    },
    missions: [],
    nextAction: {
      id: 'play',
      eyebrow: 'Chapter One',
      title: 'Keep moving',
      description: 'The next battle is ready.',
      destination: 'story',
      rewardLabel: null,
    },
    packConfig: {
      id: 'street-pack',
      name: 'Street Pack',
      oddsVersion: 'e2e',
      softCurrencyCost: 200,
      ticketCost: 1,
      rewardsPerPack: 3,
      pityLimit: 10,
      odds: [],
    },
    collectionRoad: [],
  };
}

function campaign() {
  return {
    contentVersion: STORY_CONTENT_VERSION,
    chapters: [{
      id: 'block-party',
      title: 'Block Party',
      subtitle: 'Chapter One',
      description: 'Take back the block.',
      order: 1,
      mapAssetId: 'assets/story/chapter-one/map.webp',
      prerequisites: [],
      status: 'available',
      completedNodes: 2,
      totalNodes: 9,
      completedRequiredNodes: 2,
      totalRequiredNodes: 9,
      stars: 6,
      bossStatus: 'locked',
    }],
    nodes: [{
      chapterId: 'block-party',
      nodeId: NODE_ID,
      title: 'Receipts on Camera',
      kind: 'battle',
      optional: false,
      status: 'available',
      mapPosition: { x: 40, y: 54 },
      prerequisites: ['blue-side-pressure'],
      rewards: [{ kind: 'currency', id: 'street-xp', amount: 100 }],
      cleared: false,
      stars: 0,
      attempts: 0,
      wins: 0,
      lastOutcome: null,
      dialogueSeen: [],
      bossHighestPhase: 0,
      firstClearedAt: null,
      lastPlayedAt: null,
    }],
    recommendedNodeId: NODE_ID,
    totalStars: 6,
    completedNodes: 2,
  };
}

function receiptsEncounter() {
  const cinematic = {
    videoAssetId: 'assets/story/chapter-one/media/standard-clash.mp4',
    posterAssetId: 'assets/story/chapter-one/media/standard-clash.webp',
    environmentAssetId: 'assets/story/chapter-one/environments/receipts.webp',
  };
  return {
    id: NODE_ID,
    enemy: {
      id: `${NODE_ID}:enemy`,
      name: 'Ganger Red',
      portraitAssetId: 'assets/characters/ganger-red.webp',
      deckId: `${NODE_ID}-deck`,
      cardIds: completeEngineCrew(['cornball', 'roaster', 'nerd', 'snow', 'plug', 'baby', 'hooper']),
      behaviorProfile: 'aggressive',
    },
    battlefieldAssetId: 'assets/venues/red-fence-night-court.webp',
    cinematic,
    soundHooks: {
      intro: 'story.encounter.intro',
      play: 'story.card.play',
      phase: 'story.boss.phase',
      victory: 'story.victory',
      defeat: 'story.defeat',
    },
    modifiers: {
      startingMotion: { player: 3, cpu: 1 },
      handSize: { cpu: 4 },
      laneLocks: [{ round: 2, owner: 'both', lanes: [1] }],
      lanePowerBonuses: [{ owner: 'both', lane: 2, amount: 2 }],
    },
    phases: [],
    starObjectives: [
      { id: 'win', description: 'Win the encounter.', criterion: { kind: 'win' } },
      { id: 'outside', description: 'Finish holding both outside districts.', criterion: { kind: 'specific-districts-held', owner: 'player', lanes: [0, 2] } },
      { id: 'squabble', description: 'Win without using SQUABBLE.', criterion: { kind: 'squabble-used', owner: 'player', used: false } },
    ],
  } as const;
}

async function installApi(page: Page, failFirstStart: boolean) {
  const encounter = receiptsEncounter();
  const districtSnapshot = createDistrictSnapshot(`story-node-v1:${NODE_ID}`);
  const requests: Request[] = [];
  let starts = 0;

  await page.addInitScript(() => {
    localStorage.setItem('squabblemon_e2e_user', 'signed-in');
  });
  await page.route('**/api/player/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/bootstrap')) {
      return route.fulfill({ json: bootstrap() });
    }
    if (request.method() === 'GET' && path.endsWith('/story')) {
      return route.fulfill({ json: campaign() });
    }
    if (request.method() === 'POST' && path.endsWith('/matches')) {
      requests.push(request);
      starts += 1;
      if (failFirstStart && starts === 1) {
        return route.fulfill({ status: 503, json: { error: 'Story encounter temporarily unavailable' } });
      }
      const body = request.postDataJSON() as {
        mode: string;
        playerDeckId: string;
        storyNodeId?: string;
      };
      const chosen = decks.find(deck => deck.id === body.playerDeckId);
      if (!chosen) {
        return route.fulfill({ status: 400, json: { error: 'Unknown fixture deck' } });
      }
      const playerCards = catalogIdsToEngineIds(chosen.cardIds);
      return route.fulfill({
        status: 201,
        json: {
          id: `story-scroll-match-${starts}`,
          mode: body.mode,
          playerDeckId: body.playerDeckId,
          rivalDeckId: encounter.enemy.deckId,
          storyNodeId: body.storyNodeId,
          contentVersion: STORY_CONTENT_VERSION,
          encounterSnapshot: structuredClone(encounter),
          abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(
            playerCards,
            [...encounter.enemy.cardIds],
          ),
          districtSnapshot,
          status: 'active',
          createdAt: new Date(0).toISOString(),
        },
      });
    }
    return route.fulfill({ status: 404, json: { error: `Unexpected request ${request.method()} ${path}` } });
  });

  return requests;
}

async function expectFullyHitTestable(locator: ReturnType<Page['locator']>) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  expect(await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight || rect.left < 0 || rect.right > innerWidth) return false;
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return Boolean(hit && (hit === element || element.contains(hit)));
  })).toBe(true);
}

async function scrollLikeAUser(page: Page) {
  const region = page.getByRole('region', { name: 'Choose your story gang' });
  const geometry = await region.evaluate(element => ({
    top: element.getBoundingClientRect().top,
    left: element.getBoundingClientRect().left,
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  await region.focus();
  await page.mouse.move(
    geometry.left + geometry.width / 2,
    geometry.top + Math.min(geometry.height / 2, geometry.height - 2),
  );
  await page.mouse.wheel(0, 1600);
  await page.keyboard.press('PageDown');
  if (geometry.scrollHeight > geometry.clientHeight + 1) {
    await expect.poll(async () => region.evaluate(element => element.scrollTop)).toBeGreaterThan(geometry.scrollTop);
  }
}

test.describe('immersive story crew selector scrolling', () => {
  for (const viewport of viewports) {
    test(`${viewport.width}x${viewport.height}: Enter fight is user-reachable and starts the authored story battle`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-desktop', 'The viewport matrix is exercised once in Chromium.');
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const starts = await installApi(page, viewport.width === 745 && viewport.height === 807);

      await page.goto(`/squabblemon/game/story/play/${NODE_ID}`);
      await expect(page.getByRole('heading', { name: 'Who are you bringing?' })).toBeVisible({ timeout: 60_000 });

      const enterFight = page.getByRole('button', { name: 'Enter fight', exact: true });
      await expectFullyHitTestable(enterFight);
      await scrollLikeAUser(page);

      const carousel = page.getByTestId('deck-carousel');
      await expect(carousel).toBeVisible();
      const deckViewport = carousel.getByLabel('Decks. Use left and right arrow keys to browse.');
      await deckViewport.focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowRight');
      await expect(carousel).toHaveAttribute('data-selected-deck', SELECTED_DECK_ID);
      const selectedCrew = carousel.getByRole('group', { name: /Camera Crew/ });
      await expect(selectedCrew.getByText('Camera Crew', { exact: true })).toBeVisible();
      await expect(selectedCrew.getByText('Battle ready', { exact: true })).toBeVisible();

      await expectFullyHitTestable(enterFight);

      if (viewport.width === 745 && viewport.height === 807) {
        await page.screenshot({
          path: 'e2e/screenshots/story-crew-enter-fight-745x807.png',
          animations: 'disabled',
        });
      }

      await enterFight.click({ position: { x: 20, y: 20 } });
      if (viewport.width === 745 && viewport.height === 807) {
        await expect(page.getByRole('alert')).toContainText('Story encounter temporarily unavailable');
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
      }

      await expect(page.locator('.battle-arena')).toBeVisible();
      await expect(page.locator('.battle-arena')).toHaveAttribute('aria-label', /ROUND 1.*YOUR MOVE/, {
        timeout: 15_000,
      });
      const requestBody = starts.at(-1)!.postDataJSON();
      expect(requestBody).toMatchObject({
        mode: 'story',
        storyNodeId: NODE_ID,
        playerDeckId: SELECTED_DECK_ID,
      });
      expect(starts).toHaveLength(viewport.width === 745 && viewport.height === 807 ? 2 : 1);
    });
  }
});