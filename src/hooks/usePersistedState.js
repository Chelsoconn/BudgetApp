import { useState, useEffect, useRef, useCallback } from 'react';

const DEBOUNCE_MS = 400;

// Save to DB — shared helper
function saveToDb(key, value) {
  return fetch(`/api/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

export function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(defaultValue);

  const debounceRef = useRef(null);
  const ready = useRef(false);
  const hasLoaded = useRef(false);
  const pendingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const keyRef = useRef(key);
  keyRef.current = key;

  // On mount: always load from DB (single source of truth)
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    fetch(`/api/data/${key}`)
      .then((res) => res.ok ? res.json() : null)
      .then((serverData) => {
        if (serverData !== null) {
          setState(serverData);
        }
      })
      .catch(() => {})
      .finally(() => { ready.current = true; });
  }, []);

  // On change: save to DB after debounce (DB is the only persistent store)
  useEffect(() => {
    if (!ready.current) return;

    pendingRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveToDb(key, state)
        .then(() => { pendingRef.current = false; })
        .catch(() => {});
    }, DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [key, state]);

  // Flush pending saves on tab close, hide, or navigate away
  useEffect(() => {
    const flush = () => {
      if (pendingRef.current && ready.current) {
        const body = JSON.stringify(stateRef.current);
        navigator.sendBeacon(
          `/api/data/${keyRef.current}`,
          new Blob([body], { type: 'application/json' })
        );
        pendingRef.current = false;
      }
    };
    const onVisChange = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, []);

  // Call before making a user-initiated change to enable undo
  const snapshot = useCallback(() => {
    if (ready.current) {
      fetch(`/api/snapshot/${key}`, { method: 'POST' }).catch(() => {});
    }
  }, [key]);

  // Cancel any pending debounced save (used by undo to prevent overwrite)
  const cancelPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      pendingRef.current = false;
    }
  }, []);

  return [state, setState, snapshot, cancelPending];
}
