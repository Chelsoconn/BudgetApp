import { useState, useEffect, useRef, useCallback } from 'react';

const DATA_VERSION = 9;
const DEBOUNCE_MS = 400;
const FORCE_PUSH_VERSION = 2; // Bump this to force localStorage → DB push

// Version check — runs once on page load
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('budget_data_version');
  if (stored !== String(DATA_VERSION)) {
    localStorage.removeItem('budget_bills');
    localStorage.removeItem('budget_debts');
    localStorage.removeItem('budget_months');
    localStorage.removeItem('budget_paycheck_config');
    localStorage.removeItem('budget_playgrounds');
    localStorage.setItem('budget_data_version', String(DATA_VERSION));
    fetch('/api/data/version', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: DATA_VERSION }),
    }).catch(() => {});
  }
}

// Save to DB — shared helper
function saveToDb(key, value) {
  return fetch(`/api/data/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}


export function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const debounceRef = useRef(null);
  const ready = useRef(false);
  const hasLoaded = useRef(false);
  const pendingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const keyRef = useRef(key);
  keyRef.current = key;

  // On mount: load from DB, or force-push from localStorage if version bumped
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    const forcePushKey = 'force_push_version';
    const lastPush = localStorage.getItem(forcePushKey);
    const needsForcePush = lastPush !== String(FORCE_PUSH_VERSION);

    if (needsForcePush) {
      // Push localStorage to DB to restore any lost data
      const current = localStorage.getItem(key);
      if (current !== null) {
        try {
          const value = JSON.parse(current);
          saveToDb(key, value).catch(() => {});
        } catch {}
      }
      // Mark as done after all hooks have run (set in a timeout so all keys push)
      setTimeout(() => localStorage.setItem(forcePushKey, String(FORCE_PUSH_VERSION)), 2000);
      ready.current = true;
      return;
    }

    fetch(`/api/data/${key}`)
      .then((res) => res.ok ? res.json() : null)
      .then((serverData) => {
        if (serverData !== null) {
          setState(serverData);
          try { localStorage.setItem(key, JSON.stringify(serverData)); } catch {}
        } else {
          const current = localStorage.getItem(key);
          const value = current !== null ? JSON.parse(current) : defaultValue;
          saveToDb(key, value).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => { ready.current = true; });
  }, []);

  // On change: save to localStorage immediately, DB after debounce
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
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

  return [state, setState, snapshot];
}
