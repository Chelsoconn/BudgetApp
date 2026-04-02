import { useState, useMemo } from 'react';

// Anchor: March 26 2026 = start of a work hitch
// Pattern: 14 days work, 7 days home (21-day cycle)
const ANCHOR = new Date(2026, 2, 26); // Mar 26 2026
const WORK_DAYS = 14;
const HOME_DAYS = 7;
const CYCLE = WORK_DAYS + HOME_DAYS;

// Events: key = 'YYYY-M-D', value = { kids: 'off'|'early'|null, chelsea: bool }
const EVENTS = {};
function key(y, m, d) { return `${y}-${m}-${d}`; }
function ensure(y, m, d) { const k = key(y,m,d); if (!EVENTS[k]) EVENTS[k] = { kids: null, chelsea: false }; return EVENTS[k]; }
function addOff(y, m, d) { ensure(y,m,d).kids = 'off'; }
function addEarly(y, m, d) { ensure(y,m,d).kids = 'early'; }
function addChelsea(y, m, d) { ensure(y,m,d).chelsea = true; }

// Days off
addOff(2025, 8, 1);   // Labor Day
addOff(2025, 9, 10);  // Student/Staff Holiday
addOff(2025, 9, 13);  // Prof Dev/Student Holiday
for (let d = 24; d <= 28; d++) addOff(2025, 10, d); // Thanksgiving
for (let d = 22; d <= 31; d++) addOff(2025, 11, d); // Winter Break
addOff(2026, 0, 1);   // Winter Break
addOff(2026, 0, 2);   // Winter Break
for (let d = 5; d <= 7; d++) addOff(2026, 0, d); // Prof Dev
addOff(2026, 1, 13);  // Student/Staff Holiday
addOff(2026, 1, 16);  // Prof Dev/Student Holiday
for (let d = 16; d <= 20; d++) addOff(2026, 2, d); // Spring Break
addOff(2026, 2, 23);  // Prof Dev/Student Holiday
addOff(2026, 4, 25);  // Memorial Day

// Early release days (2025-2026)
addEarly(2025, 7, 13);  // Aug 13
addEarly(2025, 8, 22);  // Sep 22
addEarly(2025, 9, 22);  // Oct 22
addEarly(2025, 11, 19); // Dec 19
addEarly(2026, 1, 12);  // Feb 12
addEarly(2026, 2, 13);  // Mar 13
addEarly(2026, 3, 3);   // Apr 3
addEarly(2026, 4, 15);  // May 15
addEarly(2026, 4, 22);  // May 22 (last day)

// ── 2026-2027 Lake Travis ISD ──
// Days off
addOff(2026, 8, 7);   // Labor Day
addOff(2026, 8, 21);  // Yom Kippur / Student Holiday
addOff(2026, 9, 9);   // Student Holiday (conferences)
addOff(2026, 9, 12);  // Columbus Day
addOff(2026, 9, 30);  // Student Holiday / Staff PD
addOff(2026, 10, 2);  // Student Holiday (conferences)
for (let d = 23; d <= 27; d++) addOff(2026, 10, d); // Thanksgiving
for (let d = 18; d <= 31; d++) addOff(2026, 11, d); // Winter Break
addOff(2027, 0, 1);   // Winter Break
addOff(2027, 0, 4);   // Student Holiday / Staff Day
addOff(2027, 0, 5);   // Student Holiday / Staff PD
addOff(2027, 0, 18);  // MLK Day
addOff(2027, 1, 11);  // Student Holiday / Staff PD
addOff(2027, 1, 12);  // Student Holiday (conferences)
addOff(2027, 1, 15);  // Presidents' Day
for (let d = 15; d <= 19; d++) addOff(2027, 2, d); // Spring Break
addOff(2027, 2, 26);  // Good Friday
addOff(2027, 3, 23);  // No School
addOff(2027, 3, 26);  // No School
addOff(2027, 4, 31);  // Memorial Day

// Early release days (2026-2027)
addEarly(2027, 4, 27); // May 27 - Last day, early release district-wide

// ── Chelsea's days off (federal holidays) ──
// 2025
addChelsea(2025, 0, 1);   // New Year's Day
addChelsea(2025, 0, 20);  // MLK Day
addChelsea(2025, 4, 26);  // Memorial Day
addChelsea(2025, 6, 4);   // Independence Day
addChelsea(2025, 8, 1);   // Labor Day
addChelsea(2025, 10, 27); // Thanksgiving
addChelsea(2025, 11, 25); // Christmas
// 2026
addChelsea(2026, 0, 1);   // New Year's Day
addChelsea(2026, 0, 19);  // MLK Day
addChelsea(2026, 4, 25);  // Memorial Day
addChelsea(2026, 6, 3);   // Independence Day (observed)
addChelsea(2026, 8, 7);   // Labor Day
addChelsea(2026, 10, 26); // Thanksgiving
addChelsea(2026, 11, 25); // Christmas
// 2027
addChelsea(2027, 0, 1);   // New Year's Day
addChelsea(2027, 0, 18);  // MLK Day
addChelsea(2027, 4, 31);  // Memorial Day
addChelsea(2027, 6, 5);   // Independence Day (observed, Jul 4=Sun)
addChelsea(2027, 8, 6);   // Labor Day
addChelsea(2027, 10, 25); // Thanksgiving
addChelsea(2027, 11, 24); // Christmas (observed, Dec 25=Sat)

function getEvents(date) {
  return EVENTS[key(date.getFullYear(), date.getMonth(), date.getDate())] || null;
}

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
    const ev = getEvents(date);
    const kidsClass = ev?.kids ? ` school-${ev.kids}` : '';
    const chelseaClass = ev?.chelsea ? ' chelsea-off' : '';
    cells.push(
      <div key={d} className={`sched-cell ${status}${isToday ? ' today' : ''}${kidsClass}${chelseaClass}`}>
        <span className="sched-day">{d}</span>
        <span className="sched-label">{status === 'work' ? 'Work' : 'Home'}</span>
        {ev?.kids === 'off' && <span className="school-badge off">Kids Off</span>}
        {ev?.kids === 'early' && <span className="school-badge early">Early Out</span>}
        {ev?.chelsea && <span className="school-badge chelsea">Chelsea Off</span>}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Family Schedule</h2>
        <p className="subtitle">Brandon's 2-on/1-off rotation + kids' &amp; Chelsea's days off</p>
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
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
            <select
              value={viewMonth}
              onChange={e => setViewMonth(Number(e.target.value))}
              className="sched-select"
            >
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={viewYear}
              onChange={e => setViewYear(Number(e.target.value))}
              className="sched-select"
            >
              {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 1 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(251,191,36,0.25)', border: '1px solid rgba(251,191,36,0.5)', display: 'inline-block' }} />
            No School
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(168,85,247,0.20)', border: '1px solid rgba(168,85,247,0.4)', display: 'inline-block' }} />
            Early Out
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(59,130,246,0.20)', border: '1px solid rgba(59,130,246,0.4)', display: 'inline-block' }} />
            Chelsea Off
          </span>
        </div>
      </div>
    </div>
  );
}

export default Schedule;
