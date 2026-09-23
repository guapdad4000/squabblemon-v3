import { getAssetUrl } from '../../../data';
import { type StoryPuzzleDefinition } from '@workspace/squabblemon-engine/story';
import { type StoryPuzzleCompletion, useCompletePlayerStoryPuzzle } from '@workspace/api-client-react';
import { useState, useRef, useEffect, KeyboardEvent, PointerEvent as ReactPointerEvent, DragEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { createPortal } from 'react-dom';
import '../../../styles/puzzle.css';

export function StoryPuzzle({
  puzzle,
  nodeId,
  onCompleted,
  onClose,
}: {
  puzzle: StoryPuzzleDefinition;
  nodeId: string;
  onCompleted: (result: StoryPuzzleCompletion) => void;
  onClose: () => void;
}) {
  const completePuzzle = useCompletePlayerStoryPuzzle();
  const [pieces, setPieces] = useState(puzzle.pieces.map(p => p.id));
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const requestLockRef = useRef(false);
  const requestIdentityRef = useRef<{ signature: string; key: string } | null>(null);
  const pointerPieceRef = useRef<string | null>(null);

  const handleSubmit = async (skip: boolean = false) => {
    if (requestLockRef.current) return;
    requestLockRef.current = true;
    setSubmitting(true);
    setErrorMsg(null);
    const signature = skip ? `${nodeId}:skip` : `${nodeId}:order:${pieces.join(',')}`;
    if (requestIdentityRef.current?.signature !== signature) {
      requestIdentityRef.current = { signature, key: crypto.randomUUID() };
    }
    try {
      const result = await completePuzzle.mutateAsync({
        data: {
          nodeId,
          idempotencyKey: requestIdentityRef.current.key,
          order: skip ? undefined : pieces,
          skip
        }
      });
      onCompleted(result);
    } catch (e: any) {
      if (e.status === 400 && !skip) {
        setErrorMsg("That evidence order is not correct yet. Rearrange the pieces and submit again.");
      } else {
        setErrorMsg("The puzzle could not reach the server. Your evidence order and hints are saved here; please retry.");
      }
      setSubmitting(false);
    } finally {
      requestLockRef.current = false;
    }
  };

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (submitting || fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= pieces.length || toIdx >= pieces.length) return;
    setPieces(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      const movedPiece = puzzle.pieces.find(piece => piece.id === moved);
      setAnnouncement(`${movedPiece?.label ?? 'Evidence'} moved to position ${toIdx + 1} of ${copy.length}.`);
      return copy;
    });
  };

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      moveItem(index, index - 1);
      setTimeout(() => (listRef.current?.children[index - 1] as HTMLElement)?.focus(), 0);
    }
    if (e.key === 'ArrowDown' && index < pieces.length - 1) {
      e.preventDefault();
      moveItem(index, index + 1);
      setTimeout(() => (listRef.current?.children[index + 1] as HTMLElement)?.focus(), 0);
    }
  };

  const moveDraggedPiece = (pieceId: string, toIdx: number) => {
    const fromIdx = pieces.indexOf(pieceId);
    if (fromIdx !== -1) moveItem(fromIdx, toIdx);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>, pieceId: string) => {
    if (submitting || e.pointerType === 'mouse') return;
    pointerPieceRef.current = pieceId;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const pieceId = pointerPieceRef.current;
    if (!pieceId) return;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-puzzle-piece]');
    const targetId = target?.dataset.puzzlePiece;
    if (targetId && targetId !== pieceId) {
      const toIdx = pieces.indexOf(targetId);
      moveDraggedPiece(pieceId, toIdx);
    }
  };

  const endPointerDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    pointerPieceRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleDragStart = (e: DragEvent<HTMLButtonElement>, pieceId: string) => {
    if (submitting) {
      e.preventDefault();
      return;
    }
    setDraggedIdx(pieces.indexOf(pieceId));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pieceId);
  };

  useEffect(() => {
    setPieces(puzzle.pieces.map(piece => piece.id));
    setDraggedIdx(null);
    setErrorMsg(null);
    setHintsUsed(0);
    setSubmitting(false);
    setAnnouncement('');
    requestLockRef.current = false;
    requestIdentityRef.current = null;
    pointerPieceRef.current = null;
  }, [nodeId, puzzle.id]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !requestLockRef.current) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return createPortal(
    <div className="story-puzzle-host">
      <div className="story-puzzle-bg" style={{ backgroundImage: `url(${getAssetUrl(puzzle.imageAssetId)})` }} />
      <div className="story-puzzle-content">
        <header className="story-puzzle-header">
          <button type="button" onClick={onClose} disabled={submitting} className="story-puzzle-back">&larr; Back</button>
          <h2>{puzzle.title}</h2>
          <p>{puzzle.instruction}</p>
        </header>

        <div className="story-puzzle-main">
          <ul className="story-puzzle-list" ref={listRef} role="listbox" aria-label="Evidence pieces">
            {pieces.map((id, index) => {
              const piece = puzzle.pieces.find(p => p.id === id)!;
              const evidenceIndex = puzzle.pieces.findIndex(p => p.id === id);
              return (
                <li
                  key={id}
                  className={`story-puzzle-item ${draggedIdx === index ? 'is-dragging' : ''}`}
                  tabIndex={0}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedIdx === null || draggedIdx === index) return;
                    moveItem(draggedIdx, index);
                    setDraggedIdx(index);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  role="option"
                  aria-selected={false}
                  aria-label={`${piece.label}, position ${index + 1} of ${pieces.length}. Use arrow keys or move buttons to reorder.`}
                  data-puzzle-piece={id}
                >
                  <button
                    type="button"
                    className="story-puzzle-drag-handle"
                    aria-label={`Drag ${piece.label} to reorder`}
                    disabled={submitting}
                    draggable={!submitting}
                    onDragStart={(e) => handleDragStart(e, id)}
                    onDragEnd={() => setDraggedIdx(null)}
                    onPointerDown={(e) => handlePointerDown(e, id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endPointerDrag}
                    onPointerCancel={endPointerDrag}
                  >
                    <GripVertical className="story-puzzle-grip" size={22} aria-hidden="true" />
                  </button>
                  <div
                    className="story-puzzle-item-art"
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url(${getAssetUrl(puzzle.imageAssetId)})`,
                      backgroundPosition: `${15 + ((evidenceIndex * 31) % 70)}% ${18 + ((evidenceIndex * 23) % 64)}%`
                    }}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="story-puzzle-item-content">
                    <strong>{piece.label}</strong>
                    <span>{piece.detail}</span>
                  </div>
                  <div className="story-puzzle-item-controls">
                    <button type="button" aria-label={`Move ${piece.label} up`} disabled={submitting || index === 0} onClick={() => moveItem(index, index - 1)}>↑</button>
                    <button type="button" aria-label={`Move ${piece.label} down`} disabled={submitting || index === pieces.length - 1} onClick={() => moveItem(index, index + 1)}>↓</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="story-puzzle-live" aria-live="polite" aria-atomic="true">{announcement}</div>

          <div className="story-puzzle-sidebar">
            <div className="story-puzzle-hints">
              <h3>Notes</h3>
              {hintsUsed > 0 && (
                <ul className="story-puzzle-hints-list">
                  {puzzle.hints.slice(0, hintsUsed).map((hint, i) => (
                    <li key={i}>{hint}</li>
                  ))}
                </ul>
              )}
              {hintsUsed < puzzle.hints.length && (
                <button type="button" className="story-puzzle-hint-btn" disabled={submitting} onClick={() => setHintsUsed(h => h + 1)}>
                  Reveal Hint {hintsUsed + 1} / {puzzle.hints.length}
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="story-puzzle-error" role="alert">
                {errorMsg}
              </div>
            )}

            <div className="story-puzzle-actions">
              <button 
                type="button" 
                className="story-puzzle-submit"
                onClick={() => void handleSubmit(false)}
                disabled={submitting}
              >
                {submitting ? 'Checking evidence…' : 'Submit evidence'}
              </button>
              <button 
                type="button" 
                className="story-puzzle-skip"
                onClick={() => void handleSubmit(true)}
                disabled={submitting}
              >
                Skip puzzle
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
