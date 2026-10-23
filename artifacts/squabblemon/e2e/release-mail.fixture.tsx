import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { SafehouseMail } from '../src/components/SafehouseMail';
import { PatchDetail } from '../src/components/PatchNotes';
import streetRelease from '../src/lib/streetLegendsRelease.json';
import collectorRelease from '../src/lib/collectorV2Release.json';
import { COLLECTOR_V2_MAIL_ID } from '../src/lib/mailEvents';
import '../src/index.css';

const isCollector = new URLSearchParams(location.search).get('version') === '1.14';
const release = isCollector ? collectorRelease : streetRelease;
// Local visual fixture only. Preview letters never reach the production mailbox.
if (isCollector) {
  const originalFetch = window.fetch.bind(window);
  const letter = {
    id: COLLECTOR_V2_MAIL_ID, title: `Patch ${release.version}: ${release.title}`,
    body: [`Patch ${release.version} · October 22, 2026`, release.title, '', release.overview, '', 'Buffs', ...release.buffs.map(line => `• ${line}`), '', 'Changes', ...release.changes.map(line => `• ${line}`)].join('\n'),
    sender: 'The Squabblemon Team', sentAt: '2026-10-22T18:00:00Z', readAt: '2026-10-22T18:00:00Z', claimedAt: null,
    gift: { softCurrency: 0, packTickets: 0, styleShards: 0 },
  };
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (new URL(url, location.href).pathname.endsWith('/api/player/mail')) {
      return Promise.resolve(new Response(JSON.stringify({ messages: [letter] }), { headers: { 'Content-Type': 'application/json' } }));
    }
    return originalFetch(input, init);
  };
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Review() {
  const [open, setOpen] = useState(true);
  const mail = new URLSearchParams(location.search).get('view') !== 'notes';
  return <main style={{ minHeight: '100dvh', background: '#101d18', padding: '24px 12px' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', color: '#efd991' }}>
      <p style={{ fontSize: 12, marginBottom: 16 }}>PREPARED RELEASE / {release.version} / UNPUBLISHED</p>
      {mail ? <><button onClick={() => setOpen(true)} style={{ padding: 12 }}>Preview Mailman letter</button><SafehouseMail playerId="release-preview" open={open} onClose={() => setOpen(false)} /></>
        : <PatchDetail patch={release} preview />}
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Router><Review /></Router></QueryClientProvider>);
