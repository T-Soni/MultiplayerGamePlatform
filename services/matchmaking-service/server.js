const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createLogger } = require('../shared/logger');
const { createRedisClient } = require('../shared/redisClient');

const logger = createLogger('MatchmakingService');
const app = express();
const PORT = process.env.PORT || 5003;

app.use(cors());
app.use(express.json());

// Redis Clients for Matchmaking events
const redisPublisher = createRedisClient('MatchmakingPublisher');
const redisSubscriber = createRedisClient('MatchmakingSubscriber');

/**
 * Mode-Specific Matchmaking Queues
 * gridSize (3, 4, 5) -> Array of { userId, username, joinedAt, gridSize }
 */
const queuesByGrid = {
  3: [],
  4: [],
  5: []
};

const playerStatusMap = new Map(); // userId -> { status: 'queued'|'matched'|'idle', match: null, gridSize, queuedAt }
const activeMatches = new Map(); // matchId -> match details

/**
 * Event-Driven Listener:
 * When a game ends on the Live Game Engine, clear the match and free both players.
 */
redisSubscriber.subscribe('game:events', (err) => {
  if (err) logger.error('Failed to subscribe to game:events:', err.message);
  else logger.info('Matchmaking Service subscribed to Redis channel: game:events');
});

redisSubscriber.on('message', (channel, message) => {
  if (channel === 'game:events') {
    try {
      const data = JSON.parse(message);
      if (data.event === 'GAME_OVER') {
        const { matchId, players } = data;
        activeMatches.delete(matchId);

        if (players?.playerX?.userId) {
          playerStatusMap.set(players.playerX.userId, { status: 'idle', match: null });
        }
        if (players?.playerO?.userId) {
          playerStatusMap.set(players.playerO.userId, { status: 'idle', match: null });
        }

        logger.info(`Match ${matchId} concluded. Players reset to idle state.`);
      }
    } catch (err) {
      logger.error('Failed to parse game:events in Matchmaking:', err);
    }
  }
});

// Health Check
app.get('/health', (req, res) => {
  const queueStats = {};
  for (const [grid, q] of Object.entries(queuesByGrid)) {
    queueStats[`${grid}x${grid}`] = q.length;
  }

  res.json({
    service: 'matchmaking-service',
    status: 'healthy',
    queues: queueStats,
    activeMatchesCount: activeMatches.size,
    timestamp: new Date().toISOString()
  });
});

/**
 * Internal Matchmaking Evaluation for a specific Grid Size:
 * Pairs 2 players who both chose the same board dimension (e.g. 3x3 vs 3x3, 4x4 vs 4x4).
 */
function processQueue(gridSize) {
  const queue = queuesByGrid[gridSize];
  if (!queue) return;

  while (queue.length >= 2) {
    const player1 = queue.shift();
    const player2 = queue.shift();

    // Prevent matching the same user if duplicate joined
    if (player1.userId === player2.userId) {
      queue.unshift(player1);
      break;
    }

    const matchId = `match-${crypto.randomUUID().slice(0, 8)}`;
    
    // Default winCondition based on gridSize
    const winCondition = gridSize === 3 ? 3 : (gridSize === 4 ? 4 : 4);

    const match = {
      matchId,
      gridSize,
      winCondition,
      playerX: {
        userId: player1.userId,
        username: player1.username,
        symbol: 'X'
      },
      playerO: {
        userId: player2.userId,
        username: player2.username,
        symbol: 'O'
      },
      createdAt: new Date().toISOString(),
      status: 'ready'
    };

    activeMatches.set(matchId, match);

    // Update status for both players
    playerStatusMap.set(player1.userId, { status: 'matched', match, matchedAt: Date.now() });
    playerStatusMap.set(player2.userId, { status: 'matched', match, matchedAt: Date.now() });

    logger.info(`Match created: ${matchId} [${gridSize}x${gridSize}] | ${player1.username} (X) vs ${player2.username} (O)`);

    // Event-Driven: Publish MATCH_CREATED event with chosen gridSize to Redis
    const payload = JSON.stringify({
      event: 'MATCH_CREATED',
      matchId,
      match,
      gridSize,
      winCondition,
      timestamp: new Date().toISOString()
    });

    redisPublisher.publish('match:events', payload).catch(err => {
      logger.error('Failed to publish MATCH_CREATED event:', err.message);
    });
  }
}

/**
 * POST /api/matchmaking/join
 * Player joins the matchmaking queue for their desired grid size.
 * Body: { userId, username, gridSize?: number }
 */
app.post('/api/matchmaking/join', (req, res) => {
  try {
    const { userId, username, gridSize = 3 } = req.body;
    if (!userId || !username) {
      return res.status(400).json({ error: 'userId and username are required' });
    }

    const targetGrid = [3, 4, 5].includes(Number(gridSize)) ? Number(gridSize) : 3;

    // Clear any previous queues or match references
    for (const grid of [3, 4, 5]) {
      const idx = queuesByGrid[grid].findIndex(p => p.userId === userId);
      if (idx !== -1) queuesByGrid[grid].splice(idx, 1);
    }
    playerStatusMap.delete(userId);

    // Add to target queue
    const queueEntry = { userId, username, gridSize: targetGrid, joinedAt: Date.now() };
    queuesByGrid[targetGrid].push(queueEntry);

    playerStatusMap.set(userId, {
      status: 'queued',
      gridSize: targetGrid,
      queuedAt: Date.now(),
      match: null
    });

    logger.info(`Player joined ${targetGrid}x${targetGrid} queue: ${username} (${userId}) | Queue size: ${queuesByGrid[targetGrid].length}`);

    // Trigger matchmaking cycle for this grid size
    processQueue(targetGrid);

    const currentStatus = playerStatusMap.get(userId);
    return res.json({
      message: currentStatus.status === 'matched' ? 'Match ready!' : `Joined ${targetGrid}x${targetGrid} matchmaking queue`,
      status: currentStatus.status,
      gridSize: targetGrid,
      queuePosition: currentStatus.status === 'queued' ? queuesByGrid[targetGrid].length : null,
      match: currentStatus.match || null
    });
  } catch (err) {
    logger.error('Error joining queue:', err);
    return res.status(500).json({ error: 'Failed to join matchmaking queue' });
  }
});

/**
 * POST /api/matchmaking/leave
 * Player cancels search
 * Body: { userId }
 */
app.post('/api/matchmaking/leave', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    for (const grid of [3, 4, 5]) {
      const idx = queuesByGrid[grid].findIndex(p => p.userId === userId);
      if (idx !== -1) queuesByGrid[grid].splice(idx, 1);
    }
    playerStatusMap.set(userId, { status: 'idle', match: null });
    logger.info(`Player left queue: ${userId}`);

    return res.json({ message: 'Left matchmaking queue', status: 'idle' });
  } catch (err) {
    logger.error('Error leaving queue:', err);
    return res.status(500).json({ error: 'Failed to leave queue' });
  }
});

/**
 * GET /api/matchmaking/status/:userId
 * Poll player status
 */
app.get('/api/matchmaking/status/:userId', (req, res) => {
  const { userId } = req.params;
  const status = playerStatusMap.get(userId) || { status: 'idle', match: null };

  if (status.status === 'queued') {
    const grid = status.gridSize || 3;
    const queuePos = (queuesByGrid[grid] || []).findIndex(p => p.userId === userId) + 1;
    return res.json({
      status: 'queued',
      gridSize: grid,
      queuePosition: queuePos > 0 ? queuePos : 1,
      totalQueued: (queuesByGrid[grid] || []).length
    });
  }

  if (status.status === 'matched') {
    return res.json({
      status: 'matched',
      match: status.match
    });
  }

  return res.json({ status: 'idle', match: null });
});

/**
 * GET /api/matchmaking/queue
 * Returns queue counts across all game modes
 */
app.get('/api/matchmaking/queue', (req, res) => {
  return res.json({
    modes: {
      3: { count: queuesByGrid[3].length, name: '3x3 Classic' },
      4: { count: queuesByGrid[4].length, name: '4x4 Tactical' },
      5: { count: queuesByGrid[5].length, name: '5x5 Grand' }
    }
  });
});

app.listen(PORT, () => {
  logger.info(`Matchmaking Service running on http://0.0.0.0:${PORT}`);
});
