import express from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Setup Database
const db = new Database('grievances.db', { verbose: console.log });

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS grievances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    constituency TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    photo_data TEXT DEFAULT '',
    photo_name TEXT DEFAULT '',
    status TEXT DEFAULT 'Pending',
    admin_notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const grievanceColumns = db.prepare("PRAGMA table_info(grievances)").all().map(column => column.name);
if (!grievanceColumns.includes('photo_data')) {
  db.exec("ALTER TABLE grievances ADD COLUMN photo_data TEXT DEFAULT ''");
}
if (!grievanceColumns.includes('photo_name')) {
  db.exec("ALTER TABLE grievances ADD COLUMN photo_name TEXT DEFAULT ''");
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  app.set('trust proxy', 1);
}

app.use(session({
  secret: 'tvk-digital-super-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd, // True on Render HTTPS
    sameSite: isProd ? 'none' : 'lax', // Permissive cross-origin session on Vercel/Render
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Admin credentials
const ADMIN_USER = 'admin';
const ADMIN_PASS = '123';

let instagramCache = {
  fetchedAt: 0,
  data: []
};

// Middleware to check if logged in
const requireAuth = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ success: false, message: 'Unauthorized. Please login.' });
  }
};

function buildTrackId(id) {
  return `TVK-GR-2026-${String(id).padStart(4, '0')}`;
}

function parseTrackId(trackId) {
  if (!trackId) return null;

  const normalized = String(trackId).trim().toUpperCase();
  const match = normalized.match(/^TVK-GR-2026-(\d{4,})$/);

  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

// API: Submit Grievance
app.post('/api/grievances', (req, res) => {
  try {
    const { name, phone, constituency, category, description, photoData, photoName } = req.body;
    
    if (!name || !phone || !constituency || !category || !description) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (photoData && !String(photoData).startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: 'Only image uploads are allowed.' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO grievances (name, phone, constituency, category, description, photo_data, photo_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      name,
      phone,
      constituency,
      category,
      description,
      photoData || '',
      photoName || ''
    );
    const id = result.lastInsertRowid;
    
    // Generate an elegant, tracking ID
    const trackId = buildTrackId(id);

    res.status(201).json({
      success: true,
      message: 'Grievance submitted successfully',
      trackId,
      data: { id, name, constituency, category, status: 'Pending' }
    });
  } catch (error) {
    console.error('Error submitting grievance:', error);
    res.status(500).json({ success: false, message: 'Failed to save grievance. Database error.' });
  }
});

// API: Public Track Grievance
app.get('/api/grievances/:trackId', (req, res) => {
  try {
    const grievanceId = parseTrackId(req.params.trackId);

    if (!grievanceId) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid TNX ID like TVK-GR-2026-0001.'
      });
    }

    const grievance = db.prepare(`
      SELECT id, name, constituency, category, status, admin_notes, created_at
      FROM grievances
      WHERE id = ?
    `).get(grievanceId);

    if (!grievance) {
      return res.status(404).json({
        success: false,
        message: 'No grievance was found for this TNX ID.'
      });
    }

    res.json({
      success: true,
      data: {
        trackId: buildTrackId(grievance.id),
        name: grievance.name,
        constituency: grievance.constituency,
        category: grievance.category,
        status: grievance.status,
        adminNotes: grievance.admin_notes,
        createdAt: grievance.created_at
      }
    });
  } catch (error) {
    console.error('Error tracking grievance:', error);
    res.status(500).json({ success: false, message: 'Unable to check grievance status right now.' });
  }
});

// API: Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// API: Admin Logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logout successful' });
  });
});

// API: Admin Check Status
app.get('/api/admin/status', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.json({ success: true, loggedIn: true });
  } else {
    res.json({ success: true, loggedIn: false });
  }
});

// API: Instagram media feed for development page
app.get('/api/instagram/media', async (req, res) => {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const instagramUserId = process.env.INSTAGRAM_USER_ID;

  if (!accessToken || !instagramUserId) {
    return res.json({
      success: false,
      message: 'Instagram API is not configured. Add INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN.',
      data: []
    });
  }

  const cacheAge = Date.now() - instagramCache.fetchedAt;
  if (instagramCache.data.length > 0 && cacheAge < 10 * 60 * 1000) {
    return res.json({ success: true, source: 'cache', data: instagramCache.data });
  }

  try {
    const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp';
    const graphUrl = new URL(`https://graph.facebook.com/v20.0/${instagramUserId}/media`);
    graphUrl.searchParams.set('fields', fields);
    graphUrl.searchParams.set('limit', '8');
    graphUrl.searchParams.set('access_token', accessToken);

    const response = await fetch(graphUrl);
    const result = await response.json();

    if (!response.ok) {
      console.error('Instagram API error:', result);
      return res.status(502).json({
        success: false,
        message: result.error?.message || 'Instagram API request failed.',
        data: []
      });
    }

    const media = (result.data || []).map(item => ({
      id: item.id,
      caption: item.caption || 'Instagram update',
      mediaType: item.media_type,
      mediaUrl: item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url,
      permalink: item.permalink,
      timestamp: item.timestamp
    })).filter(item => item.mediaUrl && item.permalink);

    instagramCache = {
      fetchedAt: Date.now(),
      data: media
    };

    res.json({ success: true, source: 'instagram', data: media });
  } catch (error) {
    console.error('Error fetching Instagram media:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch Instagram media.', data: [] });
  }
});

// API: Fetch All Grievances (Admin only)
app.get('/api/admin/grievances', requireAuth, (req, res) => {
  try {
    const grievances = db.prepare('SELECT * FROM grievances ORDER BY created_at DESC').all();
    res.json({ success: true, data: grievances });
  } catch (error) {
    console.error('Error fetching grievances:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// API: Update Grievance Status & Notes (Admin only)
app.put('/api/admin/grievances/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const updateStmt = db.prepare(`
      UPDATE grievances 
      SET status = ?, admin_notes = ?
      WHERE id = ?
    `);

    const result = updateStmt.run(status, admin_notes || '', id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    res.json({ success: true, message: 'Grievance updated successfully' });
  } catch (error) {
    console.error('Error updating grievance:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// API: Delete Grievance (Admin only)
app.delete('/api/admin/grievances/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const deleteStmt = db.prepare('DELETE FROM grievances WHERE id = ?');
    const result = deleteStmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Grievance not found' });
    }

    res.json({ success: true, message: 'Grievance deleted successfully' });
  } catch (error) {
    console.error('Error deleting grievance:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
