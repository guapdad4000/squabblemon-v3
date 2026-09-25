import { StreetSelect } from '../../components/ui/street-select';
import { FadePark, FightTabs } from './FadePark';
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ApiError, type PlayerBootstrap } from "@workspace/api-client-react";
import { ArrowUpRight, Check, Copy, KeyRound, MapPin, Swords, Users } from "lucide-react";
import {
  getAssetUrl,
  getCardImage,
  starterRecipes,
  validateSavedDeck,
} from "../../data";
import { basePath } from "../../lib/routing";
import {
  createFriendMatch,
  joinFriendMatch,
  listFriendMatches,
  onlineErrorMessage,
  useFriendMatch,
} from "../../lib/multiplayer";
import { MultiplayerBattle } from "../../components/MultiplayerBattle";
import { InstallGame } from "../../components/InstallGame";
import type { OnlineCommand } from "@workspace/squabblemon-engine/multiplayer";
import "../../styles/multiplayer.css";
import { useEventVoice } from "../../lib/useEventVoice";

export function Multiplayer({
  bootstrap,
  code,
}: {
  bootstrap: PlayerBootstrap;
  code?: string;
}) {
  const [, navigate] = useLocation();
  const friends = new URLSearchParams(useSearch()).get('tab') === 'friends';
  useEventVoice(friends && !code ? 'friendly-fade' : null);
  const { profile } = bootstrap;
  const saved = profile.savedDecks.filter(
    (deck) =>
      validateSavedDeck(deck.cardIds, profile.ownedCardIds, deck.heroCardId)
        .valid,
  );
  const recipes = starterRecipes.filter(
    (deck) =>
      validateSavedDeck(deck.catalogCardIds, profile.ownedCardIds, deck.hero)
        .valid,
  );
  const crews = [
    ...saved.map((deck) => ({
      id: deck.id,
      name: deck.name,
      hero: deck.heroCardId!,
      cardIds: deck.cardIds,
    })),
    ...recipes
      .filter((deck) => !saved.some((s) => s.id === deck.id))
      .map((deck) => ({
        id: deck.id,
        name: deck.name,
        hero: deck.hero,
        cardIds: deck.catalogCardIds,
      })),
  ];
  const [crewId, setCrewId] = useState(crews[0]?.id ?? "");
  const chosen = crews.find((crew) => crew.id === crewId) ?? crews[0];
  const [enteredCode, setEnteredCode] = useState(code ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const operationLock = useRef(false);
  const createKey = useRef<{ deckId: string; id: string } | null>(null);
  const { query, mutation, accept, connected } = useFriendMatch(
    profile.id,
    code,
  );
  const rooms = useQuery({
    queryKey: ["friend-rooms", profile.id],
    queryFn: listFriendMatches,
    enabled: !code && friends,
    refetchInterval: 10000,
    retry: 1,
  });
  const room = query.data;
  const joinable =
    !!code && query.error instanceof ApiError && query.error.status === 404;
  useEffect(() => {
    if (code)
      sessionStorage.setItem(
        "squabblemon_friend_invite",
        `/game/online/${code}`,
      );
  }, [code]);
  function leave() {
    sessionStorage.removeItem("squabblemon_friend_invite");
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
        setError("Enter the 12-character code your friend shared.");
        return;
      }
      if (!createKey.current || createKey.current.deckId !== chosen.id)
        createKey.current = { deckId: chosen.id, id: crypto.randomUUID() };
      const next = join
        ? await joinFriendMatch(target, chosen.id)
        : await createFriendMatch(chosen.id, createKey.current.id);
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
      await mutation.mutateAsync({
        requestId: crypto.randomUUID(),
        expectedRevision: room.revision,
        command,
      });
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
      await navigator.clipboard.writeText(
        `${window.location.origin}${basePath}/game/online/${room!.code}`,
      );
      setCopied(true);
    } catch {
      setError("Copy the room code shown below and send it to your friend.");
    }
  }
  const working = busy || mutation.isPending;
  const errorBanner =
    error ||
    (room && !connected
      ? "Connection interrupted. Reconnecting to your fade…"
      : null);
  if (room?.status === "active" || room?.status === "complete")
    return (
      <>
        {errorBanner && (
          <div className="online-connection" role="alert">
            {errorBanner}
            <button
              onClick={() => {
                setError(null);
                void query.refetch();
              }}
            >
              Refresh fade
            </button>
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
  return (
    <main className="online-lobby fight-night" aria-label="Friendly Fade’s lobby" tabIndex={-1}>
      <div className="fight-night__lights" aria-hidden="true"><i /><i /></div>
      <img
        className="online-lobby__venue"
        src={getAssetUrl("assets/fight-night/rooms/rooftop-court.webp")}
        alt=""
      />
      <header className="online-lobby__nav">

        <FightTabs friends />
        <Link to="/game/training">Training Circuit</Link>
      </header>
      <div className="online-lobby__content">
        <div className="fight-night__tools">
          <InstallGame />
        </div>
        <div className="fight-night__poster">
        <section className="online-lobby__hero">
          <div className="fight-night__copy">
            <span className="online-eyebrow">
              <Users size={16} /> PRIVATE 1V1 · NO RANK ON THE LINE
            </span>
            <h1>
              Friendly
              <br />
              <em>Fade.</em>
            </h1>
            <p>Bring your crew, send the code, and settle it somewhere worth remembering.</p>
            <div className="fight-night__stage-label">
              <MapPin size={16} />
              <span><small>TONIGHT'S STAGE</small>Moonline Rooftop</span>
            </div>
          </div>
          <div className="online-lobby__fighters" aria-hidden="true">
            <img src={getCardImage(chosen?.hero ?? "ganger-red")} alt="" />
            <img src={getCardImage("ganger-blue")} alt="" />
            <span className="fight-night__versus">VS</span>
          </div>
        </section>
        <div className="fight-night__ticket"><span>PRIVATE 1V1</span><b>6 ROUNDS</b><span>3 DISTRICTS</span><b>NO RANK LOSS</b></div>
        </div>
        {errorBanner && (
          <p className="online-notice" role="alert">
            {errorBanner}
          </p>
        )}
        {code && !room && !joinable ? (
          <section className="online-room-panel">
            <h2>
              {query.isPending
                ? "Searching for a fade…"
                : "Could not connect to this room."}
            </h2>
            {query.error && (
              <>
                <p>{onlineErrorMessage(query.error)}</p>
                <button
                  className="online-primary"
                  onClick={() => void query.refetch()}
                >
                  Retry connection
                </button>
              </>
            )}
            <button className="online-secondary" onClick={leave}>
              Back to rooms
            </button>
          </section>
        ) : room?.status === "closed" ? (
          <section className="online-room-panel">
            <h2>This room has closed.</h2>
            <p>Create a fresh challenge to play again.</p>
            <button className="online-primary" onClick={leave}>
              Back to rooms
            </button>
          </section>
        ) : room ? (
          <section className="online-room-panel" data-testid="online-room">
            <div className="fight-night__panel-heading">
              <span>PRIVATE ROOM</span>
              <strong>Moonline Rooftop</strong>
            </div>
            <div className="online-room-title">
              <div>
                <span className="online-eyebrow">YOUR PRIVATE ROOM</span>
                <h2>
                  {room.members.cpu
                    ? "The rivalry is ready."
                    : "Call your rival."}
                </h2>
              </div>
              <button
                className="online-secondary"
                onClick={() => void copyInvite()}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? "Link copied" : "Copy invite link"}
              </button>
            </div>
            <div className="online-room-code">
              <span>ROOM CODE</span>
              <strong data-testid="online-room-code">{room.code}</strong>
            </div>
            <div className="online-room-members">
              {(["player", "cpu"] as const).map((seat) => (
                <div key={seat}>
                  <img
                    src={getCardImage(
                      room.members[seat]?.hero ?? "ganger-blue",
                    )}
                    alt=""
                  />
                  <strong>
                    {room.members[seat]?.name ?? "Waiting for your friend"}
                  </strong>
                  <span>
                    {room.members[seat]?.ready
                      ? "READY"
                      : room.members[seat]
                        ? seat === room.seat
                          ? "YOU"
                          : "JOINED"
                        : "Share the code to invite them"}
                  </span>
                </div>
              ))}
            </div>
            <p>
              Your gang: <strong>{room.ownDeck.name}</strong>.{" "}
              {room.members[room.firstThisRound]?.name ?? "Your rival"} starts
              round one; the starting player switches each round.
            </p>
            <button
              className="online-primary"
              data-testid="online-ready"
              disabled={
                working || !room.members.cpu || room.members[room.seat]!.ready
              }
              onClick={() => void send({ type: "ready" })}
            >
              {room.members[room.seat]!.ready
                ? "Ready. Waiting for your rival…"
                : "Ready to squabble"}
            </button>
            <button
              className="online-secondary"
              disabled={working}
              onClick={() => void send({ type: "surrender" })}
            >
              Close room
            </button>
          </section>
        ) : (
          <section className="online-room-panel">
            <div className="fight-night__panel-heading">
              <span>{joinable ? `INVITE ${code}` : "CHALLENGE DESK"}</span>
              <strong>{joinable ? "Join the room" : "Set the matchup"}</strong>
            </div>
            {crews.length ? (
              <>
                <label className="online-crew-label" htmlFor="online-crew">
                  Who are you bringing?
                </label>
                <StreetSelect
                  id="online-crew"
                  value={chosen?.id ?? ""}
                  onValueChange={event => setCrewId(event)}
                  disabled={working}
                >
                  {crews.map((crew) => (
                    <option key={crew.id} value={crew.id}>
                      {crew.name}
                    </option>
                  ))}
                </StreetSelect>
                <div className="online-lineup">
                  {chosen?.cardIds.map((id) => (
                    <img key={id} src={getCardImage(id)} alt="" />
                  ))}
                </div>
                {joinable ? (
                  <button
                    className="online-primary"
                    disabled={working}
                    onClick={() => void openRoom(true)}
                  >
                    {working ? "Joining…" : "Join your friend"}
                  </button>
                ) : (
                  <div className="online-room-options">
                    <button
                      className="online-primary"
                      aria-label="Create friend fade"
                      disabled={working}
                      onClick={() => void openRoom()}
                    >
                      <Swords size={18} />
                      {working ? "Opening the room…" : "Open a private room"}
                    </button>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void openRoom(true);
                      }}
                    >
                      <label htmlFor="online-code"><KeyRound size={14} /> Have a room code?</label>
                      <div>
                        <input
                          id="online-code"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={12}
                          placeholder="12-character code"
                          value={enteredCode}
                          onChange={(event) =>
                            setEnteredCode(event.target.value.toUpperCase())
                          }
                        />
                        <button
                          className="online-secondary"
                          aria-label="Join room"
                          disabled={working || !enteredCode}
                        >
                          Enter
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2>Bring a complete gang.</h2>
                <p>Save ten unique cards you own to enter a friend fade.</p>
                <Link className="online-primary" to="/game/decks">
                  Build your gang
                </Link>
              </>
            )}
          </section>
        )}
        <div className="online-rules">
          <span>BASE STRENGTH</span>
          <span>ONE SQUABBLE EACH</span>
          <span>75 SEC TURNS</span>
          <p>
            Cards hit the table face-up. Your hand stays private. Miss the timer
            and you forfeit the fade. No currency or rank changes hands.
          </p>
        </div>
        {!code && (
          <section className="online-recent">
            <div className="online-recent__heading">
              <div><span>THE SPOTS</span><h2>Your rooms</h2></div>
              <p>Every rivalry deserves a scene.</p>
            </div>
            {rooms.isError ? (
              <p>
                Could not load your rooms.{" "}
                <button onClick={() => void rooms.refetch()}>Retry</button>
              </p>
            ) : rooms.isPending ? (
              <p>Loading rooms…</p>
            ) : !rooms.data?.rooms.length ? (
              <div className="online-recent__empty">
                <article className="online-recent__preview online-recent__preview--roof">
                  <span>Tonight</span><strong>Moonline Rooftop</strong>
                </article>
                <article className="online-recent__preview online-recent__preview--wash">
                  <span>After hours</span><strong>Spin Cycle</strong>
                </article>
                <article className="online-recent__preview online-recent__preview--rail">
                  <span>Last train</span><strong>Highline Table</strong>
                </article>
              </div>
            ) : (
              <div className="online-recent__grid">
                {rooms.data.rooms.map((item, index) => (
                  <Link className={`online-recent__room online-recent__room--${index % 3}`} key={item.code} to={`/game/online/${item.code}`}>
                    <span className="online-recent__status">
                      {item.status === "active" ? "LIVE NOW" : item.status === "waiting" ? "OPEN ROOM" : "FINAL"}
                    </span>
                    <strong>{item.rival}</strong>
                    <span>{item.code} <ArrowUpRight size={15} /></span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
