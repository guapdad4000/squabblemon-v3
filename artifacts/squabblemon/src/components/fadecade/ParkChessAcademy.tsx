import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PlayerBootstrap } from "@workspace/api-client-react";
import type { ParkChessMove, ParkChessPromotion } from "@workspace/squabblemon-engine/parkChess";
import {
  PARK_CHESS_LESSONS, createParkChessLesson, getParkChessLessonView,
  playParkChessLessonMove, advanceParkChessLesson, resetParkChessLesson,
  type ParkChessLessonId, type ParkChessLessonState,
} from "@workspace/squabblemon-engine/parkChessLessons";
import { HandFist } from "lucide-react";
import { getAssetUrl } from "../../lib/assets";
import { FadecadeDialog } from "./FadecadeDialog";
import { ParkChessBoard, ChessPiece, chessPieceNames } from "./ParkChessBoard";
import { ParkChessBeginnerGuide } from "./ParkChessBeginnerGuide";
import "../../styles/park-chess-academy.css";

const lessonPortraits = { "move-capture": "p", "protect-guap": "k", "ashlee-mate": "q" } as const;

/** Guided local practice never calls ranked APIs or changes tickets/campaigns. */
export default function ParkChessAcademy({ bootstrap, onExit }: { bootstrap: PlayerBootstrap; onExit: () => void }) {
  const [state, setState] = useState<ParkChessLessonState | null>(null);
  const [completed, setCompleted] = useState<Set<ParkChessLessonId>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [focusSquare, setFocusSquare] = useState("e2");
  const [hint, setHint] = useState(false);
  const [error, setError] = useState("");
  const [guide, setGuide] = useState(false);
  const [promotion, setPromotion] = useState<ParkChessMove[] | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const instruction = useRef<HTMLHeadingElement | null>(null);
  const picker = useRef<HTMLElement | null>(null);
  const showingLesson = !!state;
  const view = useMemo(() => state ? getParkChessLessonView(state) : null, [state]);
  const locked = !view || view.status === "success" || view.phase === "complete";
  const legal = view?.legalMoves.filter(move => move.from === selected) ?? [];
  useLayoutEffect(() => {
    if (focusRequest) (showingLesson ? instruction.current : picker.current)?.focus({ preventScroll: true });
  }, [focusRequest, showingLesson]);

  function load(next: ParkChessLessonState | null) {
    setState(next);
    setSelected(null);
    setHint(false);
    setError("");
    setPromotion(null);
    if (next) setFocusSquare(getParkChessLessonView(next).expectedMove.from);
    setFocusRequest(previous => previous + 1);
  }
  function play(choice: ParkChessMove) {
    if (!state || locked) return;
    try {
      const next = playParkChessLessonMove(state, { from: choice.from, to: choice.to, ...(choice.promotion ? { promotion: choice.promotion } : {}) });
      setState(next);
      setSelected(null);
      setError("");
      setHint(false);
      setPromotion(null);
      if (next.phase === "complete") setCompleted(previous => new Set(previous).add(next.lessonId));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Try the guided move shown in the hint.");
      setSelected(null);
      setHint(true);
      setPromotion(null);
    }
  }
  function select(square: string) {
    if (!view || locked) return;
    const choices = legal.filter(move => move.to === square);
    if (choices.length) {
      if (choices.some(move => move.promotion)) setPromotion(choices);
      else play(choices[0]);
    } else setSelected(view.board.find(piece => piece.square === square)?.color === "w" && selected !== square ? square : null);
  }

  return <main className="park-chess park-chess-academy" aria-label="Check the Block chess academy" data-reduced-motion={bootstrap.profile.settings.reducedMotion} data-lesson={state?.lessonId} data-lesson-step={state?.stepIndex} data-lesson-phase={state?.phase} data-lesson-status={state?.status} style={{ "--park-scene": `url("${getAssetUrl("assets/park-chess/park-table.webp")}")` } as CSSProperties}>
    <header className="park-chess__header"><div><small>CHECK THE BLOCK / PRACTICE TABLE</small><h1>LEARN CHESS</h1></div><div className="park-chess-academy__nav"><button onClick={() => setGuide(true)}>Chess for beginners</button><button onClick={onExit}>Return to match</button></div></header>
    {!view ? <section className="park-chess-academy__picker" ref={picker} tabIndex={-1} aria-label="Choose a guided chess lesson"><p>Three guided tables. Replay whenever you want; your ranked match stays saved.</p><div>{PARK_CHESS_LESSONS.map(lesson => <button key={lesson.id} className="park-chess-academy__card" aria-label={`Start ${lesson.title}`} onClick={() => load(createParkChessLesson(lesson.id))}>
      <span className="park-chess-academy__portrait"><ChessPiece type={lessonPortraits[lesson.id]} color="w" /></span><span><small>{lesson.steps.length} GUIDED STEPS</small><strong>{lesson.title}</strong><p>{lesson.subtitle}</p><b>{completed.has(lesson.id) ? "PRACTICED · REPLAY →" : "START LESSON →"}</b></span>
    </button>)}</div><small>LOCAL PRACTICE · NO TICKETS OR RANKED PROGRESS</small></section>
      : <div className="park-chess__layout">
        <section className="park-chess__table" aria-label="Guided practice table">
          <div className="park-chess__player"><span>GUIDED TABLE</span><strong>{view.lesson.title}</strong><b>{view.stepIndex + 1}/{view.lesson.steps.length}</b></div>
          <ParkChessBoard board={view.board} legalMoves={view.legalMoves} turn={view.turn} inCheck={view.inCheck} lastMove={view.lastMove} selected={selected} locked={locked} focusSquare={focusSquare} onFocusSquare={setFocusSquare} onSelect={select} onEscape={() => { setSelected(null); setPromotion(null); }} hint={hint && !locked ? view.expectedMove : null} />
          <div className="park-chess__player park-chess__player--you"><span>YOU · WHITE</span><strong>{bootstrap.profile.displayName}</strong><b>FREE PRACTICE</b></div>
        </section>
        <aside className="park-chess__panel park-chess-academy__panel" aria-label="Lesson instructions">
          <div className="park-chess__status" role="status" aria-live="polite"><small>STEP {view.stepIndex + 1} OF {view.lesson.steps.length}</small><h2 ref={instruction} tabIndex={-1}>{view.phase === "complete" ? "LESSON COMPLETE" : view.status === "success" ? "NICE MOVE" : view.step.title}</h2>
            {view.phase === "complete" && <HandFist className="park-chess-academy__complete" aria-hidden="true" />}
            <p>{view.status === "success" ? view.feedback : view.step.instruction}</p>
            {view.lastBotMove && <p className="park-chess__moves">RIVAL REPLIED <b>{view.lastBotMove.san}</b></p>}
          </div>
          {error && <p className="park-chess-academy__feedback" role="alert">{error}</p>}
          {hint && !locked && <p className="park-chess-academy__hint">{view.step.hint}</p>}
          <div className="park-chess__actions">
            {view.phase === "complete" ? <button className="park-chess__primary" onClick={() => load(resetParkChessLesson(view))}>Replay lesson</button>
              : view.status === "success" ? <button className="park-chess__primary" onClick={() => load(advanceParkChessLesson(view))}>Next step</button>
              : <button onClick={() => { setHint(!hint); setError(""); }}>{hint ? "Hide hint" : "Show hint"}</button>}
            <button onClick={() => load(resetParkChessLesson(view))}>Restart lesson</button><button onClick={() => load(null)}>Choose lesson</button>
          </div>
          <p className="park-chess-academy__practice-note">Practice only. Your match and tickets stay untouched.</p>
        </aside>
      </div>}
    <FadecadeDialog open={guide || !!promotion} onOpenChange={open => { if (!open) { setGuide(false); setPromotion(null); } }} title={promotion ? "Choose your promotion" : "Chess for beginners"} kind="training">
      {promotion ? <div className="park-chess__promotion">{(["q", "r", "b", "n"] as ParkChessPromotion[]).map(type => <button key={type} aria-label={chessPieceNames[type]} onClick={() => { const choice = promotion.find(move => move.promotion === type); if (choice) play(choice); }}><ChessPiece type={type} color="w" /><span>{chessPieceNames[type]}</span></button>)}</div> : <ParkChessBeginnerGuide />}
    </FadecadeDialog>
  </main>;
}
