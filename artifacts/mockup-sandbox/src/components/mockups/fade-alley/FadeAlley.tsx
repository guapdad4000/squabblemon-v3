import { useState, type FormEvent } from 'react';
import { AlleyAvatar } from './_shared/AlleyAvatar';
import { FadeGameHeader } from './_shared/FadeGameHeader';
import { Check, Copy, KeyRound, Shield, Swords, UserRound, Users } from 'lucide-react';
import './FadeAlley.css';
import './FadeAlleyAAA.css';

type Stage = 'lobby' | 'invited' | 'ready' | 'room';
const homies = [
  { name: 'Mika', handle: '@mika.moves', icon: 'M' },
  { name: 'Rook', handle: '@rookstreet', icon: 'R' },
  { name: 'Jules', handle: '@jules.exe', icon: 'J' },
  { name: 'Tavi', handle: '@tavi-tactics', icon: 'T' },
];
const crews = [
  { id: 'curbside', name: 'Curbside Kings', size: '10 cards · balanced', art: 'guap.webp' },
  { id: 'nightshift', name: 'Night Shift', size: '10 cards · quick hands', art: 'ashlee.webp' },
  { id: 'wildcards', name: 'Wild Cards', size: '10 cards · unpredictable', art: 'dr-fade.webp' },
];

export function FadeAlley() {
  const [homie, setHomie] = useState('');
  const [crew, setCrew] = useState(crews[0].id);
  const [stage, setStage] = useState<Stage>('lobby');
  const [rivalJoined, setRivalJoined] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [activityTab, setActivityTab] = useState<'sent' | 'rooms'>('sent');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const selected = homies.find(person => person.name === homie);
  const selectedCrew = crews.find(item => item.id === crew) ?? crews[0];
  const rivalName = selected?.name ?? 'Rival';

  function invite() {
    if (!selected) { setError('Choose a homie first.'); return; }
    setError('');
    setNotice(`Invite to ${selected.name} previewed — not sent.`);
    setStage('invited');
    setActivityTab('sent');
    setRivalJoined(false);
    setRoomCode('');
  }
  function createRoom() {
    setError('');
    setRoomCode(Array.from({ length: 12 }, () => 'ABCDEF0123456789'[Math.floor(Math.random() * 16)]).join(''));
    setNotice('Preview code created — no room opened.');
    setStage('room');
    setActivityTab('rooms');
    setRivalJoined(false);
  }
  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = joinCode.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(normalized)) {
      setError('Enter the 12-character room code your friend shared.');
      return;
    }
    setError('');
    setRoomCode(normalized);
    setNotice(`Code ${normalized} previewed — no room joined.`);
    setStage('room');
    setActivityTab('rooms');
    setRivalJoined(false);
  }
  async function copyCode() {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setNotice('Room code copied.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice('Select and copy the room code above to share it.');
    }
  }
  function markReady() {
    if (!rivalJoined) return;
    if (stage === 'invited') {
      setStage('ready');
      setNotice(`Ready with ${rivalName} (preview).`);
    } else if (stage === 'ready') {
      setStage(roomCode ? 'room' : 'invited');
      setNotice('Ready status cleared.');
    } else {
      setStage('ready');
      setNotice('Ready (preview) — no match started.');
    }
  }

  return (
    <main className="fa-root" aria-label="Squabblemon Friendly Fades">
      <FadeGameHeader onPreviewAction={action => setNotice(`${action} is unavailable in this preview.`)} />
      <nav className="fa-topnav" aria-label="Fight modes">
        <div className="fa-topnav__tabs">
          <button type="button" className="fa-topnav__tab" onClick={() => setNotice('Fade Park is unavailable in this preview.')}>
            <span className="fa-topnav__label">Fade Park</span><small>Ranked</small>
          </button>
          <button type="button" className="fa-topnav__tab fa-topnav__tab--active" aria-current="page">
            <span className="fa-topnav__label">Friendly Fades</span><small>Private</small>
          </button>
          <button type="button" className="fa-topnav__tab" onClick={() => setNotice('Challenges are unavailable in this preview.')}>
            <span className="fa-topnav__label">Challenges</span><small>Solo</small>
          </button>
        </div>
        <span className="fa-topnav__status">PRIVATE · UNRANKED</span>
      </nav>
      <div className="fa-shell">
        <section className="fa-scene" aria-label="Night alley scene">
          <img className="fa-scene__image" src="/__mockup/images/fade-alley-night.png" alt="" />
          <div className="fa-hud-logo"><img src="/__mockup/images/fade-alley/fade-alley-logo.png" alt="Squabblemon Fade Alley" /></div>
          <div className="fa-scene__copy">
            <div className="fa-eyebrow">PRIVATE 1V1 · UNRANKED</div>
          </div>
          <div className="fa-avatar fa-avatar--you" aria-label="Your avatar position">
            <AlleyAvatar animation={stage === 'ready' ? 'Boxing_Practice' : 'Idle_10'} className="fa-avatar__model" />
          </div>
          <div className="fa-playerlabel fa-playerlabel--you">
            <small>PLAYER 1</small><strong>You</strong><span><UserRound size={11} /> Host</span>
          </div>
          <div className={`fa-rivalzone${rivalJoined ? ' fa-rivalzone--joined' : ''}`} aria-label={rivalJoined ? `${rivalName} has joined` : 'Waiting for rival'}>
            {rivalJoined
              ? <div className="fa-avatar fa-avatar--rival"><AlleyAvatar animation={stage === 'ready' ? 'Boxing_Practice' : 'Idle_10'} className="fa-avatar__model" /></div>
              : <div className="fa-rival-silhouette"><UserRound size={31} /><span>OPEN SPOT</span></div>}
          </div>
          {(rivalJoined || stage === 'invited') && <div className={`fa-playerlabel fa-playerlabel--rival${rivalJoined ? ' fa-playerlabel--present' : ''}`}>
            <small>PLAYER 2</small>
            <strong>{rivalJoined ? rivalName : 'Invited'}</strong>
            <span><UserRound size={11} /> {rivalJoined ? selected?.handle ?? 'Rival' : 'Invite pending'}</span>
          </div>}
        </section>

        <section className="fa-lobby" aria-label="Friendly Fades lobby controls">
          <div className="fa-control">
            <div className="fa-sectionhead">
              <h2>Set up the <em>fade.</em></h2>
              <form className="fa-join" onSubmit={joinRoom}>
                <label htmlFor="fa-room-code"><KeyRound size={13} /> Room code</label>
                <div className="fa-join__row">
                  <input id="fa-room-code" className="fa-input" value={joinCode} onChange={event => { setJoinCode(event.target.value.toUpperCase()); setError(''); }} placeholder="PASTE CODE HERE" maxLength={12} autoComplete="off" spellCheck={false} />
                  <button type="submit" className="fa-button fa-button--secondary" disabled={!joinCode.trim()}>Join room</button>
                </div>
              </form>
            </div>
            <div className="fa-step"><b>1</b> Choose a homie</div>
            <div className="fa-homies" role="radiogroup" aria-label="Choose a homie">
              {homies.map(person => <button key={person.name} type="button" className="fa-homie" role="radio" aria-checked={homie === person.name} onClick={() => { setHomie(person.name); setError(''); }}>
                <span className="fa-playericon" aria-label={`${person.name} player icon`}>{person.icon}</span>
                <span><span className="fa-homie__name">{person.name}</span><br /><span className="fa-homie__handle">{person.handle}</span></span>
                {homie === person.name && <Check size={14} className="fa-check" />}
              </button>)}
            </div>
            <button type="button" className="fa-add-homie" onClick={() => setNotice('Add a homie from your settings in the full game.')}>+ Add a homie</button>
            <div className="fa-step"><b>2</b> Choose a crew</div>
            <div className="fa-crew-row" role="group" aria-label="Choose crew">
              {crews.map(item => <button type="button" key={item.id} className="fa-crew" aria-pressed={crew === item.id} onClick={() => setCrew(item.id)}>
                <img src={`/__mockup/images/fade-alley/hud/${item.art}`} alt="" />
                <span className="fa-crew__copy"><strong>{item.name}</strong><small>{item.size}</small></span>
                {crew === item.id && <b className="fa-crew__selected">P1</b>}
              </button>)}
            </div>
            <div className="fa-step"><b>3</b> Invite or open a room</div>
            <div className="fa-actions">
              <button type="button" className="fa-button fa-button--left" onClick={invite}><Swords size={16} /> Send fade invite</button>
              <button type="button" className="fa-button fa-button--secondary fa-button--right" onClick={createRoom}><Users size={16} /> Open a shareable room</button>
            </div>
            {error && <p className="fa-status fa-error" role="alert"><Shield size={15} />{error}</p>}
            {notice && <p className="fa-status" role="status"><Check size={15} />{notice}</p>}
            <div className="fa-activity-tabs" role="tablist" aria-label="Fade activity">
              <button type="button" id="fa-sent-tab" role="tab" aria-controls="fa-sent-panel" aria-selected={activityTab === 'sent'} onClick={() => setActivityTab('sent')}>Sent invites <span>{stage === 'invited' || (stage === 'ready' && !roomCode) ? '1' : '0'}</span></button>
              <button type="button" id="fa-rooms-tab" role="tab" aria-controls="fa-rooms-panel" aria-selected={activityTab === 'rooms'} onClick={() => setActivityTab('rooms')}>Your rooms <span>{roomCode ? '1' : '0'}</span></button>
            </div>
            <div id="fa-sent-panel" className="fa-activity-panel" role="tabpanel" aria-labelledby="fa-sent-tab" hidden={activityTab !== 'sent'}>
              {stage === 'invited' || (stage === 'ready' && !roomCode)
                ? <div className="fa-activity-item"><span>To {rivalName} · {stage === 'ready' ? 'Ready' : 'Pending'}</span><button type="button" onClick={() => setActivityTab('rooms')}>View invite room →</button></div>
                : <p>No invites out right now.</p>}
            </div>
            <div id="fa-rooms-panel" className="fa-activity-panel" role="tabpanel" aria-labelledby="fa-rooms-tab" hidden={activityTab !== 'rooms'}>
              {stage === 'lobby' ? <p>No rooms yet.</p> : <section className="fa-session" aria-label="Preview room actions">
                <div className="fa-session__summary">
                  <div className="fa-session__status"><small>ROOM STATUS</small><strong>{stage === 'ready' ? 'You’re ready' : rivalJoined ? `${rivalName} joined` : stage === 'invited' ? `Invite to ${rivalName}` : 'Share your room'}</strong></div>
                  {roomCode && <div className="fa-roomcode"><div><small>ROOM CODE</small><strong>{roomCode}</strong></div><button type="button" aria-label="Copy room code" onClick={() => void copyCode()}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div>}
                </div>
                <div className="fa-session__actions">
                  {!rivalJoined && <button type="button" className="fa-button fa-button--quiet" onClick={() => { setRivalJoined(true); setNotice(`${rivalName} joined (preview).`); }}>Preview rival joins</button>}
                  <button type="button" className="fa-button fa-button--wide" onClick={markReady} disabled={!rivalJoined}>{stage === 'ready' ? 'Clear ready status' : 'Ready to squabble'}</button>
                  <button type="button" className="fa-button fa-button--quiet" onClick={() => { setStage('lobby'); setRoomCode(''); setRivalJoined(false); setNotice('Lobby reset.'); }}>Back to the alley</button>
                </div>
              </section>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default FadeAlley;