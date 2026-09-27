import { useEffect, useId } from 'react';
import { getAssetUrl } from '../lib/assets';
import { useFeedbackPreferences } from '../hooks/useFeedbackPreferences';
import '../styles/fade-finder.css';

// A separate, quiet ambience clip: it never touches the soundtrack player.
function usePhoneRing(ringing: boolean) {
  const [preferences] = useFeedbackPreferences();
  useEffect(() => {
    if (!ringing || !preferences.audioEnabled) return;
    const audio = new Audio(getAssetUrl('audio/sfx/interactions/phone-ring.mp3'));
    audio.volume = 0.22;
    const ring = () => {
      if (document.hidden || !audio.paused) return;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    };
    const visibility = () => { if (document.hidden) audio.pause(); else ring(); };
    ring();
    const interval = window.setInterval(ring, 4500);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
      audio.pause();
    };
  }, [ringing, preferences.audioEnabled]);
}

export function FadeFinderButton({ busy, searching, loading, unavailable, reduced, onSearch, onCancel }: {
  busy: boolean; searching: boolean; loading: boolean; unavailable: boolean; reduced: boolean;
  onSearch: () => void; onCancel: () => void;
}) {
  const labelPathId = `fade-phone-label-${useId().replaceAll(':', '')}`;
  const lifted = searching || busy;
  const ringing = lifted && !(searching && busy) && !unavailable;
  usePhoneRing(ringing);
  const status = busy ? searching ? 'Hanging up…' : 'Dialing…'
    : searching ? 'Hang up' : loading ? 'Connecting…' : unavailable ? 'Line disconnected' : 'Call for a fade';
  return <div className="fade-phone" data-testid="fade-phone" data-lifted={lifted} data-ringing={ringing} data-reduced-motion={reduced}>
    <svg className="fade-phone__cord fade-phone__cord--desktop" viewBox="0 0 128 90" aria-hidden="true" focusable="false">
      <path className="fade-phone__lead" d="M110 41 C109 55 80 48 78 61" />
      <path d="M78 61 C72 75 91 78 92 64 C93 51 77 55 84 72 C90 87 106 79 101 68 C96 58 88 74 101 84 C113 96 124 79 115 74 C105 68 105 87 118 89 L128 89" />
      <path className="fade-phone__plug" d="M121 89 H128" />
    </svg>
    <svg className="fade-phone__cord fade-phone__cord--mobile" viewBox="0 0 160 360" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="fade-phone__mobile-lead" d="M160 0 C150 20 2 4 2 30" />
      <path d="M2 30 L2 294 C2 304 18 299 12 289 C6 280 -3 295 3 309 C13 322 21 307 11 302 C1 296 -4 316 4 328 C16 340 21 322 10 320 C-2 318 -4 341 4 349 C16 359 20 342 10 339 C-1 335 1 358 0 359" />
      <path className="fade-phone__plug" d="M0 359 H7" />
    </svg>
    <button className="fade-finder" type="button" data-testid={searching ? 'cancel-ranked-fade' : 'find-ranked-fade'}
      aria-label={searching ? busy ? 'Hanging up…' : 'Hang up — cancel search' : status} aria-busy={busy || loading}
      disabled={busy || loading || (!searching && unavailable)} onClick={searching ? onCancel : onSearch}>
      <span className="fade-phone__receiver">
        <img src={getAssetUrl('assets/fade-park/phone-receiver.webp')} width="900" height="254" alt="" draggable={false} />
        <svg className="fade-phone__lettering" viewBox="-70 0 200 300" aria-hidden="true" focusable="false">
          <defs><path id={labelPathId} d="M18 258 C-54 236 -54 64 18 42" /></defs>
          <text><textPath href={`#${labelPathId}`} startOffset="50%" textAnchor="middle">{status}</textPath></text>
        </svg>
      </span>
      <span className="fade-phone__label">{status}</span>
      <span className="fade-phone__hint">{searching ? 'Cancel the call' : busy ? 'Finding your next rival' : 'Pick up. Pull up.'}</span>
    </button>
  </div>;
}
