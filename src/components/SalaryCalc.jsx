import { fmt } from '../utils/format';

// Brandon's cycle: Small, Big, Small (repeating weekly)
const CYCLE = ['small', 'big', 'small'];

export default function SalaryCalc({ paycheckConfig, setPaycheckConfig, months, setMonths }) {
  const bSmall = paycheckConfig.brandonSmall;
  const bBig = paycheckConfig.brandonBig;
  const chelsea = paycheckConfig.chelseaPay;

  // Update a paycheck config value and propagate to all matching paychecks in months
  const updateAmount = (key, val) => {
    const n = parseFloat(val) || 0;
    const prev = paycheckConfig[key];
    setPaycheckConfig({ ...paycheckConfig, [key]: n });

    // Update matching paychecks in all months
    setMonths(months.map((m) => ({
      ...m,
      paychecks: m.paychecks.map((p) => {
        if (key === 'brandonSmall' && p.person === 'Brandon' && p.type === 'small' && p.amount === prev) {
          return { ...p, amount: n };
        }
        if (key === 'brandonBig' && p.person === 'Brandon' && p.type === 'big' && p.amount === prev) {
          return { ...p, amount: n };
        }
        if (key === 'chelseaPay' && p.person === 'Chelsea' && p.amount === prev) {
          return { ...p, amount: n };
        }
        return p;
      }),
    })));
  };

  // Typical month scenarios
  const scenarios = [
    { label: '4 Fri: S, B, S, S', brandon: [bSmall, bBig, bSmall, bSmall], chelsea: 2 },
    { label: '4 Fri: S, S, B, S', brandon: [bSmall, bSmall, bBig, bSmall], chelsea: 2 },
    { label: '4 Fri: B, S, S, B', brandon: [bBig, bSmall, bSmall, bBig], chelsea: 2 },
    { label: '5 Fri: S, B, S, S, B', brandon: [bSmall, bBig, bSmall, bSmall, bBig], chelsea: 2 },
    { label: '5 Fri: S, S, B, S, S', brandon: [bSmall, bSmall, bBig, bSmall, bSmall], chelsea: 2 },
    { label: '5 Fri: B, S, S, B, S', brandon: [bBig, bSmall, bSmall, bBig, bSmall], chelsea: 2 },
  ];

  const annualBrandon = Math.round(52 / 3) * (bSmall + bSmall + bBig);
  const annualChelsea = 24 * chelsea; // 2 checks/month × 12
  const annualCombined = annualBrandon + annualChelsea;
  const monthlyAvgBrandon = annualBrandon / 12;
  const monthlyAvgChelsea = annualChelsea / 12;
  const monthlyAvgCombined = annualCombined / 12;

  return (
    <div>
      <div className="page-header">
        <h2>Paycheck Overview</h2>
        <p>After-tax take-home amounts — changes here update all months automatically</p>
      </div>

      {/* Paycheck inputs */}
      <div className="grid-3 mb-4">
        <div className="card">
          <div className="section-heading">
            <span style={{ color: 'var(--green)' }}>●</span> Brandon — Small Check
          </div>
          <div className="stat-label mb-2">After-tax amount</div>
          <div className="flex items-center gap-2">
            <span className="text-muted">$</span>
            <input
              type="number"
              value={bSmall}
              onChange={(e) => updateAmount('brandonSmall', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="text-xs text-muted mt-2">Occurs twice per 3-week cycle</div>
        </div>

        <div className="card">
          <div className="section-heading">
            <span style={{ color: 'var(--green)' }}>●</span> Brandon — Big Check
          </div>
          <div className="stat-label mb-2">After-tax amount</div>
          <div className="flex items-center gap-2">
            <span className="text-muted">$</span>
            <input
              type="number"
              value={bBig}
              onChange={(e) => updateAmount('brandonBig', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="text-xs text-muted mt-2">Every 3rd week</div>
        </div>

        <div className="card">
          <div className="section-heading">
            <span style={{ color: '#818cf8' }}>●</span> Chelsea — Biweekly
          </div>
          <div className="stat-label mb-2">After-tax amount</div>
          <div className="flex items-center gap-2">
            <span className="text-muted">$</span>
            <input
              type="number"
              value={chelsea}
              onChange={(e) => updateAmount('chelseaPay', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="text-xs text-muted mt-2">15th + last day of month</div>
        </div>
      </div>

      <div className="note-box mb-4">
        <span>📌</span>
        <span>Changing an amount above updates every matching paycheck across all months in your Monthly Budget.</span>
      </div>

      {/* Paycheck pattern visualization */}
      <div className="card mb-4">
        <div className="section-heading">📅 Brandon's 3-Week Pay Cycle</div>
        <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
          {CYCLE.map((type, i) => (
            <div
              key={i}
              className="card-sm flex-1"
              style={{
                minWidth: 120,
                borderColor: type === 'big' ? 'var(--green)' : 'var(--border)',
                textAlign: 'center',
              }}
            >
              <div className="text-xs text-muted mb-1">Week {i + 1}</div>
              <div
                className="badge mb-2"
                style={{
                  background: type === 'big' ? 'rgba(16,185,129,0.15)' : 'rgba(136,146,164,0.15)',
                  color: type === 'big' ? 'var(--green)' : 'var(--text-muted)',
                }}
              >
                {type === 'big' ? 'BIG' : 'small'}
              </div>
              <div className="font-bold text-lg">{fmt(type === 'big' ? bBig : bSmall)}</div>
            </div>
          ))}
          <div
            className="card-sm"
            style={{ minWidth: 120, borderColor: '#818cf8', textAlign: 'center', opacity: 0.7 }}
          >
            <div className="text-xs text-muted mb-1">Chelsea (15th + last)</div>
            <div className="badge mb-2" style={{ background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>
              semi
            </div>
            <div className="font-bold text-lg">{fmt(chelsea)}</div>
          </div>
        </div>

        <div className="divider" />

        <div className="text-sm text-muted">
          3-week Brandon total: <strong style={{ color: 'var(--text)' }}>{fmt(bSmall + bSmall + bBig)}</strong>
          &nbsp;·&nbsp;
          4-week Chelsea total: <strong style={{ color: 'var(--text)' }}>{fmt(chelsea * 2)}</strong>
        </div>
      </div>

      {/* Annual averages */}
      <div className="grid-4 mb-4">
        <div className="stat-card">
          <div className="stat-label">Brandon Monthly Avg</div>
          <div className="stat-value text-green">{fmt(monthlyAvgBrandon)}</div>
          <div className="stat-sub">~{fmt(annualBrandon)}/yr</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Chelsea Monthly Avg</div>
          <div className="stat-value" style={{ color: '#818cf8' }}>{fmt(monthlyAvgChelsea)}</div>
          <div className="stat-sub">~{fmt(annualChelsea)}/yr · 24 checks</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Combined Monthly Avg</div>
          <div className="stat-value text-accent">{fmt(monthlyAvgCombined)}</div>
          <div className="stat-sub">approximate</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Combined Annual</div>
          <div className="stat-value text-accent">{fmt(annualCombined)}</div>
          <div className="stat-sub">after taxes</div>
        </div>
      </div>

      {/* Month scenarios */}
      <div className="card mb-4">
        <div className="section-heading">📊 Monthly Income Scenarios</div>
        <div className="text-sm text-muted mb-3">
          Actual monthly income varies based on where in Brandon's 3-week cycle the month lands and how many Chelsea checks fall that month.
        </div>
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th className="text-right">Brandon</th>
              <th className="text-right">Chelsea</th>
              <th className="text-right">Combined</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s, i) => {
              const bTotal = s.brandon.reduce((sum, x) => sum + x, 0);
              const cTotal = s.chelsea * chelsea;
              return (
                <tr key={i}>
                  <td className="text-sm">{s.label}</td>
                  <td className="text-right font-semibold text-green">{fmt(bTotal)}</td>
                  <td className="text-right font-semibold" style={{ color: '#818cf8' }}>{fmt(cTotal)}</td>
                  <td className="text-right font-bold">{fmt(bTotal + cTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Long-term projections */}
      <div className="card">
        <div className="section-heading">🔮 Long-Term Projections</div>
        <div className="grid-2">
          <div className="card-sm">
            <div className="section-label">Phase 1 (Ages 39–44)</div>
            <div className="font-bold mb-1">~$285,000 by age 44</div>
            <div className="text-sm text-muted">Saving ~$4k/month</div>
            <div className="text-xs text-muted mt-1">Compounding alone to 65 → ~$1.1M</div>
          </div>
          <div className="card-sm">
            <div className="section-label">Phase 2 (Ages 44–65)</div>
            <div className="font-bold mb-1">Adds ~$2.9M</div>
            <div className="text-sm text-muted">~$5,750/month for 21 years</div>
            <div className="text-xs text-muted mt-1">Total at 65: ~$4.0M</div>
          </div>
        </div>
        <div className="note-box mt-3">
          <span>📌</span>
          <span>
            December '26 savings target: {fmt(6475)} · December '27 savings target: {fmt(58558)}
          </span>
        </div>
      </div>
    </div>
  );
}
