import { useId } from 'react';
import { HandFist } from 'lucide-react';
import '../styles/fade-finder.css';

export function FadeFinderButton({ busy, loading, unavailable, reduced, onSearch }: {
  busy: boolean; loading: boolean; unavailable: boolean; reduced: boolean; onSearch: () => void;
}) {
  const id = useId().replaceAll(':', '');
  const status = busy ? 'Entering the park…' : loading ? 'Connecting…' : unavailable ? 'Reconnect to find a fade' : '';
  return <button className="fade-finder" type="button" data-testid="find-ranked-fade"
    data-reduced-motion={reduced} aria-label={status || 'Find a fade'} aria-busy={busy || loading}
    disabled={busy || loading || unavailable} onClick={onSearch}>
    <svg className="fade-finder__emblem" viewBox="0 0 224 218" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff2c2" /><stop offset=".36" stopColor="#e9bc62" /><stop offset=".62" stopColor="#a7742c" /><stop offset=".82" stopColor="#f5d78e" /><stop offset="1" stopColor="#c18d3e" />
        </linearGradient>
        <radialGradient id={`${id}-glass`} cx=".3" cy=".24" r=".85"><stop stopColor="#365348" /><stop offset=".55" stopColor="#122d23" /><stop offset="1" stopColor="#07140f" /></radialGradient>
        <path id={`${id}-arc`} d="M 22 105 A 82 82 0 0 1 186 105" />
      </defs>
      <text className="fade-finder__lettering" fill="#ffe3a4"><textPath href={`#${id}-arc`} startOffset="50%" textAnchor="middle">FIND A FADE</textPath></text>
      <circle cx="25" cy="94" r="2.2" fill="#d4ab60" /><circle cx="183" cy="94" r="2.2" fill="#d4ab60" />
      <path d="M 145 145 L 188 188" stroke="#07140f" strokeWidth="26" strokeLinecap="round" />
      <path d="M 145 145 L 188 188" stroke={`url(#${id}-gold)`} strokeWidth="19" strokeLinecap="round" />
      <path d="M 157 159 L 184 186" stroke="#213126" strokeWidth="10" strokeLinecap="round" />
      <path d="M 159 157 L 186 184" stroke="#ffe4a8" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
      <circle cx="104" cy="104" r="60" fill="#07140f" stroke="#856330" strokeWidth="1" />
      <circle cx="104" cy="104" r="54" fill={`url(#${id}-glass)`} stroke={`url(#${id}-gold)`} strokeWidth="9" />
      <circle cx="104" cy="104" r="47" fill="none" stroke="#e4c47e" strokeWidth="1" opacity=".5" />
      <path d="M 68 85 A 41 41 0 0 1 105 63" fill="none" stroke="#fff3ce" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      <HandFist x="77" y="76" width="54" height="57" color="#f8d382" strokeWidth="1.8" />
      <path d="M 102 142 L 106 142" stroke="#ddbb70" strokeWidth="2" strokeLinecap="round" />
    </svg>
    {status && <span className="fade-finder__status" role="status">{status}</span>}
  </button>;
}
