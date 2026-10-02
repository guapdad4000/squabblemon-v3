import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RewardReveal } from '../src/components/RewardReveal';
import { RewardStinger } from '../src/components/RewardStinger';
import { rewardClips } from '../src/lib/broadcastCatalog';
import { revealProfileRewards, revealStoryRewards, rewardReceipts } from '../src/lib/rewardReceipts';
import type { PlayerBootstrap, StoryGrantedReward } from '@workspace/api-client-react';
import '../src/index.css';

const bootstrap = (softCurrency: number): PlayerBootstrap => ({
  profile: {
    id: 'broadcast-fixture-player', softCurrency, packTickets: 0, styleShardBalances: {},
    streetRep: 0, xp: 0, ownedCardIds: [], unlockedCosmeticIds: [],
  },
} as PlayerBootstrap);

function Fixture() {
  const visual = new URLSearchParams(location.search).has('visual');
  const holdMedia = new URLSearchParams(location.search).has('hold-media');
  const [clipIndex, setClipIndex] = useState(0);
  const [mountStinger, setMountStinger] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.has('media') || params.has('visual') || params.has('clip');
  });
  const [completed, setCompleted] = useState(0);
  const [presenterVersion, setPresenterVersion] = useState(0);
  const selected = rewardClips[clipIndex];
  const enqueue = (id: string, presentation?: 'mission' | 'promo' | 'story') => {
    rewardReceipts.show({
      id, title: id.replaceAll('-', ' '), presentation,
      items: [{ label: `${id} confirmed`, amount: 25, glyph: 'clout' }],
    });
  };
  const claimProfileRewards = async (action: 'mission' | 'promo' | 'failure') => {
    const response = await fetch(`/api/e2e/rewards/${action}`, { method: 'POST' });
    if (!response.ok) return;
    const after = await response.json() as PlayerBootstrap;
    const presentation = action === 'promo' ? 'promo' : 'mission';
    revealProfileRewards(bootstrap(100), after, `fixture-${action}`, action === 'promo' ? 'promo receipt' : 'mission receipt', presentation);
  };
  const claimStoryRewards = async (kind: 'card' | 'clout') => {
    const response = await fetch(`/api/e2e/rewards/story-${kind}`, { method: 'POST' });
    if (!response.ok) return;
    const result = await response.json() as { bootstrap: PlayerBootstrap; rewards: StoryGrantedReward[] };
    revealStoryRewards({
      nodeId: `fixture-${kind}`, title: kind === 'card' ? 'Story receipt' : 'Story Clout award',
      story: { chapterTitle: 'Block Party', backgroundAssetId: 'assets/story/chapter-one/environments/map.webp' },
      rewards: result.rewards, bootstrap: result.bootstrap, resolveCharacter: () => undefined,
      presentation: 'story',
    });
  };
  (window as Window & { broadcastFixture?: unknown }).broadcastFixture = {
    selectClip: (index: number) => { setClipIndex(index); setMountStinger(true); },
    unmountStinger: () => setMountStinger(false),
    remountStinger: () => setMountStinger(true),
    duplicateMission: () => revealProfileRewards(bootstrap(100), bootstrap(125), 'fixture-mission', 'mission receipt', 'mission'),
    remountPresenter: () => setPresenterVersion(value => value + 1),
    completeCount: () => completed,
  };
  return <main style={visual ? { position: 'fixed', inset: 0, zIndex: 99999, height: '100dvh', padding: 0 } : { padding: 16 }}>
    {!visual && <h1>Mounted broadcast verification</h1>}
    {!visual && <nav aria-label="Receipt test actions">
      <button onClick={() => void claimProfileRewards('mission')}>Mission receipt</button>
      <button onClick={() => void claimProfileRewards('promo')}>Promo receipt</button>
      <button onClick={() => void claimStoryRewards('card')}>Story non-Clout receipt</button>
      <button onClick={() => void claimStoryRewards('clout')}>Story Clout opt-out</button>
      <button onClick={() => enqueue('mission-receipt', 'mission')}>Duplicate mission receipt</button>
      <button onClick={() => setPresenterVersion(value => value + 1)}>Remount receipt presenter</button>
      <button onClick={() => enqueue('battle-haul')}>Battle opt-out receipt</button>
      <button onClick={() => {
        rewardReceipts.deferLevel({ id: 'level-up', title: 'Level up', level: 2, items: [{ label: 'Level', amount: 1 }] });
        rewardReceipts.leaveBattleResults(() => {});
      }}>Level opt-out receipt</button>
      <button onClick={() => void claimProfileRewards('failure')}>Failed action</button>
      <button onClick={() => { enqueue('fifo-first', 'mission'); enqueue('fifo-second', 'promo'); }}>Queue two</button>
      <button onClick={() => { setClipIndex((value) => (value + 1) % rewardClips.length); setMountStinger(true); }}>Next media clip</button>
      <button onClick={() => setMountStinger(false)}>Unmount media</button>
      <button onClick={() => setMountStinger(true)}>Remount media</button>
    </nav>}
    {!visual && <output data-testid="stinger-complete-count">{completed}</output>}
    {mountStinger && <RewardStinger key={selected.id} clip={selected} maxDurationMs={holdMedia ? 60_000 : undefined} onComplete={() => setCompleted(value => value + 1)} />}
    <RewardReveal key={presenterVersion} />
  </main>;
}

rewardReceipts.reset();
createRoot(document.getElementById('root')!).render(<Fixture />);