import { useMemo, useState, useEffect } from 'react';
import { fmt, pct } from '../utils/format';
import { categoryColors } from '../data/budgetData';
import { computeAllMonths, computeMonthFinancials, computeCarryover } from '../utils/computeMonth';

export default function Dashboard({ bills, debts, months, dashNote, setDashNote }) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState(dashNote || '');

  // Sync noteInput when dashNote loads from DB
  useEffect(() => {
    if (dashNote && !editingNote) setNoteInput(dashNote);
  }, [dashNote]);
  const totalBills = bills.reduce((s, b) => s + b.amount, 0);

  const allMonths = useMemo(() => computeAllMonths(months, bills), [months, bills]);

  // Current month = based on today's date
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const curMonthName = monthNames[now.getMonth()];
  const curYear = now.getFullYear();
  const curIdx = months.findIndex((m) => m.year === curYear && m.name === curMonthName);
  const currentMonth = months[curIdx >= 0 ? curIdx : 0];
  const currentCarryover = computeCarryover(months, bills, curIdx >= 0 ? curIdx : 0);
  const currentFin = computeMonthFinancials(currentMonth, bills, currentCarryover);

  // End of Dec 2026
  const dec2026Idx = allMonths.findIndex((m) => m.year === 2026 && m.name === 'December');
  const endOf2026 = dec2026Idx >= 0 ? allMonths[dec2026Idx].monthFinal : 0;

  // End of Dec 2027
  const dec2027Idx = allMonths.findIndex((m) => m.year === 2027 && m.name === 'December');
  const endOf2027 = dec2027Idx >= 0 ? allMonths[dec2027Idx].monthFinal : 0;

  // Average overage per month = end of Dec 2027 / remaining months (current month through Dec 2027)
  const currentKey = curYear * 12 + now.getMonth();
  const dec2027Key = 2027 * 12 + 11;
  const remainingMonths = Math.max(1, dec2027Key - currentKey + 1);
  const avgPerMonth = endOf2027 / remainingMonths;

  // Savings projection data — only current month and forward
  const savingsData = allMonths
    .filter((m) => {
      const mi = monthNames.indexOf(m.name);
      return m.year * 12 + (mi >= 0 ? mi : 0) >= currentKey;
    })
    .map((m) => ({
      label: `${m.name} ${m.year}`,
      savings: m.monthFinal,
    }));

  // Category breakdown
  const byCategory = {};
  bills.forEach((b) => {
    byCategory[b.category] = (byCategory[b.category] ?? 0) + b.amount;
  });
  const categoryList = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  // Credit card utilization
  const ccDebt = debts.creditCards.reduce((s, d) => s + d.amount, 0);
  const ccLimit = debts.creditCards.reduce((s, d) => s + (d.limit ?? 0), 0);
  const ccUtil = pct(ccDebt, ccLimit);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Your financial overview at a glance</p>
      </div>

      {/* Note / Quote */}
      {editingNote ? (
        <div className="dash-note-edit mb-4">
          <textarea
            autoFocus
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const val = noteInput.trim();
                setDashNote(val);
                setEditingNote(false);
                fetch('/api/data/dash_note', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(val) }).catch(() => {});
              }
              if (e.key === 'Escape') {
                setNoteInput(dashNote || '');
                setEditingNote(false);
              }
            }}
            placeholder="Write a note, quote, or reminder..."
            rows={2}
          />
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            <button className="btn-primary btn-sm" onClick={() => {
              const val = noteInput.trim();
              setDashNote(val);
              setEditingNote(false);
              // Immediate DB flush
              fetch('/api/data/dash_note', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(val) }).catch(() => {});
            }}>Save</button>
            <button className="btn-ghost btn-sm" onClick={() => { setNoteInput(dashNote || ''); setEditingNote(false); }}>Cancel</button>
            {dashNote && <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={() => {
              setDashNote(''); setNoteInput(''); setEditingNote(false);
              fetch('/api/data/dash_note', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify('') }).catch(() => {});
            }}>Delete</button>}
          </div>
        </div>
      ) : dashNote ? (
        <div className="dash-note mb-4" onClick={() => { setNoteInput(dashNote); setEditingNote(true); }}>
          <span className="dash-note-icon">&#10024;</span>
          <span className="dash-note-text">{dashNote}</span>
          <span className="dash-note-edit-hint">tap to edit</span>
        </div>
      ) : (
        <div className="dash-note-empty mb-4" onClick={() => setEditingNote(true)}>
          <span>+ Add a note or quote</span>
        </div>
      )}

      {/* Top stats */}
      <div className="grid-3 mb-4">
        <div className="stat-card">
          <div className="stat-label">Monthly Bills</div>
          <div className="stat-value">{fmt(totalBills)}</div>
          <div className="stat-sub">{bills.length} recurring expenses</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{currentMonth?.name} {currentMonth?.year} Final</div>
          <div className={`stat-value ${currentFin.monthFinal >= 0 ? 'text-green' : 'text-red'}`}>
            {fmt(currentFin.monthFinal)}
          </div>
          <div className="stat-sub">current month net</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Overage / Month</div>
          <div className={`stat-value ${avgPerMonth >= 0 ? 'text-green' : 'text-red'}`}>
            {fmt(avgPerMonth)}
          </div>
          <div className="stat-sub">{fmt(endOf2027)} ÷ {remainingMonths} months to Dec '27</div>
        </div>
      </div>

      {/* Net savings projection */}
      <div className="card mb-4">
        <div className="section-heading">📈 Net Savings Projection</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 500, overflowY: 'auto' }}>
          {savingsData.map((m, i) => {
            const max = Math.max(...savingsData.map((x) => Math.abs(x.savings)), 1);
            const isNeg = m.savings < 0;
            const barPct = Math.min(100, Math.abs(m.savings) / max * 100);
            return (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted">{m.label}</span>
                  <span className={isNeg ? 'text-red font-semibold' : 'text-green font-semibold'}>
                    {fmt(m.savings)}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${barPct}%`,
                      background: isNeg ? 'var(--red)' : 'var(--green)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Bills by Category */}
        <div className="card">
          <div className="section-heading">🏷️ Bills by Category</div>
          <div className="donut-legend">
            {categoryList.map(([cat, amt]) => (
              <div key={cat} className="donut-legend-item">
                <span className="cat-dot" style={{ background: categoryColors[cat] ?? '#6b7280' }} />
                <span className="flex-1 text-sm">{cat}</span>
                <span className="text-sm font-semibold">{fmt(amt)}</span>
                <div className="donut-legend-bar" style={{ width: 80 }}>
                  <div
                    className="donut-legend-fill"
                    style={{
                      width: `${pct(amt, totalBills)}%`,
                      background: categoryColors[cat] ?? '#6b7280',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Credit utilization */}
        <div className="card">
          <div className="section-heading">💳 Credit Card Utilization</div>
          <div className="flex justify-between mb-2">
            <span className="text-muted text-sm">Used</span>
            <span className="font-bold text-sm">{ccUtil}%</span>
          </div>
          <div className="progress-bar" style={{ height: 12 }}>
            <div
              className="progress-fill"
              style={{
                width: `${ccUtil}%`,
                background: ccUtil > 70 ? 'var(--red)' : ccUtil > 30 ? 'var(--yellow)' : 'var(--green)',
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-muted">{fmt(ccDebt)} used</span>
            <span className="text-xs text-muted">{fmt(ccLimit)} total limit</span>
          </div>
          <div className="divider" />
          {debts.creditCards.map((cc) => {
            const u = pct(cc.amount, cc.limit ?? 1);
            return (
              <div key={cc.id} className="summary-row">
                <span className="text-sm">{cc.name}</span>
                <span className="text-sm font-semibold">{fmt(cc.amount)}{cc.limit ? ` / ${fmt(cc.limit)}` : ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* End of year milestones */}
      <div className="grid-2">
        <div className="stat-card" style={{ borderColor: endOf2026 >= 0 ? 'var(--green)' : 'var(--red)', borderWidth: 1 }}>
          <div className="stat-label">End of 2026</div>
          <div className={`stat-value ${endOf2026 >= 0 ? 'text-green' : 'text-red'}`}>
            {fmt(endOf2026)}
          </div>
          <div className="stat-sub">December 2026 final</div>
        </div>
        <div className="stat-card" style={{ borderColor: endOf2027 >= 0 ? 'var(--green)' : 'var(--red)', borderWidth: 1 }}>
          <div className="stat-label">End of 2027</div>
          <div className={`stat-value ${endOf2027 >= 0 ? 'text-green' : 'text-red'}`}>
            {fmt(endOf2027)}
          </div>
          <div className="stat-sub">December 2027 final</div>
        </div>
      </div>
    </div>
  );
}
