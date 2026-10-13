import { useRef, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Clock3, HandFist, LockKeyhole } from 'lucide-react';
import type { OnlineCommand, OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { getAssetUrl } from '../../lib/assets';
import { kumiteDate } from '../../lib/kumite';
import { KumiteLogo } from './KumiteBanner';
import { KumitePanel } from './KumitePanel';
import { KumiteVersus } from './KumiteVersus';
import '../../styles/kumite.css';

export interface KumiteWaitingRoomProps {
  room: OnlineRoomView;
  busy: boolean;
  connected: boolean;
  onLeave: () => void;
  send: (command: OnlineCommand) => Promise<boolean> | void;
  error?: string | null;
}

/** Assigned bracket fighters ready up here; leaving this screen never forfeits. */
export function KumiteWaitingRoom({ room, busy, connected, onLeave, send, error }: KumiteWaitingRoomProps) {
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeiting, setForfeiting] = useState(false);
  const [actionError, setActionError] = useState('');
  const actionLock = useRef(false);
  const own = room.members[room.seat];
  const bothAssigned = Boolean(room.members.player && room.members.cpu);
  const deadline = room.kumite?.roundDeadline;
  const working = busy || forfeiting;

  async function confirmForfeit() {
    if (actionLock.current || working || !connected) return;
    actionLock.current = true;
    setForfeiting(true);
    setActionError('');
    try {
      const accepted = await send({ type: 'surrender' });
      if (accepted === false) setActionError('Your forfeit was not confirmed. Reconnect and try again.');
      else setForfeitOpen(false);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Your forfeit could not be confirmed. Try again.');
    } finally {
      actionLock.current = false;
      setForfeiting(false);
    }
  }

  return <main className="kumite kumite--entrance kumite-waiting" data-testid="kumite-waiting-room" aria-label="Kumite match check-in" style={{ '--kumite-panel-art': `url("${getAssetUrl('assets/kumite/panel-background.webp')}")` } as CSSProperties}>
    <div className="kumite-environment kumite-environment--hallway" aria-hidden="true">
      <picture><source media="(max-width: 700px)" srcSet={getAssetUrl('assets/kumite/hallway-portrait.webp')} /><img src={getAssetUrl('assets/kumite/hallway-wide.webp')} alt="" fetchPriority="high" draggable={false} /></picture>
      <div className="kumite-environment__shade" />
    </div>
    <div className="kumite-shell">
      <header className="kumite-topbar">
        <button type="button" className="kumite-back" aria-label="Back to Kumite" disabled={working} onClick={onLeave}><ArrowLeft size={18} aria-hidden="true" /><span>Back to Kumite</span></button>
        <Link href="/game" className="kumite-home" aria-label="Squabblemon Safehouse"><KumiteLogo decorative /></Link>
        <span className="kumite-topbar__stamp">WEEKLY · PVP</span>
      </header>
      <div>
        <div className="kumite-waiting__heading"><h1>Weekly Kumite</h1></div>
        {error && <p className="kumite-notice kumite-notice--error" role="alert">{error}</p>}
        <KumiteVersus room={room} />
        <KumitePanel title="Match check-in" className="kumite-waiting__controls">
          <dl className="kumite-waiting__facts">
            <div><dt><LockKeyhole size={17} aria-hidden="true" />Your locked gang</dt><dd className="kumite-date">{room.ownDeck.name} · {room.ownDeck.cards.length} cards</dd></div>
            <div><dt><Clock3 size={17} aria-hidden="true" />Round deadline</dt><dd className="kumite-date">{deadline ? <time dateTime={new Date(deadline).toISOString()}>{kumiteDate(deadline)}</time> : 'See your bracket for the deadline'}</dd></div>
          </dl>
          <button type="button" className="kumite-button" disabled={working || !connected || !bothAssigned || Boolean(own?.ready)} onClick={() => { void send({ type: 'ready' }); }}><HandFist size={21} aria-hidden="true" />{working ? 'Updating your match…' : own?.ready ? 'Ready. Waiting for your opponent…' : 'Ready for Kumite'}</button>
          <p className="kumite-signup__status" role="status">{!connected ? 'Reconnecting to your tournament match…' : own?.ready ? 'Waiting for your opponent to ready up.' : 'Both fighters must be ready before the deadline.'}</p>
          <div className="kumite-waiting__actions">
            <button type="button" className="kumite-text-button" disabled={working} onClick={onLeave}>Back to Kumite</button>
            <button type="button" className="kumite-text-button" disabled={working || !connected} onClick={() => { setActionError(''); setForfeitOpen(true); }}>Forfeit tournament match</button>
          </div>
        </KumitePanel>
      </div>
    </div>
    <Dialog open={forfeitOpen} onOpenChange={setForfeitOpen}>
      <DialogContent className="street-dialog" style={{ width: 'min(440px, calc(100vw - 32px))' }}>
        <DialogTitle>Forfeit this tournament match?</DialogTitle>
        <DialogDescription>Your assigned opponent receives the win and you are eliminated from this week's Kumite. You can return to the bracket without forfeiting.</DialogDescription>
        {actionError && <p role="alert">{actionError}</p>}
        <button type="button" className="online-primary" disabled={forfeiting} onClick={() => setForfeitOpen(false)}>Keep my place</button>
        <button type="button" className="online-secondary" disabled={working || !connected} onClick={() => { void confirmForfeit(); }}>{forfeiting ? 'Confirming forfeit…' : 'Confirm forfeit'}</button>
      </DialogContent>
    </Dialog>
  </main>;
}
