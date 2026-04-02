import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import './App.css';
import { initialBills, initialDebts, initialMonths, brandonSmall, brandonBig, chelseaPaycheck } from './data/budgetData';
import { usePersistedState } from './hooks/usePersistedState';
import Dashboard from './components/Dashboard';
import Bills from './components/Bills';
import MonthlyBudget from './components/MonthlyBudget';
import Debt from './components/Debt';
import SalaryCalc from './components/SalaryCalc';

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/bills', label: 'Bills', icon: '📋' },
  { path: '/monthly', label: 'Monthly Budget', icon: '📅' },
  { path: '/debt', label: 'Debt Tracker', icon: '💳' },
  { path: '/salary', label: 'Salary', icon: '💰' },
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

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <h1>🏠 Budget</h1>
          <p>House Budget Tracker</p>
        </div>
        <div className="nav-section">
          <div className="nav-section-label">Navigation</div>
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
        </Routes>
      </main>
    </div>
  );
}

export default App;
