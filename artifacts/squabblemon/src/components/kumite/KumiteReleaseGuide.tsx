import { useEffect, useId, useRef, useState } from 'react';
import { createDeferredComponent } from '../../lib/deferredComponent';
import './releaseGuide.css';

const rules = createDeferredComponent('BreakthroughHowToPlay', 'default',
  () => import('../breakthrough/BreakthroughHowToPlay'));

/** Optional explanation: neither the rules engine nor its art loads on the Events entry. */
export function KumiteReleaseGuide() {
  const regionId = useId();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [Guide, setGuide] = useState<ReturnType<typeof rules.peek>>();
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    let current = true;
    setFailed(false);
    void rules.load().then(view => {
      if (current) setGuide(() => view);
    }, () => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [open, attempt]);
  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  return <div className="kumite-release-guide">
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={regionId} onClick={() => open ? close() : setOpen(true)}>
      {open ? 'CLOSE THE PLAYBOOK ↑' : 'HOW BREAKTHROUGH WORKS ↗'}
    </button>
    {open && <div id={regionId} className="kumite-release-guide__rules">
      {failed ? <p role="alert">The playbook couldn’t load. <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></p>
        : Guide ? <Guide /> : <p role="status">Opening the playbook…</p>}
    </div>}
  </div>;
}
