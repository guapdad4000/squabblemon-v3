import { useState } from 'react';
import { UserRound } from 'lucide-react';

/** The source's FighterPortrait image/failure branches, with catalog lookup and sticker engine removed. */
export function FighterPortrait({ avatarKey = 'cornball', name, decorative = false }: { avatarKey?: string; name: string; decorative?: boolean }) {
  const [failedSource, setFailedSource] = useState('');
  const src = `/__mockup/images/fadebook-current/${avatarKey}.webp`;
  const failed = failedSource === src;
  return <div className="fighter-portrait" aria-hidden={decorative || undefined}>
    {failed ? <div className="fighter-portrait__fallback">
      <UserRound aria-hidden="true" size={48} />
      <span>{name}</span><small>Portrait unavailable</small>
    </div> : <img src={src} alt={decorative ? '' : `${name} portrait`} draggable={false} decoding="async" onError={() => setFailedSource(src)} />}
  </div>;
}