import { useCallback, useEffect, useRef, useState } from 'react';
import type { SocialLookup, SocialState } from '@workspace/api-client-react';
import { useOptionalSocial } from '../../lib/social';
import '../../styles/post-match-homie.css';

const connectionMessage = (reason: unknown) =>
  reason instanceof DOMException && reason.name === 'TimeoutError'
    ? 'The connection timed out. Please retry.'
    : 'Connection interrupted. Please retry.';

function relationshipFromState(state: SocialState, previous: SocialLookup): SocialLookup {
  const code = previous.player.friendCode;
  if (state.self.friendCode === code) return { ...previous, relationship: 'self', requestId: null };
  if (state.blocked.some(player => player.friendCode === code)) return { ...previous, relationship: 'blocked', requestId: null };
  if (state.homies.some(player => player.friendCode === code)) return { ...previous, relationship: 'homie', requestId: null };
  const incoming = state.incomingRequests.find(request => request.player.friendCode === code);
  if (incoming) return { ...previous, relationship: 'incoming', requestId: incoming.id };
  const outgoing = state.outgoingRequests.find(request => request.player.friendCode === code);
  if (outgoing) return { ...previous, relationship: 'outgoing', requestId: outgoing.id };
  return { ...previous, relationship: 'none', requestId: null };
}

/** Never trust the public room identity for a friend code: only the server's retained match roster can resolve it. */
export function PostMatchHomie({ code }: { code: string }) {
  const social = useOptionalSocial();
  const [opponent, setOpponent] = useState<SocialLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const locked = useRef(false);
  const generation = useRef(0);
  const lifetime = useRef<AbortController | null>(null);
  const matchOpponent = social?.matchOpponent;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const activeSignal = signal ?? lifetime.current?.signal;
    if (!matchOpponent || !activeSignal || activeSignal.aborted) return undefined;
    const sequence = ++generation.current;
    setLoading(true);
    try {
      const result = await matchOpponent(code, activeSignal);
      if (activeSignal.aborted || sequence !== generation.current) return undefined;
      setOpponent(result.opponent);
      setError(null);
      return result.opponent;
    } catch (reason) {
      if (activeSignal.aborted || sequence !== generation.current) return undefined;
      setError(connectionMessage(reason));
      return undefined;
    } finally {
      if (!activeSignal.aborted && sequence === generation.current) setLoading(false);
    }
  }, [code, matchOpponent]);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void refresh(controller.signal);
    // The result dialog can stay open while a cross-request is accepted elsewhere.
    // Refresh only a few times, and again when the player returns to this tab.
    let checks = 0;
    const interval = window.setInterval(() => {
      checks++;
      if (!document.hidden && !locked.current) void refresh(controller.signal);
      if (checks >= 4) window.clearInterval(interval);
    }, 15_000);
    const onFocus = () => { if (!document.hidden && !locked.current) void refresh(controller.signal); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      controller.abort();
      if (lifetime.current === controller) lifetime.current = null;
      generation.current++;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  if (!social || !matchOpponent) return null;
  const relation = opponent?.relationship;
  const hidden = !opponent || relation === 'self' || relation === 'blocked';
  if (relation === 'self' || relation === 'blocked') return null;
  if (hidden && !loading && !error) return null;
  async function act() {
    if (!social || !opponent || locked.current || social.busy || !navigator.onLine) return;
    if (relation !== 'none' && relation !== 'incoming') return;
    if (relation === 'incoming' && !opponent.requestId) {
      setError('This request changed. Refresh to try again.');
      return;
    }
    locked.current = true;
    generation.current++; // Discard any earlier lookup that could overwrite the mutation's authoritative state.
    setWorking(true);
    setError(null);
    try {
      const state = relation === 'incoming'
        ? await social.respondRequest(opponent.requestId!, 'accept')
        : await social.sendRequest(opponent.player.friendCode);
      if (!lifetime.current || lifetime.current.signal.aborted) return;
      setOpponent(relationshipFromState(state, opponent));
      await refresh();
    } catch (reason) {
      // An acknowledgement can fail after a successful commit. Fetch the real
      // relationship rather than assuming the request failed or succeeded.
      if (!lifetime.current || lifetime.current.signal.aborted) return;
      const message = connectionMessage(reason);
      const confirmed = await refresh();
      if (!lifetime.current || lifetime.current.signal.aborted) return;
      if (confirmed === null || confirmed?.relationship === 'outgoing' || confirmed?.relationship === 'homie' || confirmed?.relationship === 'incoming') {
        setError(null);
      } else {
        // Unknown or unchanged relationship: keep the failure visible and offer retry.
        setError(`Could not confirm the Homies action. ${message}`);
      }
      void social.query.refetch();
    } finally {
      locked.current = false;
      if (lifetime.current && !lifetime.current.signal.aborted) setWorking(false);
    }
  }
  return <div className="post-match-homie" data-testid="post-match-homie">
    {hidden ? (loading || error ? <div className="post-match-homie__status" role="status">
      {loading ? 'Checking rival…' : 'Could not check your rival.'}
      {!loading && <button type="button" onClick={() => void refresh()}>Retry</button>}
    </div> : null) : <>
      <div className="post-match-homie__identity">
        <span>YOUR RIVAL <strong>{opponent.player.displayName}</strong></span>
        <button type="button" className="online-secondary post-match-homie__button"
          data-testid="post-match-homie-action"
          disabled={working || loading || !!error || social.busy || !navigator.onLine || relation === 'outgoing' || relation === 'homie'}
          onClick={() => void act()}>
          {working ? 'Saving…' : relation === 'homie' ? 'Homies' : relation === 'outgoing' ? 'Request sent' : relation === 'incoming' ? 'Accept request' : 'Add Homie'}
        </button>
      </div>
      {(error || !navigator.onLine) && <div className="post-match-homie__status" role="alert">{error ? `Could not confirm your rival’s Homies status. ${error}` : 'Reconnect to add a Homie.'} <button type="button" onClick={() => { void social.query.refetch(); void refresh(); }}>Retry</button></div>}
    </>}
  </div>;
}