import { useEffect } from 'react';
import { playTutorialSequence, tutorialClipsForText } from './tutorialVoice';

export function useTutorialVoice(text: string | null | undefined, enabled = true, cueIds?: readonly string[]) {
  // Depend on content rather than JSX/array identity, so unrelated renders do not restart speech.
  const key = cueIds === undefined ? text : cueIds.join('|');
  useEffect(() => {
    if (!enabled || !key) return;
    const ids = cueIds === undefined ? tutorialClipsForText(key) : key.split('|');
    if (ids.length) return playTutorialSequence(ids);
    return undefined;
  }, [key, enabled]);
}
