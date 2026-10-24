import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { accountRewardStatus, growthLabStatus, growthTasksForDate, GROWTH_GARDEN_REWARD, MONTHLY_LOGIN_MILESTONES, type AccountRewardGrant } from '@workspace/squabblemon-engine/accountRewards';
import { cardCatalog, STORY_ONLY_CARD_IDS, isKumiteExclusiveCard } from '@workspace/squabblemon-engine/data';
import { STYLE_SHARD_TIERS, styleShardRarityForCard } from '@workspace/squabblemon-engine/styleShards';
import { BuddyGrowthLab } from '../src/components/BuddyGrowthLab';
import { DailyCheckInArrival } from '../src/components/DailyCheckInArrival';
import { profileBootstrap } from './fighter-id.fixture';
import '../src/index.css';
import './rewards-review.fixture.css';

const params = new URLSearchParams(location.search);
const surface = params.get('surface');
const sampleDate = '2026-10-24';
const sampleNow = new Date(`${sampleDate}T12:00:00Z`);
const created = new Date('2025-01-01T00:00:00Z');
const blank = { softCurrency: 0, packTickets: 0, styleShards: 0 };
const eligibleCards = cardCatalog.filter(card => !(STORY_ONLY_CARD_IDS as readonly string[]).includes(card.catalogId) && !isKumiteExclusiveCard(card.catalogId));
const sampleKey = `local-rewards-review-${surface}`;
// This page never calls the live reward API. Every reset rebuilds this same sample.
const receipts: AccountRewardGrant[] = [
  { key: 'first-login', title: 'Sample saved first login', ...blank },
  ...[...Array.from({ length: 18 }, (_, i) => i + 1), 23].map(day => {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    return { key: `login:${date}`, date, streak: day === 23 ? 6 : day, title: 'Sample saved check-in', ...blank };
  }),
  ...Array.from({ length: 5 }, (_, i) => { const date = `2026-10-${String(i + 18).padStart(2, '0')}`;return { key: `growth:water:${date}`, date, title: 'Sample saved plant', ...blank }; }),
  ...MONTHLY_LOGIN_MILESTONES.filter(milestone => milestone.day < 20).map(milestone => {
    const card = eligibleCards.find(value => value.rarity === milestone.rarity)!;
    return { key: `monthly-login:2026-10:${milestone.rarity}`, date: `2026-10-${String(milestone.day).padStart(2, '0')}`, monthlyDay: milestone.day, title: 'Sample saved monthly card', cardId: card.catalogId, cardName: card.name, cardRarity: card.rarity, isNewCard: true, ...blank };
  }),
];
let bootstrap = profileBootstrap({ id: sampleKey, ownedCardIds: ['buddy', ...receipts.flatMap(reward => reward.cardId ? [reward.cardId] : [])], settings: { reducedMotion: false, turnTimerEnabled: false } });
const daily = { date: sampleDate, counters: Object.fromEntries(growthTasksForDate(sampleNow).filter(task => task.key !== 'login').map((task, i) => [task.key, i === 0 ? 1 : 0])) };
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const status = () => ({ ...accountRewardStatus(1, created, receipts, sampleNow, [], daily), nextResetAt: new Date(Date.now() + 12 * 3600000).toISOString() });
let claimCalls = 0, waterCalls = 0;
function grant(rewards: AccountRewardGrant[]) {
  receipts.push(...rewards);
  const cards = rewards.flatMap(reward => reward.cardId ? [reward.cardId] : []);
  bootstrap = { ...bootstrap, profile: { ...bootstrap.profile,
    ownedCardIds: [...new Set([...bootstrap.profile.ownedCardIds, ...cards])],
    discoveredCardIds: [...new Set([...bootstrap.profile.discoveredCardIds, ...cards])],
    softCurrency: bootstrap.profile.softCurrency + rewards.reduce((total, reward) => total + reward.softCurrency, 0),
    packTickets: bootstrap.profile.packTickets + rewards.reduce((total, reward) => total + reward.packTickets, 0),
    styleShards: bootstrap.profile.styleShards + rewards.reduce((total, reward) => total + (reward.shardRarity ? 0 : reward.styleShards), 0),
  } };
  return { rewards, status: status(), bootstrap };
}
if (surface === 'daily' || surface === 'growth') {
  // Reset only this fixture's dismissal; real player preferences are untouched.
  localStorage.removeItem(`squabblemon:daily-arrival:v1:${sampleKey}`);
  client.setQueryData(getGetPlayerBootstrapQueryKey(), bootstrap);
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    if (!url.pathname.includes('/api/')) return nativeFetch(input, init);
    await new Promise(resolve => setTimeout(resolve, 120));
    const path = url.pathname;
    if (path === '/api/player/rewards/account') return Response.json(status());
    if (path === '/api/player/rewards/account/claim') {
      claimCalls++;
      const owned = new Set(bootstrap.profile.ownedCardIds);
      return Response.json(grant(status().pending.map(value => {
        const reward = { ...value };
        if (reward.cardRarity) {
          const pool = eligibleCards.filter(card => card.rarity === reward.cardRarity);
          const card = pool.find(card => !owned.has(card.catalogId)) ?? pool[0];
          reward.cardId = card.catalogId; reward.cardName = card.name; reward.isNewCard = !owned.has(card.catalogId);
          if (!reward.isNewCard) { reward.shardRarity = styleShardRarityForCard(card.rarity); reward.styleShards = STYLE_SHARD_TIERS[reward.shardRarity].duplicatePayout; }
          owned.add(card.catalogId);
        }
        return reward;
      })));
    }
    if (path === '/api/player/rewards/account/growth/water') {
      waterCalls++;
      const growth = growthLabStatus(receipts, [], sampleNow, daily);
      const rewards: AccountRewardGrant[] = growth.ready ? [{ key: `growth:water:${sampleDate}`, date: sampleDate, title: 'Sample plant saved', ...blank }] : [];
      if (growth.ready && (growth.totalPlants + 1) % 7 === 0) rewards.push({ key: `growth:garden:${(growth.totalPlants + 1) / 7}`, date: sampleDate, title: 'Sample harvest', ...GROWTH_GARDEN_REWARD });
      return Response.json(grant(rewards));
    }
    return Response.json({ error: 'This is a local review; live API requests are disabled.' }, { status: 404 });
  };
  Object.assign(window, { rewardsReview: { snapshot: () => ({ status: status(), bootstrap, claimCalls, waterCalls }) } });
}

function SampleSurface() {
  const [open, setOpen] = useState(true);
  const query = useQuery({ queryKey: getGetPlayerBootstrapQueryKey(), queryFn: async () => bootstrap, initialData: bootstrap, staleTime: Infinity });
  return <main className="rewards-review-sample">
    <p>LOCAL SAMPLE · {surface === 'daily' ? 'DAILY DROP' : 'BUDDY’S GROWTH LAB'}</p>
    <p>No real rewards are claimed. Reload to reset.</p>
    <button onClick={() => location.reload()}>Reset sample</button>
    {surface === 'growth' && <><button onClick={() => setOpen(true)}>Open Growth Lab</button><button onClick={() => { Object.keys(daily.counters).forEach(key => { daily.counters[key] = 1; }); void client.invalidateQueries({ queryKey: ['account-rewards'] }); }}>Complete sample care tasks</button><BuddyGrowthLab bootstrap={query.data} open={open} onOpenChange={setOpen} /></>}
    {surface === 'daily' && <DailyCheckInArrival bootstrap={query.data} />}
  </main>;
}
type View = 'daily' | 'growth' | 'compare';
function Review() {
  const initialView = params.get('view');
  const [view, setView] = useState<View>(initialView === 'daily' || initialView === 'growth' ? initialView : 'compare');
  const [revision, setRevision] = useState(0);
  return <main className="rewards-review" data-view={view}>
    <header className="rewards-review__header"><div><strong>Daily Drop + Growth Lab</strong><p>LOCAL REVIEW · SAMPLE ACCOUNT · OCT 24</p></div><nav aria-label="Review surface">{(['daily', 'growth', 'compare'] as const).map(value => <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>{value === 'daily' ? 'Daily Drop' : value === 'growth' ? 'Growth clipboard' : 'Side by side'}</button>)}<button onClick={() => setRevision(value => value + 1)}>Reset sample</button></nav></header>
    <p className="rewards-review__note">Real game components · 19 monthly check-ins · 5 plants · sample rewards only. Close a popup to try its controls. <a href="?surface=growth" target="_blank" rel="noreferrer">Full-window clipboard ↗</a> <a href="?surface=daily" target="_blank" rel="noreferrer">Full-window Daily Drop ↗</a></p>
    <section className="rewards-review__panes" aria-label="Production component previews">{(['daily', 'growth'] as const).map(value => <section key={value} className="rewards-review__pane" hidden={view !== 'compare' && view !== value}><h1>{value === 'daily' ? 'Daily Drop' : 'Buddy’s Growth Lab clipboard'}</h1><iframe key={`${value}-${revision}`} title={`${value === 'daily' ? 'Daily Drop' : 'Growth Lab'} — local sample data`} src={`?surface=${value}&revision=${revision}`} /></section>)}</section>
  </main>;
}
createRoot(document.getElementById('root')!).render(surface === 'daily' || surface === 'growth'
  ? <QueryClientProvider client={client}><SampleSurface /></QueryClientProvider>
  : <Review />);
