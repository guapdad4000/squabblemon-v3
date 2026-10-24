import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { DailyCheckInArrival } from '../src/components/DailyCheckInArrival';
import { profileBootstrap } from './fighter-id.fixture';
import { rewardReceipts } from '../src/lib/rewardReceiptStore';
import type { AccountRewardStatus } from '@workspace/squabblemon-engine/accountRewards';
import '../src/index.css';

const params = new URLSearchParams(location.search);
const player = params.get('player') ?? 'daily-edge';
const bootstrap = profileBootstrap({ id: player, settings: { reducedMotion: true, turnTimerEnabled: false } });
bootstrap.profile.ownedCardIds = params.has('owned') ? ['buddy'] : [];
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
Object.assign(window, {
  __dailySetStatus: (status: AccountRewardStatus) => client.setQueryData(['account-rewards', player], status),
  __dailyReceipt: () => rewardReceipts.current(),
});
function Fixture() {
  const [blocker, setBlocker] = useState(params.get('blocker'));
  return <QueryClientProvider client={client}>
    <button id="home-focus">Home control</button>
    <DailyCheckInArrival bootstrap={bootstrap} />
    {blocker === 'radix' && <Dialog.Root open onOpenChange={() => setBlocker(null)}><Dialog.Portal><Dialog.Overlay /><Dialog.Content aria-describedby={undefined}><Dialog.Title>Existing invitation</Dialog.Title><Dialog.Close>Close blocker</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>}
    {blocker === 'custom' && <div role="dialog" aria-modal="true" aria-label="Existing card details"><button onClick={() => setBlocker(null)}>Close blocker</button></div>}
  </QueryClientProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
