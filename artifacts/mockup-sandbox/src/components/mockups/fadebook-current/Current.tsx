import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SocialLookup, SocialPlayer } from './_social';
import { Check, Copy, Crown, Search, Share2, ShieldOff, Swords, UserMinus, UserPlus, X } from 'lucide-react';
import { SocialProvider, useSocial } from './_social';
import { DeviceFrame } from './DeviceFrame';
import { SectionHead, SocialPlayerRow } from './SocialPlayerRow';
import { InvitationList } from './InvitationList';
import { FRIEND_CODE_PATTERN, friendLink, normalizeCode, shareOrCopy, sinceLabel, socialError } from './format';
import './_group.css';

type Flash = { text: string; bad?: boolean } | null;

function linkedFriendCode() {
  const code = normalizeCode(new URLSearchParams(window.location.search).get('friend') ?? '');
  return FRIEND_CODE_PATTERN.test(code) ? code : '';
}

function HomiesPanel({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const social = useSocial();
  const navigate = (_url: string) => {};
  const search = window.location.search;
  const { query } = social;
  const state = query.data;
  const [code, setCode] = useState(linkedFriendCode);
  const [lookup, setLookup] = useState<SocialLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [manualShare, setManualShare] = useState<string | null>(null);
  const [shared, setShared] = useState<'link' | 'code' | null>(null);
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;
  useEffect(() => { busyRef.current(!!working); }, [working]);
  useEffect(() => () => busyRef.current(false), []);

  async function runLookup(value: string, signal?: AbortSignal) {
    const target = normalizeCode(value);
    setLookupError(null); setLookup(null);
    if (!FRIEND_CODE_PATTERN.test(target)) { setLookupError('Friend codes are 12 letters and numbers, A–F and 0–9.'); return; }
    setLooking(true);
    try {
      const found = await social.lookup(target);
      if (!signal?.aborted) setLookup(found);
    } catch (reason) {
      if (!signal?.aborted) setLookupError(socialError(reason, 'No fighter answers to that code.'));
    } finally { if (!signal?.aborted) setLooking(false); }
  }
  // Shared links may fetch the identity automatically; they never send anything.
  const linked = normalizeCode(new URLSearchParams(search).get('friend') ?? '');
  const linkedCode = FRIEND_CODE_PATTERN.test(linked) ? linked : '';
  useEffect(() => {
    if (!linkedCode) return;
    setCode(linkedCode);
    const controller = new AbortController();
    void runLookup(linkedCode, controller.signal);
    return () => controller.abort();
  }, [linkedCode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(key: string, run: () => Promise<unknown>, done: string, confirmText?: string) {
    if (working || social.busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setWorking(key); setFlash(null);
    try {
      await run();
      setFlash({ text: done });
      return true;
    } catch (reason) {
      setFlash({ text: socialError(reason), bad: true });
      return false;
    } finally { setWorking(null); }
  }
  async function afterLookupAction(key: string, run: () => Promise<unknown>, done: string, confirmText?: string) {
    const ok = await act(key, run, done, confirmText);
    if (ok && lookup) {
      try { setLookup(await social.lookup(lookup.player.friendCode)); } catch { /* list already reflects it */ }
    }
  }
  function clearLookup() {
    setLookup(null); setLookupError(null); setCode('');
    if (window.location.search.includes('friend=')) history.replaceState(history.state, '', `${location.pathname}#homies`);
  }
  async function share(kind: 'link' | 'code') {
    if (!state) return;
    const text = kind === 'link' ? friendLink(state.self.friendCode) : state.self.friendCode;
    const result = await shareOrCopy(text, kind === 'link' ? 'Add me on Squabblemon' : undefined);
    if (result) { setShared(kind); setManualShare(null); window.setTimeout(() => setShared(current => current === kind ? null : current), 2400); }
    else setManualShare(text);
  }
  function onSubmit(event: FormEvent) { event.preventDefault(); void runLookup(code); }

  const incomingFor = (player: SocialPlayer) => state?.incomingRequests.find(item => item.player.friendCode === player.friendCode);
  const outgoingFor = (player: SocialPlayer) => state?.outgoingRequests.find(item => item.player.friendCode === player.friendCode);
  const disabled = !!working || social.busy;

  const body = (() => {
    if (query.isPending) return <div className="sq-skeleton" aria-busy="true" aria-label="Loading your homies">
      <i /><i /><i /><i />
    </div>;
    if (query.isError || !state) return <div className="sq-state">
      <Crown aria-hidden="true" size={34} />
      <h2>The line dropped.</h2>
      <p>Your homies list did not load. {socialError(query.error, '')}</p>
      <button type="button" className="sq-btn sq-btn--primary" data-testid="button-retry-social" onClick={() => void query.refetch()}>Try again</button>
    </div>;
    const pendingInvites = state.invitations;
    return <>
      <header className="sq-device__header">
        <span className="sq-kicker"><span className="sq-device-name" aria-hidden="true" />HOMIES{social.connected ? '' : ' · RECONNECTING'}</span>
        <h1>Your people.</h1>
        <p>Homies are mutual. Share your code, confirm theirs, then call them out for a Friendly Fade.</p>
      </header>

      <section className="sq-card sq-card--self" aria-labelledby="homies-self">
        <h2 id="homies-self" className="sq-sr">Your friend code</h2>
        <SocialPlayerRow player={state.self} testId="row-self" meta={<><span>Your friend code</span><span className="sq-code sq-code--big" data-testid="text-friend-code">{state.self.friendCode}</span></>} />
        <div className="sq-actions">
          <button type="button" className="sq-btn sq-btn--primary" data-testid="button-share-link" onClick={() => void share('link')}>
            {shared === 'link' ? <Check size={16} /> : <Share2 size={16} />}{shared === 'link' ? 'Link ready' : 'Share my friend link'}</button>
          <button type="button" className="sq-btn" data-testid="button-copy-code" onClick={() => void share('code')}>
            {shared === 'code' ? <Check size={16} /> : <Copy size={16} />}{shared === 'code' ? 'Code copied' : 'Copy code'}</button>
        </div>
        {manualShare && <label className="sq-field sq-field--manual">
          <span>Copying is blocked here. Select and send this:</span>
          <input readOnly value={manualShare} onFocus={event => event.currentTarget.select()} data-testid="input-manual-share" autoFocus />
        </label>}
      </section>

      <section className="sq-card" aria-labelledby="homies-add">
        <SectionHead title="Add a homie" note="Exact code only. You will see who it is before anything is sent." />
        <form className="sq-inline-form" onSubmit={onSubmit}>
          <label className="sq-sr" htmlFor="homie-code" id="homies-add">Friend code</label>
          <input id="homie-code" className="sq-input" value={code} autoComplete="off" spellCheck={false} inputMode="text" maxLength={14}
            placeholder="12-character code" data-testid="input-friend-code"
            onChange={event => { setCode(normalizeCode(event.target.value)); setLookupError(null); }} />
          <button className="sq-btn sq-btn--primary" disabled={looking || !code} data-testid="button-lookup">
            <Search size={16} />{looking ? 'Looking…' : 'Look up'}</button>
        </form>
        {lookupError && <p className="sq-bad" role="alert">{lookupError}</p>}
        {lookup && <div className="sq-confirm" data-testid="card-lookup" aria-live="polite">
          <ul className="sq-list"><SocialPlayerRow player={lookup.player} tone="gold" meta={<><span className="sq-code">{lookup.player.friendCode}</span><span>{{
            none: 'Is this who you meant?', incoming: 'They already asked you.', outgoing: 'Request sent. Waiting on them.',
            homie: 'Already your homie.', blocked: 'You blocked this fighter.', self: 'That is your own code.',
          }[lookup.relationship]}</span></>} /></ul>
          <div className="sq-actions">
            {lookup.relationship === 'none' && <button type="button" className="sq-btn sq-btn--primary" disabled={disabled} data-testid="button-send-request"
              onClick={() => void afterLookupAction('send', () => social.sendRequest(lookup.player.friendCode), `Request sent to ${lookup.player.displayName}.`)}>
              <UserPlus size={16} />{working === 'send' ? 'Sending…' : 'Yes, send homie request'}</button>}
            {lookup.relationship === 'incoming' && incomingFor(lookup.player) && <button type="button" className="sq-btn sq-btn--primary" disabled={disabled} data-testid="button-accept-lookup"
              onClick={() => void afterLookupAction('accept-lookup', () => social.respondRequest(incomingFor(lookup.player)!.id, 'accept'), `You and ${lookup.player.displayName} are homies.`)}>
              <Check size={16} />Accept their request</button>}
            {lookup.relationship === 'outgoing' && outgoingFor(lookup.player) && <button type="button" className="sq-btn" disabled={disabled} data-testid="button-cancel-lookup"
              onClick={() => void afterLookupAction('cancel-lookup', () => social.respondRequest(outgoingFor(lookup.player)!.id, 'cancel'), 'Request cancelled.')}>Cancel request</button>}
            {lookup.relationship === 'homie' && <button type="button" className="sq-btn sq-btn--primary" data-testid="button-invite-lookup"
              onClick={() => navigate(`/game/online?tab=friends&homie=${lookup.player.friendCode}`)}><Swords size={16} />Invite to Friendly Fade</button>}
            {lookup.relationship === 'blocked' && <button type="button" className="sq-btn" disabled={disabled} data-testid="button-unblock-lookup"
              onClick={() => void afterLookupAction('unblock-lookup', () => social.unblock(lookup.player.friendCode), 'Unblocked. Send a new request if you want them back.')}>Unblock</button>}
            {lookup.relationship !== 'self' && lookup.relationship !== 'blocked' && lookup.relationship !== 'homie' && <button type="button" className="sq-btn sq-btn--ghost" disabled={disabled} data-testid="button-block-lookup"
              onClick={() => void afterLookupAction('block-lookup', () => social.block(lookup.player.friendCode), `${lookup.player.displayName} is blocked.`, `Block ${lookup.player.displayName}? They will not be able to send you requests or fade invites.`)}>Block</button>}
            <button type="button" className="sq-btn sq-btn--ghost" data-testid="button-clear-lookup" onClick={clearLookup}><X size={16} />Not them</button>
          </div>
        </div>}
      </section>

      {flash && <p className={`sq-flash ${flash.bad ? 'sq-flash--bad' : ''}`} role={flash.bad ? 'alert' : 'status'} data-testid="status-homies">{flash.text}</p>}

      <section className="sq-section" aria-label="Incoming requests">
        <SectionHead title="Asking for you" count={state.incomingRequests.length} />
        {state.incomingRequests.length ? <ul className="sq-list" data-testid="list-incoming">
          {state.incomingRequests.map(request => <SocialPlayerRow key={request.id} player={request.player} tone="gold" testId={`row-incoming-${request.id}`}
            meta={<><span className="sq-code">{request.player.friendCode}</span><span>{sinceLabel(request.createdAt)}</span></>}>
            <button type="button" className="sq-btn sq-btn--primary" disabled={disabled} data-testid={`button-accept-${request.id}`}
              onClick={() => void act(`accept-${request.id}`, () => social.respondRequest(request.id, 'accept'), `You and ${request.player.displayName} are homies.`)}>
              {working === `accept-${request.id}` ? 'Accepting…' : 'Accept'}</button>
            <button type="button" className="sq-btn" disabled={disabled} data-testid={`button-decline-${request.id}`}
              onClick={() => void act(`decline-${request.id}`, () => social.respondRequest(request.id, 'decline'), 'Request declined.')}>
              {working === `decline-${request.id}` ? 'Declining…' : 'Decline'}</button>
          </SocialPlayerRow>)}
        </ul> : <p className="sq-empty">Nobody knocking right now.</p>}
      </section>

      <section className="sq-section" aria-label="Fade invitations">
        <SectionHead title="Fade invites" count={state.counts.invitations} />
        <InvitationList invitations={pendingInvites} emptyText="No fade invites on the line."
          onBusyChange={busy => onBusyChange(busy || !!working)}
          onView={invitation => navigate(`/game/online?tab=friends&invite=${invitation.id}`)}
          onOpenRoom={invitation => navigate(`/game/online/${invitation.roomCode}`)} />
      </section>

      <section className="sq-section" aria-label="Homies">
        <SectionHead title="Homies" count={state.homies.length} />
        {state.homies.length ? <ul className="sq-list" data-testid="list-homies">
          {state.homies.map(player => <SocialPlayerRow key={player.friendCode} player={player} testId={`row-homie-${player.friendCode}`}>
            <button type="button" className="sq-btn sq-btn--primary" data-testid={`button-invite-${player.friendCode}`}
              onClick={() => navigate(`/game/online?tab=friends&homie=${player.friendCode}`)}><Swords size={16} />Invite to Friendly Fade</button>
            <button type="button" className="sq-btn sq-btn--ghost" disabled={disabled} aria-label={`Remove ${player.displayName}`} data-testid={`button-remove-${player.friendCode}`}
              onClick={() => void act(`remove-${player.friendCode}`, () => social.remove(player.friendCode), `${player.displayName} removed.`, `Remove ${player.displayName} from your homies? Open fade invites between you will be called off.`)}>
              <UserMinus size={16} />Remove</button>
            <button type="button" className="sq-btn sq-btn--ghost" disabled={disabled} aria-label={`Block ${player.displayName}`} data-testid={`button-block-${player.friendCode}`}
              onClick={() => void act(`block-${player.friendCode}`, () => social.block(player.friendCode), `${player.displayName} blocked.`, `Block ${player.displayName}? This removes them as a homie and stops their requests and invites.`)}>
              <ShieldOff size={16} />Block</button>
          </SocialPlayerRow>)}
        </ul> : <div className="sq-state sq-state--inline">
          <Crown aria-hidden="true" size={30} />
          <h3>No homies yet.</h3>
          <p>Send your friend link to whoever talks the most trash. Once they confirm, they show up here.</p>
          <button type="button" className="sq-btn sq-btn--primary" onClick={() => void share('link')}><Share2 size={16} />Share my friend link</button>
        </div>}
      </section>

      <section className="sq-section" aria-label="Sent requests">
        <SectionHead title="Sent" count={state.outgoingRequests.length} />
        {state.outgoingRequests.length ? <ul className="sq-list" data-testid="list-outgoing">
          {state.outgoingRequests.map(request => <SocialPlayerRow key={request.id} player={request.player} tone="leaf" testId={`row-outgoing-${request.id}`}
            meta={<><span className="sq-code">{request.player.friendCode}</span><span>sent {sinceLabel(request.createdAt)}</span></>}>
            <button type="button" className="sq-btn" disabled={disabled} data-testid={`button-cancel-${request.id}`}
              onClick={() => void act(`cancel-${request.id}`, () => social.respondRequest(request.id, 'cancel'), 'Request cancelled.')}>
              {working === `cancel-${request.id}` ? 'Cancelling…' : 'Cancel'}</button>
          </SocialPlayerRow>)}
        </ul> : <p className="sq-empty">No requests waiting on anyone.</p>}
      </section>

      <section className="sq-section" aria-label="Blocked players">
        <SectionHead title="Blocked" count={state.blocked.length} note="Unblocking does not bring back a friendship." />
        {state.blocked.length ? <ul className="sq-list" data-testid="list-blocked">
          {state.blocked.map(player => <SocialPlayerRow key={player.friendCode} player={player} tone="rust" testId={`row-blocked-${player.friendCode}`}>
            <button type="button" className="sq-btn" disabled={disabled} data-testid={`button-unblock-${player.friendCode}`}
              onClick={() => void act(`unblock-${player.friendCode}`, () => social.unblock(player.friendCode), `${player.displayName} unblocked.`, `Unblock ${player.displayName}? They will be able to send requests again.`)}>
              {working === `unblock-${player.friendCode}` ? 'Unblocking…' : 'Unblock'}</button>
          </SocialPlayerRow>)}
        </ul> : <p className="sq-empty">Nobody blocked.</p>}
      </section>
    </>;
  })();

  return <DeviceFrame label="Homies" testId="homies-device">{body}</DeviceFrame>;
}

export function Current() {
  return <main className="fadebook-current"><SocialProvider><HomiesPanel onBusyChange={() => {}} /></SocialProvider></main>;
}
