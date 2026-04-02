// Initial data extracted from BudgetHouse.xlsx

export const initialBills = [
  { id: 1, name: 'Mortgage', amount: 6248, category: 'Housing' },
  { id: 2, name: 'CC', amount: 500, category: 'Debt' },
  { id: 3, name: 'Health Insurance', amount: 534, category: 'Insurance' },
  { id: 4, name: 'Car Insurance', amount: 342, category: 'Insurance' },
  { id: 5, name: 'RV Parking', amount: 360, category: 'Housing' },
  { id: 6, name: 'Starlink', amount: 165, category: 'Utilities' },
  { id: 7, name: 'Electricity', amount: 200, category: 'Utilities' },
  { id: 8, name: 'Crunch', amount: 100, category: 'Health' },
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

// Paycheck amounts (Brandon's)
export const paycheckAmounts = {
  regular: 2296.75,   // P32 equivalent
  large: 7988.11,     // P39 equivalent (includes extra)
  chelseaMonthly: 7730,
};

export const initialMonths = [
  {
    id: 1,
    name: 'April',
    year: 2025,
    spending: 1700,
    hsa: 1700,
    childcare: 470,
    extraItems: [],
    notes: '',
    savings: 0,
    paychecks: [
      { date: '2025-04-03', amount: 2481 },
      { date: '2025-04-10', amount: 7988.11 },
      { date: '2025-04-17', amount: 2296.75 },
      { date: '2025-04-24', amount: 6181.75 },
    ],
    adjustments: [
      { label: 'Pay back David', amount: -5000 },
    ],
  },
  {
    id: 2,
    name: 'May',
    year: 2025,
    spending: 2150,
    hsa: 300,
    hair: 375,
    childcare: 475,
    extraItems: [],
    notes: '',
    savings: 0,
    paychecks: [
      { date: '2025-05-01', amount: 2296.75 },
      { date: '2025-05-08', amount: 2296.75 },
      { date: '2025-05-15', amount: 6181.75 },
      { date: '2025-05-22', amount: 2296.75 },
      { date: '2025-05-29', amount: 6181.75 },
    ],
    adjustments: [
      { label: 'Pay back Tami', amount: -5000 },
    ],
  },
  {
    id: 3,
    name: 'June',
    year: 2025,
    spending: 2150,
    hsa: 300,
    extraItems: [],
    notes: '',
    savings: 0,
    paychecks: [
      { date: '2025-06-05', amount: 2296.75 },
      { date: '2025-06-12', amount: 7988.11 },
      { date: '2025-06-19', amount: 2296.75 },
      { date: '2025-06-26', amount: 2296.75 },
    ],
    adjustments: [
      { label: 'Brinkley refund', amount: 3030 },
    ],
  },
  {
    id: 4,
    name: 'July',
    year: 2025,
    spending: 2150,
    hsa: 300,
    extraItems: [],
    notes: '',
    savings: 0,
    paychecks: [
      { date: '2025-07-03', amount: 7988.11 },
      { date: '2025-07-10', amount: 2296.75 },
      { date: '2025-07-17', amount: 2296.75 },
      { date: '2025-07-24', amount: 7988.11 },
      { date: '2025-07-31', amount: 2296.75 },
    ],
    adjustments: [
      { label: 'Last Chris Payment', amount: 3330 },
      { label: 'Pay back Kelly', amount: -5000 },
    ],
  },
  {
    id: 5,
    name: 'August',
    year: 2025,
    spending: 2150,
    hsa: 300,
    hair: 375,
    extraItems: [],
    notes: '',
    savings: 0,
    paychecks: [
      { date: '2025-08-07', amount: 2296.75 },
      { date: '2025-08-14', amount: 7988.11 },
      { date: '2025-08-21', amount: 2296.75 },
      { date: '2025-08-28', amount: 2296.75 },
    ],
    adjustments: [
      { label: 'Extra income', amount: 7230 },
      { label: 'Pay back Kelly', amount: -5000 },
    ],
  },
  {
    id: 6,
    name: 'September',
    year: 2025,
    spending: 2150,
    hsa: 0,
    extraItems: [],
    notes: 'TOOK OUT 30k here so MAKE SURE ITS PAID BACK',
    savings: 0,
    paychecks: [
      { date: '2025-09-04', amount: 7988.11 },
      { date: '2025-09-11', amount: 2296.75 },
      { date: '2025-09-18', amount: 2296.75 },
      { date: '2025-09-25', amount: 7988.11 },
    ],
    adjustments: [
      { label: 'Savings withdrawal', amount: -5000 },
    ],
  },
];

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
