import { FadePark, FightTabs } from './FadePark';
import { useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ApiError, type PlayerBootstrap } from "@workspace/api-client-react";
import { Check, Copy } from "lucide-react";
import { starterRecipes, validateSavedDeck } from "../../data";
import { basePath } from "../../lib/routing";
import {
  createFriendMatch,
  joinFriendMatch,
  onlineErrorMessage,
  useFriendMatch,
} from "../../lib/multiplayer";
import { MultiplayerBattle } from "../../components/MultiplayerBattle";
import { FadeRules, FriendlyFadesHub } from "../../components/social/FriendlyFadesHub";
import { FadeAlleyScene } from "../../components/social/FadeAlleyScene";
import { CompactDeckPicker } from '../../components/CompactDeckPicker';
import { useSocial } from "../../lib/social";
import type { OnlineCommand } from "@workspace/squabblemon-engine/multiplayer";
import "../../styles/multiplayer.css";
import "../../styles/friendly-fades.css";
import { useEventVoice } from "../../lib/useEventVoice";

export function Multiplayer({ bootstrap, code }: { bootstrap: PlayerBootstrap; code?: string }) {
  const [, navigate] = useLocation();
  const friends = new URLSearchParams(useSearch()).get('tab') === 'friends';
  useEventVoice(friends && !code ? 'friendly-fade' : null);
  const { profile } = bootstrap;
  const social = useSocial();
  const saved = profile.savedDecks.filter(deck => validateSavedDeck(deck.cardIds, profile.ownedCardIds, deck.heroCardId).valid);
  const recipes = starterRecipes.filter(deck => validateSavedDeck(deck.catalogCardIds, profile.ownedCardIds, deck.hero).valid);
  const crews = [
    ...saved.map(deck => ({ id: deck.id, name: deck.name, heroCardId: deck.heroCardId!, cardIds: deck.cardIds })),
    ...recipes.filter(deck => !saved.some(s => s.id === deck.id))
      .map(deck => ({ id: deck.id, name: deck.name, heroCardId: deck.hero, cardIds: deck.catalogCardIds })),
  ];
  const [crewId, setCrewId] = useState(crews[0]?.id ?? "");
  const chosen = crews.find(crew => crew.id === crewId) ?? crews[0];
  const [enteredCode, setEnteredCode] = useState(code ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const operationLock = useRef(false);
  const createKey = useRef<{ deckId: string; id: string } | null>(null);
  const { query, mutation, accept, connected } = useFriendMatch(profile.id, code);
  const room = query.data;
  const joinable = !!code && query.error instanceof ApiError && query.error.status === 404;
  // Targeted rooms are matched to the shared social snapshot by room code.
  const targeted = code ? social.query.data?.invitations.find(item => item.roomCode === code) : undefined;
  function leave() {
    navigate(room?.ranked ? "/game/online" : "/game/online?tab=friends");
  }
  async function openRoom(join = false) {
    if (operationLock.current || !chosen) return;
    operationLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const target = (code ?? enteredCode).replace(/\s/g, "").toUpperCase();
      if (join && !/^[A-F0-9]{12}$/.test(target)) {
        setError("Enter the 12-character room code your friend shared.");
        return;
      }
      if (!createKey.current || createKey.current.deckId !== chosen.id)
        createKey.current = { deckId: chosen.id, id: crypto.randomUUID() };
      const next = join ? await joinFriendMatch(target, chosen.id) : await createFriendMatch(chosen.id, createKey.current.id);
      accept(next);
      createKey.current = null;
      navigate(`/game/online/${next.code}`);
    } catch (reason) {
      setError(onlineErrorMessage(reason));
    } finally {
      operationLock.current = false;
      setBusy(false);
    }
  }
  async function send(command: OnlineCommand) {
    if (!room || operationLock.current || mutation.isPending) return false;
    operationLock.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({ requestId: crypto.randomUUID(), expectedRevision: room.revision, command });
      return true;
    } catch (reason) {
      setError(onlineErrorMessage(reason));
      return false;
    } finally {
      operationLock.current = false;
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${basePath}/game/online/${room!.code}`);
      setCopied(true);
    } catch {
      setError("Copy the room code shown below and send it to your friend.");
    }
  }
  const working = busy || mutation.isPending;
  const errorBanner = error || (room && !connected ? "Connection interrupted. Reconnecting to your fade…" : null);
  if (room?.status === "active" || room?.status === "complete")
    return (
      <>
        {errorBanner && (
          <div className="online-connection" role="alert">
            {errorBanner}
            <button onClick={() => { setError(null); void query.refetch(); }}>Refresh fade</button>
          </div>
        )}
        <MultiplayerBattle
          key={`${room.code}:${room.gameNumber}`}
          room={room}
          busy={working}
          connected={connected}
          reducedMotion={profile.settings.reducedMotion}
          send={send}
          onLeave={leave}
        />
      </>
    );
  if (!code && !friends) return <FadePark bootstrap={bootstrap} />;

  const invitedPlayer = targeted?.direction === 'outgoing' ? targeted.player : null;
  let screen;
  if (!code) {
    screen = <FriendlyFadesHub accountId={profile.id} crews={crews} crewId={chosen?.id ?? ''} onCrew={setCrewId}
      roomBusy={busy} onOpenRoom={() => void openRoom()} onJoinCode={() => void openRoom(true)}
      enteredCode={enteredCode} onEnteredCode={setEnteredCode} />;
  } else if (!room && !joinable) {
    screen = <div className="sq-state">
      <h2>{query.isPending ? "Finding your fade…" : "Could not reach this room."}</h2>
      {query.isPending && <div className="sq-skeleton" aria-busy="true"><i /><i /></div>}
      {query.error && <><p>{onlineErrorMessage(query.error)}</p>
        <button className="sq-btn sq-btn--primary" onClick={() => void query.refetch()}>Retry connection</button></>}
      <button className="sq-btn" onClick={leave}>Back to Friendly Fades</button>
    </div>;
  } else if (room?.status === "closed") {
    screen = <div className="sq-state">
      <h2>This room has closed.</h2>
      <p>{targeted ? `The invite with ${targeted.player.displayName} is ${targeted.status}.` : 'Open a fresh challenge to play again.'}</p>
      <button className="sq-btn sq-btn--primary" onClick={leave}>Back to Friendly Fades</button>
    </div>;
  } else if (room) {
    const opponentSeat = room.seat === 'player' ? 'cpu' : 'player';
    const opponentJoined = !!room.members[opponentSeat];
    screen = <>
      <div className="fa-lobby fa-lobby--room">
        <section className="fa-control" aria-label="Room controls">
          <div className="fa-sectionhead">
            <h2 data-testid="online-room">{opponentJoined ? 'Rival joined' : invitedPlayer ? `Waiting on ${invitedPlayer.displayName}` : 'Room open'}</h2>
            {!invitedPlayer && room.seat === 'player' && !opponentJoined && <div className="fa-session__code">
              <span>ROOM CODE</span><strong data-testid="online-room-code">{room.code}</strong>
              <button type="button" onClick={() => void copyInvite()} data-testid="button-copy-room" aria-label={copied ? 'Link copied' : 'Copy invite link'}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>}
          </div>
          {invitedPlayer && !opponentJoined && <p className="fa-room-note">Only {invitedPlayer.displayName} can join. {targeted?.status === 'pending' ? 'Invite pending.' : targeted ? `Invite ${targeted.status}.` : ''}</p>}
          <div className="fa-session" aria-label="Room status and actions">
            <div className="fa-session__summary">
              <div className="fa-session__status"><small>YOUR CREW</small><strong>{room.ownDeck.name}</strong></div>
              <div className="fa-session__status"><small>{room.seat === 'player' ? 'RIVAL' : 'HOST'}</small><strong>{room.members[opponentSeat]?.name ?? invitedPlayer?.displayName ?? 'Open seat'}</strong></div>
            </div>
            <div className="fa-session__actions">
              <button className="fa-button fa-button--ready" data-testid="online-ready"
                disabled={working || !opponentJoined || room.members[room.seat]!.ready} onClick={() => void send({ type: "ready" })}>
                {room.members[room.seat]!.ready ? 'Ready. Waiting for your rival…' : !opponentJoined ? 'Waiting for your rival to join' : 'Ready to squabble'}</button>
              {invitedPlayer && targeted?.status === 'pending' && room.seat === 'player' && !opponentJoined && <button className="fa-button fa-button--secondary" disabled={working || social.busy} data-testid="button-cancel-targeted"
                onClick={() => { if (window.confirm(`Call off the invite to ${invitedPlayer.displayName}?`)) void social.respondInvitation(targeted.id, 'cancel').catch(reason => setError(onlineErrorMessage(reason))); }}>Cancel invite</button>}
              <button className="fa-button fa-button--secondary" disabled={working} onClick={() => void send({ type: "surrender" })}>Close room</button>
              <button className="fa-button fa-button--secondary" onClick={leave}>Back to Friendly Fades</button>
            </div>
          </div>
        </section>
      </div>
      <FadeRules />
    </>;
  } else {
    screen = <>
      <header className="sq-device__header">
        <span className="sq-kicker">ROOM {code}</span>
        <h1>{targeted?.direction === 'incoming' ? `${targeted.player.displayName} invited you.` : 'Join the room.'}</h1>
        {targeted?.direction === 'incoming' && targeted.status === 'pending' && <p>Use the invite to confirm your crew.</p>}
      </header>
      <section className="sq-card">
        {targeted?.direction === 'incoming' && targeted.status === 'pending'
          ? <button className="sq-btn sq-btn--primary sq-btn--wide" onClick={() => navigate(`/game/online?tab=friends&invite=${targeted.id}`)}>View invite</button>
          : crews.length ? <>
            <CompactDeckPicker decks={crews} selectedId={chosen?.id ?? ""} onSelect={setCrewId} disabled={working} label="Who are you bringing?" />
            <button className="sq-btn sq-btn--primary sq-btn--wide" disabled={working} onClick={() => void openRoom(true)}>{working ? "Joining…" : "Join your friend"}</button>
          </> : <><p>Save ten unique cards you own to enter a Friendly Fade.</p><Link className="sq-btn sq-btn--primary" to="/game/decks">Build your crew</Link></>}
        <button className="sq-btn sq-btn--ghost sq-btn--wide" onClick={leave}>Back to Friendly Fades</button>
      </section>
      <FadeRules />
    </>;
  }

  return (
    <main className="ff-stage ff-stage--alley" aria-label="Friendly Fades" tabIndex={-1}>
      <div className="ff-stage__alley">
      <header className="ff-stage__nav">
        <FightTabs friends />
      </header>
      <FadeAlleyScene
        rivalName={room ? room.members[room.seat === 'player' ? 'cpu' : 'player']?.name ?? invitedPlayer?.displayName : undefined}
        joined={!!room?.members[room.seat === 'player' ? 'cpu' : 'player']}
        invited={!!invitedPlayer}
        ready={!!room?.members[room.seat]?.ready}
        rivalReady={!!room?.members[room.seat === 'player' ? 'cpu' : 'player']?.ready}
        seat={room?.seat ?? 'player'} />
      <div className="ff-stage__content" aria-label="Friendly Fades controls" data-testid="friendly-fades-device">
        {errorBanner && <p className="sq-flash sq-flash--bad" role="alert">{errorBanner}</p>}
        {screen}
      </div>
      </div>
    </main>
  );
}
