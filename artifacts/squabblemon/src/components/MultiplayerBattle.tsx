import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import { MusicControls } from './MusicControls';
import { useEffect, useRef, useState } from "react";
import { Flag, Swords, Volume2, VolumeX } from "lucide-react";
import { cards, getAssetUrl, getCardImage } from "../data";
import {
  BattleFeedback,
} from "../battleFeedback";
import { BattleDragOverlay, useBattleDrag } from './useBattleDrag';
import { CardView } from "./CardView";
import { LocationNode } from "./LocationArtwork";
import type { CSSProperties } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import type { CardInstance } from "../gameEngine";
import {
  otherSeat,
  TURN_SECONDS,
  type OnlineCommand,
  type OnlineRoomView,
  type PublicCard,
} from "@workspace/squabblemon-engine/multiplayer";

const asCard = (card: PublicCard): CardInstance => ({
  ...cards[card.cardId],
  ...card,
  deck: "online",
  playedRound: null,
  lastEffectNote: "",
});
type Props = {
  room: OnlineRoomView;
  busy: boolean;
  connected: boolean;
  reducedMotion: boolean;
  send: (command: OnlineCommand) => void;
  onLeave: () => void;
};
export function MultiplayerBattle({
  room,
  busy,
  connected,
  reducedMotion,
  send,
  onLeave,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [lane, setLane] = useState<0 | 1 | 2 | null>(null);
  const [squabble, setSquabble] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [now, setNow] = useState(Date.now);
  const clockOffset = useRef(room.serverTime - Date.now());
  const [preferences, setPreferences] = useFeedbackPreferences();
  const feedback = useRef<BattleFeedback | null>(null);
  const seenEvent = useRef(room.events.at(-1)?.sequence ?? 0);
  useEffect(() => {
    feedback.current = new BattleFeedback(preferences);
    return () => {
      feedback.current?.reset();
      feedback.current = null;
    };
  }, []);
  useEffect(() => {
    feedback.current?.setPreferences(preferences);
  }, [preferences]);
  useEffect(() => {
    clockOffset.current = room.serverTime - Date.now();
  }, [room.serverTime]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const events = room.events.filter(
      (event) => event.sequence > seenEvent.current,
    );
    seenEvent.current = room.events.at(-1)?.sequence ?? seenEvent.current;
    if (!events.length || document.hidden) return;
    const event =
      events.find((e) => e.type === "play") ??
      events.find((e) => e.type === "ability");
    if (event)
      feedback.current?.cue(
        event.note.includes("SQUABBLE")
          ? "squabble"
          : event.type === "play"
            ? "play"
            : event.kind === "move"
              ? "move"
              : "status",
        reducedMotion,
      );
  }, [room.events, reducedMotion]);
  const rivalSeat = otherSeat(room.seat),
    rival = room.members[rivalSeat]!;
  const remaining = Math.max(
    0,
    Math.ceil(((room.deadline ?? now) - now - clockOffset.current) / 1000),
  );
  const myTurn = room.status === "active" && room.activeSeat === room.seat;
  const interactive = myTurn && connected && !busy && remaining > 0;
  const picked = room.hand.find((card) => card.instanceId === selected) ?? null;
  const canPlay =
    interactive &&
    picked &&
    lane !== null &&
    picked.costs[lane] <= room.motion[room.seat];
  const drag = useBattleDrag({
    enabled: interactive, contextKey: `${room.gameNumber}:${room.round}:${room.events.at(-1)?.sequence ?? 0}`,
    hasCard: instanceId => room.hand.some(card => card.instanceId === instanceId),
    getChoice: (instanceId, lane) => {
      const card = room.hand.find(card => card.instanceId === instanceId);
      const cost = card?.costs[lane] ?? 0;
      const allowed = Boolean(card) && cost <= room.motion[room.seat];
      return { allowed, cost, message: allowed ? `Release to play · ${room.districts[lane].name} · ${cost} Motion`
        : `${room.districts[lane].name}: need ${Math.max(0, cost - room.motion[room.seat])} more Motion.` };
    },
    onStart: instanceId => {
      if (selected !== instanceId) setSquabble(false);
      setSelected(instanceId); setLane(null);
    },
    onDrop: (instanceId, lane) => act({ type: 'play', instanceId, lane, squabble: selected === instanceId && squabble }),
  });
  const draggedCard = room.hand.find(card => card.instanceId === drag.drag?.instanceId);
  const latest = [...room.events]
    .reverse()
    .find((event) => event.type !== "reveal");
  const claims = (owner: "player" | "cpu") =>
    room.scores.filter((score) => score.winner === owner).length;
  const result =
    room.winner === "draw"
      ? "Nobody owns the room."
      : room.winner === room.seat
        ? "You won the room."
        : `${rival.name} takes the room.`;
  function act(command: OnlineCommand) {
    feedback.current?.unlockAudio();
    send(command);
    setSelected(null);
    setLane(null);
    setSquabble(false);
  }
  return (
    <main
      {...drag.rootProps}
      className="online-arena"
      data-testid="online-battle"
      data-turn={myTurn ? "you" : "rival"}
      data-round={room.round}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <BattleDragOverlay controller={drag} card={draggedCard ? asCard(draggedCard) : undefined} squabble={squabble} />
      <img
        className="online-arena__venue"
        src={getAssetUrl("assets/venues/red-fence-night-court.webp")}
        alt=""
      />
      <header className="online-arena__hud">
        <div className="online-contender">
          <img src={getCardImage(room.members[room.seat]!.hero)} alt="" />
          <div>
            <small>
              YOU ·{" "}
              {room.squabble[room.seat] ? "SQUABBLE USED" : "SQUABBLE READY"}
            </small>
            <strong>{room.members[room.seat]!.name}</strong>
          </div>
        </div>
        <div className="online-round">
          <span>ROUND</span>
          <strong>
            {room.round}
            <small>/6</small>
          </strong>
          <span>GAME {room.gameNumber}</span>
        </div>
        <div className="online-contender online-contender--rival">
          <img src={getCardImage(rival.hero)} alt="" />
          <div>
            <small>
              {room.rivalHandCount} IN HAND ·{" "}
              {room.squabble[rivalSeat] ? "SQUABBLE USED" : "SQUABBLE READY"}
            </small>
            <strong>{rival.name}</strong>
          </div>
        </div>
      </header>
      <div className="online-turn" role="status">
        <strong>
          {room.status === "complete"
            ? result
            : !connected
              ? "Reconnecting…"
              : myTurn
                ? "Your turn. Make it count."
                : `${rival.name} is playing.`}
        </strong>
        {room.status === "active" && (
          <span
            className={
              remaining <= 15
                ? "online-clock online-clock--urgent"
                : "online-clock"
            }
            aria-label={`${remaining} seconds left`}
          >
            {remaining}s
          </span>
        )}
        <button
          type="button"
          className="online-icon"
          aria-label={
            preferences.audioEnabled
              ? "Mute battle audio"
              : "Enable battle audio"
          }
          onClick={() => {
            feedback.current?.unlockAudio();
            setPreferences((p) => ({ ...p, audioEnabled: !p.audioEnabled }));
          }}
        >
          {preferences.audioEnabled ? (
            <Volume2 size={18} />
          ) : (
            <VolumeX size={18} />
          )}
        </button>
        <MusicControls compact />
      </div>
      <div className="online-claims">
        <Flag size={15} /> You {claims(room.seat)} · {rival.name}{" "}
        {claims(rivalSeat)} <span>Control two districts to win</span>
      </div>
      <section className="online-districts" aria-label="Battle districts">
        {room.districts.map((district, index) => {
          const target = index as 0 | 1 | 2,
            score = room.scores[index];
          return (
            <section
              key={district.name}
              data-location={district.id}
              style={{ "--district-accent": district.accent } as CSSProperties}
              data-drop-lane={target}
              data-drop-state={drag.laneState(target)}
              className={`online-district ${lane === index && picked ? "is-selected" : ""}`}
              data-winner={
                score?.winner === room.seat
                  ? "you"
                  : score?.winner === rivalSeat
                    ? "rival"
                    : "draw"
              }
            >
              <div className="online-location-heading">
              <LocationNode id={district.id} index={index} />
              <header>
                <h2>{district.name}</h2>
                <div>
                  <b>{score?.[room.seat] ?? 0}</b>
                  <span>YOU / RIVAL</span>
                  <b>{score?.[rivalSeat] ?? 0}</b>
                </div>
              </header>
              <p className="online-district__rule">{district.rule}</p>
              {district.status && (
                <p className="online-district__status">{district.status}</p>
              )}
              </div>
              <div className="online-district__sides">
                {[rivalSeat, room.seat].map((owner) => (
                  <div
                    className="online-board-row"
                    key={owner}
                    aria-label={`${owner === room.seat ? "Your" : "Rival"} cards in ${district.name}`}
                  >
                    <span className="online-side-label">
                      {owner === room.seat ? "YOU" : "RIVAL"}
                    </span>
                    {room.boards[index]
                      .filter((card) => card.owner === owner)
                      .map((card) => (
                        <div
                          className="online-board-card"
                          key={card.instanceId}
                        >
                          <CardView
                            card={asCard(card)}
                            onInspect={() => setInspect(card.cardId)}
                            covered={card.covered}
                            isBoard
                            isEnemy={owner !== room.seat}
                            effectivePower={card.power}
                            disableLayout
                            onClick={() => setInspect(card.cardId)}
                          />
                        </div>
                      ))}
                    {!room.boards[index].some(
                      (card) => card.owner === owner,
                    ) && (
                      <span className="online-empty-side">
                        {owner === room.seat
                          ? "Your territory"
                          : "Rival territory"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {picked && room.status === "active" && (
                <button
                  className="online-place"
                  disabled={
                    !interactive ||
                    picked.costs[target] > room.motion[room.seat]
                  }
                  aria-pressed={lane === target}
                  onClick={() => setLane(target)}
                >
                  Choose {district.name} · {picked.costs[target]} Motion
                </button>
              )}
            </section>
          );
        })}
      </section>
      {latest && (
        <p
          className="online-last-play"
          key={`${room.gameNumber}:${latest.sequence}`}
        >
          <span>{latest.owner === room.seat ? "YOU" : rival.name}</span>{" "}
          {latest.note}
        </p>
      )}
      {room.status === "active" ? (
        <section className="online-hand-area" aria-label="Your hand">
          <div className="online-hand-heading">
            <strong>
              {room.motion[room.seat]} <small>MOTION</small>
            </strong>
            <span>
              {picked
                ? cards[picked.cardId].effect
                : "Drag to play, tap to select, or hold for details. Swipe sideways to browse."}
            </span>
          </div>
          <div className="online-hand" data-testid="online-hand" data-drag-hand>
            {room.hand.map((card) => (
              <div className="online-hand-card" key={card.instanceId}>
                <CardView
                  card={asCard(card)}
                            onInspect={() => setInspect(card.cardId)}
                  testId={`online-card-${card.cardId}`}
                  dragEnabled={interactive}
                  queued={selected === card.instanceId}
                  effectivePower={card.power}
                  cost={Math.min(...card.costs)}
                  disableLayout
                  unavailable={
                    !interactive ||
                    Math.min(...card.costs) > room.motion[room.seat]
                  }
                  onClick={() => {
                    if (!interactive) {
                      setInspect(card.cardId);
                      return;
                    }
                    feedback.current?.unlockAudio();
                    setSelected(
                      selected === card.instanceId ? null : card.instanceId,
                    );
                    setLane(null);
                    setSquabble(false);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="online-actions">
            <button
              className="online-squabble"
              aria-pressed={squabble}
              disabled={!interactive || !picked || room.squabble[room.seat]}
              onClick={() => setSquabble((value) => !value)}
            >
              {room.squabble[room.seat] ? "SQUABBLE used" : "SQUABBLE ×2"}
            </button>
            <button
              className="online-primary"
              data-testid="online-play-card"
              disabled={!canPlay}
              onClick={() =>
                picked &&
                lane !== null &&
                act({
                  type: "play",
                  instanceId: picked.instanceId,
                  lane,
                  squabble,
                })
              }
            >
              <Swords size={17} />
              {busy
                ? "Sending…"
                : picked && lane === null
                  ? "Choose district"
                  : "Play card"}
            </button>
            <button
              className="online-secondary"
              data-testid="online-end-turn"
              disabled={!interactive}
              onClick={() => act({ type: "end-turn" })}
            >
              End turn
            </button>
          </div>
        </section>
      ) : (
        <section className="online-result" data-testid="online-result">
          <h1>{result}</h1>
          <p>
            {room.reason === "timeout"
              ? "The turn clock expired."
              : room.reason === "surrender"
                ? "The match ended by surrender."
                : "Six rounds. Scores settled."}{" "}
            Friendly matches award no currency or rank.
          </p>
          <button
            className="online-primary"
            disabled={busy || room.rematch[room.seat]}
            onClick={() => act({ type: "rematch" })}
          >
            {room.rematch[room.seat]
              ? "Waiting for your rival…"
              : room.rematch[rivalSeat]
                ? "Accept rematch"
                : "Run it back"}
          </button>
          <button className="online-secondary" onClick={onLeave}>
            Back to rooms
          </button>
          {room.revealedDecks && (
            <details>
              <summary>Both crews</summary>
              {[room.seat, rivalSeat].map((owner) => (
                <p key={owner}>
                  <strong>{room.members[owner]!.name}:</strong>{" "}
                  {room
                    .revealedDecks![owner].cards.map((id) => cards[id].name)
                    .join(" · ")}
                </p>
              ))}
            </details>
          )}
        </section>
      )}
      <footer className="online-battle-footer">
        <details>
          <summary>Match rules</summary>
          <p>
            Take turns playing as many cards as your Motion allows, then end
            your turn. The starting player switches each round. Each player has
            one SQUABBLE. All cards use base move tiers. Your {TURN_SECONDS}
            -second turn clock continues while reconnecting; an expired turn
            forfeits the match.
          </p>
        </details>
        {room.status === "active" && (
          <button
            className="online-text"
            onClick={() => setConfirmSurrender(true)}
          >
            Surrender
          </button>
        )}
        <details>
          <summary>Recent plays</summary>
          <ol>
            {room.events
              .filter((event) => event.type !== "reveal")
              .map((event) => (
                <li key={event.sequence}>
                  {event.owner === room.seat ? "You" : rival.name}: {event.note}
                </li>
              ))}
          </ol>
        </details>
      </footer>
      <Dialog
        open={!!inspect}
        onOpenChange={(open) => {
          if (!open) setInspect(null);
        }}
      >
        <DialogContent className="online-dialog">
          {inspect && (
            <>
              <img src={getCardImage(cards[inspect].id)} alt="" />
              <DialogTitle>{cards[inspect].name}</DialogTitle>
              <DialogDescription>{cards[inspect].effect}</DialogDescription>
              <button
                className="online-primary"
                onClick={() => setInspect(null)}
              >
                Back to battle
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmSurrender} onOpenChange={setConfirmSurrender}>
        <DialogContent className="online-dialog">
          <DialogTitle>Leave this one to your rival?</DialogTitle>
          <DialogDescription>
            Surrender ends this match as a loss.
          </DialogDescription>
          <button
            className="online-primary"
            onClick={() => setConfirmSurrender(false)}
          >
            Keep playing
          </button>
          <button
            className="online-secondary"
            disabled={busy}
            onClick={() => {
              setConfirmSurrender(false);
              act({ type: "surrender" });
            }}
          >
            Surrender match
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
