import { useState } from 'react';
import { fmt } from '../utils/format';

export default function SalaryCalc() {
  const [hourlyWage, setHourlyWage] = useState(37);
  const [overtimeHours, setOvertimeHours] = useState(10);
  const [regularHours, setRegularHours] = useState(40);
  const [nonTax, setNonTax] = useState(120);
  const [chelseaMonthly, setChelseaMonthly] = useState(7730);
  const [taxRate, setTaxRate] = useState(22);

  const overtimeRate = hourlyWage * 1.5;
  const weeklyGross = regularHours * hourlyWage + overtimeHours * overtimeRate + nonTax;
  const weeklyNet = weeklyGross * (1 - taxRate / 100);
  const monthlyGross = weeklyGross * (52 / 12);
  const monthlyNet = weeklyNet * (52 / 12);
  const yearlyGross = weeklyGross * 52;
  const yearlyNet = weeklyNet * 52;

  const combinedMonthly = monthlyNet + chelseaMonthly;

  // paycheck schedule (biweekly)
  const largePaycheck = weeklyNet * 2;
  const smallPaycheck = weeklyNet;

  return (
    <div>
      <div className="page-header">
        <h2>Salary Calculator</h2>
        <p>Brandon's pay breakdown — adjust inputs to see real-time projections</p>
      </div>

      <div className="grid-2 mb-4">
        {/* Inputs */}
        <div className="card">
          <div className="section-heading">⚙️ Pay Settings</div>

          <div className="form-field mb-3">
            <label className="form-label">Hourly Wage</label>
            <div className="flex items-center gap-2">
              <span className="text-muted">$</span>
              <input
                type="number"
                value={hourlyWage}
                onChange={(e) => setHourlyWage(parseFloat(e.target.value) || 0)}
                style={{ width: 100 }}
              />
              <span className="text-muted text-sm">/ hour</span>
            </div>
          </div>

          <div className="form-field mb-3">
            <label className="form-label">Regular Hours / Week</label>
            <input
              type="number"
              value={regularHours}
              onChange={(e) => setRegularHours(parseFloat(e.target.value) || 0)}
              style={{ width: 100 }}
            />
          </div>

          <div className="form-field mb-3">
            <label className="form-label">Overtime Hours / Week</label>
            <input
              type="number"
              value={overtimeHours}
              onChange={(e) => setOvertimeHours(parseFloat(e.target.value) || 0)}
              style={{ width: 100 }}
            />
            <div className="text-xs text-muted mt-1">Rate: {fmt(overtimeRate)}/hr (1.5×)</div>
          </div>

          <div className="form-field mb-3">
            <label className="form-label">Non-Taxable / Week</label>
            <div className="flex items-center gap-2">
              <span className="text-muted">$</span>
              <input
                type="number"
                value={nonTax}
                onChange={(e) => setNonTax(parseFloat(e.target.value) || 0)}
                style={{ width: 100 }}
              />
            </div>
          </div>

          <div className="form-field mb-3">
            <label className="form-label">Est. Tax Rate</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                style={{ width: 80 }}
              />
              <span className="text-muted">%</span>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Chelsea Monthly (take-home)</label>
            <div className="flex items-center gap-2">
              <span className="text-muted">$</span>
              <input
                type="number"
                value={chelseaMonthly}
                onChange={(e) => setChelseaMonthly(parseFloat(e.target.value) || 0)}
                style={{ width: 120 }}
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-3">
          <div className="stat-card">
            <div className="stat-label">Weekly Gross</div>
            <div className="stat-value">{fmt(weeklyGross)}</div>
            <div className="stat-sub">before taxes</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Weekly Take-Home</div>
            <div className="stat-value text-green">{fmt(weeklyNet)}</div>
            <div className="stat-sub">after ~{taxRate}% taxes</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monthly Take-Home</div>
            <div className="stat-value text-green">{fmt(monthlyNet)}</div>
            <div className="stat-sub">Brandon alone</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Combined Monthly</div>
            <div className="stat-value text-accent">{fmt(combinedMonthly)}</div>
            <div className="stat-sub">Brandon + Chelsea</div>
          </div>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="card mb-4">
        <div className="section-heading">📊 Pay Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th className="text-right">Per Week</th>
              <th className="text-right">Per Month</th>
              <th className="text-right">Per Year</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Regular ({regularHours} hrs × {fmt(hourlyWage)})</td>
              <td className="text-right">{fmt(regularHours * hourlyWage)}</td>
              <td className="text-right">{fmt(regularHours * hourlyWage * 52 / 12)}</td>
              <td className="text-right">{fmt(regularHours * hourlyWage * 52)}</td>
            </tr>
            <tr>
              <td>Overtime ({overtimeHours} hrs × {fmt(overtimeRate)})</td>
              <td className="text-right">{fmt(overtimeHours * overtimeRate)}</td>
              <td className="text-right">{fmt(overtimeHours * overtimeRate * 52 / 12)}</td>
              <td className="text-right">{fmt(overtimeHours * overtimeRate * 52)}</td>
            </tr>
            <tr>
              <td>Non-Taxable</td>
              <td className="text-right">{fmt(nonTax)}</td>
              <td className="text-right">{fmt(nonTax * 52 / 12)}</td>
              <td className="text-right">{fmt(nonTax * 52)}</td>
            </tr>
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td><strong>Gross Total</strong></td>
              <td className="text-right font-bold">{fmt(weeklyGross)}</td>
              <td className="text-right font-bold">{fmt(monthlyGross)}</td>
              <td className="text-right font-bold">{fmt(yearlyGross)}</td>
            </tr>
            <tr>
              <td className="text-muted">Taxes (~{taxRate}%)</td>
              <td className="text-right text-red">−{fmt(weeklyGross * taxRate / 100)}</td>
              <td className="text-right text-red">−{fmt(monthlyGross * taxRate / 100)}</td>
              <td className="text-right text-red">−{fmt(yearlyGross * taxRate / 100)}</td>
            </tr>
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td><strong>Take-Home</strong></td>
              <td className="text-right font-bold text-green">{fmt(weeklyNet)}</td>
              <td className="text-right font-bold text-green">{fmt(monthlyNet)}</td>
              <td className="text-right font-bold text-green">{fmt(yearlyNet)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Paycheck schedule */}
      <div className="card mb-4">
        <div className="section-heading">🗓️ Typical Paycheck Sizes</div>
        <div className="grid-2">
          <div className="card-sm">
            <div className="section-label">Regular Week (1× weekly)</div>
            <div className="stat-value text-green">{fmt(weeklyNet)}</div>
            <div className="stat-sub mt-1">{regularHours} reg + {overtimeHours} OT hrs</div>
          </div>
          <div className="card-sm">
            <div className="section-label">Large Check (2 weeks combined)</div>
            <div className="stat-value text-green">{fmt(largePaycheck)}</div>
            <div className="stat-sub mt-1">bi-weekly total</div>
          </div>
        </div>
      </div>

      {/* Long-term notes from spreadsheet */}
      <div className="card">
        <div className="section-heading">🔮 Long-Term Projections</div>
        <div className="grid-2">
          <div>
            <div className="section-label">Phase 1 (Ages 39–44)</div>
            <div className="card-sm mb-3">
              <div className="text-sm text-muted mb-1">Saving ~$4k/month</div>
              <div className="font-bold">~$285,000 by age 44</div>
              <div className="text-xs text-muted mt-1">Compounding alone to 65 → ~$1.1M</div>
            </div>
          </div>
          <div>
            <div className="section-label">Phase 2 (Ages 44–65)</div>
            <div className="card-sm mb-3">
              <div className="text-sm text-muted mb-1">~$5,750/month for 21 years</div>
              <div className="font-bold">Adds ~$2.9M</div>
              <div className="text-xs text-muted mt-1">Total at 65: ~$4.0M</div>
            </div>
          </div>
        </div>
        <div className="note-box mt-2">
          <span>📌</span>
          <span>
            Chelsea: $7,730/month. December '26 savings target: {fmt(6475)}.
            December '27 savings target: {fmt(58558)}.
          </span>
        </div>
      </div>
    </div>
  );
}
