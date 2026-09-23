import { expect, test } from '@playwright/test';
import { cardCatalog, ROOKIE_MENTOR_CORE_IDS } from '@workspace/squabblemon-engine/data';
import { STREET_PACK_DISCLOSURES, STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';

test('mock signed-in player can claim, spend, refresh, and keep accurate goals', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const waitForGameRoute = async () => {
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 30_000 });
  };
  let state: any = {
    profile: {
      id: 'progression-e2e',
      displayName: 'GOAL CHECK',
      avatarKey: 'cornball',
      onboardingStep: 'complete',
      starterDeckId: 'foundation-v1',
      streetRep: 12,
      xp: 240,
      level: 1,
      softCurrency: 0,
      packTickets: 2,
      styleShards: 0,
      packPity: 0,
      deckSlots: 4,
      cosmeticCurrency: 0,
      collectionProgress: 1,
      storyChapter: 1,
      storyNode: 1,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: '2026-09-08T00:00:00.000Z',
      termsAcceptedAt: '2026-09-08T00:00:00.000Z',
      settings: { reducedMotion: true, turnTimerEnabled: false },
      ownedCardIds: ['cornball'],
      discoveredCardIds: ['cornball'],
      cardProgression: { cornball: { xp: 0, level: 1, moveTier: 0 } },
      ownedVariants: [],
      equippedVariants: {},
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      savedDecks: [],
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: '2026-09-08T00:00:00.000Z',
    },
    missions: [{
      id: 'daily-show-up',
      cadence: 'daily',
      title: 'Show Up',
      description: 'Finish one fade today.',
      progress: 0,
      goal: 1,
      rewardCurrency: 'softCurrency',
      rewardAmount: 100,
      status: 'active',
      resetAt: null,
    }],
    nextAction: {
      id: 'play-practice',
      eyebrow: 'Build your gang',
      title: 'XP Training',
      description: 'Finish a saved fade to earn account rewards.',
      destination: 'play',
      rewardLabel: 'Battle earnings',
    },
    packConfig: {
      id: 'street-pack',
      name: 'Street Pack',
      oddsVersion: 'mounted-mock-v1',
      softCurrencyCost: 200,
      ticketCost: 1,
      rewardsPerPack: 6,
      pityLimit: 10,
      odds: [],
    },
    collectionRoad: [],
  };

  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.route('**/api/player/bootstrap', route => route.fulfill({ json: state }));
  await page.route('**/api/e2e/complete-fade', route => {
    state = {
      ...state,
      profile: { ...state.profile, xp: 290, level: 2, softCurrency: 80, streetRep: 20 },
      missions: [{ ...state.missions[0], progress: 1, status: 'claimable' }],
      nextAction: {
        id: 'claim-daily-show-up',
        eyebrow: 'Reward ready',
        title: 'Show Up',
        description: 'Your work is done. Claim the drop.',
        destination: 'missions',
        rewardLabel: '+100 clout',
      },
    };
    return route.fulfill({ json: state });
  });
  await page.route('**/api/player/missions/daily-show-up/claim', route => {
    state = {
      ...state,
      profile: { ...state.profile, softCurrency: state.profile.softCurrency + 100 },
      missions: [{ ...state.missions[0], status: 'claimed' }],
      nextAction: {
        id: 'play-practice',
        eyebrow: 'Build your gang',
        title: 'XP Training',
        description: 'Train against a fair CPU rival.',
        destination: 'play',
        rewardLabel: 'Battle earnings',
      },
    };
    return route.fulfill({ json: state });
  });
  await page.route('**/api/player/shop/purchases', async route => {
    const body = route.request().postDataJSON();
    expect(body.itemId).toBe('training');
    state = {
      ...state,
      profile: {
        ...state.profile,
        softCurrency: state.profile.softCurrency - 100,
        cardProgression: { cornball: { xp: 100, level: 2, moveTier: 0 } },
      },
    };
    return route.fulfill({
      json: {
        receipt: {
          itemId: 'training',
          cardId: 'cornball',
          cost: 100,
          currency: 'softCurrency',
          summary: 'Cornball: +100 XP (level 2).',
        },
        alreadyPurchased: false,
        bootstrap: state,
      },
    });
  });

  await page.goto('/squabblemon/game/settings');
  await waitForGameRoute();
  await page.getByRole('tab', { name: 'Overview' }).click();
  await expect(page.getByTestId('text-account-xp-goal')).toContainText('10 XP to level 2');
  await page.screenshot({ path: testInfo.outputPath('mock-account-goal.png'), fullPage: true });

  // This endpoint is deliberately an explicit browser-test mock, not Clerk or
  // the production match verifier. It changes the same bootstrap fields a
  // reward-verified win changes so the mounted UI proves the earned goal state.
  await page.evaluate(() => fetch('/api/e2e/complete-fade', { method: 'POST' }));
  await page.reload();
  await waitForGameRoute();
  await page.getByRole('tab', { name: 'Overview' }).click();
  await expect(page.getByTestId('text-account-xp-goal')).toContainText('210 XP to level 3');
  await page.screenshot({ path: testInfo.outputPath('mock-earned-account-goal.png'), fullPage: true });
  await page.goto('/squabblemon/game/missions');
  await waitForGameRoute();
  await expect(page.getByText('1/1')).toBeVisible();
  await page.getByRole('button', { name: 'Claim reward for Show Up' }).click();
  await expect(page.getByText('Collected', { exact: true })).toBeVisible();

  await page.goto('/squabblemon/game/shop?view=training');
  await waitForGameRoute();
  await expect(page.getByRole('button', { name: 'Practice Session 100 Clout' })).toBeVisible();
  await page.getByRole('button', { name: /Buy · 100 Clout/ }).click();
  await expect(page.getByText('Cornball: +100 XP (level 2).')).toBeVisible();
  await page.reload();
  await waitForGameRoute();
  await expect(page.getByText('LV 2')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mock-claimed-spent-refreshed.png'), fullPage: true });

  state = {
    ...state,
    profile: {
      ...state.profile,
      ownedCardIds: cardCatalog.map(card => card.catalogId),
      discoveredCardIds: cardCatalog.map(card => card.catalogId),
      ownedVariants: cardCatalog.flatMap(card => card.variantSlots.map(variant => variant.id)),
      collectionProgress: cardCatalog.length,
      packHistory: [{
        id: 'ten-v2-history',
        oddsVersion: 'street-pack-ten-v2',
        paymentMethod: 'ticket',
        cost: 10,
        pityBefore: 2,
        pityAfter: 0,
        createdAt: '2026-09-08T00:00:00.000Z',
        rewards: [],
      }],
    },
  };
  await page.goto('/squabblemon/game/shop?view=packs');
  await waitForGameRoute();
  await page.getByRole('button', { name: 'Drop rates' }).click();
  await expect(page.getByTestId('text-pack-collection-state')).toContainText('every gameplay card');
  await expect(page.getByTestId('text-pack-collection-state')).toContainText('every featured cosmetic variant');
  await page.getByRole('button', { name: 'Close pack information' }).click();
  await page.getByRole('button', { name: 'Your openings' }).click();
  await expect(page.getByText('10× · 10 ticket(s)')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mock-exhausted-pack-goals.png'), fullPage: true });
});

test('public How To Play renders authoritative starter and Street Pack disclosures', async ({ page }) => {
  await page.goto('/squabblemon/how-to-play');
  const starterCopy = page.getByText(
    `Rookie Road gives you a ${ROOKIE_MENTOR_CORE_IDS.length}-card foundation.`,
    { exact: false },
  );
  await expect(starterCopy).toBeVisible();

  const packs = page.locator('#street-packs');
  await expect(packs).toBeVisible();
  for (const disclosure of STREET_PACK_DISCLOSURES) {
    await expect(packs.getByText(disclosure.label, { exact: true })).toBeVisible();
    await expect(packs).toContainText(disclosure.detail);
  }
  await expect(packs).toContainText(`${STREET_PACK_RULES.duplicateStyleShards} Style Shards`);
  await expect(packs).toContainText(`${STREET_PACK_RULES.bonus.exhaustedStyleClout} Clout`);

  for (const stale of [
    '21-card foundation',
    'Two new cards guaranteed',
    'Two new faces.',
    'falls back to the remaining pool',
    '70% 15, 25, or 40 Style Shards',
    '25% 50 or 100 Clout',
    'becomes 50 Style Shards',
  ]) {
    await expect(page.getByText(stale, { exact: false })).toHaveCount(0);
  }
});