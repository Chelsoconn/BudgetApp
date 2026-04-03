const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false,
});

async function initDb() {
  // Keep old table for migration source + playgrounds
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_data (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Normalized tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      app_id INT NOT NULL,
      name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      category TEXT DEFAULT 'Other',
      sort_order INT DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS debts (
      id SERIAL PRIMARY KEY,
      app_id INT NOT NULL,
      name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      debt_type TEXT NOT NULL,
      credit_limit NUMERIC(12,2)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS months (
      id SERIAL PRIMARY KEY,
      app_id INT NOT NULL,
      name TEXT NOT NULL,
      year INT NOT NULL,
      notes TEXT DEFAULT '',
      bank_balance NUMERIC(12,2),
      amex_balance NUMERIC(12,2),
      carryover_override NUMERIC(12,2),
      income_override NUMERIC(12,2),
      expenses_override NUMERIC(12,2),
      sort_order INT DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS paychecks (
      id SERIAL PRIMARY KEY,
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      pay_date TEXT DEFAULT '',
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      person TEXT DEFAULT 'Brandon',
      pay_type TEXT DEFAULT 'small'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS month_expenses (
      id SERIAL PRIMARY KEY,
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS month_adjustments (
      id SERIAL PRIMARY KEY,
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS month_paid_bills (
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      bill_app_id INT NOT NULL,
      PRIMARY KEY (month_id, bill_app_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS month_bill_overrides (
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      bill_app_id INT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      PRIMARY KEY (month_id, bill_app_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sitter_days (
      date_key TEXT PRIMARY KEY,
      covered BOOLEAN DEFAULT false,
      note TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS biz_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS biz_expenses (
      id SERIAL PRIMARY KEY,
      description TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      category TEXT DEFAULT 'Other',
      expense_date TEXT DEFAULT '',
      app_id BIGINT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS playgrounds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      data JSONB NOT NULL DEFAULT '{}'
    )
  `);

  // Migrate from old JSON blobs if normalized tables are empty
  await migrateIfNeeded();

  // Clean up old budget_data blobs now that everything is normalized
  await pool.query("DELETE FROM budget_data WHERE key NOT IN ('budget_data_version')");
}

async function migrateIfNeeded() {
  const { rows: billCheck } = await pool.query('SELECT COUNT(*) as c FROM bills');
  if (parseInt(billCheck[0].c) > 0) return; // already migrated

  console.log('Migrating from JSON blobs to normalized tables...');

  const { rows } = await pool.query('SELECT key, value FROM budget_data');
  const data = {};
  for (const row of rows) data[row.key] = row.value;

  // Bills
  if (data.budget_bills) {
    for (let i = 0; i < data.budget_bills.length; i++) {
      const b = data.budget_bills[i];
      await pool.query(
        'INSERT INTO bills (app_id, name, amount, category, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [b.id, b.name, b.amount, b.category || 'Other', i]
      );
    }
  }

  // Debts
  if (data.budget_debts) {
    const types = { vehicles: 'vehicle', studentLoans: 'student_loan', creditCards: 'credit_card', medicalDebt: 'medical' };
    for (const [key, type] of Object.entries(types)) {
      for (const d of (data.budget_debts[key] || [])) {
        await pool.query(
          'INSERT INTO debts (app_id, name, amount, debt_type, credit_limit) VALUES ($1, $2, $3, $4, $5)',
          [d.id, d.name, d.amount, type, d.limit || null]
        );
      }
    }
  }

  // Months + nested data
  if (data.budget_months) {
    for (let i = 0; i < data.budget_months.length; i++) {
      const m = data.budget_months[i];
      const { rows: [inserted] } = await pool.query(
        `INSERT INTO months (app_id, name, year, notes, bank_balance, amex_balance, carryover_override, income_override, expenses_override, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [m.id, m.name, m.year, m.notes || '', m.bankBalance ?? null, m.amexBalance ?? null,
         m.carryoverOverride ?? null, m.incomeOverride ?? null, m.expensesOverride ?? null, i]
      );
      const mid = inserted.id;

      for (const p of (m.paychecks || [])) {
        await pool.query(
          'INSERT INTO paychecks (month_id, pay_date, amount, person, pay_type) VALUES ($1, $2, $3, $4, $5)',
          [mid, p.date || '', p.amount, p.person || 'Brandon', p.type || 'small']
        );
      }

      for (const e of (m.expenses || [])) {
        await pool.query(
          'INSERT INTO month_expenses (month_id, label, amount) VALUES ($1, $2, $3)',
          [mid, e.label, e.amount]
        );
      }

      for (const a of (m.adjustments || [])) {
        await pool.query(
          'INSERT INTO month_adjustments (month_id, label, amount) VALUES ($1, $2, $3)',
          [mid, a.label, a.amount]
        );
      }

      for (const billId of (m.paidBills || [])) {
        await pool.query('INSERT INTO month_paid_bills (month_id, bill_app_id) VALUES ($1, $2)', [mid, billId]);
      }

      for (const [billId, amt] of Object.entries(m.billOverrides || {})) {
        await pool.query('INSERT INTO month_bill_overrides (month_id, bill_app_id, amount) VALUES ($1, $2, $3)', [mid, parseInt(billId), amt]);
      }
    }
  }

  // Settings
  if (data.budget_paycheck_config) {
    const pc = data.budget_paycheck_config;
    await pool.query("INSERT INTO settings (key, value) VALUES ('brandon_small', $1) ON CONFLICT DO NOTHING", [String(pc.brandonSmall)]);
    await pool.query("INSERT INTO settings (key, value) VALUES ('brandon_big', $1) ON CONFLICT DO NOTHING", [String(pc.brandonBig)]);
    await pool.query("INSERT INTO settings (key, value) VALUES ('chelsea_pay', $1) ON CONFLICT DO NOTHING", [String(pc.chelseaPay)]);
  }

  if (data.dash_note) {
    const note = typeof data.dash_note === 'string' ? data.dash_note : JSON.stringify(data.dash_note);
    await pool.query("INSERT INTO settings (key, value) VALUES ('dash_note', $1) ON CONFLICT DO NOTHING", [note]);
  }

  // Sitter coverage
  if (data.sitter_coverage) {
    for (const [dateKey, val] of Object.entries(data.sitter_coverage)) {
      const covered = typeof val === 'boolean' ? val : val?.covered ?? false;
      const note = typeof val === 'object' ? (val?.note || '') : '';
      await pool.query(
        'INSERT INTO sitter_days (date_key, covered, note) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [dateKey, covered, note]
      );
    }
  }

  // Business expenses
  if (data.biz_expenses) {
    for (const cat of (data.biz_expenses.categories || [])) {
      await pool.query('INSERT INTO biz_categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [cat]);
    }
    for (const item of (data.biz_expenses.items || [])) {
      await pool.query(
        'INSERT INTO biz_expenses (app_id, description, amount, category, expense_date) VALUES ($1, $2, $3, $4, $5)',
        [item.id, item.description, item.amount, item.category, item.date || '']
      );
    }
  }

  console.log('Migration complete.');
}

// ── Read helpers: assemble normalized data into JSON shapes the frontend expects ──

async function loadBills() {
  const { rows } = await pool.query('SELECT * FROM bills ORDER BY sort_order');
  return rows.map(r => ({ id: r.app_id, name: r.name, amount: Number(r.amount), category: r.category }));
}

async function loadDebts() {
  const { rows } = await pool.query('SELECT * FROM debts ORDER BY id');
  const result = { vehicles: [], studentLoans: [], creditCards: [], medicalDebt: [] };
  const typeMap = { vehicle: 'vehicles', student_loan: 'studentLoans', credit_card: 'creditCards', medical: 'medicalDebt' };
  for (const r of rows) {
    const arr = result[typeMap[r.debt_type]];
    if (arr) arr.push({ id: r.app_id, name: r.name, amount: Number(r.amount), ...(r.credit_limit ? { limit: Number(r.credit_limit) } : {}) });
  }
  return result;
}

async function loadMonths() {
  const { rows: monthRows } = await pool.query('SELECT * FROM months ORDER BY sort_order');
  const result = [];
  for (const m of monthRows) {
    const { rows: paychecks } = await pool.query('SELECT * FROM paychecks WHERE month_id = $1 ORDER BY id', [m.id]);
    const { rows: expenses } = await pool.query('SELECT * FROM month_expenses WHERE month_id = $1 ORDER BY id', [m.id]);
    const { rows: adjustments } = await pool.query('SELECT * FROM month_adjustments WHERE month_id = $1 ORDER BY id', [m.id]);
    const { rows: paidBills } = await pool.query('SELECT bill_app_id FROM month_paid_bills WHERE month_id = $1', [m.id]);
    const { rows: overrides } = await pool.query('SELECT bill_app_id, amount FROM month_bill_overrides WHERE month_id = $1', [m.id]);

    const month = {
      id: m.app_id, name: m.name, year: m.year, notes: m.notes || '',
      paychecks: paychecks.map(p => ({ date: p.pay_date, amount: Number(p.amount), person: p.person, type: p.pay_type })),
      expenses: expenses.map(e => ({ label: e.label, amount: Number(e.amount) })),
      adjustments: adjustments.map(a => ({ label: a.label, amount: Number(a.amount) })),
      paidBills: paidBills.map(p => p.bill_app_id),
      billOverrides: Object.fromEntries(overrides.map(o => [String(o.bill_app_id), Number(o.amount)])),
    };
    if (m.bank_balance !== null) month.bankBalance = Number(m.bank_balance);
    if (m.amex_balance !== null) month.amexBalance = Number(m.amex_balance);
    if (m.carryover_override !== null) month.carryoverOverride = Number(m.carryover_override);
    if (m.income_override !== null) month.incomeOverride = Number(m.income_override);
    if (m.expenses_override !== null) month.expensesOverride = Number(m.expenses_override);
    result.push(month);
  }
  return result;
}

async function loadPaycheckConfig() {
  const { rows } = await pool.query("SELECT key, value FROM settings WHERE key IN ('brandon_small', 'brandon_big', 'chelsea_pay')");
  const map = Object.fromEntries(rows.map(r => [r.key, Number(r.value)]));
  return { brandonSmall: map.brandon_small || 0, brandonBig: map.brandon_big || 0, chelseaPay: map.chelsea_pay || 0 };
}

async function loadDashNote() {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key = 'dash_note'");
  return rows.length > 0 ? rows[0].value : '';
}

async function loadSitterCoverage() {
  const { rows } = await pool.query('SELECT * FROM sitter_days');
  const result = {};
  for (const r of rows) result[r.date_key] = { covered: r.covered, note: r.note || '' };
  return result;
}

async function loadBizExpenses() {
  const { rows: cats } = await pool.query('SELECT name FROM biz_categories ORDER BY id');
  const { rows: items } = await pool.query('SELECT * FROM biz_expenses ORDER BY id');
  return {
    categories: cats.map(c => c.name),
    items: items.map(i => ({ id: i.app_id || i.id, description: i.description, amount: Number(i.amount), category: i.category, date: i.expense_date })),
  };
}

// ── Write helpers: decompose frontend JSON into normalized rows ──

async function saveBills(bills) {
  await pool.query('DELETE FROM bills');
  for (let i = 0; i < bills.length; i++) {
    const b = bills[i];
    await pool.query('INSERT INTO bills (app_id, name, amount, category, sort_order) VALUES ($1, $2, $3, $4, $5)',
      [b.id, b.name, b.amount, b.category || 'Other', i]);
  }
}

async function saveDebts(debts) {
  await pool.query('DELETE FROM debts');
  const types = { vehicles: 'vehicle', studentLoans: 'student_loan', creditCards: 'credit_card', medicalDebt: 'medical' };
  for (const [key, type] of Object.entries(types)) {
    for (const d of (debts[key] || [])) {
      await pool.query('INSERT INTO debts (app_id, name, amount, debt_type, credit_limit) VALUES ($1, $2, $3, $4, $5)',
        [d.id, d.name, d.amount, type, d.limit || null]);
    }
  }
}

async function saveMonths(months) {
  // Get existing month DB IDs by app_id for reference
  const { rows: existing } = await pool.query('SELECT id, app_id FROM months');
  const existingMap = Object.fromEntries(existing.map(r => [r.app_id, r.id]));

  // Delete all and re-insert (simplest for full replacement)
  await pool.query('DELETE FROM months');

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const { rows: [inserted] } = await pool.query(
      `INSERT INTO months (app_id, name, year, notes, bank_balance, amex_balance, carryover_override, income_override, expenses_override, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [m.id, m.name, m.year, m.notes || '', m.bankBalance ?? null, m.amexBalance ?? null,
       m.carryoverOverride ?? null, m.incomeOverride ?? null, m.expensesOverride ?? null, i]
    );
    const mid = inserted.id;

    for (const p of (m.paychecks || [])) {
      await pool.query('INSERT INTO paychecks (month_id, pay_date, amount, person, pay_type) VALUES ($1, $2, $3, $4, $5)',
        [mid, p.date || '', p.amount, p.person || 'Brandon', p.type || 'small']);
    }
    for (const e of (m.expenses || [])) {
      await pool.query('INSERT INTO month_expenses (month_id, label, amount) VALUES ($1, $2, $3)', [mid, e.label, e.amount]);
    }
    for (const a of (m.adjustments || [])) {
      await pool.query('INSERT INTO month_adjustments (month_id, label, amount) VALUES ($1, $2, $3)', [mid, a.label, a.amount]);
    }
    for (const billId of (m.paidBills || [])) {
      await pool.query('INSERT INTO month_paid_bills (month_id, bill_app_id) VALUES ($1, $2)', [mid, billId]);
    }
    for (const [billId, amt] of Object.entries(m.billOverrides || {})) {
      await pool.query('INSERT INTO month_bill_overrides (month_id, bill_app_id, amount) VALUES ($1, $2, $3)', [mid, parseInt(billId), amt]);
    }
  }
}

async function savePaycheckConfig(config) {
  await pool.query("INSERT INTO settings (key, value) VALUES ('brandon_small', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [String(config.brandonSmall)]);
  await pool.query("INSERT INTO settings (key, value) VALUES ('brandon_big', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [String(config.brandonBig)]);
  await pool.query("INSERT INTO settings (key, value) VALUES ('chelsea_pay', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [String(config.chelseaPay)]);
}

async function saveDashNote(note) {
  const val = typeof note === 'string' ? note : JSON.stringify(note);
  await pool.query("INSERT INTO settings (key, value) VALUES ('dash_note', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [val]);
}

async function saveSitterCoverage(coverage) {
  await pool.query('DELETE FROM sitter_days');
  for (const [dateKey, val] of Object.entries(coverage)) {
    const covered = typeof val === 'boolean' ? val : val?.covered ?? false;
    const note = typeof val === 'object' ? (val?.note || '') : '';
    await pool.query('INSERT INTO sitter_days (date_key, covered, note) VALUES ($1, $2, $3)', [dateKey, covered, note]);
  }
}

async function saveBizExpenses(biz) {
  await pool.query('DELETE FROM biz_categories');
  for (const cat of (biz.categories || [])) {
    await pool.query('INSERT INTO biz_categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [cat]);
  }
  await pool.query('DELETE FROM biz_expenses');
  for (const item of (biz.items || [])) {
    await pool.query('INSERT INTO biz_expenses (app_id, description, amount, category, expense_date) VALUES ($1, $2, $3, $4, $5)',
      [item.id, item.description, item.amount, item.category, item.date || '']);
  }
}

async function loadPlaygrounds() {
  const { rows } = await pool.query('SELECT * FROM playgrounds ORDER BY created_at');
  return rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at, ...r.data }));
}

async function savePlaygrounds(playgrounds) {
  await pool.query('DELETE FROM playgrounds');
  for (const pg of (playgrounds || [])) {
    const { id, name, createdAt, ...data } = pg;
    await pool.query(
      'INSERT INTO playgrounds (id, name, created_at, data) VALUES ($1, $2, $3, $4)',
      [id, name, createdAt || new Date().toISOString(), data]
    );
  }
}

// Key-to-loader/saver mapping
const loaders = {
  budget_bills: loadBills,
  budget_debts: loadDebts,
  budget_months: loadMonths,
  budget_paycheck_config: loadPaycheckConfig,
  dash_note: loadDashNote,
  sitter_coverage: loadSitterCoverage,
  biz_expenses: loadBizExpenses,
  budget_playgrounds: loadPlaygrounds,
};

const savers = {
  budget_bills: saveBills,
  budget_debts: saveDebts,
  budget_months: saveMonths,
  budget_paycheck_config: savePaycheckConfig,
  dash_note: saveDashNote,
  sitter_coverage: saveSitterCoverage,
  biz_expenses: saveBizExpenses,
  budget_playgrounds: savePlaygrounds,
};

module.exports = { pool, initDb, loaders, savers };
