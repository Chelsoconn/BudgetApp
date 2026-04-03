import { useState, useEffect, useCallback } from 'react';

export default function UndoRedo({ onRestore }) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/history-summary');
      if (res.ok) {
        const data = await res.json();
        setCanUndo(data.undoCount > 0);
        setCanRedo(data.redoCount > 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 3000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  const doAction = async (action) => {
    if (loading) return;
    setLoading(true);
    setToast('');
    try {
      const res = await fetch(`/api/${action}-latest`, { method: 'POST' });
      if (res.ok) {
        const { key, data } = await res.json();
        onRestore(key, data);
        setToast(action === 'undo' ? 'Undone!' : 'Redone!');
        await fetchCounts();
      }
    } catch {} finally {
      setLoading(false);
      setTimeout(() => setToast(''), 2000);
    }
  };

  return (
    <div className="undo-redo-bar">
      <button
        className="undo-btn"
        disabled={!canUndo || loading}
        onClick={() => doAction('undo')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        Undo
      </button>
      <button
        className="redo-btn"
        disabled={!canRedo || loading}
        onClick={() => doAction('redo')}
      >
        Redo
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
      </button>
      {toast && <span className="undo-toast">{toast}</span>}
    </div>
  );
}
