const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const crypto = require('crypto');
const path = require('path');
const { pool, initDb, loaders, savers, pushHistory, undo, redo, getHistoryCounts } = require('./db.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Heroku's reverse proxy so secure cookies work
app.set('trust proxy', 1);

app.use(express.json({ limit: '5mb', strict: false }));
app.use(express.text({ limit: '5mb', type: 'text/plain' }));

// Session middleware — stored in PostgreSQL so sessions survive dyno restarts
app.use(session({
  store: new pgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// Auth endpoints (before auth middleware)
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return res.status(500).json({ error: 'APP_PASSWORD not configured' });
  if (password === appPassword) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Wrong password' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth-check', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// Auth middleware — protect all other /api routes
app.use('/api', (req, res, next) => {
  if (req.session.authenticated) return next();
  res.status(401).json({ error: 'Not authenticated' });
});

// Static files (CSS/JS are fine to serve, the app itself checks auth)
app.use(express.static(path.join(__dirname, 'dist'), {
  etag: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// PUT /api/data/version — no-op now (schema managed by normalized tables)
app.put('/api/data/version', (req, res) => res.json({ ok: true }));

// GET /api/data/:key — load from normalized tables
app.get('/api/data/:key', async (req, res) => {
  const key = req.params.key;
  try {
    if (loaders[key]) {
      const data = await loaders[key]();
      return res.json(data);
    }
    // Fallback to budget_data for playgrounds etc.
    const { rows } = await pool.query('SELECT value FROM budget_data WHERE key = $1', [key]);
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(rows[0].value);
  } catch (err) {
    console.error(`GET /api/data/${key} error:`, err);
    res.status(500).json({ error: 'db error' });
  }
});

// POST /api/snapshot/:key — explicitly save a snapshot before making changes
app.post('/api/snapshot/:key', async (req, res) => {
  try {
    await pushHistory(req.params.key);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Snapshot failed' });
  }
});

// POST /api/snapshot-all — snapshot all budget keys at once (for multi-key changes like salary)
app.post('/api/snapshot-all', async (req, res) => {
  try {
    const keys = ['budget_bills', 'budget_debts', 'budget_months', 'budget_paycheck_config'];
    for (const key of keys) await pushHistory(key);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Snapshot failed' });
  }
});

// PUT or POST /api/data/:key — save to normalized tables (NO auto-history)
const upsertData = async (req, res) => {
  const key = req.params.key;
  try {
    if (savers[key]) {
      await savers[key](req.body);
      return res.json({ ok: true });
    }
    await pool.query(
      `INSERT INTO budget_data (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(`PUT /api/data/${key} error:`, err);
    res.status(500).json({ error: 'db error' });
  }
};
app.put('/api/data/:key', upsertData);
app.post('/api/data/:key', upsertData);

// Undo/Redo endpoints
app.post('/api/undo/:key', async (req, res) => {
  try {
    const snapshot = await undo(req.params.key);
    if (snapshot === null) return res.status(404).json({ error: 'Nothing to undo' });
    res.json({ data: snapshot });
  } catch (err) {
    console.error('Undo error:', err);
    res.status(500).json({ error: 'Undo failed' });
  }
});

app.post('/api/redo/:key', async (req, res) => {
  try {
    const snapshot = await redo(req.params.key);
    if (snapshot === null) return res.status(404).json({ error: 'Nothing to redo' });
    res.json({ data: snapshot });
  } catch (err) {
    console.error('Redo error:', err);
    res.status(500).json({ error: 'Redo failed' });
  }
});

app.get('/api/history/:key', async (req, res) => {
  try {
    const counts = await getHistoryCounts(req.params.key);
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: 'History check failed' });
  }
});

// Summary: total undo/redo across all keys
app.get('/api/history-summary', async (req, res) => {
  try {
    const { rows: [u] } = await pool.query("SELECT COUNT(*) as c FROM history WHERE type = 'undo'");
    const { rows: [r] } = await pool.query("SELECT COUNT(*) as c FROM history WHERE type = 'redo'");
    res.json({ undoCount: parseInt(u.c), redoCount: parseInt(r.c) });
  } catch (err) {
    res.status(500).json({ error: 'History check failed' });
  }
});

// Undo the most recent change — restores all keys snapshotted within 2s of each other
app.post('/api/undo-latest', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, data_key, created_at FROM history WHERE type = 'undo' ORDER BY id DESC LIMIT 1");
    if (rows.length === 0) return res.status(404).json({ error: 'Nothing to undo' });

    const latest = rows[0];
    const cutoff = new Date(new Date(latest.created_at).getTime() - 2000);

    // Find all keys snapshotted around the same time
    const { rows: group } = await pool.query(
      "SELECT DISTINCT data_key FROM history WHERE type = 'undo' AND created_at >= $1 ORDER BY data_key",
      [cutoff]
    );

    const restored = {};
    for (const row of group) {
      const snapshot = await undo(row.data_key);
      if (snapshot !== null) restored[row.data_key] = snapshot;
    }

    if (Object.keys(restored).length === 0) return res.status(404).json({ error: 'Nothing to undo' });
    res.json({ restored });
  } catch (err) {
    console.error('Undo-latest error:', err);
    res.status(500).json({ error: 'Undo failed' });
  }
});

// Redo the most recent undone change — restores all keys
app.post('/api/redo-latest', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, data_key, created_at FROM redo_history ORDER BY id DESC LIMIT 1');
    if (rows.length === 0) return res.status(404).json({ error: 'Nothing to redo' });

    const latest = rows[0];
    const cutoff = new Date(new Date(latest.created_at).getTime() - 2000);

    const { rows: group } = await pool.query(
      'SELECT DISTINCT data_key FROM redo_history WHERE created_at >= $1 ORDER BY data_key',
      [cutoff]
    );

    const restored = {};
    for (const row of group) {
      const snapshot = await redo(row.data_key);
      if (snapshot !== null) restored[row.data_key] = snapshot;
    }

    if (Object.keys(restored).length === 0) return res.status(404).json({ error: 'Nothing to redo' });
    res.json({ restored });
  } catch (err) {
    console.error('Redo-latest error:', err);
    res.status(500).json({ error: 'Redo failed' });
  }
});

// ── Chat with tool-use (MCP-style) ──

// Budget tools the model can call to fetch only the data it needs
const chatTools = [
  {
    type: 'function',
    function: {
      name: 'get_bills',
      description: 'Get all monthly bills with name, amount, and category. Returns total and per-bill breakdown.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_debts',
      description: 'Get all debts grouped by type: vehicles, student loans, credit cards, medical. Includes balances and credit limits.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_paycheck_config',
      description: "Get paycheck configuration: Brandon's small/big pay amounts and Chelsea's semi-monthly pay.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_month',
      description: 'Get detailed budget data for a specific month including income, expenses, bills, adjustments, balances, and computed financials (carryover, final balance). Pass month name and year.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'Month name, e.g. "January"' },
          year: { type: 'integer', description: 'Year, e.g. 2026' },
        },
        required: ['month', 'year'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_monthly_summary',
      description: 'Get a high-level summary of ALL months: income, expenses, final balance, and carryover chain. Use this for trend analysis, projections, or finding specific months.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_business_expenses',
      description: 'Get business expenses: totals by category and full item list with dates.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule',
      description: "Get family schedule info: Brandon's work rotation status, Chelsea's holidays, kids' school days off and early release days (Lake Travis ISD 2025-2027).",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// Tool handlers — each returns a string for the model
async function handleTool(name, args, scenarioData) {
  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  // If scenarioData is provided, use it instead of DB (for playground what-if)
  if (scenarioData) return handleScenarioTool(name, args, scenarioData, fmt);

  if (name === 'get_bills') {
    const bills = await loaders.budget_bills();
    const total = bills.reduce((s, b) => s + b.amount, 0);
    return `Monthly Bills (${fmt(total)}/mo total, ${bills.length} bills):\n` +
      bills.map(b => `  ${b.name}: ${fmt(b.amount)}/mo (${b.category})`).join('\n');
  }

  if (name === 'get_debts') {
    const debts = await loaders.budget_debts();
    const all = Object.values(debts).flat();
    const total = all.reduce((s, d) => s + d.amount, 0);
    const lines = [
      ...debts.vehicles.map(d => `  Vehicle — ${d.name}: ${fmt(d.amount)}`),
      ...debts.studentLoans.map(d => `  Student Loan — ${d.name}: ${fmt(d.amount)}`),
      ...debts.creditCards.map(d => `  Credit Card — ${d.name}: ${fmt(d.amount)}${d.limit ? ` (limit ${fmt(d.limit)})` : ''}`),
      ...debts.medicalDebt.filter(d => d.amount > 0).map(d => `  Medical — ${d.name}: ${fmt(d.amount)}`),
    ];
    return `Debts (${fmt(total)} total):\n${lines.join('\n')}`;
  }

  if (name === 'get_paycheck_config') {
    const pc = await loaders.budget_paycheck_config();
    return `Paycheck Config:\n  Brandon small (weekly): ${fmt(pc.brandonSmall)}\n  Brandon big (every 3rd week): ${fmt(pc.brandonBig)}\n  Chelsea (15th + last day): ${fmt(pc.chelseaPay)}`;
  }

  if (name === 'get_month') {
    const months = await loaders.budget_months();
    const bills = await loaders.budget_bills();
    const idx = months.findIndex(m => m.name === args.month && m.year === args.year);
    if (idx < 0) return `No data found for ${args.month} ${args.year}. Available months: ${months.map(m => `${m.name} ${m.year}`).join(', ')}`;
    const m = months[idx];
    // Compute carryover chain
    let carryover = 0;
    for (let i = 0; i < idx; i++) {
      carryover = computeMonth(months[i], bills, carryover).monthFinal;
    }
    const c = computeMonth(m, bills, carryover);
    const paycheckLines = m.paychecks.map(p => `  ${p.person} (${p.type}): ${fmt(p.amount)}${p.date ? ` on ${p.date}` : ''}`).join('\n');
    const expenseLines = (m.expenses || []).map(e => `  ${e.label}: ${fmt(e.amount)}`).join('\n');
    const adjLines = (m.adjustments || []).map(a => `  ${a.label}: ${fmt(a.amount)}`).join('\n');
    let result = `${m.name} ${m.year}:\n`;
    result += `  Carryover from previous: ${fmt(c.effectiveCarryover)}\n`;
    result += `  Paychecks (${fmt(c.totalIncome)}):\n${paycheckLines}\n`;
    if (c.bankBalance) result += `  Bank balance: ${fmt(c.bankBalance)}\n`;
    if (c.amexBalance) result += `  Amex balance: ${fmt(c.amexBalance)}\n`;
    result += `  Bills: ${fmt(c.activeBillsTotal)}\n`;
    if (expenseLines) result += `  Extra expenses (${fmt(c.extraExpenses)}):\n${expenseLines}\n`;
    if (adjLines) result += `  Adjustments (${fmt(c.adjustments)}):\n${adjLines}\n`;
    result += `  Total available: ${fmt(c.totalAvailable)}\n`;
    result += `  Total expenses: ${fmt(c.effectiveExpenses)}\n`;
    result += `  Month final balance: ${fmt(c.monthFinal)}`;
    if (m.notes) result += `\n  Notes: ${m.notes}`;
    return result;
  }

  if (name === 'get_monthly_summary') {
    const months = await loaders.budget_months();
    const bills = await loaders.budget_bills();
    let carryover = 0;
    const lines = months.map(m => {
      const c = computeMonth(m, bills, carryover);
      const brandonCount = m.paychecks.filter(p => p.person === 'Brandon').length;
      const chelseaCount = m.paychecks.filter(p => p.person === 'Chelsea').length;
      const line = `  ${m.name} ${m.year}: Income ${fmt(c.totalIncome)} (${brandonCount}B+${chelseaCount}C checks), Expenses ${fmt(c.effectiveExpenses)}, Final ${fmt(c.monthFinal)}`;
      carryover = c.monthFinal;
      return line;
    });
    const last = months.length > 0 ? carryover : 0;
    return `Monthly Summary (${months.length} months):\n${lines.join('\n')}\n\n  Ending balance: ${fmt(last)}`;
  }

  if (name === 'get_business_expenses') {
    const biz = await loaders.biz_expenses();
    const items = biz.items || [];
    if (items.length === 0) return 'No business expenses recorded.';
    const total = items.reduce((s, i) => s + i.amount, 0);
    const byCategory = {};
    items.forEach(i => { byCategory[i.category] = (byCategory[i.category] || 0) + i.amount; });
    const catLines = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `  ${cat}: ${fmt(amt)} (${Math.round(amt / total * 100)}%)`).join('\n');
    const itemLines = items.map(i => `  ${i.date || 'no date'} | ${i.description} | ${i.category} | ${fmt(i.amount)}`).join('\n');
    return `Business Expenses (${fmt(total)} total, ${items.length} items):\nBy category:\n${catLines}\nAll items:\n${itemLines}`;
  }

  if (name === 'get_schedule') {
    return getScheduleInfo();
  }

  return `Unknown tool: ${name}`;
}

// Playground what-if: use scenario data instead of DB
function handleScenarioTool(name, args, data, fmt) {
  if (name === 'get_bills') {
    const bills = data.bills || [];
    const total = bills.reduce((s, b) => s + b.amount, 0);
    return `[SCENARIO] Bills (${fmt(total)}/mo):\n` + bills.map(b => `  ${b.name}: ${fmt(b.amount)}/mo (${b.category})`).join('\n');
  }
  if (name === 'get_debts') {
    const debts = data.debts || { vehicles: [], studentLoans: [], creditCards: [], medicalDebt: [] };
    const all = Object.values(debts).flat();
    return `[SCENARIO] Debts (${fmt(all.reduce((s, d) => s + d.amount, 0))} total):\n` +
      all.map(d => `  ${d.name}: ${fmt(d.amount)}`).join('\n');
  }
  if (name === 'get_monthly_summary') {
    const months = data.months || [];
    const bills = data.bills || [];
    let carryover = 0;
    const lines = months.map(m => {
      const c = computeMonth(m, bills, carryover);
      const line = `  ${m.name} ${m.year}: Income ${fmt(c.totalIncome)}, Expenses ${fmt(c.effectiveExpenses)}, Final ${fmt(c.monthFinal)}`;
      carryover = c.monthFinal;
      return line;
    });
    return `[SCENARIO] Monthly Summary:\n${lines.join('\n')}`;
  }
  if (name === 'get_month') {
    const months = data.months || [];
    const bills = data.bills || [];
    const idx = months.findIndex(m => m.name === args.month && m.year === args.year);
    if (idx < 0) return `[SCENARIO] No data for ${args.month} ${args.year}`;
    let carryover = 0;
    for (let i = 0; i < idx; i++) carryover = computeMonth(months[i], bills, carryover).monthFinal;
    const c = computeMonth(months[idx], bills, carryover);
    return `[SCENARIO] ${args.month} ${args.year}: Income ${fmt(c.totalIncome)}, Expenses ${fmt(c.effectiveExpenses)}, Final ${fmt(c.monthFinal)}`;
  }
  if (name === 'get_paycheck_config') return '[SCENARIO] Paycheck config not available in scenario mode.';
  if (name === 'get_business_expenses') return '[SCENARIO] Business expenses not available in scenario mode.';
  if (name === 'get_schedule') return getScheduleInfo();
  return `Unknown tool: ${name}`;
}

// Shared month computation (mirrors computeMonth.js)
function computeMonth(month, bills, carryoverIn) {
  const paidBills = new Set(month.paidBills || []);
  const billOverrides = month.billOverrides || {};
  const billAmount = (bill) => billOverrides[bill.id] ?? bill.amount;
  const activeBillsTotal = bills.filter(b => !paidBills.has(b.id)).reduce((s, b) => s + billAmount(b), 0);
  const totalIncome = month.paychecks.reduce((s, p) => s + p.amount, 0);
  const bankBalance = month.bankBalance ?? 0;
  const amexBalance = month.amexBalance ?? 0;
  const extraExpenses = (month.expenses || []).reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalExpenses = activeBillsTotal + extraExpenses;
  const adjustments = (month.adjustments || []).reduce((s, a) => s + a.amount, 0);
  const effectiveCarryover = month.carryoverOverride ?? carryoverIn;
  const effectiveIncome = month.incomeOverride ?? totalIncome;
  const effectiveExpenses = month.expensesOverride ?? totalExpenses;
  const totalAvailable = effectiveIncome + bankBalance - amexBalance + effectiveCarryover;
  const difference = totalAvailable - effectiveExpenses;
  const monthFinal = difference + adjustments;
  return { totalIncome, bankBalance, amexBalance, activeBillsTotal, extraExpenses, totalExpenses, adjustments, effectiveCarryover, effectiveIncome, effectiveExpenses, totalAvailable, difference, monthFinal };
}

function getScheduleInfo() {
  const ANCHOR = new Date(2026, 2, 26);
  const CYCLE = 21, WORK = 14;
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let diff = Math.floor((todayMid - ANCHOR) / 86400000);
  diff = ((diff % CYCLE) + CYCLE) % CYCLE;
  const brandonStatus = diff < WORK ? 'At Work' : 'Home';
  const daysLeft = diff < WORK ? WORK - diff : CYCLE - diff;

  return `Family Schedule:
  Brandon (dad): 14 days work / 7 days home rotation. Currently: ${brandonStatus} (${daysLeft} days left in stretch). Anchor: Mar 26 2026.
  Chelsea (mom): Off on federal holidays: New Year's, MLK Day, Memorial Day, Independence Day, Labor Day, Thanksgiving, Christmas.
  Maka & Jack (kids, Lake Travis ISD):
    2025-2026 days off: Sep 1 (Labor Day), Oct 10 & 13, Nov 24-28 (Thanksgiving), Dec 22-31 (Winter Break), Jan 1-2 & 5-7, Feb 13 & 16, Mar 16-20 (Spring Break), Mar 23, Apr 3, May 25 (Memorial Day), May 23-Aug 11 (Summer)
    2026-2027 days off: Sep 7 (Labor Day), Sep 21 (Yom Kippur), Oct 9 & 12, Oct 30, Nov 2 & 23-27 (Thanksgiving), Dec 18-31 (Winter Break), Jan 1 & 4-5 & 18 (MLK), Feb 11-12 & 15, Mar 15-19 (Spring Break), Mar 26, Apr 23 & 26, May 31 (Memorial Day), May 28-Jul 31 (Summer)
    Early release: Aug 13 2025, Sep 22, Oct 22, Dec 19, Feb 12, Mar 13, May 15, May 22 (last day 2026), May 27 (last day 2027)`;
}

// POST /api/chat — tool-use loop: model calls tools to fetch budget data on demand
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  const { messages, scenarioData } = req.body;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const systemPrompt = `You are a smart, helpful financial advisor and family assistant for the O'Connor household budget app. Today is ${dateStr}.

You have tools to look up budget data on demand. Use them to answer questions — don't guess at numbers.
${scenarioData ? '\nIMPORTANT: This is a WHAT-IF SCENARIO. Data from tools reflects the scenario, not the real budget. Analyze based on scenario numbers only.' : ''}
Your job:
- Answer questions about their finances, schedule, and family logistics
- Give practical, specific advice with dollar amounts
- Run what-if scenarios when asked
- Be concise but thorough. Reference specific numbers from the data.

Start by calling the tools you need, then answer.`;

  try {
    const cleanMessages = (messages || []).map(m => ({
      role: String(m.role || 'user'),
      content: String(m.content || ''),
    }));

    let apiMessages = [
      { role: 'system', content: systemPrompt },
      ...cleanMessages,
    ];

    // Tool-use loop: let the model call tools until it produces a final response
    const MAX_ROUNDS = 5;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: apiMessages,
          tools: chatTools,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('OpenAI error:', err);
        return res.status(500).json({ error: 'OpenAI API error' });
      }

      const data = await response.json();
      const choice = data.choices[0];
      apiMessages.push(choice.message);

      // If no tool calls, we have the final answer
      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
        return res.json({ reply: choice.message.content });
      }

      // Execute tool calls in parallel
      const toolResults = await Promise.all(
        choice.message.tool_calls.map(async (tc) => {
          const args = JSON.parse(tc.function.arguments || '{}');
          const result = await handleTool(tc.function.name, args, scenarioData || null);
          return { role: 'tool', tool_call_id: tc.id, content: result };
        })
      );
      apiMessages.push(...toolResults);
    }

    // If we exhausted rounds, return whatever we have
    const lastAssistant = apiMessages.filter(m => m.role === 'assistant').pop();
    res.json({ reply: lastAssistant?.content || 'Sorry, I had trouble processing that request.' });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

// SPA fallback (must be last)
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('DB init failed:', err);
    app.listen(PORT, () => console.log(`Server running on port ${PORT} (no DB)`));
  });
