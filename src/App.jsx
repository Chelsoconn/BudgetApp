import { useState } from 'react';
import './App.css';
import { initialBills, initialDebts, initialMonths } from './data/budgetData';
import Dashboard from './components/Dashboard';
import Bills from './components/Bills';
import MonthlyBudget from './components/MonthlyBudget';
import Debt from './components/Debt';
import SalaryCalc from './components/SalaryCalc';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'bills', label: 'Bills', icon: '📋' },
  { id: 'monthly', label: 'Monthly Budget', icon: '📅' },
  { id: 'debt', label: 'Debt Tracker', icon: '💳' },
  { id: 'salary', label: 'Salary Calc', icon: '💰' },
];

function App() {
  const [page, setPage] = useState('dashboard');
  const [bills, setBills] = useState(initialBills);
  const [debts, setDebts] = useState(initialDebts);
  const [months, setMonths] = useState(initialMonths);

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard bills={bills} debts={debts} months={months} />;
      case 'bills': return <Bills bills={bills} setBills={setBills} />;
      case 'monthly': return <MonthlyBudget bills={bills} months={months} setMonths={setMonths} />;
      case 'debt': return <Debt debts={debts} setDebts={setDebts} />;
      case 'salary': return <SalaryCalc />;
      default: return null;
    }
  };

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
            <button
              key={item.id}
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <main className="main">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
