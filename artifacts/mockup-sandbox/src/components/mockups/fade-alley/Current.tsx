import { useState, type CSSProperties, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { ArrowUpRight, Check, KeyRound, Send, Swords, Users, Trophy } from 'lucide-react';
import './_group.css';

type Player = { friendCode: string; displayName: string; username: string; avatarKey: string; lastActiveAt: string | null };
type Invitation = {
  id: string; direction: 'incoming' | 'outgoing'; status: 'pending' | 'accepted' | 'declined';
  expiresAt: string; roomCode: string; player: Player;
};
type Deck = { id: string; name: string; heroCardId: string; cardIds: string[] };

const homies: Player[] = [
  { friendCode: 'A1B2C3D4E5F6', displayName: 'Maya “Moss” Chen', username: 'mossmon', avatarKey: 'fern', lastActiveAt: new Date(Date.now() - 8 * 60000).toISOString() },
  { friendCode: '9F8E7D6C5B4A', displayName: 'Andre “Static” Jones', username: 'staticj', avatarKey: 'volt', lastActiveAt: new Date(Date.now() - 3 * 3600000).toISOString() },
  { friendCode: '0123ABCDEF45', displayName: 'Riley Park', username: 'rileyruns', avatarKey: 'cornball', lastActiveAt: null },
];
const crews: Deck[] = [
  { id: 'starter-grove', name: 'Grove Guardians', heroCardId: 'fern', cardIds: ['fern', 'mossback', 'bramble', 'sprout', 'ivy', 'acorn', 'willow', 'thicket', 'sage', 'clover'] },
  { id: 'starter-voltage', name: 'Voltage Club', heroCardId: 'volt', cardIds: ['volt', 'spark', 'coil', 'static', 'amp', 'flash', 'surge', 'battery', 'fuse', 'storm'] },
];
const initialInvitations: Invitation[] = [
  { id: 'invite-moss', direction: 'incoming', status: 'pending', expiresAt: new Date(Date.now() + 48 * 60000).toISOString(), roomCode: 'FAD3A91C02BE', player: homies[0] },
  { id: 'invite-static', direction: 'outgoing', status: 'pending', expiresAt: new Date(Date.now() + 36 * 60000).toISOString(), roomCode: 'B04D71C8A29F', player: homies[1] },
  { id: 'invite-riley', direction: 'incoming', status: 'declined', expiresAt: new Date(Date.now() - 86400000).toISOString(), roomCode: '09AF137BC261', player: homies[2] },
];
const statusCopy: Record<Invitation['status'], string> = { pending: 'Waiting on an answer', accepted: 'Accepted', declined: 'Declined' };
const expiresIn = (iso: string) => {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return 'expiring now';
  return minutes < 60 ? `${minutes} min left` : `${Math.round(minutes / 60)} hr left`;
};

export function Current() {
  const [target, setTarget] = useState(homies[0].friendCode);
  const [crewId, setCrewId] = useState(crews[0].id);
  const [enteredCode, setEnteredCode] = useState('');
  const [invitations, setInvitations] = useState(initialInvitations);
  const [selectedInvite, setSelectedInvite] = useState<Invitation | null>(null);
  const [notice, setNotice] = useState('');
  const [roomBusy, setRoomBusy] = useState(false);
  const chosenDeck = crews.find(deck => deck.id === crewId) ?? crews[0];
  const selected = homies.find(player => player.friendCode === target);

  function sendInvite() {
    if (!selected) return;
    const invite: Invitation = {
      id: `invite-${Date.now()}`, direction: 'outgoing', status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60000).toISOString(), roomCode: 'C04A1F7E9B32', player: selected,
    };
    setInvitations(previous => [invite, ...previous]);
    setNotice(`Fade invite sent to ${selected.displayName}.`);
  }
  function updateInvitation(invitation: Invitation, status: Invitation['status']) {
    setInvitations(previous => previous.map(item => item.id === invitation.id ? { ...item, status } : item));
    setSelectedInvite({ ...invitation, status });
    setNotice(status === 'accepted' ? 'Invite accepted. This local preview does not open a room.' : 'Invite declined.');
  }
  function localRoom(action: 'open' | 'join') {
    setRoomBusy(true);
    window.setTimeout(() => {
      setRoomBusy(false);
      setNotice(action === 'open' ? 'Shareable room opened in this local preview.' : `Room ${enteredCode} joined in this local preview.`);
    }, 300);
  }

  return <div className="fade-alley-current">
    <main className="ff-stage" aria-label="Friendly Fades" tabIndex={-1}>
      <header className="ff-stage__nav">
        <nav className="fight-tabs" aria-label="Fight modes">
          <a href="#fade-park" onClick={event => event.preventDefault()}><Swords size={15} />Fade Park<span>Ranked</span></a>
          <a href="#friendly-fades" aria-current="page" onClick={event => event.preventDefault()}><Users size={15} />Friendly Fades<span>Private</span></a>
          <a href="#challenges" onClick={event => event.preventDefault()}><Trophy size={15} />Challenges<span>Solo</span></a>
        </nav>
        <a href="#training" onClick={event => event.preventDefault()}>Training Circuit</a>
        <div className="ff-stage__tools" aria-hidden="true" />
      </header>
      <DeviceFrame>
        {selectedInvite
          ? <InvitationView invitation={selectedInvite} onBack={() => setSelectedInvite(null)}
              onAnswer={status => updateInvitation(selectedInvite, status)} onNotice={setNotice}
              crewId={crewId} onCrew={setCrewId} />
          : <HubContent
              target={target} setTarget={value => { setTarget(value); setNotice(''); }}
              crewId={crewId} setCrewId={setCrewId} chosenDeck={chosenDeck} selected={selected}
              invitations={invitations} setInvitations={setInvitations}
              enteredCode={enteredCode} setEnteredCode={setEnteredCode}
              roomBusy={roomBusy} localRoom={localRoom} onSendInvite={sendInvite}
              onViewInvite={setSelectedInvite} notice={notice} onNotice={setNotice} />}
      </DeviceFrame>
    </main>
  </div>;
}

function DeviceFrame({ children }: { children: ReactNode }) {
  return <div className="sq-device-stage ff-stage__device">
    <div className="sq-device" style={{ '--sq-tablet-art': 'url("/__mockup/images/fade-alley-current/squabble-tablet.webp")' } as CSSProperties}>
      <picture className="sq-device__art" aria-hidden="true">
        <source media="(orientation: landscape)" srcSet="/__mockup/images/fade-alley-current/squabble-tablet.webp" />
        <img src="/__mockup/images/fade-alley-current/squabble-phone.webp" alt="" draggable={false} decoding="async" />
      </picture>
      <section className="sq-device__screen" aria-label="Friendly Fades" tabIndex={-1} data-testid="friendly-fades-device">
        <div className="sq-device__content">{children}</div>
      </section>
    </div>
  </div>;
}

function HubContent({ target, setTarget, crewId, setCrewId, chosenDeck, selected, invitations, setInvitations,
  enteredCode, setEnteredCode, roomBusy, localRoom, onSendInvite, onViewInvite, notice, onNotice }: {
  target: string; setTarget: (value: string) => void; crewId: string; setCrewId: (value: string) => void;
  chosenDeck: Deck; selected?: Player; invitations: Invitation[]; setInvitations: Dispatch<SetStateAction<Invitation[]>>;
  enteredCode: string; setEnteredCode: (value: string) => void; roomBusy: boolean; localRoom: (action: 'open' | 'join') => void;
  onSendInvite: () => void; onViewInvite: (invitation: Invitation) => void; notice: string; onNotice: (value: string) => void;
}) {
  const incoming = invitations.filter(item => item.direction === 'incoming');
  const outgoing = invitations.filter(item => item.direction === 'outgoing');
  const pendingIncoming = incoming.filter(item => item.status === 'pending');
  const rooms = [{ code: 'FAD3A91C02BE', rival: 'Maya “Moss” Chen', status: 'active' }, { code: 'B04D71C8A29F', rival: 'Andre “Static” Jones', status: 'waiting' }];
  const crewPicker = <DeckPicker decks={crews} selectedId={crewId} onSelect={setCrewId} />;
  const view = (invitation: Invitation) => onViewInvite(invitation);
  const update = (invitation: Invitation, status: Invitation['status']) => setInvitations(previous => previous.map(item => item.id === invitation.id ? { ...item, status } : item));
  function submitCode(event: FormEvent) { event.preventDefault(); if (enteredCode) localRoom('join'); }
  return <>
    <header className="sq-device__header">
      <span className="sq-kicker"><span className="sq-device-name" aria-hidden="true" />FRIENDLY FADES</span>
      <h1>Call somebody out.</h1>
      <p>Private 1v1 with your homies. No rank, no currency, just bragging rights.</p>
    </header>

    {!!pendingIncoming.length && <section className="sq-section" aria-label="Incoming fade invitations">
      <SectionHead title="They want smoke" count={pendingIncoming.length} />
      <InvitationList invitations={pendingIncoming} emptyText="" onView={view} onOpenRoom={() => onNotice('This local preview does not open a room.')} onUpdate={update} />
    </section>}

    <section className="sq-card ff-send" aria-labelledby="ff-send-title">
      <SectionHead title="Invite a homie" />
      <span id="ff-send-title" className="sq-sr">Invite a homie</span>
      <>
        <p className="sq-step"><b>1</b> Who are you calling?</p>
        <div className="ff-homies" role="radiogroup" aria-label="Choose a homie">
          {homies.map(player => <button key={player.friendCode} type="button" role="radio" aria-checked={target === player.friendCode}
            className="ff-homie" data-testid={`button-target-${player.friendCode}`} onClick={() => setTarget(player.friendCode)}>
            <span className="ff-homie__name">{player.displayName}</span>
            <span className="ff-homie__handle">@{player.username}</span>
            {target === player.friendCode && <Check size={16} aria-hidden="true" />}
          </button>)}
        </div>
        {selected && <ul className="sq-list"><SocialPlayerRow player={selected} tone="gold" testId="row-selected-homie" meta={<span>Target locked</span>} /></ul>}
        <p className="sq-step"><b>2</b> Who are you bringing?</p>
        {crewPicker}
        <p className="sq-step"><b>3</b> Send it.</p>
        <button type="button" className="sq-btn sq-btn--primary sq-btn--wide" disabled={!selected} data-testid="button-send-invitation" onClick={onSendInvite}>
          <Send size={17} />{selected ? `Send fade invite to ${selected.displayName}` : 'Pick a homie first'}</button>
        {notice && <p className="sq-flash" role="status">{notice}</p>}
      </>
    </section>

    <section className="sq-section" aria-label="Your sent invitations">
      <SectionHead title="Sent invites" count={outgoing.filter(item => item.status === 'pending').length} />
      <InvitationList invitations={outgoing} emptyText="No invites out right now." onView={view}
        onOpenRoom={() => onNotice('This local preview does not open a room.')} onUpdate={update} />
    </section>

    {incoming.some(item => item.status !== 'pending') && <section className="sq-section" aria-label="Past invitations">
      <SectionHead title="Past invites" />
      <InvitationList invitations={incoming.filter(item => item.status !== 'pending')} emptyText="" onView={view}
        onOpenRoom={() => onNotice('This local preview does not open a room.')} onUpdate={update} />
    </section>}

    <section className="sq-section" aria-label="Your rooms">
      <SectionHead title="Your rooms" />
      <ul className="sq-list" data-testid="list-rooms">{rooms.map(item => <li key={item.code} className="sq-row">
        <a className="ff-room" href={`#room-${item.code}`} onClick={event => { event.preventDefault(); onNotice(`Room ${item.code} is display-only in this local preview.`); }}>
          <span className="sq-pill" data-status={item.status === 'active' ? 'accepted' : 'pending'}>{item.status === 'active' ? 'Live' : 'Waiting'}</span>
          <strong className="sq-row__name">{item.rival}</strong>
          <span className="sq-code">{item.code} <ArrowUpRight size={14} aria-hidden="true" /></span>
        </a></li>)}</ul>
    </section>

    <section className="sq-card sq-card--quiet" aria-label="Rooms for people not on your list">
      <SectionHead title="Not on your list yet?" note="Open a room anyone with the code can join, or punch in a code you were sent." />
      {!homies.length && crewPicker}
      {!!crews.length && <>
        <button type="button" className="sq-btn sq-btn--wide" aria-label="Create friend fade" data-testid="button-open-room" onClick={() => localRoom('open')}>
          <Swords size={16} />{roomBusy ? 'Opening…' : `Open a shareable room with ${chosenDeck.name}`}</button>
        <form className="sq-inline-form" onSubmit={submitCode}>
          <label htmlFor="online-code" className="sq-sr">Room code</label>
          <KeyRound size={16} aria-hidden="true" className="sq-inline-form__icon" />
          <input id="online-code" className="sq-input" autoComplete="off" spellCheck={false} maxLength={12} placeholder="Room code"
            value={enteredCode} onChange={event => setEnteredCode(event.target.value.toUpperCase())} data-testid="input-room-code" />
          <button className="sq-btn" aria-label="Join room" disabled={!enteredCode} data-testid="button-join-room">Join</button>
        </form>
      </>}
    </section>
    <FadeRules />
  </>;
}

function InvitationView({ invitation, onBack, onAnswer, onNotice, crewId, onCrew }: {
  invitation: Invitation; onBack: () => void; onAnswer: (status: Invitation['status']) => void; onNotice: (value: string) => void;
  crewId: string; onCrew: (value: string) => void;
}) {
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
        <DeckPicker decks={crews} selectedId={crewId} onSelect={onCrew} />
        <p className="sq-step"><b>2</b> Lock it in.</p>
        <button type="button" className="sq-btn sq-btn--primary sq-btn--wide" data-testid="button-accept-invitation" onClick={() => onAnswer('accepted')}>
          <Swords size={17} />Accept and join the room</button>
        <button type="button" className="sq-btn sq-btn--wide" data-testid="button-decline-invitation" onClick={() => onAnswer('declined')}>Decline</button>
      </> : invitation.status === 'accepted' || (invitation.status === 'pending' && invitation.direction === 'outgoing')
        ? <button type="button" className="sq-btn sq-btn--primary sq-btn--wide" onClick={() => onNotice('This local preview does not open a room.')}>Go to the room</button>
        : <p className="sq-empty">This invite is done: {statusCopy[invitation.status].toLowerCase()}. Ask for a fresh one or send your own.</p>}
    </section>
    <button type="button" className="sq-btn sq-btn--ghost" onClick={onBack}>Back to Friendly Fades</button>
    <FadeRules />
  </>;
}

function InvitationList({ invitations, emptyText, onView, onOpenRoom, onUpdate }: {
  invitations: Invitation[]; emptyText: string; onView: (invitation: Invitation) => void;
  onOpenRoom: (invitation: Invitation) => void; onUpdate: (invitation: Invitation, status: Invitation['status']) => void;
}) {
  if (!invitations.length) return <p className="sq-empty">{emptyText}</p>;
  return <ul className="sq-list" data-testid="list-invitations">
    {invitations.map(invitation => {
      const pending = invitation.status === 'pending', incoming = invitation.direction === 'incoming';
      return <SocialPlayerRow key={invitation.id} player={invitation.player} testId={`row-invitation-${invitation.id}`}
        tone={pending ? (incoming ? 'gold' : 'leaf') : undefined}
        meta={<><span className="sq-pill" data-status={invitation.status}>{incoming ? 'Invited you' : 'You invited'}</span>
          <span>{pending ? expiresIn(invitation.expiresAt) : statusCopy[invitation.status]}</span></>}>
        {pending && incoming && <>
          <button type="button" className="sq-btn sq-btn--primary" data-testid={`button-view-invitation-${invitation.id}`} onClick={() => onView(invitation)}>View invite</button>
          <button type="button" className="sq-btn" data-testid={`button-decline-invitation-${invitation.id}`} onClick={() => onUpdate(invitation, 'declined')}>Decline</button>
        </>}
        {pending && !incoming && <>
          <button type="button" className="sq-btn" data-testid={`button-open-room-${invitation.id}`} onClick={() => onOpenRoom(invitation)}>Open room</button>
          <button type="button" className="sq-btn sq-btn--danger" data-testid={`button-cancel-invitation-${invitation.id}`} onClick={() => onUpdate(invitation, 'declined')}>Cancel</button>
        </>}
        {invitation.status === 'accepted' && <button type="button" className="sq-btn" data-testid={`button-resume-room-${invitation.id}`} onClick={() => onOpenRoom(invitation)}>Go to room</button>}
      </SocialPlayerRow>;
    })}
  </ul>;
}

function SocialPlayerRow({ player, meta, children, testId, tone }: {
  player: Player; meta?: ReactNode; children?: ReactNode; testId?: string; tone?: 'gold' | 'rust' | 'leaf';
}) {
  return <li className="sq-row" data-tone={tone} data-testid={testId}>
    <div className="sq-row__who">
      <span className="sq-row__portrait"><span className="fighter-portrait" aria-hidden="true"><span className={`portrait-glyph portrait-glyph--${player.avatarKey}`}>{player.displayName.slice(0, 1)}</span></span></span>
      <span className="sq-row__text">
        <strong className="sq-row__name">{player.displayName}</strong>
        <span className="fb-handle">@{player.username}</span>
        <small className="sq-row__meta">{meta ?? <span className="fb-presence">{player.lastActiveAt ? 'Recently active' : 'No recent activity'}</span>}</small>
      </span>
    </div>
    {children && <div className="sq-row__actions">{children}</div>}
  </li>;
}

function SectionHead({ title, count, note }: { title: string; count?: number; note?: string }) {
  return <header className="sq-section__head"><h2>{title}{count ? <span className="sq-count" aria-label={`${count} total`}>{count}</span> : null}</h2>{note && <p>{note}</p>}</header>;
}

function DeckPicker({ decks, selectedId, onSelect }: { decks: Deck[]; selectedId: string; onSelect: (id: string) => void }) {
  return <div className="compact-deck-picker" role="group" aria-label="Choose your crew">
    <div className="compact-deck-picker__rail">{decks.map(deck => <button type="button" key={deck.id} aria-pressed={selectedId === deck.id} onClick={() => onSelect(deck.id)} className="compact-deck-picker__deck">
      <span className="compact-deck-picker__box" aria-hidden="true"><span className={`deck-glyph deck-glyph--${deck.heroCardId}`}>{deck.heroCardId.slice(0, 1).toUpperCase()}</span></span>
      <span><strong>{deck.name}</strong><small>{deck.cardIds.length} cards {selectedId === deck.id ? '· READY' : ''}</small></span>
    </button>)}</div>
  </div>;
}

function FadeRules() {
  return <p className="sq-rules">Private match. Six rounds across three districts, one Squabble each, 75-second turns. Miss the timer and you forfeit. No rank or currency changes hands.</p>;
}