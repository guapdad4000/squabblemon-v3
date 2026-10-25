import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { menuRefreshAllowed, useMenuRefreshAllowed } from './menuRefresh';
import { useSafehouseMail } from './safehouseMail';
export type Daily = { date: string; available: boolean; amount: number; attemptsRemaining: number; resetsAt: string };
export function useDailyClout(playerId: string) {
  const enabled = useMenuRefreshAllowed();
  return useQuery({ enabled, queryKey: ['daily-clout', playerId], queryFn: () => customFetch<Daily>('/api/player/shop/daily-clout'), refetchInterval: 60000, refetchOnWindowFocus: true, retry: 1 });
}
/** Own the shell's optional reads; mutations and notification receipts have separate authority. */
export function useNotificationBackground(playerId: string) {
  const menuActive = useMenuRefreshAllowed(), client = useQueryClient();
  const mail = useSafehouseMail(playerId), daily = useDailyClout(playerId);
  const account = useQuery({ enabled: menuActive, queryKey: ['account-rewards', playerId], queryFn: () => customFetch<{ date: string; pending: { key: string; title: string }[]; growth: { ready: boolean } }>('/api/player/rewards/account'), refetchInterval: 30000, retry: 1 });
  const johnHenry = useQuery({ enabled: menuActive, queryKey: ['john-henry-mythic', playerId], queryFn: () => customFetch<{ state: string }>('/api/player/rewards/john-henry'), refetchInterval: 60000, retry: 1 });
  const mythic = useQuery({ enabled: menuActive, queryKey: ['starter-mythic', playerId], queryFn: () => customFetch<{ state: string }>('/api/player/rewards/starter-mythic'), refetchInterval: 60000, retry: 1 });
  const refreshWasPaused = useRef(!menuActive);
  useEffect(() => {
    if (!menuActive) { refreshWasPaused.current = true; return; }
    if (refreshWasPaused.current) {
      refreshWasPaused.current = false;
      void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
    }
    const timer = setInterval(() => { if (!menuRefreshAllowed()) return; void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() }); }, 60000);
    return () => clearInterval(timer);
  }, [client, menuActive]);
  return { mail, daily, account, johnHenry, mythic };
}
