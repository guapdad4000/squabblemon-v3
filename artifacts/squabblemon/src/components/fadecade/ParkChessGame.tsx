import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from "@workspace/api-client-react";
import { getParkChessTier, PARK_CHESS_TIERS, type ParkChessView, type ParkChessPromotion, type ParkChessMove } from "@workspace/squabblemon-engine/parkChess";
import { PARK_CHESS_RATING_START, PARK_CHESS_RATING_PROVISIONAL_GAMES, type ParkChessRatingState, type ParkChessRatingChange } from "@workspace/squabblemon-engine/parkChessRating";
import { HandFist } from "lucide-react";
import { getAssetUrl } from "../../lib/assets";
import { GameGlyph } from "../venue/GameGlyph";
import { FadecadeDialog } from "./FadecadeDialog";
import { ParkChessBoard, ChessPiece as Piece, chessStartingBoard as startingBoard, chessPieceNames as pieceNames, chessPieceIdentities as pieceIdentities } from "./ParkChessBoard";
import { ParkChessBeginnerGuide } from "./ParkChessBeginnerGuide";
import "../../styles/park-chess.css";

export type ParkChessStatus = {
  run: ParkChessView | null;
  campaign: { wins: number; losses: number; draws: number; games: number; tier: number };
  earned: { packTickets: number; softCurrency: number; styleShards: number };
  rating?: ParkChessRatingState;
  runRating?: { opponent: number; change: ParkChessRatingChange | null; rated: boolean } | null;
  serverNow: number;
};
const endpoint = "/api/player/park-chess";
const ParkChessAcademy = lazy(() => import("./ParkChessAcademy"));

export default function ParkChessGame({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const client = useQueryClient();
  const key = ["park-chess", bootstrap.profile.id];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => customFetch<ParkChessStatus>(endpoint, { signal }), refetchOnWindowFocus: false, retry: 1 });
  const [academyOpen, setAcademyOpen] = useState(false);
  const academyTrigger = useRef<HTMLButtonElement | null>(null);
  const returnAcademyFocus = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusSquare, setFocusSquare] = useState("e2");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<"help" | "resign" | null>(null);
  const [promotion, setPromotion] = useState<ParkChessMove[] | null>(null);
  const [tierChoice, setTierChoice] = useState<{ tier: number; unlocked: number } | null>(null);
  const pending = useRef<{ path: string; body: unknown } | null>(null);
  const command = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const rewardSeen = useRef<string | null>(null);
  const status = query.data;
  const run = status?.run;
  const board = useMemo(() => new Map((run?.board ?? startingBoard).map(piece => [piece.square as string, piece])), [run?.board]);
  const unlockedTier = getParkChessTier(status?.campaign.tier ?? 1).id;
  // A newly unlocked rival becomes the default. Replays remain selected while
  // the unlocked frontier stays the same, including after a finished replay.
  const chosenTier = tierChoice?.unlocked === unlockedTier && tierChoice.tier <= unlockedTier ? tierChoice.tier : unlockedTier;
  const tier = getParkChessTier(run?.tier ?? chosenTier);
  const finished = !!run && run.phase !== "active";
  const activeMatch = !!run && !finished;
  const nextTier = activeMatch ? run.tier : chosenTier;
  const rating = status?.rating ?? { value: PARK_CHESS_RATING_START, games: 0, peak: PARK_CHESS_RATING_START };
  const ratingChange = status?.runRating?.change;
  const locked = busy || query.isFetching || !!error || !run || finished || run.turn !== "w";
  const legal = run?.legalMoves.filter(move => move.from === selected) ?? [];
  const lastMove = run?.lastBotMove ?? run?.lastPlayerMove;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; command.current?.abort(); };
  }, []);
  useEffect(() => { setSelected(null); setPromotion(null); }, [run?.id, run?.revision]);
  useEffect(() => {
    if (!academyOpen && returnAcademyFocus.current) {
      returnAcademyFocus.current = false;
      academyTrigger.current?.focus({ preventScroll: true });
    }
  }, [academyOpen]);
  useEffect(() => {
    if (run?.phase === "won" && status?.earned.packTickets === 1 && rewardSeen.current !== run.id) {
      rewardSeen.current = run.id;
      void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
    }
  }, [run?.id, run?.phase, status?.earned.packTickets, client]);

  async function send(path: string, body: unknown) {
    if (inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    command.current = controller;
    pending.current = { path, body };
    setBusy(true);
    setError("");
    try {
      const next = await customFetch<ParkChessStatus>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      if (!mounted.current) return;
      pending.current = null;
      client.setQueryData(key, next);
      setSelected(null);
      setPromotion(null);
      setDialog(null);
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Your move could not be confirmed. Retry safely.");
        setPromotion(null);
        setDialog(null);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function move(choice: ParkChessMove) {
    if (!run || locked || pending.current) return;
    void send(`${endpoint}/${run.id}/move`, { revision: run.revision, actionId: crypto.randomUUID(), move: { from: choice.from, to: choice.to, ...(choice.promotion ? { promotion: choice.promotion } : {}) } });
  }
  function select(square: string) {
    if (locked) return;
    const choices = legal.filter(move => move.to === square);
    if (choices.length) {
      if (choices.some(choice => choice.promotion)) setPromotion(choices);
      else move(choices[0]);
    } else setSelected(board.get(square)?.color === "w" && selected !== square ? square : null);
  }
  const phaseLabel = busy ? "Saving move · rival thinking…" : run?.phase === "won" ? "CHECKMATE · YOU WON" : run?.phase === "lost" ? "CHECKMATE · RIVAL WON"
    : run?.phase === "draw" ? "DRAW · MATCH SAVED" : run?.phase === "resigned" ? "MATCH RESIGNED" : run?.inCheck ? "CHECK · PROTECT YOUR LEADER" : run ? "YOUR MOVE" : "TAKE A SEAT";

  function openAcademy() { setDialog(null); setPromotion(null); setAcademyOpen(true); }
  if (academyOpen) return <Suspense fallback={<main className="park-chess park-chess--loading">SETTING UP YOUR PRACTICE TABLE…</main>}><ParkChessAcademy bootstrap={bootstrap} onExit={() => { returnAcademyFocus.current = true; setAcademyOpen(false); }} /></Suspense>;

  if (query.isPending || query.isError || !status) return <main className="park-chess park-chess--loading"><h1>CHECK THE BLOCK</h1><p role="status">{query.isError ? "Could not restore your table." : "Finding your seat…"}</p>{query.isError && <button onClick={() => void query.refetch()}>Retry connection</button>}<button ref={academyTrigger} onClick={openAcademy}>Learn chess</button></main>;

  return <main className="park-chess" aria-label="Check the Block chess game" data-reduced-motion={bootstrap.profile.settings.reducedMotion} style={{ "--park-scene": `url("${getAssetUrl("assets/park-chess/park-table.webp")}")` } as CSSProperties}>
    <header className="park-chess__header"><div><small>THE PARK / REAL CHESS</small><h1>CHECK THE BLOCK</h1></div><div className="park-chess__record"><span><b>{status.campaign.wins}</b> WINS</span><span><GameGlyph name="ticket" /><b>1</b> EVERY WIN</span></div></header>
    <div className="park-chess__layout">
      <section className="park-chess__table" aria-label="Chess table">
        <div className="park-chess__player"><span>RIVAL · BLACK</span><strong>{tier.name}</strong><b>TIER {tier.id}/5</b></div>
        <ParkChessBoard board={run?.board ?? startingBoard} legalMoves={run?.legalMoves ?? []} turn={run?.turn ?? "w"} inCheck={run?.inCheck ?? false} lastMove={lastMove} selected={selected} locked={locked} busy={busy} focusSquare={focusSquare} onFocusSquare={setFocusSquare} onSelect={select} onEscape={() => { setSelected(null); setPromotion(null); }} />
        <div className="park-chess__player park-chess__player--you"><span>YOU · WHITE</span><strong>{bootstrap.profile.displayName}</strong><b><HandFist aria-hidden="true" /> YOUR CREW</b></div>
      </section>
      <aside className="park-chess__panel" aria-label="Match progress and controls">
        <div className="park-chess__rating" aria-label={`Park Rating ${rating.value}, peak ${rating.peak}, ${rating.games} rated games`}><div><small>PARK RATING</small><strong>{rating.value}</strong></div><span>{rating.games < PARK_CHESS_RATING_PROVISIONAL_GAMES ? `PROVISIONAL ${rating.games}/${PARK_CHESS_RATING_PROVISIONAL_GAMES}` : `${rating.games} RATED GAMES`}<b>PEAK {rating.peak}</b></span></div>
        <div className="park-chess__status" role="status" aria-live="polite"><small>{run ? `SAVED MATCH · TURN ${Math.floor(run.moves.length / 2) + 1}` : "FRESH TABLE"}</small><h2>{phaseLabel}</h2>
          {run?.phase === "won" && status.earned.packTickets === 1 && <p className="park-chess__reward"><GameGlyph name="ticket" /> +1 PACK TICKET BANKED</p>}
          {finished && ratingChange && <p className="park-chess__rating-change" data-result={ratingChange.result}>{ratingChange.delta > 0 ? "+" : ""}{ratingChange.delta} PARK RATING <span>{ratingChange.before} → {ratingChange.after}</span></p>}
          {run && status.runRating?.rated === false && <p className="park-chess__unrated">Older saved match · unrated. Your tickets and tier progress still count.</p>}
          {run?.phase === "draw" && <p>{run.reason?.replaceAll("-", " ")}. No ticket awarded.</p>}
          {!finished && <p>{selected ? `${pieceNames[board.get(selected)?.type ?? "p"]} ${selected.toUpperCase()} · ${legal.length ? "choose a marked square" : "no legal destinations"}` : run ? "Choose a Squabbler, then its destination." : "Checkmate the rival. Every win earns one ticket."}</p>}
        </div>
        <div className="park-chess__captures"><div aria-label="Pieces you captured"><small>YOU TOOK</small><div>{run?.captured.b.length ? run.captured.b.map((type, i) => <Piece key={i} type={type} color="b" compact />) : <span>—</span>}</div></div><div aria-label="Pieces rival captured"><small>RIVAL TOOK</small><div>{run?.captured.w.length ? run.captured.w.map((type, i) => <Piece key={i} type={type} color="w" compact />) : <span>—</span>}</div></div></div>
        {(run?.lastPlayerMove || run?.lastBotMove) && <p className="park-chess__moves">LAST TURN <b>{run.lastPlayerMove?.san ?? "—"}</b> / <b>{run.lastBotMove?.san ?? "—"}</b></p>}
        <fieldset className="park-chess__tier-picker" aria-describedby="park-chess-tier-note">
          <legend>{activeMatch ? "SAVED RIVAL" : "CHOOSE YOUR RIVAL"}<span>UNLOCKED {unlockedTier}/5</span></legend>
          <div className="park-chess__tier-options">{PARK_CHESS_TIERS.map(opponent => {
            const lockedTier = opponent.id > unlockedTier;
            return <label key={opponent.id} data-selected={nextTier === opponent.id} data-locked={lockedTier} data-disabled={activeMatch || busy || query.isFetching || !!error || lockedTier}>
              <input type="radio" name="park-chess-tier" value={opponent.id} checked={nextTier === opponent.id} disabled={activeMatch || busy || query.isFetching || !!error || lockedTier} aria-label={`Tier ${opponent.id}, ${opponent.name}${lockedTier ? ", locked" : ""}`} onChange={() => setTierChoice({ tier: opponent.id, unlocked: unlockedTier })} />
              <b>{opponent.id}</b><span>{opponent.name}</span>{lockedTier && <small>LOCKED</small>}
            </label>;
          })}</div>
          <p id="park-chess-tier-note">{activeMatch ? `Your tier ${run.tier} match is saved. Finish it to choose another rival.` : unlockedTier < 5 ? `Beat tier ${unlockedTier} to unlock tier ${unlockedTier + 1}. Replay any unlocked rival; every win banks one ticket.` : "All five rivals unlocked. Replay any tier; every win banks one ticket."}</p>
        </fieldset>
        <div className="park-chess__actions">
          {(!run || finished) && <button className="park-chess__primary" disabled={busy || query.isFetching || !!error} onClick={() => void send(endpoint + "/start", { requestId: crypto.randomUUID(), tier: chosenTier })}>{busy ? "Taking your seat…" : run ? `Play tier ${chosenTier}` : "New match"}</button>}
          {run && !finished && <button disabled={busy || query.isFetching || !!error} onClick={() => setDialog("resign")}>Resign</button>}
          <button onClick={() => setDialog("help")}>How to play</button>
          <button ref={academyTrigger} onClick={openAcademy}>Learn chess</button>
        </div>
        {error && <div className="park-chess__error" role="alert"><p>{error}</p><button disabled={busy} onClick={() => { const request = pending.current; if (request) void send(request.path, request.body); }}>Retry saved action</button><button disabled={busy} onClick={() => { pending.current = null; setError(""); setSelected(null); setPromotion(null); setDialog(null); void query.refetch(); }}>Sync match</button></div>}
      </aside>
    </div>
    <FadecadeDialog open={!!dialog || !!promotion} onOpenChange={open => { if (!open && !busy) { setDialog(null); setPromotion(null); } }} title={promotion ? "Choose your promotion" : dialog === "resign" ? "Resign this match?" : "Check the Block"} kind="training">
      {promotion ? <div className="park-chess__promotion">{(["q", "r", "b", "n"] as ParkChessPromotion[]).map(type => <button key={type} aria-label={pieceNames[type]} disabled={busy} onClick={() => { const choice = promotion.find(move => move.promotion === type); if (choice) move(choice); }}><Piece type={type} color="w" /><span>{pieceNames[type]}</span>{pieceIdentities[type] && <small>{pieceIdentities[type]}</small>}</button>)}</div>
        : dialog === "resign" ? <><p>Your saved match ends without a ticket. Wins and unlocked tiers stay earned.</p><button className="park-chess__primary" disabled={busy || !!error} onClick={() => { if (run) void send(`${endpoint}/${run.id}/resign`, { revision: run.revision, actionId: crypto.randomUUID() }); }}>Confirm resignation</button></>
        : <ParkChessBeginnerGuide />}
    </FadecadeDialog>
  </main>;
}
