import { useState } from 'react';
import { fmt } from '../utils/format';
import { billCategories, categoryColors } from '../data/budgetData';

export default function Bills({ bills, setBills }) {
  const [showModal, setShowModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [form, setForm] = useState({ name: '', amount: '', category: 'Other' });
  const [filterCat, setFilterCat] = useState('All');

  const totalMonthly = bills.reduce((s, b) => s + b.amount, 0);
  const totalYearly = totalMonthly * 12;

  const categories = ['All', ...billCategories];

  const filtered = filterCat === 'All' ? bills : bills.filter((b) => b.category === filterCat);

  const openAdd = () => {
    setEditBill(null);
    setForm({ name: '', amount: '', category: 'Other' });
    setShowModal(true);
  };

  const openEdit = (bill) => {
    setEditBill(bill);
    setForm({ name: bill.name, amount: bill.amount, category: bill.category });
    setShowModal(true);
  };

  const save = () => {
    if (!form.name || !form.amount) return;
    const amount = parseFloat(form.amount);
    if (editBill) {
      setBills(bills.map((b) => b.id === editBill.id ? { ...b, ...form, amount } : b));
    } else {
      const newId = Math.max(0, ...bills.map((b) => b.id)) + 1;
      setBills([...bills, { id: newId, name: form.name, amount, category: form.category }]);
    }
    setShowModal(false);
  };

  const remove = (id) => {
    setBills(bills.filter((b) => b.id !== id));
  };

  const updateAmount = (id, val) => {
    const n = parseFloat(val);
    if (!isNaN(n)) setBills(bills.map((b) => b.id === id ? { ...b, amount: n } : b));
  };

  // Group by category for summary
  const byCategory = {};
  bills.forEach((b) => {
    byCategory[b.category] = (byCategory[b.category] ?? 0) + b.amount;
  });

  return (
    <div>
      <div className="page-header">
        <h2>Monthly Bills</h2>
        <p>Fixed recurring expenses — click any amount to edit inline</p>
      </div>

      {/* Totals */}
      <div className="grid-3 mb-4">
        <div className="stat-card">
          <div className="stat-label">Total Monthly</div>
          <div className="stat-value">{fmt(totalMonthly)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Yearly</div>
          <div className="stat-value">{fmt(totalYearly)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Number of Bills</div>
          <div className="stat-value">{bills.length}</div>
          <div className="stat-sub">recurring expenses</div>
        </div>
      </div>

      {/* Category filter + Add button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`month-tab${filterCat === cat ? ' active' : ''}`}
              onClick={() => setFilterCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Bill</button>
      </div>

      {/* Bills table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Bill</th>
              <th>Category</th>
              <th className="text-right">Monthly</th>
              <th className="text-right">Yearly</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((bill) => (
              <tr key={bill.id}>
                <td>
                  <span className="font-semibold">{bill.name}</span>
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: `${categoryColors[bill.category] ?? '#6b7280'}22`,
                      color: categoryColors[bill.category] ?? '#6b7280',
                    }}
                  >
                    {bill.category}
                  </span>
                </td>
                <td className="text-right">
                  <input
                    className="editable-amount"
                    type="number"
                    value={bill.amount}
                    onChange={(e) => updateAmount(bill.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                </td>
                <td className="text-right text-muted text-sm">
                  {fmt(bill.amount * 12)}
                </td>
                <td>
                  <div className="flex gap-1 justify-end">
                    <button className="btn-icon" title="Edit" onClick={() => openEdit(bill)}>✏️</button>
                    <button className="btn-danger btn-sm" onClick={() => remove(bill.id)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ borderTop: '2px solid var(--border)', paddingTop: 12 }}>
                <strong>Total</strong>
              </td>
              <td className="text-right font-bold" style={{ borderTop: '2px solid var(--border)', paddingTop: 12 }}>
                {fmt(filtered.reduce((s, b) => s + b.amount, 0))}
              </td>
              <td className="text-right font-bold text-muted text-sm" style={{ borderTop: '2px solid var(--border)', paddingTop: 12 }}>
                {fmt(filtered.reduce((s, b) => s + b.amount, 0) * 12)}
              </td>
              <td style={{ borderTop: '2px solid var(--border)' }} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Category breakdown */}
      <div className="card mt-4">
        <div className="section-heading">Bills by Category</div>
        <div className="grid-3">
          {Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amt]) => (
              <div key={cat} className="card-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="cat-dot"
                    style={{ background: categoryColors[cat] ?? '#6b7280', width: 10, height: 10 }}
                  />
                  <span className="text-sm text-muted font-semibold">{cat}</span>
                </div>
                <div className="font-bold text-lg">{fmt(amt)}</div>
                <div className="text-xs text-muted mt-1">
                  {Math.round((amt / totalMonthly) * 100)}% of total
                </div>
                <div className="progress-bar" style={{ marginTop: 8 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(amt / totalMonthly) * 100}%`,
                      background: categoryColors[cat] ?? '#6b7280',
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editBill ? 'Edit Bill' : 'Add Bill'}</h3>
            <div className="form-field">
              <label className="form-label">Name</label>
              <input
                type="text"
                placeholder="e.g. Netflix"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="form-field">
              <label className="form-label">Monthly Amount</label>
              <input
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {billCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={save}>
                {editBill ? 'Save Changes' : 'Add Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
