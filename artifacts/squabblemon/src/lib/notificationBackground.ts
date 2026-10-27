import { useDojoReminder } from './dojoReminder';
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { MENU_POLL_MS, menuRefreshAllowed, useMenuRefreshAllowed } from './menuRefresh';
import { useSafehouseMail } from './safehouseMail';
export type Daily = { date: string; available: boolean; amount: number; attemptsRemaining: number; resetsAt: string };
export function useDailyClout(playerId: string) {
  const enabled = useMenuRefreshAllowed();
  return useQuery({ enabled, queryKey: ['daily-clout', playerId], queryFn: () => customFetch<Daily>('/api/player/shop/daily-clout'), refetchInterval: 60000, refetchOnWindowFocus: true, retry: 1 });
}
/** Visible-menu safety refresh for bootstrap-derived notices (missions, bag balances). */
export const BOOTSTRAP_BACKGROUND_REFRESH_MS = 5 * 60_000;
/** Returning from battle or a hidden tab refetches only a bootstrap older than this. */
export const BOOTSTRAP_RESUME_REFRESH_MS = 60_000;
/** Own the shell's optional reads; mutations and notification receipts have separate authority. */
export function useNotificationBackground(playerId: string) {
  const menuActive = useMenuRefreshAllowed(), client = useQueryClient();
  const mail = useSafehouseMail(playerId), daily = useDailyClout(playerId), dojo = useDojoReminder(playerId);
  const account = useQuery({ enabled: menuActive, queryKey: ['account-rewards', playerId], queryFn: () => customFetch<{ date: string; pending: { key: string; title: string }[]; growth: { ready: boolean } }>('/api/player/rewards/account'), refetchInterval: MENU_POLL_MS, retry: 1 });
  const johnHenry = useQuery({ enabled: menuActive, queryKey: ['john-henry-mythic', playerId], queryFn: () => customFetch<{ state: string }>('/api/player/rewards/john-henry'), refetchInterval: 60000, retry: 1 });
  const mythic = useQuery({ enabled: menuActive, queryKey: ['starter-mythic', playerId], queryFn: () => customFetch<{ state: string }>('/api/player/rewards/starter-mythic'), refetchInterval: 60000, retry: 1 });
  const refreshWasPaused = useRef(!menuActive);
  useEffect(() => {
    // Bootstrap remains the only source for mission and bag-balance notices, but
    // mail/daily/account/mythic notices poll their own narrow endpoints above and
    // every reward mutation invalidates bootstrap itself. This is a slow safety
    // net for out-of-band changes (another device, server grants), so it only
    // refetches a visible menu whose bootstrap is older than the refresh window.
    const refreshIfOlderThan = (ageMs: number) => {
      if (!menuRefreshAllowed()) return;
      const updatedAt = client.getQueryState(getGetPlayerBootstrapQueryKey())?.dataUpdatedAt ?? 0;
      if (Date.now() - updatedAt < ageMs) return;
      void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
    };
    if (!menuActive) { refreshWasPaused.current = true; return; }
    if (refreshWasPaused.current) {
      refreshWasPaused.current = false;
      refreshIfOlderThan(BOOTSTRAP_RESUME_REFRESH_MS);
    }
    const timer = setInterval(() => refreshIfOlderThan(BOOTSTRAP_BACKGROUND_REFRESH_MS - 1000), BOOTSTRAP_BACKGROUND_REFRESH_MS);
    return () => clearInterval(timer);
  }, [client, menuActive]);
  return { mail, daily, account, johnHenry, mythic, dojo };
}
