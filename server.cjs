const express = require('express');
const path = require('path');
const { pool, initDb } = require('./db.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

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
