import { useState, useEffect } from 'react';

// Bump this to force a data reset when the schema changes
const DATA_VERSION = 3;

// On first load, check if data version has changed and clear stale data
if (typeof window !== 'undefined') {
  const storedVersion = localStorage.getItem('budget_data_version');
  if (storedVersion !== String(DATA_VERSION)) {
    localStorage.removeItem('budget_bills');
    localStorage.removeItem('budget_debts');
    localStorage.removeItem('budget_months');
    localStorage.setItem('budget_data_version', String(DATA_VERSION));
  }
}

/**
 * Like useState, but reads from and writes to localStorage automatically.
 * @param {string} key  - localStorage key
 * @param {*} defaultValue - used only when nothing is stored yet
 */
export function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage quota exceeded — ignore
    }
  }, [key, state]);

  return [state, setState];
}
