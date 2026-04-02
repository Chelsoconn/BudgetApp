import { useEffect } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import './App.css';
import { initialBills, initialDebts, initialMonths, brandonSmall, brandonBig, chelseaPaycheck } from './data/budgetData';
import { usePersistedState } from './hooks/usePersistedState';
import Dashboard from './components/Dashboard';
import Bills from './components/Bills';
import MonthlyBudget from './components/MonthlyBudget';
import Debt from './components/Debt';
import SalaryCalc from './components/SalaryCalc';
import Playground from './components/Playground';
import Chat from './components/Chat';
import Schedule from './components/Schedule';

// Inline SVG icons
const icons = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  bills: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>,
  monthly: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>,
  debt: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  salary: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  playground: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  schedule: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
};

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: icons.dashboard },
  { path: '/bills', label: 'Bills', icon: icons.bills },
  { path: '/monthly', label: 'Monthly', icon: icons.monthly },
  { path: '/debt', label: 'Debt', icon: icons.debt },
  { path: '/salary', label: 'Salary', icon: icons.salary },
  { path: '/chat', label: 'Ask AI', icon: icons.chat },
  { path: '/schedule', label: 'Schedule', icon: icons.schedule },
];

function App() {
  const [bills, setBills] = usePersistedState('budget_bills', initialBills);
  const [debts, setDebts] = usePersistedState('budget_debts', initialDebts);
  const [months, setMonths] = usePersistedState('budget_months', initialMonths);
  const [paycheckConfig, setPaycheckConfig] = usePersistedState('budget_paycheck_config', {
    brandonSmall,
    brandonBig,
    chelseaPay: chelseaPaycheck,
  });
  const [playgrounds, setPlaygrounds] = usePersistedState('budget_playgrounds', []);


  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">B</div>
          <div>
            <h1>Budget</h1>
            <p>House Tracker</p>
          </div>
        </div>
        <div className="nav-section">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
        <div className="nav-section" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '0 12px', marginBottom: 4 }}>
            Scenarios
          </div>
          <NavLink
            to="/playgrounds"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{icons.playground}</span>
            <span>What-If</span>
            {playgrounds.length > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                background: 'rgba(99,102,241,0.15)', color: 'var(--accent-hover)',
                borderRadius: 999, padding: '1px 7px',
              }}>
                {playgrounds.length}
              </span>
            )}
          </NavLink>
        </div>
      </nav>

      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard bills={bills} debts={debts} months={months} />} />
          <Route path="/bills" element={<Bills bills={bills} setBills={setBills} />} />
          <Route path="/monthly" element={<MonthlyBudget bills={bills} months={months} setMonths={setMonths} paycheckConfig={paycheckConfig} />} />
          <Route path="/monthly/:monthSlug" element={<MonthlyBudget bills={bills} months={months} setMonths={setMonths} paycheckConfig={paycheckConfig} />} />
          <Route path="/debt" element={<Debt debts={debts} setDebts={setDebts} />} />
          <Route path="/salary" element={<SalaryCalc paycheckConfig={paycheckConfig} setPaycheckConfig={setPaycheckConfig} months={months} setMonths={setMonths} />} />
          <Route path="/chat" element={<Chat bills={bills} debts={debts} months={months} paycheckConfig={paycheckConfig} />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/playgrounds" element={
            <Playground
              playgrounds={playgrounds} setPlaygrounds={setPlaygrounds}
              mainBills={bills} mainDebts={debts} mainMonths={months} mainPaycheckConfig={paycheckConfig}
            />
          } />
          <Route path="/playgrounds/:pgId" element={
            <Playground
              playgrounds={playgrounds} setPlaygrounds={setPlaygrounds}
              mainBills={bills} mainDebts={debts} mainMonths={months} mainPaycheckConfig={paycheckConfig}
            />
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;
