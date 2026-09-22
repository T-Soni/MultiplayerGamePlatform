const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('DBHelper');

/**
 * Initializes a resilient SQLite or file-backed database store.
 * Uses Node 22's built-in node:sqlite (DatabaseSync) if available,
 * with graceful fallback to file-backed JSON persistence.
 */
function createStore(dbFilePath) {
  // Ensure directory exists
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let nativeDb = null;
  try {
    const { DatabaseSync } = require('node:sqlite');
    nativeDb = new DatabaseSync(dbFilePath);
    logger.info(`Initialized SQLite database at ${dbFilePath} via node:sqlite`);
  } catch (err) {
    logger.warn(`node:sqlite not available (${err.message}). Using JSON file fallback.`);
  }

  return {
    isNative: !!nativeDb,
    db: nativeDb,
    exec(sql) {
      if (nativeDb) {
        return nativeDb.exec(sql);
      }
    },
    prepare(sql) {
      if (nativeDb) {
        return nativeDb.prepare(sql);
      }
    }
  };
}

module.exports = { createStore };
