import { useEffect } from 'react';
import { playTutorialSequence, tutorialClipsForText } from './tutorialVoice';

export function useTutorialVoice(text: string | null | undefined, enabled = true) {
  // Depend on content rather than JSX/array identity, so unrelated renders do not restart speech.
  useEffect(() => {
    if (!enabled || !text) return;
    const ids = tutorialClipsForText(text);
    if (ids.length) return playTutorialSequence(ids);
    return undefined;
  }, [text, enabled]);
}
