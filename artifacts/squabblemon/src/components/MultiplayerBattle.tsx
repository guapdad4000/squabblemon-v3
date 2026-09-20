import { useFeedbackPreferences } from "../hooks/useFeedbackPreferences";
import { MusicControls } from "./MusicControls";
import { useEffect, useRef, useState } from "react";
import { Flag, Swords, Volume2, VolumeX } from "lucide-react";
import { cards, getAssetUrl, getCardImage } from "../data";
import { BattleFeedback } from "../battleFeedback";
import { BattleDragOverlay, useBattleDrag } from "./useBattleDrag";
import { CardView } from "./CardView";
import { LocationNode } from "./LocationArtwork";
import type { CSSProperties } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { SUMMON_TEMPLATES, type CardInstance } from "../gameEngine";
import {
  otherSeat,
  TURN_SECONDS,
  type OnlineCommand,
  type OnlineRoomView,
  type PublicCard,
  type Seat,
} from "@workspace/squabblemon-engine/multiplayer";

const cardDefinition = (id: string) =>
  cards[id] ?? SUMMON_TEMPLATES[id as keyof typeof SUMMON_TEMPLATES];
export const asCard = (card: PublicCard): CardInstance => ({
  ...cardDefinition(card.cardId),
  ...card,
  id: card.artworkId ?? cardDefinition(card.cardId).id,
  deck: "online",
  playedRound: null,
  lastEffectNote: "",
});
const formationStyle = (laneCards: PublicCard[], owner: Seat): CSSProperties => {
  const count = laneCards.filter(card => card.owner === owner).length;
  const columns = count > 4 ? 3 : 2;
  return { "--formation-columns": columns, "--formation-rows": Math.max(1, Math.ceil(count / columns)) } as CSSProperties;
};

type Props = {
  room: OnlineRoomView;
  busy: boolean;
  connected: boolean;
  reducedMotion: boolean;
  send: (command: OnlineCommand) => Promise<boolean> | void;
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
  const [districtInfo, setDistrictInfo] = useState<number | null>(null);
  const [matchInfo, setMatchInfo] = useState(false);
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
  const inspectedCard = [...room.hand, ...room.boards.flat()].find(
    (card) => card.instanceId === inspect,
  );
  const inspectionCard = inspectedCard ? asCard(inspectedCard) : null;
  const picked = room.hand.find((card) => card.instanceId === selected) ?? null;
  useEffect(() => {
    if (
      selected &&
      (!myTurn || !room.hand.some((card) => card.instanceId === selected))
    ) {
      setSelected(null);
      setLane(null);
      setSquabble(false);
    }
  }, [myTurn, room.hand, selected]);
  const canPlay =
    interactive &&
    picked &&
    lane !== null &&
    !room.lockedLanes?.includes(lane) &&
    picked.costs[lane] <= room.motion[room.seat];
  const drag = useBattleDrag({
    enabled: interactive,
    contextKey: `${room.gameNumber}:${room.round}:${room.events.at(-1)?.sequence ?? 0}`,
    hasCard: (instanceId) =>
      room.hand.some((card) => card.instanceId === instanceId),
    getChoice: (instanceId, lane) => {
      const card = room.hand.find((card) => card.instanceId === instanceId);
      const cost = card?.costs[lane] ?? 0;
      const locked = room.lockedLanes?.includes(lane);
      const allowed =
        Boolean(card) && !locked && cost <= room.motion[room.seat];
      return {
        allowed,
        cost,
        message: locked
          ? `${room.districts[lane].name}: closed to direct plays.`
          : allowed
            ? `Release to play · ${room.districts[lane].name} · ${cost} Motion`
            : `${room.districts[lane].name}: need ${Math.max(0, cost - room.motion[room.seat])} more Motion.`,
      };
    },
    onStart: (instanceId) => {
      if (selected !== instanceId) setSquabble(false);
      setSelected(instanceId);
      setLane(null);
    },
    onDrop: (instanceId, lane) =>
      act({
        type: "play",
        instanceId,
        lane,
        squabble: selected === instanceId && squabble,
      }),
  });
  const draggedCard = room.hand.find(
    (card) => card.instanceId === drag.drag?.instanceId,
  );
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
  async function act(command: OnlineCommand) {
    feedback.current?.unlockAudio();
    if ((await send(command)) === false) return;
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
      data-revision={room.revision}
      data-connected={connected}
      data-status={room.status}
      data-reduced-motion={reducedMotion ? "true" : "false"}
    >
      <BattleDragOverlay
        controller={drag}
        card={draggedCard ? asCard(draggedCard) : undefined}
        squabble={squabble}
      />
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
                    <b data-score-owner={rivalSeat}>
                      {score?.[rivalSeat] ?? 0}
                    </b>
                    <span>RIVAL / YOU</span>
                    <b data-score-owner={room.seat}>
                      {score?.[room.seat] ?? 0}
                    </b>
                  </div>
                </header>
                <button
                  type="button"
                  className="online-district-info"
                  aria-label={`Rules for ${district.name}`}
                  onClick={() => setDistrictInfo(index)}
                >
                  District rules
                </button>
                {district.status && (
                  <p className="online-district__status">{district.status}</p>
                )}
              </div>
              <div className="online-district__sides">
                {[rivalSeat, room.seat].map((owner) => (
                  <div
                    className="online-board-row"
                    style={formationStyle(room.boards[index], owner)}
                    key={owner}
                    data-side={owner === room.seat ? "you" : "rival"}
                    data-owner={owner}
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
                          data-instance={card.instanceId}
                        >
                          <CardView
                            card={asCard(card)}
                            onInspect={() => setInspect(card.instanceId)}
                            covered={card.covered}
                            isBoard
                            isEnemy={owner !== room.seat}
                            effectivePower={card.power}
                            disableLayout
                            onClick={() => setInspect(card.instanceId)}
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
                    room.lockedLanes?.includes(target) ||
                    picked.costs[target] > room.motion[room.seat]
                  }
                  aria-label={`Choose ${district.name} · ${picked.costs[target]} Motion`}
                  aria-pressed={lane === target}
                  onClick={() => setLane(target)}
                >
                  <span>
                    {room.lockedLanes?.includes(target)
                      ? "Closed"
                      : lane === target
                        ? "Selected"
                        : "Choose"}
                  </span>
                  <small>{picked.costs[target]} Motion</small>
                </button>
              )}
            </section>
          );
        })}
      </section>
      <p
        className="online-last-play"
        key={`${room.gameNumber}:${latest?.sequence ?? 0}`}
      >
        <span>
          {latest ? (latest.owner === room.seat ? "YOU" : rival.name) : "LIVE"}
        </span>{" "}
        {latest?.note ?? "Both gangs are here. Take two districts."}
      </p>
      {room.status === "active" ? (
        <section className="online-hand-area" aria-label="Your hand">
          <div className="online-hand-heading">
            <strong>
              {room.motion[room.seat]} <small>MOTION</small>
            </strong>
            <span>
              {picked
                ? cards[picked.cardId].effect
                : "Drag to a district · Tap to select · Hold for details"}
            </span>
          </div>
          <div className="online-hand" data-testid="online-hand" data-drag-hand>
            {room.hand.map((card) => (
              <div className="online-hand-card" key={card.instanceId}>
                <CardView
                  card={asCard(card)}
                  onInspect={() => setInspect(card.instanceId)}
                  testId={`online-card-${card.cardId}`}
                  dragEnabled={interactive}
                  queued={selected === card.instanceId}
                  effectivePower={card.power}
                  cost={Math.min(...card.costs)}
                  disableLayout
                  unavailable={Math.min(...card.costs) > room.motion[room.seat]}
                  onClick={() => {
                    if (!interactive) {
                      setInspect(card.instanceId);
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
                ? "The fade ended by surrender."
                : "Six rounds. Scores settled."}{" "}
            Friendly fades award no currency or rank.
          </p>
          <button
            className="online-primary"
            disabled={busy || room.rematch[room.seat]}
            onClick={() => act({ type: "rematch" })}
          >
            {room.rematch[room.seat]
              ? "Waiting for your rival…"
              : room.rematch[rivalSeat]
                ? "Accept runback"
                : "Run it back"}
          </button>
          <button className="online-secondary" onClick={onLeave}>
            Back to rooms
          </button>
          {room.revealedDecks && (
            <details>
              <summary>Both gangs</summary>
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
        <button className="online-text" onClick={() => setMatchInfo(true)}>
          Rules & recent plays
        </button>
        <span className="online-live" role="status">
          {connected ? "● Live fade" : "○ Reconnecting…"}
        </span>
        {room.status === "active" && (
          <button
            className="online-text"
            onClick={() => setConfirmSurrender(true)}
          >
            Surrender
          </button>
        )}
      </footer>
      <Dialog
        open={districtInfo !== null}
        onOpenChange={(open) => {
          if (!open) setDistrictInfo(null);
        }}
      >
        <DialogContent className="online-dialog">
          <DialogTitle>
            {districtInfo !== null && room.districts[districtInfo].name}
          </DialogTitle>
          <DialogDescription>
            {districtInfo !== null && room.districts[districtInfo].rule}
          </DialogDescription>
          {districtInfo !== null && (
            <p>{room.districts[districtInfo].status}</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={matchInfo} onOpenChange={setMatchInfo}>
        <DialogContent className="online-dialog">
          <DialogTitle>Rules & recent plays</DialogTitle>
          <DialogDescription>
            Win two districts over six rounds. Play cards within your Motion,
            then end your turn. The first player alternates each round. Each
            gang has one SQUABBLE. All moves use base tiers. Your {TURN_SECONDS}
            -second clock continues during disconnections; running out of time
            forfeits the fade.
          </DialogDescription>
          <ol className="online-event-list">
            {room.events
              .filter((event) => event.type !== "reveal")
              .map((event) => (
                <li key={event.sequence}>
                  <b>{event.owner === room.seat ? "You" : rival.name}:</b>{" "}
                  {event.note}
                </li>
              ))}
          </ol>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!inspect}
        onOpenChange={(open) => {
          if (!open) setInspect(null);
        }}
      >
        <DialogContent className="online-dialog">
          {inspectionCard && (
            <>
              <img src={getCardImage(inspectionCard.id)} alt="" />
              <DialogTitle>{inspectionCard.name}</DialogTitle>
              <DialogDescription>{inspectionCard.effect}</DialogDescription>
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
            Surrender ends this fade as a loss.
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
              void act({ type: "surrender" });
            }}
          >
            Surrender fade
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
