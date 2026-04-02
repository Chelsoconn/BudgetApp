import { useMemo } from 'react';
import { fmt, pct } from '../utils/format';
import { categoryColors } from '../data/budgetData';

export default function Dashboard({ bills, debts, months }) {
  const totalBills = bills.reduce((s, b) => s + b.amount, 0);

  const totalDebt = useMemo(() => {
    return (
      debts.vehicles.reduce((s, d) => s + d.amount, 0) +
      debts.medicalDebt.reduce((s, d) => s + d.amount, 0) +
      debts.studentLoans.reduce((s, d) => s + d.amount, 0) +
      debts.creditCards.reduce((s, d) => s + d.amount, 0)
    );
  }, [debts]);

  const currentMonth = months[0];
  const monthIncome = currentMonth?.paychecks.reduce((s, p) => s + p.amount, 0) ?? 0;
  const monthExpenses = totalBills + (currentMonth?.spending ?? 0) + (currentMonth?.hsa ?? 0);
  const monthDiff = monthIncome - monthExpenses;

  // Savings progression
  let runSavings = 0;
  const savingsData = months.map((m) => {
    const income = m.paychecks.reduce((s, p) => s + p.amount, 0);
    const expenses = totalBills + (m.spending ?? 0) + (m.hsa ?? 0) + (m.childcare ?? 0) + (m.hair ?? 0);
    const diff = income - expenses;
    const adj = (m.adjustments ?? []).reduce((s, a) => s + a.amount, 0);
    runSavings += diff + adj;
    return { name: m.name, savings: runSavings };
  });

  const latestSavings = savingsData[savingsData.length - 1]?.savings ?? 0;

  // Category breakdown
  const byCategory = {};
  bills.forEach((b) => {
    byCategory[b.category] = (byCategory[b.category] ?? 0) + b.amount;
  });
  const categoryList = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const ccDebt = debts.creditCards.reduce((s, d) => s + d.amount, 0);
  const ccLimit = debts.creditCards.reduce((s, d) => s + (d.limit ?? 0), 0);
  const ccUtil = pct(ccDebt, ccLimit);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Your financial overview at a glance</p>
      </div>

      <div className="grid-4 mb-4">
        <div className="stat-card">
          <div className="stat-label">Monthly Bills</div>
          <div className="stat-value">{fmt(totalBills)}</div>
          <div className="stat-sub">fixed expenses</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{currentMonth?.name} Income</div>
          <div className="stat-value">{fmt(monthIncome)}</div>
          <div className="stat-sub">{currentMonth?.paychecks.length} paychecks</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{currentMonth?.name} Difference</div>
          <div className={`stat-value ${monthDiff >= 0 ? 'text-green' : 'text-red'}`}>
            {fmt(monthDiff)}
          </div>
          <div className="stat-sub">income - expenses</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Debt</div>
          <div className="stat-value text-red">{fmt(totalDebt)}</div>
          <div className="stat-sub">across all categories</div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Savings Progress */}
        <div className="card">
          <div className="section-heading">📈 Savings Projection</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savingsData.map((m) => {
              const max = Math.max(...savingsData.map((x) => Math.abs(x.savings)), 1);
              const isNeg = m.savings < 0;
              const barPct = Math.min(100, Math.abs(m.savings) / max * 100);
              return (
                <div key={m.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted">{m.name}</span>
                    <span className={isNeg ? 'text-red font-semibold' : 'text-green font-semibold'}>
                      {fmt(m.savings)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${barPct}%`,
                        background: isNeg ? 'var(--red)' : 'var(--green)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bills by Category */}
        <div className="card">
          <div className="section-heading">🏷️ Bills by Category</div>
          <div className="donut-legend">
            {categoryList.map(([cat, amt]) => (
              <div key={cat} className="donut-legend-item">
                <span
                  className="cat-dot"
                  style={{ background: categoryColors[cat] ?? '#6b7280' }}
                />
                <span className="flex-1 text-sm">{cat}</span>
                <span className="text-sm font-semibold">{fmt(amt)}</span>
                <div className="donut-legend-bar" style={{ width: 80 }}>
                  <div
                    className="donut-legend-fill"
                    style={{
                      width: `${pct(amt, totalBills)}%`,
                      background: categoryColors[cat] ?? '#6b7280',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-3">
        {/* Credit utilization */}
        <div className="card">
          <div className="section-heading">💳 Credit Utilization</div>
          <div className="flex justify-between mb-2">
            <span className="text-muted text-sm">Used</span>
            <span className="font-bold text-sm">{ccUtil}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${ccUtil}%`,
                background: ccUtil > 70 ? 'var(--red)' : ccUtil > 30 ? 'var(--yellow)' : 'var(--green)',
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-muted">{fmt(ccDebt)} used</span>
            <span className="text-xs text-muted">{fmt(ccLimit)} total limit</span>
          </div>
        </div>

        {/* Debt breakdown */}
        <div className="card">
          <div className="section-heading">🏦 Debt Breakdown</div>
          {[
            { label: 'Vehicles', amt: debts.vehicles.reduce((s, d) => s + d.amount, 0) },
            { label: 'Student Loans', amt: debts.studentLoans.reduce((s, d) => s + d.amount, 0) },
            { label: 'Credit Cards', amt: debts.creditCards.reduce((s, d) => s + d.amount, 0) },
            { label: 'Medical', amt: debts.medicalDebt.reduce((s, d) => s + d.amount, 0) },
          ].map((row) => (
            <div key={row.label} className="summary-row">
              <span className="text-sm text-muted">{row.label}</span>
              <span className="font-semibold text-sm">{fmt(row.amt)}</span>
            </div>
          ))}
          <div className="summary-row">
            <span className="font-bold">Total</span>
            <span className="font-bold text-red">{fmt(totalDebt)}</span>
          </div>
        </div>

        {/* Running savings */}
        <div className="card">
          <div className="section-heading">💰 Projected Savings</div>
          <div className={`stat-value ${latestSavings >= 0 ? 'text-green' : 'text-red'}`} style={{ fontSize: 36 }}>
            {fmt(latestSavings)}
          </div>
          <div className="stat-sub mt-1">after {months.length} months tracked</div>
          <div className="divider" />
          <div className="text-sm text-muted">
            Includes scheduled adjustments and one-time payments
          </div>
        </div>
      </div>
    </div>
  );
}
