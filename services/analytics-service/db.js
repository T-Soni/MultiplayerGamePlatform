const path = require('path');
const fs = require('fs');
const { createLogger } = require('../shared/logger');

const logger = createLogger('AnalyticsService:DB');
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'analytics.sqlite');

let db = null;
let useFallback = false;
const inMemoryMatches = [];

try {
  const { DatabaseSync } = require('node:sqlite');
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  logger.info(`Analytics connected to SQLite at ${DB_FILE}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      player_x_id TEXT NOT NULL,
      player_x_username TEXT NOT NULL,
      player_o_id TEXT NOT NULL,
      player_o_username TEXT NOT NULL,
      winner_id TEXT,
      loser_id TEXT,
      is_draw INTEGER DEFAULT 0,
      reason TEXT NOT NULL,
      move_count INTEGER DEFAULT 0,
      grid_size INTEGER DEFAULT 3,
      win_condition INTEGER DEFAULT 3,
      duration_seconds INTEGER DEFAULT 0,
      credits_awarded_x INTEGER DEFAULT 0,
      credits_awarded_o INTEGER DEFAULT 0,
      ended_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
} catch (err) {
  logger.warn(`node:sqlite unavailable (${err.message}). Using JSON fallback for analytics.`);
  useFallback = true;
  const jsonPath = DB_FILE.replace(/\.sqlite$/, '.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(data)) inMemoryMatches.push(...data);
    } catch (_) {}
  }
}

function persistFallback() {
  if (!useFallback) return;
  const jsonPath = DB_FILE.replace(/\.sqlite$/, '.json');
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(inMemoryMatches, null, 2));
  } catch (err) {
    logger.error('Failed to persist JSON fallback matches:', err.message);
  }
}

function recordMatch(record) {
  if (!useFallback && db) {
    const stmt = db.prepare(`
      INSERT INTO matches (
        id, match_id, player_x_id, player_x_username, player_o_id, player_o_username,
        winner_id, loser_id, is_draw, reason, move_count, grid_size, win_condition,
        duration_seconds, credits_awarded_x, credits_awarded_o, ended_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.matchId,
      record.playerXId,
      record.playerXUsername,
      record.playerOId,
      record.playerOUsername,
      record.winnerId || null,
      record.loserId || null,
      record.isDraw ? 1 : 0,
      record.reason,
      record.moveCount,
      record.gridSize,
      record.winCondition,
      record.durationSeconds,
      record.creditsAwardedX,
      record.creditsAwardedO,
      record.endedAt
    );
  } else {
    inMemoryMatches.unshift(record);
    persistFallback();
  }
}

function getAllMatches() {
  if (!useFallback && db) {
    const stmt = db.prepare('SELECT * FROM matches ORDER BY ended_at DESC');
    return stmt.all().map(m => ({
      ...m,
      is_draw: Boolean(m.is_draw)
    }));
  }
  return [...inMemoryMatches];
}

module.exports = {
  recordMatch,
  getAllMatches
};
