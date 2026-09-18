import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { FEEDBACK_STORAGE_KEY, FEEDBACK_CHANGE_EVENT, loadFeedbackPreferences, saveFeedbackPreferences, type FeedbackPreferences } from '../battleFeedback';

export function useFeedbackPreferences() {
  const [preferences, setPreferences] = useState(loadFeedbackPreferences);
  const current = useRef(preferences);
  useEffect(() => {
    const receive = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== null && event.key !== FEEDBACK_STORAGE_KEY) return;
      const next = event instanceof CustomEvent ? event.detail as FeedbackPreferences : loadFeedbackPreferences();
      current.current = next;
      setPreferences(next);
    };
    window.addEventListener(FEEDBACK_CHANGE_EVENT, receive);
    window.addEventListener('storage', receive);
    return () => {
      window.removeEventListener(FEEDBACK_CHANGE_EVENT, receive);
      window.removeEventListener('storage', receive);
    };
  }, []);
  const save = useCallback((action: SetStateAction<FeedbackPreferences>) => {
    const next = typeof action === 'function' ? action(current.current) : action;
    current.current = next;
    setPreferences(next);
    saveFeedbackPreferences(next);
  }, []);
  return [preferences, save] as const;
}
