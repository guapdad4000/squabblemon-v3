import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { SafehouseBulletinBoardContent } from '../src/components/SafehouseBulletinBoard';
import { PatchDetail } from '../src/components/PatchNotes';
import { SafehouseMail } from '../src/components/SafehouseMail';
import { KUMITE_BREAKTHROUGH_MAIL_ID } from '../src/lib/mailEvents';
import release from '../src/lib/kumiteBreakthroughRelease.json';
import '../src/index.css';
if (!import.meta.env.DEV) throw new Error('Release preview is local-only.');
const letter = {
  id: KUMITE_BREAKTHROUGH_MAIL_ID, title: `Patch ${release.version}: ${release.title}`,
  sender: 'The Squabblemon Team', sentAt: `${release.date}T12:00:00Z`,
  body: [`Patch ${release.version} · October 30, 2026`, release.title, '', release.overview, '', 'Changes', ...release.changes.map(line => `• ${line}`)].join('\n'),
  gift: { softCurrency: release.softCurrency, packTickets: release.packTickets, styleShards: 0 },
  readAt: null as string | null, claimedAt: null as string | null,
};
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input, init);
  if (url.pathname === '/api/events/patches') return Response.json([]);
  if (url.pathname === '/api/player/mail' && (!init?.method || init.method === 'GET')) return Response.json({ messages: [letter] });
  if (url.pathname.startsWith(`/api/player/mail/${letter.id}/`)) {
    letter.readAt ??= new Date().toISOString();
    const credited = url.pathname.endsWith('/claim') && !letter.claimedAt;
    if (credited) letter.claimedAt = new Date().toISOString();
    return Response.json({ mail: { ...letter }, credited });
  }
  return Response.json({ error: 'No real account API in this preview' }, { status: 503 });
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
const initial = new URLSearchParams(location.search).get('view');
function Review() {
  const [view, setView] = useState(initial === 'letter' || initial === 'patch' ? initial : 'event');
  return <><nav className="release-review-tools" aria-label="Release preview"><span>LOCAL PREVIEW · NO REAL GIFTS</span>
    {['event', 'patch', 'letter'].map(item => <button key={item} onClick={() => setView(item)} aria-pressed={view === item}>{item.toUpperCase()}</button>)}
  </nav>
    {view === 'event' && <SafehouseBulletinBoardContent playerId="release-preview-only" />}
    {view === 'patch' && <main className="release-review-patch"><PatchDetail patch={release} preview /></main>}
    <SafehouseMail playerId="release-preview-only" open={view === 'letter'} onClose={() => setView('event')} />
  </>;
}
const root = createRoot(document.getElementById('root')!);
import.meta.hot?.dispose(() => { root.unmount(); window.fetch = originalFetch; });
root.render(<React.StrictMode><Router><QueryClientProvider client={client}><Review /></QueryClientProvider></Router></React.StrictMode>);
const style = document.createElement('style');
style.textContent = `html,body,#root{margin:0;min-height:100%;background:#14130f;color:#f7f1dd}.release-review-tools{position:sticky;top:0;z-index:100;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 12px;background:#151510;font:11px sans-serif}.release-review-tools span{margin-right:auto}.release-review-tools button{min-height:44px;padding:8px 15px;border:1px solid #d8bf6f;color:inherit;background:#24221b;cursor:pointer}.release-review-tools button[aria-pressed=true]{color:#151510;background:#eac33e}.release-review-patch{max-width:1100px;margin:0 auto;padding:16px}.bulletin-shell{max-width:1300px;margin:auto}.mail-delivery{z-index:200}`;
document.head.append(style);
