const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('RedisClient');

let Redis;
try {
  Redis = require('ioredis');
} catch {
  // Fallback to resolving from service node_modules
  const candidatePaths = [
    path.join(__dirname, '../game-engine'),
    path.join(__dirname, '../matchmaking-service'),
    path.join(__dirname, '../analytics-service')
  ];
  for (const p of candidatePaths) {
    try {
      const resolved = require.resolve('ioredis', { paths: [p] });
      Redis = require(resolved);
      break;
    } catch (_) {}
  }
}

if (!Redis) {
  throw new Error('ioredis is not installed in shared or service node_modules');
}

/**
 * Creates Redis client with retry configuration and error handling.
 */
function createRedisClient(role = 'default') {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) {
        logger.warn(`Redis connection retried ${times} times for ${role}. Backing off...`);
        return 5000;
      }
      return Math.min(times * 200, 2000);
    },
    reconnectOnError(err) {
      logger.warn(`Redis reconnectOnError (${role}):`, err.message);
      return true;
    }
  });

  client.on('connect', () => {
    logger.info(`Redis client connected (${role}) to ${redisUrl}`);
  });

  client.on('ready', () => {
    logger.info(`Redis client ready (${role})`);
  });

  client.on('error', (err) => {
    logger.error(`Redis error (${role}):`, err.message);
  });

  return client;
}

module.exports = { createRedisClient };
