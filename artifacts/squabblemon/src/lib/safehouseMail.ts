import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';

export type Letter = { id: string; title: string; body: string; sender: string; sentAt: string; readAt: string | null; claimedAt: string | null; gift: { softCurrency: number; packTickets: number; styleShards: number } };
export function useSafehouseMail(playerId: string) {
  return useQuery({ queryKey: ['player-mail', playerId], queryFn: async ({ signal }) => {
    const result = await customFetch<{ messages: Letter[] }>('/api/player/mail', { signal });
    if (!result || !Array.isArray(result.messages)) throw new Error('Mail is unavailable');
    return result;
  }, refetchInterval: 30000, refetchOnWindowFocus: true, retry: 1 });
}
