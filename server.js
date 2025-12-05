// server.js
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection (Railway will provide DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
});

// Ensure enquiries table exists
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      source_page TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Enquiries table ready');
}
initDb().catch(err => {
  console.error('DB init error:', err);
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Public API: save enquiry
app.post('/api/enquiry', async (req, res) => {
  const { name, email, phone, message, sourcePage } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }

  try {
    await pool.query(
      `INSERT INTO enquiries (name, email, phone, message, source_page)
       VALUES ($1, $2, $3, $4, $5);`,
      [name, email, phone || '', message, sourcePage || '']
    );

    return res.json({ success: true, message: 'Enquiry submitted successfully.' });
  } catch (err) {
    console.error('Error saving enquiry:', err);
    return res.status(500).json({ error: 'Failed to save enquiry.' });
  }
});

// Admin API: list enquiries (secured by ADMIN_PASSWORD env var)
app.get('/api/admin/enquiries', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD not set on server.' });
  }

  if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, message, source_page, created_at FROM enquiries ORDER BY created_at DESC;'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error fetching enquiries:', err);
    return res.status(500).json({ error: 'Failed to fetch enquiries.' });
  }
});

// Fallback: serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Chataru Craft server running on http://localhost:${PORT}`);
});
