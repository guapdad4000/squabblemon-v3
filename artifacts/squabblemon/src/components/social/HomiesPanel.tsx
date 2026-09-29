import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useLocation, useSearch } from 'wouter';
import type { SocialPlayer } from '@workspace/api-client-react';
import { RotateCw, ShieldOff, Swords, UserMinus, UserPlus } from 'lucide-react';
import { useSocial } from '../../lib/social';
import { FighterPortrait } from '../profile/FighterPortrait';
import { Presence, SectionHead, SocialPlayerRow } from './SocialPlayerRow';
import { InvitationList } from './InvitationList';
import { FadebookMasthead, FadebookProfile } from './FadebookProfile';
import { FadebookFind, linkedFriendCode } from './FadebookFind';
import { sinceLabel, socialError } from './format';
import '../../styles/fadebook.css';

type Flash = { text: string; bad?: boolean } | null;
const SECTIONS = ['Homies', 'Requests', 'Find Players'] as const;
type Section = typeof SECTIONS[number];

export function HomiesPanel({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const social = useSocial();
  const [, navigate] = useLocation();
  const linkedCode = linkedFriendCode(useSearch());
  const { query } = social;
  const state = query.data;
  const [section, setSection] = useState<Section>(linkedCode ? 'Find Players' : 'Homies');
  const [working, setWorking] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const busyRef = useRef(onBusyChange);
  busyRef.current = onBusyChange;
  useEffect(() => { busyRef.current(!!working || social.busy); }, [working, social.busy]);
  useEffect(() => () => busyRef.current(false), []);
  useEffect(() => { if (linkedCode) setSection('Find Players'); }, [linkedCode]);

  async function act(key: string, run: () => Promise<unknown>, done: string, confirmText?: string) {
    if (working || social.busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setWorking(key); setFlash(null);
    try { await run(); setFlash({ text: done }); return true; }
    catch (reason) { setFlash({ text: socialError(reason), bad: true }); return false; }
    finally { setWorking(null); }
  }
  const invite = (p: SocialPlayer) => navigate(`/game/online?tab=friends&homie=${p.friendCode}`);
  const disabled = !!working || social.busy;

  if (query.isPending && navigator.onLine) return <div className="fb"><FadebookMasthead connected={social.connected} />
    <div className="fb-skel" aria-busy="true" aria-label="Loading your Fadebook"><i className="fb-skel__banner" /><i /><i /><i /></div></div>;
  if (query.isError || !state) return <div className="fb"><FadebookMasthead connected={social.connected} />
    <div className="fb-box fb-state" role="alert">
      <h2>The page did not load.</h2>
      <p>{navigator.onLine ? socialError(query.error, 'Your homies list did not come through.') : 'You are offline. Reconnect, then try again.'}</p>
      <button type="button" className="sq-btn sq-btn--primary" data-testid="button-retry-social" onClick={() => void query.refetch()}><RotateCw size={16} />Try again</button>
    </div></div>;

  const requestCount = state.incomingRequests.length + state.counts.invitations;
  const counts: Record<Section, number> = { Homies: state.homies.length, Requests: requestCount, 'Find Players': 0 };
  function tabKey(event: KeyboardEvent, index: number) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (disabled) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? SECTIONS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : SECTIONS.length - 1)) % SECTIONS.length;
    setSection(SECTIONS[next]); tabRefs.current[next]?.focus();
  }

  return <div className="fb" data-testid="homies-fadebook">
    <FadebookMasthead connected={social.connected} />
    <div className="fb-layout">
      <aside className="fb-side">
        <FadebookProfile state={state} homieCount={state.homies.length} />
        <nav className="fb-nav" role="tablist" aria-label="Fadebook sections">
          {SECTIONS.map((name, i) => <button key={name} type="button" role="tab" id={`fb-tab-${i}`} aria-controls="fb-section" aria-selected={section === name}
            tabIndex={section === name ? 0 : -1} disabled={disabled} ref={el => { tabRefs.current[i] = el; }} className="fb-nav__tab"
            onKeyDown={e => tabKey(e, i)} onClick={() => setSection(name)} data-testid={`tab-fb-${name.split(' ')[0].toLowerCase()}`}>
            {name}{counts[name] > 0 && <span className={name === 'Requests' ? 'fb-badge fb-badge--hot' : 'fb-badge'} aria-label={`${counts[name]} ${name === 'Requests' ? 'pending' : 'total'}`}>{counts[name]}</span>}
          </button>)}
        </nav>
      </aside>

      <section className="fb-main" id="fb-section" role="tabpanel" aria-labelledby={`fb-tab-${SECTIONS.indexOf(section)}`}>
        {flash && <p className={`fb-flash${flash.bad ? ' fb-flash--bad' : ''}`} role={flash.bad ? 'alert' : 'status'} data-testid="status-homies">{flash.text}</p>}

        {section === 'Homies' && <>
          <div className="fb-box">
            <header className="fb-box__head"><h2>{state.self.displayName}'s Homies <span className="fb-box__sub">{state.homies.length}</span></h2></header>
            {state.homies.length ? <ul className="fb-grid" data-testid="list-homies">
              {state.homies.map((p, i) => <li key={p.friendCode} className="fb-tile" data-testid={`row-homie-${p.username}`} style={{ '--tilt': `${(i % 3 - 1) * 0.8}deg` } as CSSProperties}>
                <span className="fb-tile__art"><FighterPortrait avatarKey={p.avatarKey} name={p.displayName} decorative />{i < 8 && <b className="fb-tile__rank" aria-hidden="true">{i + 1}</b>}</span>
                <strong className="fb-tile__name">{p.displayName}</strong>
                <span className="fb-handle">@{p.username}</span>
                <Presence player={p} />
                <span className="fb-tile__actions">
                  <button type="button" className="sq-btn sq-btn--primary" onClick={() => invite(p)} aria-label={`Invite ${p.displayName} to a Friendly Fade`} data-testid={`button-invite-${p.username}`}><Swords size={15} />Fade</button>
                  <button type="button" className="sq-btn sq-btn--ghost" disabled={disabled} aria-label={`Remove ${p.displayName}`} data-testid={`button-remove-${p.username}`}
                    onClick={() => void act(`remove-${p.friendCode}`, () => social.remove(p.friendCode), `${p.displayName} removed.`, `Remove ${p.displayName} from your homies? Open fade invites between you will be called off.`)}><UserMinus size={15} /></button>
                  <button type="button" className="sq-btn sq-btn--ghost" disabled={disabled} aria-label={`Block ${p.displayName}`} data-testid={`button-block-${p.username}`}
                    onClick={() => void act(`block-${p.friendCode}`, () => social.block(p.friendCode), `${p.displayName} blocked.`, `Block ${p.displayName}? This removes them as a homie and stops their requests and invites.`)}><ShieldOff size={15} /></button>
                </span>
              </li>)}
            </ul> : <div className="fb-state fb-state--empty">
              <h3>Your page is quiet.</h3>
              <p>Look up whoever talks the most trash by username, or send them your Fadebook link.</p>
              <button type="button" className="sq-btn sq-btn--primary" onClick={() => setSection('Find Players')} data-testid="button-go-find"><UserPlus size={16} />Find players</button>
            </div>}
          </div>
          <div className="fb-box fb-box--muted">
            <SectionHead title="Blocked" count={state.blocked.length} note="Unblocking does not bring back a friendship." />
            {state.blocked.length ? <ul className="sq-list" data-testid="list-blocked">
              {state.blocked.map(p => <SocialPlayerRow key={p.friendCode} player={p} tone="rust" testId={`row-blocked-${p.username}`}>
                <button type="button" className="sq-btn" disabled={disabled} data-testid={`button-unblock-${p.username}`}
                  onClick={() => void act(`unblock-${p.friendCode}`, () => social.unblock(p.friendCode), `${p.displayName} unblocked.`, `Unblock ${p.displayName}? They will be able to send requests again.`)}>
                  {working === `unblock-${p.friendCode}` ? 'Unblocking…' : 'Unblock'}</button>
              </SocialPlayerRow>)}
            </ul> : <p className="fb-empty-line">Nobody blocked.</p>}
          </div>
        </>}

        {section === 'Requests' && <>
          <div className="fb-box fb-box--gold">
            <SectionHead title="Asking for you" count={state.incomingRequests.length} />
            {state.incomingRequests.length ? <ul className="sq-list" data-testid="list-incoming">
              {state.incomingRequests.map(r => <SocialPlayerRow key={r.id} player={r.player} tone="gold" testId={`row-incoming-${r.id}`}
                meta={<><span className="fb-status" data-rel="incoming">Wants to be your homie</span><span>{sinceLabel(r.createdAt)}</span></>}>
                <button type="button" className="sq-btn sq-btn--primary" disabled={disabled} data-testid={`button-accept-${r.id}`}
                  onClick={() => void act(`accept-${r.id}`, () => social.respondRequest(r.id, 'accept'), `You and ${r.player.displayName} are homies.`)}>
                  {working === `accept-${r.id}` ? 'Accepting…' : 'Accept'}</button>
                <button type="button" className="sq-btn" disabled={disabled} data-testid={`button-decline-${r.id}`}
                  onClick={() => void act(`decline-${r.id}`, () => social.respondRequest(r.id, 'decline'), 'Request declined.')}>
                  {working === `decline-${r.id}` ? 'Declining…' : 'Decline'}</button>
              </SocialPlayerRow>)}
            </ul> : <p className="fb-empty-line">Nobody knocking right now.</p>}
          </div>
          <div className="fb-box">
            <SectionHead title="Fade invites" count={state.counts.invitations} />
            <InvitationList invitations={state.invitations} emptyText="No fade invites on the line."
              onBusyChange={busy => onBusyChange(busy || !!working)}
              onView={i => navigate(`/game/online?tab=friends&invite=${i.id}`)}
              onOpenRoom={i => navigate(`/game/online/${i.roomCode}`)} />
          </div>
          <div className="fb-box">
            <SectionHead title="Sent" count={state.outgoingRequests.length} />
            {state.outgoingRequests.length ? <ul className="sq-list" data-testid="list-outgoing">
              {state.outgoingRequests.map(r => <SocialPlayerRow key={r.id} player={r.player} tone="leaf" testId={`row-outgoing-${r.id}`}
                meta={<><span className="fb-status" data-rel="outgoing">Request sent</span><span>{sinceLabel(r.createdAt)}</span></>}>
                <button type="button" className="sq-btn" disabled={disabled} data-testid={`button-cancel-${r.id}`}
                  onClick={() => void act(`cancel-${r.id}`, () => social.respondRequest(r.id, 'cancel'), 'Request cancelled.')}>
                  {working === `cancel-${r.id}` ? 'Cancelling…' : 'Cancel request'}</button>
              </SocialPlayerRow>)}
            </ul> : <p className="fb-empty-line">No requests waiting on anyone.</p>}
          </div>
        </>}

        {section === 'Find Players' && <FadebookFind state={state} act={act} working={working} disabled={disabled} onInvite={invite} linkedCode={linkedCode} />}
      </section>
    </div>
  </div>;
}
