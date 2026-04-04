import { useState, useEffect, useRef, useCallback } from 'react';

const DEBOUNCE_MS = 400;
const MAX_RETRIES = 2;

// Save to DB with retry
async function saveToDb(key, value) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`/api/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
      if (res.ok) return;
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    } catch {
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  console.error(`Failed to save ${key} after ${MAX_RETRIES + 1} attempts`);
}

export function usePersistedState(key, defaultValue) {
  // Initialize to null — we don't render real UI until DB loads
  const [state, setState] = useState(null);
  const [loaded, setLoaded] = useState(false);

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
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((serverData) => {
        setState(serverData ?? defaultValue);
        ready.current = true;
        setLoaded(true);
      })
      .catch((err) => {
        console.error(`Failed to load ${key}:`, err);
        // Only fall back to defaults if DB has no data (404), not on network errors
        // Do NOT set ready=true on failure — prevents saves with wrong data
      });
  }, []);

  // On change: save to DB after debounce (DB is the only persistent store)
  useEffect(() => {
    if (!ready.current) return;

    pendingRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveToDb(key, state).then(() => { pendingRef.current = false; });
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

  // Return defaultValue for rendering until DB loads, but never save it
  const effectiveState = state ?? defaultValue;

  return [effectiveState, setState, snapshot, cancelPending, loaded];
}
