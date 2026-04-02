import { useState } from 'react';
import { fmt, pct } from '../utils/format';

const debtSections = [
  { key: 'vehicles', label: 'Vehicles', icon: '🚗', hasLimit: false },
  { key: 'studentLoans', label: 'Student Loans', icon: '🎓', hasLimit: false },
  { key: 'creditCards', label: 'Credit Cards', icon: '💳', hasLimit: true },
  { key: 'medicalDebt', label: 'Medical Debt', icon: '🏥', hasLimit: false },
];

const debtColors = {
  vehicles: '#f97316',
  studentLoans: '#8b5cf6',
  creditCards: '#ef4444',
  medicalDebt: '#06b6d4',
};

export default function Debt({ debts, setDebts }) {
  const [showModal, setShowModal] = useState(false);
  const [modalSection, setModalSection] = useState('vehicles');
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', amount: '', limit: '' });

  const totalDebt = Object.values(debts).flat().reduce((s, d) => s + d.amount, 0);
  const ccLimit = debts.creditCards.reduce((s, d) => s + (d.limit ?? 0), 0);
  const ccUsed = debts.creditCards.reduce((s, d) => s + d.amount, 0);
  const ccUtil = pct(ccUsed, ccLimit);

  const openAdd = (sectionKey) => {
    setModalSection(sectionKey);
    setEditItem(null);
    setForm({ name: '', amount: '', limit: '' });
    setShowModal(true);
  };

  const openEdit = (sectionKey, item) => {
    setModalSection(sectionKey);
    setEditItem(item);
    setForm({ name: item.name, amount: item.amount, limit: item.limit ?? '' });
    setShowModal(true);
  };

  const save = () => {
    if (!form.name || form.amount === '') return;
    const amount = parseFloat(form.amount);
    const limit = form.limit !== '' ? parseFloat(form.limit) : undefined;
    const newItem = { name: form.name, amount, ...(limit !== undefined ? { limit } : {}) };
    const section = debts[modalSection];

    if (editItem) {
      setDebts({
        ...debts,
        [modalSection]: section.map((d) =>
          d.id === editItem.id ? { ...d, ...newItem } : d
        ),
      });
    } else {
      const newId = Math.max(0, ...section.map((d) => d.id ?? 0)) + 1;
      setDebts({
        ...debts,
        [modalSection]: [...section, { id: newId, ...newItem }],
      });
    }
    setShowModal(false);
  };

  const remove = (sectionKey, id) => {
    setDebts({
      ...debts,
      [sectionKey]: debts[sectionKey].filter((d) => d.id !== id),
    });
  };

  const updateAmount = (sectionKey, id, val) => {
    const n = parseFloat(val);
    if (!isNaN(n)) {
      setDebts({
        ...debts,
        [sectionKey]: debts[sectionKey].map((d) => d.id === id ? { ...d, amount: n } : d),
      });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Debt Tracker</h2>
        <p>Monitor all debts and credit utilization</p>
      </div>

      {/* Summary stats */}
      <div className="grid-4 mb-4">
        <div className="stat-card">
          <div className="stat-label">Total Debt</div>
          <div className="stat-value text-red">{fmt(totalDebt)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Vehicles</div>
          <div className="stat-value">{fmt(debts.vehicles.reduce((s, d) => s + d.amount, 0))}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Student Loans</div>
          <div className="stat-value">{fmt(debts.studentLoans.reduce((s, d) => s + d.amount, 0))}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Credit Cards</div>
          <div className="stat-value">{fmt(ccUsed)}</div>
          <div className="stat-sub">{ccUtil}% utilized</div>
        </div>
      </div>

      {/* Credit utilization bar */}
      <div className="card mb-4">
        <div className="section-heading">💳 Credit Card Utilization</div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted">Balance: <strong style={{ color: 'var(--text)' }}>{fmt(ccUsed)}</strong></span>
          <span className="text-muted">Limit: <strong style={{ color: 'var(--text)' }}>{fmt(ccLimit)}</strong></span>
          <span
            className="font-bold"
            style={{ color: ccUtil > 70 ? 'var(--red)' : ccUtil > 30 ? 'var(--yellow)' : 'var(--green)' }}
          >
            {ccUtil}% used
          </span>
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
        <div className="grid-4 mt-3">
          {debts.creditCards.map((cc) => {
            const u = pct(cc.amount, cc.limit ?? 1);
            return (
              <div key={cc.id} className="card-sm">
                <div className="text-sm font-semibold mb-1">{cc.name}</div>
                <div className="font-bold">{fmt(cc.amount)}</div>
                {cc.limit && (
                  <>
                    <div className="text-xs text-muted mt-1">Limit: {fmt(cc.limit)}</div>
                    <div className="progress-bar" style={{ marginTop: 6 }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${u}%`,
                          background: u > 70 ? 'var(--red)' : u > 30 ? 'var(--yellow)' : 'var(--green)',
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted mt-1">{u}%</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Debt sections */}
      {debtSections.map((section) => {
        const items = debts[section.key];
        const sectionTotal = items.reduce((s, d) => s + d.amount, 0);
        const color = debtColors[section.key];

        return (
          <div key={section.key} className="card mb-4">
            <div className="flex justify-between items-center mb-3">
              <div className="section-heading" style={{ marginBottom: 0 }}>
                {section.icon} {section.label}
                <span className="text-muted text-sm" style={{ marginLeft: 8, fontWeight: 400 }}>
                  {fmt(sectionTotal)}
                </span>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => openAdd(section.key)}>+ Add</button>
            </div>

            {items.length === 0 && (
              <p className="text-muted text-sm">No entries</p>
            )}

            {items.map((item) => (
              <div key={item.id} className="debt-item">
                <div style={{ flex: 1 }}>
                  <div className="font-semibold text-sm">{item.name}</div>
                  {item.limit && (
                    <div className="text-xs text-muted">Limit: {fmt(item.limit)}</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    className="editable-amount"
                    value={item.amount}
                    onChange={(e) => updateAmount(section.key, item.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                  <button className="btn-icon" onClick={() => openEdit(section.key, item)}>✏️</button>
                  <button className="btn-danger btn-sm" onClick={() => remove(section.key, item.id)}>✕</button>
                </div>
              </div>
            ))}

            {items.length > 0 && (
              <>
                <div
                  className="progress-bar"
                  style={{ marginTop: 12 }}
                  title={`${fmt(sectionTotal)} out of ${fmt(totalDebt)} total debt`}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${pct(sectionTotal, totalDebt)}%`, background: color }}
                  />
                </div>
                <div className="text-xs text-muted mt-1">
                  {pct(sectionTotal, totalDebt)}% of total debt
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editItem ? 'Edit' : 'Add'} — {debtSections.find((s) => s.key === modalSection)?.label}</h3>
            <div className="form-field">
              <label className="form-label">Name</label>
              <input
                type="text"
                placeholder="e.g. Chase Mortgage"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-field">
              <label className="form-label">Amount Owed</label>
              <input
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            {debtSections.find((s) => s.key === modalSection)?.hasLimit && (
              <div className="form-field">
                <label className="form-label">Credit Limit (optional)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: e.target.value })}
                />
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={save}>
                {editItem ? 'Save Changes' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
