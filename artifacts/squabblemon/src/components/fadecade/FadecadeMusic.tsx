import { useEffect } from 'react';
import { setScopedMusicMode } from '../../musicStore';

/**
 * Keeps Fadecade browsing and battles on the global soundtrack player.
 * Mount this for the full lifetime of ChallengesHub, including its PlayLoop.
 */
export function useFadecadeMusic(isBrowsing: boolean) {
  useEffect(() => {
    setScopedMusicMode(isBrowsing ? 'fadecade' : 'battle');
    return () => setScopedMusicMode(null);
  }, [isBrowsing]);
}

export function FadecadeMusic({ isBrowsing }: { isBrowsing: boolean }) {
  useFadecadeMusic(isBrowsing);
  return null;
}