import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import type { SocialInvitation } from '@workspace/api-client-react';
import { ArrowUpRight, Check, KeyRound, Send, Swords, UserPlus } from 'lucide-react';
import { useSocial } from '../../lib/social';
import { listFriendMatches } from '../../lib/multiplayer';
import { CompactDeckPicker, type PickerDeck } from '../CompactDeckPicker';
import { SectionHead, SocialPlayerRow } from './SocialPlayerRow';
import { InvitationList } from './InvitationList';
import { expiresIn, FRIEND_CODE_PATTERN, normalizeCode, socialError, statusCopy } from './format';
import '../../styles/friendly-fades.css';

const INVITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function FriendlyFadesHub({ accountId, crews, crewId, onCrew, roomBusy, onOpenRoom, onJoinCode, enteredCode, onEnteredCode }: {
  accountId: string;
  crews: PickerDeck[];
  crewId: string;
  onCrew: (id: string) => void;
  roomBusy: boolean;
  onOpenRoom: () => void;
  onJoinCode: () => void;
  enteredCode: string;
  onEnteredCode: (value: string) => void;
}) {
  const social = useSocial();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(useSearch());
  const homieParam = normalizeCode(params.get('homie') ?? '');
  const inviteParam = params.get('invite') ?? '';
  const inviteId = INVITE_ID.test(inviteParam) ? inviteParam.toLowerCase() : '';
  const state = social.query.data;
  const [target, setTarget] = useState(FRIEND_CODE_PATTERN.test(homieParam) ? homieParam : '');
  useEffect(() => { if (FRIEND_CODE_PATTERN.test(homieParam)) setTarget(homieParam); }, [homieParam]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const retry = useRef<{ target: string; deck: string; id: string } | null>(null);
  const rooms = useQuery({ queryKey: ['friend-rooms', accountId], queryFn: listFriendMatches, refetchInterval: 10000, retry: 1 });
  const selected = state?.homies.find(player => player.friendCode === target);
  const chosenDeck = crews.find(deck => deck.id === crewId) ?? crews[0];
  const working = sending || roomBusy || social.busy;

  async function sendInvite() {
    if (!selected || !chosenDeck || working) return;
    if (!retry.current || retry.current.target !== selected.friendCode || retry.current.deck !== chosenDeck.id)
      retry.current = { target: selected.friendCode, deck: chosenDeck.id, id: crypto.randomUUID() };
    setSending(true); setSendError(null);
    try {
      const invitation = await social.invite(selected.friendCode, chosenDeck.id, retry.current.id);
      retry.current = null;
      navigate(`/game/online/${invitation.roomCode}`);
    } catch (reason) {
      setSendError(socialError(reason, 'The invite did not send. Tap again; it will not double up.'));
    } finally { setSending(false); }
  }
  function submitCode(event: FormEvent) { event.preventDefault(); onJoinCode(); }

  const crewPicker = crews.length
    ? <CompactDeckPicker decks={crews} selectedId={chosenDeck?.id ?? ''} onSelect={onCrew} disabled={working} label="Choose your crew" />
    : <div className="sq-state sq-state--inline"><h3>Bring a complete crew.</h3><p>Save ten unique cards you own to enter a Friendly Fade.</p>
      <Link className="sq-btn sq-btn--primary" to="/game/decks">Build your crew</Link></div>;

  if (inviteId) return <InvitationView id={inviteId} crewPicker={crewPicker} deckId={chosenDeck?.id} working={working} />;

  const outgoing = state?.invitations.filter(item => item.direction === 'outgoing') ?? [];
  const incoming = state?.invitations.filter(item => item.direction === 'incoming') ?? [];
  const toRoom = (invitation: SocialInvitation) => navigate(`/game/online/${invitation.roomCode}`);
  const toInvite = (invitation: SocialInvitation) => navigate(`/game/online?tab=friends&invite=${invitation.id}`);

  return <>
    <header className="sq-device__header">
      <span className="sq-kicker"><span className="sq-device-name" aria-hidden="true" />FRIENDLY FADES</span>
      <h1>Call somebody out.</h1>
      <p>Private 1v1 with your homies. No rank, no currency, just bragging rights.</p>
    </header>

    {incoming.some(item => item.status === 'pending') && <section className="sq-section" aria-label="Incoming fade invitations">
      <SectionHead title="They want smoke" count={incoming.filter(item => item.status === 'pending').length} />
      <InvitationList invitations={incoming.filter(item => item.status === 'pending')} emptyText="" onView={toInvite} onOpenRoom={toRoom} />
    </section>}

    <section className="sq-card ff-send" aria-labelledby="ff-send-title">
      <SectionHead title="Invite a homie" />
      <span id="ff-send-title" className="sq-sr">Invite a homie</span>
      {social.query.isPending ? <div className="sq-skeleton" aria-busy="true" aria-label="Loading homies"><i /><i /></div>
        : social.query.isError ? <div className="sq-state sq-state--inline"><p>Homies did not load.</p>
          <button type="button" className="sq-btn" onClick={() => void social.query.refetch()}>Retry</button></div>
        : !state?.homies.length ? <div className="sq-state sq-state--inline">
          <h3>No homies on your phone yet.</h3><p>Find them by username first, or open a shareable room below.</p>
          <Link className="sq-btn sq-btn--primary" to="/game/settings#homies"><UserPlus size={16} />Add a homie</Link></div>
        : <>
          <p className="sq-step"><b>1</b> Who are you calling?</p>
          <div className="ff-homies" role="radiogroup" aria-label="Choose a homie">
            {state.homies.map(player => <button key={player.friendCode} type="button" role="radio" aria-checked={target === player.friendCode}
              className="ff-homie" disabled={working} data-testid={`button-target-${player.friendCode}`}
              onClick={() => { setTarget(player.friendCode); setSendError(null); history.replaceState(history.state, '', `${location.pathname}?tab=friends&homie=${player.friendCode}`); }}>
              <span className="ff-homie__name">{player.displayName}</span>
              <span className="ff-homie__handle">@{player.username}</span>
              {target === player.friendCode && <Check size={16} aria-hidden="true" />}
            </button>)}
          </div>
          {target && !selected && <p className="sq-bad" role="alert">That fighter is not on your homies list anymore.</p>}
          {selected && <ul className="sq-list"><SocialPlayerRow player={selected} tone="gold" testId="row-selected-homie" meta={<span>Target locked</span>} /></ul>}
          <p className="sq-step"><b>2</b> Who are you bringing?</p>
          {crewPicker}
          <p className="sq-step"><b>3</b> Send it.</p>
          <button type="button" className="sq-btn sq-btn--primary sq-btn--wide" disabled={!selected || !chosenDeck || working} data-testid="button-send-invitation" onClick={() => void sendInvite()}>
            <Send size={17} />{sending ? 'Sending the invite…' : selected ? `Send fade invite to ${selected.displayName}` : 'Pick a homie first'}</button>
          {sendError && <p className="sq-flash sq-flash--bad" role="alert">{sendError}</p>}
        </>}
    </section>

    <section className="sq-section" aria-label="Your sent invitations">
      <SectionHead title="Sent invites" count={outgoing.filter(item => item.status === 'pending').length} />
      <InvitationList invitations={outgoing} emptyText="No invites out right now." onView={toInvite} onOpenRoom={toRoom} />
    </section>

    {incoming.some(item => item.status !== 'pending') && <section className="sq-section" aria-label="Past invitations">
      <SectionHead title="Past invites" />
      <InvitationList invitations={incoming.filter(item => item.status !== 'pending')} emptyText="" onView={toInvite} onOpenRoom={toRoom} />
    </section>}

    <section className="sq-section" aria-label="Your rooms">
      <SectionHead title="Your rooms" />
      {rooms.isError ? <p className="sq-empty">Rooms did not load. <button type="button" className="sq-btn" onClick={() => void rooms.refetch()}>Retry</button></p>
        : rooms.isPending ? <div className="sq-skeleton" aria-busy="true" aria-label="Loading rooms"><i /></div>
        : !rooms.data.rooms.length ? <p className="sq-empty">No rooms yet. Your first fade shows up here.</p>
        : <ul className="sq-list" data-testid="list-rooms">{rooms.data.rooms.map(item => <li key={item.code} className="sq-row">
          <Link className="ff-room" to={`/game/online/${item.code}`} data-testid={`link-room-${item.code}`}>
            <span className="sq-pill" data-status={item.status === 'active' ? 'accepted' : item.status === 'waiting' ? 'pending' : 'closed'}>
              {item.status === 'active' ? 'Live' : item.status === 'waiting' ? 'Waiting' : 'Final'}</span>
            <strong className="sq-row__name">{item.rival}</strong>
            <span className="sq-code">{item.code} <ArrowUpRight size={14} aria-hidden="true" /></span>
          </Link></li>)}</ul>}
    </section>

    <section className="sq-card sq-card--quiet" aria-label="Rooms for people not on your list">
      <SectionHead title="Not on your list yet?" note="Open a room anyone with the code can join, or punch in a code you were sent." />
      {!state?.homies.length && crewPicker}
      {!!crews.length && <>
        <button type="button" className="sq-btn sq-btn--wide" disabled={working || !chosenDeck} aria-label="Create friend fade" data-testid="button-open-room" onClick={onOpenRoom}>
          <Swords size={16} />{roomBusy ? 'Opening…' : `Open a shareable room with ${chosenDeck?.name ?? 'your crew'}`}</button>
        <form className="sq-inline-form" onSubmit={submitCode}>
          <label htmlFor="online-code" className="sq-sr">Room code</label>
          <KeyRound size={16} aria-hidden="true" className="sq-inline-form__icon" />
          <input id="online-code" className="sq-input" autoComplete="off" spellCheck={false} maxLength={12} placeholder="Room code"
            value={enteredCode} onChange={event => onEnteredCode(event.target.value.toUpperCase())} data-testid="input-room-code" />
          <button className="sq-btn" aria-label="Join room" disabled={working || !enteredCode} data-testid="button-join-room">Join</button>
        </form>
      </>}
    </section>
    <FadeRules />
  </>;
}

export function FadeRules() {
  return <p className="sq-rules">Private match. Six rounds across three districts, one Squabble each, 75-second turns. Miss the timer and you forfeit. No rank or currency changes hands.</p>;
}

function InvitationView({ id, crewPicker, deckId, working }: { id: string; crewPicker: ReactNode; deckId?: string; working: boolean }) {
  const social = useSocial();
  const [, navigate] = useLocation();
  const fromSnapshot = social.query.data?.invitations.find(item => item.id === id);
  const [direct, setDirect] = useState<SocialInvitation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [answering, setAnswering] = useState<'accept' | 'decline' | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const getRef = useRef(social.getInvitation);
  getRef.current = social.getInvitation;
  const inSnapshot = !!fromSnapshot;
  useEffect(() => {
    if (inSnapshot) return;
    const controller = new AbortController();
    setLoadError(null);
    getRef.current(id, controller.signal).then(setDirect).catch(reason => {
      if (!controller.signal.aborted) setLoadError(socialError(reason, 'This invite could not be found.'));
    });
    return () => controller.abort();
  }, [id, inSnapshot, attempt]);
  const invitation = fromSnapshot ?? direct;
  const back = () => navigate('/game/online?tab=friends');

  async function answer(action: 'accept' | 'decline') {
    if (!invitation || answering || working) return;
    if (action === 'accept' && !deckId) return;
    setAnswering(action); setAnswerError(null);
    try {
      const next = await social.respondInvitation(invitation.id, action, action === 'accept' ? deckId : undefined);
      setDirect(next);
      if (action === 'accept' && next.status === 'accepted') navigate(`/game/online/${next.roomCode}`);
      else if (action === 'accept') setAnswerError(`Could not join: ${statusCopy[next.status].toLowerCase()}.`);
    } catch (reason) {
      setAnswerError(socialError(reason));
    } finally { setAnswering(null); }
  }

  if (!invitation) return <div className="sq-state">
    {loadError ? <><h2>Invite not found.</h2><p>{loadError}</p>
      <button type="button" className="sq-btn sq-btn--primary" onClick={() => setAttempt(value => value + 1)}>Try again</button></>
      : <div className="sq-skeleton" aria-busy="true" aria-label="Loading invitation"><i /><i /></div>}
    <button type="button" className="sq-btn" onClick={back}>Back to Friendly Fades</button>
  </div>;

  const pendingIncoming = invitation.status === 'pending' && invitation.direction === 'incoming';
  return <>
    <header className="sq-device__header">
      <span className="sq-kicker">FADE INVITE · {invitation.direction === 'incoming' ? 'FOR YOU' : 'FROM YOU'}</span>
      <h1>{invitation.direction === 'incoming' ? `${invitation.player.displayName} wants a fade.` : `You called out ${invitation.player.displayName}.`}</h1>
    </header>
    <section className="sq-card" data-testid="card-invitation">
      <ul className="sq-list"><SocialPlayerRow player={invitation.player} tone={pendingIncoming ? 'gold' : undefined}
        meta={<><span className="sq-pill" data-status={invitation.status}>{statusCopy[invitation.status]}</span>
          {invitation.status === 'pending' && <span>{expiresIn(invitation.expiresAt)}</span>}</>} /></ul>
      {pendingIncoming ? <>
        <p className="sq-step"><b>1</b> Pick the crew you are bringing.</p>
        {crewPicker}
        <p className="sq-step"><b>2</b> Lock it in.</p>
        <button type="button" className="sq-btn sq-btn--primary sq-btn--wide" disabled={!deckId || working || !!answering} data-testid="button-accept-invitation" onClick={() => void answer('accept')}>
          <Swords size={17} />{answering === 'accept' ? 'Joining…' : 'Accept and join the room'}</button>
        <button type="button" className="sq-btn sq-btn--wide" disabled={working || !!answering} data-testid="button-decline-invitation" onClick={() => void answer('decline')}>
          {answering === 'decline' ? 'Declining…' : 'Decline'}</button>
      </> : invitation.status === 'accepted' || (invitation.status === 'pending' && invitation.direction === 'outgoing')
        ? <button type="button" className="sq-btn sq-btn--primary sq-btn--wide" onClick={() => navigate(`/game/online/${invitation.roomCode}`)}>Go to the room</button>
        : <p className="sq-empty">This invite is done: {statusCopy[invitation.status].toLowerCase()}. Ask for a fresh one or send your own.</p>}
      {answerError && <p className="sq-flash sq-flash--bad" role="alert">{answerError}</p>}
    </section>
    <button type="button" className="sq-btn sq-btn--ghost" onClick={back}>Back to Friendly Fades</button>
    <FadeRules />
  </>;
}
