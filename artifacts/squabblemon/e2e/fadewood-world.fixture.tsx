/** Synthetic campaign/mail for UI checks. Uses the actual renderer unless the browser test explicitly replaces the iframe response. */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StoryCampaign } from '@workspace/api-client-react';
import { storyContent } from '@workspace/squabblemon-engine/story';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { FadewoodWorld } from '../src/components/world/FadewoodWorld';
import { createBootstrap } from './squabble-house-bootstrap';
import '../src/index.css';

const bootstrap = createBootstrap();
bootstrap.profile.id = 'fadewood-fixture-player';
bootstrap.profile.displayName = 'Fadewood QA';
const campaign: StoryCampaign = {
  contentVersion: storyContent.version,
  chapters: storyContent.chapters.map((chapter, index) => ({ id: chapter.id, title: chapter.title, subtitle: chapter.subtitle, description: chapter.description,
    order: index, mapAssetId: chapter.mapAssetId, status: index === 0 ? 'available' : 'locked', completedNodes: 0, totalNodes: chapter.nodes.length,
    completedRequiredNodes: 0, totalRequiredNodes: chapter.nodes.filter(node => !node.optional).length, stars: 0, bossStatus: 'locked' })),
  nodes: storyContent.chapters.flatMap((chapter, chapterIndex) => chapter.nodes.map((node, index) => ({ chapterId: chapter.id, nodeId: node.id, title: node.title,
    kind: node.kind, optional: node.optional, status: chapterIndex === 0 && index === 0 ? 'available' : 'locked', mapPosition: node.mapPosition,
    prerequisites: node.prerequisites, rewards: node.rewards, cleared: false, stars: 0, attempts: 0, wins: 0, lastOutcome: null,
    dialogueSeen: [], bossHighestPhase: 0, firstClearedAt: null, lastPlayedAt: null }))),
  recommendedNodeId: storyContent.chapters[0].nodes[0].id, totalStars: 0, completedNodes: 0, bossStatus: 'locked',
};
const dynamic = new URLSearchParams(location.search).get('dynamic');
const dynamicNodeId = dynamic === 'cornball-s2' ? 's2-the-morning-after-opening' : dynamic === 'snitch-sherlock' ? 'sherlock-three-bad-alibis' : null;
if (dynamicNodeId) {
  for (const node of campaign.nodes) node.status = node.nodeId === dynamicNodeId ? 'available' : 'locked';
  const selected = campaign.nodes.find(node => node.nodeId === dynamicNodeId)!;
  for (const chapter of campaign.chapters) chapter.status = chapter.id === selected.chapterId ? 'available' : 'locked';
  campaign.recommendedNodeId = selected.nodeId;
}
let messages = [{ id: 'fixture-delivery', title: 'A little something for the block', body: 'Synthetic local UI delivery. No live wallet is changed.', sender: 'The Mailman',
  sentAt: new Date(0).toISOString(), readAt: null as string | null, claimedAt: null as string | null, gift: { softCurrency: 25, packTickets: 1, styleShards: 0 } }];
const fetchOriginal = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
  if (!url.pathname.startsWith('/api/')) return fetchOriginal(input, init);
  const request = input instanceof Request ? input : new Request(url, init);
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  if (url.pathname === '/api/player/mail' && request.method === 'GET') return json({ messages });
  const match = url.pathname.match(/^\/api\/player\/mail\/([^/]+)\/(read|claim)$/);
  if (match && request.method === 'POST') {
    const old = messages.find(message => message.id === match[1]);
    if (!old) return json({ error: 'Unknown local delivery' }, 404);
    const credited = match[2] === 'claim' && !old.claimedAt;
    messages = messages.map(message => message.id !== old.id ? message : { ...message, readAt: message.readAt ?? new Date().toISOString(), ...(match[2] === 'claim' ? { claimedAt: message.claimedAt ?? new Date().toISOString() } : {}) });
    return json({ mail: messages.find(message => message.id === old.id), credited });
  }
  if (url.pathname.endsWith('/bootstrap')) return json(bootstrap);
  return json({ error: 'Fixture: live game writes are disabled.' }, 403);
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
client.setQueryData(['player-mail', bootstrap.profile.id], { messages });
const memory = memoryLocation({ path: `/game/story${location.search}` });
function Fixture() {
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [archive, setArchive] = useState(false);
  const [fixtureRoute] = memory.hook();
  return <Router hook={memory.hook}><QueryClientProvider client={client}>
    <div data-fixture-route={fixtureRoute} style={{ height: 68, padding: '12px 16px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', background: '#092016', color: '#f3e1ad', font: '700 11px var(--font-sans)' }}>LOCAL UI FIXTURE · SYNTHETIC CAMPAIGN AND MAIL</div>
    <div style={{ height: 'calc(100dvh - 68px)' }}><FadewoodWorld bootstrap={bootstrap} campaign={campaign} blocked={Boolean(nodeId) || archive} onOpenNode={setNodeId} onOpenArchive={() => setArchive(true)} /></div>
    {(nodeId || archive) && <div role="dialog" aria-modal="true" aria-label={archive ? 'Story archive fixture' : 'Story arrival fixture'} data-testid="fixture-story-overlay" style={{ position: 'fixed', inset: 40, zIndex: 500, padding: 25, background: '#ecdcb8', color: '#213b29' }}><h2>{archive ? 'Story archive' : nodeId}</h2><p>Local host callback reached. This fixture does not play or save a live Story scene.</p><button onClick={() => { setNodeId(null); setArchive(false); }}>Return to world</button></div>}
  </QueryClientProvider></Router>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<Fixture />);
if (import.meta.hot) import.meta.hot.dispose(() => { root.unmount(); window.fetch = fetchOriginal; });
