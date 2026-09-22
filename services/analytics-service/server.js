const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createLogger } = require('../shared/logger');
const { createRedisClient } = require('../shared/redisClient');
const db = require('./db');

const logger = createLogger('AnalyticsService');
const app = express();
const PORT = process.env.PORT || 5005;

const REGISTRY_SERVICE_URL = process.env.REGISTRY_SERVICE_URL || 'http://localhost:5002';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';

app.use(cors());
app.use(express.json());

// Redis Subscriber for Game Events
const redisSubscriber = createRedisClient('AnalyticsSubscriber');

/**
 * Fetch latest scoring policy from Registry Service
 */
async function fetchScoringPolicy() {
  try {
    const res = await fetch(`${REGISTRY_SERVICE_URL}/api/config/scoring`);
    if (res.ok) {
      const data = await res.json();
      return data.scoring;
    }
  } catch (err) {
    logger.warn(`Could not fetch scoring policy (${err.message}). Using fallback defaults.`);
  }
  return { winCredits: 50, lossCredits: -10, drawCredits: 10 };
}

/**
 * Dispatch credit update to Auth Service
 */
async function updatePlayerCredits(userId, delta) {
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/api/auth/users/${userId}/credits`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    });
    if (!res.ok) {
      logger.error(`Failed to update credits for user ${userId}: Status ${res.status}`);
    } else {
      logger.info(`Successfully updated credits for ${userId} with delta ${delta}`);
    }
  } catch (err) {
    logger.error(`Error notifying Auth Service for credit update of ${userId}:`, err.message);
  }
}

/**
 * Event-Driven Listener:
 * Subscribes to 'game:events' and processes GAME_OVER payloads.
 */
redisSubscriber.subscribe('game:events', (err) => {
  if (err) logger.error('Failed to subscribe to game:events:', err.message);
  else logger.info('Analytics Service successfully subscribed to Redis channel: game:events');
});

redisSubscriber.on('message', async (channel, message) => {
  if (channel === 'game:events') {
    try {
      const eventData = JSON.parse(message);
      if (eventData.event === 'GAME_OVER') {
        logger.info(`Received GAME_OVER event for match ${eventData.matchId}`);

        const scoringPolicy = await fetchScoringPolicy();
        let creditsX = 0;
        let creditsO = 0;

        const playerXId = eventData.players.playerX.userId;
        const playerOId = eventData.players.playerO.userId;

        if (eventData.isDraw) {
          creditsX = scoringPolicy.drawCredits;
          creditsO = scoringPolicy.drawCredits;
        } else if (eventData.winnerId === playerXId) {
          creditsX = scoringPolicy.winCredits;
          creditsO = scoringPolicy.lossCredits;
        } else if (eventData.winnerId === playerOId) {
          creditsX = scoringPolicy.lossCredits;
          creditsO = scoringPolicy.winCredits;
        }

        // Apply credit updates via Auth Service
        await Promise.all([
          updatePlayerCredits(playerXId, creditsX),
          updatePlayerCredits(playerOId, creditsO)
        ]);

        // Record match in analytics database
        const matchRecord = {
          id: `rec-${crypto.randomUUID().slice(0, 8)}`,
          matchId: eventData.matchId,
          playerXId,
          playerXUsername: eventData.players.playerX.username,
          playerOId,
          playerOUsername: eventData.players.playerO.username,
          winnerId: eventData.winnerId,
          loserId: eventData.loserId,
          isDraw: eventData.isDraw,
          reason: eventData.reason,
          moveCount: eventData.moveCount || 0,
          gridSize: eventData.gridSize || 3,
          winCondition: eventData.winCondition || 3,
          durationSeconds: eventData.durationSeconds || 0,
          creditsAwardedX: creditsX,
          creditsAwardedO: creditsO,
          endedAt: eventData.endedAt || new Date().toISOString()
        };

        db.recordMatch(matchRecord);
        logger.info(`Stored match record ${matchRecord.id} for match ${eventData.matchId}`);
      }
    } catch (err) {
      logger.error('Failed to process game:events message:', err);
    }
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ service: 'analytics-service', status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * GET /api/analytics/overview
 * Provides high-level summary metrics
 */
app.get('/api/analytics/overview', async (req, res) => {
  try {
    const matches = db.getAllMatches();
    const totalMatches = matches.length;
    const totalDraws = matches.filter(m => m.is_draw).length;
    const totalWins = totalMatches - totalDraws;
    const totalDuration = matches.reduce((acc, m) => acc + (m.duration_seconds || 0), 0);
    const avgDuration = totalMatches > 0 ? Math.round(totalDuration / totalMatches) : 0;
    const totalMoves = matches.reduce((acc, m) => acc + (m.move_count || 0), 0);
    const avgMoves = totalMatches > 0 ? (totalMoves / totalMatches).toFixed(1) : '0';

    return res.json({
      overview: {
        totalMatches,
        totalWins,
        totalDraws,
        avgDurationSeconds: avgDuration,
        avgMovesPerMatch: parseFloat(avgMoves)
      }
    });
  } catch (err) {
    logger.error('Failed to generate analytics overview:', err);
    return res.status(500).json({ error: 'Failed to retrieve analytics overview' });
  }
});

/**
 * GET /api/analytics/matches
 * Returns detailed match history
 */
app.get('/api/analytics/matches', (req, res) => {
  try {
    const matches = db.getAllMatches();
    return res.json({ matches });
  } catch (err) {
    logger.error('Failed to get match records:', err);
    return res.status(500).json({ error: 'Failed to retrieve match history' });
  }
});

/**
 * GET /api/analytics/win-rates
 * Returns aggregated player performance for Recharts charts
 */
app.get('/api/analytics/win-rates', (req, res) => {
  try {
    const matches = db.getAllMatches();
    const statsMap = new Map();

    matches.forEach(m => {
      // Process Player X
      if (!statsMap.has(m.player_x_username)) {
        statsMap.set(m.player_x_username, { username: m.player_x_username, played: 0, wins: 0, losses: 0, draws: 0 });
      }
      // Process Player O
      if (!statsMap.has(m.player_o_username)) {
        statsMap.set(m.player_o_username, { username: m.player_o_username, played: 0, wins: 0, losses: 0, draws: 0 });
      }

      const pX = statsMap.get(m.player_x_username);
      const pO = statsMap.get(m.player_o_username);

      pX.played += 1;
      pO.played += 1;

      if (m.is_draw) {
        pX.draws += 1;
        pO.draws += 1;
      } else if (m.winner_id === m.player_x_id) {
        pX.wins += 1;
        pO.losses += 1;
      } else {
        pO.wins += 1;
        pX.losses += 1;
      }
    });

    const playerStats = Array.from(statsMap.values()).map(p => ({
      ...p,
      winRate: p.played > 0 ? Math.round((p.wins / p.played) * 100) : 0
    })).sort((a, b) => b.wins - a.wins);

    return res.json({ playerStats });
  } catch (err) {
    logger.error('Failed to compute win rates:', err);
    return res.status(500).json({ error: 'Failed to compute win rate analytics' });
  }
});

/**
 * GET /api/analytics/leaderboard
 * Fetches users with their credits from Auth Service
 */
app.get('/api/analytics/leaderboard', async (req, res) => {
  try {
    const authRes = await fetch(`${AUTH_SERVICE_URL}/api/auth/users`);
    if (!authRes.ok) throw new Error('Auth service returned non-200');
    const { users } = await authRes.json();
    return res.json({ leaderboard: users });
  } catch (err) {
    logger.error('Failed to get leaderboard:', err);
    return res.status(500).json({ error: 'Failed to retrieve leaderboard' });
  }
});

app.listen(PORT, () => {
  logger.info(`Analytics & Scoring Service running on http://0.0.0.0:${PORT}`);
});
