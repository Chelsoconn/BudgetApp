// Initial data extracted from BudgetHouse.xlsx

export const initialBills = [
  { id: 1, name: 'Mortgage', amount: 6248, category: 'Housing' },
  { id: 2, name: 'CC', amount: 500, category: 'Debt' },
  { id: 3, name: 'Health Insurance', amount: 534, category: 'Insurance' },
  { id: 4, name: 'Car Insurance', amount: 342, category: 'Insurance' },
  { id: 5, name: 'RV Parking', amount: 360, category: 'Housing' },
  { id: 6, name: 'Starlink', amount: 165, category: 'Utilities' },
  { id: 7, name: 'Electricity', amount: 200, category: 'Utilities' },
  { id: 8, name: 'Crunch', amount: 50, category: 'Health' },
  { id: 9, name: 'Apple', amount: 100, category: 'Subscriptions' },
  { id: 10, name: 'Internet', amount: 55, category: 'Utilities' },
  { id: 11, name: 'Brinkley Payment', amount: 541, category: 'Debt' },
  { id: 12, name: 'Phones', amount: 200, category: 'Utilities' },
  { id: 13, name: 'Student Loans', amount: 196, category: 'Debt' },
  { id: 14, name: 'Truck', amount: 597, category: 'Vehicles' },
  { id: 15, name: 'Jiu Jitsu', amount: 322, category: 'Health' },
  { id: 16, name: 'Boat', amount: 413, category: 'Vehicles' },
  { id: 17, name: 'Boat Storage', amount: 152, category: 'Vehicles' },
  { id: 18, name: 'Gas', amount: 250, category: 'Transportation' },
  { id: 19, name: 'Water', amount: 200, category: 'Utilities' },
  { id: 20, name: 'Trash', amount: 50, category: 'Utilities' },
];

export const initialDebts = {
  vehicles: [
    { id: 1, name: 'Boat', amount: 12000 },
    { id: 2, name: 'Brinkley Camper', amount: 60500 },
  ],
  medicalDebt: [
    { id: 1, name: 'Medical', amount: 0 },
  ],
  studentLoans: [
    { id: 1, name: 'Nelnet', amount: 24799 },
    { id: 2, name: 'Mohela', amount: 3431 },
  ],
  creditCards: [
    { id: 1, name: 'Discover', amount: 16968, limit: 20300 },
    { id: 2, name: 'Capital One Venture', amount: 0, limit: 5000 },
    { id: 3, name: 'Discount Tire', amount: 0, limit: 5000 },
    { id: 4, name: 'CITI', amount: 5760, limit: 9780 },
  ],
};

// Brandon's weekly after-tax paycheck amounts (paid every Friday).
// Pattern repeats every 3 weeks: Small, Big, Small
export const brandonSmall = 2296.75;
export const brandonBig = 4103.11;

// Chelsea's semi-monthly after-tax paycheck (paid 15th and last day of month)
export const chelseaPaycheck = 3885;

// ── Paycheck generator ─────────────────────────────────────────────
// Brandon: every Friday, cycle S(0), B(1), S(2) starting from Fri Apr 4 2025 at pos 0
// Chelsea: 15th and last day of each month, $3,885 each

// Pure arithmetic date helpers — no Date objects, no timezone issues
function pad(n) { return n < 10 ? '0' + n : '' + n; }

function daysInMonth(year, monthIdx) {
  const table = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[monthIdx];
}

// Day-of-week for any date (0=Sun..6=Sat) using Tomohiko Sakamoto's algorithm
function dayOfWeek(y, m, d) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (m < 3) y--;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7;
}

// Days since an epoch (Jan 1, 2000) for week-counting
function daysSinceEpoch(y, m, d) {
  let days = 0;
  for (let yr = 2000; yr < y; yr++) days += (yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)) ? 366 : 365;
  for (let mo = 0; mo < m; mo++) days += daysInMonth(y, mo);
  return days + d;
}

// Reference: Friday April 3, 2026 = cycle position 0 (Small)
// Pattern: S(0), B(1), S(2), repeating
const cycleRefDays = daysSinceEpoch(2026, 3, 3);

function generatePaychecks(year, monthIdx) {
  const paychecks = [];
  const mm = pad(monthIdx + 1);
  const dim = daysInMonth(year, monthIdx);

  // Brandon — every Friday (dayOfWeek === 5)
  for (let d = 1; d <= dim; d++) {
    if (dayOfWeek(year, monthIdx + 1, d) === 5) {
      const weeksSinceRef = (daysSinceEpoch(year, monthIdx, d) - cycleRefDays) / 7;
      const pos = ((Math.round(weeksSinceRef) % 3) + 3) % 3; // 0=S, 1=B, 2=S
      const isBig = pos === 1;
      paychecks.push({
        date: `${year}-${mm}-${pad(d)}`,
        amount: isBig ? brandonBig : brandonSmall,
        person: 'Brandon',
        type: isBig ? 'big' : 'small',
      });
    }
  }

  // Chelsea — 15th and last day of month
  paychecks.push({ date: `${year}-${mm}-15`, amount: chelseaPaycheck, person: 'Chelsea', type: 'semi-monthly' });
  paychecks.push({ date: `${year}-${mm}-${pad(dim)}`, amount: chelseaPaycheck, person: 'Chelsea', type: 'semi-monthly' });

  // Sort by date
  paychecks.sort((a, b) => a.date.localeCompare(b.date));
  return paychecks;
}

// ── Month configs ───────────────────────────────────────────────────
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const monthConfigs = [
  // 2026
  { mi: 0, yr: 2026, spending: 2100, other: 800, otherLabel: 'HAS+Childcare', notes: 'Taxes Pay for Botox/Amex charge $2000' },
  { mi: 1, yr: 2026, spending: 2150, other: 1175, otherLabel: 'HAIR+HAS+Childcare' },
  { mi: 2, yr: 2026, spending: 2150, other: 800, otherLabel: 'HAS+Childcare' },
  { mi: 3, yr: 2026, spending: 2150, other: 800, otherLabel: 'HAS+Childcare' },
  { mi: 4, yr: 2026, spending: 2150, other: 975, otherLabel: 'HAIR+HAS+childcare' },
  { mi: 5, yr: 2026, spending: 2150, other: 3300, otherLabel: 'HAS+Childcare' },
  { mi: 6, yr: 2026, spending: 2150, other: 3300, otherLabel: 'HAS+Childcare' },
  { mi: 7, yr: 2026, spending: 2150, other: 1175, otherLabel: 'HAS+HAIR+Childcare' },
  { mi: 8, yr: 2026, spending: 2150, other: 500, otherLabel: 'Childcare' },
  { mi: 9, yr: 2026, spending: 2150, other: 500, otherLabel: 'Childcare' },
  { mi: 10, yr: 2026, spending: 2150, other: 1014, otherLabel: 'HAIR+AMAZON CHARGE+childcare' },
  { mi: 11, yr: 2026, spending: 2150, other: 500, otherLabel: 'Childcare' },
  // 2027
  { mi: 0, yr: 2027, spending: 2100, other: 800, otherLabel: 'HAS+Childcare' },
  { mi: 1, yr: 2027, spending: 2150, other: 1175, otherLabel: 'HAIR+HAS+Childcare' },
  { mi: 2, yr: 2027, spending: 2150, other: 800, otherLabel: 'HAS+Childcare' },
  { mi: 3, yr: 2027, spending: 2150, other: 800, otherLabel: 'HAS+Childcare' },
  { mi: 4, yr: 2027, spending: 2150, other: 975, otherLabel: 'HAIR+HAS+childcare' },
  { mi: 5, yr: 2027, spending: 2150, other: 3300, otherLabel: 'HAS+Childcare' },
  { mi: 6, yr: 2027, spending: 2150, other: 3300, otherLabel: 'HAS+Childcare' },
  { mi: 7, yr: 2027, spending: 2150, other: 1175, otherLabel: 'HAS+HAIR+Childcare', notes: '*CC + Boat payments end*' },
  { mi: 8, yr: 2027, spending: 2150, other: 500, otherLabel: 'Childcare' },
  { mi: 9, yr: 2027, spending: 2150, other: 500, otherLabel: 'Childcare' },
  { mi: 10, yr: 2027, spending: 2150, other: 1014, otherLabel: 'HAIR+AMAZON+childcare' },
  { mi: 11, yr: 2027, spending: 2150, other: 500, otherLabel: 'Childcare' },
];

export const initialMonths = monthConfigs.map((cfg, idx) => {
  const expenses = [{ label: 'Spending', amount: cfg.spending }];
  if (cfg.other) expenses.push({ label: cfg.otherLabel || 'Other', amount: cfg.other });
  return {
    id: idx + 1,
    name: monthNames[cfg.mi],
    year: cfg.yr,
    expenses,
    paychecks: generatePaychecks(cfg.yr, cfg.mi),
    adjustments: cfg.adjustments ?? [],
    notes: cfg.notes ?? '',
  };
});

export const billCategories = ['Housing', 'Debt', 'Insurance', 'Utilities', 'Health', 'Subscriptions', 'Vehicles', 'Transportation', 'Other'];

export const categoryColors = {
  Housing: '#4F46E5',
  Debt: '#EF4444',
  Insurance: '#F59E0B',
  Utilities: '#10B981',
  Health: '#06B6D4',
  Subscriptions: '#8B5CF6',
  Vehicles: '#F97316',
  Transportation: '#84CC16',
  Other: '#6B7280',
};
