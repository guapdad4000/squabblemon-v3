import type { Page, Request, Route } from '@playwright/test';
import type {
  PlayerBootstrap,
  PlayerProfileUpdate,
  PromoCodeResult,
} from '@workspace/api-client-react';

export const AUTH_KEY = 'squabblemon_e2e_user';

export function profileBootstrap(
  overrides: Partial<PlayerBootstrap['profile']> = {},
): PlayerBootstrap {
  const now = '2026-09-23T09:00:00.000Z';
  return {
    profile: {
      id: 'fighter-id-player',
      displayName: 'NEW KID',
      avatarKey: 'rookie',
      onboardingStep: 'complete',
      starterDeckId: 'block',
      streetRep: 0,
      xp: 0,
      level: 1,
      softCurrency: 250,
      packTickets: 0,
      styleShards: 300,
      packPity: 0,
      deckSlots: 3,
      cosmeticCurrency: 0,
      collectionProgress: 0,
      storyChapter: 0,
      storyNode: 0,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: now,
      termsAcceptedAt: now,
      settings: { reducedMotion: false, turnTimerEnabled: true },
      ownedCardIds: ['kyle', 'rastamon'],
      cardProgression: {
        kyle: { xp: 0, level: 1 },
        rastamon: { xp: 0, level: 1 },
      },
      discoveredCardIds: ['kyle', 'rastamon'],
      ownedVariants: [],
      equippedVariants: {},
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      savedDecks: [{
        id: 'saved-crew',
        name: 'THE REGULARS',
        cardIds: ['kyle', 'rastamon'],
        heroCardId: 'kyle',
        recipeId: null,
        valid: true,
        issues: [],
      }],
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: now,
      ...overrides,
    },
    missions: [],
    nextAction: {
      id: 'fighter-id-next',
      eyebrow: 'Tonight',
      title: 'Run the block',
      description: 'Take your gang into a practice fade.',
      destination: 'play',
      rewardLabel: null,
    },
    packConfig: {
      id: 'street-pack',
      name: 'Street Pack',
      oddsVersion: 'fighter-id-v1',
      softCurrencyCost: 500,
      ticketCost: 1,
      rewardsPerPack: 6,
      pityLimit: 10,
      odds: [],
    },
    tenPullConfig: {
      id: 'street-ten',
      name: 'Street Ten',
      oddsVersion: 'fighter-id-v1',
      pullCount: 10,
      ticketCost: 10,
      softCurrencyCost: 5_000,
      rewardsPerPull: 6,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}

type ProfileFixtureOptions = {
  bootstrap?: PlayerBootstrap;
  saveFailures?: number;
  holdSave?: boolean;
  promoFailures?: number;
  holdPromo?: boolean;
};

export async function installProfileApi(page: Page, options: ProfileFixtureOptions = {}) {
  let current = structuredClone(options.bootstrap ?? profileBootstrap());
  let saveFailures = options.saveFailures ?? 0;
  let promoFailures = options.promoFailures ?? 0;
  let promoCalls = 0;
  let saveCalls = 0;
  let cosmeticCalls = 0;
  let lastSave: PlayerProfileUpdate | null = null;
  let lastCosmetics: unknown = null;
  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
  let releasePromo!: () => void;
  const promoGate = new Promise<void>((resolve) => { releasePromo = resolve; });

  const fulfillPromo = async (route: Route, request: Request) => {
    promoCalls += 1;
    if (options.holdPromo) await promoGate;
    if (promoFailures-- > 0) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Promo service is catching its breath.' }),
      });
    }
    const code = String((request.postDataJSON() as { code: string }).code).trim().toUpperCase();
    const alreadyRedeemed = code === 'ALREADY-IN';
    if (!alreadyRedeemed) {
      current.profile.packTickets += 2;
      current.profile.softCurrency += 750;
      current.profile.styleShards += 40;
      if (!current.profile.ownedCardIds.includes('stockz')) current.profile.ownedCardIds.push('stockz');
      if (!current.profile.discoveredCardIds.includes('stockz')) current.profile.discoveredCardIds.push('stockz');
    }
    const result: PromoCodeResult = {
      alreadyRedeemed,
      receipt: {
        code,
        packTickets: 2,
        softCurrency: 750,
        styleShards: 40,
        cardIds: ['stockz'],
      },
      bootstrap: structuredClone(current),
    };
    return route.fulfill({ json: result });
  };

  await page.route('**/api/player/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET' && path.endsWith('/bootstrap')) {
      return route.fulfill({ json: structuredClone(current) });
    }
    if (request.method() === 'PATCH' && path.endsWith('/profile')) {
      saveCalls += 1;
      lastSave = request.postDataJSON() as PlayerProfileUpdate;
      if (options.holdSave) await saveGate;
      if (saveFailures-- > 0) {
        return route.fulfill({ status: 500, json: { error: 'Profile save failed.' } });
      }
      current.profile.displayName = lastSave.displayName ?? current.profile.displayName;
      current.profile.avatarKey = lastSave.avatarKey ?? current.profile.avatarKey;
      current.profile.settings = {
        ...current.profile.settings,
        ...(lastSave.reducedMotion === undefined ? {} : { reducedMotion: lastSave.reducedMotion }),
        ...(lastSave.turnTimerEnabled === undefined ? {} : { turnTimerEnabled: lastSave.turnTimerEnabled }),
      };
      return route.fulfill({ json: structuredClone(current) });
    }
    if (request.method() === 'PUT' && path.endsWith('/cosmetics')) {
      cosmeticCalls += 1;
      lastCosmetics = request.postDataJSON();
      current.profile.settings = {
        ...current.profile.settings,
        cosmetics: lastCosmetics as PlayerBootstrap['profile']['settings']['cosmetics'],
      };
      return route.fulfill({ json: structuredClone(current) });
    }
    if (request.method() === 'POST' && path.endsWith('/promo-codes/redeem')) {
      return fulfillPromo(route, request);
    }
    return route.fulfill({ status: 404, json: { error: `Unhandled fighter-id fixture route: ${request.method()} ${path}` } });
  });

  return {
    current: () => structuredClone(current),
    setBootstrap: (next: PlayerBootstrap) => { current = structuredClone(next); },
    lastSave: () => lastSave,
    lastCosmetics: () => lastCosmetics,
    saveCalls: () => saveCalls,
    promoCalls: () => promoCalls,
    cosmeticCalls: () => cosmeticCalls,
    releaseSave,
    releasePromo,
  };
}

export async function signIn(page: Page) {
  await page.addInitScript((key) => {
    const initialized = `${key}_session_initialized`;
    if (!sessionStorage.getItem(initialized)) {
      localStorage.setItem(key, 'signed-in');
      sessionStorage.setItem(initialized, 'true');
    }
  }, AUTH_KEY);
}