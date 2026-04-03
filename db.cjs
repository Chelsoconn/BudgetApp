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
    CREATE TABLE IF NOT EXISTS paycheck_templates (
      id SERIAL PRIMARY KEY,
      person TEXT NOT NULL,
      pay_type TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      UNIQUE (person, pay_type)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS paychecks (
      id SERIAL PRIMARY KEY,
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      template_id INT NOT NULL REFERENCES paycheck_templates(id),
      pay_date TEXT DEFAULT '',
      amount NUMERIC(12,2) NOT NULL DEFAULT 0
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
      id SERIAL PRIMARY KEY,
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      bill_app_id INT NOT NULL,
      UNIQUE (month_id, bill_app_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS month_bill_overrides (
      id SERIAL PRIMARY KEY,
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      bill_app_id INT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      UNIQUE (month_id, bill_app_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sitter_days (
      id SERIAL PRIMARY KEY,
      date_key TEXT NOT NULL UNIQUE,
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
    CREATE TABLE IF NOT EXISTS change_history (
      id SERIAL PRIMARY KEY,
      data_key TEXT NOT NULL,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Index for fast lookups by key
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_change_history_key ON change_history(data_key, id DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS redo_history (
      id SERIAL PRIMARY KEY,
      data_key TEXT NOT NULL,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
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

  // Migrate schema from old composite-PK tables to new SERIAL-PK tables
  await migrateToSerialPKs();

  // Migrate from old JSON blobs if normalized tables are empty
  await migrateIfNeeded();

  // Migrate paycheck config from settings to paycheck_templates if needed
  const { rows: tmplCheck } = await pool.query('SELECT COUNT(*) as c FROM paycheck_templates');
  if (parseInt(tmplCheck[0].c) === 0) {
    const { rows: settingsRows } = await pool.query("SELECT key, value FROM settings WHERE key IN ('brandon_small', 'brandon_big', 'chelsea_pay')");
    const sMap = Object.fromEntries(settingsRows.map(r => [r.key, Number(r.value)]));
    if (sMap.brandon_small) await pool.query("INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ('Brandon', 'small', $1) ON CONFLICT DO NOTHING", [sMap.brandon_small]);
    if (sMap.brandon_big) await pool.query("INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ('Brandon', 'big', $1) ON CONFLICT DO NOTHING", [sMap.brandon_big]);
    if (sMap.chelsea_pay) await pool.query("INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ('Chelsea', 'regular', $1) ON CONFLICT DO NOTHING", [sMap.chelsea_pay]);
    await pool.query("DELETE FROM settings WHERE key IN ('brandon_small', 'brandon_big', 'chelsea_pay')");
    console.log('Migrated paycheck config to paycheck_templates table.');
  }

  // Clean up old budget_data blobs now that everything is normalized
  await pool.query("DELETE FROM budget_data WHERE key NOT IN ('budget_data_version')");
}

/**
 * Migrate from old composite-PK schema to new SERIAL-PK schema.
 * Detects old tables by checking if paycheck_templates has no 'id' column,
 * or if paychecks still has person/pay_type columns instead of template_id.
 */
async function migrateToSerialPKs() {
  // Check if paycheck_templates already has an 'id' column
  const { rows: ptCols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'paycheck_templates' AND column_name = 'id'
  `);
  if (ptCols.length > 0) return; // Already migrated to new schema

  console.log('Migrating tables to SERIAL primary keys...');

  // --- paycheck_templates: add id, change PK ---
  // Save existing data
  const { rows: oldTemplates } = await pool.query('SELECT person, pay_type, amount FROM paycheck_templates');

  // Drop paychecks FK first (it references old composite PK)
  try { await pool.query('ALTER TABLE paychecks DROP CONSTRAINT IF EXISTS fk_paycheck_template'); } catch(e) {}
  try { await pool.query('ALTER TABLE paychecks DROP CONSTRAINT IF EXISTS paychecks_person_pay_type_fkey'); } catch(e) {}

  // Save old paychecks data
  const { rows: oldPaychecks } = await pool.query('SELECT id, month_id, pay_date, amount, person, pay_type FROM paychecks');

  // Recreate paycheck_templates
  await pool.query('DROP TABLE IF EXISTS paycheck_templates CASCADE');
  await pool.query(`
    CREATE TABLE paycheck_templates (
      id SERIAL PRIMARY KEY,
      person TEXT NOT NULL,
      pay_type TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      UNIQUE (person, pay_type)
    )
  `);
  for (const t of oldTemplates) {
    await pool.query('INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ($1, $2, $3)', [t.person, t.pay_type, t.amount]);
  }

  // Build lookup map person+pay_type -> template id
  const { rows: newTemplates } = await pool.query('SELECT id, person, pay_type FROM paycheck_templates');
  const tmplMap = {};
  for (const t of newTemplates) tmplMap[`${t.person}_${t.pay_type}`] = t.id;

  // Recreate paychecks with template_id FK
  await pool.query('DROP TABLE IF EXISTS paychecks CASCADE');
  await pool.query(`
    CREATE TABLE paychecks (
      id SERIAL PRIMARY KEY,
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      template_id INT NOT NULL REFERENCES paycheck_templates(id),
      pay_date TEXT DEFAULT '',
      amount NUMERIC(12,2) NOT NULL DEFAULT 0
    )
  `);
  for (const p of oldPaychecks) {
    const tId = tmplMap[`${p.person}_${p.pay_type}`];
    if (tId) {
      await pool.query('INSERT INTO paychecks (month_id, template_id, pay_date, amount) VALUES ($1, $2, $3, $4)',
        [p.month_id, tId, p.pay_date, p.amount]);
    }
  }

  // --- sitter_days: add id, change PK ---
  const { rows: oldSitter } = await pool.query('SELECT date_key, covered, note FROM sitter_days');
  await pool.query('DROP TABLE IF EXISTS sitter_days CASCADE');
  await pool.query(`
    CREATE TABLE sitter_days (
      id SERIAL PRIMARY KEY,
      date_key TEXT NOT NULL UNIQUE,
      covered BOOLEAN DEFAULT false,
      note TEXT DEFAULT ''
    )
  `);
  for (const s of oldSitter) {
    await pool.query('INSERT INTO sitter_days (date_key, covered, note) VALUES ($1, $2, $3)', [s.date_key, s.covered, s.note]);
  }

  // --- settings: add id, change PK ---
  const { rows: oldSettings } = await pool.query('SELECT key, value FROM settings');
  await pool.query('DROP TABLE IF EXISTS settings CASCADE');
  await pool.query(`
    CREATE TABLE settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL
    )
  `);
  for (const s of oldSettings) {
    await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [s.key, s.value]);
  }

  // --- month_paid_bills: add id, change PK ---
  const { rows: oldPaidBills } = await pool.query('SELECT month_id, bill_app_id FROM month_paid_bills');
  await pool.query('DROP TABLE IF EXISTS month_paid_bills CASCADE');
  await pool.query(`
    CREATE TABLE month_paid_bills (
      id SERIAL PRIMARY KEY,
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      bill_app_id INT NOT NULL,
      UNIQUE (month_id, bill_app_id)
    )
  `);
  for (const r of oldPaidBills) {
    await pool.query('INSERT INTO month_paid_bills (month_id, bill_app_id) VALUES ($1, $2)', [r.month_id, r.bill_app_id]);
  }

  // --- month_bill_overrides: add id, change PK ---
  const { rows: oldOverrides } = await pool.query('SELECT month_id, bill_app_id, amount FROM month_bill_overrides');
  await pool.query('DROP TABLE IF EXISTS month_bill_overrides CASCADE');
  await pool.query(`
    CREATE TABLE month_bill_overrides (
      id SERIAL PRIMARY KEY,
      month_id INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      bill_app_id INT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      UNIQUE (month_id, bill_app_id)
    )
  `);
  for (const r of oldOverrides) {
    await pool.query('INSERT INTO month_bill_overrides (month_id, bill_app_id, amount) VALUES ($1, $2, $3)', [r.month_id, r.bill_app_id, r.amount]);
  }

  console.log('SERIAL PK migration complete.');
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

  // Paycheck templates MUST be populated before months/paychecks for FK refs
  if (data.budget_paycheck_config) {
    const pc = data.budget_paycheck_config;
    await pool.query("INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ('Brandon', 'small', $1) ON CONFLICT DO NOTHING", [pc.brandonSmall]);
    await pool.query("INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ('Brandon', 'big', $1) ON CONFLICT DO NOTHING", [pc.brandonBig]);
    await pool.query("INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ('Chelsea', 'regular', $1) ON CONFLICT DO NOTHING", [pc.chelseaPay]);
  }

  // Build template lookup for paycheck insertion
  const { rows: tmplRows } = await pool.query('SELECT id, person, pay_type FROM paycheck_templates');
  const tmplMap = {};
  for (const t of tmplRows) tmplMap[`${t.person}_${t.pay_type}`] = t.id;

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
        const person = p.person || 'Brandon';
        let payType = p.type || 'small';
        if (person === 'Chelsea') payType = 'regular';
        if (payType === 'semi-monthly') payType = 'regular';
        const tId = await getOrCreateTemplate(person, payType, tmplMap);
        await pool.query(
          'INSERT INTO paychecks (month_id, template_id, pay_date, amount) VALUES ($1, $2, $3, $4)',
          [mid, tId, p.date || '', p.amount]
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

  // Build template lookup: template_id -> {person, pay_type}
  const { rows: tmplRows } = await pool.query('SELECT id, person, pay_type FROM paycheck_templates');
  const tmplMap = {};
  for (const t of tmplRows) tmplMap[t.id] = { person: t.person, payType: t.pay_type };

  const result = [];
  for (const m of monthRows) {
    const { rows: paychecks } = await pool.query('SELECT * FROM paychecks WHERE month_id = $1 ORDER BY id', [m.id]);
    const { rows: expenses } = await pool.query('SELECT * FROM month_expenses WHERE month_id = $1 ORDER BY id', [m.id]);
    const { rows: adjustments } = await pool.query('SELECT * FROM month_adjustments WHERE month_id = $1 ORDER BY id', [m.id]);
    const { rows: paidBills } = await pool.query('SELECT bill_app_id FROM month_paid_bills WHERE month_id = $1', [m.id]);
    const { rows: overrides } = await pool.query('SELECT bill_app_id, amount FROM month_bill_overrides WHERE month_id = $1', [m.id]);

    const month = {
      id: m.app_id, name: m.name, year: m.year, notes: m.notes || '',
      paychecks: paychecks.map(p => {
        const tmpl = tmplMap[p.template_id] || { person: 'Brandon', payType: 'small' };
        return { date: p.pay_date, amount: Number(p.amount), person: tmpl.person, type: tmpl.payType };
      }),
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
  const { rows } = await pool.query('SELECT person, pay_type, amount FROM paycheck_templates');
  const map = {};
  for (const r of rows) map[`${r.person}_${r.pay_type}`] = Number(r.amount);
  return {
    brandonSmall: map['Brandon_small'] || 0,
    brandonBig: map['Brandon_big'] || 0,
    chelseaPay: map['Chelsea_regular'] || 0,
  };
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

async function getOrCreateTemplate(person, payType, tmplMap) {
  const key = `${person}_${payType}`;
  if (tmplMap[key]) return tmplMap[key];
  // Auto-create missing template
  const { rows: [row] } = await pool.query(
    'INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ($1, $2, 0) ON CONFLICT (person, pay_type) DO UPDATE SET person=$1 RETURNING id',
    [person, payType]
  );
  tmplMap[key] = row.id;
  return row.id;
}

async function saveMonths(months) {
  // Build template lookup: person+pay_type -> template_id
  const { rows: tmplRows } = await pool.query('SELECT id, person, pay_type FROM paycheck_templates');
  const tmplMap = {};
  for (const t of tmplRows) tmplMap[`${t.person}_${t.pay_type}`] = t.id;

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
      const person = p.person || 'Brandon';
      let payType = p.type || 'small';
      if (person === 'Chelsea') payType = 'regular';
      if (payType === 'semi-monthly') payType = 'regular';
      const tId = await getOrCreateTemplate(person, payType, tmplMap);
      await pool.query('INSERT INTO paychecks (month_id, template_id, pay_date, amount) VALUES ($1, $2, $3, $4)',
        [mid, tId, p.date || '', p.amount]);
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
  await pool.query("INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ('Brandon', 'small', $1) ON CONFLICT (person, pay_type) DO UPDATE SET amount = $1", [config.brandonSmall]);
  await pool.query("INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ('Brandon', 'big', $1) ON CONFLICT (person, pay_type) DO UPDATE SET amount = $1", [config.brandonBig]);
  await pool.query("INSERT INTO paycheck_templates (person, pay_type, amount) VALUES ('Chelsea', 'regular', $1) ON CONFLICT (person, pay_type) DO UPDATE SET amount = $1", [config.chelseaPay]);
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

// ── History helpers ──

// Keys that should skip the next pushHistory call (set after undo/redo)
const skipHistoryKeys = new Set();

async function pushHistory(dataKey) {
  if (skipHistoryKeys.has(dataKey)) {
    skipHistoryKeys.delete(dataKey);
    return;
  }
  const loader = loaders[dataKey];
  if (!loader) return;
  try {
    const current = await loader();
    const currentJson = JSON.stringify(current);

    // Don't push if identical to the most recent snapshot
    const { rows: last } = await pool.query(
      'SELECT snapshot FROM change_history WHERE data_key = $1 ORDER BY id DESC LIMIT 1',
      [dataKey]
    );
    if (last.length > 0 && JSON.stringify(last[0].snapshot) === currentJson) return;

    await pool.query(
      'INSERT INTO change_history (data_key, snapshot) VALUES ($1, $2)',
      [dataKey, currentJson]
    );
    // Keep only last 20
    await pool.query(`
      DELETE FROM change_history WHERE id NOT IN (
        SELECT id FROM change_history WHERE data_key = $1 ORDER BY id DESC LIMIT 20
      ) AND data_key = $1
    `, [dataKey]);
    // Clear redo stack when new change is made
    await pool.query('DELETE FROM redo_history WHERE data_key = $1', [dataKey]);
  } catch (e) {
    console.error('pushHistory error:', e.message);
  }
}

async function undo(dataKey) {
  // Pop last snapshot from history, push current to redo, restore snapshot
  const loader = loaders[dataKey];
  const saver = savers[dataKey];
  if (!loader || !saver) return null;

  const { rows } = await pool.query(
    'SELECT id, snapshot FROM change_history WHERE data_key = $1 ORDER BY id DESC LIMIT 1',
    [dataKey]
  );
  if (rows.length === 0) return null;

  // Save current to redo
  const current = await loader();
  await pool.query(
    'INSERT INTO redo_history (data_key, snapshot) VALUES ($1, $2)',
    [dataKey, JSON.stringify(current)]
  );
  // Keep only last 20 redo
  await pool.query(`
    DELETE FROM redo_history WHERE id NOT IN (
      SELECT id FROM redo_history WHERE data_key = $1 ORDER BY id DESC LIMIT 20
    ) AND data_key = $1
  `, [dataKey]);

  // Restore the snapshot
  const snapshot = rows[0].snapshot;
  await saver(snapshot);

  // Remove used history entry
  await pool.query('DELETE FROM change_history WHERE id = $1', [rows[0].id]);

  // Skip next pushHistory for this key (the frontend will re-save the restored data)
  skipHistoryKeys.add(dataKey);
  // Auto-clear after 5 seconds in case the save never comes
  setTimeout(() => skipHistoryKeys.delete(dataKey), 5000);

  return snapshot;
}

async function redo(dataKey) {
  const loader = loaders[dataKey];
  const saver = savers[dataKey];
  if (!loader || !saver) return null;

  const { rows } = await pool.query(
    'SELECT id, snapshot FROM redo_history WHERE data_key = $1 ORDER BY id DESC LIMIT 1',
    [dataKey]
  );
  if (rows.length === 0) return null;

  // Save current to history
  const current = await loader();
  await pool.query(
    'INSERT INTO change_history (data_key, snapshot) VALUES ($1, $2)',
    [dataKey, JSON.stringify(current)]
  );

  // Restore redo snapshot
  const snapshot = rows[0].snapshot;
  await saver(snapshot);

  // Remove used redo entry
  await pool.query('DELETE FROM redo_history WHERE id = $1', [rows[0].id]);

  // Skip next pushHistory for this key
  skipHistoryKeys.add(dataKey);
  setTimeout(() => skipHistoryKeys.delete(dataKey), 5000);

  return snapshot;
}

async function getHistoryCounts(dataKey) {
  const { rows: [h] } = await pool.query('SELECT COUNT(*) as c FROM change_history WHERE data_key = $1', [dataKey]);
  const { rows: [r] } = await pool.query('SELECT COUNT(*) as c FROM redo_history WHERE data_key = $1', [dataKey]);
  return { undoCount: parseInt(h.c), redoCount: parseInt(r.c) };
}

module.exports = { pool, initDb, loaders, savers, pushHistory, undo, redo, getHistoryCounts };
