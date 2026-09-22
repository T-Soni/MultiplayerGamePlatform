const express = require('express');
const cors = require('cors');
const { createLogger } = require('../shared/logger');
const { authenticateToken, requireAdmin } = require('../shared/authMiddleware');
const db = require('./db');

const logger = createLogger('RegistryService');
const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ service: 'registry-service', status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * GET /api/config/rules
 * Fetch current active game rules (Publicly readable so clients and engines can load active rules)
 */
app.get('/api/config/rules', (req, res) => {
  try {
    const rules = db.getRules();
    return res.json({ rules });
  } catch (err) {
    logger.error('Failed to get rules:', err);
    return res.status(500).json({ error: 'Failed to retrieve game rules' });
  }
});

/**
 * POST /api/config/rules
 * Upload/Update game rules: { gridSize, winCondition, turnTimeoutSeconds }
 * PROTECTED: Requires valid JWT and Admin role.
 */
app.post('/api/config/rules', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { gridSize, winCondition, turnTimeoutSeconds } = req.body;

    // Validation
    const size = parseInt(gridSize, 10);
    const win = parseInt(winCondition, 10);
    const timeout = turnTimeoutSeconds ? parseInt(turnTimeoutSeconds, 10) : 30;

    if (isNaN(size) || size < 3 || size > 8) {
      return res.status(400).json({ error: 'gridSize must be an integer between 3 and 8' });
    }
    if (isNaN(win) || win < 3 || win > size) {
      return res.status(400).json({ error: `winCondition must be between 3 and gridSize (${size})` });
    }
    if (isNaN(timeout) || timeout < 5 || timeout > 120) {
      return res.status(400).json({ error: 'turnTimeoutSeconds must be between 5 and 120' });
    }

    const updatedRules = db.saveRules({
      gridSize: size,
      winCondition: win,
      turnTimeoutSeconds: timeout
    });

    logger.info(`Admin ${req.user.username} updated game rules: Grid=${size}x${size}, WinCondition=${win}, Timeout=${timeout}s`);
    return res.json({
      message: 'Game rules updated successfully',
      rules: updatedRules
    });
  } catch (err) {
    logger.error('Failed to update rules:', err);
    return res.status(500).json({ error: 'Failed to update game rules' });
  }
});

/**
 * GET /api/config/scoring
 * Fetch current scoring policy (Publicly readable)
 */
app.get('/api/config/scoring', (req, res) => {
  try {
    const scoring = db.getScoringPolicy();
    return res.json({ scoring });
  } catch (err) {
    logger.error('Failed to get scoring policy:', err);
    return res.status(500).json({ error: 'Failed to retrieve scoring policy' });
  }
});

/**
 * POST /api/config/scoring
 * Upload/Update scoring policy: { winCredits, lossCredits, drawCredits }
 * PROTECTED: Requires valid JWT and Admin role.
 */
app.post('/api/config/scoring', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { winCredits, lossCredits, drawCredits } = req.body;

    const win = parseInt(winCredits, 10);
    const loss = parseInt(lossCredits, 10);
    const draw = parseInt(drawCredits, 10);

    if (isNaN(win) || isNaN(loss) || isNaN(draw)) {
      return res.status(400).json({ error: 'winCredits, lossCredits, and drawCredits must be valid integers' });
    }

    const updatedScoring = db.saveScoringPolicy({
      winCredits: win,
      lossCredits: loss,
      drawCredits: draw
    });

    logger.info(`Admin ${req.user.username} updated scoring policy: Win=+${win}, Loss=${loss}, Draw=+${draw}`);
    return res.json({
      message: 'Scoring policy updated successfully',
      scoring: updatedScoring
    });
  } catch (err) {
    logger.error('Failed to update scoring policy:', err);
    return res.status(500).json({ error: 'Failed to update scoring policy' });
  }
});

/**
 * GET /api/config/all
 * Combined endpoint
 */
app.get('/api/config/all', (req, res) => {
  return res.json({
    rules: db.getRules(),
    scoring: db.getScoringPolicy()
  });
});

app.listen(PORT, () => {
  logger.info(`Registry & Configuration Service running on http://0.0.0.0:${PORT}`);
});
