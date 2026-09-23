import type { Page, Request, Route } from '@playwright/test';
import type { ChallengeRun, MatchCompletion, PlayerBootstrap } from '@workspace/api-client-react';
import { createAbilityUpgradeSnapshot } from '@workspace/squabblemon-engine/abilityUpgrades';
import { catalogIdsToEngineIds, decks } from '@workspace/squabblemon-engine/data';
import { createDistrictSnapshot } from '@workspace/squabblemon-engine/districts';
import { profileBootstrap, signIn } from './fighter-id.fixture';

export const RUN_ID = '11111111-1111-4111-8111-111111111111';
export const MATCH_ID = '22222222-2222-4222-8222-222222222222';
export const CREW_ID = 'fadecade-crew';
export const CREW_CARD_IDS = [
  'cornball',
  'plug',
  'snow-bunny',
  'wifey',
  'hooper',
  'rastamon',
  'all-jokes-roaster',
  'bus-pass',
  'soul-food',
  'cognac-bottle',
] as const;

const today = () => new Date().toISOString().slice(0, 10);
const engineCrew = () => catalogIdsToEngineIds([...CREW_CARD_IDS]);

export function fadecadeBootstrap(): PlayerBootstrap {
  const progression = Object.fromEntries(CREW_CARD_IDS.map(cardId => [cardId, { xp: 0, level: 1 }]));
  return profileBootstrap({
    id: 'fadecade-player',
    displayName: 'ARCADE KID',
    starterDeckId: CREW_ID,
    softCurrency: 640,
    ownedCardIds: [...CREW_CARD_IDS],
    discoveredCardIds: [...CREW_CARD_IDS],
    cardProgression: progression,
    savedDecks: [{
      id: CREW_ID,
      name: 'THE TOKEN TAKERS',
      cardIds: [...CREW_CARD_IDS],
      heroCardId: 'cornball',
      recipeId: null,
      valid: true,
      issues: [],
    }],
  });
}

function withMissions(bootstrap: PlayerBootstrap): PlayerBootstrap {
  return {
    ...bootstrap,
    missions: [
      {
        id: 'daily-fade',
        cadence: 'daily',
        title: 'Clock In',
        description: 'Visit the Fadecade.',
        progress: 1,
        goal: 1,
        rewardCurrency: 'softCurrency',
        rewardAmount: 75,
        status: 'claimable',
        resetAt: '2027-01-02T00:00:00.000Z',
      },
      {
        id: 'weekly-road',
        cadence: 'weekly',
        title: 'Road Regular',
        description: 'Clear the weekly route.',
        progress: 3,
        goal: 3,
        rewardCurrency: 'packTickets',
        rewardAmount: 2,
        status: 'claimable',
        resetAt: '2027-01-08T00:00:00.000Z',
      },
    ],
  };
}

export function activeChallengeRun(checkpoint = false): ChallengeRun {
  const cards = engineCrew().map(cardId => ({ cardId, xp: 0, level: 1, upgradeIds: [] }));
  return {
    id: RUN_ID,
    status: 'active',
    seed: 8675309,
    encounterIndex: 0,
    score: 0,
    wins: 0,
    entryDate: today(),
    entryNumber: 1,
    crew: { deckId: CREW_ID, cards, capturedAt: new Date(0).toISOString(), rulesVersion: 1 },
    encounter: { rivalDeckId: 'combo', ...(checkpoint ? { playerMatchId: MATCH_ID } : {}) },
    checkpoints: checkpoint ? [{ matchId: MATCH_ID, moves: [] }] : [],
    createdAt: new Date(0).toISOString(),
    completedAt: null,
    recovery: checkpoint ? { state: 'checkpointed', matchId: MATCH_ID, checkpoint: { matchId: MATCH_ID, moves: [] } } : null,
  };
}

type FadecadeApiOptions = {
  activeRun?: boolean;
  checkpoint?: boolean;
};

export async function installFadecadeApi(page: Page, options: FadecadeApiOptions = {}) {
  let bootstrap = withMissions(fadecadeBootstrap());
  let runs: ChallengeRun[] = options.activeRun ? [activeChallengeRun(options.checkpoint)] : [];
  const requests = {
    starts: [] as unknown[],
    matches: [] as unknown[],
    completions: [] as unknown[],
    checkpoints: [] as unknown[],
    claims: [] as string[],
    abandons: 0,
  };

  const fulfillClaim = (route: Route, missionId: string) => {
    const mission = bootstrap.missions.find(item => item.id === missionId);
    if (!mission) return route.fulfill({ status: 404, json: { error: 'Mission not found' } });
    if (mission.status === 'claimable') {
      bootstrap = {
        ...bootstrap,
        profile: {
          ...bootstrap.profile,
          softCurrency: bootstrap.profile.softCurrency + (mission.rewardCurrency === 'softCurrency' ? mission.rewardAmount : 0),
          packTickets: bootstrap.profile.packTickets + (mission.rewardCurrency === 'packTickets' ? mission.rewardAmount : 0),
        },
        missions: bootstrap.missions.map(item => item.id === missionId ? { ...item, status: 'claimed' as const } : item),
      };
    }
    requests.claims.push(missionId);
    return route.fulfill({ json: structuredClone(bootstrap) });
  };

  await page.route('**/api/player/**', async (route: Route, request: Request) => {
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method === 'GET' && path.endsWith('/bootstrap')) {
      return route.fulfill({ json: structuredClone(bootstrap) });
    }
    if (method === 'GET' && path.endsWith('/challenges/runs')) {
      return route.fulfill({ json: structuredClone(runs) });
    }
    if (method === 'POST' && path.endsWith('/challenges/runs')) {
      requests.starts.push(request.postDataJSON());
      if (!runs.some(run => run.status === 'active')) runs = [activeChallengeRun(false), ...runs];
      return route.fulfill({ status: 201, json: structuredClone(runs[0]) });
    }
    const checkpoint = path.match(/\/challenges\/runs\/([^/]+)\/checkpoint$/);
    if (method === 'POST' && checkpoint) {
      const body = request.postDataJSON() as { moves: unknown[] };
      requests.checkpoints.push(body);
      runs = runs.map(run => run.id === checkpoint[1] ? {
        ...run,
        checkpoints: [{ matchId: MATCH_ID, moves: structuredClone(body.moves) }],
        recovery: {
          state: 'checkpointed',
          matchId: MATCH_ID,
          checkpoint: { matchId: MATCH_ID, moves: structuredClone(body.moves) },
        },
      } : run);
      return route.fulfill({ json: structuredClone(runs.find(run => run.id === checkpoint[1]) ?? activeChallengeRun(true)) });
    }
    const abandon = path.match(/\/challenges\/runs\/([^/]+)\/abandon$/);
    if (method === 'POST' && abandon) {
      requests.abandons += 1;
      runs = runs.map(run => run.id === abandon[1] ? { ...run, status: 'abandoned' as const, completedAt: new Date().toISOString() } : run);
      return route.fulfill({ json: structuredClone(runs.find(run => run.id === abandon[1])) });
    }
    if (method === 'POST' && path.endsWith('/matches')) {
      const body = request.postDataJSON() as { mode: string; playerDeckId: string; rivalDeckId?: string; challengeRunId?: string };
      requests.matches.push(body);
      const boundRun = runs.find(run => run.id === body.challengeRunId);
      const savedCheckpoint = boundRun?.checkpoints.find(item =>
        (item as { matchId?: string }).matchId === MATCH_ID
      ) as { matchId: string; moves: unknown[] } | undefined;
      if (body.challengeRunId) {
        runs = runs.map(run => run.id === body.challengeRunId ? {
          ...run,
          encounter: { ...(run.encounter as Record<string, unknown>), playerMatchId: MATCH_ID },
          recovery: { state: 'in_progress', matchId: MATCH_ID, checkpoint: null },
        } : run);
      }
      const rival = decks.find(deck => deck.id === (body.rivalDeckId || 'combo')) ?? decks.find(deck => deck.id === 'combo')!;
      return route.fulfill({ status: 201, json: {
        id: MATCH_ID,
        challengeRunId: body.challengeRunId ?? null,
        mode: body.mode,
        playerDeckId: body.playerDeckId,
        rivalDeckId: rival.id,
        storyNodeId: null,
        contentVersion: null,
        encounterSnapshot: null,
        abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(engineCrew(), rival.cards),
        districtSnapshot: createDistrictSnapshot(`fadecade:${MATCH_ID}`),
        status: 'active',
        createdAt: new Date(0).toISOString(),
        checkpoint: savedCheckpoint ?? null,
      } });
    }
    if (method === 'POST' && path.endsWith(`/matches/${MATCH_ID}/complete`)) {
      requests.completions.push(request.postDataJSON());
      const settled = runs[0] ? {
        ...runs[0],
        status: 'settled' as const,
        encounterIndex: 0,
        wins: 0,
        score: 0,
        completedAt: new Date().toISOString(),
      } : undefined;
      if (settled) runs = [settled, ...runs.slice(1)];
      bootstrap = { ...bootstrap, profile: { ...bootstrap.profile, softCurrency: bootstrap.profile.softCurrency + 100 } };
      const completion: MatchCompletion = {
        profile: bootstrap.profile,
        missions: bootstrap.missions,
        nextAction: bootstrap.nextAction,
        reward: {
          id: 'fadecade-clear',
          label: 'Verified fade',
          xp: 25,
          streetRep: 5,
          softCurrency: 100,
          packTickets: 0,
          descriptions: ['Match verified'],
          storyRewards: [],
          cardXp: [],
        },
        alreadyCompleted: false,
        campaign: null,
        story: null,
      };
      return route.fulfill({ json: completion });
    }
    const claim = path.match(/\/missions\/([^/]+)\/claim$/);
    if (method === 'POST' && claim) return fulfillClaim(route, claim[1]);
    if (method === 'GET' && path.endsWith('/story')) {
      return route.fulfill({ status: 503, json: { error: 'Story is outside this fixture.' } });
    }
    return route.fulfill({
      status: 404,
      json: { error: `Unhandled Fadecade fixture route: ${method} ${path}` },
    });
  });

  return {
    requests,
    bootstrap: () => structuredClone(bootstrap),
    runs: () => structuredClone(runs),
  };
}

export async function openFadecade(page: Page, options: FadecadeApiOptions = {}) {
  await signIn(page);
  const api = await installFadecadeApi(page, options);
  await page.goto('/squabblemon/game/challenges');
  await page.waitForLoadState('domcontentloaded');
  return api;
}