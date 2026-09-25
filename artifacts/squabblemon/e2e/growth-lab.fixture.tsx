import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { accountRewardStatus, growthLabStatus, GROWTH_GARDEN_REWARD, type AccountRewardGrant } from '@workspace/squabblemon-engine/accountRewards';
import { BuddyGrowthLab } from '../src/components/BuddyGrowthLab';
import '../src/index.css';

const params = new URLSearchParams(location.search), date = new Date().toISOString().slice(0, 10);
const now = new Date(`${date}T12:00:00Z`), created = new Date('2025-01-01Z');
const total = Number(params.get('plants') ?? 0), completed = Number(params.get('tasks') ?? 0);
const storageKey = `growth-fixture:${params.get('id') ?? 'demo'}`;
let receipts: AccountRewardGrant[] = JSON.parse(localStorage.getItem(storageKey) ?? 'null') ?? [
  { key: 'first-login', title: 'First', softCurrency: 100, packTickets: 1, styleShards: 0 },
  ...Array.from({ length: total }, (_, i) => { const day = new Date(now.getTime() - (total - i) * 86400000).toISOString().slice(0, 10);return { key: `growth:water:${day}`, date: day, title: 'Plant', softCurrency: 0, packTickets: 0, styleShards: 0 }; }),
];
const missions = ['daily-show-up', 'daily-take-room'].map((missionKey, i) => ({ missionKey, progress: completed > i ? 1 : 0, goal: 1, resetAt: new Date(now.getTime() + 86400000) }));
const initialBootstrap = { profile: { id: 'e2e-player', level: 1, softCurrency: 500, packTickets: 3, styleShards: 0, settings: { reducedMotion: params.get('motion') === 'reduce' } }, missions: [] } as unknown as PlayerBootstrap;
let bootstrap = initialBootstrap, waterCalls = 0, failOnce = params.get('failure') === 'water';
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const status = () => accountRewardStatus(1, created, receipts, now, missions);
const nativeFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/api/player/rewards/account')) return nativeFetch(input, init);
  await new Promise(resolve => setTimeout(resolve, 80));
  let rewards: AccountRewardGrant[] = [];
  if (url.endsWith('/claim')) rewards = status().pending;
  if (url.endsWith('/growth/water')) {
    waterCalls++;
    if (failOnce) { failOnce = false; return Response.json({ error: 'Fixture failure' }, { status: 503 }); }
    const growth = growthLabStatus(receipts, missions, now);
    if (growth.ready) {
      rewards = [{ key: `growth:water:${date}`, date, title: 'Plant', softCurrency: 0, packTickets: 0, styleShards: 0 }];
      if ((growth.totalPlants + 1) % 7 === 0) rewards.push({ key: `growth:garden:${(growth.totalPlants + 1) / 7}`, date, title: 'Harvest', ...GROWTH_GARDEN_REWARD });
    }
  }
  receipts.push(...rewards);localStorage.setItem(storageKey, JSON.stringify(receipts));
  bootstrap = { ...bootstrap, profile: { ...bootstrap.profile, softCurrency: bootstrap.profile.softCurrency + rewards.reduce((n, r) => n + r.softCurrency, 0), packTickets: bootstrap.profile.packTickets + rewards.reduce((n, r) => n + r.packTickets, 0), styleShards: bootstrap.profile.styleShards + rewards.reduce((n, r) => n + r.styleShards, 0) } };
  return Response.json(init?.method === 'POST' ? { rewards, status: status(), bootstrap } : status());
};
Object.assign(window, { growthFixture: { snapshot: () => ({ status: status(), waterCalls, receipts, bootstrap }), completeTasks: async () => { missions.forEach(m => m.progress = 1);await client.invalidateQueries({ queryKey: ['account-rewards'] }); } } });
function Fixture() {
  const [open, setOpen] = useState(true);
  const query = useQuery({ queryKey: getGetPlayerBootstrapQueryKey(), queryFn: () => bootstrap, initialData: bootstrap, staleTime: Infinity });
  return <main style={{ minHeight: '100dvh', background: 'radial-gradient(ellipse at 50% 35%,#345244,#0a1813 70%)', padding: 30 }}><button style={{ color: '#efe4bb' }} onClick={() => setOpen(true)}>Open Buddy’s Growth Lab</button><BuddyGrowthLab bootstrap={query.data} open={open} onOpenChange={setOpen} /></main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
