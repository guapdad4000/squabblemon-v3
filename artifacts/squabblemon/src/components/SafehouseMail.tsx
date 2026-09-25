import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { getAssetUrl } from '../lib/assets';
import '../styles/safehouse-mail.css';

type Letter = { id: string; title: string; body: string; sender: string; sentAt: string; readAt: string | null; claimedAt: string | null; gift: { softCurrency: number; packTickets: number; styleShards: number } };
export function useSafehouseMail(playerId: string) {
  return useQuery({ queryKey: ['player-mail', playerId], queryFn: async ({ signal }) => {
    const result = await customFetch<{ messages: Letter[] }>('/api/player/mail', { signal });
    if (!result || !Array.isArray(result.messages)) throw new Error('Mail is unavailable');
    return result;
  }, refetchInterval: 30000, refetchOnWindowFocus: true, retry: 1 });
}
export function SafehouseMail({ playerId, open, onClose }: { playerId: string; open: boolean; onClose: () => void }) {
  const query = useSafehouseMail(playerId), client = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [receipt, setReceipt] = useState('');
  const letters = query.data?.messages ?? [];
  const letter = letters.find(m => m.id === selected);
  const action = useMutation({ mutationFn: ({ id, kind }: { id: string; kind: 'read' | 'claim' }) => customFetch<{ mail: Letter; credited: boolean }>(`/api/player/mail/${encodeURIComponent(id)}/${kind}`, { method: 'POST' }),
    onSuccess: (result, variables) => {
      client.setQueryData<{ messages: Letter[] }>(['player-mail', playerId], old => old && ({ messages: old.messages.map(m => m.id === result.mail.id ? result.mail : m) }));
      if (variables.kind === 'claim') {
        setReceipt(result.credited ? 'Delivery claimed. Your gifts are in your bag.' : 'This delivery was already claimed.');
        void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      }
      void query.refetch();
    },
  });
  useEffect(() => {
    if (open) { dialog.current?.showModal(); void query.refetch(); }
    else dialog.current?.close();
  }, [open]);
  const unread = letters.filter(m => !m.readAt).length;
  return <dialog ref={dialog} className="mail-delivery" aria-labelledby="mail-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <button className="mail-close" type="button" onClick={onClose} aria-label="Close mail">×</button>
    <div className="mail-courier"><img src={getAssetUrl('assets/characters/the-mailman-delivery.png')} alt="The Mailman holding a box of letters and gifts" /><div><span>SPECIAL DELIVERY</span><h2 id="mail-title">Knock. Knock.</h2><p>Your block. Your people. Your mail.</p></div></div>
    <section className="mail-parcel" aria-label="Your deliveries">
      <header><div><span>THE SAFEHOUSE POST</span><h3>Your deliveries <small>{unread} unread</small></h3></div><button onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh</button></header>
      {query.isPending && <p role="status">Checking the box…</p>}
      {query.isError && <p role="alert">Couldn’t load your mail. Refresh to try again.</p>}
      {!query.isPending && !query.isError && !letters.length && <div className="mail-empty"><b>All quiet on the doorstep.</b><p>Updates, gifts, and special deliveries will arrive here. No codes needed.</p></div>}
      {letters.length > 0 && <div className="mail-content"><nav aria-label="Letters">{letters.map(m => <button key={m.id} aria-pressed={selected === m.id} disabled={action.isPending} onClick={() => { setSelected(m.id); setReceipt(''); action.reset(); if (!m.readAt) action.mutate({ id: m.id, kind: 'read' }); }}><span>{!m.readAt && <i aria-label="Unread" />}{m.title}</span><small>{m.sender}{Object.values(m.gift).some(n => n > 0) ? m.claimedAt ? ' · Claimed' : ' · Gift inside' : ''}</small></button>)}</nav>
      {letter ? <article><img className="mail-letter-mascot" src={getAssetUrl('assets/characters/the-mailman-chibi.png')} alt="" aria-hidden="true" /><span className="mail-from">FROM {letter.sender} · {new Date(letter.sentAt).toLocaleDateString()}</span><h4>{letter.title}</h4><p className="mail-body">{letter.body}</p>
        {Object.values(letter.gift).some(n => n > 0) && <div className="mail-gift"><strong>Inside your package</strong><ul>{letter.gift.softCurrency > 0 && <li>{letter.gift.softCurrency.toLocaleString()} Clout</li>}{letter.gift.packTickets > 0 && <li>{letter.gift.packTickets} Pack Tickets</li>}{letter.gift.styleShards > 0 && <li>{letter.gift.styleShards} Style Shards</li>}</ul><button disabled={!!letter.claimedAt || action.isPending} onClick={() => action.mutate({ id: letter.id, kind: 'claim' })}>{letter.claimedAt ? 'Gift claimed ✓' : action.isPending ? 'Saving…' : 'Claim your gift'}</button></div>}
      </article> : <article><h4>Something for you.</h4><p>Open a letter to read it and collect any gifts inside.</p></article>}</div>}
      {action.isError && <div role="alert">Couldn’t save that delivery. <button disabled={action.isPending} onClick={() => action.variables && action.mutate(action.variables)}>Retry</button></div>}
      <p role="status" className="mail-receipt">{receipt}</p>
    </section>
  </dialog>;
}
