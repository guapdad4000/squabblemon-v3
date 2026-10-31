import { useCallback, useEffect, useRef, useState } from "react";
import { KumiteMatchMedia } from "./KumiteMatchMedia";

/** The entry burst belongs to connecting, after the opponent is revealed. This ceremony
 * never delays an owner's match transition or changes any transport state. */
export function KumiteSearchBackdrop({
  assigned,
  searching,
  entering,
  reducedMotion,
  onEntryComplete,
}: {
  assigned: boolean;
  searching: boolean;
  entering: boolean;
  reducedMotion: boolean;
  onEntryComplete?(): void;
}) {
  const [settled, setSettled] = useState(false);
  const [entered, setEntered] = useState(entering);
  useEffect(() => {
    if (entering) setEntered(true);
  }, [entering]);
  const readinessSent = useRef(false);
  const finishReveal = useCallback(() => setSettled(true), []);
  useEffect(() => {
    if (!assigned || !entering) {
      readinessSent.current = false;
      return;
    }
    if (settled && onEntryComplete && !readinessSent.current) {
      readinessSent.current = true;
      onEntryComplete();
    }
  }, [assigned, entering, settled, onEntryComplete]);
  const showCourts = assigned && !entering;
  return (
    <>
      <div className="km-search-backdrop" aria-hidden="true">
        {assigned ? (
          <KumiteMatchMedia
            kind="color"
            active={entering}
            reducedMotion={reducedMotion}
          />
        ) : (
          <KumiteMatchMedia
            kind="monochrome"
            active={searching}
            reducedMotion={reducedMotion}
          />
        )}
      </div>
      {showCourts && (
        <div className="km-search-world" aria-hidden="true">
          <div className="km-search-world-you">
            <KumiteMatchMedia kind="golden" reducedMotion={reducedMotion} />
          </div>
          <div className="km-search-world-opps">
            <KumiteMatchMedia kind="crimson" reducedMotion={reducedMotion} />
          </div>
        </div>
      )}
      {assigned && (entering || entered) && !settled && (
        <div className="km-match-slash" aria-hidden="true">
          <KumiteMatchMedia
            kind="burst"
            active={entering}
            reducedMotion={reducedMotion}
            onComplete={finishReveal}
          />
        </div>
      )}
    </>
  );
}
