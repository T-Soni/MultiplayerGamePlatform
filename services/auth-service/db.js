const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { createLogger } = require('../shared/logger');

const logger = createLogger('AuthService:DB');
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'auth.sqlite');

let db = null;
let useFallback = false;
const inMemoryUsers = new Map();

try {
  const { DatabaseSync } = require('node:sqlite');
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  logger.info(`Connected to SQLite at ${DB_FILE}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'player',
      credits INTEGER DEFAULT 100,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (err) {
  logger.warn(`node:sqlite unavailable (${err.message}). Using robust in-memory/file fallback.`);
  useFallback = true;
  // Load existing file if present
  const jsonPath = DB_FILE.replace(/\.sqlite$/, '.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      data.forEach(u => inMemoryUsers.set(u.id, u));
    } catch (_) {}
  }
}

function persistFallback() {
  if (!useFallback) return;
  const jsonPath = DB_FILE.replace(/\.sqlite$/, '.json');
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(Array.from(inMemoryUsers.values()), null, 2));
  } catch (err) {
    logger.error('Failed to persist JSON fallback users:', err.message);
  }
}

// Seed default admin user if not exists
async function seedDefaultUsers() {
  const adminUser = await getUserByUsername('admin');
  if (!adminUser) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    await createUser('usr-admin-01', 'admin', hash, 'admin', 500);
    logger.info('Seeded default administrator: admin / admin123');
  }

  // Seed two demo players
  const player1 = await getUserByUsername('player1');
  if (!player1) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    await createUser('usr-p1', 'player1', hash, 'player', 100);
    logger.info('Seeded demo player: player1 / password123');
  }

  const player2 = await getUserByUsername('player2');
  if (!player2) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    await createUser('usr-p2', 'player2', hash, 'player', 100);
    logger.info('Seeded demo player: player2 / password123');
  }
}

async function createUser(id, username, passwordHash, role = 'player', initialCredits = 100) {
  if (!useFallback && db) {
    const stmt = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, credits, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, username, passwordHash, role, initialCredits, new Date().toISOString());
  } else {
    const user = {
      id,
      username,
      password_hash: passwordHash,
      role,
      credits: initialCredits,
      created_at: new Date().toISOString()
    };
    inMemoryUsers.set(id, user);
    persistFallback();
  }
  return getUserById(id);
}

async function getUserByUsername(username) {
  if (!useFallback && db) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) || null;
  } else {
    for (const u of inMemoryUsers.values()) {
      if (u.username.toLowerCase() === username.toLowerCase()) return u;
    }
    return null;
  }
}

async function getUserById(id) {
  if (!useFallback && db) {
    const stmt = db.prepare('SELECT id, username, role, credits, created_at FROM users WHERE id = ?');
    return stmt.get(id) || null;
  } else {
    const u = inMemoryUsers.get(id);
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      credits: u.credits,
      created_at: u.created_at
    };
  }
}

async function getAllUsers() {
  if (!useFallback && db) {
    const stmt = db.prepare('SELECT id, username, role, credits, created_at FROM users ORDER BY credits DESC');
    return stmt.all();
  } else {
    return Array.from(inMemoryUsers.values())
      .map(u => ({ id: u.id, username: u.username, role: u.role, credits: u.credits, created_at: u.created_at }))
      .sort((a, b) => b.credits - a.credits);
  }
}

async function updateUserCredits(id, delta) {
  if (!useFallback && db) {
    const stmt = db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?');
    stmt.run(delta, id);
  } else {
    const u = inMemoryUsers.get(id);
    if (u) {
      u.credits = (u.credits || 0) + delta;
      persistFallback();
    }
  }
  return getUserById(id);
}

module.exports = {
  seedDefaultUsers,
  createUser,
  getUserByUsername,
  getUserById,
  getAllUsers,
  updateUserCredits
};
