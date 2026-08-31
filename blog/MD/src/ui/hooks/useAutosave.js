// useAutosave.js - 250ms debounced autosave for prompt text drafts

import { useEffect, useRef } from 'preact/hooks';

export function useAutosave(value, onSave, delay = 250) {
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      onSave(value);
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay]);
}
