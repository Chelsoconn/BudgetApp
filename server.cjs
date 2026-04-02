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

  const systemPrompt = `You are a helpful financial advisor assistant for a household budget app. You have full context of the user's budget data below. Answer questions, give advice, run scenarios, and help them understand their finances. Be concise and practical. Use dollar amounts when relevant.

BUDGET DATA:
${budgetContext}`;

  try {
    // Validate that messages are well-formed
    const cleanMessages = (messages || []).map(m => ({
      role: String(m.role || 'user'),
      content: String(m.content || ''),
    }));

    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1000,
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
