import { useState, useMemo } from 'react';
import { fmt } from '../utils/format';

const DEFAULT_CATEGORIES = [
  'Transportation', 'Equipment', 'Office Supplies', 'Software',
  'Meals & Entertainment', 'Travel', 'Professional Services', 'Marketing', 'Other',
];

const CAT_COLORS = {
  'Transportation': '#6366f1',
  'Equipment': '#f59e0b',
  'Office Supplies': '#10b981',
  'Software': '#8b5cf6',
  'Meals & Entertainment': '#ef4444',
  'Travel': '#3b82f6',
  'Professional Services': '#ec4899',
  'Marketing': '#14b8a6',
  'Other': '#6b7280',
};

function getColor(cat) {
  return CAT_COLORS[cat] || `hsl(${(cat.length * 47) % 360}, 60%, 55%)`;
}

export default function BusinessExpenses({ bizExpenses, setBizExpenses }) {
  const { items = [], categories = DEFAULT_CATEGORIES } = bizExpenses;
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ description: '', amount: '', category: categories[0] || '', date: '' });
  const [editingId, setEditingId] = useState(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState('');

  const update = (changes) => setBizExpenses({ ...bizExpenses, ...changes });

  const total = items.reduce((s, i) => s + i.amount, 0);

  // Category breakdown
  const byCategory = useMemo(() => {
    const map = {};
    items.forEach(i => { map[i.category] = (map[i.category] || 0) + i.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [items]);

  // SVG pie chart
  const pie = useMemo(() => {
    if (byCategory.length === 0) return [];
    let cumulative = 0;
    return byCategory.map(([cat, amt]) => {
      const pct = amt / total;
      const start = cumulative;
      cumulative += pct;
      return { cat, amt, pct, start };
    });
  }, [byCategory, total]);

  const addItem = () => {
    if (!newItem.description || !newItem.amount) return;
    const item = {
      id: Date.now(),
      description: newItem.description,
      amount: parseFloat(newItem.amount),
      category: newItem.category,
      date: newItem.date || new Date().toISOString().split('T')[0],
    };
    update({ items: [...items, item] });
    setNewItem({ description: '', amount: '', category: newItem.category, date: '' });
    setShowAdd(false);
  };

  const removeItem = (id) => update({ items: items.filter(i => i.id !== id) });

  const updateItem = (id, changes) => {
    update({ items: items.map(i => i.id === id ? { ...i, ...changes } : i) });
  };

  const addCategory = () => {
    const cat = newCat.trim();
    if (!cat || categories.includes(cat)) return;
    update({ categories: [...categories, cat] });
    setNewCat('');
    setShowAddCat(false);
  };

  const removeCategory = (cat) => {
    if (items.some(i => i.category === cat)) return alert('Cannot delete a category that has expenses. Reassign them first.');
    update({ categories: categories.filter(c => c !== cat) });
  };

  // Pie chart helper
  const describeArc = (start, end) => {
    const r = 80;
    const cx = 100, cy = 100;
    const startAngle = start * 2 * Math.PI - Math.PI / 2;
    const endAngle = end * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = end - start > 0.5 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header" style={{ margin: 0 }}>
          <h2>Business Expenses</h2>
          <p>Track and categorize all business spending</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Expense</button>
      </div>

      {/* Summary cards */}
      <div className="grid-3 mb-4">
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value text-red">{fmt(total)}</div>
          <div className="stat-sub">{items.length} items</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Categories Used</div>
          <div className="stat-value">{byCategory.length}</div>
          <div className="stat-sub">of {categories.length} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Biggest Category</div>
          <div className="stat-value" style={{ fontSize: 18, color: byCategory[0] ? getColor(byCategory[0][0]) : 'var(--text)' }}>
            {byCategory[0] ? byCategory[0][0] : '—'}
          </div>
          <div className="stat-sub">{byCategory[0] ? fmt(byCategory[0][1]) : ''}</div>
        </div>
      </div>

      {/* Add expense form */}
      {showAdd && (
        <div className="card mb-4">
          <div className="section-heading" style={{ marginBottom: 12 }}>Add Expense</div>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <div className="form-field" style={{ margin: 0, flex: 1, minWidth: 160 }}>
              <label className="form-label">Description</label>
              <input type="text" placeholder="What was it?" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} autoFocus />
            </div>
            <div className="form-field" style={{ margin: 0, width: 110 }}>
              <label className="form-label">Amount</label>
              <input type="number" placeholder="0" value={newItem.amount} onChange={e => setNewItem({ ...newItem, amount: e.target.value })} />
            </div>
            <div className="form-field" style={{ margin: 0, minWidth: 140 }}>
              <label className="form-label">Category</label>
              <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ margin: 0, width: 140 }}>
              <label className="form-label">Date</label>
              <input type="date" value={newItem.date} onChange={e => setNewItem({ ...newItem, date: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary btn-sm" onClick={addItem}>Add</button>
            <button className="btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid-2 mb-4">
        {/* Pie chart */}
        <div className="card">
          <div className="section-heading">Spending Breakdown</div>
          {pie.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <svg viewBox="0 0 200 200" width="200" height="200">
                {pie.map((s, i) => (
                  <path
                    key={i}
                    d={s.pct >= 0.999 ? `M 100 20 A 80 80 0 1 1 99.99 20 Z` : describeArc(s.start, s.start + s.pct)}
                    fill={getColor(s.cat)}
                    stroke="var(--card)"
                    strokeWidth="2"
                  />
                ))}
              </svg>
              <div style={{ width: '100%' }}>
                {pie.map(s => (
                  <div key={s.cat} className="donut-legend-item">
                    <span className="cat-dot" style={{ background: getColor(s.cat) }} />
                    <span className="flex-1 text-sm">{s.cat}</span>
                    <span className="text-sm font-semibold">{fmt(s.amt)}</span>
                    <span className="text-xs text-muted" style={{ width: 40, textAlign: 'right' }}>
                      {Math.round(s.pct * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted text-sm" style={{ textAlign: 'center', padding: 40 }}>
              Add expenses to see breakdown
            </p>
          )}
        </div>

        {/* Categories manager */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <div className="section-heading" style={{ margin: 0 }}>Categories</div>
            <button className="btn-ghost btn-sm" onClick={() => setShowAddCat(true)}>+ Add</button>
          </div>
          {categories.map(cat => {
            const catTotal = items.filter(i => i.category === cat).reduce((s, i) => s + i.amount, 0);
            const count = items.filter(i => i.category === cat).length;
            return (
              <div key={cat} className="summary-row">
                <span className="flex items-center gap-2">
                  <span className="cat-dot" style={{ background: getColor(cat) }} />
                  <span className="text-sm">{cat}</span>
                  {count > 0 && <span className="text-xs text-muted">({count})</span>}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{catTotal > 0 ? fmt(catTotal) : '—'}</span>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => removeCategory(cat)}
                    style={{ opacity: count > 0 ? 0.3 : 1 }}
                  >✕</button>
                </div>
              </div>
            );
          })}
          {showAddCat && (
            <div className="flex gap-2 mt-3">
              <input type="text" placeholder="New category" value={newCat} onChange={e => setNewCat(e.target.value)} autoFocus style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
              />
              <button className="btn-primary btn-sm" onClick={addCategory}>Add</button>
              <button className="btn-ghost btn-sm" onClick={() => setShowAddCat(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Expense list */}
      <div className="card">
        <div className="section-heading" style={{ marginBottom: 12 }}>All Expenses</div>
        {items.length === 0 && <p className="text-muted text-sm">No expenses yet. Click "+ Add Expense" to start tracking.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[...items].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(item => (
            <div key={item.id} className="biz-row">
              {editingId === item.id ? (
                <>
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => updateItem(item.id, { description: e.target.value })}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <select
                    value={item.category}
                    onChange={e => updateItem(item.id, { category: e.target.value })}
                    style={{ fontSize: 13, width: 140 }}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="number"
                    value={item.amount}
                    onChange={e => updateItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                    className="editable-amount"
                    style={{ width: 90 }}
                  />
                  <input
                    type="date"
                    value={item.date || ''}
                    onChange={e => updateItem(item.id, { date: e.target.value })}
                    style={{ fontSize: 12, width: 130 }}
                  />
                  <button className="btn-ghost btn-sm" onClick={() => setEditingId(null)}>Done</button>
                </>
              ) : (
                <>
                  <span className="cat-dot" style={{ background: getColor(item.category), flexShrink: 0 }} />
                  <span className="text-sm flex-1" style={{ fontWeight: 500 }}>{item.description}</span>
                  <span className="badge" style={{ background: `${getColor(item.category)}20`, color: getColor(item.category), fontSize: 11 }}>
                    {item.category}
                  </span>
                  {item.date && <span className="text-xs text-muted">{new Date(item.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  <span className="text-sm font-semibold" style={{ minWidth: 70, textAlign: 'right' }}>{fmt(item.amount)}</span>
                  <button className="btn-ghost btn-sm" onClick={() => setEditingId(item.id)} style={{ padding: '2px 6px' }}>Edit</button>
                  <button className="btn-danger btn-sm" onClick={() => removeItem(item.id)}>✕</button>
                </>
              )}
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <>
            <div className="divider" />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-red">{fmt(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
