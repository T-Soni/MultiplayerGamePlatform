const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { createLogger } = require('../shared/logger');
const { createRedisClient } = require('../shared/redisClient');
const { createGameState, makeMove } = require('./logic/ticTacToeEngine');

const logger = createLogger('GameEngine');
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5004;
const REGISTRY_SERVICE_URL = process.env.REGISTRY_SERVICE_URL || 'http://localhost:5002';

app.use(cors());
app.use(express.json());

// Socket.io initialization with CORS enabled
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Redis Clients for Event-Driven Communication
const redisPublisher = createRedisClient('GameEnginePublisher');
const redisSubscriber = createRedisClient('GameEngineSubscriber');

/**
 * In-Memory Active Game Sessions
 * matchId -> {
 *   matchId,
 *   players: { playerX: { userId, username, socketId }, playerO: { userId, username, socketId } },
 *   state: GameState,
 *   turnTimer: NodeJS.Timeout | null,
 *   rules: { gridSize, winCondition, turnTimeoutSeconds }
 * }
 */
const activeGames = new Map();

/**
 * Fetch latest dynamic rules from Registry & Configuration Service
 */
async function fetchLatestRules() {
  try {
    const res = await fetch(`${REGISTRY_SERVICE_URL}/api/config/rules`);
    if (res.ok) {
      const data = await res.json();
      return data.rules;
    }
  } catch (err) {
    logger.warn(`Could not fetch rules from Registry Service (${err.message}). Using fallback defaults.`);
  }
  return { gridSize: 3, winCondition: 3, turnTimeoutSeconds: 30 };
}

/**
 * Subscribe to MATCH_CREATED events from Matchmaking Service
 */
redisSubscriber.subscribe('match:events', (err) => {
  if (err) logger.error('Failed to subscribe to match:events:', err.message);
  else logger.info('Subscribed to Redis channel: match:events');
});

redisSubscriber.on('message', async (channel, message) => {
  if (channel === 'match:events') {
    try {
      const data = JSON.parse(message);
      if (data.event === 'MATCH_CREATED') {
        const { matchId, match } = data;
        const rules = await fetchLatestRules();
        
        const gridSize = match?.gridSize || data?.gridSize || rules.gridSize || 3;
        const winCondition = match?.winCondition || data?.winCondition || (gridSize === 3 ? 3 : (gridSize === 4 ? 4 : rules.winCondition));
        const initialGameState = createGameState(gridSize, winCondition);

        activeGames.set(matchId, {
          matchId,
          players: {
            playerX: { userId: match.playerX.userId, username: match.playerX.username, socketId: null },
            playerO: { userId: match.playerO.userId, username: match.playerO.username, socketId: null }
          },
          state: initialGameState,
          rules: { ...rules, gridSize, winCondition },
          turnTimer: null,
          createdAt: Date.now()
        });

        logger.info(`Game session initialized for match ${matchId} (Grid: ${gridSize}x${gridSize}, WinCond: ${winCondition})`);
      }
    } catch (err) {
      logger.error('Error handling match:events message:', err);
    }
  }
});

/**
 * Publishes GAME_OVER event onto Redis Pub/Sub for Analytics & Scoring Service
 */
async function publishGameOver(game, winnerId, loserId, isDraw, reason) {
  const durationSeconds = Math.round((Date.now() - game.createdAt) / 1000);
  const payload = {
    event: 'GAME_OVER',
    matchId: game.matchId,
    winnerId: isDraw ? null : winnerId,
    loserId: isDraw ? null : loserId,
    isDraw,
    reason, // 'win' | 'draw' | 'resignation' | 'timeout'
    players: {
      playerX: { userId: game.players.playerX.userId, username: game.players.playerX.username },
      playerO: { userId: game.players.playerO.userId, username: game.players.playerO.username }
    },
    moveCount: game.state.movesCount,
    gridSize: game.rules.gridSize,
    winCondition: game.rules.winCondition,
    durationSeconds,
    endedAt: new Date().toISOString()
  };

  logger.info(`Publishing GAME_OVER event to Redis channel 'game:events' for match ${game.matchId}`);
  try {
    await redisPublisher.publish('game:events', JSON.stringify(payload));
  } catch (err) {
    logger.error('Failed to publish GAME_OVER to Redis:', err.message);
  }
}

/**
 * WebSocket Real-time Management with Socket.io
 */
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  /**
   * Event: join_game
   * Payload: { matchId, userId, username, playerSymbol }
   */
  socket.on('join_game', async (data) => {
    const { matchId, userId, username, playerSymbol } = data;
    socket.join(matchId);

    let game = activeGames.get(matchId);
    if (!game) {
      // Lazy initialize if not yet loaded from Redis
      const rules = await fetchLatestRules();
      game = {
        matchId,
        players: {
          playerX: { userId: playerSymbol === 'X' ? userId : 'pending', username: playerSymbol === 'X' ? username : 'Player 1', socketId: null },
          playerO: { userId: playerSymbol === 'O' ? userId : 'pending', username: playerSymbol === 'O' ? username : 'Player 2', socketId: null }
        },
        state: createGameState(rules.gridSize, rules.winCondition),
        rules,
        turnTimer: null,
        createdAt: Date.now()
      };
      activeGames.set(matchId, game);
    }

    // Attach socket ID to player
    if (game.players.playerX.userId === userId || (!game.players.playerX.socketId && playerSymbol === 'X')) {
      game.players.playerX.socketId = socket.id;
      game.players.playerX.username = username;
      game.players.playerX.userId = userId;
    } else if (game.players.playerO.userId === userId || (!game.players.playerO.socketId && playerSymbol === 'O')) {
      game.players.playerO.socketId = socket.id;
      game.players.playerO.username = username;
      game.players.playerO.userId = userId;
    }

    logger.info(`Player ${username} (${userId}) joined room ${matchId} as ${playerSymbol}`);

    // Send game initialized state to client
    socket.emit('game_init', {
      matchId: game.matchId,
      players: {
        playerX: { userId: game.players.playerX.userId, username: game.players.playerX.username },
        playerO: { userId: game.players.playerO.userId, username: game.players.playerO.username }
      },
      rules: game.rules,
      state: game.state
    });

    // Notify room of connection
    io.to(matchId).emit('player_status_change', {
      players: {
        playerX: { username: game.players.playerX.username, connected: !!game.players.playerX.socketId },
        playerO: { username: game.players.playerO.username, connected: !!game.players.playerO.socketId }
      }
    });
  });

  /**
   * Event: make_move
   * Payload: { matchId, cellIndex, playerSymbol, userId }
   */
  socket.on('make_move', async (data) => {
    const { matchId, cellIndex, playerSymbol, userId } = data;
    const game = activeGames.get(matchId);

    if (!game) {
      return socket.emit('move_error', { message: 'Game session not found' });
    }

    // Verify authorized player for this symbol
    const expectedPlayer = playerSymbol === 'X' ? game.players.playerX : game.players.playerO;
    if (expectedPlayer.userId !== userId) {
      return socket.emit('move_error', { message: 'Unauthorized move for this player symbol' });
    }

    // Execute move logic
    const result = makeMove(game.state, cellIndex, playerSymbol);

    if (!result.success) {
      return socket.emit('move_error', { message: result.error });
    }

    // Update active game state
    game.state = result.updatedState;

    logger.info(`Valid move in match ${matchId}: cell ${cellIndex} by ${playerSymbol} (${userId})`);

    // Broadcast move to all players in the room
    io.to(matchId).emit('move_made', {
      cellIndex,
      playerSymbol,
      state: game.state
    });

    // If game ended, broadcast and publish event
    if (game.state.isGameOver) {
      let winnerId = null;
      let loserId = null;

      if (game.state.winner) {
        winnerId = game.state.winner === 'X' ? game.players.playerX.userId : game.players.playerO.userId;
        loserId = game.state.winner === 'X' ? game.players.playerO.userId : game.players.playerX.userId;
      }

      io.to(matchId).emit('game_over', {
        winner: game.state.winner,
        winningLine: game.state.winningLine,
        isDraw: game.state.isDraw,
        winnerId,
        loserId,
        reason: game.state.isDraw ? 'draw' : 'win'
      });

      await publishGameOver(game, winnerId, loserId, game.state.isDraw, game.state.isDraw ? 'draw' : 'win');
    }
  });

  /**
   * Event: resign
   * Payload: { matchId, userId }
   */
  socket.on('resign', async (data) => {
    const { matchId, userId } = data;
    const game = activeGames.get(matchId);
    if (!game || game.state.isGameOver) return;

    const isPlayerX = game.players.playerX.userId === userId;
    const winnerId = isPlayerX ? game.players.playerO.userId : game.players.playerX.userId;
    const winnerSymbol = isPlayerX ? 'O' : 'X';

    game.state.isGameOver = true;
    game.state.winner = winnerSymbol;

    logger.info(`Match ${matchId} ended by resignation from user ${userId}`);

    io.to(matchId).emit('game_over', {
      winner: winnerSymbol,
      winningLine: null,
      isDraw: false,
      winnerId,
      loserId: userId,
      reason: 'resignation'
    });

    await publishGameOver(game, winnerId, userId, false, 'resignation');
  });

  socket.on('leave_game', (data) => {
    if (data && data.matchId) {
      socket.leave(data.matchId);
      logger.info(`Socket ${socket.id} left room ${data.matchId}`);
    }
  });

  socket.on('disconnect', () => {
    // Check if player belonged to any active game
    for (const [matchId, game] of activeGames.entries()) {
      if (game.players.playerX.socketId === socket.id) {
        game.players.playerX.socketId = null;
        io.to(matchId).emit('player_disconnected', { playerSymbol: 'X', username: game.players.playerX.username });
      } else if (game.players.playerO.socketId === socket.id) {
        game.players.playerO.socketId = null;
        io.to(matchId).emit('player_disconnected', { playerSymbol: 'O', username: game.players.playerO.username });
      }
    }
  });
});

// REST Health Check & Active Games inspection
app.get('/health', (req, res) => {
  res.json({
    service: 'game-engine',
    status: 'healthy',
    activeGamesCount: activeGames.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/games/active', (req, res) => {
  const games = Array.from(activeGames.values()).map(g => ({
    matchId: g.matchId,
    players: g.players,
    rules: g.rules,
    isGameOver: g.state.isGameOver,
    movesCount: g.state.movesCount
  }));
  res.json({ games });
});

server.listen(PORT, () => {
  logger.info(`Live Game Engine WebSocket server running on http://0.0.0.0:${PORT}`);
});
