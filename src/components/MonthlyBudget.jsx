import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fmt, fmtDate } from '../utils/format';
import { computeMonthFinancials, computeCarryover } from '../utils/computeMonth';

const toSlug = (m) => `${m.name.toLowerCase()}-${m.year}`;

export default function MonthlyBudget({ bills, months, setMonths, paycheckConfig }) {
  const { monthSlug } = useParams();
  const navigate = useNavigate();

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const currentKey = now.getFullYear() * 12 + now.getMonth();
  const monthKey = (m) => m.year * 12 + monthNames.indexOf(m.name);

  const selectedIdx = (() => {
    if (monthSlug) {
      const idx = months.findIndex((m) => toSlug(m) === monthSlug);
      if (idx >= 0) return idx;
    }
    // Default to current month
    const curName = monthNames[now.getMonth()];
    const idx = months.findIndex((m) => m.year === now.getFullYear() && m.name === curName);
    return idx >= 0 ? idx : 0;
  })();

  const setSelectedIdx = (i) => navigate(`/monthly/${toSlug(months[i])}`, { replace: true });
  const [showArchived, setShowArchived] = useState(false);
  const [showAddPaycheck, setShowAddPaycheck] = useState(false);
  const [showAddAdj, setShowAddAdj] = useState(false);
  const [newPaycheck, setNewPaycheck] = useState({ date: '', amount: '', person: 'Brandon', type: 'small' });
  const [newAdj, setNewAdj] = useState({ label: '', amount: '' });
  const [showAddMonth, setShowAddMonth] = useState(false);
  const [newMonth, setNewMonth] = useState({ name: '', year: '2025' });
  const [editingLabel, setEditingLabel] = useState(null);

  // Evaluate simple math expressions like "10+5+5" or "100-20"
  const evalMath = (str) => {
    if (!str || str === '') return undefined;
    try {
      // Only allow numbers, +, -, *, /, ., spaces, and parens
      const clean = str.replace(/[^0-9+\-*/.() ]/g, '');
      if (!clean) return undefined;
      const result = Function('"use strict"; return (' + clean + ')')();
      return typeof result === 'number' && isFinite(result) ? Math.round(result * 100) / 100 : undefined;
    } catch { return undefined; }
  };

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const month = months[selectedIdx];
  const [bankInput, setBankInput] = useState(String(month?.bankBalance ?? ''));
  const [amexInput, setAmexInput] = useState(String(month?.amexBalance ?? ''));

  // Sync bank/amex inputs when switching months or when data changes (undo)
  useEffect(() => {
    setBankInput(String(month?.bankBalance ?? ''));
    setAmexInput(String(month?.amexBalance ?? ''));
  }, [selectedIdx, month?.bankBalance, month?.amexBalance]);

  const updateMonth = (updates) => {
    setMonths(months.map((m, i) => i === selectedIdx ? { ...m, ...updates } : m));
  };

  const brandonChecks = month.paychecks.filter((p) => p.person === 'Brandon' || !p.person);
  const chelseaChecks = month.paychecks.filter((p) => p.person === 'Chelsea');
  const brandonIncome = brandonChecks.reduce((s, p) => s + p.amount, 0);
  const chelseaIncome = chelseaChecks.reduce((s, p) => s + p.amount, 0);

  // Use shared computation for everything financial
  const carryover = computeCarryover(months, bills, selectedIdx);
  const fin = computeMonthFinancials(month, bills, carryover);
  const {
    totalIncome, bankBalance, amexBalance, activeBillsTotal,
    totalExpenses, adjustments, paidBills, billOverrides,
    effectiveCarryover, effectiveIncome, effectiveExpenses,
    totalAvailable, difference, monthFinal,
  } = fin;

  const prevMonth = selectedIdx > 0 ? months[selectedIdx - 1] : null;

  const toggleBillPaid = (id) => {
    const next = new Set(paidBills);
    next.has(id) ? next.delete(id) : next.add(id);
    updateMonth({ paidBills: [...next] });
  };

  const setBillOverride = (id, val) => {
    updateMonth({ billOverrides: { ...billOverrides, [id]: val } });
  };

  const billAmount = (bill) => billOverrides[bill.id] ?? bill.amount;

  const [billsExpanded, setBillsExpanded] = useState(false);

  const removePaycheck = (idx) => {
    updateMonth({ paychecks: month.paychecks.filter((_, i) => i !== idx) });
  };

  const addPaycheck = () => {
    if (!newPaycheck.amount) return;
    const p = { date: newPaycheck.date, amount: parseFloat(newPaycheck.amount), person: newPaycheck.person, type: newPaycheck.type };
    updateMonth({ paychecks: [...month.paychecks, p] });
    setNewPaycheck({ date: '', amount: '', person: 'Brandon', type: 'small' });
    setShowAddPaycheck(false);
  };

  const removeAdj = (idx) => {
    updateMonth({ adjustments: (month.adjustments ?? []).filter((_, i) => i !== idx) });
  };

  const addAdj = () => {
    if (!newAdj.label || !newAdj.amount) return;
    updateMonth({ adjustments: [...(month.adjustments ?? []), { label: newAdj.label, amount: parseFloat(newAdj.amount) }] });
    setNewAdj({ label: '', amount: '' });
    setShowAddAdj(false);
  };

  const addMonth = () => {
    if (!newMonth.name) return;
    const newId = Math.max(0, ...months.map((m) => m.id)) + 1;
    setMonths([...months, {
      id: newId, name: newMonth.name, year: parseInt(newMonth.year),
      expenses: [{ label: 'Spending', amount: 2150 }], notes: '',
      paychecks: [], adjustments: [],
    }]);
    setNewMonth({ name: '', year: '2025' });
    setShowAddMonth(false);
    // Navigate to the new month after state updates
    const slug = `${newMonth.name.toLowerCase()}-${newMonth.year}`;
    setTimeout(() => navigate(`/monthly/${slug}`, { replace: true }), 0);
  };

  // Quick-add a standard paycheck using shared config
  const quickAdd = (person, type) => {
    const amount = person === 'Chelsea' ? paycheckConfig.chelseaPay : type === 'big' ? paycheckConfig.brandonBig : paycheckConfig.brandonSmall;
    updateMonth({ paychecks: [...month.paychecks, { date: '', amount, person, type }] });
  };

  const typeLabel = (p) => {
    if (p.person === 'Chelsea') return 'semi-monthly';
    return p.type === 'big' ? 'big' : 'small';
  };

  const typeColor = (p) => {
    if (p.person === 'Chelsea') return '#818cf8';
    return p.type === 'big' ? 'var(--green)' : 'var(--text-muted)';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header" style={{ margin: 0 }}>
          <h2>Monthly Budget</h2>
          <p>Track income, expenses, and savings month by month</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowAddMonth(true)}>+ Add Month</button>
      </div>

      {/* Current / Archived toggle + month selector */}
      {(() => {
        const visibleMonths = showArchived
          ? months.filter((m) => monthKey(m) < currentKey)
          : months.filter((m) => monthKey(m) >= currentKey);
        const years = [...new Set(visibleMonths.map((m) => m.year))].sort();
        const selectedYear = month.year;
        const monthsInYear = visibleMonths.filter((m) => m.year === selectedYear);
        const archivedCount = months.filter((m) => monthKey(m) < currentKey).length;

        return (
          <>
            <div className="flex gap-2 mb-3">
              <button
                className={`archive-tab${!showArchived ? ' active' : ''}`}
                onClick={() => {
                  setShowArchived(false);
                  const curName = monthNames[now.getMonth()];
                  const idx = months.findIndex((m) => m.year === now.getFullYear() && m.name === curName);
                  if (idx >= 0) setSelectedIdx(idx);
                }}
              >
                Current
              </button>
              <button
                className={`archive-tab${showArchived ? ' active' : ''}`}
                onClick={() => {
                  setShowArchived(true);
                  const archived = months.filter((m) => monthKey(m) < currentKey);
                  if (archived.length > 0) setSelectedIdx(months.indexOf(archived[archived.length - 1]));
                }}
              >
                Archived ({archivedCount})
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
              <div className="flex gap-2">
                {years.map((yr) => (
                  <button
                    key={yr}
                    className={`month-tab${selectedYear === yr ? ' active' : ''}`}
                    onClick={() => {
                      const first = visibleMonths.find((m) => m.year === yr);
                      if (first) setSelectedIdx(months.indexOf(first));
                    }}
                  >
                    {yr}
                  </button>
                ))}
              </div>
              <select
                value={selectedIdx}
                onChange={(e) => setSelectedIdx(Number(e.target.value))}
                style={{ padding: '7px 12px', fontSize: 14, minWidth: 140 }}
              >
                {monthsInYear.map((m) => {
                  const idx = months.indexOf(m);
                  return (
                    <option key={m.id} value={idx}>{m.name}</option>
                  );
                })}
              </select>
            </div>
          </>
        );
      })()}

      {/* Current account balances */}
      <div className="card mb-4" style={{ borderColor: 'var(--accent)', borderWidth: 1 }}>
        <div className="section-heading" style={{ marginBottom: 14 }}>🏦 Current Account Balances</div>
        <div className="grid-2">
          <div>
            <div className="form-label mb-1" style={{ display: 'block' }}>Bank Account</div>
            <div className="flex items-center gap-2">
              <span className="text-muted">$</span>
              <input
                type="text"
                value={bankInput}
                onChange={(e) => setBankInput(e.target.value)}
                onBlur={() => {
                  const val = evalMath(bankInput);
                  setBankInput(val !== undefined ? String(val) : '');
                  updateMonth({ bankBalance: val });
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                style={{ width: '100%' }}
                placeholder="0 (e.g. 1000+500+250)"
              />
            </div>
            <div className="text-xs text-green mt-1">+ added to available funds</div>
          </div>
          <div>
            <div className="form-label mb-1" style={{ display: 'block' }}>AMEX Balance Owed</div>
            <div className="flex items-center gap-2">
              <span className="text-muted">$</span>
              <input
                type="text"
                value={amexInput}
                onChange={(e) => setAmexInput(e.target.value)}
                onBlur={() => {
                  const val = evalMath(amexInput);
                  setAmexInput(val !== undefined ? String(val) : '');
                  updateMonth({ amexBalance: val });
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                style={{ width: '100%' }}
                placeholder="0 (e.g. 300+150+75)"
              />
            </div>
            <div className="text-xs text-red mt-1">− subtracted from available funds</div>
          </div>
        </div>
        {(bankBalance > 0 || amexBalance > 0) && (
          <div className="divider" style={{ margin: '12px 0' }} />
        )}
        {(bankBalance > 0 || amexBalance > 0) && (
          <div className="flex justify-between text-sm">
            <span className="text-muted">Net account position</span>
            <span className={`font-bold ${bankBalance - amexBalance >= 0 ? 'text-green' : 'text-red'}`}>
              {fmt(bankBalance - amexBalance)}
            </span>
          </div>
        )}
      </div>

      {month.notes && (
        <div className="note-box mb-4">
          <span>⚠️</span>
          <span>{month.notes}</span>
        </div>
      )}

      <div className="grid-2 mb-4">
        {/* Brandon's paychecks */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <div className="section-heading" style={{ margin: 0 }}>
              <span style={{ color: 'var(--green)' }}>●</span> Brandon
              <span className="text-muted text-sm" style={{ fontWeight: 400, marginLeft: 8 }}>weekly · S, S, B pattern</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => quickAdd('Brandon', 'small')}>+S</button>
              <button className="btn-ghost btn-sm" onClick={() => quickAdd('Brandon', 'big')}>+B</button>
            </div>
          </div>

          {brandonChecks.length === 0 && <p className="text-muted text-sm">No paychecks yet</p>}

          {brandonChecks.map((p, i) => {
            const globalIdx = month.paychecks.indexOf(p);
            return (
              <div key={i} className="paycheck-item">
                <div style={{ width: 52 }}>
                  <span className="badge" style={{
                    background: p.type === 'big' ? 'rgba(16,185,129,0.15)' : 'rgba(136,146,164,0.15)',
                    color: p.type === 'big' ? 'var(--green)' : 'var(--text-muted)',
                  }}>
                    {p.type === 'big' ? 'BIG' : 'small'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{fmt(p.amount)}</div>
                  {p.date && <div className="text-xs text-muted">{fmtDate(p.date)}</div>}
                </div>
                <input
                  type="number"
                  className="editable-amount"
                  value={p.amount}
                  onChange={(e) => {
                    const updated = [...month.paychecks];
                    updated[globalIdx] = { ...updated[globalIdx], amount: parseFloat(e.target.value) || 0 };
                    updateMonth({ paychecks: updated });
                  }}
                  style={{ width: 88 }}
                />
                <button className="btn-danger btn-sm" onClick={() => removePaycheck(globalIdx)}>✕</button>
              </div>
            );
          })}

          <div className="divider" />
          <div className="flex justify-between font-bold text-sm">
            <span>Brandon total</span>
            <span className="text-green">{fmt(brandonIncome)}</span>
          </div>
        </div>

        {/* Chelsea's paychecks */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <div className="section-heading" style={{ margin: 0 }}>
              <span style={{ color: '#818cf8' }}>●</span> Chelsea
              <span className="text-muted text-sm" style={{ fontWeight: 400, marginLeft: 8 }}>15th + last day · {fmt(paycheckConfig.chelseaPay)}/check</span>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => quickAdd('Chelsea', 'regular')}>+Check</button>
          </div>

          {chelseaChecks.length === 0 && <p className="text-muted text-sm">No paychecks yet</p>}

          {chelseaChecks.map((p, i) => {
            const globalIdx = month.paychecks.indexOf(p);
            return (
              <div key={i} className="paycheck-item">
                <div style={{ width: 52 }}>
                  <span className="badge" style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>
                    bi
                  </span>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{fmt(p.amount)}</div>
                  {p.date && <div className="text-xs text-muted">{fmtDate(p.date)}</div>}
                </div>
                <input
                  type="number"
                  className="editable-amount"
                  value={p.amount}
                  onChange={(e) => {
                    const updated = [...month.paychecks];
                    updated[globalIdx] = { ...updated[globalIdx], amount: parseFloat(e.target.value) || 0 };
                    updateMonth({ paychecks: updated });
                  }}
                  style={{ width: 88 }}
                />
                <button className="btn-danger btn-sm" onClick={() => removePaycheck(globalIdx)}>✕</button>
              </div>
            );
          })}

          <div className="divider" />
          <div className="flex justify-between font-bold text-sm">
            <span>Chelsea total</span>
            <span style={{ color: '#818cf8' }}>{fmt(chelseaIncome)}</span>
          </div>
        </div>
      </div>

      {/* Custom paycheck modal trigger */}
      <div className="flex justify-end mb-4">
        <button className="btn-ghost btn-sm" onClick={() => setShowAddPaycheck(!showAddPaycheck)}>
          + Custom paycheck
        </button>
      </div>

      {showAddPaycheck && (
        <div className="card mb-4">
          <div className="section-heading" style={{ marginBottom: 12 }}>Add Custom Paycheck</div>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <div className="form-field" style={{ margin: 0 }}>
              <label className="form-label">Person</label>
              <select value={newPaycheck.person} onChange={(e) => setNewPaycheck({ ...newPaycheck, person: e.target.value })}>
                <option value="Brandon">Brandon</option>
                <option value="Chelsea">Chelsea</option>
              </select>
            </div>
            <div className="form-field" style={{ margin: 0 }}>
              <label className="form-label">Type</label>
              <select value={newPaycheck.type} onChange={(e) => setNewPaycheck({ ...newPaycheck, type: e.target.value })}>
                {newPaycheck.person === 'Brandon'
                  ? <><option value="small">Small</option><option value="big">Big</option></>
                  : <option value="regular">Regular</option>}
              </select>
            </div>
            <div className="form-field" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <input type="date" value={newPaycheck.date} onChange={(e) => setNewPaycheck({ ...newPaycheck, date: e.target.value })} />
            </div>
            <div className="form-field" style={{ margin: 0 }}>
              <label className="form-label">Amount</label>
              <input type="number" placeholder="0" value={newPaycheck.amount} onChange={(e) => setNewPaycheck({ ...newPaycheck, amount: e.target.value })} style={{ width: 110 }} autoFocus />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary btn-sm" onClick={addPaycheck}>Add</button>
            <button className="btn-ghost btn-sm" onClick={() => setShowAddPaycheck(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid-2 mb-4">
        {/* Expenses */}
        <div className="card">
          <div className="section-heading" style={{ marginBottom: 12 }}>📋 Expenses</div>

          {/* Bills — expandable */}
          <div className="summary-row" style={{ cursor: 'pointer' }} onClick={() => setBillsExpanded((v) => !v)}>
            <span className="text-muted flex items-center gap-2">
              <span style={{ fontSize: 10, display: 'inline-block', transition: 'transform 0.15s', transform: billsExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              Fixed Bills
              {paidBills.size > 0 && (
                <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--green)', marginLeft: 4 }}>
                  {paidBills.size} paid
                </span>
              )}
            </span>
            <span className="font-semibold">{fmt(activeBillsTotal)}</span>
          </div>

          {billsExpanded && (
            <div style={{ marginBottom: 8 }}>
              {bills.map((bill) => {
                const paid = paidBills.has(bill.id);
                const overridden = billOverrides[bill.id] !== undefined;
                const amount = billAmount(bill);
                return (
                  <div
                    key={bill.id}
                    className="flex items-center gap-2"
                    style={{ padding: '6px 0 6px 20px', borderBottom: '1px solid var(--border)', opacity: paid ? 0.4 : 1 }}
                  >
                    {/* Paid checkbox */}
                    <button
                      onClick={() => toggleBillPaid(bill.id)}
                      title={paid ? 'Mark unpaid' : 'Mark paid'}
                      style={{
                        width: 18, height: 18, borderRadius: 4, border: `2px solid ${paid ? 'var(--green)' : 'var(--border)'}`,
                        background: paid ? 'var(--green)' : 'transparent', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
                        color: 'white', fontSize: 11, fontWeight: 700,
                      }}
                    >
                      {paid ? '✓' : ''}
                    </button>

                    {/* Bill name */}
                    <span className="text-sm flex-1" style={{ textDecoration: paid ? 'line-through' : 'none' }}>
                      {bill.name}
                      {overridden && !paid && (
                        <span className="text-xs text-muted" style={{ marginLeft: 6 }}>
                          (was {fmt(bill.amount)})
                        </span>
                      )}
                    </span>

                    {/* Editable amount */}
                    <input
                      type="number"
                      className="editable-amount"
                      value={amount}
                      disabled={paid}
                      onChange={(e) => setBillOverride(bill.id, parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      style={{ width: 80, opacity: paid ? 0.4 : 1 }}
                    />

                    {/* Reset to template */}
                    {overridden && !paid && (
                      <button
                        className="btn-ghost btn-sm"
                        title="Reset to template amount"
                        onClick={() => {
                          const next = { ...billOverrides };
                          delete next[bill.id];
                          updateMonth({ billOverrides: next });
                        }}
                        style={{ padding: '2px 6px', fontSize: 11 }}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Editable expense lines */}
          {(month.expenses ?? []).map((exp, i) => (
            <div key={i} className="summary-row">
              {editingLabel === i ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={exp.label}
                  onBlur={(e) => {
                    const updated = [...(month.expenses ?? [])];
                    updated[i] = { ...updated[i], label: e.target.value.trim() || 'Expense' };
                    updateMonth({ expenses: updated });
                    setEditingLabel(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur();
                    if (e.key === 'Escape') setEditingLabel(null);
                  }}
                  style={{ fontSize: 13, color: 'var(--text-muted)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', outline: 'none', width: 140 }}
                />
              ) : (
                <span
                  className="text-muted"
                  title="Click to rename"
                  onClick={() => setEditingLabel(i)}
                  style={{ cursor: 'text', borderBottom: '1px dashed transparent' }}
                  onMouseEnter={e => e.target.style.borderBottomColor = 'var(--border)'}
                  onMouseLeave={e => e.target.style.borderBottomColor = 'transparent'}
                >{exp.label}</span>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="editable-amount"
                  value={exp.amount}
                  onChange={(e) => {
                    const updated = [...(month.expenses ?? [])];
                    updated[i] = { ...updated[i], amount: parseFloat(e.target.value) || 0 };
                    updateMonth({ expenses: updated });
                  }}
                />
                <button
                  className="btn-danger btn-sm"
                  onClick={() => {
                    const updated = (month.expenses ?? []).filter((_, j) => j !== i);
                    updateMonth({ expenses: updated });
                  }}
                >✕</button>
              </div>
            </div>
          ))}

          {/* Add expense button */}
          <div style={{ padding: '6px 0' }}>
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                const updated = [...(month.expenses ?? []), { label: 'New Expense', amount: 0 }];
                updateMonth({ expenses: updated });
              }}
            >+ Add Expense</button>
          </div>

          <div className="divider" />
          <div className="flex justify-between font-bold">
            <span>Total Expenses</span>
            <span className="text-red">{fmt(totalExpenses)}</span>
          </div>
        </div>

        {/* Summary */}
        <div className="flex flex-col gap-3">
          {effectiveCarryover !== 0 && (
            <div className="stat-card" style={{ borderColor: effectiveCarryover >= 0 ? 'var(--green)' : 'var(--red)', borderWidth: 1 }}>
              <div className="stat-label">Carried from {prevMonth?.name ?? 'prior months'}</div>
              <div className={`stat-value ${effectiveCarryover >= 0 ? 'text-green' : 'text-red'}`}>{fmt(effectiveCarryover)}</div>
              <div className="stat-sub">rolled into this month{month.carryoverOverride !== undefined ? ' (manual)' : ''}</div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-label">Total Available</div>
            <div className="stat-value text-green">{fmt(totalAvailable)}</div>
            <div className="stat-sub">
              {fmt(effectiveIncome)} income
              {effectiveCarryover !== 0 && <> {effectiveCarryover >= 0 ? '+' : '−'} {fmt(Math.abs(effectiveCarryover))} carried</>}
              {bankBalance > 0 && <> + {fmt(bankBalance)} bank</>}
              {amexBalance > 0 && <> − {fmt(amexBalance)} AMEX</>}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">After Expenses</div>
            <div className={`stat-value ${difference >= 0 ? 'text-green' : 'text-red'}`}>{fmt(difference)}</div>
            <div className="stat-sub">available − {fmt(effectiveExpenses)} expenses</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{month.name} Final</div>
            <div className={`stat-value ${monthFinal >= 0 ? 'text-green' : 'text-red'}`}>{fmt(monthFinal)}</div>
            <div className="stat-sub">after expenses + adjustments</div>
          </div>
        </div>
      </div>

      {/* Adjustments */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="section-heading" style={{ margin: 0 }}>🔄 One-Time Adjustments</div>
          <button className="btn-ghost btn-sm" onClick={() => setShowAddAdj(!showAddAdj)}>+ Add</button>
        </div>
        {(month.adjustments ?? []).length === 0 && <p className="text-muted text-sm">No adjustments this month</p>}
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
              <input type="text" placeholder="Description" value={newAdj.label} onChange={(e) => setNewAdj({ ...newAdj, label: e.target.value })} style={{ flex: 1 }} autoFocus />
              <input type="number" placeholder="Amount (neg = expense)" value={newAdj.amount} onChange={(e) => setNewAdj({ ...newAdj, amount: e.target.value })} style={{ width: 200 }} />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary btn-sm" onClick={addAdj}>Add</button>
              <button className="btn-ghost btn-sm" onClick={() => setShowAddAdj(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Final total */}
      <div className="card mb-4" style={{ borderColor: monthFinal >= 0 ? 'var(--green)' : 'var(--red)' }}>
        <div className="section-label mb-3">📊 {month.name} Final</div>

        {/* Carryover — editable override */}
        {(carryover !== 0 || month.carryoverOverride !== undefined) && (
          <div className="summary-row">
            <span className="text-muted flex items-center gap-2">
              ↩ Carried from {prevMonth?.name ?? 'prior'}
              {month.carryoverOverride !== undefined && (
                <button className="btn-danger btn-sm" title="Reset to calculated" onClick={() => {
                  const next = { ...month };
                  delete next.carryoverOverride;
                  setMonths(months.map((m, i) => i === selectedIdx ? next : m));
                }}>↺</button>
              )}
            </span>
            <input
              type="number"
              className="editable-amount"
              value={month.carryoverOverride ?? carryover}
              onChange={(e) => updateMonth({ carryoverOverride: parseFloat(e.target.value) || 0 })}
              style={{ width: 100 }}
            />
          </div>
        )}

        {/* Income — editable override */}
        <div className="summary-row">
          <span className="text-muted flex items-center gap-2">
            Income
            {month.incomeOverride !== undefined && (
              <button className="btn-danger btn-sm" title="Reset to calculated" onClick={() => {
                const next = { ...month };
                delete next.incomeOverride;
                setMonths(months.map((m, i) => i === selectedIdx ? next : m));
              }}>↺</button>
            )}
          </span>
          <input
            type="number"
            className="editable-amount"
            value={month.incomeOverride ?? totalIncome}
            onChange={(e) => updateMonth({ incomeOverride: parseFloat(e.target.value) || 0 })}
            style={{ width: 100 }}
          />
        </div>

        {/* Bank Account */}
        {(bankBalance !== 0 || month.bankBalance !== undefined) && (
          <div className="summary-row">
            <span className="text-muted">Bank Account</span>
            <input
              type="number"
              className="editable-amount"
              value={month.bankBalance ?? ''}
              onChange={(e) => updateMonth({ bankBalance: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
              style={{ width: 100 }}
            />
          </div>
        )}

        {/* AMEX Balance */}
        {(amexBalance !== 0 || month.amexBalance !== undefined) && (
          <div className="summary-row">
            <span className="text-muted">AMEX Balance</span>
            <input
              type="number"
              className="editable-amount"
              value={month.amexBalance ?? ''}
              onChange={(e) => updateMonth({ amexBalance: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
              style={{ width: 100 }}
            />
          </div>
        )}

        {/* Bills + Expenses — editable override */}
        <div className="summary-row">
          <span className="text-muted flex items-center gap-2">
            Bills{paidBills.size > 0 ? ` (${bills.length - paidBills.size}/${bills.length})` : ''} + Expenses
            {month.expensesOverride !== undefined && (
              <button className="btn-danger btn-sm" title="Reset to calculated" onClick={() => {
                const next = { ...month };
                delete next.expensesOverride;
                setMonths(months.map((m, i) => i === selectedIdx ? next : m));
              }}>↺</button>
            )}
          </span>
          <input
            type="number"
            className="editable-amount"
            value={month.expensesOverride ?? totalExpenses}
            onChange={(e) => updateMonth({ expensesOverride: parseFloat(e.target.value) || 0 })}
            style={{ width: 100 }}
          />
        </div>

        {/* Adjustments — editable + deletable */}
        {(month.adjustments ?? []).map((a, i) => (
          <div key={i} className="summary-row">
            <span className="text-muted">{a.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="editable-amount"
                value={a.amount}
                onChange={(e) => {
                  const updated = [...(month.adjustments ?? [])];
                  updated[i] = { ...updated[i], amount: parseFloat(e.target.value) || 0 };
                  updateMonth({ adjustments: updated });
                }}
                style={{ width: 100 }}
              />
              <button className="btn-danger btn-sm" onClick={() => removeAdj(i)}>✕</button>
            </div>
          </div>
        ))}

        <div className="divider" />
        <div className="flex justify-between items-center">
          <span className="font-bold" style={{ fontSize: 16 }}>Final</span>
          <span className="font-bold" style={{ fontSize: 28, letterSpacing: '-1px', color: monthFinal >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {fmt(monthFinal)}
          </span>
        </div>
        {selectedIdx < months.length - 1 && (
          <div className="text-xs text-muted mt-2" style={{ textAlign: 'right' }}>
            ↪ rolls into {months[selectedIdx + 1].name}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="card">
        <div className="section-heading" style={{ marginBottom: 10 }}>📝 Notes</div>
        <textarea value={month.notes ?? ''} onChange={(e) => updateMonth({ notes: e.target.value })} placeholder="Add notes for this month..." style={{ width: '100%', minHeight: 80, resize: 'vertical' }} />
      </div>

      {/* Add Month Modal */}
      {showAddMonth && (
        <div className="modal-overlay" onClick={() => setShowAddMonth(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Month</h3>
            <div className="form-field">
              <label className="form-label">Month Name</label>
              <input type="text" placeholder="e.g. October" value={newMonth.name} onChange={(e) => setNewMonth({ ...newMonth, name: e.target.value })} autoFocus />
            </div>
            <div className="form-field">
              <label className="form-label">Year</label>
              <input type="number" value={newMonth.year} onChange={(e) => setNewMonth({ ...newMonth, year: e.target.value })} />
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
