// useLiveQuery.js - Reactive Dexie LiveQuery hook for Preact

import { useState, useEffect } from 'preact/hooks';
import { liveQuery } from 'dexie';

export function useLiveQuery(querier, deps = []) {
  const [value, setValue] = useState(undefined);

  useEffect(() => {
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: val => setValue(val),
      error: err => console.error('useLiveQuery error:', err)
    });
    return () => subscription.unsubscribe();
  }, deps);

  return value;
}
