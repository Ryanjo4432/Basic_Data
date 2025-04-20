const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Updated WHERE clause builder with proper filtering
const buildWhereClause = (filters, isSuperAdmin, userId) => {
  const where = [];
  const params = [];

  if (!isSuperAdmin) {
    where.push('user_id = ?');
    params.push(userId);
  }

  if (filters.name) {
    where.push('Name LIKE ?');
    params.push(`%${filters.name}%`);
  }
  
  if (filters.date) {
    where.push('date = ?');
    params.push(filters.date);
  }
  
  if (filters.device) {
    where.push('device LIKE ?');
    params.push(`%${filters.device}%`);
  }

  return where.length > 0 
    ? { query: 'WHERE ' + where.join(' AND '), params }
    : { query: '', params };
};

// GET endpoint with improved filtering
app.get('/data', async (req, res) => {
  const key = req.query.key;
  const { name, date, device } = req.query;

  try {
    // Validate key
    const [keyRows] = await db.query(
      'SELECT user_id, role FROM SecKey WHERE BsicDtaKey = ?',
      [key]
    );
    
    if (keyRows.length === 0) {
      return res.status(403).json({ success: false, error: "Invalid key" });
    }

    const { user_id, role } = keyRows[0];
    const isSuperAdmin = role === 'superadmin';

    // Build dynamic query with proper filtering
    const filters = { 
      name: name?.trim(),
      date: date?.trim(),
      device: device?.trim()
    };
    
    const where = buildWhereClause(filters, isSuperAdmin, user_id);

    const [data] = await db.query(
      `SELECT id, Name, IP, Location, date, device 
       FROM datatst 
       ${where.query}
       ORDER BY date DESC`,
      where.params
    );
    
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});


// GET full details for a single row
app.get('/data/:id', async (req, res) => {
  const key = req.query.key;
  const id = parseInt(req.params.id);

  try {
    // Validate key
    const [keyRows] = await db.query(
      'SELECT user_id, role FROM SecKey WHERE BsicDtaKey = ?',
      [key]
    );
    
    if (keyRows.length === 0) {
      return res.status(403).json({ success: false, error: "Invalid key" });
    }

    const { user_id, role } = keyRows[0];
    const isSuperAdmin = role === 'superadmin';

    // Get full row
    const [rows] = await db.query(
      `SELECT * FROM datatst 
       WHERE id = ? 
       ${!isSuperAdmin ? 'AND user_id = ?' : ''}`,
      [id, ...(!isSuperAdmin ? [user_id] : [])]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// POST endpoint (no key required)
app.post('/data', async (req, res) => {
  const { Name, IP, Location, date, device, Contacts, alldata } = req.body;

  try {
    // Default user_id (you can change this as needed)
    const defaultUserId = 1; // Or set to null if you don't need user association

    const [result] = await db.query(
      `INSERT INTO datatst 
       (user_id, Name, IP, Location, date, device, Contacts, alldata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       Location = VALUES(Location),
       date = VALUES(date),
       device = VALUES(device),
       Contacts = VALUES(Contacts),
       alldata = VALUES(alldata)`,
      [defaultUserId, Name, IP, Location, date, device, Contacts, alldata]
    );

    const action = result.affectedRows === 1 ? 'inserted' : 'updated';
    res.json({
      success: true,
      message: `Data ${action} successfully`,
      action
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Advanced API running on http://localhost:${PORT}`);
});