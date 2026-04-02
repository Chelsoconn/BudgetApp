import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fmt } from '../utils/format';
import { computeAllMonths } from '../utils/computeMonth';
import Dashboard from './Dashboard';
import Bills from './Bills';
import MonthlyBudget from './MonthlyBudget';
import Debt from './Debt';
import SalaryCalc from './SalaryCalc';
import Chat from './Chat';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bills', label: 'Bills' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'debt', label: 'Debt' },
  { id: 'salary', label: 'Salary' },
  { id: 'chat', label: 'Ask AI' },
];

export default function Playground({ playgrounds, setPlaygrounds, mainBills, mainDebts, mainMonths, mainPaycheckConfig }) {
  const { pgId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreate, setShowCreate] = useState(false);
  const [showRename, setShowRename] = useState(null);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');

  // If no pgId, show the playground list
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
          <input
            type="text"
            placeholder="Search scenarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button
            className="btn-primary"
            disabled={playgrounds.length >= 5}
            onClick={() => setShowCreate(true)}
          >
            + New Scenario {playgrounds.length >= 5 && '(max 5)'}
          </button>
        </div>

        {showCreate && (
          <div className="card mb-4">
            <div className="font-bold mb-3">Create New Scenario</div>
            <div className="text-sm text-muted mb-3">
              This copies your entire main budget as a starting point. Changes here won't affect your real numbers.
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Scenario name (e.g. 'What if we sell the boat')"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createPlayground(newName)}
                style={{ flex: 1 }}
                autoFocus
              />
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
              <div
                key={pg.id}
                className="card"
                style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => navigate(`/playgrounds/${pg.id}`)}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div className="flex justify-between items-center">
                  <div>
                    {showRename === pg.id ? (
                      <input
                        autoFocus
                        type="text"
                        defaultValue={pg.name}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => renamePlayground(pg.id, e.target.value.trim() || pg.name)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.target.blur();
                          if (e.key === 'Escape') setShowRename(null);
                        }}
                        style={{ fontSize: 16, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', color: 'var(--text)', outline: 'none' }}
                      />
                    ) : (
                      <div className="font-bold" style={{ fontSize: 16 }}>{pg.name}</div>
                    )}
                    <div className="text-xs text-muted mt-1">
                      Created {new Date(pg.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-muted">End of 2027</div>
                      <div className={`font-bold ${endOf2027 >= 0 ? 'text-green' : 'text-red'}`}>{fmt(endOf2027)}</div>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-ghost btn-sm" onClick={() => setShowRename(pg.id)} title="Rename">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => deletePlayground(pg.id)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-muted mt-4" style={{ textAlign: 'center' }}>
          {playgrounds.length}/5 scenarios used
        </div>
      </div>
    );
  }

  // Single playground view — full budget editor
  return (
    <div>
      {/* Playground header bar */}
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <button className="btn-ghost btn-sm" onClick={() => navigate('/playgrounds')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          &nbsp;Back
        </button>
        <div style={{ flex: 1 }}>
          <div className="font-bold" style={{ fontSize: 16 }}>{current.name}</div>
          <div className="text-xs text-muted">Playground — changes don't affect your main budget</div>
        </div>
        <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-hover)', padding: '4px 10px' }}>
          Scenario
        </span>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`month-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — each uses the playground's own data */}
      {activeTab === 'dashboard' && (
        <Dashboard bills={current.bills} debts={current.debts} months={current.months} />
      )}
      {activeTab === 'bills' && (
        <Bills bills={current.bills} setBills={(b) => updatePg({ bills: b })} />
      )}
      {activeTab === 'monthly' && (
        <MonthlyBudget
          bills={current.bills}
          months={current.months}
          setMonths={(m) => updatePg({ months: m })}
          paycheckConfig={current.paycheckConfig}
        />
      )}
      {activeTab === 'debt' && (
        <Debt debts={current.debts} setDebts={(d) => updatePg({ debts: d })} />
      )}
      {activeTab === 'salary' && (
        <SalaryCalc
          paycheckConfig={current.paycheckConfig}
          setPaycheckConfig={(pc) => updatePg({ paycheckConfig: pc })}
          months={current.months}
          setMonths={(m) => updatePg({ months: m })}
        />
      )}
      {activeTab === 'chat' && (
        <Chat
          bills={current.bills}
          debts={current.debts}
          months={current.months}
          paycheckConfig={current.paycheckConfig}
        />
      )}
    </div>
  );
}
