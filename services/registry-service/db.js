const path = require('path');
const fs = require('fs');
const { createLogger } = require('../shared/logger');

const logger = createLogger('RegistryService:DB');
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'registry.sqlite');

let db = null;
let useFallback = false;

const defaultRules = {
  id: 'rules-current',
  gridSize: 3,
  winCondition: 3,
  turnTimeoutSeconds: 30,
  updatedAt: new Date().toISOString()
};

const defaultScoring = {
  id: 'scoring-current',
  winCredits: 50,
  lossCredits: -10,
  drawCredits: 10,
  updatedAt: new Date().toISOString()
};

let inMemoryConfig = {
  rules: { ...defaultRules },
  scoring: { ...defaultScoring }
};

try {
  const { DatabaseSync } = require('node:sqlite');
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  logger.info(`Registry connected to SQLite at ${DB_FILE}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default rules if not existing
  const stmtRules = db.prepare('SELECT value FROM config WHERE key = ?');
  const rowRules = stmtRules.get('rules');
  if (!rowRules) {
    db.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)').run(
      'rules',
      JSON.stringify(defaultRules),
      new Date().toISOString()
    );
  }

  const rowScoring = stmtRules.get('scoring');
  if (!rowScoring) {
    db.prepare('INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)').run(
      'scoring',
      JSON.stringify(defaultScoring),
      new Date().toISOString()
    );
  }
} catch (err) {
  logger.warn(`node:sqlite unavailable (${err.message}). Using JSON file fallback.`);
  useFallback = true;
  const jsonPath = DB_FILE.replace(/\.sqlite$/, '.json');
  if (fs.existsSync(jsonPath)) {
    try {
      inMemoryConfig = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (_) {}
  }
}

function persistFallback() {
  if (!useFallback) return;
  const jsonPath = DB_FILE.replace(/\.sqlite$/, '.json');
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(inMemoryConfig, null, 2));
  } catch (err) {
    logger.error('Failed to persist JSON fallback config:', err.message);
  }
}

function getRules() {
  if (!useFallback && db) {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get('rules');
    return row ? JSON.parse(row.value) : defaultRules;
  }
  return inMemoryConfig.rules;
}

function saveRules(rulesData) {
  const current = getRules();
  const updated = {
    ...current,
    ...rulesData,
    updatedAt: new Date().toISOString()
  };

  if (!useFallback && db) {
    db.prepare(`
      INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run('rules', JSON.stringify(updated), updated.updatedAt);
  } else {
    inMemoryConfig.rules = updated;
    persistFallback();
  }
  return updated;
}

function getScoringPolicy() {
  if (!useFallback && db) {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get('scoring');
    return row ? JSON.parse(row.value) : defaultScoring;
  }
  return inMemoryConfig.scoring;
}

function saveScoringPolicy(scoringData) {
  const current = getScoringPolicy();
  const updated = {
    ...current,
    ...scoringData,
    updatedAt: new Date().toISOString()
  };

  if (!useFallback && db) {
    db.prepare(`
      INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run('scoring', JSON.stringify(updated), updated.updatedAt);
  } else {
    inMemoryConfig.scoring = updated;
    persistFallback();
  }
  return updated;
}

module.exports = {
  getRules,
  saveRules,
  getScoringPolicy,
  saveScoringPolicy
};
