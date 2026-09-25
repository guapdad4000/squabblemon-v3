import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  getGetPlayerBootstrapQueryKey,
  getGetPlayerStoryQueryKey,
  type PlayerBootstrap,
  type StoryCampaign,
} from '@workspace/api-client-react';
import {
  storyContent,
  storyDialogueToken,
  storySeasons,
} from '@workspace/squabblemon-engine/story';
import { Router } from 'wouter';
import { CityHeader } from '../src/components/venue/CityHeader';
import { CosmeticProvider } from '../src/components/CosmeticContext';
import { RewardReveal } from '../src/components/RewardReveal';
import { Story } from '../src/pages/game/Story';
import '../src/index.css';

// The managed-preview development banner is external chrome, not part of the
// game. Keep it from covering fixed portal controls in screenshot fixtures.
const fixtureChromeStyle = document.createElement('style');
fixtureChromeStyle.textContent = '#replit-dev-banner { display: none !important; }';
document.head.append(fixtureChromeStyle);

type FixtureScenario = 'theater' | 'existing-save' | 'season-two' | 'puzzle-dialogue' | 'puzzle' | 'puzzle-complete';

const params = new URLSearchParams(window.location.search);
const requestedScenario = params.get('scenario');
const scenario: FixtureScenario =
  requestedScenario === 'existing-save' ||
  requestedScenario === 'season-two' ||
  requestedScenario === 'puzzle-dialogue' ||
  requestedScenario === 'puzzle' ||
  requestedScenario === 'puzzle-complete'
    ? requestedScenario
    : 'theater';
const requestedPuzzle = params.get('puzzleNode');
const puzzleNode = storyContent.chapters
  .flatMap((chapter) => chapter.nodes)
  .find((node) => node.puzzle && (!requestedPuzzle || node.id === requestedPuzzle));
if (!puzzleNode) throw new Error('The real story registry has no puzzle node.');

if (scenario === 'season-two') params.set('season', 'season-2');
if (scenario === 'puzzle-dialogue' || scenario === 'puzzle' || scenario === 'puzzle-complete') params.set('node', puzzleNode.id);
params.delete('scenario');

function createBootstrap(): PlayerBootstrap {
  const timestamp = new Date(0);
  return {
    profile: {
      id: 'season-theater-fixture-player',
      displayName: 'Theater QA',
      avatarKey: 'cornball',
      onboardingStep: 'complete',
      starterDeckId: null,
      streetRep: 68,
      xp: 400,
      level: 3,
      softCurrency: scenario === 'puzzle-complete' ? 2_540 : 2_500,
      packTickets: 3,
      styleShards: 250,
      packPity: 0,
      deckSlots: 4,
      cosmeticCurrency: 0,
      collectionProgress: 0,
      storyChapter: 9,
      storyNode: 2,
      tutorialCompleted: true,
      starterRewardClaimed: true,
      ageConfirmedAt: timestamp,
      termsAcceptedAt: timestamp,
      settings: { reducedMotion: false, turnTimerEnabled: false },
      ownedCardIds: [],
      discoveredCardIds: [],
      ownedVariants: [],
      equippedVariants: {},
      cardProgression: {},
      unlockedCosmeticIds: [],
      unlockedCharacterIds: [],
      savedDecks: [],
      storyProgress: {},
      inbox: [],
      packHistory: [],
      lastActiveAt: timestamp,
    },
    missions: [],
    nextAction: {
      id: 'story',
      eyebrow: 'Season Two',
      title: 'Continue the story',
      description: 'The evidence table is waiting.',
      destination: 'story',
      rewardLabel: null,
    },
    packConfig: {
      id: 'street-pack',
      name: 'Street Pack',
      oddsVersion: 'fixture',
      softCurrencyCost: 200,
      ticketCost: 1,
      rewardsPerPack: 3,
      pityLimit: 10,
      odds: [],
    },
    tenPullConfig: {
      id: 'street-ten-pull',
      name: 'Street Ten Pull',
      oddsVersion: 'fixture',
      pullCount: 10,
      ticketCost: 9,
      softCurrencyCost: 1_800,
      rewardsPerPull: 3,
      rarePityBonusPerPull: 1,
    },
    collectionRoad: [],
  };
}

function createCampaign(): StoryCampaign {
  const unlockSeasonTwo =
    scenario === 'season-two' ||
    scenario === 'puzzle-dialogue' ||
    scenario === 'puzzle' ||
    scenario === 'puzzle-complete';
  const completePuzzle =
    scenario === 'puzzle-complete' ||
    window.localStorage.getItem(`season-theater:puzzle:${puzzleNode.id}`) === 'complete';
  const firstSeasonOneChapter = storyContent.chapters[0];
  const seasonTwoFirst = storySeasons[1].chapterIds[0];
  const puzzleChapter = storyContent.chapters.find((chapter) =>
    chapter.nodes.some((node) => node.id === puzzleNode.id),
  )!;
  const firstS2PuzzleIndex = puzzleChapter.nodes.findIndex((node) => node.id === puzzleNode.id);

  const nodes = storyContent.chapters.flatMap((chapter) =>
    chapter.nodes.map((node, nodeIndex) => {
      const isFirstChapter = chapter.id === firstSeasonOneChapter.id;
      const isPuzzleChapter = chapter.id === puzzleChapter.id;
      const cleared =
        (scenario === 'existing-save' && isFirstChapter && nodeIndex < 2) ||
        (unlockSeasonTwo && chapter.order < puzzleChapter.order) ||
        (unlockSeasonTwo && isPuzzleChapter && nodeIndex < firstS2PuzzleIndex) ||
        (completePuzzle && node.id === puzzleNode.id);
      const available =
        (!unlockSeasonTwo && isFirstChapter && nodeIndex === (scenario === 'existing-save' ? 2 : 0)) ||
        (unlockSeasonTwo && isPuzzleChapter && nodeIndex === firstS2PuzzleIndex);
      return {
        chapterId: chapter.id,
        nodeId: node.id,
        title: node.title,
        kind: node.kind,
        optional: node.optional,
        status: cleared ? 'cleared' as const : available ? 'available' as const : 'locked' as const,
        mapPosition: { ...node.mapPosition },
        prerequisites: [...node.prerequisites],
        rewards: structuredClone(node.rewards),
        cleared,
        stars: node.kind === 'battle' && cleared ? 3 : 0,
        attempts: node.kind === 'battle' && cleared ? 1 : 0,
        wins: node.kind === 'battle' && cleared ? 1 : 0,
        lastOutcome: node.kind === 'battle' && cleared ? 'win' : null,
        dialogueSeen: (scenario === 'puzzle' || completePuzzle) && node.id === puzzleNode.id
          ? node.scenes.map((_, index) => storyDialogueToken(node.id, 'main', index))
          : [],
        bossHighestPhase: 0,
        firstClearedAt: cleared ? new Date(0) : null,
        lastPlayedAt: cleared ? new Date(0) : null,
      };
    }),
  );

  const chapters = storyContent.chapters.map((chapter) => {
    const chapterNodes = nodes.filter((node) => node.chapterId === chapter.id);
    const completed = chapterNodes.filter((node) => node.cleared).length;
    const status = completed === chapterNodes.length
      ? 'cleared' as const
      : chapterNodes.some((node) => node.status === 'available')
        ? 'available' as const
        : 'locked' as const;
    return {
      id: chapter.id,
      title: chapter.title,
      subtitle: chapter.subtitle,
      description: chapter.description,
      order: chapter.order,
      mapAssetId: chapter.mapAssetId,
      status,
      completedNodes: completed,
      totalNodes: chapterNodes.length,
      completedRequiredNodes: chapterNodes.filter((node) => node.cleared && !node.optional).length,
      totalRequiredNodes: chapterNodes.filter((node) => !node.optional).length,
      stars: chapterNodes.reduce((total, node) => total + node.stars, 0),
      bossStatus: status,
    };
  });
  const recommendedNodeId = completePuzzle
    ? puzzleChapter.nodes[firstS2PuzzleIndex + 1]?.id ?? null
    : unlockSeasonTwo
      ? puzzleNode.id
      : nodes.find((node) => node.status === 'available')?.nodeId ?? null;

  return {
    contentVersion: storyContent.version,
    chapters,
    nodes,
    recommendedNodeId,
    totalStars: nodes.reduce((total, node) => total + node.stars, 0),
    completedNodes: nodes.filter((node) => node.cleared).length,
    bossStatus: 'in-progress',
    seasons: storySeasons.map((season) => {
      const seasonNodes = nodes.filter((node) => season.chapterIds.includes(node.chapterId));
      const available = seasonNodes.some((node) => node.status !== 'locked');
      return {
        ...season,
        chapterIds: [...season.chapterIds],
        status: seasonNodes.every((node) => node.cleared)
          ? 'cleared' as const
          : available
            ? 'available' as const
            : 'locked' as const,
        recommendedNodeId: seasonNodes.some((node) => node.nodeId === recommendedNodeId)
          ? recommendedNodeId
          : seasonNodes.find((node) => node.status === 'available')?.nodeId ?? null,
        starsEarned: seasonNodes.reduce((total, node) => total + node.stars, 0),
        starsAvailable: seasonNodes.filter((node) => node.kind === 'battle').length * 3,
        clearedNodes: seasonNodes.filter((node) => node.cleared).length,
        totalNodes: seasonNodes.length,
      };
    }),
  };
}

let bootstrap = createBootstrap();
let campaign = createCampaign();
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url, window.location.origin);
  if (!url.pathname.startsWith('/api/player/')) return realFetch(input, init);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
  if (request.method === 'GET' && url.pathname.endsWith('/bootstrap')) return json(bootstrap);
  if (request.method === 'GET' && url.pathname.endsWith('/story')) return json(campaign);
  if (request.method === 'POST' && url.pathname.endsWith('/story/puzzle')) {
    const fixtureWindow = window as typeof window & {
      __seasonPuzzleRequests?: number;
      __seasonPuzzleLastBody?: Record<string, unknown>;
    };
    fixtureWindow.__seasonPuzzleRequests = (fixtureWindow.__seasonPuzzleRequests ?? 0) + 1;
    const body = await request.json() as { nodeId: string; order?: string[]; skip?: boolean };
    fixtureWindow.__seasonPuzzleLastBody = body as Record<string, unknown>;
    if (body.nodeId !== puzzleNode.id) return json({ error: 'Unknown fixture puzzle.' }, 404);
    if (!body.skip && JSON.stringify(body.order) !== JSON.stringify(puzzleNode.puzzle!.solution)) {
      return json({ error: 'That evidence order does not fit the record.' }, 400);
    }
    campaign = structuredClone(campaign);
    const progress = campaign.nodes.find((node) => node.nodeId === puzzleNode.id)!;
    progress.cleared = true;
    progress.status = 'cleared';
    window.localStorage.setItem(`season-theater:puzzle:${puzzleNode.id}`, 'complete');
    bootstrap = structuredClone(bootstrap);
    bootstrap.profile.softCurrency += 40;
    return json({
      campaign,
      bootstrap,
      rewards: [{ kind: 'currency', id: 'street-xp', amount: 40 }],
      alreadyCompleted: false,
      resolution: body.skip ? 'skipped' : 'solved',
    });
  }
  const dialogueMatch = url.pathname.match(/\/story\/nodes\/([^/]+)\/dialogue$/);
  if (request.method === 'POST' && dialogueMatch) {
    const body = await request.json() as { dialogueSeen?: string[] };
    campaign = structuredClone(campaign);
    const progress = campaign.nodes.find((node) => node.nodeId === dialogueMatch[1]);
    if (!progress) return json({ error: 'Unknown fixture story node.' }, 404);
    progress.dialogueSeen = [...new Set([...progress.dialogueSeen, ...(body.dialogueSeen ?? [])])];
    return json({ campaign, bootstrap });
  }
  return json({ error: `Unexpected fixture request: ${request.method} ${url.pathname}` }, 501);
};

// Mount the real Story surface in the same shell hierarchy used by GameApp.
// The e2e-only wrapper avoids requiring Clerk in a fresh screenshot browser;
// no production auth path or production data fallback is changed.
window.localStorage.setItem('squabblemon_e2e_user', 'signed-in');
const query = params.size ? `?${params}` : '';
window.history.replaceState({}, '', `${import.meta.env.BASE_URL}game/story${query}`);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), bootstrap);
queryClient.setQueryData(getGetPlayerStoryQueryKey(), campaign);

function Fixture() {
  return (
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <QueryClientProvider client={queryClient}>
        <CosmeticProvider profile={bootstrap.profile}>
          <RewardReveal />
          <div className="game-shell game-shell--compact-nav h-[100dvh] bg-[#070707] text-white">
            <div className="noise-overlay" />
            <div className="game-shell__content">
              <CityHeader bootstrap={bootstrap} />
              <div className="game-route-stage">
                <Story bootstrap={bootstrap} />
              </div>
            </div>
          </div>
        </CosmeticProvider>
      </QueryClientProvider>
    </Router>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);