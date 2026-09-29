import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SocialLookup, SocialPlayer, SocialState } from '@workspace/api-client-react';
import { Check, Clock, Search, ShieldOff, Swords, UserPlus, X } from 'lucide-react';
import { useSocial } from '../../lib/social';
import { SocialPlayerRow } from './SocialPlayerRow';
import { FRIEND_CODE_PATTERN, normalizeCode, normalizeHandle, socialError } from './format';

type Rel = { relationship: SocialLookup['relationship']; requestId: string | null };
type LookupSnapshot<T> = { value: T; state: SocialState; updatedAt: number };

/** Current refreshed state wins over stale search answers. */
export function relationFor(state: SocialState, player: SocialPlayer): Rel {
  const code = player.friendCode;
  if (state.self.friendCode === code) return { relationship: 'self', requestId: null };
  if (state.blocked.some(p => p.friendCode === code)) return { relationship: 'blocked', requestId: null };
  if (state.homies.some(p => p.friendCode === code)) return { relationship: 'homie', requestId: null };
  const inc = state.incomingRequests.find(r => r.player.friendCode === code);
  if (inc) return { relationship: 'incoming', requestId: inc.id };
  const out = state.outgoingRequests.find(r => r.player.friendCode === code);
  if (out) return { relationship: 'outgoing', requestId: out.id };
  return { relationship: 'none', requestId: null };
}

type Act = (key: string, run: () => Promise<unknown>, done: string, confirmText?: string) => Promise<boolean | undefined>;

export function FadebookFind({ state, act, working, disabled, onInvite, linkedCode }: {
  state: SocialState; act: Act; working: string | null; disabled: boolean; onInvite: (p: SocialPlayer) => void; linkedCode: string;
}) {
  const social = useSocial();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<(LookupSnapshot<SocialLookup[]> & { query: string }) | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<LookupSnapshot<SocialLookup> | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkRetry, setLinkRetry] = useState(0);
  const searchRef = useRef(social.search); searchRef.current = social.search;
  const lookupRef = useRef(social.lookup); lookupRef.current = social.lookup;
  const stateRef = useRef({ state, updatedAt: social.query.dataUpdatedAt });
  stateRef.current = { state, updatedAt: social.query.dataUpdatedAt };
  const [submitted, setSubmitted] = useState(0);
  const immediateQuery = useRef<string | null>(null);

  const q = normalizeHandle(term);
  const validQuery = q.length >= 3 && q.length <= 24;
  useEffect(() => {
    if (q.length < 3 || q.length > 24) { setResults(null); setSearching(false); setError(null); return; }
    const controller = new AbortController();
    const delay = immediateQuery.current === q ? 0 : 380;
    immediateQuery.current = null;
    setResults(null); setSearching(false); setError(null);
    const timer = window.setTimeout(() => {
      const lookupState = stateRef.current;
      setSearching(true); setError(null);
      searchRef.current(q, controller.signal).then(found => {
        if (!controller.signal.aborted) setResults({ value: found.players, query: q, ...lookupState });
      })
        .catch(reason => { if (!controller.signal.aborted) setError(socialError(reason, 'Search did not go through. Try again.')); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, delay);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [q, submitted]);

  // Shared links resolve for confirmation only. Nothing is ever sent automatically.
  useEffect(() => {
    setLinked(null); setLinkError(null); setLinkLoading(false);
    if (!linkedCode) return;
    const controller = new AbortController();
    const lookupState = stateRef.current;
    setLinkLoading(true);
    lookupRef.current(linkedCode, controller.signal).then(found => {
      if (!controller.signal.aborted) setLinked({ value: found, ...lookupState });
    })
      .catch(reason => { if (!controller.signal.aborted) setLinkError(socialError(reason, 'That Fadebook link does not match a fighter.')); })
      .finally(() => { if (!controller.signal.aborted) setLinkLoading(false); });
    return () => controller.abort();
  }, [linkedCode, linkRetry]);

  function clearLinked() {
    setLinked(null); setLinkError(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('friend');
    history.replaceState(history.state, '', `${url.pathname}${url.search}#homies`);
  }
  function requestSearch() { immediateQuery.current = q; setSubmitted(n => n + 1); }
  function submit(event: FormEvent) { event.preventDefault(); if (validQuery && !searching) requestSearch(); }

  const card = (found: SocialLookup, keyPrefix: string, snapshot: LookupSnapshot<unknown>) => {
    const p = found.player; const code = p.friendCode;
    // A new lookup can know about a request before the menu's cached state does.
    // Only a subsequent menu response/mutation should replace that answer.
    const rel: Rel = snapshot.state === state && snapshot.updatedAt === social.query.dataUpdatedAt
      ? { relationship: found.relationship, requestId: found.requestId }
      : relationFor(state, p);
    const status = { none: 'Not connected', incoming: 'Wants to be your homie', outgoing: 'Request sent', homie: 'Homies', blocked: 'Blocked', self: 'This is you' }[rel.relationship];
    return <SocialPlayerRow key={`${keyPrefix}-${code}`} player={p} tone={rel.relationship === 'incoming' ? 'gold' : rel.relationship === 'blocked' ? 'rust' : rel.relationship === 'homie' ? 'leaf' : undefined}
      testId={`row-found-${p.username}`} meta={<span className="fb-status" data-rel={rel.relationship}>{status}</span>}>
      {rel.relationship === 'none' && <button type="button" className="sq-btn sq-btn--primary" disabled={disabled} data-testid={`button-add-${p.username}`}
        onClick={() => void act(`send-${code}`, () => social.sendRequest(code), `Request sent to ${p.displayName}.`)}>
        <UserPlus size={16} />{working === `send-${code}` ? 'Sending…' : 'Add Homie'}</button>}
      {rel.relationship === 'outgoing' && <>
        <span className="fb-tag"><Clock size={14} aria-hidden="true" />Request sent</span>
        <button type="button" className="sq-btn sq-btn--ghost" disabled={disabled} data-testid={`button-cancel-found-${p.username}`}
          onClick={() => void act(`cancel-${code}`, () => social.respondRequest(rel.requestId!, 'cancel'), 'Request cancelled.')}>Cancel</button></>}
      {rel.relationship === 'incoming' && <button type="button" className="sq-btn sq-btn--primary" disabled={disabled} data-testid={`button-accept-found-${p.username}`}
        onClick={() => void act(`accept-${code}`, () => social.respondRequest(rel.requestId!, 'accept'), `You and ${p.displayName} are homies.`)}>
        <Check size={16} />Accept request</button>}
      {rel.relationship === 'homie' && <>
        <span className="fb-tag fb-tag--leaf"><Check size={14} aria-hidden="true" />Homies</span>
        <button type="button" className="sq-btn" onClick={() => onInvite(p)} data-testid={`button-invite-found-${p.username}`}><Swords size={16} />Invite</button></>}
      {rel.relationship === 'blocked' && <button type="button" className="sq-btn" disabled={disabled} data-testid={`button-unblock-found-${p.username}`}
        onClick={() => void act(`unblock-${code}`, () => social.unblock(code), `${p.displayName} unblocked. Send a new request if you want them back.`, `Unblock ${p.displayName}? They will be able to send requests again.`)}>Unblock</button>}
      {(rel.relationship === 'none' || rel.relationship === 'incoming' || rel.relationship === 'outgoing') && <button type="button" className="sq-btn sq-btn--ghost" disabled={disabled}
        aria-label={`Block ${p.displayName}`} data-testid={`button-block-found-${p.username}`}
        onClick={() => void act(`block-${code}`, () => social.block(code), `${p.displayName} blocked.`, `Block ${p.displayName}? They will not be able to send you requests or fade invites.`)}><ShieldOff size={16} /></button>}
    </SocialPlayerRow>;
  };

  return <div className="fb-find">
    {(linked || linkError || linkLoading) && <section className="fb-box fb-box--gold" aria-label="Shared Fadebook link" data-testid="card-lookup">
      <header className="fb-box__head"><h2>Someone shared their page</h2>
        <button type="button" className="sq-btn sq-btn--ghost" onClick={clearLinked} data-testid="button-clear-lookup"><X size={16} />Dismiss</button></header>
      {linkLoading ? <p className="fb-note" role="status">Checking this fighter…</p>
        : linkError ? <p className="fb-err" role="alert">{linkError} <button type="button" className="fb-chip" onClick={() => setLinkRetry(n => n + 1)}>Retry</button></p>
        : linked && <><p className="fb-note">Check who it is first. Nothing is sent until you tap.</p><ul className="sq-list">{card(linked.value, 'link', linked)}</ul></>}
    </section>}

    <section className="fb-box" aria-labelledby="fb-find-title">
      <header className="fb-box__head"><h2 id="fb-find-title">Find players</h2></header>
      <form className="fb-search" onSubmit={submit} role="search">
        <label htmlFor="fb-search-input" className="sq-sr">Search by player name or @username</label>
        <span className="fb-input-wrap"><Search size={16} aria-hidden="true" />
          <input id="fb-search-input" className="fb-input" type="search" value={term} autoComplete="off" spellCheck={false} maxLength={25}
            placeholder="Player name or @username" aria-describedby="fb-search-help" onChange={e => setTerm(e.target.value)} data-testid="input-search" /></span>
        <button className="sq-btn sq-btn--primary" disabled={!validQuery || searching} data-testid="button-search">{searching ? 'Searching…' : 'Search'}</button>
      </form>
      <small id="fb-search-help" className="fb-note">Type 3–24 characters of a player name or @username. Matches start with what you type.</small>
      <div aria-live="polite" aria-busy={searching}>
        {q.length > 24 && <p className="fb-err" role="alert">Searches can be up to 24 characters, not counting @.</p>}
        {error && <div className="fb-err" role="alert">{error} <button type="button" className="fb-chip" onClick={requestSearch}>Retry</button></div>}
        {searching && !results && <div className="sq-skeleton" aria-label="Searching"><i /><i /></div>}
        {results?.query === q && !results.value.length && !error && <p className="fb-empty-line">No players found for “{term.trim()}”. Try another player name or @username.</p>}
        {results?.query === q && !!results.value.length && <ul className="sq-list" data-testid="list-search">{results.value.map(r => card(r, 'res', results))}</ul>}
      </div>
    </section>
  </div>;
}

export function linkedFriendCode(search: string) {
  const code = normalizeCode(new URLSearchParams(search).get('friend') ?? '');
  return FRIEND_CODE_PATTERN.test(code) ? code : '';
}
