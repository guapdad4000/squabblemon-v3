import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ANUNAKI_STORY_CHAPTERS, anunakiClaimKey, anunakiEventStatus } from '@workspace/squabblemon-engine/anunakiEvent';
import { AnunakiEvent } from '../src/components/AnunakiEvent';
const params = new URLSearchParams(location.search);
const available = params.has('ready') || params.has('switch') || params.has('duplicate');
// Real milestone metadata and requirements; progress remains fixture-only.
const status = anunakiEventStatus(available ? [`${ANUNAKI_STORY_CHAPTERS[0]}-fight-1`,`${ANUNAKI_STORY_CHAPTERS[0]}-fight-2`] : [], [], [], [], [], available);
function claimed(duplicateShards=0) { return {claimed:true,duplicateShards,status:anunakiEventStatus([`${ANUNAKI_STORY_CHAPTERS[0]}-fight-1`,`${ANUNAKI_STORY_CHAPTERS[0]}-fight-2`],[],[anunakiClaimKey('first-contact')],[],[],true),bootstrap:{profile:{id:'fixture'}}}; }
let postCount = 0;
window.fetch = async (_input, init) => {
  if (init?.method !== 'POST') return new Response(JSON.stringify(status), {status:200, headers:{'Content-Type':'application/json'}});
  postCount++;
  if (params.has('switch') && postCount === 1) {
    return await new Promise<Response>(resolve => { (window as unknown as { resolveOldClaim: () => void }).resolveOldClaim = () => { const response = new Response(JSON.stringify(claimed(999)), {status:200, headers:{'Content-Type':'application/json'}}); const read = response.text.bind(response); response.text = async () => { const text = await read(); (window as unknown as { oldResponseRead: boolean }).oldResponseRead = true; return text; }; resolve(response); }; });
  }
  return new Response(JSON.stringify(params.has('duplicate') ? {...claimed(25), receiptLabel:'Saved reward.'} : claimed()), {status:200, headers:{'Content-Type':'application/json'}});
};
function Fixture() {
  const [profile, setProfile] = useState('fixture');
  return <><button type="button" onClick={() => setProfile('other-player')}>Switch player</button><AnunakiEvent bootstrap={{profile:{id:profile}} as never}/></>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><Fixture /></QueryClientProvider>);
