import { useState, useEffect, useRef } from 'react';

// Bump this when the DEFAULT data shape changes (e.g. paycheck cycle fix).
// On mismatch: localStorage clears, DB data is replaced with fresh defaults.
const DATA_VERSION = 9;
const DEBOUNCE_MS = 800;

// One-time version check per page load
let versionChecked = false;
let versionIsStale = false;

if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('budget_data_version');
  if (stored !== String(DATA_VERSION)) {
    versionIsStale = true;
    // Clear localStorage so defaults load
    localStorage.removeItem('budget_bills');
    localStorage.removeItem('budget_debts');
    localStorage.removeItem('budget_months');
    localStorage.removeItem('budget_paycheck_config');
    localStorage.removeItem('budget_playgrounds');
    localStorage.setItem('budget_data_version', String(DATA_VERSION));
    // Tell the server to clear stale DB data (fire-and-forget)
    fetch('/api/data/version', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: DATA_VERSION }),
    }).catch(() => {});
  }
  versionChecked = true;
}

/**
 * Like useState, but reads/writes to both localStorage (fast cache) and
 * Postgres via the API (durable storage). API failures are silent —
 * the app always works from localStorage.
 */
export function usePersistedState(key, defaultValue) {
  // 1. Initialize from localStorage synchronously (instant render)
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const debounceRef = useRef(null);
  const mountedFromApi = useRef(false);

  // 2. On mount: fetch from API — but skip if we just detected a version change
  //    (the DB has stale data that we don't want to load)
  useEffect(() => {
    // If version just changed, don't load from DB — use fresh defaults and save them
    if (versionIsStale) {
      mountedFromApi.current = true;
      // Save defaults to DB
      fetch(`/api/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultValue),
      }).catch(() => {});
      return;
    }

    let cancelled = false;
    fetch(`/api/data/${key}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((serverData) => {
        if (!cancelled && serverData !== null) {
          setState(serverData);
          try { localStorage.setItem(key, JSON.stringify(serverData)); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => { mountedFromApi.current = true; });
    return () => { cancelled = true; };
  }, [key]);

  // 3. On change: write localStorage immediately + debounced API save
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}

    if (!mountedFromApi.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      }).catch(() => {});
    }, DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [key, state]);

  return [state, setState];
}
