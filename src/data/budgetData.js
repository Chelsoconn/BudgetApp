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

function getFridays(year, monthIdx) {
  const fridays = [];
  const d = new Date(year, monthIdx, 1);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  while (d.getMonth() === monthIdx) {
    fridays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return fridays;
}

function lastDayOfMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function toStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Reference: Friday April 4, 2025 = cycle position 0
const cycleRef = new Date(2025, 3, 4); // Apr 4 2025 (Friday)

function cyclePos(friday) {
  const diffMs = friday.getTime() - cycleRef.getTime();
  const weeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  return ((weeks % 3) + 3) % 3; // 0=S, 1=B, 2=S
}

function generatePaychecks(year, monthIdx) {
  const paychecks = [];

  // Brandon — every Friday
  const fridays = getFridays(year, monthIdx);
  for (const fri of fridays) {
    const pos = cyclePos(fri);
    const isBig = pos === 1;
    paychecks.push({
      date: toStr(fri),
      amount: isBig ? brandonBig : brandonSmall,
      person: 'Brandon',
      type: isBig ? 'big' : 'small',
    });
  }

  // Chelsea — 15th and last day of month
  const the15th = `${year}-${pad(monthIdx + 1)}-15`;
  const lastDay = `${year}-${pad(monthIdx + 1)}-${pad(lastDayOfMonth(year, monthIdx))}`;
  paychecks.push({ date: the15th, amount: chelseaPaycheck, person: 'Chelsea', type: 'semi-monthly' });
  paychecks.push({ date: lastDay, amount: chelseaPaycheck, person: 'Chelsea', type: 'semi-monthly' });

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

export const initialMonths = monthConfigs.map((cfg, idx) => ({
  id: idx + 1,
  name: monthNames[cfg.mi],
  year: cfg.yr,
  spending: cfg.spending,
  other: cfg.other,
  labels: cfg.otherLabel ? { other: cfg.otherLabel } : {},
  paychecks: generatePaychecks(cfg.yr, cfg.mi),
  adjustments: cfg.adjustments ?? [],
  notes: cfg.notes ?? '',
}));

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
