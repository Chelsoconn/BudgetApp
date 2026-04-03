import { useState, useEffect, useCallback } from 'react';

const TRACKED_KEYS = ['budget_bills', 'budget_debts', 'budget_months', 'budget_paycheck_config'];

export default function UndoRedo({ onRestore }) {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState('');

  const fetchCounts = useCallback(async () => {
    const result = {};
    for (const key of TRACKED_KEYS) {
      try {
        const res = await fetch(`/api/history/${key}`);
        if (res.ok) result[key] = await res.json();
      } catch {}
    }
    setCounts(result);
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 5000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  const totalUndo = Object.values(counts).reduce((s, c) => s + (c.undoCount || 0), 0);
  const totalRedo = Object.values(counts).reduce((s, c) => s + (c.redoCount || 0), 0);

  const doAction = async (action) => {
    if (loading) return;
    setLoading(true);
    setLastAction('');
    try {
      for (const key of TRACKED_KEYS) {
        const c = counts[key];
        if (!c) continue;
        if (action === 'undo' && c.undoCount > 0) {
          const res = await fetch(`/api/${action}/${key}`, { method: 'POST' });
          if (res.ok) {
            const { data } = await res.json();
            onRestore(key, data);
            setLastAction(action === 'undo' ? 'Undone' : 'Redone');
            break;
          }
        }
        if (action === 'redo' && c.redoCount > 0) {
          const res = await fetch(`/api/${action}/${key}`, { method: 'POST' });
          if (res.ok) {
            const { data } = await res.json();
            onRestore(key, data);
            setLastAction(action === 'undo' ? 'Undone' : 'Redone');
            break;
          }
        }
      }
      await fetchCounts();
    } catch {} finally {
      setLoading(false);
      setTimeout(() => setLastAction(''), 2000);
    }
  };

  return (
    <div className="undo-redo-bar">
      <button
        className="undo-btn"
        disabled={totalUndo === 0 || loading}
        onClick={() => doAction('undo')}
        title="Undo last change"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        Undo
      </button>
      <button
        className="redo-btn"
        disabled={totalRedo === 0 || loading}
        onClick={() => doAction('redo')}
        title="Redo last undone change"
      >
        Redo
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
      </button>
      {lastAction && <span className="undo-toast">{lastAction}</span>}
    </div>
  );
}
