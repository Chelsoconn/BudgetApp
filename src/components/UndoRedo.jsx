import { useState, useEffect, useCallback } from 'react';

export default function UndoRedo() {
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/history-summary');
      if (res.ok) {
        const data = await res.json();
        setUndoCount(data.undoCount);
        setRedoCount(data.redoCount);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 5000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  const doAction = async (action) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/${action}-latest`, { method: 'POST' });
      if (res.ok) {
        // Clear localStorage so the app loads fresh from DB
        localStorage.removeItem('budget_bills');
        localStorage.removeItem('budget_debts');
        localStorage.removeItem('budget_months');
        localStorage.removeItem('budget_paycheck_config');
        // Reload to pick up the restored data from DB
        window.location.reload();
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <div className="undo-redo-bar">
      <button
        className="undo-btn"
        disabled={undoCount === 0 || loading}
        onClick={() => doAction('undo')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        Undo
      </button>
      <button
        className="redo-btn"
        disabled={redoCount === 0 || loading}
        onClick={() => doAction('redo')}
      >
        Redo
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
      </button>
    </div>
  );
}
