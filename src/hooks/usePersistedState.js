import { useState, useEffect, useRef } from 'react';

const DATA_VERSION = 6;
const DEBOUNCE_MS = 800;

// Version check — clear stale localStorage on schema change
if (typeof window !== 'undefined') {
  const storedVersion = localStorage.getItem('budget_data_version');
  if (storedVersion !== String(DATA_VERSION)) {
    localStorage.removeItem('budget_bills');
    localStorage.removeItem('budget_debts');
    localStorage.removeItem('budget_months');
    localStorage.removeItem('budget_paycheck_config');
    localStorage.removeItem('budget_playgrounds');
    localStorage.setItem('budget_data_version', String(DATA_VERSION));
  }
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

  // 2. On mount: fetch from API — if server has data, use it
  useEffect(() => {
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

    // Don't write back to API during the initial fetch
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
