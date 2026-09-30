import { expect, test, type Page, type Request } from '@playwright/test';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { createDistrictSnapshot } from '@workspace/squabblemon-engine/districts';
import {
  ROOKIE_CORE_IDS,
  ROOKIE_FOUNDATION_IDS,
  catalogIdsToEngineIds,
  completeEngineCrew,
  starterRecipes,
} from '@workspace/squabblemon-engine/data';

const NODE_ID = 'receipts-on-camera';
const STORY_CONTENT_VERSION = 5;
const SELECTED_DECK_ID = 'camera-crew';
const ownedCards = [...new Set([...ROOKIE_FOUNDATION_IDS, ...starterRecipes.flatMap(recipe => recipe.catalogCardIds)])];
const viewports = [
  { width: 492, height: 940 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 1366, height: 768 },
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
      ownedCardIds: ownedCards,
      discoveredCardIds: ownedCards,
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
  const player = bootstrap();

  await page.addInitScript(() => {
    localStorage.setItem('squabblemon_e2e_user', 'signed-in');
    localStorage.removeItem('squabblemon:last-deck:v1:story-scroll-player');
  });
  await page.route('**/api/player/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/bootstrap')) {
      return route.fulfill({ json: player });
    }
    if (request.method() === 'PUT' && /\/decks\/[^/]+$/.test(path)) {
      const deckId = decodeURIComponent(path.split('/').at(-1)!);
      const draft = request.postDataJSON() as { name: string; cardIds: string[]; heroCardId: string; recipeId?: string };
      const saved = { ...draft, id: deckId, recipeId: draft.recipeId ?? null, valid: true, issues: [] };
      player.profile.savedDecks = [...player.profile.savedDecks.filter(deck => deck.id !== deckId), saved];
      return route.fulfill({ json: player });
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
      const chosen = player.profile.savedDecks.find(deck => deck.id === body.playerDeckId);
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

test.describe('story crew editor and fight', () => {
  for (const viewport of viewports) {
    test(`${viewport.width}x${viewport.height}: edit selected deck, return and enter fight`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium-desktop', 'The viewport matrix is exercised once in Chromium.');
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const starts = await installApi(page, false);

      await page.goto(`/squabblemon/game/story/play/${NODE_ID}`);
      const selector = page.getByRole('region', { name: 'Select your story crew' });
      await expect(selector).toBeVisible({ timeout: 60_000 });
      const edit = page.getByRole('link', { name: 'Edit deck: Camera Crew' });
      const enterFight = page.getByRole('button', { name: 'Enter fight', exact: true });
      await expect(page.getByRole('link', { name: 'Edit deck: Home Crew' })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Available crews' }).getByRole('button', { name: 'Camera Crew' })).toBeVisible();
      await page.getByRole('group', { name: 'Available crews' }).getByRole('button', { name: 'Camera Crew' }).click();
      await edit.scrollIntoViewIfNeeded();
      await expectFullyHitTestable(edit);
      await expect(page.getByRole('link', { name: 'Edit deck: Home Crew' })).toHaveCount(0);
      await expect(page.locator('.story-crew-select__grid button[aria-pressed="true"]')).toHaveCount(1);
      expect(await page.locator('.story-crew-select__body').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (viewport.width === 320 || viewport.width === 844) {
        await page.screenshot({
          path: `e2e/screenshots/story-crew-${viewport.width}x${viewport.height}-street-file.png`,
          animations: 'disabled',
        });
      }

      await page.locator('.story-crew-select__grid button').last().scrollIntoViewIfNeeded();
      await expectFullyHitTestable(page.locator('.story-crew-select__grid button').last());
      await page.locator('.crew-case__photo').last().scrollIntoViewIfNeeded();
      await expect(page.locator('.crew-case__photo').last()).toBeInViewport();
      await page.locator('.story-crew-select__body').evaluate(element => { element.scrollTop = element.scrollHeight; });
      await enterFight.scrollIntoViewIfNeeded();
      await expectFullyHitTestable(enterFight);
      expect(await page.locator('.crew-case').evaluate((element) =>
        element.getBoundingClientRect().bottom <= document.querySelector('.story-crew-select footer')!.getBoundingClientRect().top + 1
      )).toBe(true);
      await page.screenshot({
        path: `e2e/screenshots/story-crew-${viewport.width}x${viewport.height}.png`,
        animations: 'disabled',
      });
      if (viewport.width === 492) {
        await edit.focus();
        await page.keyboard.press('Enter');
      } else {
        await edit.click();
      }
      await expect(page).toHaveURL(new RegExp(`/game/decks/${SELECTED_DECK_ID}\\?returnTo=`));
      await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Camera Crew');
      const returnButton = page.getByRole('button', { name: 'Back to story crew selection' });
      await returnButton.click();
      await expect(selector).toBeVisible();
      await expect(edit).toBeVisible();
      await enterFight.scrollIntoViewIfNeeded();
      await expectFullyHitTestable(enterFight);
      await enterFight.click();

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
      expect(starts).toHaveLength(1);
    });
  }

  test('starter recipe save keeps story return and picks the newly saved deck; dirty exit asks first', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await installApi(page, false);
    await page.goto(`/squabblemon/game/story/play/${NODE_ID}`);
    // Any available starter recipe is enough; its editor must create a saved copy.
    const recipes = page.locator('.story-crew-select__grid button').filter({ hasNotText: /Home Crew|Camera Crew/ });
    await recipes.first().click();
    const edit = page.getByRole('link', { name: /^Edit deck:/ });
    await edit.click();
    await expect(page.getByText('Learning example · save to make it yours')).toBeVisible();
    const name = page.getByRole('textbox', { name: 'Deck name' });
    await name.fill('New Story Gang');
    const returnButton = page.getByRole('button', { name: 'Back to story crew selection' });
    await returnButton.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Save your deck changes?');
    await dialog.getByRole('button', { name: 'Stay here' }).click();
    await expect(name).toHaveValue('New Story Gang');
    await page.getByRole('button', { name: 'Save deck', exact: true }).click();
    await expect(page).toHaveURL(/\/game\/decks\/[^/]+\?returnTo=/);
    await expect(name).toHaveValue('New Story Gang');
    await returnButton.click();
    await expect(page.getByRole('region', { name: 'Select your story crew' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit deck: New Story Gang' })).toBeVisible();
    await expect(page.locator('.story-crew-select__grid button[aria-pressed="true"]')).toContainText('New Story Gang');
    await page.getByRole('link', { name: 'Edit deck: New Story Gang' }).click();
    await name.fill('Renamed Story Gang');
    await returnButton.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Save and leave' }).click();
    await expect(page.getByRole('region', { name: 'Select your story crew' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit deck: Renamed Story Gang' })).toBeVisible();
    await expect(page.locator('.story-crew-select__grid button[aria-pressed="true"]')).toContainText('Renamed Story Gang');
    await page.getByRole('link', { name: 'Edit deck: Renamed Story Gang' }).click();
    await expect(name).toHaveValue('Renamed Story Gang');
    await returnButton.click();
    await expect(page.getByRole('button', { name: 'Enter fight' })).toBeVisible();
  });
});