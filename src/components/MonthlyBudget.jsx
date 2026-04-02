import { useState } from 'react';
import { fmt, fmtDate } from '../utils/format';

export default function MonthlyBudget({ bills, months, setMonths }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showAddPaycheck, setShowAddPaycheck] = useState(false);
  const [showAddAdj, setShowAddAdj] = useState(false);
  const [newPaycheck, setNewPaycheck] = useState({ date: '', amount: '' });
  const [newAdj, setNewAdj] = useState({ label: '', amount: '' });
  const [showAddMonth, setShowAddMonth] = useState(false);
  const [newMonth, setNewMonth] = useState({ name: '', year: '2025' });

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const month = months[selectedIdx];

  const updateMonth = (updates) => {
    setMonths(months.map((m, i) => i === selectedIdx ? { ...m, ...updates } : m));
  };

  const income = month.paychecks.reduce((s, p) => s + p.amount, 0);
  const extraExpenses = (month.spending ?? 0) + (month.hsa ?? 0) + (month.childcare ?? 0) + (month.hair ?? 0);
  const totalExpenses = totalBills + extraExpenses;
  const difference = income - totalExpenses;
  const adjustments = (month.adjustments ?? []).reduce((s, a) => s + a.amount, 0);

  // Running savings
  let runSavings = 0;
  for (let i = 0; i <= selectedIdx; i++) {
    const m = months[i];
    const mIncome = m.paychecks.reduce((s, p) => s + p.amount, 0);
    const mExtra = (m.spending ?? 0) + (m.hsa ?? 0) + (m.childcare ?? 0) + (m.hair ?? 0);
    const mExpenses = totalBills + mExtra;
    const mDiff = mIncome - mExpenses;
    const mAdj = (m.adjustments ?? []).reduce((s, a) => s + a.amount, 0);
    if (i === 0) runSavings = mDiff + mAdj + (m.savings ?? 0);
    else runSavings += mDiff + mAdj;
  }

  const removePaycheck = (idx) => {
    const updated = month.paychecks.filter((_, i) => i !== idx);
    updateMonth({ paychecks: updated });
  };

  const addPaycheck = () => {
    if (!newPaycheck.amount) return;
    updateMonth({
      paychecks: [...month.paychecks, { date: newPaycheck.date, amount: parseFloat(newPaycheck.amount) }],
    });
    setNewPaycheck({ date: '', amount: '' });
    setShowAddPaycheck(false);
  };

  const removeAdj = (idx) => {
    const updated = (month.adjustments ?? []).filter((_, i) => i !== idx);
    updateMonth({ adjustments: updated });
  };

  const addAdj = () => {
    if (!newAdj.label || !newAdj.amount) return;
    const adj = [...(month.adjustments ?? []), { label: newAdj.label, amount: parseFloat(newAdj.amount) }];
    updateMonth({ adjustments: adj });
    setNewAdj({ label: '', amount: '' });
    setShowAddAdj(false);
  };

  const addMonth = () => {
    if (!newMonth.name) return;
    const newId = Math.max(0, ...months.map((m) => m.id)) + 1;
    setMonths([
      ...months,
      {
        id: newId,
        name: newMonth.name,
        year: parseInt(newMonth.year),
        spending: 2150,
        hsa: 300,
        extraItems: [],
        notes: '',
        savings: 0,
        paychecks: [],
        adjustments: [],
      },
    ]);
    setNewMonth({ name: '', year: '2025' });
    setShowAddMonth(false);
    setSelectedIdx(months.length);
  };

  return (
    <div>
      <div className="page-header flex justify-between items-center" style={{ marginBottom: 20 }}>
        <div>
          <h2>Monthly Budget</h2>
          <p>Track income, expenses, and savings month by month</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowAddMonth(true)}>+ Add Month</button>
      </div>

      {/* Month tabs */}
      <div className="month-tabs">
        {months.map((m, i) => (
          <button
            key={m.id}
            className={`month-tab${selectedIdx === i ? ' active' : ''}`}
            onClick={() => setSelectedIdx(i)}
          >
            {m.name} {m.year !== 2025 ? `'${String(m.year).slice(2)}` : ''}
          </button>
        ))}
      </div>

      {/* Note */}
      {month.notes && (
        <div className="note-box mb-4">
          <span>⚠️</span>
          <span>{month.notes}</span>
        </div>
      )}

      <div className="grid-2 mb-4">
        {/* Income / Paychecks */}
        <div className="card">
          <div className="section-heading flex justify-between items-center" style={{ marginBottom: 12 }}>
            <span>💵 Paychecks</span>
            <button className="btn-ghost btn-sm" onClick={() => setShowAddPaycheck(!showAddPaycheck)}>
              + Add
            </button>
          </div>

          {month.paychecks.map((p, i) => (
            <div key={i} className="paycheck-item">
              <div className="flex-1">
                <div className="text-sm font-semibold">{fmt(p.amount)}</div>
                {p.date && <div className="text-xs text-muted">{fmtDate(p.date)}</div>}
              </div>
              <button className="btn-danger btn-sm" onClick={() => removePaycheck(i)}>✕</button>
            </div>
          ))}

          {showAddPaycheck && (
            <div className="card-sm mt-3">
              <div className="flex gap-2 mb-2">
                <input
                  type="date"
                  value={newPaycheck.date}
                  onChange={(e) => setNewPaycheck({ ...newPaycheck, date: e.target.value })}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={newPaycheck.amount}
                  onChange={(e) => setNewPaycheck({ ...newPaycheck, amount: e.target.value })}
                  style={{ width: 110 }}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary btn-sm" onClick={addPaycheck}>Add</button>
                <button className="btn-ghost btn-sm" onClick={() => setShowAddPaycheck(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="divider" />
          <div className="flex justify-between font-bold">
            <span>Total Income</span>
            <span className="text-green">{fmt(income)}</span>
          </div>
        </div>

        {/* Expenses */}
        <div className="card">
          <div className="section-heading" style={{ marginBottom: 12 }}>📋 Expenses</div>

          <div className="summary-row">
            <span className="text-muted">Fixed Bills</span>
            <span className="font-semibold">{fmt(totalBills)}</span>
          </div>

          <div className="summary-row">
            <span className="text-muted">Spending</span>
            <input
              type="number"
              className="editable-amount"
              value={month.spending ?? 0}
              onChange={(e) => updateMonth({ spending: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="summary-row">
            <span className="text-muted">HSA</span>
            <input
              type="number"
              className="editable-amount"
              value={month.hsa ?? 0}
              onChange={(e) => updateMonth({ hsa: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {(month.childcare !== undefined) && (
            <div className="summary-row">
              <span className="text-muted">Childcare</span>
              <input
                type="number"
                className="editable-amount"
                value={month.childcare ?? 0}
                onChange={(e) => updateMonth({ childcare: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}

          {(month.hair !== undefined) && (
            <div className="summary-row">
              <span className="text-muted">Hair</span>
              <input
                type="number"
                className="editable-amount"
                value={month.hair ?? 0}
                onChange={(e) => updateMonth({ hair: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}

          <div className="divider" />
          <div className="flex justify-between font-bold">
            <span>Total Expenses</span>
            <span className="text-red">{fmt(totalExpenses)}</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid-3 mb-4">
        <div className="stat-card">
          <div className="stat-label">Monthly Difference</div>
          <div className={`stat-value ${difference >= 0 ? 'text-green' : 'text-red'}`}>
            {fmt(difference)}
          </div>
          <div className="stat-sub">income − expenses</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Adjustments</div>
          <div className={`stat-value ${adjustments >= 0 ? 'text-green' : 'text-red'}`}>
            {fmt(adjustments)}
          </div>
          <div className="stat-sub">{(month.adjustments ?? []).length} items</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Running Savings</div>
          <div className={`stat-value ${runSavings >= 0 ? 'text-green' : 'text-red'}`}>
            {fmt(runSavings)}
          </div>
          <div className="stat-sub">cumulative thru {month.name}</div>
        </div>
      </div>

      {/* Adjustments */}
      <div className="card mb-4">
        <div className="section-heading flex justify-between items-center" style={{ marginBottom: 12 }}>
          <span>🔄 One-Time Adjustments</span>
          <button className="btn-ghost btn-sm" onClick={() => setShowAddAdj(!showAddAdj)}>+ Add</button>
        </div>

        {(month.adjustments ?? []).length === 0 && (
          <p className="text-muted text-sm">No adjustments this month</p>
        )}

        {(month.adjustments ?? []).map((a, i) => (
          <div key={i} className="summary-row">
            <span className="text-sm">{a.label}</span>
            <div className="flex items-center gap-3">
              <span className={`font-semibold ${a.amount >= 0 ? 'text-green' : 'text-red'}`}>
                {a.amount >= 0 ? '+' : ''}{fmt(a.amount)}
              </span>
              <button className="btn-danger btn-sm" onClick={() => removeAdj(i)}>✕</button>
            </div>
          </div>
        ))}

        {showAddAdj && (
          <div className="card-sm mt-3">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Description"
                value={newAdj.label}
                onChange={(e) => setNewAdj({ ...newAdj, label: e.target.value })}
                style={{ flex: 1 }}
                autoFocus
              />
              <input
                type="number"
                placeholder="Amount (neg = expense)"
                value={newAdj.amount}
                onChange={(e) => setNewAdj({ ...newAdj, amount: e.target.value })}
                style={{ width: 180 }}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary btn-sm" onClick={addAdj}>Add</button>
              <button className="btn-ghost btn-sm" onClick={() => setShowAddAdj(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="card">
        <div className="section-heading" style={{ marginBottom: 10 }}>📝 Notes</div>
        <textarea
          value={month.notes ?? ''}
          onChange={(e) => updateMonth({ notes: e.target.value })}
          placeholder="Add notes for this month..."
          style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
        />
      </div>

      {/* Add Month Modal */}
      {showAddMonth && (
        <div className="modal-overlay" onClick={() => setShowAddMonth(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Month</h3>
            <div className="form-field">
              <label className="form-label">Month Name</label>
              <input
                type="text"
                placeholder="e.g. October"
                value={newMonth.name}
                onChange={(e) => setNewMonth({ ...newMonth, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-field">
              <label className="form-label">Year</label>
              <input
                type="number"
                value={newMonth.year}
                onChange={(e) => setNewMonth({ ...newMonth, year: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-ghost" onClick={() => setShowAddMonth(false)}>Cancel</button>
              <button className="btn-primary" onClick={addMonth}>Add Month</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
