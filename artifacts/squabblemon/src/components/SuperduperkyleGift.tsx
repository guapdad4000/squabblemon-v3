import { useMutation, useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';

type Preview = {
  player: { displayName: string; username: string; lastActiveAt: string };
  gift: { cardId: string; cardName: string; packTickets: number };
  alreadyOwnsCard: boolean;
  alreadyGranted: boolean;
};
type Result = {
  player: { displayName: string; username: string };
  gift: { cardIds?: string[]; packTickets: number };
  alreadyGranted: boolean;
};

export function SuperduperkyleGift() {
  const preview = useQuery({
    queryKey: ['admin-player-gift', 'superduperkyle-guap'],
    queryFn: () => customFetch<Preview>('/api/admin/player-gifts/superduperkyle-guap/preview'),
    retry: false,
  });
  const send = useMutation({
    mutationFn: () => customFetch<Result>('/api/admin/player-gifts/superduperkyle-guap/send', { method: 'POST' }),
    onSuccess: () => void preview.refetch(),
  });
  const data = preview.data;
  return <section className="patch-progress" aria-labelledby="player-gift-title" data-testid="panel-superduperkyle-gift">
    <h2 id="player-gift-title">One-player gift</h2>
    {preview.isPending ? <p role="status">Checking the recipient…</p> : preview.isError ? <p role="alert">Could not verify the recipient. Refresh before sending.</p> : data && <>
      <p><strong>{data.player.displayName}</strong> · @{data.player.username}</p>
      <p><strong>{data.gift.cardName} + {data.gift.packTickets} Pack Tickets</strong></p>
      <p>{data.alreadyOwnsCard ? 'GUAP is already owned; the card grant will remain single-copy.' : 'GUAP will be added to the collection.'} A Mailman receipt will confirm the delivery.</p>
      {data.alreadyGranted ? <p role="status"><strong>Delivered.</strong> The permanent grant receipt blocks duplicate tickets.</p> :
        <button className="patch-button patch-button--danger" type="button" disabled={send.isPending} onClick={() => send.mutate()} data-testid="button-send-superduperkyle-gift">{send.isPending ? 'Delivering…' : 'Send GUAP + 20 tickets'}</button>}
    </>}
    {send.isError && <p role="alert">{send.error instanceof Error ? send.error.message : 'Gift delivery failed.'}</p>}
    {send.data && !send.data.alreadyGranted && <p role="status"><strong>Delivery confirmed.</strong> GUAP and 20 Pack Tickets were added.</p>}
  </section>;
}
