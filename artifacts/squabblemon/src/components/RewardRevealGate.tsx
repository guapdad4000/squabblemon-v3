import { lazy, Suspense, useSyncExternalStore } from 'react';
import { rewardReceipts } from '../lib/rewardReceipts';

const LazyRewardReveal = lazy(() => import('./RewardReveal').then(({ RewardReveal }) => ({ default: RewardReveal })));

export function RewardRevealGate() {
  const receipt = useSyncExternalStore(rewardReceipts.subscribe, rewardReceipts.current, () => null);
  if (!receipt) return null;
  return <Suspense fallback={null}><LazyRewardReveal /></Suspense>;
}