import { useEffect, useState } from 'react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import type { CollectionNotice } from './notificationCatalog';

type Profile = Pick<PlayerBootstrap['profile'], 'ownedCardIds' | 'unlockedCosmeticIds' | 'ownedVariants'>;
type Catalog = { collectionNotifications: (profile: Profile) => CollectionNotice[] };
const loadCatalog = () => import('./notificationCatalog');

/** Keep public catalog parsing off the shell's blocking import path. */
export function useCollectionNotices(profile: Profile, load: () => Promise<Catalog> = loadCatalog) {
  const { ownedCardIds, unlockedCosmeticIds, ownedVariants } = profile;
  const [result, setResult] = useState<{ keys: Profile; notices: CollectionNotice[] }>();
  useEffect(() => {
    let active = true, inFlight = false, failed = false;
    const keys = { ownedCardIds, unlockedCosmeticIds, ownedVariants };
    const read = () => {
      if (!active || inFlight) return;
      inFlight = true;
      void load().then(catalog => {
        if (active) setResult({ keys, notices: catalog.collectionNotifications(keys) });
        failed = false;
      }).catch(() => { failed = true; }).finally(() => { inFlight = false; });
    };
    const retry = () => { if (failed) read(); };
    read();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', retry);
      window.addEventListener('focus', retry);
    }
    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', retry);
        window.removeEventListener('focus', retry);
      }
    };
  }, [ownedCardIds, unlockedCosmeticIds, ownedVariants, load]);
  return result && result.keys.ownedCardIds === ownedCardIds
    && result.keys.unlockedCosmeticIds === unlockedCosmeticIds && result.keys.ownedVariants === ownedVariants ? result.notices : [];
}
