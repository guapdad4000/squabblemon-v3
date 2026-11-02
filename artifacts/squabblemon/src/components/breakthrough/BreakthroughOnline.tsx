import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlayerBootstrap } from "@workspace/api-client-react";
import type {
  BreakthroughLobby,
  BreakthroughReceipt,
} from "@workspace/squabblemon-engine/breakthroughOnline";
import type { BreakthroughRoomView } from "@workspace/squabblemon-engine/breakthroughRoom";
import { buildBreakthroughRoster } from "@workspace/squabblemon-engine/breakthroughCatalog";
import { CompactDeckPicker } from "../CompactDeckPicker";
import { accountPracticeDecks, practiceDeckLegality } from "./practiceDecks";
import { usePersistentDeckSelection } from "../../lib/deckSelection";
import {
  breakthroughRequest,
  BreakthroughConnection,
} from "../../lib/breakthroughOnline";
import { getCardImage } from "../../data";
import BreakthroughArena from "./BreakthroughArena";
import { BREAKTHROUGH_TROPHY } from "./progressionArt";
import "./production.css";
/** Same saved-deck picker, account identity and arena artwork as practice; live controls send intent only. */
export default function BreakthroughOnline({
  bootstrap,
}: {
  bootstrap: PlayerBootstrap;
}) {
  const { profile } = bootstrap,
    client = useQueryClient();
  const [, navigate] = useLocation();
  const decks = useMemo(
    () => accountPracticeDecks(profile),
    [profile.savedDecks, profile.ownedCardIds],
  );
  const [selected, select] = usePersistentDeckSelection(
    profile.id,
    decks.map((d) => d.id),
  );
  const deck = decks.find((d) => d.id === selected),
    legal = deck && practiceDeckLegality(deck, profile.ownedCardIds).valid;
  const [roomId, setRoomId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lobby = useQuery({
    queryKey: ["breakthrough-lobby", profile.id],
    queryFn: ({ signal }) =>
      breakthroughRequest<BreakthroughLobby>("", undefined, signal),
    enabled: !roomId,
    refetchInterval: (q) =>
      q.state.data?.search?.status === "waiting" ? 2000 : 30000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  useEffect(() => {
    const search = lobby.data?.search;
    if (
      search?.status === "paired" ||
      (search?.status === "complete" &&
        !sessionStorage.getItem(
          `breakthrough-result-seen:${profile.id}:${search.roomId}`,
        ))
    )
      setRoomId(search.roomId);
  }, [lobby.data]);
  const scope = `breakthrough-search:${profile.id}`;
  async function search() {
    if (!deck || !legal || busy) return;
    setBusy(true);
    setError("");
    try {
      const stored = sessionStorage.getItem(scope),
        prior = stored ? JSON.parse(stored) : null;
      const request = prior ?? {
        deckId: deck.id,
        requestId: crypto.randomUUID(),
      };
      if (request.deckId !== deck.id)
        throw Error(
          "Recover or cancel your previous search before changing decks.",
        );
      sessionStorage.setItem(scope, JSON.stringify(request));
      const result = await breakthroughRequest<BreakthroughLobby["search"]>(
        "/search",
        request,
      );
      if (result?.roomId) setRoomId(result.roomId);
      if (result?.status === "cancelled" || result?.status === "complete")
        sessionStorage.removeItem(scope);
      await client.invalidateQueries({
        queryKey: ["breakthrough-lobby", profile.id],
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to search. Retry to recover your search.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    const requestId =
      lobby.data?.search?.requestId ??
      JSON.parse(sessionStorage.getItem(scope) ?? "null")?.requestId;
    if (!requestId) return;
    setBusy(true);
    setError("");
    try {
      const result = await breakthroughRequest<BreakthroughLobby["search"]>(
        "/cancel",
        { requestId },
      );
      sessionStorage.removeItem(scope);
      if (result?.status === "paired") setRoomId(result.roomId);
      await client.invalidateQueries({
        queryKey: ["breakthrough-lobby", profile.id],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry cancellation.");
    } finally {
      setBusy(false);
    }
  }
  if (roomId)
    return (
      <OnlineMatch
        key={`${profile.id}:${roomId}`}
        bootstrap={bootstrap}
        roomId={roomId}
        onExit={() => navigate("/game/kumite")}
        onLobby={() => {
          sessionStorage.removeItem(scope);
          sessionStorage.setItem(
            `breakthrough-result-seen:${profile.id}:${roomId}`,
            "1",
          );
          setRoomId(null);
          void client.invalidateQueries({
            queryKey: ["breakthrough-lobby", profile.id],
          });
        }}
      />
    );
  const waiting = lobby.data?.search?.status === "waiting";
  return (
    <main className="bt-lobby" data-testid="breakthrough-online-lobby">
      <header className="bt-lobby-nav">
        <Link href="/game/kumite">← KUMITE</Link>
        <span>LIVE PVP</span>
      </header>
      <section
        className="bt-lobby-stage"
        aria-label="Find a Breakthrough opponent"
      >
        <div className="bt-lobby-title">
          <small>KUMITE</small>
          <h1>
            BREAK
            <br />
            THROUGH.
          </h1>
          <img src={BREAKTHROUGH_TROPHY} alt="Breakthrough fist trophy" />
        </div>
        <div className="bt-lobby-crew">
          <h2>{profile.displayName}</h2>
          <p>{lobby.data?.record.trophies ?? 0} BREAKTHROUGH TROPHIES</p>
          <CompactDeckPicker
            decks={decks}
            selectedId={selected}
            onSelect={(id) => {
              if (!waiting && !busy) select(id);
            }}
            label="Choose your Breakthrough deck"
          />
          {!legal && <p>Choose a saved gang of ten unique cards you own.</p>}
          <div className="bt-lobby-actions">
            <button
              className="bt-primary"
              disabled={busy || (!waiting && !legal)}
              onClick={() => void (waiting ? cancel() : search())}
            >
              {busy
                ? "CONNECTING…"
                : waiting
                  ? "CANCEL SEARCH"
                  : "FIND OPPONENT →"}
            </button>
            {error && !waiting && (
              <button
                className="bt-text-button"
                disabled={busy}
                onClick={() => void cancel()}
              >
                CANCEL PREVIOUS SEARCH
              </button>
            )}
          </div>
          <p role="status">
            {waiting
              ? "Searching for another player…"
              : error ||
                lobby.error?.message ||
                "Your match continues if you disconnect. Reopen Breakthrough to recover it."}
          </p>
          <p>
            Completed active matches earn Breakthrough trophies: win +20, draw
            +3, loss −6 (minimum 0). First 20 rated matches per UTC day; first 3
            against each opponent. Both players must deploy twice and play at
            least 30 seconds.
          </p>
        </div>
      </section>
    </main>
  );
}
export function OnlineMatch({
  bootstrap,
  roomId,
  onExit,
  onLobby,
}: {
  bootstrap: PlayerBootstrap;
  roomId: string;
  onExit(): void;
  onLobby(): void;
}) {
  const { profile } = bootstrap;
  const [view, setView] = useState<BreakthroughRoomView | null>(null),
    [message, setMessage] = useState("Connecting…");
  const connection = useRef<BreakthroughConnection | null>(null);
  const roster = useMemo(
    () =>
      buildBreakthroughRoster((card) =>
        getCardImage(card.catalogId, profile.equippedVariants[card.catalogId]),
      ),
    [profile.equippedVariants],
  );
  useEffect(() => {
    setView(null);
    setMessage("Connecting…");
    const current = new BreakthroughConnection(
      profile.id,
      roomId,
      setView,
      setMessage,
    );
    connection.current = current;
    void current.start();
    return () => {
      current.stop();
      if (connection.current === current) connection.current = null;
    };
  }, [profile.id, roomId]);
  const receipt = useQuery({
    queryKey: ["breakthrough-receipt", profile.id, roomId],
    queryFn: ({ signal }) =>
      breakthroughRequest<BreakthroughReceipt | null>(
        `/${roomId}/receipt`,
        undefined,
        signal,
      ),
    enabled: !!view && view.phase !== "active",
    refetchInterval: (q) =>
      q.state.data
        ? false
        : Math.min(
            30000,
            1000 *
              2 **
                Math.min(q.state.dataUpdateCount + q.state.errorUpdateCount, 5),
          ),
    refetchIntervalInBackground: false,
    retry: false,
  });
  if (!view)
    return (
      <main className="bt-lobby">
        <p role="status">{message}</p>
        <button onClick={onExit}>BACK TO KUMITE</button>
      </main>
    );
  return (
    <BreakthroughArena
      roster={roster}
      playerDeck={[]}
      opponentDeck={[]}
      initialSeed={0}
      identity={{
        name: profile.displayName,
        avatarKey: profile.avatarKey,
        heroCardId: profile.avatarKey,
        level: profile.level,
      }}
      preferredReducedMotion={profile.settings.reducedMotion}
      onChangeDeck={onLobby}
      onExit={onExit}
      online={{
        view,
        message,
        receipt: receipt.data ?? null,
        command: (intent) => void connection.current?.command(intent),
      }}
    />
  );
}
