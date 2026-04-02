import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fmt } from '../utils/format';
import { computeAllMonths, computeMonthFinancials, computeCarryover } from '../utils/computeMonth';
import Bills from './Bills';
import Debt from './Debt';
import SalaryCalc from './SalaryCalc';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bills', label: 'Bills' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'debt', label: 'Debt' },
  { id: 'salary', label: 'Salary' },
  { id: 'chat', label: 'Ask AI' },
];

// Minimal inline dashboard for playground (no dashNote, no routing)
function PgDashboard({ bills, debts, months }) {
  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const allMonths = computeAllMonths(months, bills);
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const curName = monthNames[now.getMonth()];
  const curYear = now.getFullYear();
  const curIdx = months.findIndex(m => m.year === curYear && m.name === curName);
  const currentMonth = months[curIdx >= 0 ? curIdx : 0];
  const currentCarryover = computeCarryover(months, bills, curIdx >= 0 ? curIdx : 0);
  const currentFin = computeMonthFinancials(currentMonth, bills, currentCarryover);
  const dec27 = allMonths.find(m => m.name === 'December' && m.year === 2027);
  const endOf2027 = dec27?.monthFinal ?? 0;

  return (
    <div>
      <div className="grid-3 mb-4">
        <div className="stat-card">
          <div className="stat-label">Monthly Bills</div>
          <div className="stat-value">{fmt(totalBills)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{currentMonth?.name} {currentMonth?.year} Final</div>
          <div className={`stat-value ${currentFin.monthFinal >= 0 ? 'text-green' : 'text-red'}`}>{fmt(currentFin.monthFinal)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">End of 2027</div>
          <div className={`stat-value ${endOf2027 >= 0 ? 'text-green' : 'text-red'}`}>{fmt(endOf2027)}</div>
        </div>
      </div>
      <div className="card">
        <div className="section-heading">Net Savings Projection</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
          {allMonths.map((m, i) => {
            const max = Math.max(...allMonths.map(x => Math.abs(x.monthFinal)), 1);
            const isNeg = m.monthFinal < 0;
            const barPct = Math.min(100, Math.abs(m.monthFinal) / max * 100);
            return (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted">{m.name} {m.year}</span>
                  <span className={isNeg ? 'text-red font-semibold' : 'text-green font-semibold'}>{fmt(m.monthFinal)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${barPct}%`, background: isNeg ? 'var(--red)' : 'var(--green)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Inline monthly budget for playground — no URL routing, uses internal state
function PgMonthly({ bills, months, setMonths, paycheckConfig }) {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const defaultIdx = months.findIndex(m => m.year === now.getFullYear() && m.name === monthNames[now.getMonth()]);
  const [selectedIdx, setSelectedIdx] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [billsExpanded, setBillsExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null);

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const month = months[selectedIdx];
  const updateMonth = (updates) => setMonths(months.map((m, i) => i === selectedIdx ? { ...m, ...updates } : m));

  const carryover = computeCarryover(months, bills, selectedIdx);
  const fin = computeMonthFinancials(month, bills, carryover);
  const { totalIncome, bankBalance, amexBalance, activeBillsTotal, totalExpenses, paidBills, billOverrides, effectiveCarryover, effectiveIncome, effectiveExpenses, totalAvailable, difference, monthFinal, adjustments } = fin;

  const brandonChecks = month.paychecks.filter(p => p.person === 'Brandon' || !p.person);
  const chelseaChecks = month.paychecks.filter(p => p.person === 'Chelsea');
  const brandonIncome = brandonChecks.reduce((s, p) => s + p.amount, 0);
  const chelseaIncome = chelseaChecks.reduce((s, p) => s + p.amount, 0);

  const toggleBillPaid = (id) => { const next = new Set(paidBills); next.has(id) ? next.delete(id) : next.add(id); updateMonth({ paidBills: [...next] }); };
  const setBillOverride = (id, val) => updateMonth({ billOverrides: { ...billOverrides, [id]: val } });
  const billAmount = (bill) => billOverrides[bill.id] ?? bill.amount;
  const quickAdd = (person, type) => {
    const amount = person === 'Chelsea' ? paycheckConfig.chelseaPay : type === 'big' ? paycheckConfig.brandonBig : paycheckConfig.brandonSmall;
    updateMonth({ paychecks: [...month.paychecks, { date: '', amount, person, type }] });
  };
  const removePaycheck = (idx) => updateMonth({ paychecks: month.paychecks.filter((_, i) => i !== idx) });

  const years = [...new Set(months.map(m => m.year))].sort();
  const selectedYear = month.year;
  const monthsInYear = months.filter(m => m.year === selectedYear);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <div className="flex gap-2">
          {years.map(yr => (
            <button key={yr} className={`month-tab${selectedYear === yr ? ' active' : ''}`}
              onClick={() => { const first = months.findIndex(m => m.year === yr); if (first >= 0) setSelectedIdx(first); }}>
              {yr}
            </button>
          ))}
        </div>
        <select value={selectedIdx} onChange={e => setSelectedIdx(Number(e.target.value))} style={{ padding: '7px 12px', fontSize: 14, minWidth: 140 }}>
          {monthsInYear.map(m => { const idx = months.indexOf(m); return <option key={m.id} value={idx}>{m.name}</option>; })}
        </select>
      </div>

      <div className="grid-2 mb-4">
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <div className="section-heading" style={{ margin: 0 }}>
              <span style={{ color: 'var(--green)' }}>●</span> Brandon
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => quickAdd('Brandon', 'small')}>+S</button>
              <button className="btn-ghost btn-sm" onClick={() => quickAdd('Brandon', 'big')}>+B</button>
            </div>
          </div>
          {brandonChecks.map((p, i) => {
            const gi = month.paychecks.indexOf(p);
            return (
              <div key={i} className="paycheck-item">
                <span className="badge" style={{ background: p.type === 'big' ? 'rgba(16,185,129,0.15)' : 'rgba(136,146,164,0.15)', color: p.type === 'big' ? 'var(--green)' : 'var(--text-muted)' }}>
                  {p.type === 'big' ? 'BIG' : 'small'}
                </span>
                <span className="flex-1 font-semibold">{fmt(p.amount)}</span>
                <input type="number" className="editable-amount" value={p.amount} onChange={e => { const u = [...month.paychecks]; u[gi] = { ...u[gi], amount: parseFloat(e.target.value) || 0 }; updateMonth({ paychecks: u }); }} style={{ width: 88 }} />
                <button className="btn-danger btn-sm" onClick={() => removePaycheck(gi)}>✕</button>
              </div>
            );
          })}
          <div className="divider" />
          <div className="flex justify-between font-bold text-sm"><span>Brandon total</span><span className="text-green">{fmt(brandonIncome)}</span></div>
        </div>
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <div className="section-heading" style={{ margin: 0 }}>
              <span style={{ color: '#818cf8' }}>●</span> Chelsea
            </div>
            <button className="btn-ghost btn-sm" onClick={() => quickAdd('Chelsea', 'regular')}>+Check</button>
          </div>
          {chelseaChecks.map((p, i) => {
            const gi = month.paychecks.indexOf(p);
            return (
              <div key={i} className="paycheck-item">
                <span className="badge" style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>bi</span>
                <span className="flex-1 font-semibold">{fmt(p.amount)}</span>
                <input type="number" className="editable-amount" value={p.amount} onChange={e => { const u = [...month.paychecks]; u[gi] = { ...u[gi], amount: parseFloat(e.target.value) || 0 }; updateMonth({ paychecks: u }); }} style={{ width: 88 }} />
                <button className="btn-danger btn-sm" onClick={() => removePaycheck(gi)}>✕</button>
              </div>
            );
          })}
          <div className="divider" />
          <div className="flex justify-between font-bold text-sm"><span>Chelsea total</span><span style={{ color: '#818cf8' }}>{fmt(chelseaIncome)}</span></div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        <div className="card">
          <div className="section-heading" style={{ marginBottom: 12 }}>Expenses</div>
          <div className="summary-row" style={{ cursor: 'pointer' }} onClick={() => setBillsExpanded(v => !v)}>
            <span className="text-muted flex items-center gap-2">
              <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: billsExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              Fixed Bills
            </span>
            <span className="font-semibold">{fmt(activeBillsTotal)}</span>
          </div>
          {billsExpanded && bills.map(bill => {
            const paid = paidBills.has(bill.id);
            return (
              <div key={bill.id} className="flex items-center gap-2" style={{ padding: '4px 0 4px 20px', opacity: paid ? 0.4 : 1 }}>
                <button onClick={() => toggleBillPaid(bill.id)} style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${paid ? 'var(--green)' : 'var(--border)'}`, background: paid ? 'var(--green)' : 'transparent', cursor: 'pointer', color: 'white', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>{paid ? '✓' : ''}</button>
                <span className="text-sm flex-1">{bill.name}</span>
                <input type="number" className="editable-amount" value={billAmount(bill)} disabled={paid} onChange={e => setBillOverride(bill.id, parseFloat(e.target.value) || 0)} style={{ width: 80 }} />
              </div>
            );
          })}
          {(month.expenses ?? []).map((exp, i) => (
            <div key={i} className="summary-row">
              <span className="text-muted">{exp.label}</span>
              <input type="number" className="editable-amount" value={exp.amount} onChange={e => { const u = [...(month.expenses ?? [])]; u[i] = { ...u[i], amount: parseFloat(e.target.value) || 0 }; updateMonth({ expenses: u }); }} />
            </div>
          ))}
          <div className="divider" />
          <div className="flex justify-between font-bold"><span>Total Expenses</span><span className="text-red">{fmt(totalExpenses)}</span></div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="stat-card">
            <div className="stat-label">Total Available</div>
            <div className="stat-value text-green">{fmt(totalAvailable)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{month.name} Final</div>
            <div className={`stat-value ${monthFinal >= 0 ? 'text-green' : 'text-red'}`}>{fmt(monthFinal)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline chat for playground — own message state, no routing
function PgChat({ bills, debts, months, paycheckConfig }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setError('');

    try {
      // Build a simple context
      const totalBills = bills.reduce((s, b) => s + b.amount, 0);
      const allMonths = computeAllMonths(months, bills);
      const dec27 = allMonths.find(m => m.name === 'December' && m.year === 2027);
      const budgetContext = `This is a WHAT-IF SCENARIO (not the real budget).
Bills: ${fmt(totalBills)}/mo, End of 2027: ${dec27 ? fmt(dec27.monthFinal) : 'N/A'}
Monthly data: ${allMonths.map(m => `${m.name} ${m.year}: ${fmt(m.monthFinal)}`).join(', ')}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated.slice(-20), budgetContext }),
      });
      if (!res.ok) throw new Error('Request failed');
      const { reply } = await res.json();
      setMessages([...updated, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', maxHeight: 600 }}>
      <div className="card flex-1" style={{ overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
            <span className="text-sm text-muted">Ask about this scenario...</span>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: '10px 14px', borderRadius: 12, background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface2)', color: msg.role === 'user' ? 'white' : 'var(--text)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {msg.content}
          </div>
        ))}
        {loading && <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 12, background: 'var(--surface2)', fontSize: 14 }}><span className="text-muted">Thinking...</span></div>}
      </div>
      {error && <div className="text-sm text-red mb-2">{error}</div>}
      <div className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask about this scenario..." style={{ flex: 1, padding: '12px 16px', fontSize: 14 }} disabled={loading} />
        <button className="btn-primary" onClick={send} disabled={loading || !input.trim()} style={{ padding: '12px 20px' }}>Send</button>
      </div>
    </div>
  );
}

export default function Playground({ playgrounds, setPlaygrounds, mainBills, mainDebts, mainMonths, mainPaycheckConfig }) {
  const { pgId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreate, setShowCreate] = useState(false);
  const [showRename, setShowRename] = useState(null);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');

  const current = pgId ? playgrounds.find((p) => p.id === pgId) : null;

  const createPlayground = (name) => {
    if (playgrounds.length >= 5) return;
    const id = Date.now().toString(36);
    const pg = {
      id,
      name: name || `Scenario ${playgrounds.length + 1}`,
      createdAt: new Date().toISOString(),
      bills: JSON.parse(JSON.stringify(mainBills)),
      debts: JSON.parse(JSON.stringify(mainDebts)),
      months: JSON.parse(JSON.stringify(mainMonths)),
      paycheckConfig: { ...mainPaycheckConfig },
    };
    setPlaygrounds([...playgrounds, pg]);
    setShowCreate(false);
    setNewName('');
    navigate(`/playgrounds/${id}`);
  };

  const deletePlayground = (id) => {
    setPlaygrounds(playgrounds.filter((p) => p.id !== id));
    if (pgId === id) navigate('/playgrounds');
  };

  const renamePlayground = (id, name) => {
    setPlaygrounds(playgrounds.map((p) => p.id === id ? { ...p, name } : p));
    setShowRename(null);
  };

  const updatePg = (updates) => {
    setPlaygrounds(playgrounds.map((p) => p.id === pgId ? { ...p, ...updates } : p));
  };

  // Playground list view
  if (!current) {
    const filtered = playgrounds.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div>
        <div className="page-header">
          <h2>Budget Scenarios</h2>
          <p>Create up to 5 playground budgets to test different scenarios without affecting your main budget</p>
        </div>

        <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
          <input type="text" placeholder="Search scenarios..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <button className="btn-primary" disabled={playgrounds.length >= 5} onClick={() => setShowCreate(true)}>
            + New Scenario {playgrounds.length >= 5 && '(max 5)'}
          </button>
        </div>

        {showCreate && (
          <div className="card mb-4">
            <div className="font-bold mb-3">Create New Scenario</div>
            <div className="text-sm text-muted mb-3">This copies your entire main budget as a starting point. Changes here won't affect your real numbers.</div>
            <div className="flex gap-2">
              <input type="text" placeholder="Scenario name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createPlayground(newName)} style={{ flex: 1 }} autoFocus />
              <button className="btn-primary" onClick={() => createPlayground(newName)}>Create</button>
              <button className="btn-ghost" onClick={() => { setShowCreate(false); setNewName(''); }}>Cancel</button>
            </div>
          </div>
        )}

        {filtered.length === 0 && !showCreate && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div className="text-muted mb-2">No scenarios yet</div>
            <div className="text-sm text-muted">Create one to start experimenting with your budget</div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((pg) => {
            const allM = computeAllMonths(pg.months, pg.bills);
            const dec27 = allM.find((m) => m.name === 'December' && m.year === 2027);
            const endOf2027 = dec27?.monthFinal ?? 0;
            return (
              <div key={pg.id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => navigate(`/playgrounds/${pg.id}`)}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div className="flex justify-between items-center">
                  <div>
                    {showRename === pg.id ? (
                      <input autoFocus type="text" defaultValue={pg.name} onClick={e => e.stopPropagation()}
                        onBlur={e => renamePlayground(pg.id, e.target.value.trim() || pg.name)}
                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setShowRename(null); }}
                        style={{ fontSize: 16, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', color: 'var(--text)', outline: 'none' }} />
                    ) : (
                      <div className="font-bold" style={{ fontSize: 16 }}>{pg.name}</div>
                    )}
                    <div className="text-xs text-muted mt-1">Created {new Date(pg.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-muted">End of 2027</div>
                      <div className={`font-bold ${endOf2027 >= 0 ? 'text-green' : 'text-red'}`}>{fmt(endOf2027)}</div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button className="btn-ghost btn-sm" onClick={() => setShowRename(pg.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => deletePlayground(pg.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-muted mt-4" style={{ textAlign: 'center' }}>{playgrounds.length}/5 scenarios used</div>
      </div>
    );
  }

  // Single playground view — fully isolated
  return (
    <div>
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <button className="btn-ghost btn-sm" onClick={() => navigate('/playgrounds')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          &nbsp;Back
        </button>
        <div style={{ flex: 1 }}>
          <div className="font-bold" style={{ fontSize: 16 }}>{current.name}</div>
          <div className="text-xs text-muted">Playground — changes don't affect your main budget</div>
        </div>
        <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-hover)', padding: '4px 10px' }}>Scenario</span>
      </div>

      <div className="flex gap-1 mb-4">
        {TABS.map((tab) => (
          <button key={tab.id} className={`month-tab${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && <PgDashboard bills={current.bills} debts={current.debts} months={current.months} />}
      {activeTab === 'bills' && (
        <Bills bills={current.bills} setBills={b => updatePg({ bills: b })} />
      )}
      {activeTab === 'monthly' && (
        <PgMonthly bills={current.bills} months={current.months} setMonths={m => updatePg({ months: m })} paycheckConfig={current.paycheckConfig} />
      )}
      {activeTab === 'debt' && (
        <Debt debts={current.debts} setDebts={d => updatePg({ debts: d })} />
      )}
      {activeTab === 'salary' && (
        <SalaryCalc paycheckConfig={current.paycheckConfig} setPaycheckConfig={pc => updatePg({ paycheckConfig: pc })} months={current.months} setMonths={m => updatePg({ months: m })} />
      )}
      {activeTab === 'chat' && <PgChat bills={current.bills} debts={current.debts} months={current.months} paycheckConfig={current.paycheckConfig} />}
    </div>
  );
}
