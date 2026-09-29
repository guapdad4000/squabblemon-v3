import { useState } from 'react';
import type { SocialInvitation } from '@workspace/api-client-react';
import { useSocial } from '../../lib/social';
import { SocialPlayerRow } from './SocialPlayerRow';
import { expiresIn, socialError, statusCopy } from './format';

/** Shared invitation receipts for Homies and Friendly Fades. Nothing here mutates without a tap. */
export function InvitationList({ invitations, onView, onOpenRoom, emptyText, onBusyChange }: {
  invitations: SocialInvitation[];
  onView: (invitation: SocialInvitation) => void;
  onOpenRoom: (invitation: SocialInvitation) => void;
  emptyText: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const social = useSocial();
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; text: string; bad?: boolean } | null>(null);
  async function respond(invitation: SocialInvitation, action: 'decline' | 'cancel') {
    if (working || social.busy) return;
    if (action === 'cancel' && !window.confirm(`Call off the fade with ${invitation.player.displayName}?`)) return;
    setWorking(invitation.id); onBusyChange?.(true); setNotice(null);
    try {
      const next = await social.respondInvitation(invitation.id, action);
      setNotice({ id: invitation.id, text: next.status === 'pending' ? 'Still pending.' : `${statusCopy[next.status]}.` });
    } catch (reason) {
      setNotice({ id: invitation.id, text: socialError(reason), bad: true });
    } finally { setWorking(null); onBusyChange?.(false); }
  }
  if (!invitations.length) return <p className="sq-empty">{emptyText}</p>;
  return <ul className="sq-list" data-testid="list-invitations">
    {invitations.map(invitation => {
      const pending = invitation.status === 'pending';
      const incoming = invitation.direction === 'incoming';
      return <SocialPlayerRow key={invitation.id} player={invitation.player} testId={`row-invitation-${invitation.id}`}
        tone={pending ? (incoming ? 'gold' : 'leaf') : undefined}
        meta={<>
          <span className="sq-pill" data-status={invitation.status}>{incoming ? 'Invited you' : 'You invited'}</span>
          <span>{pending ? expiresIn(invitation.expiresAt) : statusCopy[invitation.status]}</span>
          {notice?.id === invitation.id && <span role="status" className={notice.bad ? 'sq-bad' : 'sq-good'}>{notice.text}</span>}
        </>}>
        {pending && incoming && <>
          <button type="button" className="sq-btn sq-btn--primary" data-testid={`button-view-invitation-${invitation.id}`} onClick={() => onView(invitation)}>View invite</button>
          <button type="button" className="sq-btn" disabled={!!working} data-testid={`button-decline-invitation-${invitation.id}`} onClick={() => void respond(invitation, 'decline')}>{working === invitation.id ? 'Declining…' : 'Decline'}</button>
        </>}
        {pending && !incoming && <>
          <button type="button" className="sq-btn" data-testid={`button-open-room-${invitation.id}`} onClick={() => onOpenRoom(invitation)}>Open room</button>
          <button type="button" className="sq-btn sq-btn--danger" disabled={!!working} data-testid={`button-cancel-invitation-${invitation.id}`} onClick={() => void respond(invitation, 'cancel')}>{working === invitation.id ? 'Cancelling…' : 'Cancel'}</button>
        </>}
        {invitation.status === 'accepted' && <button type="button" className="sq-btn" data-testid={`button-resume-room-${invitation.id}`} onClick={() => onOpenRoom(invitation)}>Go to room</button>}
      </SocialPlayerRow>;
    })}
  </ul>;
}
