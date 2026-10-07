import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { profileBootstrap } from './fighter-id.fixture';
import { DeferredGrowthLab, preloadGrowthLab } from '../src/components/DeferredGrowthLab';
import { JohnHenryMythic } from '../src/components/JohnHenryMythic';
import { StarterMythic } from '../src/components/StarterMythic';
import { installStaleChunkRecovery } from '../src/lib/staleChunkRecovery';
import '../src/index.css';
// These styles are already global in GameApp's gameStyles.ts. Mirror that
// cascade so optional features defer code/art while their styling stays ready.
import '../src/styles/account-rewards.css';
import '../src/styles/game-ornaments.css';
import '../src/styles/ui-polish.css';

// Real popup controllers with disposable data only. This entry never imports
// AppAuth, Clerk, GameApp, or modifies development/production auth guards.
const initial = profileBootstrap({ id: 'deferred-popup-player', settings: { reducedMotion: true, turnTimerEnabled: false } });
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
client.setQueryData(getGetPlayerBootstrapQueryKey(), initial);
const params = new URLSearchParams(location.search);
let preloadErrors = 0;
installStaleChunkRecovery();
window.addEventListener('vite:preloadError', () => { preloadErrors++; });
Object.assign(window, { deferredPopupFixture: {
  bootstrap: () => client.getQueryData(getGetPlayerBootstrapQueryKey()),
  preloadErrors: () => preloadErrors,
} });
function Fixture() {
  const [open, setOpen] = useState(params.get('growth') === 'open');
  const { data = initial } = useQuery({ queryKey: getGetPlayerBootstrapQueryKey(), queryFn: async () => initial, staleTime: Infinity });
  return <main style={{ position: 'relative', minHeight: '100dvh', background: '#121b17', padding: '25px', color: '#ffe2a3' }}>
    <button type="button" style={{ color: 'inherit' }} onPointerEnter={preloadGrowthLab} onFocus={preloadGrowthLab} onPointerDown={preloadGrowthLab} onClick={() => setOpen(true)}>Open Growth Lab</button>
    <DeferredGrowthLab bootstrap={data} open={open} onOpenChange={setOpen} />
    <JohnHenryMythic bootstrap={data} placement={params.get('john') === 'banner' ? 'banner' : 'shortcut'} />
    <StarterMythic bootstrap={data} placement="shortcut" />
  </main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><Fixture /></QueryClientProvider>);
