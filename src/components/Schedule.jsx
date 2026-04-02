import { useState, useMemo } from 'react';

// Anchor: March 26 2026 = start of a work hitch
// Pattern: 14 days work, 7 days home (21-day cycle)
const ANCHOR = new Date(2026, 2, 26); // Mar 26 2026
const WORK_DAYS = 14;
const HOME_DAYS = 7;
const CYCLE = WORK_DAYS + HOME_DAYS;

function getStatus(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const anchor = new Date(ANCHOR.getFullYear(), ANCHOR.getMonth(), ANCHOR.getDate());
  let diff = Math.floor((d - anchor) / 86400000);
  // Normalize to positive cycle
  diff = ((diff % CYCLE) + CYCLE) % CYCLE;
  if (diff < WORK_DAYS) return 'work';
  return 'home';
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { startDay, daysInMonth };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function Schedule() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const { startDay, daysInMonth } = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Current status
  const currentStatus = getStatus(today);

  // Next transition
  const nextTransition = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (let i = 1; i <= 21; i++) {
      const check = new Date(d);
      check.setDate(check.getDate() + i);
      if (getStatus(check) !== currentStatus) {
        return { date: check, status: getStatus(check), daysAway: i };
      }
    }
    return null;
  }, [todayStr]);

  // Count remaining work/home days in current stretch
  const daysLeft = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let count = 0;
    for (let i = 1; i <= 21; i++) {
      const check = new Date(d);
      check.setDate(check.getDate() + i);
      if (getStatus(check) === currentStatus) count++;
      else break;
    }
    return count + 1; // include today
  }, [todayStr]);

  function prev() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function next() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  const cells = [];
  // Empty cells before first day
  for (let i = 0; i < startDay; i++) cells.push(<div key={`e${i}`} className="sched-cell empty" />);
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear, viewMonth, d);
    const status = getStatus(date);
    const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
    cells.push(
      <div key={d} className={`sched-cell ${status}${isToday ? ' today' : ''}`}>
        <span className="sched-day">{d}</span>
        <span className="sched-label">{status === 'work' ? 'Work' : 'Home'}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Brandon's Schedule</h2>
        <p className="subtitle">2 weeks on, 1 week home — rotating hitch schedule</p>
      </div>

      {/* Status cards */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Right Now</div>
          <div style={{
            fontSize: 22, fontWeight: 700,
            color: currentStatus === 'work' ? 'var(--danger)' : 'var(--success)',
          }}>
            {currentStatus === 'work' ? 'At Work' : 'Home'}
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Days Left This Stretch</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{daysLeft}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
            {nextTransition?.status === 'home' ? 'Comes Home' : 'Goes Back'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {nextTransition ? `${MONTHS[nextTransition.date.getMonth()]} ${nextTransition.date.getDate()}` : '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {nextTransition ? `${nextTransition.daysAway} day${nextTransition.daysAway !== 1 ? 's' : ''} away` : ''}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="sched-header">
          <button className="btn btn-ghost" onClick={prev}>&larr;</button>
          <h3 style={{ margin: 0, flex: 1, textAlign: 'center' }}>
            {MONTHS[viewMonth]} {viewYear}
          </h3>
          <button className="btn btn-ghost" onClick={goToday} style={{ fontSize: 12 }}>Today</button>
          <button className="btn btn-ghost" onClick={next}>&rarr;</button>
        </div>
        <div className="sched-grid">
          {DAYS.map(d => <div key={d} className="sched-day-header">{d}</div>)}
          {cells}
        </div>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16, fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-block' }} />
            Work
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'inline-block' }} />
            Home
          </span>
        </div>
      </div>
    </div>
  );
}

export default Schedule;
