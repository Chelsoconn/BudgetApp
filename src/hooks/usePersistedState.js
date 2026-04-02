import { useState, useEffect, useRef } from 'react';

const DATA_VERSION = 9;
const DEBOUNCE_MS = 800;

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
    // Clear stale DB keys
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
  const hasLoaded = useRef(false);

  // On mount: load from DB or seed if empty
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    fetch(`/api/data/${key}`)
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((serverData) => {
        if (serverData !== null) {
          // DB has data — use it
          setState(serverData);
          try { localStorage.setItem(key, JSON.stringify(serverData)); } catch {}
        } else {
          // DB empty — push current state (defaults) to DB
          const current = localStorage.getItem(key);
          const toSave = current !== null ? current : JSON.stringify(defaultValue);
          fetch(`/api/data/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: toSave,
          }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => { ready.current = true; });
  }, []);

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
