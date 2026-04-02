import { useState, useEffect, useRef } from 'react';

// Bump this when DEFAULT data shape changes.
// On mismatch: localStorage clears, DB stale keys cleared, fresh defaults saved to both.
const DATA_VERSION = 9;
const DEBOUNCE_MS = 800;

// One-time version check per page load
let versionIsStale = false;

if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('budget_data_version');
  if (stored !== String(DATA_VERSION)) {
    versionIsStale = true;
    localStorage.removeItem('budget_bills');
    localStorage.removeItem('budget_debts');
    localStorage.removeItem('budget_months');
    localStorage.removeItem('budget_paycheck_config');
    localStorage.removeItem('budget_playgrounds');
    localStorage.setItem('budget_data_version', String(DATA_VERSION));
    // Tell server to clear stale default keys
    fetch('/api/data/version', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: DATA_VERSION }),
    }).catch(() => {});
  }
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

  // On mount: either load from DB or seed defaults
  useEffect(() => {
    if (versionIsStale) {
      // Version changed — don't load stale DB data, push fresh defaults instead
      ready.current = true;
      localStorage.setItem(key, JSON.stringify(defaultValue));
      fetch(`/api/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultValue),
      }).catch(() => {});
      return;
    }

    // Normal load — fetch from DB
    let cancelled = false;
    fetch(`/api/data/${key}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((serverData) => {
        if (!cancelled && serverData !== null) {
          setState(serverData);
          try { localStorage.setItem(key, JSON.stringify(serverData)); } catch {}
        } else if (!cancelled) {
          // DB has no data for this key — push current state (defaults or localStorage)
          fetch(`/api/data/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
          }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => { ready.current = true; });
    return () => { cancelled = true; };
  }, [key]);

  // On change: localStorage + debounced DB save
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
    if (!ready.current) return;

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
