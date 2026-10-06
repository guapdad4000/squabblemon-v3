import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { SafehouseMail } from '../src/components/SafehouseMail';
import { PatchDetail } from '../src/components/PatchNotes';
import release from '../src/lib/streetLegendsRelease.json';
import '../src/index.css';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Review() {
  const [open, setOpen] = useState(true);
  const mail = new URLSearchParams(location.search).get('view') !== 'notes';
  return <main style={{ minHeight: '100dvh', background: '#101d18', padding: '24px 12px' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', color: '#efd991' }}>
      <p style={{ fontSize: 12, marginBottom: 16 }}>PREPARED RELEASE / 1.11 / UNPUBLISHED</p>
      {mail ? <><button onClick={() => setOpen(true)} style={{ padding: 12 }}>Preview Mailman letter</button><SafehouseMail playerId="release-preview" open={open} onClose={() => setOpen(false)} /></>
        : <PatchDetail patch={release} preview />}
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Router><Review /></Router></QueryClientProvider>);
