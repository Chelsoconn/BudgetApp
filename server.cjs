const express = require('express');
const path = require('path');
const { pool, initDb } = require('./db.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'dist'), {
  etag: false,
  setHeaders: (res, filePath) => {
    // HTML should never be cached (it references hashed JS/CSS)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// GET /api/data — bulk load all keys
app.get('/api/data', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM budget_data');
    const result = {};
    for (const row of rows) result[row.key] = row.value;
    res.json(result);
  } catch (err) {
    console.error('GET /api/data error:', err);
    res.status(500).json({ error: 'db error' });
  }
});

// PUT /api/data/version — must be BEFORE :key route
// Client detected a schema version change — clear stale default keys, keep user data
app.put('/api/data/version', async (req, res) => {
  try {
    const { version } = req.body;
    const { rows } = await pool.query("SELECT value FROM budget_data WHERE key = 'budget_data_version'");
    const dbVersion = rows.length > 0 ? rows[0].value : null;

    if (dbVersion !== version) {
      // Clear stale default data — playgrounds are user-created so keep them
      await pool.query(
        "DELETE FROM budget_data WHERE key IN ('budget_bills', 'budget_debts', 'budget_months', 'budget_paycheck_config')"
      );
      await pool.query(
        `INSERT INTO budget_data (key, value, updated_at) VALUES ('budget_data_version', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify(version)]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/data/version error:', err);
    res.status(500).json({ error: 'db error' });
  }
});

// GET /api/data/:key
app.get('/api/data/:key', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT value FROM budget_data WHERE key = $1', [req.params.key]);
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(rows[0].value);
  } catch (err) {
    console.error('GET /api/data/:key error:', err);
    res.status(500).json({ error: 'db error' });
  }
});

// PUT /api/data/:key — upsert
app.put('/api/data/:key', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO budget_data (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [req.params.key, JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/data/:key error:', err);
    res.status(500).json({ error: 'db error' });
  }
});

// POST /api/chat — OpenAI chat with budget context
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  const { messages, budgetContext } = req.body;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const systemPrompt = `You are a smart, helpful financial advisor and family assistant for the O'Connor household budget app. Today is ${dateStr}. You have full context of their budget, debts, income, and family schedule below.

Your job:
- Answer questions about their finances, schedule, and family logistics
- Give practical, specific advice with dollar amounts
- Run what-if scenarios when asked
- Know who's home/working on any given date using Brandon's rotation and Chelsea's holidays
- Know when the kids (Maka & Jack) have school off, early release, or summer break
- Be concise but thorough. Reference specific numbers from the data.

BUDGET & SCHEDULE DATA:
${budgetContext}`;

  try {
    const cleanMessages = (messages || []).map(m => ({
      role: String(m.role || 'user'),
      content: String(m.content || ''),
    }));

    const payload = JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...cleanMessages,
      ],
      max_tokens: 2000,
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: payload,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', err);
      return res.status(500).json({ error: 'OpenAI API error' });
    }

    const data = await response.json();
    res.json({ reply: data.choices[0].message.content });
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
