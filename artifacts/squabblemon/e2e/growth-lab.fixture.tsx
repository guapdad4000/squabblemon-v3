import {CharacterRecruitment,type RecruitmentCharacter} from '../src/components/CharacterRecruitment';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { accountRewardStatus, growthLabStatus, GROWTH_GARDEN_REWARD, growthTasksForDate, type AccountRewardGrant } from '@workspace/squabblemon-engine/accountRewards';
import { cardCatalog, STORY_ONLY_CARD_IDS, isKumiteExclusiveCard } from '@workspace/squabblemon-engine/data';
import { STYLE_SHARD_TIERS, styleShardRarityForCard } from '@workspace/squabblemon-engine/styleShards';
import { DeferredGrowthLab } from '../src/components/DeferredGrowthLab';
import '../src/index.css';

const params = new URLSearchParams(location.search), date = params.get('date') ?? new Date().toISOString().slice(0, 10);
const now = new Date(`${date}T12:00:00Z`), created = new Date('2025-01-01Z');
const total = Number(params.get('plants') ?? 0), completed = Number(params.get('tasks') ?? 0);
const storageKey = `growth-fixture:${params.get('id') ?? 'demo'}`;
let receipts: AccountRewardGrant[] = JSON.parse(localStorage.getItem(storageKey) ?? 'null') ?? [
  { key: 'first-login', title: 'First', softCurrency: 100, packTickets: 1, styleShards: 0 },
  ...Array.from({ length: Number(params.get('checkins') ?? 0) }, (_, i) => { const day = `${date.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`;return { key: `login:${day}`, date: day, streak: i + 1, title: 'Saved check-in', softCurrency: 0, packTickets: 0, styleShards: 0 }; }),
  ...Array.from({ length: total }, (_, i) => { const day = new Date(now.getTime() - (total - i) * 86400000).toISOString().slice(0, 10);return { key: `growth:water:${day}`, date: day, title: 'Plant', softCurrency: 0, packTickets: 0, styleShards: 0 }; }),
];
const daily={date,counters:Object.fromEntries(growthTasksForDate(now).filter(t=>t.key!=='login').map((t,i)=>[t.key,completed>i?1:0]))};
const missions = ['daily-show-up', 'daily-take-room'].map((missionKey, i) => ({ missionKey, progress: completed > i ? 1 : 0, goal: 1, resetAt: new Date(now.getTime() + 86400000) }));
const initialBootstrap = { profile: { id: 'e2e-player', level: 1, softCurrency: 500, packTickets: 3, styleShards: 0, ownedCardIds:[],discoveredCardIds:[],settings: { reducedMotion: params.get('motion') === 'reduce' } }, missions: [] } as unknown as PlayerBootstrap;
let bootstrap: PlayerBootstrap = JSON.parse(localStorage.getItem(`${storageKey}:bootstrap`) ?? 'null') ?? initialBootstrap;
let waterCalls = 0, claimCalls = 0, failOnce = params.get('failure') === 'water';
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const status = () => accountRewardStatus(1, created, receipts, now, missions,daily);
const nativeFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/api/player/rewards/account')) return nativeFetch(input, init);
  await new Promise(resolve => setTimeout(resolve, 80));
  let rewards: AccountRewardGrant[] = [];
  if (url.endsWith('/claim')) {
    claimCalls++;
    const owned = new Set(bootstrap.profile.ownedCardIds);
    rewards = status().pending.map(value => {
      const reward = { ...value };
      if (reward.key.startsWith('monthly-login:')) {
        const pool = cardCatalog.filter(card => card.rarity === reward.cardRarity && !(STORY_ONLY_CARD_IDS as readonly string[]).includes(card.catalogId) && !isKumiteExclusiveCard(card.catalogId));
        const card = pool.find(card => !owned.has(card.catalogId)) ?? pool[0];
        reward.cardId = card.catalogId;reward.cardName = card.name;reward.isNewCard = !owned.has(card.catalogId);
        if (!reward.isNewCard) { reward.shardRarity = styleShardRarityForCard(card.rarity);reward.styleShards = STYLE_SHARD_TIERS[reward.shardRarity].duplicatePayout; }
        owned.add(card.catalogId);
      }
      return reward;
    });
  }
  if (url.endsWith('/growth/water')) {
    waterCalls++;
    if (failOnce) { failOnce = false; return Response.json({ error: 'Fixture failure' }, { status: 503 }); }
    const growth = growthLabStatus(receipts, missions, now,daily);
    if (growth.ready) {
      rewards = [{ key: `growth:water:${date}`, date, title: 'Plant', softCurrency: 0, packTickets: 0, styleShards: 0 }];
      if ((growth.totalPlants + 1) % 7 === 0) rewards.push({ key: `growth:garden:${(growth.totalPlants + 1) / 7}`, date, title: 'Harvest', ...GROWTH_GARDEN_REWARD });
      if(growth.totalPlants+1>=21&&!receipts.some(r=>r.key==='growth:buddy'))rewards.push({key:'growth:buddy',title:'Buddy joins your crew',cardId:'buddy',softCurrency:0,packTickets:0,styleShards:0});
    }
  }
  receipts.push(...rewards);localStorage.setItem(storageKey, JSON.stringify(receipts));
  bootstrap = { ...bootstrap, profile: { ...bootstrap.profile, ownedCardIds:[...new Set([...bootstrap.profile.ownedCardIds,...rewards.flatMap(reward=>reward.cardId?[reward.cardId]:[])])], softCurrency: bootstrap.profile.softCurrency + rewards.reduce((n, r) => n + r.softCurrency, 0), packTickets: bootstrap.profile.packTickets + rewards.reduce((n, r) => n + r.packTickets, 0), styleShards: bootstrap.profile.styleShards + rewards.reduce((n, r) => n + r.styleShards, 0) } };
  localStorage.setItem(`${storageKey}:bootstrap`, JSON.stringify(bootstrap));
  return Response.json(init?.method === 'POST' ? { rewards, status: status(), bootstrap } : status());
};
Object.assign(window, { growthFixture: { snapshot: () => ({ status: status(), waterCalls, claimCalls, receipts, bootstrap }), completeTasks: async () => { missions.forEach(m => m.progress = 1);Object.keys(daily.counters).forEach(k=>daily.counters[k]=1);await client.invalidateQueries({ queryKey: ['account-rewards'] }); } } });
function Fixture() {
  const [open, setOpen] = useState(!params.has('recruit'));
  const query = useQuery({ queryKey: getGetPlayerBootstrapQueryKey(), queryFn: () => bootstrap, initialData: bootstrap, staleTime: Infinity });
  const [recruit,setRecruit]=useState(params.get('recruit') as RecruitmentCharacter|null);
  return <main style={{ minHeight: '100dvh', background: 'radial-gradient(ellipse at 50% 35%,#345244,#0a1813 70%)', padding: 30 }}>{recruit&&<CharacterRecruitment id={recruit} reduced={params.get('motion')==='reduce'} onClose={()=>setRecruit(null)}/>}<button style={{ color: '#efe4bb' }} onClick={() => setOpen(true)}>Open Buddy’s Growth Lab</button><DeferredGrowthLab bootstrap={query.data} open={open} onOpenChange={setOpen} /></main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
